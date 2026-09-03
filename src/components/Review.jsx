import { useEffect, useMemo, useRef, useState } from 'react';
import QuestionCard from './QuestionCard.jsx';
import ResetInline from './ResetInline.jsx';
import { normalize, MASTER_STREAK, LEECH_THRESHOLD, isLeech as isLeechState } from '../lib/srs.js';
import * as storage from '../lib/storage.js';
import { effectiveTags } from '../lib/query.js';
import { weakTagClusters, tagTrend } from '../lib/weakClusters.js';
import { relatedQuestions } from '../lib/related.js';
import { filterReview, sortReview, riskOf } from '../lib/reviewOrder.js';
import { studyStreak } from '../lib/stats.js';
import { useMindmapData } from '../lib/mindmapDataLoader.js';
import { buildGenreBreakdown } from '../lib/genreBreakdown.js';
import {
  loadMissTypes, recordMissType, missTypeLabel, MISS_TYPE_DELAY_MS, MISS_TYPES,
  latestMissType, missTypeTrend, missTypeAnomaly,
} from '../lib/missTypes.js';
import { loadSelfKindCounts, recordSelfKindCount, starLevelOf, starLabel } from '../lib/starWeak.js';
import { buildGraphFromSolved } from '../lib/kgService.js';
import { conceptsOf } from '../lib/concepts.js';
import { elaborationSuggestions, chainNext } from '../lib/kgRecall.js';
import { SUBJECT_TAG_NAMES } from '../data/examScope.js';
import { buildKanaIndex } from '../lib/yomi.js';
import { reviewPoolFor, buildWeaknessSummary } from '../lib/reviewPool.js';
import { loadNextTask, saveNextTask } from '../lib/nextTask.js';
import { loadTodayMood } from '../lib/mood.js';
import { detectBrokenYesterday, loadStreakBreakLog, breakReasonLabel } from '../lib/streakBreak.js';
import { roundKey, formatRound } from '../lib/round.js';
import { reviewDailyGoal } from '../lib/reviewGoal.js';
import { leechDwellDays } from '../lib/reviewDwell.js';
import { daysSinceLastZero, zeroDaysSummary } from '../lib/reviewZeroLog.js';
import { loadSnoozeLog, recordSnooze, isSnoozeHabit, SNOOZE_HABIT_THRESHOLD } from '../lib/snoozeLog.js';
import { estimatedAnswerSeconds } from '../lib/bufferSession.js';
import { buildCaseLinkMap, keepCasePairsAdjacentObjects } from '../lib/casePairs.js';

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
// 原問と派生（同じ過去問由来）を離す。id末尾の枝記号を除いた基幹idでバケット分割し、
//   ラウンドロビンで並べて同一由来が隣り合わないようにする（Session.jsxと同じ考え方）。
const baseId = (id) => String(id).replace(/[a-z]+$/i, '');
function spaceByOriginRaw(qs) {
  if (qs.length < 3) return qs;
  const buckets = new Map();
  for (const q of qs) { const b = baseId(q.id); if (!buckets.has(b)) buckets.set(b, []); buckets.get(b).push(q); }
  if (buckets.size < 2) return qs;
  const lists = [...buckets.values()];
  const out = [];
  let more = true;
  while (more) {
    more = false;
    for (const l of lists) { if (l.length) { out.push(l.shift()); more = true; } }
  }
  return out;
}
// spaceByOriginRawの後に、症例の連問（原問＋「上記症例の続き」）を隣接させる
// （原問と派生を離す処理とは逆方向の要求だが、対象が違うので競合しない——
// 派生＝同じ過去問由来の一問一答、連問＝別の過去問設問だが同じ症例を参照するもの）。
function spaceByOrigin(qs, linkOf, pairOf) {
  const spaced = spaceByOriginRaw(qs);
  return linkOf && pairOf ? keepCasePairsAdjacentObjects(spaced, linkOf, pairOf) : spaced;
}

