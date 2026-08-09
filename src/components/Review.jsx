import { useEffect, useMemo, useState } from 'react';
import QuestionCard from './QuestionCard.jsx';
import ResetInline from './ResetInline.jsx';
import { normalize, MASTER_STREAK } from '../lib/srs.js';
import * as storage from '../lib/storage.js';
import { effectiveTags } from '../lib/query.js';
import { weakTagClusters } from '../lib/weakClusters.js';
import { relatedQuestions } from '../lib/related.js';
import { filterReview, sortReview } from '../lib/reviewOrder.js';

// 出題順（#1 忘れそう順・#5 難問順）と一覧の並べ替え（#8）の選択肢
const ORDER_MODES = [
  { id: 'due', label: '期限が近い順' },
  { id: 'forget', label: '忘れそうな順' },
  { id: 'hard', label: '難問（誤答率）順' },
  { id: 'wrong', label: '誤答が多い順' },
  { id: 'subject', label: '科目順' },
];

// 復習リスト項目に「関連問題・用語」をその場表示（#10）
function RelatedPanel({ q, questions, links }) {
  const [open, setOpen] = useState(false);
  const related = useMemo(
    () => (open ? relatedQuestions(q, questions, links, { limit: 4 }) : []),
    [open, q, questions, links]
  );
  const term = effectiveTags(q, links)[0] || '';
  const def = useMemo(() => {
    if (!open || !term) return '';
    const src = questions.find((x) => x.id !== q.id && (x.explanation || '').includes(term) && effectiveTags(x, links).includes(term));
    const s = (src?.explanation || q.explanation || '').trim();
    const m = s.match(/^[^。]*。/);
    return m ? m[0] : s.slice(0, 60);
  }, [open, term, q, questions, links]);

  return (
    <div className="li-related">
      <button className="li-related-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? '▼ 関連・用語を隠す' : '🔗 関連問題・用語を見る'}
      </button>
      {open && (
        <div className="li-related-body">
          {term && def && (
            <div className="li-def"><b>{term}</b>：{def}</div>
          )}
          {related.length > 0 ? (
            <ul className="li-related-list">
              {related.map((r) => (
                <li key={r.id}>
                  <span className="li-related-subj">{r.question.subject}</span>
                  {String(r.question.question || '（図の問題）').slice(0, 30)}
                  <span className="li-related-shared">共通{r.shared}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="inline-note">関連する問題は見つかりませんでした。</div>
          )}
        </div>
      )}
    </div>
  );
}

// 間違えた問題だけを解くモード（エビングハウスの忘却曲線・5回連続の完璧でマスター）
export default function Review({ store, onOpenKeyword, onGoAudio }) {
  const {
    questions, dueReviewQuestions, reviewQuestions, history,
    memos, links, recordAnswer, setMemo, setLink, srs, GRADES,
  } = store;

  const [started, setStarted] = useState(false);
  const [order, setOrder] = useState([]);
  const [idx, setIdx] = useState(0);
  const [sessionStats, setSessionStats] = useState({ total: 0, correct: 0 });
  const [resume, setResume] = useState(null); // 前回の途中経過（続きから）

  // 出題・一覧の制御（#1/#4/#5/#8）
  const [orderMode, setOrderMode] = useState('forget'); // 既定＝忘れそうな順
  const [filterTag, setFilterTag] = useState('');
  const [search, setSearch] = useState('');

  // 弱点テーマ（誤答が多いタグ）＝ #4
  const weakTags = useMemo(
    () => weakTagClusters(history, reviewQuestions, links, { minWrong: 1, limit: 10 }),
    [history, reviewQuestions, links]
  );

  // 絞り込み＋並べ替え後のリスト（#8）
  const shownList = useMemo(() => {
    const filtered = filterReview(reviewQuestions, { tag: filterTag, term: search, links });
    return sortReview(filtered, orderMode, { srs, history, links });
  }, [reviewQuestions, filterTag, search, orderMode, srs, history, links]);

  // 出題プール：絞り込みがあれば全リストから、無ければ「今日の復習」から。並びは orderMode。
  const startPool = useMemo(() => {
    const base = filterTag || search.trim()
      ? filterReview(reviewQuestions, { tag: filterTag, term: search, links })
      : dueReviewQuestions;
    return sortReview(base, orderMode, { srs, history, links });
  }, [filterTag, search, reviewQuestions, dueReviewQuestions, orderMode, srs, history, links]);

  const start = () => {
    if (startPool.length === 0) return;
    setOrder(startPool);
    setIdx(0);
    setSessionStats({ total: 0, correct: 0 });
    setStarted(true);
  };

  // 保存済みの途中経過を読み込む（続きから）
  useEffect(() => {
    if (started || !questions || !questions.length) return;
    let alive = true;
    storage.loadReviewProgress().then((p) => {
      if (!alive || !p || !Array.isArray(p.ids) || !p.ids.length) return;
      const byId = new Map(questions.map((q) => [q.id, q]));
      const rebuilt = p.ids.map((id) => byId.get(id)).filter(Boolean);
      if (rebuilt.length === 0 || (p.idx || 0) >= rebuilt.length) return;
      setResume({ order: rebuilt, idx: Math.min(p.idx || 0, rebuilt.length - 1), stats: p.stats || { total: 0, correct: 0 } });
    });
    return () => { alive = false; };
  }, [questions, started]);

  // 1問ごとに途中経過を保存（終了したら消す）
  useEffect(() => {
    if (!started) return;
    if (idx >= order.length) { storage.clearReviewProgress(); return; }
    storage.saveReviewProgress({ ids: order.map((q) => q.id), idx, stats: sessionStats, at: Date.now() });
  }, [started, idx, order, sessionStats]);

  const doResume = () => {
    if (!resume) return;
    setOrder(resume.order);
    setIdx(resume.idx);
    setSessionStats(resume.stats);
    setStarted(true);
    setResume(null);
  };

  // 復習をリセット（途中経過を破棄してリストへ戻す）
  const resetReview = () => {
    storage.clearReviewProgress();
    setStarted(false);
    setOrder([]);
    setIdx(0);
    setResume(null);
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
    const filtering = !!(filterTag || search.trim());
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
            <div className="num" style={{ color: dueCount > 0 ? 'var(--wrong)' : 'var(--text)' }}>
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

        {resume && (
          <button className="btn primary block lg" style={{ marginBottom: 10 }} onClick={doResume}>
            ▶ 前回の続きから（{resume.idx + 1}/{resume.order.length}問）
          </button>
        )}

        {/* ===== 弱点テーマで狙い撃ち（#4） ===== */}
        {weakTags.length > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 0 }}>弱点テーマで狙い撃ち</div>
            <div className="chip-row">
              <button className={`chip ${filterTag === '' ? 'active' : ''}`} onClick={() => setFilterTag('')}>すべて</button>
              {weakTags.map((w) => (
                <button
                  key={w.tag}
                  className={`chip ${filterTag === w.tag ? 'active' : ''}`}
                  onClick={() => setFilterTag(filterTag === w.tag ? '' : w.tag)}
                >
                  {w.tag} <b>{w.wrong}</b>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ===== 検索・並べ替え（#8） ＋ 出題順（#1/#5） ===== */}
        <div className="review-controls">
          <input
            type="text"
            className="review-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔎 復習リストを検索（語・科目・タグ）"
          />
          <label className="review-order">
            <span>出題・並び順</span>
            <select value={orderMode} onChange={(e) => setOrderMode(e.target.value)}>
              {ORDER_MODES.map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
            </select>
          </label>
        </div>

        <div className="section-label" style={{ marginTop: 4 }}>復習のしかたを選ぶ</div>
        <button className="btn primary block lg" onClick={start} disabled={startPool.length === 0}>
          {startPool.length > 0
            ? `📝 一問一答で復習（${startPool.length}問${filtering ? '・絞り込み中' : ''}・${ORDER_MODES.find((m) => m.id === orderMode)?.label}）`
            : (filtering ? '条件に合う問題がありません' : '今日の復習は完了しました')}
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
          「忘れそうな順」は保持率の推定、「難問順」はあなたの誤答率で並べます。弱点テーマや検索で絞ると、その範囲だけを狙い撃ちできます。
        </p>

        <hr className="sep" />
        <div className="section-label" style={{ marginTop: 0 }}>
          復習リストの問題（{shownList.length}）
        </div>
        {shownList.map((q) => {
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
              <RelatedPanel q={q} questions={questions} links={links} />
            </div>
          );
        })}
        {shownList.length === 0 && (
          <p className="inline-note">条件に合う問題がありません。検索語や弱点テーマの選択を変えてください。</p>
        )}
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
          <div className="num" style={{ fontSize: 32, color: 'var(--text)', fontWeight: 800 }}>
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
      <ResetInline label="復習をリセット" onReset={resetReview} />
    </div>
  );
}
