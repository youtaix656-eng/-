import { useState } from 'react';
import QuestionCard from './QuestionCard.jsx';
import { normalize, MATURE_INTERVAL } from '../lib/srs.js';

// 間違えた問題だけを解くモード（間隔反復 / SM-2）
export default function Review({ store, onOpenKeyword }) {
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
          誤答した問題を、間隔反復（スペースドリピティション）で効率よく復習します。
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
              {reviewQuestions.filter((q) => normalize(srs[q.id]).interval >= 7).length}
            </div>
            <div className="lbl">定着間近</div>
          </div>
        </div>

        <button className="btn primary block lg" onClick={start} disabled={dueCount === 0}>
          {dueCount > 0 ? `復習を始める（${dueCount}問）` : '今日の復習は完了しました'}
        </button>

        <hr className="sep" />
        <div className="section-label" style={{ marginTop: 0 }}>
          復習リストの問題
        </div>
        {reviewQuestions.map((q) => {
          const st = normalize(srs[q.id]);
          const pct = Math.min(100, Math.round((st.interval / MATURE_INTERVAL) * 100));
          return (
            <div className="list-item" key={q.id}>
              <div className="li-subject">{q.subject}</div>
              <div className="li-q">{q.question || '（図の問題）'}</div>
              <div className="li-stat">
                誤答 {st.wrongCount || 0}回 ・ 定着度 {pct}%
                {st.interval > 0 && ` ・ 次回間隔 約${st.interval}日`}
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
            正解した問題は次回の出題間隔が延び、間違えた問題は再び近いうちに出題されます。
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
        gradeMode
        GRADES={GRADES}
        isLast={idx + 1 >= order.length}
      />
    </div>
  );
}