export default function Review({ store, onToast, onOpenKeyword, onGoAudio, quickStartCount, onConsumeQuickStart }) {
  const {
    questions, dueReviewQuestions, reviewQuestions, history,
    memos, links, recordAnswer, setMemo, setLink, srs, GRADES,
    bookmarks, toggleBookmark, removeFromReview, setNextDue, session,
    resetAllReviewDue, reviewZeroLog,
  } = store;

  const [started, setStarted] = useState(false);
  const [order, setOrder] = useState([]);
  const [idx, setIdx] = useState(0);
  // まぎらわしい対比（mindmapData.js）は出題中・完了画面でしか使わないため、開始してから
  // 遅延読み込みする（起動時バンドルから約14万字ぶんを外すため。mindmapDataLoader.jsが単一の正）。
  const mindmapData = useMindmapData(started);
  const [sessionStats, setSessionStats] = useState({ total: 0, correct: 0 });
  const [resume, setResume] = useState(null); // 前回の途中経過（続きから）
  const missRef = useRef([]); // この回で ○ にならなかった（不正解・△・✕）問題（{ q, selfKind }）
  const masteredRef = useRef([]); // このセッション中に新たにマスターした問題
  const [nextTaskInput, setNextTaskInput] = useState('');
  const [nextTaskSavedAt, setNextTaskSavedAt] = useState(0);
  useEffect(() => { loadNextTask().then((t) => { if (t && t.text) setNextTaskInput(t.text); }); }, []);
  const saveNextTaskDraft = () => {
    const text = nextTaskInput.trim();
    if (!text) return;
    saveNextTask(text);
    setNextTaskSavedAt(Date.now());
    onToast?.('📌 明日の最初の1タスクを保存しました');
  };

  // 出題・一覧の制御
  const [orderMode, setOrderMode] = useState('forget'); // 既定＝忘れそうな順
  const [filterTag, setFilterTag] = useState(''); // 弱点タグ or キーワードプルダウンで選んだ語
  const [search, setSearch] = useState('');
  const [subjectsSel, setSubjectsSel] = useState([]); // 複数選択可（空＝すべて）
  const [round, setRound] = useState(''); // 回（第XX回）
  const [bookmarkOnly, setBookmarkOnly] = useState(false);
  const [minRisk, setMinRisk] = useState(0); // 忘却リスクの下限（%）
  const [minWrong, setMinWrong] = useState(0); // 誤答回数の下限
  const [missTypeFilter, setMissTypeFilter] = useState(''); // 誤答理由の型で絞り込み
  const [recentOnly, setRecentOnly] = useState(''); // ''|'today'|'week'：直近の誤答だけに絞る
  const [batch, setBatch] = useState(60); // 1回の問題数（0=すべて）
  const [showAll, setShowAll] = useState(false); // リストの折りたたみ
  const [fast, setFast] = useState(false); // 高速回転モード
  const [simple, setSimple] = useState(true); // 段階表示：シンプル/じっくり
  const [missTypes, setMissTypes] = useState({}); // 間違いの型
  const [selfKindCounts, setSelfKindCounts] = useState({}); // △✕の累計回数（★弱点タグの元）
  const [mood, setMood] = useState(null); // 今日の調子（Homeで記録したもの）
  const [weeklyExpanded, setWeeklyExpanded] = useState(false); // 週間バー→月間ヒートマップ

  const [snoozeLog, setSnoozeLog] = useState({}); // #27：先送り（スヌーズ）の記録
  useEffect(() => { loadSnoozeLog().then(setSnoozeLog); }, []);
  useEffect(() => { loadMissTypes().then(setMissTypes); }, []);
  // 誤答理由の型の傾向（直近で増えた型）・急増検知（今日だけ明らかに多い）
  const missTrend = useMemo(() => missTypeTrend(missTypes), [missTypes]);
  const missAnomaly = useMemo(() => missTypeAnomaly(missTypes), [missTypes]);
  useEffect(() => { loadSelfKindCounts().then(setSelfKindCounts); }, []);
  useEffect(() => { loadTodayMood().then(setMood); }, []);
  const onMissType = (id, type) => {
    recordMissType(id, type).then(setMissTypes);
    // 型別に次回の再出題間隔を調整（ケアレスは短め、知識不足は長め＝解説を読み込む時間を作る）
    setNextDue?.(id, MISS_TYPE_DELAY_MS[type] || 20 * 60 * 1000);
  };

  // きのう出来なかった理由（あれば今日だけ一言表示）
  const [streakBreakReasonLabel, setStreakBreakReasonLabel] = useState(null);
  useEffect(() => {
    const broken = detectBrokenYesterday(history);
    if (!broken) return;
    loadStreakBreakLog().then((log) => {
      const entry = log[String(broken)];
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (entry && new Date(entry.at).setHours(0, 0, 0, 0) === today.getTime()) {
        setStreakBreakReasonLabel(breakReasonLabel(entry.reason));
      }
    });
  }, [history]);

  // 症例の連問（原問＋「上記症例の続き」）の対応表。必ず全体（questions）の元の収録順から
  //   導出する——filterされた一部だけを渡すと、派生を読み飛ばして遡る処理が正しく働かない。
  const casePairMap = useMemo(() => buildCaseLinkMap(questions), [questions]);
  // 復習対象プール（拡張版）：通常の復習対象（isInReview）に加え、マスター済みでも
  //   保持率が下がってきた問題を「念のため確認」として少数含む（reviewPool.jsを流用）。
  const extendedReviewPool = useMemo(() => reviewPoolFor(questions, srs), [questions, srs]);
  const reviewIdSet = useMemo(() => new Set(reviewQuestions.map((q) => q.id)), [reviewQuestions]);
  const nagameQuestions = useMemo(
    () => extendedReviewPool.filter((q) => !reviewIdSet.has(q.id)),
    [extendedReviewPool, reviewIdSet]
  );
  // リーチ（要注意）：規定回数以上間違えている問題
  const isLeech = (q) => isLeechState(srs[q.id]);

  // 復習リストにある科目の一覧（出題基準の1〜14番順、無いものは末尾に五十音順）
  const subjects = useMemo(() => {
    const present = Array.from(new Set(extendedReviewPool.map((q) => q.subject).filter(Boolean)));
    const ordered = SUBJECT_TAG_NAMES.filter((s) => present.includes(s));
    const extra = present.filter((s) => !SUBJECT_TAG_NAMES.includes(s)).sort((a, b) => a.localeCompare(b, 'ja'));
    return [...ordered, ...extra];
  }, [extendedReviewPool]);
  const toggleSubjectSel = (s) => setSubjectsSel((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  // キーワード（プルダウン・あ〜ん順）／回（第XX回）の選択肢
  const kwOptions = useMemo(
    () => Array.from(new Set(extendedReviewPool.flatMap((q) => effectiveTags(q, links)))),
    [extendedReviewPool, links]
  );
  const kwSections = useMemo(() => buildKanaIndex(kwOptions), [kwOptions]);
  const roundOptions = useMemo(
    () => Array.from(new Set(extendedReviewPool.map((q) => roundKey(q.round)).filter((r) => r != null))).sort((a, b) => Number(b) - Number(a)),
    [extendedReviewPool]
  );

  // 弱点テーマ（誤答が多いタグ）
  const weakTags = useMemo(
    () => weakTagClusters(history, extendedReviewPool, links, { minWrong: 1, limit: 10 }),
    [history, extendedReviewPool, links]
  );

  // 弱点テーマの改善トレンド（今週の誤答率 vs 先週の誤答率。weakClusters.jsのtagTrendが単一の正）
  const weakTagsWithTrend = useMemo(
    () => tagTrend(history, questions, links, weakTags),
    [weakTags, history, questions, links]
  );

  // 直近（今日／今週）に誤答した問題だけに絞る補助フィルタ
  const recentWrongIds = useMemo(() => {
    if (!recentOnly) return null;
    const now = Date.now();
    const since = recentOnly === 'today' ? now - 24 * 60 * 60 * 1000 : now - 7 * 24 * 60 * 60 * 1000;
    const ids = new Set();
    for (const h of history) if (!h.correct && h.at >= since) ids.add(h.questionId);
    return ids;
  }, [recentOnly, history]);

  const filterOpts = {
    subjects: subjectsSel, tag: filterTag, term: search, links,
    round, bookmarkOnly, bookmarks, minRisk, minWrong, srs,
    missType: missTypeFilter, missTypes,
  };

  const applyRecent = (qs) => (recentWrongIds ? qs.filter((q) => recentWrongIds.has(q.id)) : qs);

  // 絞り込み＋並べ替え後のリスト（マスター後の「念のため確認」も対象に含む）
  const shownList = useMemo(() => {
    const filtered = applyRecent(filterReview(extendedReviewPool, filterOpts));
    return sortReview(filtered, orderMode, { srs, history, links });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extendedReviewPool, subjectsSel, filterTag, search, round, bookmarkOnly, bookmarks, minRisk, minWrong, missTypeFilter, missTypes, recentWrongIds, orderMode, srs, history, links]);

  // 出題プール：絞り込みがあれば全リストから、無ければ「今日の復習」から。並びは orderMode。
  const filtering = subjectsSel.length > 0 || !!filterTag || !!search.trim() || !!round || bookmarkOnly || minRisk > 0 || minWrong > 0 || !!missTypeFilter || !!recentOnly;
  const startPool = useMemo(() => {
    const base = filtering ? applyRecent(filterReview(extendedReviewPool, filterOpts)) : dueReviewQuestions;
    return sortReview(base, orderMode, { srs, history, links });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtering, subjectsSel, filterTag, search, round, bookmarkOnly, bookmarks, minRisk, minWrong, missTypeFilter, missTypes, recentWrongIds, extendedReviewPool, dueReviewQuestions, orderMode, srs, history, links]);

  // 実際に出題される問数（バッチ上限と在庫の小さい方）
  const effectiveCount = batch > 0 ? Math.min(batch, startPool.length) : startPool.length;

  // #2：過去の解答間隔（bufferSession.jsと同じ推定ロジック）から、今から始めた場合のおおよその所要時間
  const estMinutes = useMemo(() => {
    if (effectiveCount === 0) return 0;
    const secPerQ = estimatedAnswerSeconds(history, 'all');
    return Math.max(1, Math.round((secPerQ * effectiveCount) / 60));
  }, [history, effectiveCount]);

  // pool を出題開始（続けるループ用に任意の配列でも開始できる）。原問と派生は離して出題。
  const startWith = (pool) => {
    if (!pool || pool.length === 0) return;
    missRef.current = [];
    masteredRef.current = [];
    setOrder(spaceByOrigin(pool, casePairMap.linkOf, casePairMap.pairOf));
    setIdx(0);
    setSessionStats({ total: 0, correct: 0 });
    setStarted(true);
  };

  const start = () => {
    const pool = batch > 0 ? startPool.slice(0, batch) : startPool;
    startWith(pool);
  };

  // 弱点テーマをワンタップで即復習：フィルタ状態に依存せずその場でプールを作る
  const quickStartTag = (tag) => {
    const pool = sortReview(filterReview(extendedReviewPool, { tag, links }), orderMode, { srs, history, links });
    startWith(batch > 0 ? pool.slice(0, batch) : pool);
  };

  // ★3（✕2回以上の要注意問題）だけを集めたプール。G-100の「★3｜毎日」に相当。
  const star3Questions = useMemo(
    () => extendedReviewPool.filter((q) => starLevelOf(selfKindCounts[q.id]) === 3),
    [extendedReviewPool, selfKindCounts]
  );

  // 直近の学習セッション（10・60・300・900）で間違えた問題を、その場ですぐ復習できるように
  const lastSessionMisses = useMemo(() => {
    if (!session || !session.startedAt || !Array.isArray(session.ids)) return [];
    const idsSet = new Set(session.ids);
    const wrongIds = new Set();
    for (const h of history) {
      if (h.at >= session.startedAt && idsSet.has(h.questionId) && !h.correct) wrongIds.add(h.questionId);
    }
    return questions.filter((q) => wrongIds.has(q.id));
  }, [session, history, questions]);

  const clearFilters = () => {
    setSubjectsSel([]); setFilterTag(''); setSearch(''); setRound('');
    setBookmarkOnly(false); setMinRisk(0); setMinWrong(0); setMissTypeFilter(''); setRecentOnly('');
  };

  // 今日の到達・連続日数（改善2）：復習由来の解答だけを数える
  const { streak } = useMemo(() => studyStreak(history), [history]);
  // 日次目標＝今日こなした復習＋まだ期限が来ている数（今日中に片づけたい総量。reviewGoal.jsが単一の正＝#15）。
  const { todayReviewDone, dailyGoal, goalPct } = useMemo(
    () => reviewDailyGoal(history, dueReviewQuestions.length, mood),
    [history, dueReviewQuestions.length, mood]
  );
  // #3：復習が何日ゼロに戻せていないか（Homeの停滞警告と同じ定義）
  const stalledDays = useMemo(() => daysSinceLastZero(reviewZeroLog), [reviewZeroLog]);

  // 前進感（改善5）：あと1問でマスター／マスターまで延べ何回／週間の復習量
  const DAY = 24 * 60 * 60 * 1000;
  const nearMaster = useMemo(
    () => reviewQuestions.filter((q) => (normalize(srs[q.id]).correctStreak || 0) === MASTER_STREAK - 1).length,
    [reviewQuestions, srs]
  );
  const toMasterTotal = useMemo(
    () => reviewQuestions.reduce((s, q) => s + Math.max(0, MASTER_STREAK - (normalize(srs[q.id]).correctStreak || 0)), 0),
    [reviewQuestions, srs]
  );
  const weekly = useMemo(() => {
    const base = new Date(); base.setHours(0, 0, 0, 0);
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d0 = base.getTime() - i * DAY;
      const d1 = d0 + DAY;
      days.push(history.filter((h) => h.source === 'review' && h.at >= d0 && h.at < d1).length);
    }
    return days;
  }, [history]);
  const weekMax = Math.max(1, ...weekly);
  // 週間バーの拡大表示：直近5週間（35日）分の復習量ヒートマップ
  const monthly = useMemo(() => {
    if (!weeklyExpanded) return [];
    const base = new Date(); base.setHours(0, 0, 0, 0);
    const days = [];
    for (let i = 34; i >= 0; i--) {
      const d0 = base.getTime() - i * DAY;
      const d1 = d0 + DAY;
      days.push(history.filter((h) => h.source === 'review' && h.at >= d0 && h.at < d1).length);
    }
    return days;
  }, [weeklyExpanded, history]);
  const monthlyMax = Math.max(1, ...monthly);

  // マスター済み問題の累計数・科目別マスター率（復習経由＝一度でも間違えた問題のうち）
  const masteredCount = useMemo(
    () => questions.filter((q) => {
      const s = normalize(srs[q.id]);
      return (s.wrongCount || 0) > 0 && (s.correctStreak || 0) >= MASTER_STREAK;
    }).length,
    [questions, srs]
  );
  const masterySubjectStats = useMemo(() => {
    const stats = {};
    for (const q of questions) {
      const s = normalize(srs[q.id]);
      if ((s.wrongCount || 0) === 0) continue;
      const subj = q.subject || 'その他';
      if (!stats[subj]) stats[subj] = { total: 0, mastered: 0 };
      stats[subj].total += 1;
      if ((s.correctStreak || 0) >= MASTER_STREAK) stats[subj].mastered += 1;
    }
    return Object.entries(stats)
      .map(([subject, v]) => ({ subject, ...v, rate: v.total ? v.mastered / v.total : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [questions, srs]);

  // 知識グラフ（解答済みから構築）＝精緻化候補・関連1問チェインに使う
  const kgraph = useMemo(
    () => buildGraphFromSolved(questions.filter((q) => srs[q.id] && (srs[q.id].seen || 0) > 0), links),
    [questions, srs, links]
  );

  // #7・#8・#18：Home「復習だけ◯問」「要注意だけ今すぐ」からのワンタップ開始
  //   （続きからより後に判定し、続きからを優先しない）。数値＝件数指定、{ids}＝問題idを直接指定。
  useEffect(() => {
    if (started || !quickStartCount || !questions || !questions.length) return;
    if (typeof quickStartCount === 'object' && quickStartCount.ids) {
      const byId = new Map(questions.map((q) => [q.id, q]));
      const pool = quickStartCount.ids.map((id) => byId.get(id)).filter(Boolean);
      if (pool.length > 0) startWith(pool);
    } else {
      const pool = dueReviewQuestions.length > 0 ? dueReviewQuestions : extendedReviewPool;
      if (pool.length > 0) startWith(pool.slice(0, quickStartCount));
    }
    onConsumeQuickStart?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, quickStartCount, questions, dueReviewQuestions, extendedReviewPool]);

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

  const handleAnswered = (correct, grade, selfKind) => {
    const q = order[idx];
    const priorStreak = normalize(srs[q?.id]).correctStreak || 0;
    const leechEvent = recordAnswer(q, correct, grade, 'review', selfKind); // 復習由来として記録（到達集計用）
    if (q && leechEvent === 'became') {
      onToast?.(`⚠️ 要注意（${LEECH_THRESHOLD}回以上の誤答）：「${(q.question || '（図の問題）').slice(0, 20)}」。解説の読み方を変えてみましょう`);
    } else if (q && leechEvent === 'resolved') {
      onToast?.(`✅ 要注意を脱出！「${(q.question || '（図の問題）').slice(0, 20)}」がマスターになりました`);
    }
    // ○（完璧）以外＝不正解・△・✕ は「まだ定着していない」として記憶
    if (!correct && q) missRef.current.push({ q, selfKind });
    // △✕の累計回数を記録（★弱点タグの判定材料。ここでの選択が起点）
    if (q && (selfKind === 'sankaku' || selfKind === 'batsu')) {
      recordSelfKindCount(q.id, selfKind).then(setSelfKindCounts);
    }
    // ちょうど5回連続の○に到達＝マスターの瞬間。その場でお祝いする
    if (correct && q && priorStreak === MASTER_STREAK - 1) {
      masteredRef.current.push(q);
      onToast?.(`🏆 マスター達成！「${(q.question || '').slice(0, 20)}」`);
    }
    setSessionStats((s) => ({ total: s.total + 1, correct: s.correct + (correct ? 1 : 0) }));
  };

  const handleNext = () => {
    if (idx + 1 < order.length) setIdx(idx + 1);
    else setIdx(order.length);
  };

  // ---- 復習対象が無い ----
  if (!started && extendedReviewPool.length === 0) {
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
          {nagameQuestions.length > 0 && <>マスター済みでも保持率が下がった問題を「念のため確認」として少数含みます（{nagameQuestions.length}問）。</>}
        </p>

        {streakBreakReasonLabel && (
          <div className="card" style={{ marginBottom: 10 }}>
            きのうは『{streakBreakReasonLabel}』だったんですね。気にせず、今日は無理せず1問からいきましょう。
          </div>
        )}

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

        {lastSessionMisses.length > 0 && (
          <button className="btn block lg" style={{ marginBottom: 10 }} onClick={() => startWith(lastSessionMisses)}>
            📚 さっきの学習で間違えた{lastSessionMisses.length}問をすぐ復習
          </button>
        )}

        {star3Questions.length > 0 && (
          <button className="btn danger block lg" style={{ marginBottom: 10 }} onClick={() => startWith(star3Questions)}>
            {starLabel(3)} 今日つぶす（✕2回以上の問題・{star3Questions.length}問）
          </button>
        )}

        {/* 前進感：あと1問でマスター／延べ回数／マスター累計／週間の復習量（タップで月間に拡大） */}
        {reviewQuestions.length > 0 && (
          <div className="progress-hint">
            🎯 あと1問でマスター <strong>{nearMaster}</strong> 件 ・ マスターまで延べ <strong>{toMasterTotal}</strong> 回
            <br />🏆 マスター済み累計 <strong>{masteredCount}</strong> 問
            <button
              className="weekbar"
              title="タップで月間表示に切り替え"
              onClick={() => setWeeklyExpanded((v) => !v)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
            >
              {(weeklyExpanded ? monthly : weekly).map((c, i) => (
                <span key={i} className="weekbar-col">
                  <i style={{ height: `${Math.round((c / (weeklyExpanded ? monthlyMax : weekMax)) * 100)}%` }} />
                </span>
              ))}
              <span className="weekbar-label">{weeklyExpanded ? '35日（タップで戻す）' : '7日（タップで月間）'}</span>
            </button>
          </div>
        )}

        {reviewQuestions.length > 0 && (
          <button
            className="btn ghost sm"
            style={{ marginBottom: 10 }}
            onClick={() => {
              if (window.confirm('復習リストの全問題（マスター済みを除く）の次回期限を「今」にリセットします。誤答回数・連続記録は消えません。よろしいですか？')) {
                resetAllReviewDue?.();
                onToast?.('🔄 復習の間隔をすべてリセットしました');
              }
            }}
          >
            🔄 復習の間隔をすべてリセット（{reviewQuestions.length}問が対象）
          </button>
        )}

        {masterySubjectStats.length > 0 && (
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="section-label" style={{ marginTop: 0 }}>科目別マスター率</div>
            <ul className="genre-stats">
              {masterySubjectStats.map((s) => {
                const p = Math.round(s.rate * 100);
                return (
                  <li key={s.subject}>
                    <span className="gs-name">{s.subject}</span>
                    <span className="gs-bar"><i style={{ width: `${p}%`, background: p < 40 ? 'var(--wrong)' : p < 80 ? 'var(--warn)' : 'var(--correct)' }} /></span>
                    <span className="gs-num">{p}%（{s.mastered}/{s.total}）</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* ===== 今日の到達リング＋連続日数 ===== */}
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
              {mood === 'tired' && <span className="goal-nudge">　今日は少なめに調整中</span>}
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
              {weakTagsWithTrend.map((w) => {
                const lvl = w.rate >= 0.6 ? 'hot' : w.rate >= 0.3 ? 'warm' : 'mild';
                return (
                  <span key={w.tag} className={`weak-chip ${filterTag === w.tag ? 'active' : ''} lv-${lvl}`}>
                    <button
                      className="weak-chip-label"
                      onClick={() => setFilterTag(filterTag === w.tag ? '' : w.tag)}
                      title={`誤答${w.wrong}／${w.attempts}（誤答率${Math.round(w.rate * 100)}%）`}
                    >
                      <i className="weak-dot" />{w.tag} <b>誤答{w.wrong}</b>
                      {w.trend === 'better' && <span style={{ color: 'var(--correct)' }}> ↓改善</span>}
                      {w.trend === 'worse' && <span style={{ color: 'var(--wrong)' }}> ↑悪化</span>}
                    </button>
                    <button className="weak-chip-go" onClick={() => quickStartTag(w.tag)} aria-label={`${w.tag}を即復習`}>▶</button>
                  </span>
                );
              })}
            </div>
          </>
        )}

        {/* ===== 検索（科目・キーワード・回・ブックマーク・直近誤答・忘却リスク/誤答回数）＋並べ替え ===== */}
        <div className="section-label" style={{ marginTop: 0 }}>科目でしぼる（複数選択可・未選択で全科目）</div>
        <div className="chip-row">
          {subjects.map((s, i) => (
            <button key={s} className={`chip ${subjectsSel.includes(s) ? 'active' : ''}`} onClick={() => toggleSubjectSel(s)}>
              {i + 1}. {s}
            </button>
          ))}
        </div>

        <div className="review-controls">
          <label className="review-order">
            <span>キーワード</span>
            <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} disabled={kwOptions.length === 0}>
              <option value="">指定なし</option>
              {kwSections.map((sec) => (
                <optgroup key={sec.label} label={`- ${sec.label} -`}>
                  {sec.items.map((s) => (<option key={s} value={s}>{s}</option>))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="review-order">
            <span>回（年度）</span>
            <select value={round} onChange={(e) => setRound(e.target.value)} disabled={roundOptions.length === 0}>
              <option value="">指定なし</option>
              {roundOptions.map((r) => (<option key={r} value={r}>{formatRound(r)}</option>))}
            </select>
          </label>
          <label className="review-order">
            <span>出題・並び順</span>
            <select value={orderMode} onChange={(e) => setOrderMode(e.target.value)}>
              {ORDER_MODES.map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
            </select>
          </label>
        </div>
        <input
          type="text"
          className="review-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔎 キーワード検索（語・タグ）"
        />

        <label className="autokw-row" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={bookmarkOnly} onChange={(e) => setBookmarkOnly(e.target.checked)} />
          <span>★ ブックマークした問題だけ出題</span>
        </label>

        <div className="chip-row" style={{ marginTop: 8 }}>
          <span className="section-hint">直近の誤答だけ：</span>
          <button className={`chip ${recentOnly === '' ? 'active' : ''}`} onClick={() => setRecentOnly('')}>指定なし</button>
          <button className={`chip ${recentOnly === 'today' ? 'active' : ''}`} onClick={() => setRecentOnly(recentOnly === 'today' ? '' : 'today')}>今日</button>
          <button className={`chip ${recentOnly === 'week' ? 'active' : ''}`} onClick={() => setRecentOnly(recentOnly === 'week' ? '' : 'week')}>今週</button>
        </div>

        <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
          <label>忘却リスクの下限（{minRisk === 0 ? '指定なし' : `${minRisk}%以上だけ`}）</label>
          <input type="range" min="0" max="90" step="10" value={minRisk} onChange={(e) => setMinRisk(Number(e.target.value))} />
        </div>
        <div className="field" style={{ marginTop: 8 }}>
          <label>誤答回数の下限（{minWrong === 0 ? '指定なし' : `${minWrong}回以上だけ`}）</label>
          <input type="range" min="0" max="10" step="1" value={minWrong} onChange={(e) => setMinWrong(Number(e.target.value))} />
        </div>

        <div className="chip-row" style={{ marginTop: 8 }}>
          <span className="section-hint">誤答理由の型で集中特訓：</span>
          <button className={`chip ${missTypeFilter === '' ? 'active' : ''}`} onClick={() => setMissTypeFilter('')}>指定なし</button>
          {MISS_TYPES.map((t) => (
            <button
              key={t.id}
              className={`chip ${missTypeFilter === t.id ? 'active' : ''}`}
              onClick={() => setMissTypeFilter(missTypeFilter === t.id ? '' : t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {(missTrend || missAnomaly?.isAnomaly) && (
          <p className="inline-note" style={{ marginTop: 6 }}>
            {missAnomaly?.isAnomaly && <>今日は誤答が{missAnomaly.todayTotal}件と、直近の1日平均（約{missAnomaly.avgPerDay}件）よりかなり多めです。無理せず休憩も挟みましょう。<br /></>}
            {missTrend && <>最近は「{missTypeLabel(missTrend.type)}」が増えています（直近7日で{missTrend.count}件）。{missTrend.type === 'careless' ? '落ち着いて設問を最後まで読みましょう。' : missTrend.type === 'chishiki' ? '解説を読み込む時間を作りましょう。' : '対比で整理してみましょう。'}</>}
          </p>
        )}

        <div className="review-count">
          この条件で <strong>{startPool.length}</strong> 問
          {filtering && <button className="btn ghost sm" onClick={clearFilters}>クリア</button>}
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
        <label className="autokw-row" style={{ marginTop: 6 }}>
          <input type="checkbox" checked={!simple} onChange={(e) => setSimple(!e.target.checked)} />
          <span>📖 じっくりモード（メモ・連結キーワードも最初から表示。オフ＝シンプル：問題→答え→○△✕）</span>
        </label>

        {estMinutes > 0 && (
          <p className="inline-note" style={{ marginTop: 4, marginBottom: 0 }}>
            ⏱ 今から始めると、約{estMinutes}分でこの{effectiveCount}問を片づけられます（過去の解答ペースからの目安・#2）。
          </p>
        )}
        <button className="btn primary block lg" style={{ marginTop: 6 }} onClick={start} disabled={startPool.length === 0}>
          {startPool.length > 0
            ? `📝 一問一答で復習（${effectiveCount}問・${ORDER_MODES.find((m) => m.id === orderMode)?.label}）`
            : (filtering ? '条件に合う問題がありません' : '今日の復習は完了しました')}
        </button>
        {/* #16：今日の期限は無いが「念のため確認」枠だけはある日でも、何かやることがある状態にする */}
        {!filtering && dueReviewQuestions.length === 0 && nagameQuestions.length > 0 && (
          <button
            className="btn block lg"
            style={{ marginTop: 10 }}
            onClick={() => startWith(sortReview(nagameQuestions, orderMode, { srs, history, links }))}
          >
            🔎 念のため確認だけ（{nagameQuestions.length}問・保持率が下がってきたマスター済み）
          </button>
        )}
        <button
          className="btn block lg"
          style={{ marginTop: 10 }}
          onClick={() => onGoAudio?.(filtering ? shownList.map((q) => q.id) : undefined)}
          disabled={(filtering ? shownList.length : reviewQuestions.length) === 0}
        >
          🎧 音声で復習（{filtering ? `${shownList.length}問・絞り込み条件を反映` : `${reviewQuestions.length}問を読み上げ`}）
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
          const nagame = !reviewIdSet.has(q.id);
          const starLv = starLevelOf(selfKindCounts[q.id]);
          return (
            <div className="list-item" key={q.id}>
              <div className="li-top">
                <span className="li-subject">{q.subject}</span>
                {starLv > 0 && (
                  <span
                    className="risk-badge lv-hot"
                    title={starLv >= 3 ? '復習中に✕（わからない）が2回以上ありました。今日つぶしたい問題です' : '復習中に△（あいまい）が3回以上ありました'}
                  >
                    {starLabel(starLv)}
                  </span>
                )}
                {nagame && <span className="risk-badge lv-mild" title="マスター済みだが保持率が下がってきたので念のため確認">念のため</span>}
                {isLeech(q) && (
                  <span className="risk-badge lv-hot" title={`${LEECH_THRESHOLD}回以上間違えています。解説の読み方を変えてみましょう`}>
                    ⚠️ 要注意
                    {(() => { const d = leechDwellDays(q.id, history); return d != null ? `（${d}日滞留）` : ''; })()}
                  </span>
                )}
                {isSnoozeHabit(snoozeLog, q.id) && (
                  <span className="risk-badge lv-warm" title={`${SNOOZE_HABIT_THRESHOLD}回以上先送りしています。今日は少しだけでも解いてみましょう`}>😴 先送りグセ</span>
                )}
                <span className={`risk-badge lv-${rlvl}`} title="忘却リスク（高いほど早く復習を）">忘却{risk}%</span>
              </div>
              <div className="li-q">{q.question || '（図の問題）'}</div>
              <div className="li-stat">
                完璧 {cs}/{MASTER_STREAK} ・ 誤答 {st.wrongCount || 0}回 ・ {dueLabel}
                {latestMissType(missTypes[q.id]) && <span className="misstype-tag">型: {missTypeLabel(latestMissType(missTypes[q.id]).type)}</span>}
              </div>
              <div className="streak-dots" aria-label={`完璧 ${cs}/${MASTER_STREAK}`}>
                {Array.from({ length: MASTER_STREAK }).map((_, i) => (
                  <i key={i} className={i < cs ? 'on' : ''} />
                ))}
              </div>
              {memos[q.id] && <div className="li-memo">📝 {memos[q.id]}</div>}
              <RelatedPanel q={q} questions={questions} links={links} />
              <div className="btn-row" style={{ marginTop: 8 }}>
                <button className="btn ghost sm" onClick={() => toggleBookmark(q.id)}>
                  {bookmarks[q.id] ? '★ ブックマーク済み' : '☆ ブックマーク'}
                </button>
                <button
                  className="btn ghost sm"
                  onClick={() => {
                    setNextDue(q.id, 24 * 60 * 60 * 1000);
                    recordSnooze(q.id).then(setSnoozeLog); // #27：ボタン操作だけを記録（型別の自動間隔調整とは区別）
                  }}
                >
                  😴 明日まで先送り
                </button>
                <button className="btn ghost sm" onClick={() => removeFromReview(q.id)}>🗑 リストから外す</button>
              </div>
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
    // この回で ○ にならなかった（不正解・△・✕）問題（重複除去。selfKindが分かれば△✕を区別）
    const missEntries = [];
    const seen = new Set();
    for (const { q, selfKind } of missRef.current) {
      if (!q || seen.has(q.id)) continue;
      seen.add(q.id);
      missEntries.push({ q, selfKind });
    }
    const misses = missEntries.map((e) => e.q);
    const sankakuCount = missEntries.filter((e) => e.selfKind === 'sankaku').length;
    const batsuCount = missEntries.length - sankakuCount;
    const masteredThisRound = [...new Map(masteredRef.current.map((q) => [q.id, q])).values()];
    const backToList = () => { missRef.current = []; masteredRef.current = []; setStarted(false); };
    // 関連1問チェイン：この回の問題と概念を共有する“つながり”を辿って続ける
    const chainPool = [];
    const excl = new Set(order.map((q) => q.id));
    for (const q of order) {
      const nx = chainNext(q, questions, links, excl);
      if (nx) { chainPool.push(nx.question); excl.add(nx.question.id); }
      if (chainPool.length >= 10) break;
    }
    // ジャンル別正答率（苦手順）：このセッションで出た問題（order）を対象に（genreBreakdown.jsが単一の正）
    const missIdSet = new Set(misses.map((q) => q.id));
    const genreRows = buildGenreBreakdown(order.map((q) => ({ genre: q.genre || q.subject, correct: !missIdSet.has(q.id) })));
    const weakness = misses.length > 0 && mindmapData ? buildWeaknessSummary(misses, links, mindmapData.COMPARISONS) : null;
    // #26：このセッションで復習（期限が来ているもの）を完全にゼロへ戻せたか
    const justReachedZero = dueReviewQuestions.length === 0 && reviewQuestions.length > 0;
    return (
      <div className="view">
        <h2 className="view-title">復習完了</h2>
        {justReachedZero && (() => {
          const zs = zeroDaysSummary(reviewZeroLog);
          return (
            <div className="card" style={{ textAlign: 'center', background: 'var(--correct-soft, #eafaf0)', marginBottom: 10 }}>
              <div style={{ fontSize: 22 }}>✨ 今日の復習をゼロにしました！</div>
              <p className="inline-note" style={{ marginTop: 4 }}>
                直近{zs.total}日中 {zs.achieved}日でゼロ達成
              </p>
            </div>
          );
        })()}
        <div className="card complete-pop" style={{ textAlign: 'center' }}>
          <div className="complete-emoji">{rate >= 80 ? '🎉' : rate >= 50 ? '👍' : '💪'}</div>
          <div className="num" style={{ fontSize: 32, color: 'var(--text)', fontWeight: 800 }}>
            {rate}%
          </div>
          <p className="view-desc">
            {sessionStats.total}問中 {sessionStats.correct}問 正解 ・ 🔥連続{streak}日 ・ 今日{todayReviewDone}問
          </p>
          <p className="inline-note" style={{ marginBottom: 8 }}>
            マスターまで延べ <strong>{toMasterTotal}</strong> 回（あと1問で <strong>{nearMaster}</strong> 件がマスター）
          </p>
          {masteredThisRound.length > 0 && (
            <p className="inline-note" style={{ marginBottom: 8, color: 'var(--correct)' }}>
              🏆 このセッションで新たにマスター：<strong>{masteredThisRound.length}問</strong>
            </p>
          )}
          {misses.length > 0 ? (
            <>
              <p className="inline-note" style={{ marginBottom: 12 }}>
                まだ定着していない（不正解・△・✕）問題が <strong style={{ color: 'var(--wrong)' }}>{misses.length}問</strong> あります（△{sankakuCount}問・✕{batsuCount}問）。続けますか？
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
          {chainPool.length > 0 && (
            <button className="btn block" style={{ marginTop: 10 }} onClick={() => startWith(chainPool)}>
              🔗 関連をたどって続ける（{chainPool.length}問）
            </button>
          )}
        </div>

        {/* ジャンル別の正答率（苦手順） */}
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

        {/* 今回の弱点分析（誤答・△・✕から） */}
        {weakness && (
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>今回の弱点分析</div>
            <p className="inline-note" style={{ marginTop: 0 }}>
              {weakness.topGenres.length > 0 && (
                <>「{weakness.topGenres.map(([g, c]) => `${g}（${c}問）`).join('」「')}」で誤答・あいまいが目立ちました。</>
              )}
              {weakness.topTags.length > 0 && (
                <><br />繰り返しつまずいたキーワード：{weakness.topTags.map(([tg, c]) => `${tg}（×${c}）`).join('・')}</>
              )}
            </p>
          </div>
        )}

        {/* 今回の誤答・あいまい一覧（△・✕を区別して表示） */}
        {missEntries.length > 0 && (
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>今回の誤答・あいまい（{missEntries.length}問）</div>
            <ul className="wrong-list">
              {missEntries.map(({ q, selfKind }) => (
                <li key={q.id}>
                  <span className={`wl-mark ${selfKind === 'sankaku' ? 'sankaku' : 'batsu'}`}>{selfKind === 'sankaku' ? '△' : '✕'}</span>
                  <span className="wl-ans">{q.type === 'ox' ? (q.answer === 0 ? '○' : '✕') : `正解 ${q.answer + 1}`}</span>
                  <span className="wl-q">{q.question}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 明日の最初の1タスクを決めておく */}
        <div className="card">
          <div className="section-label" style={{ marginTop: 0 }}>📌 明日の最初の1タスクを決めておく</div>
          <p className="inline-note" style={{ marginTop: 0 }}>
            次にアプリを開いた時、ホーム画面の一番上に表示されます。
          </p>
          <div className="chip-row" style={{ marginBottom: 8 }}>
            {misses.length > 0 && (
              <button className="chip" onClick={() => setNextTaskInput(`苦手を${Math.min(misses.length, 10)}問だけ復習する`)}>
                苦手を{Math.min(misses.length, 10)}問だけ復習する
              </button>
            )}
            <button className="chip" onClick={() => setNextTaskInput('今日の復習を片づける')}>今日の復習を片づける</button>
          </div>
          <div className="kw-add">
            <input
              type="text"
              value={nextTaskInput}
              onChange={(e) => setNextTaskInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveNextTaskDraft()}
              placeholder="例：苦手を5問だけ復習する"
            />
            <button className="btn sm primary" onClick={saveNextTaskDraft}>保存</button>
          </div>
          {nextTaskSavedAt > 0 && <p className="hint" style={{ marginTop: 6 }}>保存しました。</p>}
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
  if (mindmapData) {
    for (const t of curTags) {
      for (const c of mindmapData.comparisonsForKeyword(t)) if (!seenCmp.has(c.id)) { seenCmp.add(c.id); curComparisons.push(c); }
    }
  }
  // なぜ今この問題か（#10）
  const curRisk = Math.round(riskOf(current, srs) * 100);
  const curSt = normalize(srs[current.id]);
  const overdue = (curSt.due || 0) <= Date.now();
  const curReason = overdue
    ? `期限が来た復習です（忘却リスク ${curRisk}%）。まず自力で思い出してみましょう。`
    : `忘却リスク ${curRisk}% で選ばれました。まず自力で思い出してみましょう。`;
  // 精緻化候補（#2）：この問題の概念とつながる隣接概念
  const curElaborate = elaborationSuggestions(kgraph, conceptsOf(current, links), { limit: 6 });
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
        elaborate={curElaborate}
        whyPrompt
        reason={curReason}
        fast={fast}
        onMissType={onMissType}
        simple={simple}
        missType={latestMissType(missTypes[current.id])?.type || ''}
      />
      <ResetInline label="復習をリセット" onReset={resetReview} />
    </div>
  );
}
