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
import { leechDwellDays, resolvedLeechesSince, reviewDwellByMissType, leechList, leechListToCsv } from '../lib/reviewDwell.js';
import { daysSinceLastZero, zeroDaysSummary } from '../lib/reviewZeroLog.js';
import { loadSnoozeLog, recordSnooze, snoozeCount, isSnoozeHabit, SNOOZE_HABIT_THRESHOLD } from '../lib/snoozeLog.js';
import { estimatedAnswerSeconds } from '../lib/bufferSession.js';
import { keepCasePairsAdjacentObjects } from '../lib/casePairs.js';
import { useMaruReview } from '../lib/useMaruReview.js';
import MaruReviewCard from './MaruReviewCard.jsx';
import { scopeCoverage } from '../data/examScope.js';
import { todayFocusSubjects } from '../lib/todayFocus.js';
import { daysUntil } from '../lib/gamify.js';
import { loadRoundLog, appendRoundLog, previousForTarget, countForTarget, formatDuration, speedupPct } from '../lib/roundLog.js';
import { downloadFile } from '../lib/download.js';

// 出題順（#1 忘れそう順・#5 難問順）と一覧の並べ替え（#8）の選択肢
const ORDER_MODES = [
  { id: 'due', label: '期限が近い順' },
  { id: 'forget', label: '忘れそうな順' },
  { id: 'hard', label: '難問（誤答率）順' },
  { id: 'wrong', label: '誤答が多い順' },
  { id: 'subject', label: '科目順' },
];

// 60問ごとに休憩を挟む（学習と同じ区切り）
const SET_SIZE = 60;

// 周回速度ログ（roundLog.js）は学習（Session.jsx）と同じキーを共有するため、
//   復習の記録だと分かるよう target を 10000 番台にずらして記録する（10→10010等）。
//   混ざると「学習の60問」と「復習の60問」が同じ前回比較に混ざってしまうため。
const toReviewRoundTarget = (batchValue) => 10000 + batchValue;

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

