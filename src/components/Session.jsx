import { useEffect, useMemo, useState } from 'react';
import QuestionCard from './QuestionCard.jsx';
import { GRADES, isInReview, isDue } from '../lib/srs.js';
import { getSubjects } from '../lib/stats.js';
import { subjectMatches, SUBJECT_TAG_NAMES } from '../data/examScope.js';
import { buildKanaIndex } from '../lib/yomi.js';
import { effectiveTags } from '../lib/query.js';
import { COMPARISONS } from '../data/mindmapData.js';

const uniqJa = (arr) => Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja'));

// 学習セッション（60/300/900）
//   60問＝1セット（休憩の区切り） / 300問＝1日の基本目標 / 900問＝1周
//   1問ごとに位置を自動保存し、アプリを閉じても「続きから」再開できる。
const SET_SIZE = 60;
const TARGETS = [10, 60, 300, 900];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// 原問と派生（同じ過去問由来）を離す（#2）。id末尾の枝記号を除いた基幹idでバケット分割し、
// ラウンドロビンで並べて同一由来が隣り合わないようにする。
const baseId = (id) => String(id).replace(/[a-z]+$/i, '');
function spaceById(ids) {
  if (ids.length < 3) return ids;
  const buckets = new Map();
  for (const id of ids) { const b = baseId(id); if (!buckets.has(b)) buckets.set(b, []); buckets.get(b).push(id); }
  if (buckets.size < 2) return ids;
  const lists = shuffle([...buckets.values()]);
  const out = [];
  let more = true;
  while (more) {
    more = false;
    for (const l of lists) { if (l.length) { out.push(l.shift()); more = true; } }
  }
  return out;
}
function poolFor(questions, subject) {
  if (subject === 'all') return questions;
  const exact = questions.filter((q) => q.subject === subject);
  if (exact.length) return exact;
  return questions.filter((q) => subjectMatches(q.subject, { name: subject }));
}
// pool を繰り返して target 長の出題順（id 配列）を作る
function buildOrder(pool, target) {
  if (pool.length === 0) return [];
  let ids = [];
  while (ids.length < target) ids = ids.concat(shuffle(pool).map((q) => q.id));
  return spaceById(ids.slice(0, target));
}
// 「すべて新規」用：未着手（未解答）の問題だけを出題順にする。
//   過去に解いた問題は混ぜず、繰り返しもしない（残り新規が尽きたらそこで終了）。
function buildNewOnlyOrder(pool, target, srs) {
  const newPool = pool.filter((q) => !srs[q.id] || (srs[q.id].seen || 0) === 0);
  return spaceById(shuffle(newPool).map((q) => q.id).slice(0, target));
}
// 復習対象プール：復習期限が来ている問題を優先し、無ければ復習対象全体にフォールバック。
//   lib/useStore.js の dueReviewQuestions と同じ優先順位に揃える（画面間の食い違いを防ぐ）。
function reviewPoolFor(pool, srs) {
  const inReview = pool.filter((q) => isInReview(srs[q.id]));
  const due = inReview.filter((q) => isDue(srs[q.id]));
  return due.length > 0 ? due : inReview;
}
// 「すべて復習」用：復習対象プールだけを出題順にする（繰り返さない・足りなければそこで終了）。
function buildReviewOnlyOrder(pool, target, srs) {
  const reviewPool = reviewPoolFor(pool, srs);
  return spaceById(shuffle(reviewPool).map((q) => q.id).slice(0, target));
}
// 指定プールを「新規◯割・復習◯割」で混ぜて target 長の出題順を作る（周回あり＝繰り返して埋める）。
// newRatio: 0〜1（1=すべて新規）。新規＝未着手、復習＝復習対象。
function buildMixedOrder(pool, target, newRatio, srs) {
  if (pool.length === 0) return [];
  const newPool = pool.filter((q) => !srs[q.id] || (srs[q.id].seen || 0) === 0);
  const reviewPool = reviewPoolFor(pool, srs);
  // どちらかが空なら、その分をもう一方（無ければ全体）で補う
  const fill = (base, count) => {
    if (count <= 0) return [];
    const src = base.length ? base : pool;
    let ids = [];
    while (ids.length < count) ids = ids.concat(shuffle(src).map((q) => q.id));
    return ids.slice(0, count);
  };
  const newCount = Math.round(target * Math.min(1, Math.max(0, newRatio)));
  const reviewCount = target - newCount;
  const combined = [...fill(newPool, newCount), ...fill(reviewPool, reviewCount)];
  return spaceById(shuffle(combined).slice(0, target));
}
// 指定プールを「新規◯割・復習◯割」で混ぜる（周回なし＝繰り返さず、該当分だけで終わる）。
function buildMixedNoRepeatOrder(pool, target, newRatio, srs) {
  if (pool.length === 0) return [];
  const newPool = pool.filter((q) => !srs[q.id] || (srs[q.id].seen || 0) === 0);
  const reviewPool = reviewPoolFor(pool, srs);
  const newCount = Math.round(target * Math.min(1, Math.max(0, newRatio)));
  const reviewCount = target - newCount;
  const takeNew = shuffle(newPool).map((q) => q.id).slice(0, newCount);
  const takeReview = shuffle(reviewPool).map((q) => q.id).slice(0, reviewCount);
  return spaceById(shuffle([...takeNew, ...takeReview]));
}

