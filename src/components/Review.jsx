import { useState } from 'react';
import QuestionCard from './QuestionCard.jsx';
import { normalize, MASTER_STREAK } from '../lib/srs.js';

// 間違えた問題だけを解くモード（エビングハウスの忘却曲線・5回連続の完璧でマスター）
export default function Review({ store, onOpenKeyword, onGoAudio }) {
  const { dueReviewQuestions, reviewQuestions, memos, links, recordAnswer, setMemo, setLink, srs, GRADES } = store;

  const [started, setStarted] = useState(false);
  const [order, setOrder] = useState([]);
  const [idx, setIdx] = useState(0);
  const [sessionStats, setSessionStats] = useState({ total: 0, correct: 0 });

  const start = () => {
    if (dueReviewQuestions.length === 0) return;
    setOrder(dueReviewQuestions);
    setIdx(0);
    setSessionStats({ total: 0, correct: 0 });
    setStarted(true);
  };

  const handleAnswered = (correct, grade) => {
    recordAnswer(order[idx], correct, grade);
    setSessionStats((s) => ({ total: s.total + 1, correct: s.correct + (correct ? 1 : 0) }));
  };

  const handleNext = () => {
    if (idx + 1 < order.length) setIdx(idx + 1);
    else setIdx(order.length);
  };

  // ---- 復習対象が無い ----
  if (!started && reviewQuestions.length === 0) {
    return (
      <div className="view">
        <h2 className="view-title">間違えた問題</h2>
        <div className="empty">
          <div className="ico">🎉</div>
          <p>今は復習が必要な問題はありません。</p>
          <p className="inline-note">
            一問一答や模擬試験で間違えた問題が、自動でここに溜まっていきます。
          </p>
        </div>
      </div>
    );
  }

  // ---- 開始前 ----
  if (!started) {
    const dueCount = dueReviewQuestions.length;
    return (
      <div className="view">
        <h2 className="view-title">間違えた問題</h2>
        <p className="view-desc">
          間違えた・△・✕（自信のない）問題だけを、<strong>エビングハウスの忘却曲線</strong>に沿って再出題します。
          <strong>○（完璧）が5回連続</strong>で続くまでマスターになりません（△・✕・誤答でリセット）。
        </p>

        <div className="tiles">
          <div className="tile">
            <div className="num">{reviewQuestions.length}</div>
            <div className="lbl">復習リスト</div>
          </div>
          <div className="tile">
            <div className="num" style={{ color: dueCount > 0 ? 'var(--wrong)' : 'var(--navy)' }}>
              {dueCount}
            </div>
            <div className="lbl">今日の復習</div>
          </div>
          <div className="tile">
            <div className="num">
              {reviewQuestions.filter((q) => (normalize(srs[q.id]).correctStreak || 0) >= 3).length}
            </div>
            <div className="lbl">マスター間近</div>
          </div>
        </div>

        <div className="section-label" style={{ marginTop: 0 }}>復習のしかたを選ぶ</div>
        <button className="btn primary block lg" onClick={start} disabled={dueCount === 0}>
          {dueCount > 0 ? `📝 一問一答で復習（${dueCount}問・○△✕）` : '今日の復習は完了しました'}
        </button>
        <button
          className="btn block lg"
          style={{ marginTop: 10 }}
          onClick={() => onGoAudio?.()}
          disabled={reviewQuestions.length === 0}
        >
          🎧 音声で復習（{reviewQuestions.length}問を読み上げ）
        </button>
        <p className="inline-note" style={{ marginTop: 8 }}>
          一問一答は、選択式・○×で答えたあと「○（完璧）／△（あいまい）／✕（わからない）」で理解度を記録します。
          音声は、間違えた問題を読み上げます（他の画面へ移っても再生は続きます）。
        </p>

        <hr className="sep" />
        <div className="section-label" style={{ marginTop: 0 }}>
          復習リストの問題
        </div>
        {reviewQuestions.map((q) => {
          const st = normalize(srs[q.id]);
          const streak = st.correctStreak || 0;
          const due = st.due || 0;
          const now = Date.now();
          const ms = due - now;
          const HOUR = 60 * 60 * 1000;
          const dueLabel = ms <= 0
            ? '今すぐ復習'
            : ms < HOUR
            ? `次回 約${Math.max(1, Math.round(ms / (60 * 1000)))}分後`
            : ms < 24 * HOUR
            ? `次回 約${Math.round(ms / HOUR)}時間後`
            : `次回 約${Math.round(ms / (24 * HOUR))}日後`;
          return (
            <div className="list-item" key={q.id}>
              <div className="li-subject">{q.subject}</div>
              <div className="li-q">{q.question || '（図の問題）'}</div>
              <div className="li-stat">
                完璧 {streak}/{MASTER_STREAK} ・ 誤答 {st.wrongCount || 0}回 ・ {dueLabel}
              </div>
              <div className="streak-dots" aria-label={`完璧 ${streak}/${MASTER_STREAK}`}>
                {Array.from({ length: MASTER_STREAK }).map((_, i) => (
                  <i key={i} className={i < streak ? 'on' : ''} />
                ))}
              </div>
              {memos[q.id] && <div className="li-memo">📝 {memos[q.id]}</div>}
            </div>
          );
        })}
      </div>
    );
  }

  // ---- 終了 ----
  if (idx >= order.length) {
    const rate =
      sessionStats.total > 0
        ? Math.round((sessionStats.correct / sessionStats.total) * 100)
        : 0;
    return (
      <div className="view">
        <h2 className="view-title">復習完了</h2>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="num" style={{ fontSize: 32, color: 'var(--navy)', fontWeight: 800 }}>
            {rate}%
          </div>
          <p className="view-desc">
            {sessionStats.total}問中 {sessionStats.correct}問 正解
          </p>
          <p className="inline-note">
            ○（完璧）は忘却曲線に沿って次回が先へ延び、5回連続でマスター。△・✕は約20分後から再スタートします。
          </p>
          <button
            className="btn primary block lg"
            style={{ marginTop: 12 }}
            onClick={() => setStarted(false)}
          >
            復習リストに戻る
          </button>
        </div>
      </div>
    );
  }

  // ---- 出題中 ----
  const current = order[idx];
  return (
    <div className="view">
      <div className="exam-timer">
        <span className="count">🔁 復習モード</span>
        <span className="count">
          {idx + 1} / {order.length}
        </span>
      </div>
      <div className="progress">
        <span style={{ width: `${((idx + 1) / order.length) * 100}%` }} />
      </div>

      <QuestionCard
        key={current.id}
        question={current}
        memo={memos[current.id]}
        onSetMemo={setMemo}
        link={links[current.id]}
        onSetLink={setLink}
        onOpenKeyword={onOpenKeyword}
        onAnswered={handleAnswered}
        onNext={handleNext}
        selfGrade
        GRADES={GRADES}
        isLast={idx + 1 >= order.length}
      />
    </div>
  );
}