export default function Review({
  store, onToast, onOpenKeyword, onGoAudio, quickStartCount, onConsumeQuickStart,
  onOpenGraphConcept, onOpenFlashcardKeyword, onOpenMnemonicKeyword,
}) {
  const {
    questions, dueReviewQuestions, reviewQuestions, history,
    memos, links, recordAnswer, setMemo, setLink, srs, GRADES,
    bookmarks, toggleBookmark, removeFromReview, setNextDue, session,
    resetAllReviewDue, reviewZeroLog, casePairMap, kwMeta, restoreReviewState,
    examResults, settings,
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
  const [genreSel, setGenreSel] = useState(''); // #7：ジャンルでしぼる
  const [excludeNagame, setExcludeNagame] = useState(false); // #17：念のため確認を除外
  const [pinRiskTop, setPinRiskTop] = useState(false); // #10：忘却リスク上位を表示の先頭に固定
  const [recordedIds, setRecordedIds] = useState([]); // #5：このセッションで実際に記録した問題id
  const [sessionLabel, setSessionLabel] = useState(''); // #4・#30：現在のセッションの種類（見出し・もう一度に使う）
  const [showSnoozed, setShowSnoozed] = useState(false); // #14：先送り中の一覧の折りたたみ
  const [recentlyRemoved, setRecentlyRemoved] = useState([]); // 「リストから外す」の取り消し用（直近5件・端末内メモリのみ）
  const sessionStartRef = useRef(0); // #28：経過時間の起点
  const loggedRoundRef = useRef(0); // 2：同じ回を二重記録しないためのガード
  const [nowTick, setNowTick] = useState(Date.now()); // #28：経過時間表示の更新用
  const [showBreak, setShowBreak] = useState(false); // 4：60問ごとの休憩画面
  const [nagameCap, setNagameCap] = useState(20); // 13：「念のため確認だけ」の対象数（多すぎない範囲に自分で絞れるように）
  const [lastRoundInfo, setLastRoundInfo] = useState(null); // 2：周回速度ログ（標準の復習のみ対象）

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

  // 症例の連問（原問＋「上記症例の続き」）の対応表はstore.casePairMapを使う（useStore.jsが
  //   常に全体のquestionsから導出する単一の正。ここで作り直すと二重計算になる）。
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

  // #2：○にした問題の見直し・高速回転（Session.jsx・Quiz.jsxと同じuseMaruReview.jsを共用）。
  //   対象プールは現在の絞り込み（extendedReviewPool）を引き継ぐ。
  const {
    maruExcludeMastered, setMaruExcludeMastered,
    maruStatusAll, maruUncertainCount, maruStatusFiltered, maruPool,
  } = useMaruReview(extendedReviewPool, history, srs);

  // #9：要注意（リーチ）だけの問題プール（高速周回モード用）。滞留が長いものを先頭に。
  const leechOnlyPool = useMemo(() => {
    const list = extendedReviewPool.filter((q) => isLeech(q));
    return [...list].sort((a, b) => (leechDwellDays(b.id, history) || 0) - (leechDwellDays(a.id, history) || 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extendedReviewPool, srs, history]);

  // #14：先送り（スヌーズ）中の問題id一覧
  const snoozedIds = useMemo(
    () => Object.keys(snoozeLog).filter((id) => snoozeCount(snoozeLog, id) > 0),
    [snoozeLog]
  );

  // 1：今日集中すべき科目の声掛け（Session.jsxと同じtodayFocus.jsを再利用。新しい判定は作らない）
  const focusSubject = useMemo(() => {
    const scope = scopeCoverage(questions, history);
    const picks = todayFocusSubjects(scope, daysUntil(settings.examDate), { questions, limit: 1, examResults });
    return picks[0] || null;
  }, [questions, history, settings.examDate, examResults]);

  // 10：忘却リスクのヒートマップ（科目別・平均リスク）。復習リストにある科目だけを対象にする。
  const riskBySubject = useMemo(() => {
    const stats = {};
    const now = Date.now();
    for (const q of extendedReviewPool) {
      const s = q.subject || 'その他';
      if (!stats[s]) stats[s] = { sum: 0, count: 0 };
      stats[s].sum += riskOf(q, srs, now);
      stats[s].count += 1;
    }
    return Object.entries(stats)
      .map(([subject, v]) => ({ subject, avgRisk: Math.round((v.sum / v.count) * 100), count: v.count }))
      .sort((a, b) => b.avgRisk - a.avgRisk)
      .slice(0, 6);
  }, [extendedReviewPool, srs]);

  // 14：誤答理由（型）×科目のクロス集計（上位のものだけ）
  const missTypeBySubject = useMemo(() => {
    const byId = new Map(questions.map((q) => [q.id, q]));
    const counts = {};
    for (const [qid, entry] of Object.entries(missTypes)) {
      const q = byId.get(qid);
      const type = latestMissType(entry)?.type;
      if (!q || !type) continue;
      const key = `${q.subject || 'その他'}|${type}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([key, count]) => { const [subject, type] = key.split('|'); return { subject, type, count }; })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [questions, missTypes]);

  // 復習リストにある科目の一覧（出題基準の1〜14番順、無いものは末尾に五十音順）
  const subjects = useMemo(() => {
    const present = Array.from(new Set(extendedReviewPool.map((q) => q.subject).filter(Boolean)));
    const ordered = SUBJECT_TAG_NAMES.filter((s) => present.includes(s));
    const extra = present.filter((s) => !SUBJECT_TAG_NAMES.includes(s)).sort((a, b) => a.localeCompare(b, 'ja'));
    return [...ordered, ...extra];
  }, [extendedReviewPool]);
  const toggleSubjectSel = (s) => setSubjectsSel((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  // #7：ジャンルでしぼる（あ〜ん順ではなく出現順のまま。件数が多くないため）
  const genreOptions = useMemo(
    () => Array.from(new Set(extendedReviewPool.map((q) => q.genre).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja')),
    [extendedReviewPool]
  );

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
    subjects: subjectsSel, genre: genreSel, tag: filterTag, term: search, links,
    round, bookmarkOnly, bookmarks, minRisk, minWrong, srs,
    missType: missTypeFilter, missTypes,
  };

  const applyRecent = (qs) => (recentWrongIds ? qs.filter((q) => recentWrongIds.has(q.id)) : qs);
  // #17：「念のため確認」（マスター済みだが保持率が下がってきた問題）を除外し、
  //   本当に期限が来ている（isInReview）問題だけに絞る
  const applyExcludeNagame = (qs) => (excludeNagame ? qs.filter((q) => reviewIdSet.has(q.id)) : qs);
  // #10：忘却リスク上位（70%以上）を、選んだ並び順に関わらず表示の先頭へ固定する
  const applyPinRiskTop = (qs) => {
    if (!pinRiskTop) return qs;
    const hot = qs.filter((q) => riskOf(q, srs) >= 0.7);
    const rest = qs.filter((q) => riskOf(q, srs) < 0.7);
    return [...hot, ...rest];
  };

  // 絞り込み＋並べ替え後のリスト（マスター後の「念のため確認」も対象に含む）
  const shownList = useMemo(() => {
    const filtered = applyExcludeNagame(applyRecent(filterReview(extendedReviewPool, filterOpts)));
    return applyPinRiskTop(sortReview(filtered, orderMode, { srs, history, links }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extendedReviewPool, subjectsSel, genreSel, filterTag, search, round, bookmarkOnly, bookmarks, minRisk, minWrong, missTypeFilter, missTypes, recentWrongIds, excludeNagame, pinRiskTop, orderMode, srs, history, links]);

  // 出題プール：絞り込みがあれば全リストから、無ければ「今日の復習」から。並びは orderMode。
  const filtering = subjectsSel.length > 0 || !!genreSel || !!filterTag || !!search.trim() || !!round || bookmarkOnly || minRisk > 0 || minWrong > 0 || !!missTypeFilter || !!recentOnly;
  const startPool = useMemo(() => {
    const base = filtering ? applyExcludeNagame(applyRecent(filterReview(extendedReviewPool, filterOpts))) : applyExcludeNagame(dueReviewQuestions);
    return applyPinRiskTop(sortReview(base, orderMode, { srs, history, links }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtering, subjectsSel, genreSel, filterTag, search, round, bookmarkOnly, bookmarks, minRisk, minWrong, missTypeFilter, missTypes, recentWrongIds, excludeNagame, pinRiskTop, extendedReviewPool, dueReviewQuestions, orderMode, srs, history, links]);

  // 実際に出題される問数（バッチ上限と在庫の小さい方）
  const effectiveCount = batch > 0 ? Math.min(batch, startPool.length) : startPool.length;

  // #2：過去の解答間隔（bufferSession.jsと同じ推定ロジック）から、今から始めた場合のおおよその所要時間
  const estMinutes = useMemo(() => {
    if (effectiveCount === 0) return 0;
    const secPerQ = estimatedAnswerSeconds(history, 'all');
    return Math.max(1, Math.round((secPerQ * effectiveCount) / 60));
  }, [history, effectiveCount]);

  // pool を出題開始（続けるループ用に任意の配列でも開始できる）。原問と派生は離して出題。
  //   opts.label：セッションの種類（見出し・#4「もう一度」の判定に使う）。
  //   opts.preserveOrder：true の時は原問/派生を離すための並べ替え（バケット分割）をせず、
  //     渡された配列の順序をそのまま使う（○の見直し等、呼び出し側が既に優先順位を決めている場合）。
  //   opts.forcedFast：指定時は高速回転モードのON/OFFをこの値に強制する。
  const startWith = (pool, opts = {}) => {
    if (!pool || pool.length === 0) return;
    missRef.current = [];
    masteredRef.current = [];
    setRecordedIds([]); // #5
    setSessionLabel(opts.label || ''); // #4・#30
    if (opts.forcedFast != null) setFast(opts.forcedFast); // #9
    setShowBreak(false); // 4
    sessionStartRef.current = Date.now(); // #28
    setNowTick(Date.now());
    const ordered = opts.preserveOrder
      ? keepCasePairsAdjacentObjects(pool, casePairMap.linkOf, casePairMap.pairOf)
      : spaceByOrigin(pool, casePairMap.linkOf, casePairMap.pairOf);
    setOrder(ordered);
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
    startWith(batch > 0 ? pool.slice(0, batch) : pool, { label: `弱点「${tag}」` });
  };

  // #8：誤答理由（型）ごとにワンタップで即復習
  const quickStartMissType = (typeId) => {
    const pool = sortReview(filterReview(extendedReviewPool, { missType: typeId, missTypes, links }), orderMode, { srs, history, links });
    startWith(batch > 0 ? pool.slice(0, batch) : pool, { label: `誤答理由「${missTypeLabel(typeId)}」` });
  };

  // #9：要注意（リーチ）だけを高速周回モードで
  const startLeechFast = () => startWith(leechOnlyPool, { label: '要注意だけ高速周回', forcedFast: true, preserveOrder: true });

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
    setSubjectsSel([]); setGenreSel(''); setFilterTag(''); setSearch(''); setRound('');
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
    if (!q) return;
    // #5：「← 前の問題」で解答済みの問題まで戻り、もう一度自己採点しても二重に記録しない
    //   （SRS・履歴・リーチ判定・selfKindCountsの上書きを防ぐ。Session.jsxと同じ考え方）。
    if (recordedIds.includes(q.id)) return;
    const priorStreak = normalize(srs[q.id]).correctStreak || 0;
    const leechEvent = recordAnswer(q, correct, grade, 'review', selfKind); // 復習由来として記録（到達集計用）
    if (leechEvent === 'became') {
      onToast?.(`⚠️ 要注意（${LEECH_THRESHOLD}回以上の誤答）：「${(q.question || '（図の問題）').slice(0, 20)}」。解説の読み方を変えてみましょう`);
    } else if (leechEvent === 'resolved') {
      onToast?.(`✅ 要注意を脱出！「${(q.question || '（図の問題）').slice(0, 20)}」がマスターになりました`);
    }
    // ○（完璧）以外＝不正解・△・✕ は「まだ定着していない」として記憶
    if (!correct) missRef.current.push({ q, selfKind });
    // △✕の累計回数を記録（★弱点タグの判定材料。ここでの選択が起点）
    if (selfKind === 'sankaku' || selfKind === 'batsu') {
      recordSelfKindCount(q.id, selfKind).then(setSelfKindCounts);
    }
    // ちょうど5回連続の○に到達＝マスターの瞬間。その場でお祝いする
    if (correct && priorStreak === MASTER_STREAK - 1) {
      masteredRef.current.push(q);
      onToast?.(`🏆 マスター達成！「${(q.question || '').slice(0, 20)}」`);
    }
    setSessionStats((s) => ({ total: s.total + 1, correct: s.correct + (correct ? 1 : 0) }));
    setRecordedIds((r) => [...r, q.id]);
  };

  // 次の未解答の位置へ進める。「← 前の問題」で戻ってから解答した場合はpos+1へは進めず、
  //   まだ解答していない最初の位置（＝もといた最先端）まで一気に戻す（Session.jsxと同じ形）。
  const handleNext = () => {
    const recorded = new Set(recordedIds);
    let newPos = idx + 1;
    while (newPos < order.length && recorded.has(order[newPos]?.id)) newPos++;
    setIdx(newPos);
    // 4：長い回（60問超）では、学習(Session.jsx)と同じくSET_SIZEごとに休憩を挟む
    if (order.length > SET_SIZE && newPos < order.length && newPos % SET_SIZE === 0) setShowBreak(true);
  };
  // #1：前へ／次へ（見直し用のナビゲーション。完了扱いにならないよう最後の問題より先へは進めない）
  const canGoPrev = idx > 0;
  const canGoNext = idx < order.length - 1;
  const goToPos = (pos) => setIdx(Math.max(0, Math.min(order.length - 1, pos)));

  // #28：出題中の経過時間表示（1秒ごとに更新）
  useEffect(() => {
    if (!started || idx >= order.length) return;
    const iv = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [started, idx, order.length]);

  // 2：周回速度ログ（G-100由来、Session.jsxと同じ仕組みを再利用）。
  //   標準の復習（sessionLabel無し・「すべて」以外）が完了した瞬間に1回だけ記録する。
  useEffect(() => {
    if (!started || idx < order.length) return;
    if (sessionLabel !== '' || batch <= 0) return;
    if (loggedRoundRef.current === sessionStartRef.current) return;
    loggedRoundRef.current = sessionStartRef.current;
    const target = toReviewRoundTarget(batch);
    const ms = Date.now() - sessionStartRef.current;
    const count = order.length;
    const startedAt = sessionStartRef.current;
    loadRoundLog().then((log) => {
      const prev = previousForTarget(log, target, startedAt);
      const roundNo = countForTarget(log, target) + 1;
      setLastRoundInfo({ target, count, ms, prev, roundNo });
      appendRoundLog({ target, count, ms, at: startedAt });
    });
  }, [started, idx, order.length, sessionLabel, batch]);

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

        {/* 1：今日集中すべき科目の声掛け（Session.jsxと同じtodayFocus.jsを再利用） */}
        {focusSubject && (
          <p className="inline-note" style={{ marginBottom: 8 }}>
            🧭 たまには苦手分野の「{focusSubject.subject.name}」の復習にも挑戦してみましょう（{focusSubject.reason}）。
            <button className="btn ghost sm" style={{ marginLeft: 8 }} onClick={() => setSubjectsSel([focusSubject.subject.name])}>この科目にしぼる</button>
          </p>
        )}

        <div className="tiles">
          <div className="tile" title="一度でも間違えた・△✕にした問題の総数（マスター済みは含まない）">
            <div className="num">{reviewQuestions.length}</div>
            <div className="lbl">復習リスト</div>
          </div>
          <div className="tile" title="復習リストのうち、今まさに出題期限が来ている問題の数（「念のため確認」は含まない）">
            <div className="num" style={{ color: dueCount > 0 ? 'var(--wrong)' : 'var(--text)' }}>
              {dueCount}
            </div>
            <div className="lbl">今日の復習</div>
          </div>
          <div className="tile" title="復習リストのうち、完璧が3回以上連続していてマスター（5連続）まであと少しの問題の数">
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
          <button className="btn block lg" style={{ marginBottom: 10 }} onClick={() => startWith(lastSessionMisses, { label: 'さっきの学習の誤答' })}>
            📚 さっきの学習で間違えた{lastSessionMisses.length}問をすぐ復習
          </button>
        )}

        {star3Questions.length > 0 && (
          <button className="btn danger block lg" style={{ marginBottom: 10 }} onClick={() => startWith(star3Questions, { label: `${starLabel(3)} 今日つぶす` })}>
            {starLabel(3)} 今日つぶす（✕2回以上の問題・{star3Questions.length}問）
          </button>
        )}

        {/* #9：要注意（リーチ）だけを高速周回で一気に片づける */}
        {leechOnlyPool.length > 0 && (
          <button className="btn danger block lg" style={{ marginBottom: 10 }} onClick={startLeechFast}>
            ⚠️ 要注意だけ高速周回（{LEECH_THRESHOLD}回以上の誤答・{leechOnlyPool.length}問）
          </button>
        )}

        {/* #14：先送り（スヌーズ）中の問題をまとめて解除できるようにする */}
        {snoozedIds.length > 0 && (
          <div className="card" style={{ marginBottom: 10 }}>
            <button
              className="section-label"
              style={{ marginTop: 0, border: 'none', background: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', width: '100%' }}
              onClick={() => setShowSnoozed((v) => !v)}
            >
              😴 先送り中の問題（{snoozedIds.length}問）{showSnoozed ? ' ▲' : ' ▼'}
            </button>
            {showSnoozed && (
              <>
                <ul className="genre-stats">
                  {snoozedIds.slice(0, 20).map((id) => {
                    const q = questions.find((x) => x.id === id);
                    return (
                      <li key={id}>
                        <span className="gs-name">{q ? (q.question || '（図の問題）').slice(0, 24) : id}</span>
                        <span className="gs-num">{snoozeCount(snoozeLog, id)}回先送り</span>
                      </li>
                    );
                  })}
                </ul>
                {snoozedIds.length > 20 && <p className="inline-note">ほか{snoozedIds.length - 20}件</p>}
              </>
            )}
            <button
              className="btn ghost sm"
              style={{ marginTop: 8 }}
              onClick={() => {
                for (const id of snoozedIds) setNextDue(id, 0);
                onToast?.('😴 先送りをすべて解除しました（今すぐ復習対象に戻しました）');
              }}
            >
              まとめて解除（今すぐ復習対象に戻す）
            </button>
          </div>
        )}

        {/* #2：○にした問題の見直し・高速回転（Session.jsx・Quiz.jsxと同じMaruReviewCard.jsxを共用） */}
        <MaruReviewCard
          maruStatusAll={maruStatusAll}
          maruUncertainCount={maruUncertainCount}
          maruExcludeMastered={maruExcludeMastered}
          setMaruExcludeMastered={setMaruExcludeMastered}
          maruStatusFiltered={maruStatusFiltered}
          maruPool={maruPool}
          onStartReview={(pool) => startWith(pool, { label: '○の見直し', preserveOrder: true })}
          onStartFast={(pool) => startWith(pool, { label: '○の高速回転', forcedFast: true, preserveOrder: true })}
        />

        {/* 前進感：あと1問でマスター／延べ回数／マスター累計／週間の復習量（タップで月間に拡大） */}
        {reviewQuestions.length > 0 && (
          <div className="progress-hint">
            <span title="完璧が4連続まで進んでいて、あと1回○を出せばマスター（5連続○）になる問題の数">
              🎯 あと1問でマスター <strong>{nearMaster}</strong> 件
            </span>
            ・
            <span title="復習リストの全問題について「あと何回○を積み重ねればマスターに届くか」を合計した数（1問あたり最大5回）">
              マスターまで延べ <strong>{toMasterTotal}</strong> 回
            </span>
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

        {/* 17：要注意リストのCSV書き出し */}
        {leechOnlyPool.length > 0 && (
          <button
            className="btn ghost sm"
            style={{ marginBottom: 10, marginLeft: 8 }}
            onClick={() => downloadFile(leechListToCsv(leechList(questions, srs, history)), 'shinkyu_leech_list.csv', 'text/csv')}
          >
            📤 要注意リストをCSVで書き出す（{leechOnlyPool.length}問）
          </button>
        )}

        {/* 11：要注意問題をまとめてブックマーク */}
        {leechOnlyPool.some((q) => !bookmarks[q.id]) && (
          <button
            className="btn ghost sm"
            style={{ marginBottom: 10, marginLeft: 8 }}
            onClick={() => {
              let n = 0;
              for (const q of leechOnlyPool) if (!bookmarks[q.id]) { toggleBookmark(q.id); n += 1; }
              onToast?.(`★ 要注意の問題${n}件をブックマークしました`);
            }}
          >
            ★ 要注意をまとめてブックマーク
          </button>
        )}

        {masterySubjectStats.length > 0 && (
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="section-label" style={{ marginTop: 0 }}>科目別マスター率</div>
            <ul className="genre-stats">
              {masterySubjectStats.map((s) => {
                const p = Math.round(s.rate * 100);
                // まだ1問もマスターしていない科目は、圧迫感のある0%バーではなく
                // 「未着手」（グレー）で示す（積み上げがまだ無いだけで、悪い数字ではないため）。
                const untouched = s.mastered === 0;
                return (
                  <li key={s.subject}>
                    <span className="gs-name">{s.subject}</span>
                    <span className="gs-bar">
                      <i style={{ width: untouched ? '100%' : `${p}%`, background: untouched ? 'var(--border)' : p < 40 ? 'var(--wrong)' : p < 80 ? 'var(--warn)' : 'var(--correct)' }} />
                    </span>
                    <span className="gs-num">{untouched ? `未着手（0/${s.total}）` : `${p}%（${s.mastered}/${s.total}）`}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* 10：忘却リスクのヒートマップ（科目別平均） */}
        {riskBySubject.length > 0 && (
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="section-label" style={{ marginTop: 0 }}>科目別 忘却リスク（高い順）</div>
            <ul className="genre-stats">
              {riskBySubject.map((s) => (
                <li key={s.subject}>
                  <span className="gs-name">{s.subject}</span>
                  <span className="gs-bar">
                    <i style={{ width: `${s.avgRisk}%`, background: s.avgRisk >= 70 ? 'var(--wrong)' : s.avgRisk >= 40 ? 'var(--warn)' : 'var(--correct)' }} />
                  </span>
                  <span className="gs-num">平均{s.avgRisk}%（{s.count}問）</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 14：誤答理由（型）×科目のクロス集計 */}
        {missTypeBySubject.length > 0 && (
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="section-label" style={{ marginTop: 0 }}>誤答理由×科目（多い順）</div>
            <ul className="genre-stats">
              {missTypeBySubject.map((r) => (
                <li key={`${r.subject}|${r.type}`}>
                  <span className="gs-name">{r.subject}・{missTypeLabel(r.type)}</span>
                  <span className="gs-num">{r.count}件</span>
                </li>
              ))}
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
            {/* #11：リングだけでなく学習（Session.jsx）と同じ形の進捗バーも表示する */}
            <div className="progress" style={{ marginTop: 4 }}>
              <span style={{ width: `${goalPct}%` }} />
            </div>
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
                      <i className="weak-dot" />{w.tag} <b>誤答{w.wrong}／{w.attempts}</b>
                      {w.trend === 'better' && <span style={{ color: 'var(--correct)' }}> ↓改善</span>}
                      {w.trend === 'worse' && <span style={{ color: 'var(--wrong)' }}> ↑悪化</span>}
                    </button>
                    <button className="weak-chip-go" onClick={() => quickStartTag(w.tag)} aria-label={`${w.tag}を即復習`}>▶</button>
                  </span>
                );
              })}
            </div>
            {/* #18・#25：登録済みの語呂合わせがあればその場で表示、無ければ登録ボタン */}
            {weakTagsWithTrend.map((w) => (
              kwMeta?.[w.tag]?.mnemonic ? (
                <p key={`mn-${w.tag}`} className="inline-note" style={{ marginTop: 4 }}>
                  📔 {w.tag}：{kwMeta[w.tag].mnemonic}
                </p>
              ) : onOpenMnemonicKeyword ? (
                <button key={`mn-${w.tag}`} className="btn ghost sm" style={{ marginTop: 4, marginRight: 6 }} onClick={() => onOpenMnemonicKeyword(w.tag)}>
                  📔 「{w.tag}」の語呂合わせを登録
                </button>
              ) : null
            ))}
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
            <span>ジャンル</span>
            <select value={genreSel} onChange={(e) => setGenreSel(e.target.value)} disabled={genreOptions.length === 0}>
              <option value="">指定なし</option>
              {genreOptions.map((g) => (<option key={g} value={g}>{g}</option>))}
            </select>
          </label>
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
        <label className="autokw-row" style={{ marginTop: 6 }}>
          <input type="checkbox" checked={excludeNagame} onChange={(e) => setExcludeNagame(e.target.checked)} />
          <span>🔎 「念のため確認」（保持率が下がったマスター済み）を除外し、本当の期限切れだけにする</span>
        </label>
        <label className="autokw-row" style={{ marginTop: 6 }}>
          <input type="checkbox" checked={pinRiskTop} onChange={(e) => setPinRiskTop(e.target.checked)} />
          <span>📌 忘却リスク70%以上を、選んだ並び順に関わらず一覧の先頭に固定する</span>
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
          <span className="section-hint">誤答理由の型で集中特訓（▶で即復習）：</span>
          <button className={`chip ${missTypeFilter === '' ? 'active' : ''}`} onClick={() => setMissTypeFilter('')}>指定なし</button>
          {MISS_TYPES.map((t) => (
            <span key={t.id} className={`weak-chip ${missTypeFilter === t.id ? 'active' : ''}`}>
              <button
                className="weak-chip-label"
                onClick={() => setMissTypeFilter(missTypeFilter === t.id ? '' : t.id)}
              >
                {t.label}
              </button>
              <button className="weak-chip-go" onClick={() => quickStartMissType(t.id)} aria-label={`${t.label}を即復習`}>▶</button>
            </span>
          ))}
        </div>
        {(missTrend || missAnomaly?.isAnomaly) && (
          <p className="inline-note" style={{ marginTop: 6 }}>
            {missAnomaly?.isAnomaly && <>今日は誤答理由を記録した件数が{missAnomaly.todayTotal}件と、直近の1日平均（約{missAnomaly.avgPerDay}件・誤答理由ボタンで分類した分のみ）よりかなり多めです。無理せず休憩も挟みましょう。<br /></>}
            {missTrend && <>最近は「{missTypeLabel(missTrend.type)}」が増えています（直近7日で{missTrend.count}件）。{missTrend.type === 'careless' ? '落ち着いて設問を最後まで読みましょう。' : missTrend.type === 'chishiki' ? '解説を読み込む時間を作りましょう。' : '対比で整理してみましょう。'}</>}
          </p>
        )}

        <div className="review-count">
          この条件で <strong>{startPool.length}</strong> 問
          {filtering && <button className="btn ghost sm" onClick={clearFilters}>クリア</button>}
        </div>

        {/* ===== 1回の問題数（10・60・300・900・すべて） ===== */}
        <div className="section-label" style={{ marginTop: 4 }}>
          1回の問題数
          <button
            className="btn ghost sm"
            style={{ float: 'right' }}
            onClick={() => {
              // 6：今のこの条件の在庫（startPool.length）に対して無理のない問数を提案する
              const n = startPool.length;
              const rec = REVIEW_TARGETS.filter((t) => t.n > 0).find((t) => n <= t.n) || REVIEW_TARGETS[REVIEW_TARGETS.length - 1];
              setBatch(rec.n);
              onToast?.(`🎯 この条件の在庫（${n}問）から「${rec.label}」をおすすめします`);
            }}
          >
            🎯 今日のおすすめ
          </button>
        </div>
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
            ⏱ 今から始めると、約{estMinutes}分でこの{effectiveCount}問を片づけられます（過去の解答ペースからの目安）。
          </p>
        )}
        <button className="btn primary block lg" style={{ marginTop: 6 }} onClick={start} disabled={startPool.length === 0}>
          {startPool.length > 0
            ? `📝 一問一答で復習（${effectiveCount}問・${ORDER_MODES.find((m) => m.id === orderMode)?.label}）`
            : (filtering ? '条件に合う問題がありません' : '今日の復習は完了しました')}
        </button>
        {/* #16：今日の期限は無いが「念のため確認」枠だけはある日でも、何かやることがある状態にする */}
        {!filtering && dueReviewQuestions.length === 0 && nagameQuestions.length > 0 && (
          <>
            <button
              className="btn block lg"
              style={{ marginTop: 10 }}
              onClick={() => startWith(sortReview(nagameQuestions, orderMode, { srs, history, links }).slice(0, nagameCap), { label: '念のため確認' })}
            >
              🔎 念のため確認だけ（最大{Math.min(nagameCap, nagameQuestions.length)}問・全{nagameQuestions.length}問中）
            </button>
            {/* 13：一度に多すぎる数を出さないよう、対象数を自分で絞れるように */}
            <div className="field" style={{ marginTop: 6, marginBottom: 0 }}>
              <label>念のため確認の対象数（最大 {nagameCap} 問）</label>
              <input type="range" min="5" max="50" step="5" value={nagameCap} onChange={(e) => setNagameCap(Number(e.target.value))} />
            </div>
          </>
        )}

        {/* 12：しんどい日でも0にはしない、最小構成の一手 */}
        {dueReviewQuestions.length > 5 && (
          <button
            className="btn ghost block"
            style={{ marginTop: 10 }}
            onClick={() => startWith(sortReview(dueReviewQuestions, 'forget', { srs, history, links }).slice(0, 5), { label: '今日は少しだけ' })}
          >
            🩹 今日は少しだけ（忘却リスク上位5問）
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

        {/* 「取り消し」：リストから外した直後だけ、その場で元に戻せるようにする */}
        {recentlyRemoved.length > 0 && (
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="section-label" style={{ marginTop: 0 }}>🗑 最近リストから外した問題</div>
            <ul className="genre-stats">
              {recentlyRemoved.map((r) => (
                <li key={r.id}>
                  <span className="gs-name">{(r.question || '（図の問題）').slice(0, 24)}</span>
                  <button
                    className="btn ghost sm"
                    onClick={() => {
                      restoreReviewState(r.id, r.prevState);
                      setRecentlyRemoved((list) => list.filter((x) => x.id !== r.id));
                      onToast?.('↩️ 復習リストに戻しました');
                    }}
                  >
                    ↩️ 元に戻す
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* バッジの色の凡例（何を基準に色分けされているか分からない、という指摘への対応） */}
        <p className="inline-note" style={{ marginTop: 0 }}>
          バッジの色：<span className="risk-badge lv-hot" style={{ marginRight: 4 }}>赤</span>=要注意・高リスク
          <span className="risk-badge lv-warm" style={{ marginRight: 4 }}>黄</span>=中程度
          <span className="risk-badge lv-mild">グレー</span>=軽め
        </p>

        <div className="section-label" style={{ marginTop: 0 }}>
          {(filtering || excludeNagame) ? '絞り込み結果の一覧' : '対象の問題一覧'}（{shownList.length}）
          {!filtering && !excludeNagame && nagameQuestions.length > 0 && (
            <span className="section-hint">
              　※内訳：復習リスト{reviewQuestions.length}件＋念のため確認{nagameQuestions.length}件
            </span>
          )}
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
                <span className={`badge ${q.type === 'ox' ? 'ox' : 'choice'}`}>{q.type === 'ox' ? '○×' : '四択'}</span>
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
              {/* 18：登録済みの語呂合わせがあればその場表示、無ければ登録ボタン（弱点タグと同じ発想を一覧全体へ） */}
              {(() => {
                const term = effectiveTags(q, links)[0];
                if (!term) return null;
                return kwMeta?.[term]?.mnemonic ? (
                  <p className="inline-note" style={{ marginTop: 4 }}>📔 {term}：{kwMeta[term].mnemonic}</p>
                ) : onOpenMnemonicKeyword ? (
                  <button className="btn ghost sm" style={{ marginTop: 4 }} onClick={() => onOpenMnemonicKeyword(term)}>
                    📔 「{term}」の語呂合わせを登録
                  </button>
                ) : null;
              })()}
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
                <button
                  className="btn ghost sm"
                  onClick={() => {
                    const prevState = srs[q.id];
                    removeFromReview(q.id);
                    setRecentlyRemoved((list) => [{ id: q.id, question: q.question, prevState }, ...list].slice(0, 5));
                    onToast?.('🗑 リストから外しました（下の「元に戻す」から取り消せます）');
                  }}
                >
                  🗑 リストから外す
                </button>
                {/* 19：出題中だけでなく、一覧からも知識グラフ・フラッシュカードへ飛べるように */}
                {onOpenGraphConcept && conceptsOf(q, links)[0] && (
                  <button className="btn ghost sm" onClick={() => onOpenGraphConcept(conceptsOf(q, links)[0])}>🕸️ 知識グラフで見る</button>
                )}
                {onOpenFlashcardKeyword && effectiveTags(q, links)[0] && (
                  <button className="btn ghost sm" onClick={() => onOpenFlashcardKeyword(effectiveTags(q, links)[0])}>🃏 カードで見る</button>
                )}
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
    // #15：今週すでに解消できた要注意（リーチ）の件数
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const resolvedThisWeek = resolvedLeechesSince(history, weekAgo);
    // 8：先週との比較（解消できた要注意の件数トレンド）
    const resolvedLastWeek = resolvedLeechesSince(history, twoWeeksAgo) - resolvedThisWeek;
    // #16：誤答理由（型）ごとの平均滞留日数（まだ復習対象のまま残っている問題）
    const dwellByType = reviewDwellByMissType(questions, srs, history, missTypes);
    // 9：誤答理由（型）で絞り込んだセッションだけ、その型の正答率が今回どう変わったかを見せる
    const missTypeSessionMatch = sessionLabel.match(/^誤答理由「(.+)」$/);
    const sessionMissTypeId = missTypeSessionMatch ? MISS_TYPES.find((t) => t.label === missTypeSessionMatch[1])?.id : null;
    let missTypeAccuracyNote = null;
    if (sessionMissTypeId) {
      const idsOfType = new Set(
        questions.filter((q) => latestMissType(missTypes[q.id])?.type === sessionMissTypeId).map((q) => q.id)
      );
      let beforeTotal = 0, beforeCorrect = 0;
      for (const h of history) {
        if (idsOfType.has(h.questionId) && h.at < sessionStartRef.current) {
          beforeTotal += 1;
          if (h.correct) beforeCorrect += 1;
        }
      }
      if (beforeTotal >= 3) {
        missTypeAccuracyNote = { beforeRate: Math.round((beforeCorrect / beforeTotal) * 100), afterRate: rate };
      }
    }
    return (
      <div className="view">
        {/* #30：学習（Session.jsx）と同じく、セッションの種類を見出しに出す */}
        <h2 className="view-title">{sessionLabel ? `${sessionLabel} 完了！` : '復習完了'}</h2>
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
          {/* 2：周回速度ログ（標準の復習のみ・G-100と同じ表示） */}
          {sessionLabel === '' && lastRoundInfo && lastRoundInfo.target === toReviewRoundTarget(batch) && (
            <p className="inline-note" style={{ marginBottom: 8 }}>
              🔁 通算{lastRoundInfo.roundNo}回目（{lastRoundInfo.count}問）・⏱ 所要時間 {formatDuration(lastRoundInfo.ms)}
              {lastRoundInfo.prev && (() => {
                const pct = speedupPct(lastRoundInfo.ms, lastRoundInfo.count, lastRoundInfo.prev.ms, lastRoundInfo.prev.count);
                if (pct == null) return null;
                return pct > 0
                  ? `（前回より1問あたり${pct}%短縮）`
                  : pct < 0
                  ? `（前回より1問あたり${Math.abs(pct)}%遅くなっています）`
                  : `（前回とほぼ同じペース）`;
              })()}
            </p>
          )}
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
                <button className="btn primary" onClick={() => startWith(misses, { label: sessionLabel })}>
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
                🏠 終了する
              </button>
            </>
          )}
          {/* #4：もう一度、今と同じ問題・同じ順で（○の見直し等は優先順位を保つため再計算しない） */}
          {order.length > 0 && (
            <button
              className="btn ghost"
              style={{ marginTop: 10 }}
              onClick={() => startWith(order, { label: sessionLabel, forcedFast: fast, preserveOrder: true })}
            >
              🔁 もう一度（同じ{order.length}問・同じ順）
            </button>
          )}
          {/* 3：○の見直し等（優先順位が意味を持つセッション）以外は、今の絞り込み・最新のsrsで新しく組み直せるようにする */}
          {sessionLabel !== '○の見直し' && sessionLabel !== '○の高速回転' && startPool.length > 0 && (
            <button
              className="btn ghost"
              style={{ marginTop: 10 }}
              onClick={() => startWith(batch > 0 ? startPool.slice(0, batch) : startPool, { label: sessionLabel })}
            >
              🔀 もう一度（新しく組み直す・今の条件で{startPool.length}問中）
            </button>
          )}
          {chainPool.length > 0 && (
            <button className="btn block" style={{ marginTop: 10 }} onClick={() => startWith(chainPool, { label: '関連チェイン' })}>
              🔗 関連をたどって続ける（{chainPool.length}問）
            </button>
          )}
          {/* 15：間違えた分だけ、その場で音声学習に切り替えて聞き直す */}
          {misses.length > 0 && onGoAudio && (
            <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => onGoAudio(misses.map((q) => q.id))}>
              🔊 間違えた{misses.length}問だけ音声で聞き直す
            </button>
          )}
          {/* 20：要注意だけ高速周回のあと、今日の期限が残っていればそのまま続けられるようにする */}
          {sessionLabel === '要注意だけ高速周回' && dueReviewQuestions.length > 0 && (
            <button className="btn primary block" style={{ marginTop: 10 }} onClick={() => startWith(dueReviewQuestions)}>
              ▶ 続けて今日の復習へ（{dueReviewQuestions.length}問）
            </button>
          )}
        </div>

        {/* #12・#15・#16・8・9：誤答理由の傾向・要注意の解消（先週比）・型別の滞留日数・型の正答率変化 */}
        {(missTrend || resolvedThisWeek > 0 || resolvedLastWeek > 0 || dwellByType.length > 0 || missTypeAccuracyNote) && (
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>誤答理由・要注意の状況</div>
            {missTrend && (
              <p className="inline-note" style={{ marginTop: 0 }}>
                最近は「{missTypeLabel(missTrend.type)}」が増えています（直近7日で{missTrend.count}件）。
              </p>
            )}
            {(resolvedThisWeek > 0 || resolvedLastWeek > 0) && (
              <p className="inline-note" style={{ marginTop: 0, color: 'var(--correct)' }}>
                ✅ 今週、要注意から解消できた問題：<strong>{resolvedThisWeek}問</strong>
                {resolvedLastWeek > 0 && <>（先週は{resolvedLastWeek}問）</>}
              </p>
            )}
            {missTypeAccuracyNote && (
              <p className="inline-note" style={{ marginTop: 0 }}>
                「{missTypeSessionMatch[1]}」の正答率：これまで約{missTypeAccuracyNote.beforeRate}% → 今回{missTypeAccuracyNote.afterRate}%
                {missTypeAccuracyNote.afterRate > missTypeAccuracyNote.beforeRate ? '（改善しています）' : missTypeAccuracyNote.afterRate < missTypeAccuracyNote.beforeRate ? '（今回は苦戦しました）' : ''}
              </p>
            )}
            {dwellByType.length > 0 && (
              <ul className="genre-stats">
                {dwellByType.map((d) => (
                  <li key={d.type}>
                    <span className="gs-name">{missTypeLabel(d.type)}</span>
                    <span className="gs-num">平均{d.avgDays}日滞留（{d.count}問）</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

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
                  <span className="wl-ans">{q.type === 'ox' ? `正解 ${q.answer === 0 ? '○' : '✕'}` : `正解 ${q.answer + 1}`}</span>
                  <span className="wl-q">{q.question}</span>
                  {/* 16：この問題に自分のメモが登録済みならその場で見せる */}
                  {memos[q.id] && <div className="li-memo">📝 {memos[q.id]}</div>}
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
            {/* 7：弱点テーマ・要注意からも、明日の最初の1タスクの候補を出す */}
            {weakTagsWithTrend[0] && (
              <button className="chip" onClick={() => setNextTaskInput(`弱点「${weakTagsWithTrend[0].tag}」を復習する`)}>
                弱点「{weakTagsWithTrend[0].tag}」を復習する
              </button>
            )}
            {leechOnlyPool.length > 0 && (
              <button className="chip" onClick={() => setNextTaskInput(`要注意の問題を${Math.min(leechOnlyPool.length, 10)}問だけ高速周回する`)}>
                要注意を{Math.min(leechOnlyPool.length, 10)}問だけ高速周回する
              </button>
            )}
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

  // ---- 休憩（60問ごと） ----
  if (showBreak) {
    return (
      <div className="view">
        <div className="card sess-break">
          <div className="sess-done-ico">☕</div>
          <h2>ひと区切り（{idx}問）</h2>
          <p className="view-desc" style={{ textAlign: 'center' }}>よく集中できました。少し休むと定着します。</p>
          <div className="sess-break-actions">
            <button className="btn primary block lg" onClick={() => setShowBreak(false)}>▶ 続ける（次の{SET_SIZE}問）</button>
            <button className="btn ghost block" onClick={() => { setStarted(false); setShowBreak(false); }}>
              終了して後で続ける（自動保存済み）
            </button>
          </div>
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
  // #5：「← 前の問題」で戻って見直し中か（記録は上書きされない旨を伝える）
  const isReviewingAnswered = recordedIds.includes(current.id);
  // #28：経過時間（分:秒）
  const elapsedMs = sessionStartRef.current ? Math.max(0, nowTick - sessionStartRef.current) : 0;
  const elapsedLabel = `${Math.floor(elapsedMs / 60000)}:${String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, '0')}`;
  const curConcept = conceptsOf(current, links)[0];
  return (
    <div className="view">
      <div className="exam-timer">
        <span className="count">🔁 復習モード{fast ? ' ⚡' : ''}{sessionLabel && `・${sessionLabel}`}</span>
        <span className="count">⏱ {elapsedLabel}</span>
        <span className="count">
          {idx + 1} / {order.length}
        </span>
      </div>
      <div className="progress">
        <span style={{ width: `${((idx + 1) / order.length) * 100}%` }} />
      </div>
      {/* #1：前へ／次へ（見直し用のナビゲーション） */}
      <div className="btn-row" style={{ justifyContent: 'center', gap: 10, margin: '6px 0' }}>
        <button className="btn ghost sm" onClick={() => goToPos(idx - 1)} disabled={!canGoPrev}>← 前の問題</button>
        <button className="btn ghost sm" onClick={() => goToPos(idx + 1)} disabled={!canGoNext}>次の問題 →</button>
      </div>
      {isReviewingAnswered && (
        <p className="inline-note" style={{ textAlign: 'center' }}>
          📝 この問題はすでに解答済みです（見直し用に表示中。もう一度答えても記録は上書きされません）
        </p>
      )}

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
      {/* #26・#27：知識グラフ・フラッシュカードへの相互リンク */}
      <div className="btn-row" style={{ marginTop: 8 }}>
        {onOpenGraphConcept && curConcept && (
          <button className="btn ghost sm" onClick={() => onOpenGraphConcept(curConcept)}>🕸️ 知識グラフで見る</button>
        )}
        {onOpenFlashcardKeyword && curTags[0] && (
          <button className="btn ghost sm" onClick={() => onOpenFlashcardKeyword(curTags[0])}>🃏 カードで見る</button>
        )}
      </div>
      {/* #13：一時停止（1問ごとの自動保存を利用し、開始画面の「前回の続きから」で再開できる） */}
      <button className="btn ghost sm block" style={{ marginTop: 10 }} onClick={() => setStarted(false)}>
        ⏸ 一時停止して後で続ける（自動保存済み）
      </button>
      <ResetInline label="復習をリセット" onReset={resetReview} />
    </div>
  );
}