// 誤答・あいまい（△✕）の問題群から、弱点を文章と関連対比で示す材料を作る。
//   実際に出た誤答のジャンル・キーワードの頻度だけを根拠にする（憶測での説明は行わない）。
function buildWeaknessSummary(wrongQs, links) {
  if (wrongQs.length === 0) return null;
  const tagCount = {};
  for (const q of wrongQs) {
    for (const tg of effectiveTags(q, links)) tagCount[tg] = (tagCount[tg] || 0) + 1;
  }
  const topTags = Object.entries(tagCount)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const genreCount = {};
  for (const q of wrongQs) {
    const g = q.genre || q.subject || 'その他';
    genreCount[g] = (genreCount[g] || 0) + 1;
  }
  const topGenres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const tagSet = new Set(Object.keys(tagCount));
  const relatedComparisons = COMPARISONS.filter((c) => (c.terms || []).some((t) => tagSet.has(t))).slice(0, 3);
  return { topTags, topGenres, relatedComparisons };
}

export default function Session({ store, onToast, onOpenKeyword, onGoReview }) {
  const { questions, srs, history, session, startSession, updateSession, clearSession, memos, setMemo, links, setLink, recordAnswer, settings, updateSettings, bookmarks, toggleBookmark } = store;
  // 出題基準の科目順（1〜14）で並べる。基準にない科目名（表記ゆれ等）は末尾に追加。
  const subjects = useMemo(() => {
    const present = getSubjects(questions);
    const ordered = SUBJECT_TAG_NAMES.filter((s) => present.includes(s));
    const extra = present.filter((s) => !SUBJECT_TAG_NAMES.includes(s));
    return [...ordered, ...extra];
  }, [questions]);
  const byId = useMemo(() => Object.fromEntries(questions.map((q) => [q.id, q])), [questions]);

  const [subject, setSubject] = useState('all');
  const [genre, setGenre] = useState('');
  const [keyword, setKeyword] = useState('');
  const [round, setRound] = useState(''); // 回（第XX回）でしぼる（#5）
  const [bookmarkOnly, setBookmarkOnly] = useState(false); // ブックマークのみ
  const [term, setTerm] = useState('');
  const [fast, setFast] = useState(false);
  const [showBreak, setShowBreak] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  // 新規◯割・復習◯割（0〜100の新規%）。既定は設定値。
  const [newPct, setNewPct] = useState(Math.round((settings.sessionNewRatio ?? 1) * 100));

  // 検索（科目→ジャンル→キーワード の段階しぼり＋フリーワード）
  const afterSubject = useMemo(() => (subject === 'all' ? questions : poolFor(questions, subject)), [questions, subject]);
  const genreOptions = useMemo(() => uniqJa(afterSubject.flatMap((q) => (q.genre ? [q.genre] : []))), [afterSubject]);
  const afterGenre = useMemo(() => (genre ? afterSubject.filter((q) => q.genre === genre) : afterSubject), [afterSubject, genre]);
  const kwOptions = useMemo(() => uniqJa(afterGenre.flatMap((q) => effectiveTags(q, links))), [afterGenre, links]);
  const kwSections = useMemo(() => buildKanaIndex(kwOptions), [kwOptions]);
  const afterKw = useMemo(() => (keyword ? afterGenre.filter((q) => effectiveTags(q, links).includes(keyword)) : afterGenre), [afterGenre, keyword, links]);
  // 回（第XX回）の選択肢（#5）
  const roundOptions = useMemo(
    () => Array.from(new Set(afterKw.map((q) => q.round).filter((r) => r != null))).sort((a, b) => b - a),
    [afterKw]
  );
  const afterRound = useMemo(() => (round ? afterKw.filter((q) => String(q.round) === String(round)) : afterKw), [afterKw, round]);
  const filteredPool = useMemo(() => {
    let pool = afterRound;
    if (bookmarkOnly) pool = pool.filter((q) => bookmarks[q.id]);
    const t = term.trim().toLowerCase();
    if (!t) return pool;
    return pool.filter((q) => {
      const hay = [q.question, q.subject, q.round, ...(q.choices || []), q.explanation, ...effectiveTags(q, links)].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(t);
    });
  }, [afterRound, bookmarkOnly, bookmarks, term, links]);

  // 弱点タグ（#8）：直近の誤答が多いタグを上位に。タップでキーワードしぼり。
  const weakTags = useMemo(() => {
    const wrong = {}, total = {};
    for (const h of history) {
      const q = byId[h.questionId];
      if (!q) continue;
      for (const tg of effectiveTags(q, links)) {
        total[tg] = (total[tg] || 0) + 1;
        if (!h.correct) wrong[tg] = (wrong[tg] || 0) + 1;
      }
    }
    return Object.keys(wrong)
      .filter((tg) => wrong[tg] >= 2)
      .map((tg) => ({ tag: tg, wrong: wrong[tg], rate: wrong[tg] / total[tg] }))
      .sort((a, b) => b.wrong - a.wrong || b.rate - a.rate)
      .slice(0, 8);
  }, [history, byId, links]);

  // 現在の条件で「まだ解いていない新規問題」が何問残っているか
  //   新規＝未着手（srs.seen が 0 または未登録）。buildMixedOrder の newPool と同じ定義。
  const newRemaining = useMemo(
    () => filteredPool.filter((q) => !srs[q.id] || (srs[q.id].seen || 0) === 0).length,
    [filteredPool, srs]
  );
  // 現在の条件で「復習対象」が何問あるか（reviewPoolFor と同じ定義＝期限優先・無ければ全体）
  const reviewRemaining = useMemo(
    () => reviewPoolFor(filteredPool, srs).length,
    [filteredPool, srs]
  );

  // 上位を変えたら下位をリセット
  useEffect(() => { setGenre(''); setKeyword(''); setRound(''); }, [subject]);
  useEffect(() => { setKeyword(''); }, [genre]);

  const begin = (target, opts = {}) => {
    const pool = opts.pool || filteredPool;
    const subj = opts.subject != null ? opts.subject : subject;
    const round = opts.round || 1;
    const useFast = opts.fast != null ? opts.fast : fast;
    const ratio = opts.newRatio != null ? opts.newRatio : newPct / 100;
    if (pool.length === 0) {
      onToast?.('条件に合う問題がありません');
      return;
    }
    // 初回（opts.allowSeen が無い）は繰り返さず、該当する問題数だけで1セッションとする。
    // 2周目・もう一度（opts.allowSeen）のときは従来通り全体を周回して指定問数まで埋める。
    let ids;
    if (!opts.allowSeen) {
      if (ratio >= 1) {
        ids = buildNewOnlyOrder(pool, target, srs);
        if (ids.length === 0) {
          onToast?.('新規問題がありません（この条件はすべて解き終えています）。割合を下げて復習するか、条件を変えてください');
          return;
        }
      } else if (ratio <= 0) {
        ids = buildReviewOnlyOrder(pool, target, srs);
        if (ids.length === 0) {
          onToast?.('復習が必要な問題がありません（まだ間違えた問題がないか、復習対象がありません）。割合を上げて新規を混ぜるか、条件を変えてください');
          return;
        }
      } else {
        ids = buildMixedNoRepeatOrder(pool, target, ratio, srs);
        if (ids.length === 0) {
          onToast?.('この割合・条件に合う新規・復習問題がありません。割合や条件を変えてください');
          return;
        }
      }
    } else if (ratio >= 1) {
      ids = buildOrder(pool, target);
    } else {
      ids = buildMixedOrder(pool, target, ratio, srs);
    }
    // 該当数が指定問数に満たない場合は、その問数だけで1セッションとする
    const effTarget = Math.min(target, ids.length);
    updateSettings({ sessionNewRatio: ratio });
    startSession({ subject: subj, label: opts.label, ids, pos: 0, target: effTarget, requestedTarget: target, round, fast: useFast, newRatio: ratio, startedAt: Date.now() });
    setShowBreak(false);
  };

  // 学習のリセット（進行中の学習セッションを破棄して開始画面へ戻す）
  const doReset = () => {
    clearSession();
    setShowBreak(false);
    setConfirmReset(false);
    onToast?.('学習をリセットしました');
  };

  const answered = (correct, grade) => {
    const cur = byId[session.ids[session.pos]];
    if (cur) recordAnswer(cur, correct, grade);
    const newPos = session.pos + 1;
    updateSession({ pos: newPos });
    if (newPos < session.target && newPos % SET_SIZE === 0) setShowBreak(true);
  };

  // ===== 開始・続きから 画面 =====
  const active = session && session.pos < session.target;
  if (!active && !(session && session.pos >= session.target)) {
    return (
      <div className="view">
        <h2 className="view-title">学習（10・60・300・900）</h2>
        <p className="view-desc">
          10問はすきま時間に、60問で1区切り、300問で今日の目標、900問で1周。1問ごとに自動保存され、いつでも続きから再開できます。
        </p>

        <div className="card">
          <div className="section-label" style={{ marginTop: 0 }}>🔍 出題をしぼる（未選択でOK）</div>
          <div className="search-grid">
            <label className="mini-field">
              <span>科目</span>
              <select value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="all">全科目</option>
                {subjects.map((s, i) => (<option key={s} value={s}>{i + 1}. {s}</option>))}
              </select>
            </label>
            <label className="mini-field">
              <span>ジャンル</span>
              <select value={genre} onChange={(e) => setGenre(e.target.value)}>
                <option value="">指定なし</option>
                {genreOptions.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </label>
            <label className="mini-field">
              <span>キーワード</span>
              <select value={keyword} onChange={(e) => setKeyword(e.target.value)} disabled={kwOptions.length === 0}>
                <option value="">指定なし</option>
                {kwSections.map((sec) => (
                  <optgroup key={sec.label} label={`- ${sec.label} -`}>
                    {sec.items.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="mini-field">
              <span>回（年度）</span>
              <select value={round} onChange={(e) => setRound(e.target.value)} disabled={roundOptions.length === 0}>
                <option value="">指定なし</option>
                {roundOptions.map((r) => (<option key={r} value={r}>第{r}回</option>))}
              </select>
            </label>
          </div>

          {/* 弱点タグ（#8）：誤答が多いタグをタップでしぼり込み */}
          {weakTags.length > 0 && (
            <div className="weak-tags">
              <span className="weak-tags-label">弱点タグ</span>
              <div className="chip-row">
                {weakTags.map((w) => (
                  <button
                    key={w.tag}
                    className={`chip ${keyword === w.tag ? 'active' : ''}`}
                    onClick={() => setKeyword(keyword === w.tag ? '' : w.tag)}
                    title={`誤答${w.wrong}回・正答率${Math.round((1 - w.rate) * 100)}%`}
                  >
                    {w.tag} <span className="weak-count">×{w.wrong}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="🔎 語で検索（例：顔面神経・足三里・糖尿病）科目をまたいで探せます"
            style={{ marginTop: 10 }}
          />
          <div className="search-foot" style={{ marginTop: 8 }}>
            <span>この条件で <strong>{filteredPool.length}</strong> 問（残り新規 <strong>{newRemaining}</strong> 問・残り復習 <strong>{reviewRemaining}</strong> 問）</span>
            {(genre || keyword || round || term || bookmarkOnly || subject !== 'all') && (
              <button className="btn ghost sm" onClick={() => { setSubject('all'); setGenre(''); setKeyword(''); setRound(''); setTerm(''); setBookmarkOnly(false); }}>クリア</button>
            )}
          </div>

          <label className="autokw-row" style={{ marginTop: 6 }}>
            <input type="checkbox" checked={bookmarkOnly} onChange={(e) => setBookmarkOnly(e.target.checked)} />
            <span>★ ブックマークした問題だけ出題</span>
          </label>
          <label className="autokw-row" style={{ marginTop: 6 }}>
            <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} />
            <span>⚡ 高速回転モード（問題→3秒想起→答え。サクサク周回）</span>
          </label>

          <div className="section-label">新規と復習の割合</div>
          <div className="chip-row">
            {[
              { p: 100, l: 'すべて新規' },
              { p: 70, l: '新規多め' },
              { p: 50, l: '半々' },
              { p: 30, l: '復習多め' },
              { p: 0, l: 'すべて復習' },
            ].map((o) => (
              <button key={o.p} className={`chip ${newPct === o.p ? 'active' : ''}`} onClick={() => setNewPct(o.p)}>
                {o.l}
              </button>
            ))}
          </div>
          <div className="range-row" style={{ marginTop: 8 }}>
            <input type="range" min="0" max="100" step="10" value={newPct} onChange={(e) => setNewPct(Number(e.target.value))} />
            <span className="range-val">新規{newPct}% / 復習{100 - newPct}%</span>
          </div>
          <div className="hint">
            <strong>新規</strong>＝まだ一度も解いていない問題、<strong>復習</strong>＝一度解いて間違えた問題。
            <br />「<strong>すべて新規</strong>」を選ぶと、<strong>すでに解いた問題は表示されず</strong>、未着手の問題だけが出題されます（同じ問題は繰り返しません）。復習も混ぜたいときはスライダーで割合を下げてください。
          </div>

          <label className="section-label">今日はどれで勉強しますか？</label>
          <div className="sess-targets">
            {TARGETS.map((t) => (
              <button
                key={t}
                className="sess-target"
                onClick={() => begin(t)}
                disabled={
                  filteredPool.length === 0 ||
                  (newPct >= 100 && newRemaining === 0) ||
                  (newPct <= 0 && reviewRemaining === 0) ||
                  (newPct > 0 && newPct < 100 && newRemaining === 0 && reviewRemaining === 0)
                }
              >
                <span className="sess-target-n">{t}</span>
                <span className="sess-target-l">
                  {t === 10 ? 'すきま時間' : t === 60 ? '1セット（区切り）' : t === 300 ? '1日の目標' : '1周（周回）'}
                </span>
              </button>
            ))}
          </div>
          {newPct >= 100 && newRemaining === 0 ? (
            <p className="inline-note" style={{ marginTop: 10, color: 'var(--warn, #e0a800)' }}>
              この条件の新規問題はすべて解き終えました。復習するには上のスライダーで割合を下げてください（例：復習多め）。
            </p>
          ) : newPct >= 100 ? (
            <p className="inline-note" style={{ marginTop: 10 }}>
              「すべて新規」では未着手の{newRemaining}問だけを出題します（解いた問題は混ざりません）。
            </p>
          ) : newPct <= 0 && reviewRemaining === 0 ? (
            <p className="inline-note" style={{ marginTop: 10, color: 'var(--warn, #e0a800)' }}>
              この条件で復習対象の問題はありません（まだ間違えた問題がないか、復習対象がありません）。新規を混ぜるには上のスライダーで割合を上げてください。
            </p>
          ) : newPct <= 0 ? (
            <p className="inline-note" style={{ marginTop: 10 }}>
              「すべて復習」では残り復習の{reviewRemaining}問だけを出題します（同じ問題は繰り返しません）。
            </p>
          ) : newRemaining === 0 && reviewRemaining === 0 ? (
            <p className="inline-note" style={{ marginTop: 10, color: 'var(--warn, #e0a800)' }}>
              この条件では新規・復習とも対象がありません。条件を変えてください。
            </p>
          ) : (
            <p className="inline-note" style={{ marginTop: 10 }}>
              新規と復習を混ぜる場合、同じ問題は繰り返さず該当する分だけ出題します（収録数が少ないと指定問数に満たないことがあります）。
            </p>
          )}
        </div>
      </div>
    );
  }

  // ===== 完了画面 =====
  if (session && session.pos >= session.target) {
    const t = session.target; // 実際に出題された問数
    const requested = session.requestedTarget || session.target; // 押したボタンの目標値（見出し・絵文字の判定用）
    const capped = t < requested;
    // このセッションの解答を history から復元（誤答一覧・ジャンル別＝#1/#6）
    const idsSet = new Set(session.ids || []);
    const startedAt = session.startedAt || 0;
    const latest = new Map(); // questionId → 最新の correct
    for (const h of history) {
      if (h.at >= startedAt && idsSet.has(h.questionId)) latest.set(h.questionId, h.correct);
    }
    const wrongQs = [...latest.entries()].filter(([, c]) => !c).map(([qid]) => byId[qid]).filter(Boolean);
    const byGenre = {};
    for (const [qid, c] of latest) {
      const q = byId[qid]; if (!q) continue;
      const g = q.genre || q.subject || 'その他';
      if (!byGenre[g]) byGenre[g] = { total: 0, correct: 0 };
      byGenre[g].total += 1; if (c) byGenre[g].correct += 1;
    }
    const genreRows = Object.entries(byGenre).sort((x, y) => (x[1].correct / x[1].total) - (y[1].correct / y[1].total));
    return (
      <div className="view">
        <div className="card sess-done">
          <div className="sess-done-ico">{requested >= 900 ? '🏆' : requested >= 300 ? '🎉' : '✅'}</div>
          <h2>
            {requested >= 900 ? '1周（900問）終了！' : requested >= 300 ? '今日の目標 300問 達成！' : requested >= 60 ? '1セット（60問）完了！' : `すきま学習（${requested}問）完了！`}
          </h2>
          {capped && (
            <p className="inline-note" style={{ textAlign: 'center' }}>
              該当する問題が{t}問だったため、{t}問で終了しました。
            </p>
          )}
          <p className="view-desc" style={{ textAlign: 'center' }}>
            {requested >= 900
              ? 'おつかれさまでした。苦手を分析して2周目へ進みましょう。'
              : requested >= 300
              ? 'すばらしい集中力です。苦手の復習で定着させましょう。'
              : requested >= 60
              ? 'いいペースです。続けて次のセットへ。'
              : '短い時間でもコツコツ積み上げ、えらい！もう1回いける？'}
          </p>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn accent" onClick={() => onGoReview?.()}>苦手を復習する</button>
            {requested >= 900 ? (
              <button className="btn primary" onClick={() => begin(900, { subject: session.subject, round: (session.round || 1) + 1, fast: session.fast, newRatio: session.newRatio, pool: poolFor(questions, session.subject), allowSeen: true })}>2周目を開始</button>
            ) : (
              <button className="btn primary" onClick={() => begin(requested, { subject: session.subject, fast: session.fast, newRatio: session.newRatio, pool: poolFor(questions, session.subject), allowSeen: true })}>もう一度</button>
            )}
          </div>
          <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => clearSession()}>終了する</button>
        </div>

        {/* ジャンル別の正答率（#6・苦手順） */}
        {genreRows.length > 1 && (
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>ジャンル別の正答率（苦手順）</div>
            <ul className="genre-stats">
              {genreRows.map(([g, s]) => {
                const p = Math.round((s.correct / s.total) * 100);
                return (
                  <li key={g}>
                    <span className="gs-name">{g}</span>
                    <span className="gs-bar"><i style={{ width: `${p}%`, background: p < 60 ? 'var(--wrong)' : p < 80 ? 'var(--warn)' : 'var(--correct)' }} /></span>
                    <span className="gs-num">{p}%（{s.correct}/{s.total}）</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* 今回の弱点分析（誤答・△・✕をまとめて対象に、実際の頻度だけから作成） */}
        {wrongQs.length > 0 && (() => {
          const summary = buildWeaknessSummary(wrongQs, links);
          if (!summary) return null;
          return (
            <div className="card">
              <div className="section-label" style={{ marginTop: 0 }}>今回の弱点分析</div>
              <p className="inline-note" style={{ marginTop: 0 }}>
                {summary.topGenres.length > 0 && (
                  <>「{summary.topGenres.map(([g, c]) => `${g}（${c}問）`).join('」「')}」で誤答・あいまいが目立ちました。</>
                )}
                {summary.topTags.length > 0 && (
                  <><br />繰り返しつまずいたキーワード：{summary.topTags.map(([tg, c]) => `${tg}（×${c}）`).join('・')}</>
                )}
              </p>
              {summary.relatedComparisons.length > 0 && (
                <>
                  <div className="section-label">関連する対比（混同しやすいポイント）</div>
                  {summary.relatedComparisons.map((c) => (
                    <div className="compare-item" key={c.id}>
                      <div className="compare-title">{c.title}</div>
                      <ul className="compare-members">
                        {(c.members || []).slice(0, 4).map((m, i) => (<li key={i}>{m}</li>))}
                      </ul>
                    </div>
                  ))}
                </>
              )}
            </div>
          );
        })()}

        {/* 今回の誤答・あいまい一覧（#1）：○以外（△・✕）はすべてここに含まれる */}
        {wrongQs.length > 0 && (
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>今回の誤答・あいまい（{wrongQs.length}問）</div>
            <p className="inline-note" style={{ marginTop: 0 }}>自己採点で「△ あいまい」「✕ わからない」を選んだ問題も含みます。</p>
            <ul className="wrong-list">
              {wrongQs.map((q) => (
                <li key={q.id}>
                  <span className="wl-ans">{q.type === 'ox' ? (q.answer === 0 ? '○' : '✕') : `正解 ${q.answer + 1}`}</span>
                  <span className="wl-q">{q.question}</span>
                </li>
              ))}
            </ul>
            <button className="btn accent block" style={{ marginTop: 10 }} onClick={() => begin(wrongQs.length, { pool: wrongQs, subject: session.subject, newRatio: 1, allowSeen: true, label: '誤答復習' })}>
              🔁 誤答・あいまいだった{wrongQs.length}問を復習
            </button>
          </div>
        )}
      </div>
    );
  }

  // ===== 休憩画面（60問ごと） =====
  if (showBreak) {
    const isDaily = session.pos === 300;
    return (
      <div className="view">
        <div className="card sess-break">
          <div className="sess-done-ico">{isDaily ? '🎉' : '☕'}</div>
          <h2>{isDaily ? '今日の目標 300問 達成！' : `ひと区切り（${session.pos}問）`}</h2>
          <p className="view-desc" style={{ textAlign: 'center' }}>
            {isDaily ? 'ここまでで今日の基本目標はクリア。休んでもOK、続けてもOK。' : 'よく集中できました。少し休むと定着します。'}
          </p>
          <div className="sess-break-actions">
            <button className="btn primary block lg" onClick={() => setShowBreak(false)}>▶ 続ける（次の60問）</button>
            <BreakTimer minutes={5} onDone={() => setShowBreak(false)} />
            <BreakTimer minutes={10} onDone={() => setShowBreak(false)} />
            <button className="btn ghost block" onClick={() => onToast?.('ここまで保存しました。続きからいつでも再開できます')}>
              終了して後で続ける（自動保存済み）
            </button>
            <ResetControl
              target={session.target}
              confirming={confirmReset}
              onAsk={() => setConfirmReset(true)}
              onConfirm={doReset}
              onCancel={() => setConfirmReset(false)}
            />
          </div>
        </div>
      </div>
    );
  }

  // ===== 出題画面 =====
  const current = byId[session.ids[session.pos]];
  if (!current) {
    // 収録が変わって id が見つからない場合は次へ
    updateSession({ pos: session.pos + 1 });
    return null;
  }
  const setNo = Math.floor(session.pos / SET_SIZE) + 1;
  const totalSets = Math.ceil(session.target / SET_SIZE);
  return (
    <div className="view">
      <div className="sess-topbar">
        <span className="sess-topbar-sub">{session.subject === 'all' ? '全科目' : session.subject}</span>
        <span className="sess-topbar-frac">{session.pos + 1} / {session.target}　（セット{setNo}/{totalSets}）</span>
      </div>
      <div className="progress">
        <span style={{ width: `${((session.pos + 1) / session.target) * 100}%` }} />
      </div>
      {session.fast ? (
        <FastCard key={current.id + '@' + session.pos} question={current} onGraded={answered} GRADES={GRADES} />
      ) : (
        <QuestionCard
          key={current.id + '@' + session.pos}
          question={current}
          memo={memos[current.id]}
          onSetMemo={setMemo}
          link={links[current.id]}
          onSetLink={setLink}
          onOpenKeyword={onOpenKeyword}
          onAnswered={answered}
          onNext={() => {}}
          selfGrade
          simple
          compact
          bookmarked={!!bookmarks[current.id]}
          onToggleBookmark={toggleBookmark}
          GRADES={GRADES}
        />
      )}
      <button className="btn ghost sm block" style={{ marginTop: 10 }} onClick={() => setShowBreak(true)}>
        中断して休憩（自動保存されています）
      </button>
      <ResetControl
        target={session.target}
        confirming={confirmReset}
        onAsk={() => setConfirmReset(true)}
        onConfirm={doReset}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}

// 学習リセットボタン ＋ 確認（はい/いいえ）
//   ①「学習◯◯をリセットする」をタップ → ②「本当にリセットしますか？」はい/いいえ
function ResetControl({ target, confirming, onAsk, onConfirm, onCancel }) {
  const label = target ? `学習${target}をリセットする` : '学習をリセットする';
  if (confirming) {
    return (
      <div className="sess-reset-confirm">
        <span className="sess-reset-q">本当にリセットしますか？</span>
        <div className="btn-row">
          <button className="btn danger" onClick={onConfirm}>はい</button>
          <button className="btn ghost" onClick={onCancel}>いいえ</button>
        </div>
      </div>
    );
  }
  return (
    <button className="btn ghost sm block sess-reset-btn" style={{ marginTop: 10 }} onClick={onAsk}>
      🗑 {label}
    </button>
  );
}

// 高速回転カード（3秒想起）。問題→3秒→答え→○△✕。選択肢は選ばず頭の中で想起。
function FastCard({ question, onGraded, GRADES }) {
  const [revealed, setRevealed] = useState(false);
  const [count, setCount] = useState(3);
  useEffect(() => { setRevealed(false); setCount(3); }, [question.id]);
  useEffect(() => {
    if (revealed) return undefined;
    if (count <= 0) { setRevealed(true); return undefined; }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, revealed]);
  const answer = question.choices[question.answer];
  const pick = (kind) => onGraded(kind === 'maru', kind === 'maru' ? (GRADES ? GRADES.easy : 5) : (GRADES ? GRADES.again : 0));
  return (
    <div className="card fast-card">
      <div className="q-meta">
        <span className={`badge ${question.type === 'ox' ? 'ox' : 'choice'}`}>{question.type === 'ox' ? '○×' : '四択'}</span>
        <span className="q-subject">{question.subject}</span>
        <span className="fast-tag">⚡ 高速</span>
      </div>
      {question.image && <img className="q-image" src={question.image} alt="問題の図" loading="lazy" />}
      {question.question && <div className="q-text">{question.question}</div>}
      {!revealed ? (
        <div className="fast-recall">
          <div className="fast-count">{count > 0 ? count : '…'}</div>
          <div className="fast-hint">答えを思い出そう</div>
          <button className="btn ghost sm" onClick={() => setRevealed(true)}>答えを見る →</button>
        </div>
      ) : (
        <>
          <div className="fast-answer">
            <strong>正解：{question.type === 'ox' ? answer : `${question.answer + 1}. ${answer}`}</strong>
            {question.explanation && <div style={{ marginTop: 6 }}>{question.explanation}</div>}
          </div>
          <div className="selfgrade-row" style={{ marginTop: 14 }}>
            <button className="btn self-maru" onClick={() => pick('maru')}><span className="sg-mark">○</span>完璧</button>
            <button className="btn self-sankaku" onClick={() => pick('sankaku')}><span className="sg-mark">△</span>あいまい</button>
            <button className="btn self-batsu" onClick={() => pick('batsu')}><span className="sg-mark">✕</span>わからない</button>
          </div>
        </>
      )}
    </div>
  );
}

// 休憩タイマー（5分/10分）。残り時間を表示し、終わると自動で続行。途中スキップ可。
function BreakTimer({ minutes, onDone }) {
  const [remain, setRemain] = useState(null); // 秒。null=未開始
  const start = () => {
    setRemain(minutes * 60);
    const iv = setInterval(() => {
      setRemain((r) => {
        if (r <= 1) {
          clearInterval(iv);
          onDone?.();
          return null;
        }
        return r - 1;
      });
    }, 1000);
  };
  if (remain == null) {
    return (
      <button className="btn block" onClick={start}>⏱ {minutes}分休憩</button>
    );
  }
  const mm = Math.floor(remain / 60);
  const ss = String(remain % 60).padStart(2, '0');
  return (
    <div className="sess-timer">
      <span>休憩中… あと {mm}:{ss}</span>
      <button className="btn ghost sm" onClick={() => onDone?.()}>スキップして再開</button>
    </div>
  );
}
