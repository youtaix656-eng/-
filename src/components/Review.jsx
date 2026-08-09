import { useEffect, useMemo, useRef, useState } from 'react';
import QuestionCard from './QuestionCard.jsx';
import ResetInline from './ResetInline.jsx';
import { normalize, MASTER_STREAK } from '../lib/srs.js';
import * as storage from '../lib/storage.js';
import { effectiveTags } from '../lib/query.js';
import { weakTagClusters } from '../lib/weakClusters.js';
import { relatedQuestions } from '../lib/related.js';
import { filterReview, sortReview, riskOf } from '../lib/reviewOrder.js';
import { studyStreak } from '../lib/stats.js';
import { comparisonsForKeyword } from '../data/mindmapData.js';
import { loadMissTypes, recordMissType, missTypeLabel } from '../lib/missTypes.js';

// 出題順（#1 忘れそう順・#5 難問順）と一覧の並べ替え（#8）の選択肢
const ORDER_MODES = [
  { id: 'due', label: '期限が近い順' },
  { id: 'forget', label: '忘れそうな順' },
  { id: 'hard', label: '難問（誤答率）順' },
  { id: 'wrong', label: '誤答が多い順' },
  { id: 'subject', label: '科目順' },
];

// 1回の問題数（学習と同じ 10・60・300・900、および すべて）
const REVIEW_TARGETS = [
  { n: 10, label: '10問' },
  { n: 60, label: '60問' },
  { n: 300, label: '300問' },
  { n: 900, label: '900問' },
  { n: 0, label: 'すべて' },
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
  const missRef = useRef([]); // この回で ○ にならなかった（不正解・△・✕）問題

  // 出題・一覧の制御（#1/#4/#5/#8）
  const [orderMode, setOrderMode] = useState('forget'); // 既定＝忘れそうな順
  const [filterTag, setFilterTag] = useState('');
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('all'); // 科目ごとの検索
  const [batch, setBatch] = useState(60); // 1回の問題数（0=すべて）
  const [showAll, setShowAll] = useState(false); // リストの折りたたみ（#4）
  const [fast, setFast] = useState(false); // 高速回転モード（#6）
  const [missTypes, setMissTypes] = useState({}); // 間違いの型（#9）

  useEffect(() => { loadMissTypes().then(setMissTypes); }, []);
  const onMissType = (id, type) => recordMissType(id, type).then(setMissTypes);

  // 復習リストにある科目の一覧
  const subjects = useMemo(
    () => Array.from(new Set(reviewQuestions.map((q) => q.subject).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja')),
    [reviewQuestions]
  );

  // 弱点テーマ（誤答が多いタグ）＝ #4
  const weakTags = useMemo(
    () => weakTagClusters(history, reviewQuestions, links, { minWrong: 1, limit: 10 }),
    [history, reviewQuestions, links]
  );

  const filterOpts = { subject: subject === 'all' ? '' : subject, tag: filterTag, term: search, links };

  // 絞り込み＋並べ替え後のリスト（#8）
  const shownList = useMemo(() => {
    const filtered = filterReview(reviewQuestions, filterOpts);
    return sortReview(filtered, orderMode, { srs, history, links });
  }, [reviewQuestions, subject, filterTag, search, orderMode, srs, history, links]);

  // 出題プール：絞り込みがあれば全リストから、無ければ「今日の復習」から。並びは orderMode。
  const filtering = subject !== 'all' || !!filterTag || !!search.trim();
  const startPool = useMemo(() => {
    const base = filtering ? filterReview(reviewQuestions, filterOpts) : dueReviewQuestions;
    return sortReview(base, orderMode, { srs, history, links });
  }, [filtering, subject, filterTag, search, reviewQuestions, dueReviewQuestions, orderMode, srs, history, links]);

  // 実際に出題される問数（バッチ上限と在庫の小さい方）
  const effectiveCount = batch > 0 ? Math.min(batch, startPool.length) : startPool.length;

  // pool を出題開始（続けるループ用に任意の配列でも開始できる）
  const startWith = (pool) => {
    if (!pool || pool.length === 0) return;
    missRef.current = [];
    setOrder(pool);
    setIdx(0);
    setSessionStats({ total: 0, correct: 0 });
    setStarted(true);
  };

  const start = () => {
    const pool = batch > 0 ? startPool.slice(0, batch) : startPool;
    startWith(pool);
  };

  // 弱点テーマをワンタップで即復習（#5）：フィルタ状態に依存せずその場でプールを作る
  const quickStartTag = (tag) => {
    const pool = sortReview(filterReview(reviewQuestions, { tag, links }), orderMode, { srs, history, links });
    startWith(batch > 0 ? pool.slice(0, batch) : pool);
  };

  // 今日の到達・連続日数（改善2）：復習由来の解答だけを数える
  const { streak } = useMemo(() => studyStreak(history), [history]);
  const todayReviewDone = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const start0 = d.getTime();
    return history.filter((h) => h.source === 'review' && h.at >= start0).length;
  }, [history]);
  // 日次目標＝今日こなした復習＋まだ期限が来ている数（今日中に片づけたい総量）
  const dailyGoal = Math.max(1, todayReviewDone + dueReviewQuestions.length);
  const goalPct = Math.min(100, Math.round((todayReviewDone / dailyGoal) * 100));

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
    const q = order[idx];
    recordAnswer(q, correct, grade, 'review'); // 復習由来として記録（到達集計用）
    // ○（完璧）以外＝不正解・△・✕ は「まだ定着していない」として記憶
    if (!correct && q) missRef.current.push(q);
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

        {/* ===== 今日の到達リング＋連続日数（改善2・5） ===== */}
        <div className="review-goal">
          <div className="goal-ring" style={{ '--pct': goalPct }}>
            <div className="goal-ring-in">{goalPct}%</div>
          </div>
          <div className="goal-text">
            <div className="goal-line">今日の復習 <strong>{todayReviewDone}</strong> / {dailyGoal} 問</div>
            <div className="goal-sub">
              🔥 連続 <strong>{streak}</strong> 日
              {todayReviewDone === 0 && streak > 0 && <span className="goal-nudge">　今日やれば {streak + 1} 日目！</span>}
              {goalPct >= 100 && <span className="goal-done">　🎉 今日の目標達成！</span>}
            </div>
          </div>
        </div>

        {/* ===== 弱点テーマで狙い撃ち（#4 絞り込み・#5 即復習・#1 誤答数と色） ===== */}
        {weakTags.length > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 0 }}>
              弱点テーマで狙い撃ち<span className="section-hint">（数字＝誤答数。▶で即復習）</span>
            </div>
            <div className="chip-row">
              <button className={`chip ${filterTag === '' ? 'active' : ''}`} onClick={() => setFilterTag('')}>すべて</button>
              {weakTags.map((w) => {
                const lvl = w.rate >= 0.6 ? 'hot' : w.rate >= 0.3 ? 'warm' : 'mild';
                return (
                  <span key={w.tag} className={`weak-chip ${filterTag === w.tag ? 'active' : ''} lv-${lvl}`}>
                    <button
                      className="weak-chip-label"
                      onClick={() => setFilterTag(filterTag === w.tag ? '' : w.tag)}
                      title={`誤答${w.wrong}／${w.attempts}（誤答率${Math.round(w.rate * 100)}%）`}
                    >
                      <i className="weak-dot" />{w.tag} <b>誤答{w.wrong}</b>
                    </button>
                    <button className="weak-chip-go" onClick={() => quickStartTag(w.tag)} aria-label={`${w.tag}を即復習`}>▶</button>
                  </span>
                );
              })}
            </div>
          </>
        )}

        {/* ===== 検索（科目・キーワード）＋並べ替え・出題順 ===== */}
        <div className="review-controls">
          <label className="review-order">
            <span>科目</span>
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="all">すべての科目</option>
              {subjects.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </label>
          <input
            type="text"
            className="review-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔎 キーワード検索（語・タグ）"
          />
          <label className="review-order">
            <span>出題・並び順</span>
            <select value={orderMode} onChange={(e) => setOrderMode(e.target.value)}>
              {ORDER_MODES.map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
            </select>
          </label>
        </div>
        <div className="review-count">
          この条件で <strong>{startPool.length}</strong> 問
          {filtering && <button className="btn ghost sm" onClick={() => { setSubject('all'); setFilterTag(''); setSearch(''); }}>クリア</button>}
        </div>

        {/* ===== 1回の問題数（10・60・300・900・すべて） ===== */}
        <div className="section-label" style={{ marginTop: 4 }}>1回の問題数</div>
        <div className="chip-row">
          {REVIEW_TARGETS.map((t) => (
            <button
              key={t.n}
              className={`chip ${batch === t.n ? 'active' : ''}`}
              onClick={() => setBatch(t.n)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="autokw-row" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} />
          <span>⚡ 高速回転モード（問題→3秒で答え表示→自己採点。まず自力で思い出す）</span>
        </label>

        <button className="btn primary block lg" style={{ marginTop: 6 }} onClick={start} disabled={startPool.length === 0}>
          {startPool.length > 0
            ? `📝 一問一答で復習（${effectiveCount}問・${ORDER_MODES.find((m) => m.id === orderMode)?.label}）`
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
        {(showAll ? shownList : shownList.slice(0, 10)).map((q) => {
          const st = normalize(srs[q.id]);
          const cs = st.correctStreak || 0;
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
          // 忘却リスク（#2）：高いほど赤
          const risk = Math.round(riskOf(q, srs, now) * 100);
          const rlvl = risk >= 70 ? 'hot' : risk >= 40 ? 'warm' : 'mild';
          return (
            <div className="list-item" key={q.id}>
              <div className="li-top">
                <span className="li-subject">{q.subject}</span>
                <span className={`risk-badge lv-${rlvl}`} title="忘却リスク（高いほど早く復習を）">忘却{risk}%</span>
              </div>
              <div className="li-q">{q.question || '（図の問題）'}</div>
              <div className="li-stat">
                完璧 {cs}/{MASTER_STREAK} ・ 誤答 {st.wrongCount || 0}回 ・ {dueLabel}
                {missTypes[q.id] && <span className="misstype-tag">型: {missTypeLabel(missTypes[q.id].type)}</span>}
              </div>
              <div className="streak-dots" aria-label={`完璧 ${cs}/${MASTER_STREAK}`}>
                {Array.from({ length: MASTER_STREAK }).map((_, i) => (
                  <i key={i} className={i < cs ? 'on' : ''} />
                ))}
              </div>
              {memos[q.id] && <div className="li-memo">📝 {memos[q.id]}</div>}
              <RelatedPanel q={q} questions={questions} links={links} />
            </div>
          );
        })}
        {shownList.length > 10 && (
          <button className="btn ghost block" onClick={() => setShowAll((v) => !v)}>
            {showAll ? '▲ 折りたたむ' : `▼ もっと見る（残り${shownList.length - 10}件）`}
          </button>
        )}
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
    // この回で ○ にならなかった（不正解・△・✕）問題（重複除去）
    const misses = [];
    const seen = new Set();
    for (const q of missRef.current) if (!seen.has(q.id)) { seen.add(q.id); misses.push(q); }
    const backToList = () => { missRef.current = []; setStarted(false); };
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
          {misses.length > 0 ? (
            <>
              <p className="inline-note" style={{ marginBottom: 12 }}>
                まだ定着していない（不正解・△・✕）問題が <strong style={{ color: 'var(--wrong)' }}>{misses.length}問</strong> あります。続けますか？
              </p>
              <div className="btn-row">
                <button className="btn primary" onClick={() => startWith(misses)}>
                  はい、続ける（{misses.length}問）
                </button>
                <button className="btn" onClick={backToList}>いいえ、中断する</button>
              </div>
            </>
          ) : (
            <>
              <p className="inline-note">
                この回はすべて ○（完璧）でした。○は忘却曲線に沿って次回が先へ延び、5回連続でマスターです。
              </p>
              <button className="btn primary block lg" style={{ marginTop: 12 }} onClick={backToList}>
                復習リストに戻る
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---- 出題中 ----
  const current = order[idx];
  // まぎらわしい対比（#8）：この問題のタグに紐づく対比を集める
  const curTags = effectiveTags(current, links);
  const curComparisons = [];
  const seenCmp = new Set();
  for (const t of curTags) {
    for (const c of comparisonsForKeyword(t)) if (!seenCmp.has(c.id)) { seenCmp.add(c.id); curComparisons.push(c); }
  }
  // なぜ今この問題か（#10）
  const curRisk = Math.round(riskOf(current, srs) * 100);
  const curSt = normalize(srs[current.id]);
  const overdue = (curSt.due || 0) <= Date.now();
  const curReason = overdue
    ? `期限が来た復習です（忘却リスク ${curRisk}%）。まず自力で思い出してみましょう。`
    : `忘却リスク ${curRisk}% で選ばれました。まず自力で思い出してみましょう。`;
  return (
    <div className="view">
      <div className="exam-timer">
        <span className="count">🔁 復習モード{fast ? ' ⚡' : ''}</span>
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
        comparisons={curComparisons}
        reason={curReason}
        fast={fast}
        onMissType={onMissType}
      />
      <ResetInline label="復習をリセット" onReset={resetReview} />
    </div>
  );
}
