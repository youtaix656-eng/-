import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { isSpeechSupported, loadVoices, speak, cancelSpeech } from '../lib/speech.js';
import * as storage from '../lib/storage.js';
import * as engine from '../lib/audioEngine.js';
import { useAudioEngine } from '../lib/audioEngine.js';
import { VOICE_PRESETS, resolveVoiceURI, presetById } from '../data/voices.js';
import { effectiveTags, shuffle } from '../lib/query.js';
import { dateKey } from '../lib/connect.js';
import { SUBJECT_TAG_NAMES } from '../data/examScope.js';
import { useMindmapData } from '../lib/mindmapDataLoader.js';
import { buildKanaIndex, foldKana, TERM_READINGS } from '../lib/yomi.js';
import { useSpeechText } from '../lib/speechTextLoader.js';

const SpeechStyleCard = lazy(() => import('./SpeechStyleCard.jsx'));
const ReadingDictTools = lazy(() => import('./SpeechStyleCard.jsx').then((m) => ({ default: m.ReadingDictTools })));
import { reviewPoolFor, buildWeaknessSummary, weaknessSummaryToText, recommendNewPct } from '../lib/reviewPool.js';
import { studyStreak, subjectBalanceWarning, formatPercent, getSubjects } from '../lib/stats.js';
import { normalize, MASTER_STREAK, isLeech as isLeechState, GRADES } from '../lib/srs.js';
import { riskOf } from '../lib/reviewOrder.js';
import { SESSION_TARGETS, sessionTargetLabel, estimateAudioSeconds, formatEstimateMinutes } from '../lib/sessionTargets.js';
import { loadTodayMood } from '../lib/mood.js';
import { detectBrokenYesterday, loadStreakBreakLog, breakReasonLabel } from '../lib/streakBreak.js';
import { roundKey, formatRound, isSameRound } from '../lib/round.js';
import { beep, vibrate } from '../lib/sound.js';
import { isVoiceCommandSupported, parseVoiceCommand, listenOnce } from '../lib/voiceCommand.js';
import { detectHeadphoneHint } from '../lib/headphones.js';
import {
  loadAudioReviewLog, recordAudioReviewStart, recordAudioReviewFinish,
  completionRateByTarget, completionRateBySubject, topCombos, recentCombo, previousFinish, logToCsv,
} from '../lib/audioReviewLog.js';
import { latestMissType, missTypeLabel, MISS_TYPES } from '../lib/missTypes.js';
import { useMissTypeHandling } from '../lib/useMissTypeHandling.js';
import { loadSelfKindCounts, recordSelfKindCount } from '../lib/starWeak.js';
import { useMaruReview } from '../lib/useMaruReview.js';
import MaruReviewCard from './MaruReviewCard.jsx';
import ResetControl from './ResetControl.jsx';
import { isNowBestTime } from '../lib/timeOfDay.js';
import { buildCaseLinkMap, keepCasePairsAdjacentObjects } from '../lib/casePairs.js';
import { weakTagClusters } from '../lib/weakClusters.js';
import { roundRobinMerge, buildNewOnlyOrder, buildReviewOnlyOrder, buildMixedNoRepeatOrder } from '../lib/sessionOrder.js';
import { loadReviewZeroLog, daysSinceLastZero } from '../lib/reviewZeroLog.js';
import { loadRoundLog, appendRoundLog, previousForTarget, countForTarget, formatDuration, speedupPct } from '../lib/roundLog.js';
import { loadNextTask, saveNextTask } from '../lib/nextTask.js';
import { buildGenreBreakdown } from '../lib/genreBreakdown.js';
import { LEECH_THRESHOLD } from '../lib/srs.js';
import BreakTimer from './BreakTimer.jsx';
import ManagerReview from './ManagerReview.jsx';
import { recordAudioHistory, resolveJumpIndex, deleteAudioHistory, historyKeyOf, reviewReplayIds, loadAudioHistory, setCurrentAudioContext } from '../lib/audioPlayHistory.js';
import { clearAudioProgressSync, loadAudioProgressSync, saveAudioProgressSync, idsSignature, newerProgress } from '../lib/audioProgressSync.js';
import { resolveBufferUsage, bufferUsageLabel, planStudySession, DEFAULT_BASE_RATIO, estimatedAnswerSeconds } from '../lib/bufferSession.js';
import BufferPlanCard from './BufferPlanCard.jsx';
import { harioBufferEncourage, harioBaseTaskReminder } from '../data/haripan.js';
import { dailyForgettingPick } from '../lib/forgetting.js';
import { todayFocusSubjects } from '../lib/todayFocus.js';
import { scopeCoverage } from '../data/examScope.js';
import { daysUntil } from '../lib/gamify.js';
import { loadSnoozeLog, snoozeCount } from '../lib/snoozeLog.js';
import { loadContentSeedLog, recentlyAddedIds } from '../lib/contentSeedLog.js';
import { conceptsOf } from '../lib/concepts.js';
import { downloadFile } from '../lib/download.js';
import { loadLaterLookup, addLaterLookup, removeLaterLookup } from '../lib/laterLookup.js';
import { loadPronunciationReportLog, appendPronunciationReportLog } from '../lib/pronunciationReportLog.js';
import { recordRephrase } from '../lib/rephraseLog.js';
import { setBreakResumePending, clearBreakResumePending, loadBreakResumePending } from '../lib/audioBreakResumeFlag.js';
import { BODY_LOCATION_SETS } from '../data/bodyLocationMethod.js';
import { useKeiketsuCards } from '../lib/keiketsuCardsLoader.js';
import { resolveDailySubjectIndex, subjectAt, subjectWrongPool } from '../lib/audioDailySubject.js';
import { CONFUSING_PAIRS } from '../lib/confusingPairsChecklist.js';
import { findIfThenScenario } from '../lib/ifThenScenarios.js';
import { readingOrderHintFor } from '../lib/subjectReadingTemplates.js';
import { phaseForDate } from '../data/roadmapPhases.js';
import { EXAM_BLUEPRINT_AM, EXAM_BLUEPRINT_PM } from '../data/examBlueprint.js';
import { buildBlueprintExam } from '../lib/examBuilder.js';
import { recordVoiceAnswerMiss } from '../lib/voiceAnswerLog.js';

// #7 二重符号化（Dual Coding）：問題文の中の自分のキーワード（curTags）だけを
// 白地に黒の反転表示にする。聴覚（読み上げ）＋視覚（強調表示）の二重の符号化を狙う。
// 長いタグから先に当てる（短いタグが先だと長いタグの一部だけ光って不自然になるため）。
function highlightKeywordsInText(text, tags) {
  if (!text || !Array.isArray(tags) || !tags.length) return text;
  const uniq = Array.from(new Set(tags.filter((t) => t && t.length >= 2))).sort((a, b) => b.length - a.length);
  if (!uniq.length) return text;
  let segments = [{ text, hl: false }];
  for (const tag of uniq) {
    const next = [];
    for (const seg of segments) {
      if (seg.hl) { next.push(seg); continue; }
      const parts = seg.text.split(tag);
      if (parts.length === 1) { next.push(seg); continue; }
      parts.forEach((p, i) => {
        if (p) next.push({ text: p, hl: false });
        if (i < parts.length - 1) next.push({ text: tag, hl: true });
      });
    }
    segments = next;
  }
  return segments.map((seg, i) => (seg.hl ? <mark key={i} className="kw-mark">{seg.text}</mark> : seg.text));
}

// C5・C6：声で解答モード向けの表記ゆれ対応（カタカナ/ひらがな・句読点・大小文字を吸収する
// 簡易正規化）。foldKana（yomi.js）は1文字単位のため、文字列全体に適用してから
// 記号を落とす。厳密な音韻比較ではないことを明記しておく。
function normalizeForMatch(s) {
  return (s || '')
    .split('')
    .map(foldKana)
    .join('')
    .replace(/[\s、。・「」『』,.!?！？\-ー〜]/g, '')
    .toLowerCase();
}
// C7：完全一致（match）／惜しい（close、正解の文字の6割以上が聞き取り結果に含まれる）／
// 当たらない（none）の3段階。「惜しい」だけ、もう一度言い直すチャンスを与える。
function voiceMatchLevel(heard, target) {
  const h = normalizeForMatch(heard);
  const t = normalizeForMatch(target);
  if (!h || !t) return 'none';
  // 聞き取りが正解を含む時だけ一致。以前は「正解が聞き取りを含む」でも一致にしていたため、
  // 「足」「の」のように1〜2文字しか聞き取れなかっただけで、正解の一部なら自動で○になっていた。
  // 正解の一部しか言えていない時は「惜しい」として言い直しの機会を出す（8割以上言えていれば一致）。
  if (h.includes(t)) return 'match';
  if (t.includes(h) && h.length >= Math.max(2, Math.ceil(t.length * 0.8))) return 'match';
  const tChars = Array.from(new Set(t.split('')));
  const hitCount = tChars.filter((c) => h.includes(c)).length;
  if (tChars.length > 0 && hitCount / tChars.length >= 0.6) return 'close';
  return 'none';
}

// 四択（選択肢が3つ以上ある、○×でない問題）。画面に選択肢を出し、問題を読んだあと3秒止まる（ユーザー指定）。
const FOUR_CHOICE_GAP_SEC = 3;
const isFourChoice = (q) => !!q && q.type !== 'ox' && Array.isArray(q.choices) && q.choices.length >= 3;

// E9：混同しやすい科目の組（紛らわしい名前のペア＝CONFUSING_PAIRSと同じ考え方を
// 科目単位に広げたもの）。既存の複数科目ローテーション（rotateSubjects）へそのまま渡す。
const CONFUSING_SUBJECT_PAIRS = [
  ['経絡経穴概論', '東洋医学概論'],
  ['はり理論', 'きゅう理論'],
  ['解剖学', '生理学'],
  ['臨床医学総論', '臨床医学各論'],
];

// A5：周回速度ログ（roundLog.js）の名前空間を音声学習用に分ける（Review.jsxの
//   toReviewRoundTarget＝10000+と同じ考え方。テキスト学習・音声学習・復習の3画面で
//   前回比較・通算回数が混ざらないようにする）。
const toAudioRoundTarget = (v) => 20000 + v;

// 連結モード（検索窓の下に並ぶ10項目）。id=0 は通常（全部順に読む）。
const MODES = [
  { id: 1, icon: '🔗', title: 'キーワード連鎖（芋づる式）', desc: '同じキーワードの問題を続けて読み、関連の強い言葉へ自動でつなげます。', when: '知識を幅広く結びつけたい／通しで復習したい時' },
  { id: 2, icon: '⚖️', title: '比較・対比読み', desc: 'まぎらわしい2つ以上を並べて読み、違いをはっきりさせます。', when: '似た用語を混同しがちな時' },
  { id: 3, icon: '🔢', title: '数値まとめ読み', desc: '覚えにくい数字だけを続けて読み上げます。', when: '数字が苦手／試験直前の総ざらいに' },
  { id: 4, icon: '⬜', title: '穴埋め音声', desc: 'キーワードを伏せて出題し、間をおいてから答えを読みます。', when: '思い出す力（想起）を鍛えたい時' },
  { id: 5, icon: '💪', title: '弱点キーワード優先', desc: 'これまで正答率の低い言葉の問題から順に読みます。', when: '苦手を先につぶしたい時' },
  { id: 6, icon: '📋', title: '選択肢読み上げ→解答', desc: '四択の選択肢まで読み、間をおいてから正解を言います。', when: '手が使えない移動中のミニテストに' },
  { id: 7, icon: '📚', title: '章（カテゴリ）通し読み', desc: '出題基準のカテゴリごとにまとめて読みます。', when: '範囲の全体像を耳でつかみたい時' },
  { id: 8, icon: '📝', title: 'つながりナレーション', desc: 'キーワードの要点を短い語りに再構成して読みます。', when: 'すき間時間でサッと要点確認したい時' },
  { id: 9, icon: '🎯', title: '適応（弱点に自動集中）', desc: 'これまでの正誤に応じて、弱点の問題を厚めに読みます。', when: '解くほど自分専用にしたい時' },
  { id: 10, icon: '📅', title: '今日の連結（デイリー）', desc: '今日の1キーワードと、復習期限が来た問題を優先して読みます。', when: '毎日3〜5分の習慣づけに' },
];
import {
  allKeywords,
  clustersMap,
  relatedKeywordMap,
  chainOrder,
  keywordAccuracy,
  dailyKeyword,
} from '../lib/audioplan.js';

// 音声学習モード × 連結学習法（強化版）
//   基本フロー: 問題 →（間）→ 正解＋解説 → 次…
//   連結の工夫:
//     #2 科目も読む（横断ミックス） / #1 関連キーワードへ連鎖 /
//     #5 答えの前にヒント / #6 逆向き確認 / #7 まとめ読み / #8 用語カード /
//     #3 弱点キーワード順 / #9 今日の連結 / #10 聞きながら自己採点＆キーワード追加
//   ※ アプリを開いた状態での利用を想定（画面OFF時の継続再生は不可）。

const PHASES = { KEYWORD: 'keyword', QUESTION: 'question', GAP: 'gap', ANSWER: 'answer', NOTE: 'note' };
const ALL_KW = '__all__';

// 設定トグル1行（初心者向けの説明つき）
function Opt({ on, onToggle, title, desc, disabled }) {
  return (
    <button
      className={`opt-row ${on ? 'on' : ''}`}
      onClick={onToggle}
      disabled={disabled}
      type="button"
    >
      <span className={`opt-switch ${on ? 'on' : ''}`}><span className="opt-knob" /></span>
      <span className="opt-main">
        <span className="opt-title">{title}</span>
        <span className="opt-desc">{desc}</span>
      </span>
    </button>
  );
}

export default function AudioMode({
  store, onToast, reviewPreset, onConsumePreset, onNavigate,
  onOpenFlashcardKeyword, onOpenMnemonicKeyword, onOpenGraphConcept, onOpenGlossaryTerm,
  resumeFilters, onConsumeResumeFilters,
}) {
  const {
    questions, links, history, srs, settings, updateSettings, recordAnswer, setLink, bookmarks, toggleBookmark,
    voiceCloneApiKey, kwMeta, examResults, reviewQuestions, memos, setMemo, setNextDue, loaded,
  } = store;
  const voiceClone = settings.voiceClone || { enabled: false, voiceId: '', voiceName: '' };
  const cloneActive = !!(voiceClone.enabled && voiceClone.voiceId && voiceCloneApiKey);

  const taggedQuestions = useMemo(
    () =>
      questions.filter(
        (q) =>
          (q.tags && q.tags.length) ||
          (links[q.id] && links[q.id].keywords && links[q.id].keywords.length)
      ),
    [questions, links]
  );
  // 復習対象プール：期限優先＋「念のため確認」込み（Session.jsxの「すべて復習」と同じ定義）
  const reviewPool = useMemo(() => reviewPoolFor(questions, srs), [questions, srs]);
  // customReviewIds（Review.jsx等から渡されたid配列）をquestionsへ変換する時、
  // 渡された配列の順序をそのまま保つ（Review.jsxは忘れそうな順・滞留日数順などの
  // 意味のある並びでidを渡しているため、questionsの収録順で作り直すとその並びが消えてしまう）。
  const questionsById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const orderedByCustomIds = (ids) => ids.map((id) => questionsById.get(id)).filter(Boolean);
  // A7：要注意（リーチ、LEECH_THRESHOLD回以上の誤答）件数。開始前の画面で見えるようにする
  // （学習10・60・300・900の#7と同じ定義・同じ考え方）。
  const audioLeechCount = useMemo(() => questions.filter((q) => isLeechState(srs[q.id])).length, [questions, srs]);
  // 一番上の赤い長丸ボタン：「国家試験の科目×過去に間違えたところ」。日替わりで進む
  // 今日の科目（settings.audioDailySubjectRotationに保存した状態から、日付が変わった時だけ
  // 1つ進める。lib/audioDailySubject.jsが単一の正）の、誤答・△✕の問題だけに絞り込んだプール。
  // タップするだけでこのプールを即座に読み上げ始める（入力の手間ゼロ）。
  const dailySubjectState = useMemo(
    () => resolveDailySubjectIndex(settings.audioDailySubjectRotation),
    [settings.audioDailySubjectRotation]
  );
  useEffect(() => {
    if (!dailySubjectState.changed) return;
    updateSettings({ audioDailySubjectRotation: { index: dailySubjectState.index, dateKey: dailySubjectState.dateKey } });
  }, [dailySubjectState.changed, dailySubjectState.index, dailySubjectState.dateKey, updateSettings]);
  const dailyWrongPick = useMemo(
    () => subjectWrongPool(questions, srs, subjectAt(dailySubjectState.index)),
    [questions, srs, dailySubjectState.index]
  );
  const { streak, studiedToday } = useMemo(() => studyStreak(history), [history]);
  const [mood, setMood] = useState(null);
  useEffect(() => { loadTodayMood().then(setMood); }, []);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);
  // マスター済み累計・科目別マスター率（復習経由＝一度でも間違えた問題のうち）
  const masteredCount = useMemo(
    () => questions.filter((q) => {
      const s = normalize(srs[q.id]);
      return (s.wrongCount || 0) > 0 && (s.correctStreak || 0) >= MASTER_STREAK;
    }).length,
    [questions, srs]
  );
  // 症例の連問（casePairs.js）の隣接維持に使う対応表（元の収録順のquestionsから作る。
  // Session/Quiz/Review.jsxと同じ単一の正。シャッフル・ローテーションで引き離されないように）。
  const caseLinkMap = useMemo(() => buildCaseLinkMap(questions), [questions]);
  const adjustCasePairs = (qs) => keepCasePairsAdjacentObjects(qs, caseLinkMap.linkOf, caseLinkMap.pairOf);

  // 今日の1問（忘却予測の上位、Homeと同じ日替わりローテーション）
  const forgettingPick = useMemo(() => dailyForgettingPick(questions, srs), [questions, srs]);

  // 今日集中すべき科目（Review/Session/Homeと同じtodayFocus.jsを再利用。新しい判定は作らない）
  const focusSubject = useMemo(() => {
    const scope = scopeCoverage(questions, history);
    const picks = todayFocusSubjects(scope, daysUntil(settings.examDate), { questions, limit: 1, examResults });
    return picks[0] || null;
  }, [questions, history, settings.examDate, examResults]);

  // 科目バランスの偏り警告（Home/Analyticsと同じ判定）
  const balanceWarning = useMemo(() => subjectBalanceWarning(history, questions), [history, questions]);

  // 先送り（スヌーズ）記録（Review.jsxと同じ発生源）
  const [snoozeLogState, setSnoozeLogState] = useState({});
  useEffect(() => { loadSnoozeLog().then(setSnoozeLogState); }, []);

  // コンテンツ更新ログ（「🆕 新着だけ」フィルタ用。直近14日に追加された問題id）
  const [seedLog, setSeedLog] = useState([]);
  useEffect(() => { loadContentSeedLog().then(setSeedLog); }, []);
  const recentIds = useMemo(() => recentlyAddedIds(seedLog, Date.now() - 14 * 24 * 60 * 60 * 1000), [seedLog]);

  // 本当に期限が来ている問題（isInReview）のid集合。reviewPoolとの差分が「念のため確認」
  // （Review.jsxのnagameQuestionsと同じ考え方）。
  const reviewIdSet = useMemo(() => new Set((reviewQuestions || []).map((q) => q.id)), [reviewQuestions]);
  const [nagameOnly, setNagameOnly] = useState(false); // 🔎 念のため確認だけ
  const [excludeNagame, setExcludeNagame] = useState(false); // 念のため確認を除外
  const [snoozedOnly, setSnoozedOnly] = useState(false); // 😴 先送り中の問題だけ
  const [excludeSnoozed, setExcludeSnoozed] = useState(false); // 先送り中の問題を除外
  const applyNagameAndSnooze = (list) => {
    let out = list;
    if (nagameOnly) out = out.filter((q) => !reviewIdSet.has(q.id));
    else if (excludeNagame) out = out.filter((q) => reviewIdSet.has(q.id));
    if (snoozedOnly) out = out.filter((q) => snoozeCount(snoozeLogState, q.id) > 0);
    else if (excludeSnoozed) out = out.filter((q) => !snoozeCount(snoozeLogState, q.id));
    return out;
  };

  // 複数科目をバランスよく混ぜて読む「科目ローテーション」（2科目以上選ぶと単一科目選択より優先）
  const [rotateSubjects, setRotateSubjects] = useState([]);

  // 今日の目標（Mascot/Homeの全体の目標）。音声の自己採点もhistoryに積まれるため同じ計算で揃う。
  const dailyGoalCount = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return history.filter((h) => h.at && h.at >= today.getTime()).length;
  }, [history]);
  const dailyGoalTarget = settings.dailyGoal ?? 300;
  const effectiveDailyGoal = mood === 'tired' ? Math.max(20, Math.round(dailyGoalTarget * 0.5)) : dailyGoalTarget;
  // 新規5：今日の目標を達成した瞬間に一度だけお祝いする（それまではヘッダーの数字だけの表示だった）。
  const dailyGoalCelebratedRef = useRef(false);
  useEffect(() => {
    if (effectiveDailyGoal <= 0) return;
    if (dailyGoalCount >= effectiveDailyGoal) {
      if (!dailyGoalCelebratedRef.current) {
        dailyGoalCelebratedRef.current = true;
        onToast?.(`🎉 今日の目標${effectiveDailyGoal}問を達成しました！`);
      }
    } else {
      dailyGoalCelebratedRef.current = false;
    }
  }, [dailyGoalCount, effectiveDailyGoal, onToast]);

  // このタブがバックグラウンドの間に束が終わっても知らせる、既定オフのオプトイン通知。
  const [notifyOn, setNotifyOn] = useState(false);
  const toggleNotify = async () => {
    if (!notifyOn) {
      if (typeof Notification === 'undefined') { onToast?.('この端末・ブラウザは通知に対応していません'); return; }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { onToast?.('通知が許可されませんでした'); return; }
    }
    setNotifyOn((v) => !v);
  };

  // 選択肢の順番をシャッフルして読む（「いつも3番」のように位置で覚えてしまうのを防ぐ）
  const [shuffleChoicesOn, setShuffleChoicesOn] = useState(false);
  // 並べ替えは問題ごとに決まった順（この画面を開いている間は同じ）。以前は読み上げを組み直すたびに
  // 乱数で並べ直していたので、画面に出す選択肢の番号と声の「正解は◯番」を合わせられなかった。
  const choiceSeedRef = useRef(Math.floor(Math.random() * 1e9));
  const shuffledChoicesFor = (q) => {
    if (!shuffleChoicesOn || q.type === 'ox' || !Array.isArray(q.choices)) return { choices: q.choices, answerIdx: q.answer };
    let h = choiceSeedRef.current;
    for (const ch of String(q.id)) h = (Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0);
    const rand = () => { h = (Math.imul(h, 1103515245) + 12345) >>> 0; return h / 4294967296; };
    const order = q.choices.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    return { choices: order.map((i) => q.choices[i]), answerIdx: order.indexOf(q.answer) };
  };

  // 読み間違いをその場で報告するミニフォーム（下の「読み方の手動補正」と同じ状態を使う）
  const [pfQuickOpen, setPfQuickOpen] = useState(false);
  // #52：誤読報告の履歴一覧（辞書(settings.pronunciationFixes)はtermキーの上書きで
  //   いつ報告したかを持たないため、履歴だけ別に残す）。
  const [pronReportLog, setPronReportLog] = useState([]);
  useEffect(() => { loadPronunciationReportLog().then(setPronReportLog); }, []);
  // #26：「あとで調べる」リスト（検索・用語集を開かず、その場でキーワードを控えておく）。
  const [laterLookup, setLaterLookup] = useState([]);
  useEffect(() => { loadLaterLookup().then(setLaterLookup); }, []);
  const [laterLookupOpen, setLaterLookupOpen] = useState(false);
  // #1：体の場所法で読む経穴の組（既定は八会穴、増えたら選べるようにする）
  const [bodyLocationSetId, setBodyLocationSetId] = useState(BODY_LOCATION_SETS[0]?.id || null);
  // #28：宿題リプレイ。「あとで調べる」に登録してから12時間以上経ったものだけを対象にする
  // （同日中に追加したものを「翌日の宿題」として即座に出さないよう、一晩ぶんの間隔を置く）。
  // 同じ問題を何度「あとで調べる」に入れても1回だけ数える（件数の表示と読み上げが重ならないように）
  const homeworkIds = useMemo(
    () => [...new Set(laterLookup.filter((e) => e.questionId && Date.now() - (e.at || 0) >= 12 * 60 * 60 * 1000).map((e) => e.questionId))],
    [laterLookup]
  );

  // 直近の学習セッション（10・60・300・900）で間違えた問題
  const lastSessionMisses = useMemo(() => {
    const session = store.session;
    if (!session || !session.startedAt || !Array.isArray(session.ids)) return [];
    const idsSet = new Set(session.ids);
    const wrongIds = new Set();
    for (const h of history) {
      if (h.at >= session.startedAt && idsSet.has(h.questionId) && !h.correct) wrongIds.add(h.questionId);
    }
    return questions.filter((q) => wrongIds.has(q.id));
  }, [store.session, history, questions]);
  // 週間の読み上げ量（○△✕の自己採点回数）ミニグラフ
  const weeklyAudio = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const base = new Date(); base.setHours(0, 0, 0, 0);
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d0 = base.getTime() - i * DAY;
      const d1 = d0 + DAY;
      days.push(history.filter((h) => h.at >= d0 && h.at < d1).length);
    }
    return days;
  }, [history]);
  const weeklyAudioMax = Math.max(1, ...weeklyAudio);
  // K21：想起練習（recallMode／pureRecallOn）限定の今週・先週の比較。
  // バグ防止：buildWeeklyReport方式でnowをずらすと範囲に上限が無く二重に数えるため
  // （実際に以前WeeklyJournal.jsxで踏んだ不具合と同じ形）、[now-7d,now)・[now-14d,now-7d)の
  // 上限つき範囲を自分で計算する。
  const recallWeekStats = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const thisWeek = history.filter((h) => h.source === 'audio-recall' && h.at >= now - 7 * DAY);
    const lastWeek = history.filter((h) => h.source === 'audio-recall' && h.at >= now - 14 * DAY && h.at < now - 7 * DAY);
    const acc = (list) => {
      if (!list.length) return null;
      return Math.round((list.filter((h) => h.correct).length / list.length) * 100);
    };
    return { thisCount: thisWeek.length, lastCount: lastWeek.length, thisAcc: acc(thisWeek), lastAcc: acc(lastWeek) };
  }, [history]);
  // M26：想起練習だけの今日の問題数（通常の今日の目標とは別の、想起にしぼった補助カウント）。
  const recallTodayCount = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return history.filter((h) => h.source === 'audio-recall' && h.at >= today.getTime()).length;
  }, [history]);

  // 連結学習の下ごしらえ（キーワードのクラスタ・関連・弱点・今日の分）
  const kwList = useMemo(() => allKeywords(questions, links), [questions, links]);
  const kwNames = useMemo(() => kwList.map((k) => k.keyword), [kwList]);
  const clusters = useMemo(() => clustersMap(questions, links), [questions, links]);
  const relatedMap = useMemo(() => relatedKeywordMap(questions, links), [questions, links]);
  const weakRanked = useMemo(() => keywordAccuracy(questions, links, history), [questions, links, history]);
  const weakNames = useMemo(() => weakRanked.map((w) => w.keyword), [weakRanked]);
  const dailyKw = useMemo(() => dailyKeyword(questions, links, dateKey()), [questions, links]);
  const hasKeywords = kwNames.length > 0;

  // ソース・キーワード選択（既定は全問題。検索で絞ると filter）
  // resumeFilters（App.jsxの「前回の続きから」ダイアログで「はい」を選んだ時だけ渡される）が
  // あれば、科目/ジャンル/キーワード/回の検索結果読み上げモードで初期化する（一度だけ消費する中継state、
  // 既存のfocusFlashcardKeyword等と同じパターン）。
  const [source, setSource] = useState(() => (resumeFilters ? 'filter' : 'all')); // all|filter（旧: review|tagged|keyword|daily|weak）
  // 体の場所法を選んだ瞬間だけ経穴カードデータを読み込む（起動時バンドルに含めないため）。
  // 経穴カードの読み（361穴）は読み上げの誤読対策にも使うので、音声の画面を開いたら読み込む
  // （起動時の束には入らない。動的importの別チャンク）。
  const keiketsuCards = useKeiketsuCards(true);
  const [mode, setMode] = useState(0); // 連結モード（0=通常, 1〜10）
  const [selectedKeyword, setSelectedKeyword] = useState('');
  // 復習画面の絞り込み条件から渡された問題idだけに絞る場合に使う（未指定なら通常の復習プール全体）
  const [customReviewIds, setCustomReviewIds] = useState(null);
  // 再生履歴から誤答・△✕を開き直した時の「並びをそのまま流す」印（2026-11-15）。
  // customReviewIdsと同じ配列（参照）の時だけ有効——ほかの開始ボタンが新しい配列を入れた瞬間に自然に外れる。
  // 有効な間は、念のため確認・先送り・シャッフル・要注意を先に・件数しぼり込みで並びを組み直さない。
  const [frozenReviewIds, setFrozenReviewIds] = useState(null);
  // いま聞いている誤答・△✕の束（再生履歴に残す単位）。{ key, title, sessionKind, ids, heard:Set, sig }
  const reviewSessionRef = useRef(null);
  // 「間違えた問題を読み上げる」で、学習(10・60・300・900)と同じ目安件数に区切る場合に使う
  // （nullは「すべて」＝従来どおり対象プール全体を読み上げる）。前回選んだ件数を覚えておく
  // （settings.lastAudioReviewTarget、未指定ならnull＝従来どおり毎回「すべて」から）。
  const [reviewTarget, setReviewTarget] = useState(() => settings.lastAudioReviewTarget ?? null);
  // 「もう一度（同じ件数で別の問題を）」で、対象プールの何件目から切り出すか（周回オフセット）。
  // アプリを閉じて開き直した後も続きの束から始められるよう覚えておく（新規#10）。
  const [reviewOffset, setReviewOffset] = useState(() => settings.lastAudioReviewOffset ?? 0);
  // reviewOffsetを変える操作は必ずこれを通して設定へ覚えておく（新規#10。setReviewOffsetを
  // 直接呼ぶとその場では動くが、閉じて開き直した時に前回の続きへ戻れなくなる）。
  const setReviewOffsetPersist = (updater) => {
    setReviewOffset((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      updateSettings({ lastAudioReviewOffset: next });
      return next;
    });
  };
  // 「まだ解いていない問題だけ」（検索フィルタ側に件数チップを使い回す）
  const [newOnly, setNewOnly] = useState(false);
  // 忘却リスクを「しきい値以上」ではなく「リスク上位◯件」で選ぶ時の件数（nullなら未使用）
  const [riskTopN, setRiskTopN] = useState(null);
  // ⚡ 問題文を省略し、正解と一言解説だけを素早く読む（ケアレスミス向けの超高速モード）
  const [skipQuestionText, setSkipQuestionText] = useState(false);
  // 🔔 考える時間（間）の前後に短い合図音を鳴らす
  const [beepOn, setBeepOn] = useState(false);
  // 📳 次の問題に進むたびに軽く振動する（Android系のブラウザのみ対応）
  const [vibrateTickOn, setVibrateTickOn] = useState(false);
  // 👆 画面を大きくタップして自己採点（タップ＝○・長押し＝✕）
  const [wideTapOn, setWideTapOn] = useState(false);
  const wideTapDownRef = useRef(0);
  // 盲目の受験生からの改善提案#3：独自のスワイプ操作（左右で前へ/次へ）は、
  // スクリーンリーダー自体のスワイプ操作（VoiceOver/TalkBack等）とぶつかる可能性がある。
  // 自動検知はできないため、手動でオフにできるようにする（既定はON＝今までどおり）。
  const [swipeNavOn, setSwipeNavOn] = useState(true);
  // 🎙️ 声で自己採点・操作（○/△/✕・次へ/前へ/止めて）。既定オフのオプトイン。
  const [voiceControlOn, setVoiceControlOn] = useState(false);
  // C5〜C7：声で解答モード（自由回答を声で言い、正解語と突き合わせて自動で○判定する）。
  // 既定オフ。安全のため「一致した時だけ自動で○」――聞き取れない・一致しない場合は
  // 一切自動✕にせず、そのまま通常の答え合わせへ進む（既存の声コマンドによる自己採点
  // とは別物：voiceControlOnは○/△/✕という決まった言葉を認識するだけで、こちらは
  // 答えの内容そのものを認識する）。
  const [voiceAnswerOn, setVoiceAnswerOn] = useState(false);
  const [voiceAnswerHeard, setVoiceAnswerHeard] = useState(null); // {questionId, heard, matched}
  const [voiceAnswerStats, setVoiceAnswerStats] = useState({ attempts: 0, matched: 0 });
  // 声が聞き取れなかった（no-speech）回数。3回続いたら一度だけヒントを出す
  // （voiceControlOn・voiceAnswerOnの両方の聞き取りで共用）。
  const noSpeechCountRef = useRef(0);
  const noSpeechHintShownRef = useRef(false);
  const noteNoSpeech = () => {
    noSpeechCountRef.current += 1;
    if (noSpeechCountRef.current >= 3 && !noSpeechHintShownRef.current) {
      noSpeechHintShownRef.current = true;
      onToast?.('🔈 声が聞き取れないことが続いています。周囲が静かな場所で試すといいかもしれません');
    }
  };
  // A1：完全想起モード（選択肢を一切読まず、問題文だけ→無音→声に出す→正解、という
  // より本番に近い想起練習）。recallModeに「選択肢を読まない＋間を長めにする」を重ねた版。
  const [pureRecallOn, setPureRecallOn] = useState(false);
  // A2：無音の長さを固定値ではなく、個人の解答ペース（estimatedAnswerSeconds）から
  // 1問ごとに計算し直す。
  const [adaptiveGapOn, setAdaptiveGapOn] = useState(false);
  // I15・I16・M24：体の場所法（経穴）で、位置→経穴名・経絡を声に出してから正解を聞く
  // 双方向の想起ステップ（source==='bodyLocation'の時だけ意味を持つ）。
  const [keiketsuRecallOn, setKeiketsuRecallOn] = useState(false);
  // H13：「自分の言葉で言い直す録音」の前に「後輩に教えるつもりで」という一言を読む。
  const [teachModeOn, setTeachModeOn] = useState(false);
  const recordStartAtRef = useRef(0);
  // 🎧 イヤホン接続を確認できた時だけ自動再生する
  const [headphoneOnly, setHeadphoneOnly] = useState(false);
  const [headphoneHint, setHeadphoneHint] = useState(null);
  // 10問ごとに「ここまで◯問、残り◯問」を声で知らせる
  const [progressAnnounceOn, setProgressAnnounceOn] = useState(false);
  // 再生スタイル：インプット（聞くだけ・自動で正解まで進む＝既定）／アウトプット（間で一度止め、
  // 「解答を見る」を押すまで正解を言わない＝自分で思い出す・解答してから答え合わせする形）。
  const [outputModeOn, setOutputModeOn] = useState(false);
  // このセッションで△・✕にした問題を、最後まで聞き終えたあと自動でもう一度だけ回す
  const [autoRequeueWrongOn, setAutoRequeueWrongOn] = useState(false);
  const requeuedRef = useRef(false);
  // 60問区切りで自動的にひと休み（Session.jsxの60問区切りの休憩と同じ考え方）
  const breakNotifiedRef = useRef(-1);
  // #43：次のセットまでの小休止を選べる（続ける/1分/5分/手動）。トーストで知らせるだけだった
  // ものを、実際に選べるバナーに変える。
  const [breakPending, setBreakPending] = useState(false);
  // 盲目の受験生からの改善提案#25・#29：区切りの理由（件数／時間／耳の疲労）で
  // バナーの文言・ボタンを出し分ける（既存の件数区切りのバナーをそのまま再利用する）。
  const [breakReason, setBreakReason] = useState('count');
  // 盲目の受験生からの改善提案#10：休憩バナーが出た時、フォーカスを自動で先頭の
  // ボタンへ移す（画面を見ずにタブ移動だけで選べるように）。
  const breakFirstBtnRef = useRef(null);
  // App.jsxの前回の続きからダイアログで実機QAで発見した問題と同じ対処：refへの反映を
  // 待つのではなく、実際にDOMへ現れた瞬間をMutationObserverで直接捉える方が確実。
  useEffect(() => {
    if (!breakPending) return;
    const sel = '[role="region"][aria-label="休憩の選択"] button';
    if (document.querySelector(sel)) { breakFirstBtnRef.current?.focus(); return; }
    const obs = new MutationObserver(() => {
      const el = document.querySelector(sel);
      if (el) { el.focus(); obs.disconnect(); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [breakPending]);
  const breakTimerRef = useRef(null);
  useEffect(() => () => { if (breakTimerRef.current) clearTimeout(breakTimerRef.current); }, []);
  // このセッションで自己採点した件数（声で読み上げる正答率の算出に使う。採点していなければnull扱い）
  const [sessionGradedCount, setSessionGradedCount] = useState(0);
  // 音声レビューの実施ログ（よく使う組み合わせ・完了率のおすすめに使う）
  const [audioLog, setAudioLog] = useState([]);
  useEffect(() => { loadAudioReviewLog().then(setAudioLog); }, []);
  useEffect(() => { detectHeadphoneHint().then(setHeadphoneHint); }, []);
  // 誤答理由（型）の分類データ（終了時の型別の件数読み上げに使う。新規#2）。
  // useMissTypeHandling（Session.jsx/Review.jsxと同じ単一の正）を使うことで、
  // ここで新しく分類した時もsetNextDueによる型別の間隔調整が効くようにする
  // （以前は直接recordMissTypeだけを呼び、間隔調整が一切効いていなかった）。
  const { missTypes, onMissType } = useMissTypeHandling(setNextDue);
  // 学習(10・60・300・900)と同じく、△✕の自己採点をstarWeak.js（★弱点レベル）にも記録する
  // （以前は一度も呼んでおらず、音声の自己採点がG-100チェックリスト等の★判定に反映されていなかった）。
  const [selfKindCounts, setSelfKindCounts] = useState({});
  useEffect(() => { loadSelfKindCounts().then(setSelfKindCounts); }, []);
  // 🎵 束の「プレイリスト」（新規#3）。{target, subject}の配列。現在の束が終わったら次へ進む。
  const [playlistQueue, setPlaylistQueue] = useState([]);
  // 🎙️ 声コマンドの言い回しを自分で登録する辞書（新規#7）。[{word, type, kind}]。
  const voiceCommandWords = settings.voiceCommandWords || [];
  const [vcWord, setVcWord] = useState('');
  const [vcKind, setVcKind] = useState('maru');

  // 上部の検索フィルタ（科目名 / ジャンル / キーワード、いずれも未選択OK）
  // ミニプレーヤーの「続きから」「再生履歴」から飛んでくる位置（まだ飛び終えていないぶん）
  const pendingJumpRef = useRef(null);
  const [jumpNonce, setJumpNonce] = useState(0);
  const togglePlayRef = useRef(null);
  // 「選んだらそのまま再生」の予約。以前は setTimeout(300ms) で、その時の描画の togglePlay を
  // 呼んでいたため、①直前に変えたスリープタイマー等が効かない（古い値のまま）②計画の組み直しが
  // 300msに間に合わない（体の場所法の読み込み等）と古い束を再生し、すぐ読み込み直しで止まる、が起きた。
  // 計画をエンジンへ読み込んだ直後に、最新の togglePlay で1回だけ再生する（組み直しが無い時は1.2秒後に再生）。
  const autoPlayReqRef = useRef(0);
  const latestPlanSigRef = useRef(null);
  const requestAutoPlay = () => {
    const at = Date.now();
    autoPlayReqRef.current = at;
    // 組み直しが起きない（同じ束をもう一度選んだ）時の受け皿。組み直し中（エンジンの束と
    // 画面の束がまだ違う）なら待ち続け、古い束を再生しない（5秒で諦める）。
    const check = () => {
      if (autoPlayReqRef.current !== at) return;
      const snapNow = engine.getSnapshot();
      if (snapNow.planSig !== latestPlanSigRef.current || !snapNow.hasPlan) {
        if (Date.now() - at < 5000) setTimeout(check, 300); else autoPlayReqRef.current = 0;
        return;
      }
      autoPlayReqRef.current = 0;
      if (!snapNow.playing) togglePlayRef.current?.();
    };
    setTimeout(check, 900);
  };
  const [filterSubject, setFilterSubject] = useState(() => resumeFilters?.subject || '');
  const [filterGenre, setFilterGenre] = useState(() => resumeFilters?.genre || '');
  const [filterKeyword, setFilterKeyword] = useState(() => resumeFilters?.keyword || '');
  const [filterRound, setFilterRound] = useState(() => resumeFilters?.round || '');
  useEffect(() => {
    // resumeFiltersは「前回の続きから」ダイアログのはいを押した時だけ渡される一度だけ消費する
    // 中継stateだが、lastView復元（App.jsxのviewRestored）がこの画面を先に開いてしまっている場合、
    // AudioModeは既にマウント済みのままダイアログのはいが後から押される——その場合、上のuseStateの
    // 遅延初期化（resumeFilters?.subject等、マウント時の1回だけ評価される）はもう効かない。
    // ここを依存配列[resumeFilters]にして、マウント後にresumeFiltersが(null→値)に変わった時にも
    // 同じ内容を効かせる（最初からresumeFilters付きで新規マウントした場合は、遅延初期化と
    // この効果の両方が同じ値を適用するだけで無害）。
    if (!resumeFilters) return;
    if (resumeFilters.exact && resumeFilters.kind === 'review') {
      applyReviewEntry(resumeFilters, !!resumeFilters.autoPlay);
      onConsumeResumeFilters?.();
      return;
    }
    if (resumeFilters.exact) {
      // 下部ミニプレーヤーの「続きから」「再生履歴」から来た時（2026-11-15）：
      // その履歴と同じ絞り込みにそろえ（空の項目は空へ戻す）、通常の読み上げにしてから、
      // 計画が組み上がったあとで記録の位置へ飛ぶ（下の「履歴の位置へ飛ぶ」効果）。
      const j = {
        subject: resumeFilters.subject || '', genre: resumeFilters.genre || '',
        keyword: resumeFilters.keyword || '', round: resumeFilters.round || '',
        index: Number(resumeFilters.index) || 0, total: Number(resumeFilters.total) || 0,
        autoPlay: !!resumeFilters.autoPlay,
        qid: resumeFilters.qid || '', done: !!resumeFilters.done, at: Date.now(),
        // 💾で保存したもの（pin|…）から来た時は、その行を消す（自動の履歴を取り違えて消さない）
        entryKey: resumeFilters.key || '',
        // 件数しぼり込みの記録がある履歴だけ、その件数と位置へそろえる（無い古い履歴は今の設定のまま）
        target: resumeFilters.target === undefined ? (reviewTarget || null) : (resumeFilters.target || null),
        offset: resumeFilters.target === undefined ? (reviewOffset || 0) : (resumeFilters.offset || 0),
      };
      j.source = j.subject || j.genre || j.keyword || j.round ? 'filter' : 'all';
      const same = mode === 0 && source === j.source && filterSubject === j.subject
        && filterGenre === j.genre && filterKeyword === j.keyword && String(filterRound || '') === j.round
        && (reviewTarget || null) === j.target && (reviewOffset || 0) === j.offset;
      if ((reviewTarget || null) !== j.target) setReviewTarget(j.target);
      if ((reviewOffset || 0) !== j.offset) setReviewOffsetPersist(j.offset);
      if (!same) {
        rebuildStop();
        // 別の束へ移る時は、前の束の自己採点の数を持ち越さない（終わった時の「◯問のうち正答率…」がずれる）
        setSessionGradedCount(0); setSessionWrong([]); setSessionWrongKinds({}); setSessionLatencies([]);
      }
      setMode(0);
      setSource(j.source);
      setFilterSubject(j.subject);
      setFilterGenre(j.genre);
      setFilterKeyword(j.keyword);
      setFilterRound(j.round);
      pendingJumpRef.current = j;
      cameFromResumeRef.current = true;
      setJumpNonce((n) => n + 1);
      onConsumeResumeFilters?.();
      return;
    }
    rebuildStop();
    // 渡された条件どおりにそろえる。以前は渡されなかった項目（ジャンル・キーワード等）と連結学習モードを
    // そのまま残していたため、カレンダーの「同じ条件でもう一度」や前回の続きからで、前に選んでいた
    // 別の絞り込み・読み方のまま始まっていた。
    setMode(0);
    setSource('filter');
    setFilterSubject(resumeFilters.subject || '');
    setFilterGenre(resumeFilters.genre || '');
    setFilterKeyword(resumeFilters.keyword || '');
    setFilterRound(resumeFilters.round || '');
    onConsumeResumeFilters?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeFilters]);
  // 誤答・△✕の履歴（kind:'review'）を開き直す：聞いていた並びのうち、まだ聞いていない問題だけを流す。
  // 再生履歴・前回の続きからダイアログ・閉じて開き直した時の自動復元の3か所から使う（単一の正）。
  function applyReviewEntry(entry, autoPlayIt) {
      // 誤答・△✕の再生履歴から来た時：聞いていた問題の並びそのものを、まだ聞いていない問題だけ流す。
      const playIds = reviewReplayIds(entry);
      const restart = !!entry.done;
      rebuildStop();
      // 前の束の自己採点の数を持ち越さない（終わった時の正答率・「聞くだけ」の数がずれる）
      setSessionGradedCount(0); setSessionWrong([]); setSessionWrongKinds({}); setSessionLatencies([]);
      setMode(0);
      setFilterSubject(''); setFilterGenre(''); setFilterKeyword(''); setFilterRound('');
      setReviewTarget(null);
      setReviewOffsetPersist(0);
      setSource('review');
      setCustomReviewIds(playIds);
      setFrozenReviewIds(playIds);
      audioSessionKindRef.current = entry.sessionKind === 'maruReview' || entry.sessionKind === 'maruFast' ? entry.sessionKind : null;
      quickMinuteActiveRef.current = null;
      reviewSessionRef.current = {
        key: historyKeyOf(entry), title: entry.title, sessionKind: entry.sessionKind || '',
        ids: [...(entry.ids || [])], heard: new Set(entry.done || restart ? [] : (entry.heard || [])), sig: null,
      };
      pendingJumpRef.current = {
        review: true, playIds, key: entry.key || historyKeyOf(entry), autoPlay: !!autoPlayIt,
        done: !!entry.done, heardCount: (entry.heard || []).length, at: Date.now(),
      };
      cameFromResumeRef.current = true;
      setJumpNonce((n) => n + 1);
  }
  // アプリ起動時の「前回の続きから」ダイアログ（App.jsx）で「はい」を選んでこの画面を開いた
  // 場合だけ、プレーヤーの位置まで自動で画面をスクロールする（ユーザー指定・2026-11-11）。
  // resumeFiltersは上の効果で消費されnullに戻るため、初回描画時の値をrefに固定しておく。
  const cameFromResumeRef = useRef(!!resumeFilters);
  // 学習（10・60・300・900）の検索窓にある自由語検索を音声学習にも組み込む（単一の正の移植）。
  const [filterTerm, setFilterTerm] = useState('');
  const [bookmarkOnly, setBookmarkOnly] = useState(false);
  const [minRisk, setMinRisk] = useState(0);
  const [minWrong, setMinWrong] = useState(0);
  const [leechFirst, setLeechFirst] = useState(false); // リーチ（要注意）を優先して読む
  const [recentOnly, setRecentOnly] = useState(''); // ''|'today'|'week'：直近の誤答だけに絞る
  const [recentOnlyFilter, setRecentOnlyFilter] = useState(false); // 🆕 新着だけ（直近14日に追加された問題）
  // 出題形式でしぼる（2026-11-08追加・ユーザー指定）。一問一答＝原問（round設定あり）ではない
  // 派生問題、マルバツ＝type==='ox'。独立したON/OFFで組み合わせられる（両方ONなら「派生かつ○×」
  // だけに絞られる）。音声で科目を再生する時、今まではこの区別が一切無く、原問の4択・派生の
  // 一問一答・○×がすべて混ざったまま読み上げられていた。
  const [derivedOnly, setDerivedOnly] = useState(false); // 一問一答（派生）だけ
  const [oxOnly, setOxOnly] = useState(false); // マルバツ（○×）だけ
  // A1：新規:復習の割合（学習10・60・300・900の「新規と復習の割合」スライダーと同じ考え方）。
  // 既定null＝未指定なら従来どおり（全件読み上げ・検索結果そのまま）。次回開いた時に前回の値を
  // 覚えておく（settings.audioNewPct、学習10・60・300・900のsettings.sessionNewRatio同期と同じ考え方）。
  const [audioNewPct, setAudioNewPct] = useState(null);
  const audioNewPctSyncedRef = useRef(false);
  useEffect(() => {
    if (audioNewPctSyncedRef.current || !loaded) return;
    audioNewPctSyncedRef.current = true;
    if (settings.audioNewPct != null) setAudioNewPct(settings.audioNewPct);
  }, [loaded, settings.audioNewPct]);
  const changeAudioNewPct = (v) => {
    rebuildStop();
    setAudioNewPct(v);
    updateSettings({ audioNewPct: v });
  };
  const [reviewZeroLog, setReviewZeroLog] = useState({});
  useEffect(() => { loadReviewZeroLog().then(setReviewZeroLog); }, []);
  const audioReviewStalledDays = useMemo(() => daysSinceLastZero(reviewZeroLog) || 0, [reviewZeroLog]);
  const uniqJa = (arr) => Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja'));
  // 上の選択で段階的にしぼり込む（科目→ジャンル→キーワード）
  // 科目名は出題基準の1〜14番順（学習10・60・300・900のsubjectsと同じ並び）。
  // 基準にない科目名（表記ゆれ等）は末尾に追加する。
  const subjectOptions = useMemo(() => {
    const present = getSubjects(questions);
    const ordered = SUBJECT_TAG_NAMES.filter((s) => present.includes(s));
    const extra = present.filter((s) => !SUBJECT_TAG_NAMES.includes(s));
    return [...ordered, ...extra];
  }, [questions]);
  const afterSubject = useMemo(() => {
    // 複数科目を交互に混ぜて読む「科目ローテーション」（2科目以上選ぶと単一の科目選択より優先）。
    if (rotateSubjects.length >= 2) {
      return roundRobinMerge(rotateSubjects.map((s) => questions.filter((q) => q.subject === s)));
    }
    return filterSubject ? questions.filter((q) => q.subject === filterSubject) : questions;
  }, [questions, filterSubject, rotateSubjects]);
  // ジャンル＝出題基準のカテゴリ（q.genre）。キーワード＝細かい語（タグ＋連結キーワード）。
  const genreOptions = useMemo(
    () => uniqJa(afterSubject.flatMap((q) => (q.genre ? [q.genre] : []))),
    [afterSubject]
  );
  const afterGenre = useMemo(
    () => (filterGenre ? afterSubject.filter((q) => q.genre === filterGenre) : afterSubject),
    [afterSubject, filterGenre]
  );
  const kwsOf = (q) => [...(q.tags || []), ...((links[q.id]?.keywords) || [])];
  const keywordOptions = useMemo(
    () => uniqJa(afterGenre.flatMap(kwsOf)),
    [afterGenre, links] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const keywordSections = useMemo(() => buildKanaIndex(keywordOptions), [keywordOptions]);
  const afterKeyword = useMemo(
    () => (filterKeyword ? afterGenre.filter((q) => kwsOf(q).includes(filterKeyword)) : afterGenre),
    [afterGenre, filterKeyword, links] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const roundOptions = useMemo(
    () => Array.from(new Set(afterKeyword.map((q) => roundKey(q.round)).filter((r) => r != null))).sort((a, b) => Number(b) - Number(a)),
    [afterKeyword]
  );
  // 再生中（束を聞いている間）は、絞り込みに使う解答履歴・SRSを再生を始めた時点のまま固定する。
  // 以前は「まだ解いていない問題だけ」（隙間時間の「5分だけ」も同じ）で1問自己採点するたびに
  // その問題が対象から外れて件数が変わり、束が読み込み直されて再生がその場で止まっていた
  // （誤答回数・忘却リスクでしぼっている時も同じ）。止まっている間はいつも最新を使う。
  const engineStartedForFilter = useAudioEngine().started;
  const filterDataRef = useRef({ history, srs });
  if (!engineStartedForFilter) filterDataRef.current = { history, srs };
  const filterHistory = filterDataRef.current.history;
  const filterSrs = filterDataRef.current.srs;
  const recentWrongIds = useMemo(() => {
    if (!recentOnly) return null;
    const now = Date.now();
    const since = recentOnly === 'today' ? now - 24 * 60 * 60 * 1000 : now - 7 * 24 * 60 * 60 * 1000;
    const ids = new Set();
    for (const h of filterHistory) if (!h.correct && h.at >= since) ids.add(h.questionId);
    return ids;
  }, [recentOnly, filterHistory]);
  // まだ一度も解いていない問題かどうかの判定用（#29「まだ解いていない問題だけ」）
  const answeredIds = useMemo(() => new Set(history.map((h) => h.questionId)), [history]);
  const answeredIdsForFilter = useMemo(() => new Set(filterHistory.map((h) => h.questionId)), [filterHistory]);
  const filteredPool = useMemo(() => {
    let pool = filterRound ? afterKeyword.filter((q) => isSameRound(q.round, filterRound)) : afterKeyword;
    if (bookmarkOnly) pool = pool.filter((q) => bookmarks[q.id]);
    if (newOnly) pool = pool.filter((q) => !answeredIdsForFilter.has(q.id));
    if (minWrong > 0) pool = pool.filter((q) => (normalize(filterSrs[q.id]).wrongCount || 0) >= minWrong);
    // 忘却リスクは「しきい値以上」（minRisk）と「リスク上位◯件」（riskTopN）のどちらか一方。
    // riskTopNを選んでいる時はminRiskのしきい値は使わず、リスクの高い順に並べて件数で切る。
    if (riskTopN) {
      pool = [...pool].sort((a, b) => riskOf(b, filterSrs) - riskOf(a, filterSrs)).slice(0, riskTopN);
    } else if (minRisk > 0) {
      pool = pool.filter((q) => Math.round(riskOf(q, filterSrs) * 100) >= minRisk);
    }
    if (recentWrongIds) pool = pool.filter((q) => recentWrongIds.has(q.id));
    if (recentOnlyFilter) pool = pool.filter((q) => recentIds.has(q.id));
    // 出題形式でしぼる：一問一答（派生＝round未設定）／マルバツ（○×）。coverage.jsの
    // 「原問＝round設定あり」と同じ基準を使う（新しい判定ロジックは作らない）。
    if (derivedOnly) pool = pool.filter((q) => !q.round);
    if (oxOnly) pool = pool.filter((q) => q.type === 'ox');
    // 自由語検索（学習(10・60・300・900)のtermと同じ照合先・同じ判定）。科目をまたいで探せる。
    const t = filterTerm.trim().toLowerCase();
    if (t) {
      pool = pool.filter((q) => {
        const hay = [q.question, q.subject, q.round, ...(q.choices || []), q.explanation, ...effectiveTags(q, links)].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(t);
      });
    }
    return pool;
  }, [afterKeyword, filterRound, bookmarkOnly, bookmarks, newOnly, answeredIdsForFilter, minWrong, minRisk, riskTopN, filterSrs, recentWrongIds, recentOnlyFilter, recentIds, derivedOnly, oxOnly, filterTerm, links]);
  const filterActive = !!(filterSubject || filterGenre || filterKeyword || filterRound || filterTerm || bookmarkOnly || newOnly || minWrong > 0 || minRisk > 0 || riskTopN || recentOnly || recentOnlyFilter || derivedOnly || oxOnly || rotateSubjects.length > 0);
  // ○の見直し・○の高速回転（学習10・60・300・900と同じuseMaruReview/MaruReviewCardをそのまま使う）。
  // 検索の絞り込み（filteredPool）を引き継ぐ。
  const {
    maruExcludeMastered, setMaruExcludeMastered,
    maruStatusAll, maruUncertainCount, maruStatusFiltered, maruPool,
  } = useMaruReview(filteredPool, history, srs);
  const fastSkipAutoRef = useRef(false);
  const startMaruAudio = (pool, fast) => {
    rebuildStop();
    setMode(0);
    setSource('review');
    setCustomReviewIds(pool.map((q) => q.id));
    setReviewOffsetPersist(0);
    setReviewTarget(null);
    setSessionGradedCount(0);
    setSessionWrong([]);
    setSessionWrongKinds({});
    setSessionLatencies([]);
    setVoiceAnswerStats({ attempts: 0, matched: 0 });
    audioSessionKindRef.current = fast ? 'maruFast' : 'maruReview';
    quickMinuteActiveRef.current = null;
    // 高速回転は問題文を省略して読む。自分でオンにしていなかった時は、この束が終わったら元に戻す
    // （以前はオンのまま残り、ふつうの読み上げでも問題文が読まれなくなっていた）。
    if (fast && !skipQuestionText) { setSkipQuestionText(true); fastSkipAutoRef.current = true; }
    onToast?.(fast ? `⚡ ○の高速回転を音声で始めます（${pool.length}問）` : `📝 ○の見直しを音声で始めます（${pool.length}問）`);
    requestAutoPlay();
  };
  // 弱点タグ（学習(10・60・300・900)のweakTagsと同じ単一の正=weakClusters.jsを移植。タップでキーワードしぼり）。
  const weakAudioTags = useMemo(
    () => weakTagClusters(history, questions, links, { minWrong: 2, limit: 8 }),
    [history, questions, links]
  );

  // 連結の工夫（プラン構造を変えるもの＝再構築が必要）
  const [chain, setChain] = useState(false); // #1 関連へ連鎖
  const [summary, setSummary] = useState(true); // #7 まとめ読み
  const [flashcard, setFlashcard] = useState(false); // #8 用語カード
  const [shuffleOn, setShuffleOn] = useState(false);

  // 読み上げの工夫（音声だけ＝再生中でも即反映）
  const [readSubject, setReadSubject] = useState(true); // #2 科目も読む
  const [readHint, setReadHint] = useState(false); // #5 ヒント
  const [reverse, setReverse] = useState(false); // #6 逆向き
  const [readSide, setReadSide] = useState('both'); // 読み上げる面: both | front | back
  const [readChoices, setReadChoices] = useState(false); // 表で選択肢（4択）も読む
  const [firstLetterOnly, setFirstLetterOnly] = useState(false); // #3 頭文字法（選択肢の頭文字だけ読む）
  const [storyPauseOn, setStoryPauseOn] = useState(false); // #4 ストーリー法（場面転換の間を長めに）
  // #7〜#13：科目ごとの決まった読み上げ順（型）を、科目を選んだ時に一度だけ案内する
  // （フリーテキストの解説文を機械的に分解すると誤った切り分けをしかねないため、
  // 問題ごとに読み替えるのではなく型そのものを一言伝えるだけに留める）。
  const [readingTemplateOn, setReadingTemplateOn] = useState(false);
  const templateAnnouncedRef = useRef(null);
  useEffect(() => {
    if (!readingTemplateOn || !filterSubject) return;
    if (templateAnnouncedRef.current === filterSubject) return;
    const hint = readingOrderHintFor(filterSubject);
    if (!hint) return;
    templateAnnouncedRef.current = filterSubject;
    onToast?.(`📐 ${hint}`);
    if (!playing && isSpeechSupported()) {
      cancelSpeech();
      speak(hint, { rate, pitch: settings.speechPitch || 1, voice: selectedVoice() }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingTemplateOn, filterSubject]);
  const [recallMode, setRecallMode] = useState(false); // 記憶定着（想起→答え→反復）
  // 盲目の受験生からの改善提案#2：画面上の二重符号化（キーワードの反転表示）は声には
  // 乗らない。キーワードの前後に読点を入れて一拍おき、声の調子（リズム）だけで
  // 「ここが大事な語」と伝わるようにする（既定オフ。読み方自体が変わるため選べるように）。
  const [keywordEmphasisOn, setKeywordEmphasisOn] = useState(false);
  // #27：倍速にしていても、まだ解いていない新しい問題の問題文だけは等速以下で読む。
  const [newSlowdownOn, setNewSlowdownOn] = useState(false);
  // #14：正解・誤答に関わらず、答えのあとに理解を確認する一言を加える。
  const [whyOnAnswerOn, setWhyOnAnswerOn] = useState(false);
  // #15：「もし〜なら」の逆シナリオ（正常の作用→障害されたときの所見）を読む。
  const [ifThenOn, setIfThenOn] = useState(false);
  // #26：開始時に復習を1問だけ挟む（新しい範囲ばかりに偏らせないため）。
  const [prependReviewOn, setPrependReviewOn] = useState(false);
  // #30：歩行中（モーションセンサーの簡易判定）は速度を少し落とす。既定オフ。
  // 歩行そのものを正確に検知する技術ではなく、体の動きの大きさのばらつきを見る簡易判定
  // （対応していない機種・ブラウザもある。できないことをできるふりに書かない）。
  const [walkingDetectOn, setWalkingDetectOn] = useState(false);
  const motionBufRef = useRef([]);
  const walkingActiveRef = useRef(false);
  useEffect(() => {
    if (!walkingDetectOn || typeof window === 'undefined' || typeof window.DeviceMotionEvent === 'undefined') return;
    let removed = false;
    const handler = (e) => {
      const a = e.accelerationIncludingGravity || e.acceleration;
      if (!a) return;
      const mag = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
      const buf = motionBufRef.current;
      buf.push(mag);
      if (buf.length > 20) buf.shift();
      if (buf.length < 10) return;
      const mean = buf.reduce((s, v) => s + v, 0) / buf.length;
      const variance = buf.reduce((s, v) => s + (v - mean) ** 2, 0) / buf.length;
      const walking = variance > 2;
      if (walking !== walkingActiveRef.current) {
        walkingActiveRef.current = walking;
        // 歩き始めてから速度を変えた時も、いまの速度から計算する（以前は検知を始めた時の速度のまま）
        engine.configure({ rate: effectiveRateOf(rateRef.current) });
      }
    };
    // 許可（iPhone）はスイッチを押した時に求めておく（ここ＝描画のあとで求めると、操作の外なので必ず断られていた）
    if (!removed) window.addEventListener('devicemotion', handler);
    return () => {
      removed = true;
      window.removeEventListener('devicemotion', handler);
      walkingActiveRef.current = false;
      engine.configure({ rate: rateRef.current });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkingDetectOn]);

  const [loop, setLoop] = useState(false);
  const [sleepMin, setSleepMin] = useState(0);

  // 今日の目標（問題数）。0=未設定。聞き終えた問題の数が目標に達したら1回だけ知らせる（声とトースト）。
  const [goal, setGoal] = useState(0);
  const goalNotifiedRef = useRef(false);

  // 今のセッションで △・✕ と自己採点した問題（弱点分析の材料）
  const [sessionWrong, setSessionWrong] = useState([]);
  // sessionWrongは多くの既存呼び出し元が「問題オブジェクトの配列」である前提に依存しているため
  // 構造は変えず、△/✕の種別だけを別の並行state（id→kind）で持つ（学習10・60・300・900の
  // wrongEntriesと同じ区別を音声側でも見せるため）。
  const [sessionWrongKinds, setSessionWrongKinds] = useState({});
  // B3・B4：答えるまでの反応時間（GAPに入ってから自己採点するまでのミリ秒）。
  // forgetting.jsの忘却モデル（保持率の指数減衰）自体は変えず、セッション内の
  // 気づきとして完了時に声で伝えるだけの、安全で小さな追加にとどめる。
  const [sessionLatencies, setSessionLatencies] = useState([]); // [{ms, kind}]
  const gapEnteredAtRef = useRef(null);
  const prevPhaseForLatencyRef = useRef(null);
  // G11・G12：音声版の本番想定モード（午前/午後の配分で連続出題、自己採点のみ・参考スコア）。
  const mockExamStartAtRef = useRef(null);
  const mockExamSessionRef = useRef(null);
  // #64：同じ問題を連続2回外した時、その場で一度だけ別の角度から解説を読み直す
  // （comparisonsForKeywordで紛らわしい対比が見つかればそれも使う）ための読み込みトリガー。
  const [hadWrongStreak, setHadWrongStreak] = useState(false);
  // まぎらわしい対比・数値まとめ（mindmapData.js）は連結モード2/3や弱点分析（3問以上）でしか
  // 使わないため、そのタイミングで遅延読み込みする（起動時バンドルから約14万字ぶんを外すため）。
  const mindmapData = useMindmapData(mode === 2 || mode === 3 || sessionWrong.length >= 3 || hadWrongStreak || !!(settings.audioSpeech && (settings.audioSpeech.compareAfter || settings.audioSpeech.numberFact)));
  const weaknessSummary = useMemo(
    () => buildWeaknessSummary(sessionWrong, links, mindmapData ? mindmapData.COMPARISONS : []),
    [sessionWrong, links, mindmapData]
  );

  // 読み方の手動補正辞書（TTSの誤読を直す）
  const [pfTerm, setPfTerm] = useState('');
  const [pfReading, setPfReading] = useState('');
  // 読み上げ方の工夫（2026-11-23）。誤読の対策（readFix）と図の説明は既定オン、聞きやすさの工夫は既定オフ。
  const speechStyle = { readFix: true, figureDesc: true, homophoneMeridian: true, homophoneKanji: true, ...(settings.audioSpeech || {}) };
  const setSpeechStyle = (patch) => updateSettings({ audioSpeech: { ...(settings.audioSpeech || {}), ...patch } });
  const SPEECH_RECOMMENDED = { readFix: true, figureDesc: true, homophoneMeridian: true, homophoneKanji: true, sentencePause: true, kindLabel: true, bodyWords: true, sunNote: true, meridianFlow: true };
  // 読みの辞書（本人の手動補正 ＞ 経穴カードの読み ＞ よく誤読される言葉 ＞ 経絡・臓腑の読み）
  // 読み上げを整える部品（音声の画面を開いた時に読み込む。読み込み前は本人の手動補正だけで読む）
  const st = useSpeechText(true);
  const readingDict = useMemo(
    () => (st ? st.buildReadingDict({ cards: keiketsuCards || [], termReadings: TERM_READINGS, common: st.SPEECH_READINGS, userFixes: settings.pronunciationFixes || {} }) : []),
    [st, keiketsuCards, settings.pronunciationFixes]
  );
  // 同じ読みの経穴（少海・小海・照海など17組）。経絡・字の説明・場所を添えて聞き分ける（2026-11-24）
  const homophoneInfo = useMemo(
    () => (st && keiketsuCards ? st.buildHomophoneInfo(keiketsuCards, st.HOMOPHONE_KANJI_HINTS) : null),
    [st, keiketsuCards]
  );

  // 盲目の受験生からの改善提案#2：キーワードの前後に読点を入れて一拍おくだけの
  // 純粋な文字列変換（audioEngine.js側の読み上げループやpronunciationの仕組みは変えない。
  // どちらも最終的には1本の文字列を読むだけなので、安全に重ねられる）。
  const emphasizeForSpeech = (text, tags) => {
    if (!keywordEmphasisOn || !text || !Array.isArray(tags) || !tags.length) return text;
    const uniq = Array.from(new Set(tags.filter((tg) => tg && tg.length >= 2))).sort((a, b) => b.length - a.length);
    if (!uniq.length) return text;
    // 複数のタグを順番にsplit/joinすると、短いタグが長いタグの一部（例「橈骨神経」の中の
    // 「神経」）に重ねて当たり、前に入れたはずの読点が食われて壊れることがある（実際に発生を
    // 確認した）。1本の正規表現にまとめて1回だけ置換すれば、同じ位置の重複当たりを防げる
    // （長いタグを先に試すよう並べ替え済みなので、同じ開始位置では長い方が優先される）。
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(uniq.map(esc).join('|'), 'g');
    return text.replace(re, (m) => `、${m}、`)
      .replace(/、{2,}/g, '、')
      .replace(/^、/, '')
      .replace(/([。、])、/g, '$1')
      .replace(/、([。、])/g, '$1');
  };
  // ---- 読み上げ文の部品 ----
  const questionText = (q) => {
    if (!q) return '';
    if (q.question) return emphasizeForSpeech(q.question, effectiveTags(q, links));
    if (q.image) return '図を見て答える問題です。画面をご確認ください。';
    return '';
  };
  // 図表が必要そうな文面なのに画像・図が登録されていない設問（QuestionCard.jsxの警告と同じ基準）。
  // 音声だけでは判断できないので、読み上げにも注意を足し、自己採点を誤らせない。
  const needsFigureWarning = (q) => !!q && !q.image && !q.figure && /[図写真]/.test(q.question || '');
  // 既存の誤答理由の型（QuestionCard.jsxのmissType出し分けと同じ考え方）。
  // 知識不足型は解説の前に一言足し、ケアレス型は問題文の前に注意を足す（音声なので文で表す）。
  const explanationLabel = (q) => (latestMissType(missTypes[q.id])?.type === 'chishiki' ? '知識を補強する解説です。' : '');
  const carelessCaution = (q) => (latestMissType(missTypes[q.id])?.type === 'careless' ? '注意。ケアレスミスの多い問題です。選択肢を最後まで読み、引っかけに気をつけましょう。' : '');
  const answerText = (q) => {
    // 選択肢を持たない問題でも落ちない・「undefined」と読まないように
    const correct = Array.isArray(q.choices) ? q.choices[q.answer] : null;
    const label = q.type === 'ox' ? '正解は、' : `正解は、${q.answer + 1}番、`;
    let t = correct != null && correct !== '' ? `${label}${correct}。` : '';
    if (q.explanation) t += ` 解説。${explanationLabel(q)}${emphasizeForSpeech(q.explanation, [...effectiveTags(q, links), correct || ''])}`;
    return t;
  };
  const answerTextFor = (q, choices, answerIdx) => {
    const correct = choices[answerIdx];
    const label = q.type === 'ox' ? '正解は、' : `正解は、${answerIdx + 1}番、`;
    let t = `${label}${correct}。`;
    if (q.explanation) t += ` 解説。${explanationLabel(q)}${emphasizeForSpeech(q.explanation, [...effectiveTags(q, links), correct || ''])}`;
    return t;
  };
  const shortStem = (q) => {
    const t = questionText(q).replace(/\s+/g, ' ').trim();
    return t.length > 26 ? t.slice(0, 26) + '…' : t;
  };
  // 選択肢の読み方（頭文字法／短く＝かっこの中の補足を外す）
  const choiceSpoken = (c) => (firstLetterOnly ? (c[0] || c) : (st && speechStyle.shortChoices ? st.shortenChoice(c) : c));
  const shortAnswer = (q) => (q.choices ? q.choices[q.answer] || '' : '');
  const flashcardText = (kw, qs) => {
    const notes = qs.map((q) => (links[q.id]?.note || '').trim()).filter(Boolean);
    if (notes.length) return notes.join('。 ');
    const facts = qs.slice(0, 3).map(shortAnswer).filter(Boolean);
    return facts.length ? `要点。${facts.join('。 ')}。` : 'この用語のメモはまだありません。';
  };
  const summaryText = (kw, qs) => {
    const parts = qs.slice(0, 8).map((q) => `${shortStem(q)}は、${shortAnswer(q)}`).filter(Boolean);
    return `キーワード、${kw}のまとめ。${parts.join('。 ')}。`;
  };

  // ---- 再生プラン ----
  const plan = useMemo(() => {
    const buildKw = (kwOrder) => {
      const items = [];
      kwOrder.forEach((kw) => {
        let qs = clusters.get(kw) || [];
        if (qs.length === 0) return;
        if (shuffleOn) qs = shuffle(qs);
        if (flashcard) {
          items.push({ kind: 'flashcard', keyword: kw, text: flashcardText(kw, qs) });
          return;
        }
        qs.forEach((q, i) => {
          items.push({
            kind: 'question',
            q,
            keyword: kw,
            intro:
              i === 0 ? `キーワード、${kw}。関連する問題を${qs.length}問、続けて確認します。` : '',
            note: (links[q.id]?.note || '').trim(),
          });
        });
        if (summary) items.push({ kind: 'summary', keyword: kw, text: summaryText(kw, qs) });
      });
      return items;
    };

    // 件数しぼり込み（学習の10・60・300・900と同じ考え方）。足りなければ繰り返さずそこで
    // 終わる（周回して埋めない、「すべて復習」モードと同じ方針）。「もう一度（同じ件数で
    // 別の問題を）」はreviewOffsetで対象プールの次の束へローテーションする。
    // 連結学習モード（1〜10）からも使うため、mode>0の分岐より前に定義する。
    const applyTarget = (list) => {
      if (!reviewTarget) return list;
      const n = list.length;
      if (n === 0) return list;
      const off = reviewOffset % n;
      const rotated = off === 0 ? list : [...list.slice(off), ...list.slice(0, off)];
      return rotated.slice(0, reviewTarget);
    };

    // ===== 連結モード（検索の下の1〜10）=====
    if (mode > 0) {
      const pool = filterActive ? filteredPool : questions;
      const poolIds = new Set(pool.map((q) => q.id));
      // pool 内のキーワード → 問題 クラスタ
      const cl = new Map();
      pool.forEach((q) =>
        effectiveTags(q, links).forEach((kw) => {
          if (!cl.has(kw)) cl.set(kw, []);
          cl.get(kw).push(q);
        })
      );
      const poolKw = [...cl.keys()];
      const byCount = poolKw.slice().sort((a, b) => cl.get(b).length - cl.get(a).length);
      const seqQ = (qs) => {
        let b = qs;
        if (shuffleOn) b = shuffle(b);
        return b;
      };
      const readCluster = (order, summaryOnly) => {
        const items = [];
        order.forEach((kw) => {
          let qs = cl.get(kw) || [];
          if (!qs.length) return;
          if (shuffleOn) qs = shuffle(qs);
          if (summaryOnly) {
            items.push({ kind: 'summary', keyword: kw, text: summaryText(kw, qs) });
            return;
          }
          qs.forEach((q, i) =>
            items.push({
              kind: 'question',
              q,
              keyword: kw,
              intro: i === 0 ? `キーワード、${kw}。関連する問題を${qs.length}問、続けて確認します。` : '',
              note: (links[q.id]?.note || '').trim(),
            })
          );
          if (summary) items.push({ kind: 'summary', keyword: kw, text: summaryText(kw, qs) });
        });
        return items;
      };
      const weakSort = (qs) => {
        const rank = new Map(weakRanked.map((w, i) => [w.keyword, i]));
        return qs
          .map((q) => {
            const ks = effectiveTags(q, links);
            const best = ks.length ? Math.min(...ks.map((k) => (rank.has(k) ? rank.get(k) : 9999))) : 9999;
            return { q, best };
          })
          .sort((a, b) => a.best - b.best)
          .map((x) => x.q);
      };
      const poolTerms = new Set(poolKw);
      const relevant = (arr) => {
        if (!filterActive) return arr;
        const f = arr.filter((x) => (x.terms || []).some((t) => poolTerms.has(t)));
        return f.length ? f : arr;
      };
      const fallback = () => seqQ(pool).map((q) => ({ kind: 'question', q }));

      // 件数しぼり込み（10・60・300・900）は連結モードでも同じ考え方で効かせる
      // （以前はmode>0の分岐がapplyTargetより前でreturnしていたため、連結学習では
      // 件数の指定が一切効いていなかった）。
      if (mode === 1) return applyTarget(poolKw.length ? readCluster(chainOrder(byCount[0], relatedMap, poolKw)) : fallback());
      if (mode === 2) return applyTarget(mindmapData ? relevant(mindmapData.COMPARISONS).map((c) => ({ kind: 'compare', comp: c })) : []);
      if (mode === 3) return applyTarget(mindmapData ? relevant(mindmapData.NUMBER_FACTS).map((n) => ({ kind: 'number', num: n })) : []);
      if (mode === 4) return applyTarget(seqQ(pool).map((q) => ({ kind: 'cloze', q })));
      if (mode === 5) return applyTarget(weakSort(pool).map((q) => ({ kind: 'question', q })));
      if (mode === 6) return applyTarget(seqQ(pool).map((q) => ({ kind: 'choices', q })));
      if (mode === 7) {
        const CATS = ['現代の医療と社会', '社会保障制度', '医療倫理', '医療と社会', '医療従事者', '医療・福祉施設', '医療経済', '医療保険のしくみ', '公費負担医療', '介護サービス行政', '医療倫理教育', '施術者としての倫理'];
        const order = CATS.filter((c) => cl.has(c));
        if (order.length) return applyTarget(readCluster(order));
        // 上の一覧は医療概論のカテゴリだけなので、ほかの13科目では章ごとにならず、ただ順に読むだけだった。
        // 出題基準のジャンル（q.genre）ごとにまとめて読む（ジャンルを持たない問題は最後にまとめる）。
        const byGenre = new Map();
        pool.forEach((q) => {
          const g = q.genre || '';
          if (!byGenre.has(g)) byGenre.set(g, []);
          byGenre.get(g).push(q);
        });
        if (byGenre.size <= 1 && byGenre.has('')) return applyTarget(fallback());
        const genres = [...byGenre.keys()].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ja'));
        if (byGenre.has('')) genres.push('');
        const items = [];
        genres.forEach((g) => {
          const qs = seqQ(byGenre.get(g));
          qs.forEach((q, i) => items.push({
            kind: 'question', q,
            intro: i === 0 ? `章、${g || 'そのほか'}。${qs.length}問、続けて確認します。` : '',
            note: (links[q.id]?.note || '').trim(),
          }));
        });
        return applyTarget(items);
      }
      if (mode === 8) return applyTarget(poolKw.length ? readCluster(byCount, true) : fallback());
      if (mode === 9) return applyTarget(weakSort(pool).map((q) => ({ kind: 'question', q })));
      if (mode === 10) {
        const dueFirst = reviewPool.filter((q) => poolIds.has(q.id)).map((q) => ({ kind: 'question', q }));
        const seed = dailyKw && cl.has(dailyKw) ? dailyKw : byCount[0];
        const chainItems = seed ? readCluster(chainOrder(seed, relatedMap, poolKw)) : [];
        const seen = new Set();
        return applyTarget([...dueFirst, ...chainItems].filter((it) => {
          if (it.kind !== 'question') return true;
          if (seen.has(it.q.id)) return false;
          seen.add(it.q.id);
          return true;
        }));
      }
      return applyTarget(fallback());
    }
    // 10問ごとに「ここまで◯問、残り◯問」を読み上げる進捗アナウンス項目を差し込む。
    const withProgressAnnounce = (qs) => {
      if (!progressAnnounceOn || qs.length < 10) return qs.map((q) => ({ kind: 'question', q }));
      const items = [];
      qs.forEach((q, i) => {
        items.push({ kind: 'question', q });
        const done = i + 1;
        if (done % 10 === 0 && done < qs.length) items.push({ kind: 'progress', done, remain: qs.length - done });
      });
      return items;
    };

    // #6：紛らわしい名前のペア専用チェックリスト（既存の比較読み上げと同じkind:'compare'構造）。
    if (source === 'confusingPairs') {
      return CONFUSING_PAIRS.map((c) => ({ kind: 'compare', comp: c }));
    }
    // 同じ読みの経穴ドリル（2026-11-24）：組ごとに「いくつある？」→1つずつ「どの字？」
    if (source === 'homophone') {
      return st && homophoneInfo ? st.homophoneDrillItems(homophoneInfo) : [];
    }
    // #1・#2：体の場所法（八会穴等、体の上から下の順で経穴を読む）。
    if (source === 'bodyLocation') {
      const set = BODY_LOCATION_SETS.find((s) => s.id === bodyLocationSetId) || BODY_LOCATION_SETS[0];
      if (!set || !keiketsuCards) return [];
      return set.items.map(({ cardId, bodyPart }) => {
        const card = keiketsuCards.find((k) => k.id === cardId);
        if (!card) return null;
        // I15・I16・M24：keiketsuRecallOnの時だけ「経穴名と経絡は？」の双方向想起を挟む
        // （部位→経穴名・経絡の両方を声に出してから、両方まとめて正解を聞く）。
        if (keiketsuRecallOn) {
          return {
            kind: 'flashcard',
            keyword: card.name,
            recallPrompt: `ここは${bodyPart}です。経穴名と、経絡は？`,
            waitGapSec: 3,
            text: `${card.name}。経絡は、${card.meridian || '（未設定）'}。${card.location || ''}${card.type ? `${card.type}。` : ''}`,
          };
        }
        return {
          kind: 'flashcard',
          keyword: card.name,
          text: `ここは${bodyPart}です。触って確認してください。${card.location || ''}${card.type ? `${card.type}。` : ''}`,
        };
      }).filter(Boolean);
    }
    // #28：宿題リプレイ（「あとで調べる」に登録してから12時間以上経ったものを優先して読み直す）。
    if (source === 'homework') {
      // 以前は問題そのものを並べて返していたため、読み上げの組み立てで item.q が無く画面ごと落ちていた
      const ids = new Set(homeworkIds);
      return withProgressAnnounce(applyTarget(questions.filter((q) => ids.has(q.id))));
    }
    if (source === 'filter') {
      let base = filteredPool;
      // A1：新規:復習の割合（学習10・60・300・900と同じ考え方）。既定null＝未指定なら
      // 従来どおりそのままの検索結果。指定した時だけ比率で混ぜ直す（周回なし・足りない分は
      // そこで終わる＝buildMixedNoRepeatOrderと同じ方針）。
      if (audioNewPct != null && base.length > 0) base = orderedByCustomIds(buildMixedNoRepeatOrder(base, base.length, audioNewPct / 100, srs, caseLinkMap));
      if (shuffleOn) base = shuffle(base);
      if (leechFirst) base = [...base].sort((a, b) => (isLeechState(srs[b.id]) ? 1 : 0) - (isLeechState(srs[a.id]) ? 1 : 0));
      base = adjustCasePairs(base);
      // 件数しぼり込みは「まだ解いていない問題だけ」限定ではなく、検索結果の読み上げ全般に効かせる
      // （reviewTarget/applyTargetは0件時に無反応なので、未指定のままなら従来どおり全件のまま）。
      base = applyTarget(base);
      // #26：新しい問題ばかりに偏らないよう、開始時に復習を1問だけ挟む（既定オフ。
      // 既に復習対象なら重複させない。newOnly時は既存の「まだ解いていない問題だけ」の
      // 専用カードがあるため、そちら以外の普通の検索結果読み上げにも効くようにする）。
      if (prependReviewOn && reviewPool.length > 0 && base.length > 0) {
        const reviewQ = reviewPool.find((q) => !base.some((b) => b.id === q.id));
        if (reviewQ) base = [reviewQ, ...base];
      }
      return withProgressAnnounce(base);
    }
    if (source === 'keyword') {
      if (!hasKeywords) return [];
      let order;
      if (selectedKeyword === ALL_KW || !selectedKeyword) order = kwNames;
      else if (chain) order = chainOrder(selectedKeyword, relatedMap, kwNames);
      else order = [selectedKeyword];
      return buildKw(order);
    }
    if (source === 'daily') {
      if (!hasKeywords || !dailyKw) return [];
      return buildKw(chain ? chainOrder(dailyKw, relatedMap, kwNames) : [dailyKw]);
    }
    if (source === 'weak') {
      if (!hasKeywords) return [];
      return buildKw(weakNames);
    }
    let base;
    if (source === 'review') {
      if (customReviewIds && customReviewIds === frozenReviewIds) {
        return withProgressAnnounce(orderedByCustomIds(customReviewIds));
      }
      base = customReviewIds ? orderedByCustomIds(customReviewIds) : reviewPool;
      // 「誤った問題」モード中でも科目・ジャンル・回でさらに絞り込める
      // （要望：科目選択＋誤った問題の組み合わせ、#24・#25でジャンル・回にも拡張）。
      if (filterSubject) base = base.filter((q) => q.subject === filterSubject);
      if (filterGenre) base = base.filter((q) => q.genre === filterGenre);
      if (filterRound) base = base.filter((q) => isSameRound(q.round, filterRound));
      // 「念のため確認だけ／除外」「先送り中だけ／除外」は、誤答・△✕の一覧（reviewPool）をしぼる設定。
      // 問題を名指しで渡した束（赤い長丸・本番想定・就寝前まとめ・○の見直し・復習画面の「この1問だけ聞く」）
      // にまで効かせると、前に入れたままの設定のせいで問題が消え、0問になることがあった。
      if (!customReviewIds) base = applyNagameAndSnooze(base);
    } else if (source === 'tagged') base = taggedQuestions;
    else base = questions;
    // A1：新規:復習の割合（全件読み上げの時だけ。誤った問題モード・タグ読み上げは対象外）
    if (source !== 'review' && source !== 'tagged' && audioNewPct != null && base.length > 0) {
      base = orderedByCustomIds(buildMixedNoRepeatOrder(base, base.length, audioNewPct / 100, srs, caseLinkMap));
    }
    if (shuffleOn) base = shuffle(base);
    if (leechFirst) base = [...base].sort((a, b) => (isLeechState(srs[b.id]) ? 1 : 0) - (isLeechState(srs[a.id]) ? 1 : 0));
    base = adjustCasePairs(base);
    // 件数しぼり込みは「誤った問題」限定ではなく、タグ読み上げ・全件読み上げにも効かせる
    // （reviewTarget未指定なら従来どおり全件のまま。音声学習×連結学習の要望対応）。
    base = applyTarget(base);
    return withProgressAnnounce(base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, source, selectedKeyword, chain, summary, flashcard, shuffleOn, clusters, kwNames, relatedMap, weakNames, weakRanked, dailyKw, questions, links, reviewPool, taggedQuestions, hasKeywords, filteredPool, filterActive, customReviewIds, leechFirst, srs, mindmapData, filterSubject, filterGenre, filterRound, reviewTarget, reviewOffset, newOnly, progressAnnounceOn, caseLinkMap, nagameOnly, excludeNagame, snoozedOnly, excludeSnoozed, reviewIdSet, snoozeLogState, audioNewPct, bodyLocationSetId, homeworkIds, prependReviewOn, keiketsuCards, keiketsuRecallOn, frozenReviewIds, homophoneInfo, st]);

  const [rate, setRate] = useState(settings.speechRate);
  const rateRef = useRef(rate);
  rateRef.current = rate;
  // 歩いている間は少しゆっくり読む（歩行検知）。速度を設定し直す所はすべてこれを通す
  // （以前は速度の変更・▶のたびに歩行中の減速が消えていた）。
  const effectiveRateOf = (r) => (walkingActiveRef.current ? Math.max(0.7, r * 0.85) : r);
  const [gap, setGap] = useState(settings.gapSeconds);
  // 解答・解説を読み終えてから次の問題へ進むまでの間（秒）。「規定の時間がたったら次へ」の間隔。
  const [nextGap, setNextGap] = useState(settings.nextGapSeconds ?? 1);
  // 👂 耳の疲労対策（#29）：30分再生で自動的に少し下げる音量（既定100%＝1）。
  const [ttsVolume, setTtsVolume] = useState(1);
  const [voices, setVoices] = useState([]);
  const [tagOpen, setTagOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');

  // 画面を切り替えても途切れないよう、再生はモジュール外のエンジンが担当。
  // ここではエンジンの状態を購読して表示・操作するだけ。
  const snap = useAudioEngine();
  const playing = snap.playing;

  const selectedVoice = () => {
    if (!settings.voiceURI) return voices[0] || null;
    return voices.find((v) => v.voiceURI === settings.voiceURI) || voices[0] || null;
  };

  // 声のプリセット（女性3・男性3）を選ぶ。端末の日本語音声＋ピッチ/速度で差をつける。
  const pickVoicePreset = (preset) => {
    const uri = resolveVoiceURI(preset, voices);
    // settings 変更で voice/pitch/rate の各エフェクトが engine を再設定する
    updateSettings({ voicePreset: preset.id, voiceURI: uri, speechPitch: preset.pitch, speechRate: preset.rate });
    setRate(preset.rate);
    // 試聴（今すぐこの声で聞く）
    const voice = uri ? voices.find((v) => v.voiceURI === uri) || null : voices[0] || null;
    cancelSpeech();
    speak('こんにちは。鍼灸国家試験の勉強を、いっしょに始めましょう。', { rate: preset.rate, pitch: preset.pitch, voice }).catch(() => {});
  };

  // 読み方の手動補正辞書（TTSの誤読を直す）。読み上げ直前にだけ置き換える＝表示テキストはそのまま。
  const applyPronunciation = (text) => {
    let t = String(text || '');
    if (!st) {
      // 部品の読み込み前：今までどおり本人の手動補正だけをかける
      const fixes = settings.pronunciationFixes || {};
      for (const term of Object.keys(fixes)) if (term) t = t.split(term).join(fixes[term]);
      return t;
    }
    if (homophoneInfo) {
      t = st.annotateHomophones(t, homophoneInfo, {
        meridian: !!speechStyle.homophoneMeridian, kanji: !!speechStyle.homophoneKanji, location: !!speechStyle.homophoneLocation,
      });
    }
    if (speechStyle.bodyWords) t = st.addBodyWords(t);
    // 誤読の対策がオフの時は、今までどおり本人の手動補正だけをかける
    t = speechStyle.readFix ? st.toSpeechText(t, readingDict) : st.applyReadingDict(t, st.buildReadingDict({ userFixes: settings.pronunciationFixes || {} }));
    if (speechStyle.directionPause) t = st.pauseBeforeDirections(t);
    return t;
  };

  // 1項目を「読み上げステップ（phase／読む文／間）」の配列へ変換。
  // 画面OFF・バックグラウンドではOSの仕様で停止する点は従来どおり。
  const buildStepsRaw = (item) => {
    const K = PHASES.KEYWORD, Q = PHASES.QUESTION, G = PHASES.GAP, A = PHASES.ANSWER, N = PHASES.NOTE;
    const steps = [];
    if (item.kind === 'progress') {
      // ユーザー指定：10問ごとに「残り◯◯問」とだけ声で知らせる（シンプルに）。
      steps.push({ phase: N, say: `残り${item.remain}問です。` });
      steps.push({ wait: 300 });
      return steps;
    }
    if (item.kind === 'flashcard') {
      // I15・I16・M24：体の場所法に想起ステップを重ねる時は、item.recallPrompt／
      // item.waitGapSecで既定の「用語。◯◯。」と間を上書きできる。
      steps.push({ phase: K, say: item.recallPrompt || `用語。${item.keyword}。` });
      steps.push({ phase: G, waitGap: item.waitGapSec != null ? item.waitGapSec : true });
      steps.push({ phase: A, say: item.text });
      if (st && speechStyle.sunNote && st.hasSun(item.text)) steps.push({ phase: N, say: st.SUN_NOTE });
      steps.push({ waitNextGap: true });
      return steps;
    }
    if (item.kind === 'summary') {
      steps.push({ phase: N, say: item.text });
      steps.push({ waitNextGap: true });
      return steps;
    }
    if (item.kind === 'compare') {
      // #5：対比録音の定番テンプレート「くらべます。〜」「ちがいは、〜」を接続語として必ず入れる
      // （ユーザー提供の音声学習ガイドの対比ペア法そのもの。中身は既存のCOMPARISONSデータのまま）。
      const c = item.comp;
      steps.push({ phase: K, say: `くらべます。${c.title}。` });
      // J19：想起練習がオンの時だけ、答えを聞く前に一拍「思い出してみよう」を挟む。
      if (recallMode) steps.push({ phase: G, say: '……どちらがどちらか、思い出してみよう。' });
      steps.push({ phase: G, waitGap: 'cap2' });
      steps.push({ phase: A, say: `${(c.members || []).join('。 ')}。` });
      steps.push({ phase: A, say: c.note ? `ちがいは、${c.note}` : 'ちがいは、それぞれの説明のとおりです。' });
      steps.push({ waitNextGap: true });
      return steps;
    }
    if (item.kind === 'number') {
      const n = item.num;
      steps.push({ phase: K, say: `数字。${n.topic}。` });
      // J18：想起練習がオンの時だけ、数値を聞く前に一拍「数字は？」を挟む。
      if (recallMode) steps.push({ phase: G, say: '……数字は？思い出してみよう。' });
      steps.push({ phase: G, waitGap: 'cap2' });
      steps.push({ phase: A, say: `${n.value}。${n.note || ''}` });
      steps.push({ waitNextGap: true });
      return steps;
    }
    if (item.kind === 'cloze') {
      const cq = item.q;
      // 選択肢を持たない問題で落ちない。○×問題は「○」「×」を伏せても穴埋めにならないので普通に問う。
      const ans = cq.type !== 'ox' && Array.isArray(cq.choices) ? cq.choices[cq.answer] : null;
      const base = cq.explanation || questionText(cq);
      if (ans && base.includes(ans)) {
        steps.push({ phase: Q, say: `穴埋め。${base.split(ans).join('○○（ピー）')}。○○に入るのは何でしょう。` });
        steps.push({ phase: G, waitGap: true });
        steps.push({ phase: A, say: `答えは、${ans}。` });
      } else {
        // 伏せる所が見つからない時に、伏せていない文を読んで「○○に入るのは」と聞いていた
        steps.push({ phase: Q, say: `問題。${questionText(cq)}。${cq.type === 'ox' ? '正しいか、誤りか。' : '答えは何でしょう。'}` });
        steps.push({ phase: G, waitGap: true });
        steps.push({ phase: A, say: answerText(cq) || '答えは画面でご確認ください。' });
      }
      steps.push({ waitNextGap: true });
      return steps;
    }
    if (item.kind === 'choices') {
      const cq = item.q;
      const subj2 = readSubject && cq.subject ? `${cq.subject}。` : '';
      const sc2 = shuffledChoicesFor(cq);
      let t = `${subj2}${st && speechStyle.kindLabel ? st.questionKindText(cq) : ''}問題。${questionText(cq)}。`;
      if (st && speechStyle.figureDesc && st.figureDescription(cq)) t += st.figureDescription(cq);
      else if (needsFigureWarning(cq)) t = `注意。この問題は図を確認しないと判断できません。${t}`;
      if (carelessCaution(cq)) t = `${carelessCaution(cq)}${t}`;
      if (cq.type !== 'ox') sc2.choices.forEach((c, i) => { t += `${i + 1}番、${choiceSpoken(c)}。`; });
      else t += '正しいか、誤りか。';
      steps.push({ phase: Q, say: t });
      steps.push({ phase: G, waitGap: true });
      steps.push({ phase: A, say: answerTextFor(cq, sc2.choices, sc2.answerIdx) });
      steps.push({ waitNextGap: true });
      return steps;
    }
    // ⚡ 問題文を省略し、正解と一言解説だけを素早く読む（ケアレスミス向け）。
    // 「わかっているのに間違えた」場合は問題文の読み直しが不要なため。
    if (skipQuestionText) {
      const sq = item.q;
      // 選択肢を持たない問題（図だけの問題など）で「正解は、undefined」と読まないように
      const correct = Array.isArray(sq.choices) ? sq.choices[sq.answer] : null;
      const label = sq.type === 'ox' ? '正解は、' : `正解は、${sq.answer + 1}番、`;
      let t = correct != null && correct !== '' ? `${label}${correct}。` : answerText(sq);
      if (needsFigureWarning(sq)) t = `注意。この問題は図が必要です。${t}`;
      const firstSentence = sq.explanation ? sq.explanation.split('。')[0] : '';
      if (firstSentence) t += ` ${firstSentence}。`;
      steps.push({ phase: A, say: t });
      steps.push({ waitNextGap: true });
      return steps;
    }
    // 通常の問題（暗記カード：表＝問題〈4択の選択肢も任意〉／裏＝答え）
    const q = item.q;
    // 表（問題）
    const front = [];
    if (item.intro) {
      front.push({ phase: K, say: item.intro });
      // #4：ストーリー法向けに、キーワード（場面）が変わる所の間を長めに取る（既定オフ）。
      front.push({ wait: storyPauseOn ? 1200 : 300 });
    }
    const subj = readSubject && q.subject ? `${q.subject}。` : '';
    let frontText = `${subj}${st && speechStyle.kindLabel ? st.questionKindText(q) : ''}問題。${questionText(q)}。`;
    // 図の説明（図に描かれている内容だけを言葉にしたもの）。説明が無い図は今までどおり注意だけ。
    if (st && speechStyle.figureDesc && st.figureDescription(q)) frontText += st.figureDescription(q);
    else if (needsFigureWarning(q)) frontText = `注意。この問題は図を確認しないと判断できません。${frontText}`;
    if (carelessCaution(q)) frontText = `${carelessCaution(q)}${frontText}`;
    // A1：完全想起モードは選択肢を一切読まない（readChoicesがONでも上書きする）。
    const scFront = (readChoices && !pureRecallOn) ? shuffledChoicesFor(q) : null;
    if (scFront && q.type !== 'ox' && Array.isArray(q.choices)) {
      scFront.choices.forEach((c, i) => { frontText += `${i + 1}番、${choiceSpoken(c)}。`; });
    }
    // 盲目の受験生からの改善提案#27：倍速にしていても、まだ解いたことが無い新しい問題の
    // 問題文だけは等速以下に戻す（既定オフ。audioEngine.jsのstep.rateで1ステップだけ上書き）。
    front.push({ phase: Q, say: frontText, rate: (newSlowdownOn && !answeredIds.has(q.id)) ? Math.min(1, rate) : undefined });
    // 裏（答え）
    const back = [];
    // 対策案29：まだ解いたことの無い問題は、問題文だけでなく解答・解説もゆっくり読む
    const slowNew = newSlowdownOn && !answeredIds.has(q.id) ? Math.min(1, rate) : undefined;
    back.push({ phase: A, say: scFront ? answerTextFor(q, scFront.choices, scFront.answerIdx) : answerText(q), rate: slowNew });
    {
      const tags = effectiveTags(q, links);
      const allText = `${q.question || ''}${q.explanation || ''}${Array.isArray(q.choices) ? q.choices[q.answer] || '' : ''}`;
      // 対策案22：似ているものとのちがい（まぎらわしい対比のデータがある時だけ）
      if (speechStyle.compareAfter && mindmapData) {
        const comp = tags.map((tg) => mindmapData.comparisonsForKeyword(tg)[0]).find(Boolean);
        if (comp) back.push({ phase: N, say: `似ているものとのちがい。${comp.title}。${comp.note || ''}` });
      }
      // 対策案23：数字の要点（数値まとめのデータがある時だけ）
      if (speechStyle.numberFact && mindmapData) {
        const num = tags.map((tg) => mindmapData.numbersForKeyword(tg)[0]).find(Boolean);
        if (num) back.push({ phase: N, say: `数字の要点。${num.topic}は、${num.value}。${num.note || ''}` });
      }
      // 対策案20：寸の目安
      if (st && speechStyle.sunNote && st.hasSun(allText)) back.push({ phase: N, say: st.SUN_NOTE });
      // 対策案28：経絡の流れ
      if (st && speechStyle.meridianFlow) {
        const flow = st.meridianFlowText(`${allText}${tags.join(' ')}`);
        if (flow) back.push({ phase: N, say: flow });
      }
    }
    if (item.note) back.push({ phase: N, say: `つながり。${item.note}` });
    // 語呂合わせノート（kwMeta）に登録済みの語呂合わせがあれば、答えのあとに読む。
    const mnemonicTag = effectiveTags(q, links)[0];
    const mnemonicText = mnemonicTag && kwMeta[mnemonicTag]?.mnemonic;
    if (mnemonicText) back.push({ phase: N, say: `語呂合わせ。${mnemonicText}` });
    // #14：正解時にも理解を確認する一言を加える（既定オフ。誤答時の自己説明ステップとは別に、
    // 正解・誤答に関わらず毎回添える）。
    if (whyOnAnswerOn) back.push({ phase: N, say: 'なぜこの答えか、自分の言葉でもう一度言ってみましょう。' });
    // #15：「もし〜なら」の逆シナリオ（既定オフ。curTagsと同じeffectiveTagsから検索）。
    if (ifThenOn) {
      const scenario = findIfThenScenario(effectiveTags(q, links));
      if (scenario) back.push({ phase: N, say: scenario.text });
    }

    if (readSide === 'front') {
      steps.push(...front);
      steps.push({ waitNextGap: true });
      return steps;
    }
    if (readSide === 'back') {
      steps.push(...back);
      steps.push({ waitNextGap: true });
      return steps;
    }
    // 表面・裏面（両方）
    steps.push(...front);
    // 記憶定着：想起をうながし、追加の間をとる（アクティブリコール）。A1：完全想起モードは
    // recallModeを兼ね、間をさらに長めにとる。
    const effectiveRecall = recallMode || pureRecallOn;
    // ヒントは考える前に言う。以前は考える間（間）のあとに読んでいたため、ヒントを聞いた直後に
    // 正解が流れ、ヒントを使って思い出す時間が無かった。
    if (readHint) {
      const hint = item.keyword || effectiveTags(q, links)[0] || '';
      if (hint) { steps.push({ say: `ヒント。キーワードは、${hint}。` }); steps.push({ wait: 300 }); }
    }
    if (effectiveRecall) steps.push({ phase: G, say: '……答えは？ 思い出してみよう。' });
    // A2：無音の長さを固定（settings.gapSeconds）ではなく、個人の解答ペースから計算し直す
    // （正確な「忘却までの秒数」ではなく、過去の解答テンポに合わせた目安であることを明記）。
    if (adaptiveGapOn) {
      const estSec = estimatedAnswerSeconds(history, q.subject);
      const gapSec = Math.min(8, Math.max(1.5, estSec / 6));
      steps.push({ phase: G, waitGap: gapSec });
    } else if (isFourChoice(q)) {
      // 四択は、問題を読んだあと3秒止まってから解答・解説へ進む（ユーザー指定。選択肢は画面に出し、読まない）
      steps.push({ phase: G, waitGap: FOUR_CHOICE_GAP_SEC });
    } else {
      steps.push({ phase: G, waitGap: true });
    }
    if (effectiveRecall) steps.push({ wait: pureRecallOn ? 2500 : 1600 });
    steps.push(...back);
    // 記憶定着：答えの核心をもう一度（反復で刷り込む）
    if (effectiveRecall) {
      const key = shortAnswer(q) || '';
      if (key) { steps.push({ wait: 400 }); steps.push({ phase: A, say: `大事なところをもう一度。${key}。` }); }
    }
    // ○×問題は「答えは、○」から問題を思い出せないので、逆向き確認は四択・一問一答だけにする
    if (reverse && q.type !== 'ox' && shortAnswer(q)) {
      steps.push({ phase: Q, say: `逆に確認。答えは、${shortAnswer(q)}。これは何を問う問題だったか思い出しましょう。` });
      steps.push({ waitGap: true });
      steps.push({ say: `問題は、${questionText(q)}` });
    }
    steps.push({ waitNextGap: true });
    return steps;
  };
  // 読み上げ文にだけ手動補正辞書を適用（画面表示のテキストには影響しない）。
  // アウトプットモード（outputModeOn）の時は、問題→正解の「間」（waitGap）を
  // 自動タイマーではなく手動操作（waitManual）に置き換える——1箇所で変換するので
  // 項目の種類（通常問題／クローズ／選択肢／比較／数字／暗記カード）ごとに個別対応しなくてよい。
  const buildSteps = (item) => buildStepsRaw(item).flatMap((s) => {
    // 対策案16・17：長い解答・解説は文ごとに区切り、間を入れる
    if (st && speechStyle.sentencePause && s.say && (s.phase === PHASES.ANSWER || s.phase === PHASES.NOTE)) {
      const parts = st.splitSentences(s.say);
      if (parts.length > 1) {
        return parts.flatMap((part, i) => {
          const one = toStep({ ...s, say: part }, item);
          return i < parts.length - 1 ? [one, { wait: 500 }] : [one];
        });
      }
    }
    return [toStep(s, item)];
  });
  const toStep = (s, item) => {
    let step = s.say ? { ...s, say: applyPronunciation(s.say) } : s;
    // C5：声で解答モードも、答える前に自動タイマーで進まず待つ必要があるため、
    // アウトプットモードと同じwaitManualの仕組みに相乗りする（item.kind==='question'だけ
    // ――比較・数値・用語カード等は「声で何を答えるか」が定義できないため対象外）。
    const manualize = outputModeOn || (voiceAnswerOn && item.kind === 'question');
    // 手動で待つのは「考え中」の間だけ。逆向き確認（逆に確認→間→問題は）の間まで手動にすると、
    // 「解答を見る」ボタンが出ない段で止まったままになっていた（声で解答も同じく聞き取りが始まらない）。
    if (manualize && step.waitGap && step.phase === PHASES.GAP) {
      const { waitGap, ...rest } = step;
      step = { ...rest, waitManual: true };
    }
    return step;
  };

  // 再生計画（steps＝読み上げ手順, display＝画面表示用にそのままの item）
  const builtPlan = useMemo(
    () => plan.map((item) => ({ steps: buildSteps(item), display: item })),
    [plan, readSubject, readHint, reverse, readSide, readChoices, recallMode, skipQuestionText, shuffleChoicesOn, kwMeta, links, settings.pronunciationFixes, outputModeOn, keywordEmphasisOn, newSlowdownOn, answeredIds, rate, firstLetterOnly, storyPauseOn, whyOnAnswerOn, ifThenOn, voiceAnswerOn, pureRecallOn, adaptiveGapOn, keiketsuRecallOn, gap, settings.audioSpeech, readingDict, mindmapData, st, homophoneInfo] // eslint-disable-line react-hooks/exhaustive-deps
  );
  // 構成が同じなら（画面を離れて戻ってきた等）再生位置を保つための署名
  const planSig = useMemo(
    () => JSON.stringify([
      source, mode, selectedKeyword, chain, summary, flashcard, shuffleOn,
      readSubject, readHint, reverse, readSide, readChoices, recallMode, filterSubject, filterGenre, filterKeyword, filterRound,
      reviewTarget, reviewOffset, newOnly, progressAnnounceOn, skipQuestionText, outputModeOn,
      questions.length, plan.length,
      // 間違えた問題などの「id配列で渡された束」は、件数が同じでも中身が違えば別の計画として扱う
      // （以前は件数しか見ておらず、同じ件数の別の束へ切り替えても前の束のまま読み続けていた）。
      source === 'review' && customReviewIds ? idsSignature(customReviewIds) : '',
      customReviewIds && customReviewIds === frozenReviewIds ? 'frozen' : '',
    ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, mode, selectedKeyword, chain, summary, flashcard, shuffleOn, readSubject, readHint, reverse, readSide, readChoices, recallMode, filterSubject, filterGenre, filterKeyword, filterRound, reviewTarget, reviewOffset, newOnly, progressAnnounceOn, skipQuestionText, outputModeOn, questions.length, plan.length, customReviewIds, frozenReviewIds]
  );

  // 件数（plan.length）以外の条件だけの署名（件数だけ変わったかを見分ける）
  const loadedBaseRef = useRef('');
  const planSigBase = (sig) => { try { const a = JSON.parse(sig); a[24] = null; return JSON.stringify(a); } catch { return sig; } };
  // 保存済みの再生位置（続きから）。マウント時に一度だけ読み込む。
  const [audioReady, setAudioReady] = useState(false);
  const resumeAudioRef = useRef(null);
  // 別の画面から問題を渡されて開いたか（下の reviewPreset の効果で立てる。自動の復元より優先）
  const handoffRef = useRef(!!reviewPreset);
  useEffect(() => {
    let alive = true;
    storage.loadAudioProgress().then((idbP) => {
      if (!alive) return;
      const p = newerProgress(idbP, loadAudioProgressSync());
      resumeAudioRef.current = p && typeof p.index === 'number' ? p : null;
      // 画面を切り替えて戻った・バックグラウンドから復帰した（Androidがタブを回収した等で
      // 実際にはページが再読み込みされた）場合、「前回の続きから」ダイアログ（resumeFilters）を
      // 経由しない通常の再訪問でも、直前に読んでいた科目・ジャンル・キーワード・回の絞り込みを
      // 自動で引き継ぐ（ユーザー指定・2026-11-14「さっきまで再生した音声の記憶が残るように」）。
      // すでにresumeFiltersで復元済みの時は上書きしない（cameFromResumeRefと同じ判定）。
      // 誤答・△✕を聞いていた時は、その束（まだ聞いていない問題だけ）へ静かに戻す（勝手に再生はしない）
      // 復習画面などから「この問題を聞く」で渡されて開いた時（reviewPreset）は、その指定を優先し、
      // 前回の束・絞り込みで上書きしない（以前は読み込みが後から届いて、渡された問題が消えていた）。
      const handedOff = handoffRef.current;
      const revEntry = !handedOff && !resumeFilters && !pendingJumpRef.current && p && p.reviewKey
        ? loadAudioHistory().find((h) => h.key === p.reviewKey && !h.done) : null;
      if (revEntry) {
        applyReviewEntry(revEntry, false);
        cameFromResumeRef.current = false;
      } else if (!handedOff && !resumeFilters && !pendingJumpRef.current && p && (p.subject || p.genre || p.keyword || p.round)) {
        setSource('filter');
        if (p.subject) setFilterSubject(p.subject);
        if (p.genre) setFilterGenre(p.genre);
        if (p.keyword) setFilterKeyword(p.keyword);
        if (p.round) setFilterRound(p.round);
      }
      setAudioReady(true);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 計画をエンジンへ（同じ署名なら位置を保持。保存位置があれば続きから）
  useEffect(() => {
    if (!audioReady) return;
    const saved = resumeAudioRef.current;
    const startIndex = saved && saved.sig === planSig ? saved.index : 0;
    // 間違えた問題（△✕）を聞いている最中に自己採点すると、マスターした問題が復習対象から外れる・
    // 念のため確認が増える等で「件数だけ」が変わる。以前はこれで計画が読み込み直され、
    // 再生が途中で止まっていた（実際のバグ）。条件は同じで件数だけ変わった時は、聞いている束をそのまま続ける。
    const base = planSigBase(planSig);
    const snapNow = engine.getSnapshot();
    if (snapNow.started && source === 'review' && mode === 0 && loadedBaseRef.current === base && snapNow.planSig !== planSig) {
      return;
    }
    loadedBaseRef.current = base;
    // 別の束を読み込んだ時だけ、60問区切りの印を数え直す（件数だけ変わって読み込み直さない時は
    // 戻さない——戻すと61問目を自己採点した瞬間に同じ区切りでもう一度休憩に入っていた）
    if (snapNow.planSig !== planSig) breakNotifiedRef.current = -1;
    engine.load(builtPlan, { sig: planSig, startIndex });
  }, [builtPlan, planSig, audioReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ○の高速回転で自動的に入れた「問題文を省略」を、その束を聞き終えた・閉じた時に元へ戻す
  const prevStartedRef = useRef(false);
  useEffect(() => {
    if (prevStartedRef.current && !snap.started && fastSkipAutoRef.current) {
      fastSkipAutoRef.current = false;
      setSkipQuestionText(false);
    }
    prevStartedRef.current = snap.started;
  }, [snap.started]);

  // 「選んだらそのまま再生」（requestAutoPlay）を、計画を読み込んだ直後に1回だけ実行する
  useEffect(() => {
    if (!autoPlayReqRef.current || !audioReady || builtPlan.length === 0) return;
    const t = setTimeout(() => {
      if (!autoPlayReqRef.current) return;
      autoPlayReqRef.current = 0;
      if (!engine.getSnapshot().playing) togglePlayRef.current?.();
    }, 60);
    return () => clearTimeout(t);
  }, [builtPlan, planSig, audioReady]);

  // 履歴の位置へ飛ぶ：絞り込みが履歴と同じになり、計画が読み込まれてから一度だけ（上の効果の後に走る）
  useEffect(() => {
    const j = pendingJumpRef.current;
    if (!j || !audioReady) return;
    if (j.review) {
      // 誤答・△✕：束（id配列）が入れ替わり、計画が組み上がってから最初の問題へ
      const ready = mode === 0 && source === 'review' && customReviewIds === j.playIds && frozenReviewIds === j.playIds;
      if (!ready) {
        if (Date.now() - j.at > 4000) pendingJumpRef.current = null;
        return;
      }
      pendingJumpRef.current = null;
      if (builtPlan.length === 0) {
        reviewSessionRef.current = null;
        setFrozenReviewIds(null);
        setCustomReviewIds(null);
        deleteAudioHistory(j.key);
        onToast?.('⚠️ この履歴の問題が、今は見つかりませんでした（履歴から外しました）。');
        return;
      }
      if (reviewSessionRef.current) reviewSessionRef.current.sig = planSig;
      engine.seekTo(0);
      if (j.done) onToast?.(`前回は最後まで聞き終えていたので、最初から（全${builtPlan.length}問）流します`);
      else if (j.heardCount > 0) onToast?.(`聞き終えた${j.heardCount}問を除いて、まだ聞いていない${builtPlan.length}問を流します`);
      if (j.autoPlay) setTimeout(() => { if (!engine.getSnapshot().playing) togglePlayRef.current?.(); }, 250);
      return;
    }
    const matched = mode === 0 && source === j.source && filterSubject === j.subject && filterGenre === j.genre
      && filterKeyword === j.keyword && String(filterRound || '') === j.round
      && (reviewTarget || null) === (j.target ?? null) && (reviewOffset || 0) === (j.offset || 0);
    if (!matched) {
      // 絞り込みがそろわないまま時間が経った飛び先は捨てる（残しておくと、あとで本人が同じ科目を
      // 選んだ時に急に飛ぶ・再生履歴の記録が止まったままになる）
      if (Date.now() - j.at > 4000) pendingJumpRef.current = null;
      return;
    }
    if (builtPlan.length === 0) {
      pendingJumpRef.current = null;
      // 0問のまま絞り込みを残さない（画面の選択欄と中身が食い違う）。飛べない履歴も消す。
      setSource('all');
      setFilterSubject(''); setFilterGenre(''); setFilterKeyword(''); setFilterRound('');
      deleteAudioHistory(j.entryKey || historyKeyOf(j));
      onToast?.('⚠️ この履歴の条件に合う問題が、今は見つかりませんでした（履歴から外しました）。');
      return;
    }
    pendingJumpRef.current = null;
    const { index: target, moved } = resolveJumpIndex(j, builtPlan.map((it) => it.display?.q?.id ?? null));
    engine.seekTo(target);
    if (moved) {
      onToast?.(`問題の並びが前回と変わっているため、近い位置（${target + 1} / ${builtPlan.length}）から始めます`);
    }
    if (j.autoPlay) {
      // seekToは再生中ならそのまま続きを読む。止まっていた時だけ、ここで再生を始める
      setTimeout(() => { if (!engine.getSnapshot().playing) togglePlayRef.current?.(); }, 250);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpNonce, audioReady, builtPlan, planSig, mode, source, filterSubject, filterGenre, filterKeyword, filterRound, customReviewIds, frozenReviewIds]);

  // 再生履歴（下部ミニプレーヤー用）：実際に再生している間だけ、どこまで聞いたかを残す。
  // 残すのは通常の読み上げ（科目などを選んで読む／すべて読む）だけ——連結学習モードや
  // 間違えた問題は同じ並びを再現できないので、押しても飛べない履歴を作らない。
  useEffect(() => {
    // 取り残された飛び先（4秒たっても絞り込みがそろわなかったもの）は、ここで捨てる
    if (pendingJumpRef.current && Date.now() - pendingJumpRef.current.at > 4000) pendingJumpRef.current = null;
    if (!audioReady || !snap.playing || pendingJumpRef.current) return;
    if (mode !== 0 || (source !== 'filter' && source !== 'all') || builtPlan.length === 0) return;
    const d = snap.display;
    const q = d?.q;
    recordAudioHistory({
      subject: source === 'filter' ? filterSubject : '', genre: source === 'filter' ? filterGenre : '',
      keyword: source === 'filter' ? filterKeyword : '', round: source === 'filter' ? filterRound : '',
      index: snap.index || 0, total: builtPlan.length,
      label: (q && q.subject) || '',
      text: (q && q.question) || d?.keyword || '',
      qid: q?.id ?? '',
      target: reviewTarget || null, offset: reviewOffset || 0,
      at: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.index, snap.playing, audioReady, builtPlan.length, mode, source, filterSubject, filterGenre, filterKeyword, filterRound]);
  // 最後まで聞き終えたら、その履歴に「聞き終えた」印を付ける（次は最初から始める）
  useEffect(() => {
    if (!snap.finished || !audioReady || pendingJumpRef.current) return;
    if (mode !== 0 || (source !== 'filter' && source !== 'all') || builtPlan.length === 0) return;
    recordAudioHistory({
      subject: source === 'filter' ? filterSubject : '', genre: source === 'filter' ? filterGenre : '',
      keyword: source === 'filter' ? filterKeyword : '', round: source === 'filter' ? filterRound : '',
      index: 0, total: builtPlan.length, label: '', text: '', done: true,
      target: reviewTarget || null, offset: reviewOffset || 0, at: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.finished]);

  // 誤答・△✕などの束（source==='review'）の再生履歴（2026-11-15・ユーザー指定）。
  // 並びそのもの（ids）と、解答まで聞き終えた問題（heard）を1問ごとにその場で残す
  // （localStorageへ同期で書くので、閉じる直前の1問も取りこぼさない）。
  const REVIEW_TITLE_PREFIX = { maruReview: '○の見直し', maruFast: '○の高速回転', mockExam: '本番想定', bedtime: '就寝前まとめ' };
  const lastReviewWriteRef = useRef('');
  const lastCompletedSeqRef = useRef(0);
  const writeReviewHistory = (sess, extra = {}) => {
    if (!sess) return;
    const d = snap.display;
    const q = d?.q;
    recordAudioHistory({
      kind: 'review', title: sess.title, sessionKind: sess.sessionKind,
      ids: sess.ids, heard: [...sess.heard],
      index: 0, total: sess.ids.length,
      label: (q && q.subject) || '', text: (q && q.question) || '',
      qid: q?.id ?? '', at: Date.now(), ...extra,
    });
    // 「前回の続きから」の残り◯問も、聞いた印に合わせてその場で直す（同期の控えだけ書き換える）
    const p = loadAudioProgressSync();
    if (p && p.reviewKey === sess.key) {
      saveAudioProgressSync({ ...p, reviewRemaining: Math.max(0, sess.ids.length - sess.heard.size), at: Date.now() });
    }
  };
  useEffect(() => {
    if (!audioReady || pendingJumpRef.current) return;
    if (mode !== 0 || source !== 'review' || builtPlan.length === 0) return;
    if (!snap.playing && !snap.started) return;
    const ids = builtPlan.map((it) => it.display?.q?.id).filter((id) => id != null).map(String);
    if (ids.length === 0) return;
    let sess = reviewSessionRef.current;
    // 同じ束の一部（まだ聞いていない問題だけ流している・条件で絞った等）へ組み直しただけなら、
    // 元の並びと聞いた印はそのまま持ち続ける（新しい束として作り直すと、聞いた印が消える）
    if (sess && sess.sig && sess.sig !== planSig) {
      const all = new Set(sess.ids);
      if (ids.every((id) => all.has(id))) sess.sig = planSig;
    }
    if (!sess || (sess.sig && sess.sig !== planSig)) {
      // 新しい束。題は「誤答・△✕ 解剖学」のように、束の中の科目から作る
      const subjects = [...new Set(builtPlan.map((it) => it.display?.q?.subject).filter(Boolean))];
      const subjLabel = subjects.length === 0 ? '' : subjects.length <= 2 ? subjects.join('・') : `${subjects.length}科目`;
      const kind = audioSessionKindRef.current || '';
      const title = `${REVIEW_TITLE_PREFIX[kind] || '誤答・△✕'}${subjLabel ? ` ${subjLabel}` : ''}`;
      const key = historyKeyOf({ kind: 'review', title });
      // 同じ題の束が組み直されただけ（自己採点で復習対象から外れた等）なら、聞いた印を引き継ぐ
      // （閉じて開き直した直後に同じボタンから始め直した時も、12時間以内の同じ題の記録なら引き継ぐ）
      const prevSame = sess && sess.key === key ? sess
        : loadAudioHistory().find((h) => h.key === key && !h.done && Date.now() - (h.at || 0) < 12 * 3600 * 1000);
      const prevHeard = prevSame ? new Set([...(prevSame.heard || [])]) : new Set();
      sess = { key, title, sessionKind: kind, ids, heard: new Set(ids.filter((id) => prevHeard.has(id))), sig: planSig };
      reviewSessionRef.current = sess;
    } else if (!sess.sig) sess.sig = planSig;
    if (!snap.playing) return;
    // 今の問題の解答（または解説）まで読み進んだら「聞いた」に入れる
    const curId = snap.display?.q?.id;
    if (curId != null && (snap.phase === PHASES.ANSWER || snap.phase === PHASES.NOTE)) sess.heard.add(String(curId));
    // 表面だけ・裏面だけの読み上げには解答の段が無いので、1件を最後まで読み終えた知らせでも数える
    if (snap.completedId != null && snap.completedSeq !== lastCompletedSeqRef.current) {
      lastCompletedSeqRef.current = snap.completedSeq;
      if (sess.ids.includes(String(snap.completedId))) sess.heard.add(String(snap.completedId));
    }
    // 変わった時だけ書く（読み上げの段が切り替わるたびに大きな履歴を書き直さない）
    const mark = `${sess.key}|${curId}|${sess.heard.size}|${sess.ids.length}`;
    if (lastReviewWriteRef.current === mark) return;
    lastReviewWriteRef.current = mark;
    writeReviewHistory(sess);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.index, snap.playing, snap.phase, snap.completedSeq, audioReady, builtPlan, planSig, mode, source]);
  // 下部バーの「💾 ここを保存」用：いま聞いているところを、再生履歴の1件の形で渡す。
  // 通常の読み上げ（科目などを選んで読む／すべて読む）と、誤答・△✕などの束だけが保存できる。
  useEffect(() => {
    setCurrentAudioContext(() => {
      const q = engine.getSnapshot().display?.q;
      const idx = engine.getSnapshot().index || 0;
      if (mode !== 0 || builtPlan.length === 0) return null;
      if (source === 'review') {
        const sess = reviewSessionRef.current;
        if (!sess) return null;
        return {
          kind: 'review', title: sess.title, sessionKind: sess.sessionKind, ids: sess.ids, heard: [...sess.heard],
          index: 0, total: sess.ids.length, label: q?.subject || '', text: q?.question || '', qid: q?.id ?? '',
        };
      }
      if (source !== 'filter' && source !== 'all') return null;
      return {
        subject: source === 'filter' ? filterSubject : '', genre: source === 'filter' ? filterGenre : '',
        keyword: source === 'filter' ? filterKeyword : '', round: source === 'filter' ? filterRound : '',
        index: idx, total: builtPlan.length, label: q?.subject || '', text: q?.question || '', qid: q?.id ?? '',
        target: reviewTarget || null, offset: reviewOffset || 0,
      };
    });
  });
  useEffect(() => () => setCurrentAudioContext(null), []);
  // 誤答・△✕の束を最後まで聞き終えた
  useEffect(() => {
    if (!snap.finished || source !== 'review' || mode !== 0) return;
    const sess = reviewSessionRef.current;
    if (!sess) return;
    // 最後の1件の「読み終えた」知らせは、終わりの知らせと同じ描画で届くので、ここで拾う
    if (snap.completedId != null && sess.ids.includes(String(snap.completedId))) sess.heard.add(String(snap.completedId));
    lastCompletedSeqRef.current = snap.completedSeq;
    // 声の「全部できた」で終えた時だけ、残りも聞いたことにする。自然に最後まで来た時は、
    // ⏭で飛ばした問題を「聞いた」にしない（次に開いた時、飛ばした問題だけ流す）。
    if (snap.finishedBy === 'now') sess.ids.forEach((id) => sess.heard.add(id));
    writeReviewHistory(sess, { qid: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.finished]);
  // 並びをそのまま流している間に、本人が科目・件数・並べ方などの条件を変えたら、その条件を効かせる
  // （固定したままだと、選んだ科目や件数チップが何も効かないように見える）。
  const frozenCtxRef = useRef('');
  const reviewCtx = JSON.stringify([filterSubject, filterGenre, filterRound, nagameOnly, excludeNagame, snoozedOnly, excludeSnoozed, shuffleOn, leechFirst, reviewTarget, reviewOffset]);
  useEffect(() => {
    if (!frozenReviewIds) { frozenCtxRef.current = ''; return; }
    if (!frozenCtxRef.current) { frozenCtxRef.current = reviewCtx; return; }
    if (frozenCtxRef.current !== reviewCtx) { frozenCtxRef.current = ''; setFrozenReviewIds(null); }
  }, [reviewCtx, frozenReviewIds]);
  // 誤答・△✕から離れたら、束の記録はそこで区切る（履歴そのものは残る）
  // ※「誤答・△✕だった状態から離れた」時だけ。初回の描画（履歴から開いた直後はまだsourceが
  //   'filter'のまま）で消すと、履歴から組み直した束の記録がその場で消えてしまう。
  const wasReviewRef = useRef(false);
  useEffect(() => {
    const isReview = source === 'review' && mode === 0;
    if (wasReviewRef.current && !isReview) reviewSessionRef.current = null;
    wasReviewRef.current = isReview;
  }, [source, mode]);

  // 「はい」で開いた時だけ、検索カード等を飛ばしてプレーヤーまで自動スクロールする。
  // 保存済みの続きから位置の反映（上の効果）を待ってから行う（1回だけ）。
  // 画面上部の固定ヘッダー（.app-header、position:sticky）の高さぶんは必ず差し引く——
  // 素の scrollIntoView(block:'start') だとヘッダーの裏に隠れてプレーヤー上段
  // （問題番号・今日の目標の行）が見えなくなることを実機で確認したため。
  const playerRef = useRef(null);
  // #11：プレーヤー領域のスワイプ操作（左へスワイプ＝次へ・右へスワイプ＝前へ）。
  // 縦方向の移動（ページスクロール）の方が大きい時は無視し、画面スクロールの邪魔をしない。
  const swipeStartRef = useRef(null);
  const onPlayerTouchStart = (e) => {
    if (!swipeNavOn) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    // 問題番号バー・ボタンの上で指を動かした時はスワイプにしない（バーを横へドラッグすると
    // 「スワイプで次へ」まで同時に起きて、飛んだ先からさらに1問ずれていた）
    if (e.target && e.target.closest && e.target.closest('.player-seek-wrap, .player-controls, input, button')) {
      swipeStartRef.current = null;
      return;
    }
    swipeStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const onPlayerTouchEnd = (e) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!swipeNavOn) return;
    const t = e.changedTouches && e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    // 派生#11：スワイプ後に「◯問目に移動しました」と一言トースト（移動したこと自体のフィードバック）。
    if (dx < 0) {
      if (index < total - 1) { skip(1); onToast?.(`${index + 2} / ${total} へ移動しました`); }
    } else if (index > 0) {
      skip(-1);
      onToast?.(`${index} / ${total} へ移動しました`);
    }
  };
  useEffect(() => {
    if (!cameFromResumeRef.current || !audioReady || builtPlan.length === 0) return;
    cameFromResumeRef.current = false;
    const t = setTimeout(() => {
      const el = playerRef.current;
      if (!el) return;
      const headerH = document.querySelector('.app-header')?.getBoundingClientRect().height || 0;
      const top = el.getBoundingClientRect().top + window.scrollY - headerH - 8;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }, 50);
    return () => clearTimeout(t);
  }, [audioReady, builtPlan.length, jumpNonce]);

  // 再生位置を1問ごとに保存（続きから用）。読み込み完了後のみ。
  // 二重記録防止の対象id（gradedIdsRef）も一緒に保存する——保存しないと、閉じて「続きから」
  // 再開した時にガードが空に戻り、閉じる前に自己採点済みだった問題を二重記録できてしまう
  // （Session.jsxのsession.recordedIdsはセッション自体に保存されるため、この問題が無い）。
  useEffect(() => {
    if (!audioReady || !planSig) return;
    const prog = {
      sig: planSig,
      index: snap.index || 0,
      at: Date.now(),
      graded: [...gradedIdsRef.current],
      total: builtPlan.length,
      // アプリ起動時の「前回の続きから」ダイアログ（App.jsx）向け：科目/ジャンル/キーワード/回の
      // 検索結果読み上げ（source==='filter'）の時だけ、同じ絞り込みを再現できるように持つ。
      // 連結学習モード・間違えた問題・キーワード単位の読み上げ等は対象外（再現が複雑になるため）。
      subject: source === 'filter' ? (filterSubject || null) : null,
      genre: source === 'filter' ? (filterGenre || null) : null,
      keyword: source === 'filter' ? (filterKeyword || null) : null,
      round: source === 'filter' ? (filterRound || null) : null,
      // 誤答・△✕の束：閉じて開き直した時・前回の続きからダイアログで同じ束へ戻るための目印
      ...(source === 'review' && mode === 0 && reviewSessionRef.current ? {
        reviewKey: reviewSessionRef.current.key,
        reviewTitle: reviewSessionRef.current.title,
        reviewRemaining: Math.max(0, reviewSessionRef.current.ids.length - reviewSessionRef.current.heard.size),
      } : {}),
    };
    saveAudioProgressSync(prog); // 閉じる直前でも残るよう、同期で先に書く
    storage.saveAudioProgress(prog);
    // 自己採点した直後にも書く（以前は次の問題へ進むまで書かず、採点してすぐ閉じると二重記録防止が消えていた）
  }, [snap.index, planSig, audioReady, builtPlan.length, source, filterSubject, filterGenre, filterKeyword, filterRound, sessionGradedCount]);

  // 設定画面で変えた速度・間をこの画面にも反映する。再生中は画面を閉じても残るので、
  // 以前は設定画面で変えても、ここで▶を押した瞬間に古い値で設定を書き戻していた。
  useEffect(() => { const v = Number(settings.speechRate); if (v && v !== rateRef.current) setRate(v); }, [settings.speechRate]);
  useEffect(() => { if (Number.isFinite(settings.gapSeconds)) setGap(settings.gapSeconds); }, [settings.gapSeconds]);
  useEffect(() => { if (Number.isFinite(settings.nextGapSeconds)) setNextGap(settings.nextGapSeconds); }, [settings.nextGapSeconds]);
  // 再生設定をエンジンへ反映（再生中でも即時）
  useEffect(() => { engine.configure({ rate: effectiveRateOf(rate) }); }, [rate]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { engine.configure({ gapSeconds: gap }); }, [gap]);
  useEffect(() => { engine.configure({ nextGapSeconds: nextGap }); }, [nextGap]);
  useEffect(() => { engine.configure({ loop }); }, [loop]);
  // 👂 耳の疲労対策（#29）：30分再生したら音量を少し下げる提案に使う音量（既定100%）。
  useEffect(() => { engine.configure({ volume: ttsVolume }); }, [ttsVolume]);
  // 🔋 Wake Lock（画面点灯の維持）をオフにできる設定（バッテリーを気にする人向け）
  useEffect(() => { engine.configure({ wakeLockEnabled: settings.audioWakeLockOff !== true }); }, [settings.audioWakeLockOff]);
  useEffect(() => { engine.configure({ voice: selectedVoice(), pitch: settings.speechPitch || 1 }); }, [voices, settings.voiceURI, settings.speechPitch]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    engine.configure({ cloneVoice: cloneActive ? { apiKey: voiceCloneApiKey, voiceId: voiceClone.voiceId } : null });
  }, [cloneActive, voiceCloneApiKey, voiceClone.voiceId]);

  useEffect(() => {
    loadVoices().then((vs) => setVoices(vs.filter((v) => v.lang && v.lang.startsWith('ja'))));
    // ※ 画面を離れても再生を続けるため、アンマウント時に停止しない（エンジンが保持）。
  }, []);

  // 「間違えた問題」から音声で復習：復習セットに切り替える（「今日のおすすめ」バナーからも使う）
  const startReviewSource = () => {
    engine.stop();
    setFilterSubject('');
    setFilterGenre('');
    setFilterKeyword('');
    // 回も外す（以前は外し忘れていて、前に選んだ回だけが残り、誤答・△✕がその回の分しか流れなかった）
    setFilterRound('');
    setMode(0);
    setSource('review');
    setCustomReviewIds(null);
    setReviewOffsetPersist(0);
    requeuedRef.current = false;
    setSessionGradedCount(0);
    setSessionWrong([]);
    setSessionWrongKinds({});
    setSessionLatencies([]);
    setVoiceAnswerStats({ attempts: 0, matched: 0 });
    audioSessionKindRef.current = null;
    quickMinuteActiveRef.current = null;
  };
  useEffect(() => {
    if (!reviewPreset) return;
    handoffRef.current = true;
    startReviewSource();
    const ids = typeof reviewPreset === 'object' && reviewPreset.ids ? reviewPreset.ids : null;
    if (ids) setCustomReviewIds(ids);
    onConsumePreset?.();
  }, [reviewPreset]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = snap.total || builtPlan.length;
  const index = snap.index;
  const phase = snap.phase;
  const currentItem = snap.display || builtPlan[index]?.display || builtPlan[0]?.display || null;
  const current = currentItem?.q;
  // 「今日の調子」がしんどい日は目標を自動で軽くする（Review.jsxと同じ考え方）
  const effectiveGoal = goal > 0 && mood === 'tired' ? Math.max(5, Math.round(goal * 0.5)) : goal;
  const curTags = current ? effectiveTags(current, links) : [];
  // 画面に出す四択の選択肢（声と同じ順）。通常の問題と「選択肢読み上げ→解答」だけ（穴埋めは答えが見えるので出さない）。
  // 並べ替えるのは、声でも並べ替えて読んでいる時だけ（読まない時は収録どおりの番号で「正解は◯番」と読むため）。
  const shownChoices = (() => {
    if (!isFourChoice(current) || !currentItem) return null;
    if (currentItem.kind === 'choices') return shuffledChoicesFor(current);
    if (currentItem.kind !== 'question') return null;
    // 問題文を省略する高速読みは収録どおりの番号で読む（buildStepsRaw の skipQuestionText と同じ条件）
    if (readChoices && !pureRecallOn && !skipQuestionText) return shuffledChoicesFor(current);
    return { choices: current.choices, answerIdx: current.answer };
  })();
  // A10：問題が切り替わったら、前の問題の「誤答理由をその場で選ぶ」チップを消す
  useEffect(() => { setJustGradedWrongId(null); }, [current?.id]);

  // 今日の目標（問題数）に達したら1回だけ知らせる
  // 以前は「いま何番目にいるか」で数えていたため、問題番号バーで後ろへ飛ぶ・続きから再開するだけで
  // 聞いていないのに「達成」になり、また「声で知らせる」と書いてあるのにトーストだけだった。
  // 最後まで読み終えた問題の数（このセッション内・同じ問題は1回）で数え、達成したら声でも知らせる。
  const goalHeardRef = useRef({ sig: null, seq: null, ids: new Set() });
  const [goalHeardCount, setGoalHeardCount] = useState(0);
  useEffect(() => {
    const g = goalHeardRef.current;
    if (g.sig !== snap.planSig) {
      goalHeardRef.current = { sig: snap.planSig, seq: snap.completedSeq, ids: new Set() };
      setGoalHeardCount(0);
      return;
    }
    if (snap.completedId == null || snap.completedSeq === g.seq) return;
    g.seq = snap.completedSeq;
    if (!g.ids.has(snap.completedId)) { g.ids.add(snap.completedId); setGoalHeardCount(g.ids.size); }
  }, [snap.completedSeq, snap.planSig]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!effectiveGoal) { goalNotifiedRef.current = false; return; }
    if (goalHeardCount >= effectiveGoal) {
      if (!goalNotifiedRef.current) {
        goalNotifiedRef.current = true;
        const msg = `今日の目標、${effectiveGoal}問を達成しました。`;
        onToast?.(`🎯 今日の目標（${effectiveGoal}問）を達成しました！`);
        speak(msg, { rate, pitch: settings.speechPitch || 1, voice: selectedVoice() }).catch(() => {});
      }
    } else {
      goalNotifiedRef.current = false;
    }
  }, [goalHeardCount, effectiveGoal]); // eslint-disable-line react-hooks/exhaustive-deps

  // 件数チップ・まだ解いていない問題チップが対象にしている「束」の件数（なければnull＝すべて）
  const batchTarget = (source === 'review' || (source === 'filter' && newOnly)) ? reviewTarget : null;
  // マスター到達件数の読み上げ（新規）：セッション開始時点のマスター済み累計を覚えておく
  const masteredAtStartRef = useRef(null);
  // A5：周回速度ログ（音声版）の所要時間計測の開始時刻
  const audioSessionStartRef = useRef(null);
  const togglePlay = () => {
    if (!playing) {
      // 🎧 イヤホン接続時だけ自動再生する設定がONの時、確認できていなければ止める
      // 改善案i3：確認済みはその日のうちだけ覚えておく（毎回チェックしなくてよいように）。
      if (headphoneOnly && headphoneHint !== true && settings.audioHeadphoneConfirmedDate !== dateKey()) {
        onToast?.('🎧 イヤホンの接続を確認できませんでした。イヤホンをつないでから、下の「イヤホンを付けています」にチェックしてください。');
        return;
      }
      updateSettings({ speechRate: rate, gapSeconds: gap, nextGapSeconds: nextGap });
      engine.configure({ rate: effectiveRateOf(rate), gapSeconds: gap, nextGapSeconds: nextGap, loop, voice: selectedVoice(), pitch: settings.speechPitch || 1 });
      engine.setSleep(sleepMin);
      // ※ ここで60問区切りの印（breakNotifiedRef）を戻さない。戻すと、休憩バナーの「すぐ続ける」で
      //   再生した瞬間に同じ位置でもう一度休憩に入り、何を押しても続きが流れなかった（実際のバグ）。
      // A5：周回速度ログ（音声版）の所要時間計測用。最初の再生の時刻を覚える
      // （一時停止・再開を挟んでも、最初に再生した時刻からの経過時間として記録する＝
      //   学習10・60・300・900のsession.startedAtと同じ考え方）。
      if (!snap.started) audioSessionStartRef.current = Date.now();
      // 実施ログ（#19）：件数チップを使っている束の、最初の再生だけを「開始」として記録する
      if (!snap.started && (source === 'review' || (source === 'filter' && newOnly)) && total > 0) {
        masteredAtStartRef.current = masteredCount;
        recordAudioReviewStart({
          target: batchTarget, subject: filterSubject || null,
          genre: filterGenre || null, round: filterRound || null, n: engine.getPlanDisplays().filter((d) => d?.q).length || total,
        }).then(setAudioLog);
      }
    }
    engine.toggle();
  };
  togglePlayRef.current = togglePlay;
  const skip = (delta) => engine.skip(delta);
  // 問題番号バー（スクラバー）：ドラッグ中は見た目だけ動かし（音声の飛び先を連打しない）、
  // 指を離した/クリックが確定した時だけ実際にジャンプする（engine.seekTo）。
  const [seekPreview, setSeekPreview] = useState(null);
  // 指を離した時に pointerup・mouseup・touchend が続けて来るので、最新の値を ref で持ち、
  // 1回だけ飛ぶ（state の値だと同じ描画の中で2回目にも古い値が見え、2回飛び直していた）
  const seekPreviewRef = useRef(null);
  const previewSeek = (v) => { seekPreviewRef.current = v; setSeekPreview(v); };
  const commitSeek = () => {
    const v = seekPreviewRef.current;
    seekPreviewRef.current = null;
    setSeekPreview(null);
    if (v == null) return;
    if (v - 1 !== engine.getSnapshot().index) engine.seekTo(v - 1);
  };
  // 問題番号バーの6等分の区切り（赤い点）。両端（1問目・最後）は点を描かないが、◀▶の行き先には含める。
  const seekMarks = useMemo(() => {
    const t = snap.total || builtPlan.length;
    if (!(t > 2)) return [];
    const seen = new Set([1, t]);
    const out = [];
    for (let k = 1; k <= 5; k++) {
      const n = 1 + Math.round(((t - 1) * k) / 6);
      if (seen.has(n)) continue;
      seen.add(n);
      out.push({ n, ratio: (n - 1) / (t - 1) });
    }
    return out;
  }, [snap.total, builtPlan.length]);
  // ◀▶の行き先（1始まりの問題番号）。今いる問題より前／後ろの区切りのうち、いちばん近いもの
  const markTarget = (dir) => {
    const t = snap.total || builtPlan.length;
    if (!(t > 1)) return null;
    const cur = (snap.index || 0) + 1;
    const pts = [1, ...seekMarks.map((m) => m.n), t];
    if (dir < 0) { const c = pts.filter((p) => p < cur); return c.length ? c[c.length - 1] : null; }
    const c = pts.filter((p) => p > cur); return c.length ? c[0] : null;
  };
  const jumpMark = (dir) => {
    const n = markTarget(dir);
    if (n == null) return;
    engine.seekTo(n - 1);
    onToast?.(`${dir < 0 ? '◀' : '▶'} ${n} / ${snap.total || builtPlan.length} へ移動しました`);
  };
  const resetToStart = () => {
    engine.resetToStart();
    storage.clearAudioProgress();
    clearAudioProgressSync();
    // 誤答・△✕の束を最初からにした時は「聞いた」印も外す（外さないと、次に開いた時に
    // まだ聞いていない問題だけ流され、最初からにならなかった）
    if (source === 'review' && reviewSessionRef.current) {
      reviewSessionRef.current.heard = new Set();
      writeReviewHistory(reviewSessionRef.current);
    }
    resumeAudioRef.current = null;
    gradedIdsRef.current = new Set();
    setConfirmAudioReset(false);
  };
  // プラン構造を変える操作は停止（署名が変わればエンジンが先頭から読み直す）
  const rebuildStop = () => engine.stop();

  // 60問区切りで自動的にひと休み（Session.jsxの60問区切りの休憩と同じ考え方、#12）。
  // 件数チップを使っていない「すべて」でも、長時間になりがちなので同じく60問ごとに休憩を挟む
  // （改善案i5。以前は件数チップを使っている時だけだった）。
  const BREAK_EVERY = 60;
  useEffect(() => {
    if (!playing) return;
    if (!(source === 'review' || (source === 'filter' && newOnly))) return;
    // 60問を「聞き終えた」ところ（61問目に入った瞬間）で休む。以前は60問目に入った瞬間に止めていて、
    // 60問目そのものが読まれないまま休憩になっていた。同じ区切りでは1回しか休まない。
    // 数えるのは問題だけ（「残り◯問です」の知らせを挟んでいると、以前は54問で休憩に入っていた）
    const displays = engine.getPlanDisplays();
    if (displays[index]?.kind === 'progress') return;
    const qTotal = displays.filter((d) => d && d.kind !== 'progress').length;
    const qDone = displays.slice(0, index).filter((d) => d && d.kind !== 'progress').length;
    if (qTotal > BREAK_EVERY && qDone > 0 && qDone % BREAK_EVERY === 0 && breakNotifiedRef.current !== index) {
      breakNotifiedRef.current = index;
      engine.stop();
      setBreakReason('count');
      setBreakPending(true);
    }
  }, [index, playing, total, source, newOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  // 盲目の受験生からの改善提案#25・#29：実際に再生していた累積時間（一時停止・休憩中は
  // 数えない）を1つのrefで持ち、「5分ごとに休憩を提案」「30分で耳を休める提案」の
  // 両方の判定に使う（新しい時計の仕組みを増やさず、既存のbreakPendingバナーに相乗りする）。
  const playingAccumRef = useRef(0);
  const playingSinceRef = useRef(null);
  const [timeBreakOn, setTimeBreakOn] = useState(false); // #25 既定オフ（5分ごと）
  const [earRestOn, setEarRestOn] = useState(false); // #29 既定オフ（30分で耳を休める）
  const timeBreakNotifiedAtRef = useRef(0);
  const earRestNotifiedRef = useRef(false);
  useEffect(() => {
    if (playing) playingSinceRef.current = Date.now();
    else if (playingSinceRef.current) {
      playingAccumRef.current += Date.now() - playingSinceRef.current;
      playingSinceRef.current = null;
    }
  }, [playing]);
  useEffect(() => {
    if (!playing || breakPending) return;
    if (!timeBreakOn && !earRestOn) return;
    const id = setInterval(() => {
      const elapsed = playingAccumRef.current + (playingSinceRef.current ? Date.now() - playingSinceRef.current : 0);
      if (timeBreakOn && elapsed - timeBreakNotifiedAtRef.current >= 5 * 60 * 1000) {
        timeBreakNotifiedAtRef.current = elapsed;
        engine.stop();
        setBreakReason('time');
        setBreakPending(true);
        return;
      }
      if (earRestOn && !earRestNotifiedRef.current && elapsed >= 30 * 60 * 1000) {
        earRestNotifiedRef.current = true;
        engine.stop();
        setBreakReason('ear');
        setBreakPending(true);
      }
    }, 5000);
    return () => clearInterval(id);
  }, [playing, breakPending, timeBreakOn, earRestOn]);
  // #43：次のセットまでの小休止を選べる（続ける／1分／5分／ここで終了する）。
  // delayMinが無ければ即座に続け、あればその分だけ待ってから自動で再生を再開する。
  const resumeFromBreak = (delayMin) => {
    setBreakPending(false);
    if (breakTimerRef.current) { clearTimeout(breakTimerRef.current); breakTimerRef.current = null; }
    // 派生#43：予約していた自動再開（まだ鳴っていない分）があれば、ここで必ず見張りフラグを下ろす
    // （すぐ続ける／ここで終了する、のどちらでも「待っていない」状態に戻すため）。
    clearBreakResumePending().catch(() => {});
    if (!delayMin) { togglePlay(); return; }
    onToast?.(`✋ ${delayMin}分後に自動で再生を再開します`);
    setBreakResumePending(delayMin).catch(() => {});
    breakTimerRef.current = setTimeout(() => {
      breakTimerRef.current = null;
      clearBreakResumePending().catch(() => {});
      // 待っている間にユーザーが自分で▶を押して先に再開しているかもしれない。
      // ここで無条件にtogglePlay()を呼ぶと、そのtogglePlay自身は「予約した時点」の
      // 古いplaying値（false）を閉じ込めたクロージャのため、実際にはもう再生中なのに
      // 「止まっている」と誤認してengine.toggle()を呼び、結果として逆に止めてしまう
      // （実装時に気づいて修正）。実際のエンジンの今の状態を直接見て、まだ本当に
      // 止まっている時だけ再開する。
      if (!engine.getSnapshot().playing) togglePlay();
    }, delayMin * 60000);
  };
  // 休憩中に自分で▶（本体・下部バー・イヤホン）を押して再開した時は、休憩の案内と自動再開の予約を片付ける。
  // 以前は案内が出たまま残り、そのあいだ「5分ごとの休憩」の見張りも止まったままだった。
  // また予約が残ると、あとで自分で止めた時に予約の時刻が来て勝手に再生が始まっていた。
  useEffect(() => {
    // 実際のエンジンの状態で見る（同じ描画で60問区切りの休憩が止めた直後に、案内を消してしまわないように）
    if (!playing || !engine.getSnapshot().playing) return;
    if (breakPending) setBreakPending(false);
    if (breakTimerRef.current) {
      clearTimeout(breakTimerRef.current);
      breakTimerRef.current = null;
      clearBreakResumePending().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);
  // 派生#43：予約した自動再開が実際に発火する前にアプリが閉じられた／再読み込みされた場合
  // （非ジェスチャー文脈からの自動再開が本当に鳴ったかは分からないため）、次に開いた時に
  // 黙らず一言添える。正常に発火した時は上のclearBreakResumePending()で必ず消えるので、
  // ここで見つかるのは「発火しなかった（かもしれない）」場合だけ。
  useEffect(() => {
    loadBreakResumePending().then((p) => {
      if (!p) return;
      clearBreakResumePending().catch(() => {});
      onToast?.('⏸ 前回、休憩後の自動再開が完了しなかったかもしれません。必要なら▶を押して再生を続けてください');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // B3・B4：GAPに入った時刻を覚える（答えるまでの反応時間の計測開始点）。
  useEffect(() => {
    if (phase === PHASES.GAP && prevPhaseForLatencyRef.current !== PHASES.GAP) gapEnteredAtRef.current = Date.now();
    prevPhaseForLatencyRef.current = phase;
  }, [phase]);
  // 🔔 考える時間（間）の前後に短い合図音（#8）
  const prevPhaseForBeepRef = useRef(null);
  useEffect(() => {
    if (beepOn) {
      if (phase === PHASES.GAP && prevPhaseForBeepRef.current !== PHASES.GAP) beep(1, 660, 55);
      if (phase === PHASES.ANSWER && prevPhaseForBeepRef.current === PHASES.GAP) beep(1, 990, 55);
    }
    prevPhaseForBeepRef.current = phase;
  }, [phase, beepOn]);

  // 📳 次の問題に進むたびに軽く振動（#21。Android系のブラウザのみ対応）
  useEffect(() => {
    if (vibrateTickOn && playing) vibrate([35]);
  }, [index, vibrateTickOn, playing]);

  // 🎙️ 声で自己採点・操作（#9・#22）。正解・解説の読み上げが終わったタイミングで一度だけ聞き取る。
  // 「全部できた」（新規#9）は残りをまとめて○にしてそこで終える。
  useEffect(() => {
    if (!voiceControlOn || !current || phase !== PHASES.ANSWER) return;
    // 盲目の受験生からの改善提案#4：既存の合図音（beepOn、フェーズ切り替え用）とは別に、
    // 「今、聞いている最中」であることをはっきり伝える専用の合図音（高い二連音）を鳴らす。
    // 声コマンド自体が明示的なオプトインの機能なので、この合図はbeepOnの設定に関わらず鳴らす。
    beep(2, 1320, 60);
    const handle = listenOnce({
      onResult: (text) => {
        const cmd = parseVoiceCommand(text, voiceCommandWords);
        if (!cmd) return;
        if (cmd.type === 'grade') gradeCurrent(cmd.kind);
        else if (cmd.type === 'nav' && cmd.kind === 'next') skip(1);
        else if (cmd.type === 'nav' && cmd.kind === 'prev') skip(-1);
        else if (cmd.type === 'nav' && cmd.kind === 'stop') engine.stop();
        else if (cmd.type === 'nav' && cmd.kind === 'allDone') gradeRestAsMaru();
        // 盲目の受験生からの改善提案#9：声で詳細設定アコーディオンを開く。
        else if (cmd.type === 'nav' && cmd.kind === 'openSettings') { setDetailSettingsOpen(true); onToast?.('🔧 詳細設定を開きました'); }
        // 盲目の受験生からの改善提案#7：「◯問目へ」で問題番号バーと同じ絶対位置ジャンプ。
        // 範囲外の番号（例：全123問で「500問目へ」）は最後へ寄せ、実際に移った番号を知らせる
        else if (cmd.type === 'seek') {
          // 「残り◯問です」の知らせの項目は数えない（以前は知らせを挟んでいると、その数だけ手前の問題へ着いていた）
          const qIdx = engine.getPlanDisplays().map((d, i) => (d && d.kind !== 'progress' ? i : -1)).filter((i) => i >= 0);
          const qTotal = qIdx.length || total;
          const n = Math.max(1, Math.min(qTotal, cmd.n));
          engine.seekTo(qIdx.length ? qIdx[n - 1] : n - 1);
          onToast?.(n !== cmd.n ? `${cmd.n}問目はないため、${n} / ${qTotal}問目へ移動しました` : `${n} / ${qTotal}問目へ移動しました`);
        }
        // M25：「もう一度言う」。skip(0)は現在位置を変えずに止めて読み直すだけなので、
        // 新しい読み直しの仕組みは作らずそのまま再利用する。
        else if (cmd.type === 'nav' && cmd.kind === 'replay') { skip(0); onToast?.('🔁 もう一度読み上げます'); }
      },
      onError: () => noteNoSpeech(),
    });
    return () => handle?.stop?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, voiceControlOn, current?.id]);

  // C5〜C7：声で解答モード。GAP（考え中）に入った瞬間に一度だけ聞き取り、正解語と突き合わせる。
  // 一致した時だけ自動で○（かつ一言「正解です」と読む）。聞き取れない・一致しない時は
  // 自動で✕にはせず、黙って通常の答え合わせ（waitManualの解除＝resumeManual）へ進める
  // （false negativeの誤判定による不公平な自動✕を避けるための、意図的な非対称設計）。
  useEffect(() => {
    if (!voiceAnswerOn || !current || phase !== PHASES.GAP || currentItem?.kind !== 'question') return;
    // エンジンが実際に答えを待ち始めてから聞く（「答えは？思い出してみよう」を読んでいる間に聞き始めると、
    // 自分の読み上げを拾ったり、待ち始める前に結果が出て解除が空振りし止まったままになっていた）
    if (!snap.waitingManual) return;
    // 音声認識に対応していない端末・ブラウザでは、聞き取りを待ち続けて止まってしまわないよう
    // すぐに通常の答え合わせへ進める（行き止まりにしない）。
    if (!isVoiceCommandSupported()) { engine.resumeManual(); return; }
    let stopped = false;
    let activeHandle = null;
    const q = current;
    const isOx = q.type === 'ox';
    // ○×問題は「まる／ばつ」で答える。以前は正解語の代わりにキーワードと突き合わせていたため、
    // 正しく「まる」と言っても必ず不一致になり、「あとで調べる」にまで登録されていた。
    const oxAnswer = (heard) => {
      const t = (heard || '').replace(/\s/g, '');
      if (/^(まる|マル|丸|○|〇|正しい|ただしい|はい|せいかい|正解)/.test(t)) return 0;
      if (/^(ばつ|バツ|罰|✕|×|x|X|ペケ|ぺけ|誤り|あやまり|間違い|まちがい|いいえ)/.test(t)) return 1;
      return null;
    };
    const target = !isOx && Array.isArray(q.choices) ? q.choices[q.answer] : (effectiveTags(q, links)[0] || '');
    const finishTurn = () => { if (!stopped) engine.resumeManual(); };
    const doListen = (isRetry) => {
      beep(1, isRetry ? 740 : 880, 70);
      activeHandle = listenOnce({
        onResult: (text) => {
          if (stopped) return;
          const heard = (text || '').trim();
          let level;
          if (isOx) {
            const said = oxAnswer(heard);
            if (said == null) {
              // まる・ばつのどちらとも聞き取れない時は判定しない（誤りとして記録しない）
              setVoiceAnswerHeard({ questionId: q.id, heard, matched: false });
              finishTurn();
              return;
            }
            level = said === q.answer ? 'match' : 'none';
          } else {
            level = heard && target ? voiceMatchLevel(heard, target) : 'none';
          }
          if (level === 'match') {
            setVoiceAnswerHeard({ questionId: q.id, heard, matched: true });
            setVoiceAnswerStats((s) => ({ attempts: s.attempts + 1, matched: s.matched + 1 }));
            if (!gradedIdsRef.current.has(q.id)) {
              speak('正解です。よく言えました。', { rate, pitch: settings.speechPitch || 1, voice: selectedVoice() }).catch(() => {});
              gradeCurrent('maru');
            }
            finishTurn();
            return;
          }
          if (level === 'close' && !isRetry && !isOx) {
            // C7：完全一致ではないが近い（惜しい）時だけ、もう一度だけ言い直すチャンスを与える。
            speak('惜しいです。もう一度言ってみましょう。', { rate, pitch: settings.speechPitch || 1, voice: selectedVoice() }).catch(() => {});
            setTimeout(() => { if (!stopped) doListen(true); }, 1200);
            return;
          }
          setVoiceAnswerHeard({ questionId: q.id, heard, matched: false });
          setVoiceAnswerStats((s) => ({ attempts: s.attempts + 1, matched: s.matched }));
          // M27・M29：間違えた（一致しなかった）時だけ記録し、既存の「あとで調べる」へも
          // ソフトに登録する（SRS/採点には一切触れない。自動で✕にする実害の大きい方法は避ける）。
          if (heard) {
            const kw = effectiveTags(q, links)[0] || null;
            addLaterLookup({ keyword: kw, subject: q.subject || null, questionId: q.id }).then(setLaterLookup).catch(() => {});
            recordVoiceAnswerMiss({ questionId: q.id, heard, target }).catch(() => {});
          }
          finishTurn();
        },
        onError: () => {
          if (stopped) return;
          noteNoSpeech();
          setVoiceAnswerHeard({ questionId: q.id, heard: '', matched: false });
          finishTurn();
        },
      });
    };
    doListen(false);
    return () => { stopped = true; try { activeHandle?.stop?.(); } catch (e) { /* noop */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, voiceAnswerOn, current?.id, snap.waitingManual]);
  // 考え中に「声で解答」を切った時は、解答待ちで止まったままにしない（そのまま答え合わせへ進める）
  useEffect(() => {
    if (!voiceAnswerOn && !outputModeOn) engine.resumeManual();
  }, [voiceAnswerOn, outputModeOn]);

  // 他のアプリへ切り替える等でタブが非表示になり、ブラウザ側の都合で読み上げが
  // 止まってしまった時（audioEngine.jsの`recoverFromBackground`）、黙って止まったままに
  // せず、一度だけトーストで知らせる（2026-11-12）。実際に音を鳴らす再開はユーザーが
  // ▶を押した時（本物のユーザー操作）に任せ、ここでは声での自動再生は行わない
  // ——非ジェスチャー文脈からの自動再開は音が出ないまま静かに失敗する可能性があるため。
  const prevBackgroundStoppedRef = useRef(false);
  useEffect(() => {
    const justStopped = snap.backgroundStopped && !prevBackgroundStoppedRef.current;
    prevBackgroundStoppedRef.current = snap.backgroundStopped;
    if (!justStopped) return;
    onToast?.('⏸ バックグラウンドの影響で読み上げが止まりました。▶を押すと続きから再生します');
    engine.clearBackgroundStopped();
  }, [snap.backgroundStopped]); // eslint-disable-line react-hooks/exhaustive-deps

  // 件数チップで区切った束を最後まで読み終えたら、声で知らせ・実施ログに記録し、
  // 「間違えた問題だけもう一度」がONなら自動でもう一度だけ回す（#14・#15・#17・#19・#20）。
  // 前回との正答率比較（新規#1）・誤答理由（型）別の件数（新規#2）・プレイリストの次の束への
  // 自動進行（新規#3）もここでまとめて行う。
  const prevFinishedRef = useRef(false);
  useEffect(() => {
    const justFinished = snap.finished && !prevFinishedRef.current;
    prevFinishedRef.current = snap.finished;
    if (!justFinished) return;
    if (!(source === 'review' || (source === 'filter' && newOnly))) {
      // ユーザー指定：科目の音声を再生していく（インプット）等、間違えた問題／まだ解いていない
      // 問題だけモード以外で一周（最後まで）聞き終えたら、短くそれだけ声で知らせる
      // （こちらは詳しい正答率等の読み上げは行わない＝情報量の多いreview向けの読み上げと役割を分ける）。
      if (total > 0) {
        cancelSpeech();
        speak('一周終了です、お疲れ様でした。', { rate, pitch: settings.speechPitch || 1, voice: selectedVoice() }).catch(() => {});
      }
      return;
    }
    // 問題の数だけを数える（「残り◯問です」の知らせを挟んでいると、以前はその分まで「◯問終わりました」
    // 「◯問は聞くだけで…」に足していた）
    const n = engine.getPlanDisplays().filter((d) => d?.q).length || total;
    if (n === 0) return;
    const gradedN = sessionGradedCount;
    const wrongN = sessionWrong.length;
    const accuracyPct = gradedN > 0 ? Math.round(((gradedN - wrongN) / gradedN) * 100) : null;
    const subj = filterSubject || null;
    const gen = filterGenre || null;
    const rnd = filterRound || null;
    // 新規#1：同じ件数・同じ科目（第2弾改善：ジャンル・回も一致した時だけ）の直前の完了実績と比較する
    // （記録前のログを見る）。
    const prev = previousFinish(audioLog, { target: batchTarget, subject: subj, genre: gen, round: rnd });
    let accuracyLine = '';
    if (accuracyPct != null) {
      accuracyLine = `自己採点した${gradedN}問のうち、正答率はおよそ${accuracyPct}パーセントです。`;
      if (prev) {
        const diff = accuracyPct - prev.accuracyPct;
        if (diff > 0) accuracyLine += `前回よりおよそ${diff}ポイント上がりました。`;
        else if (diff < 0) accuracyLine += `前回よりおよそ${Math.abs(diff)}ポイント下がりました。`;
        else accuracyLine += '前回と同じくらいです。';
      }
    }
    // 新規#2：誤答理由（型）の内訳（Review.jsx等で過去に分類済みのものだけを集計。ここで新しく分類はしない）。
    const typeCounts = new Map();
    sessionWrong.forEach((q) => {
      const t = latestMissType(missTypes[q.id])?.type;
      if (t) typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
    });
    let typeLine = '';
    if (typeCounts.size > 0) {
      typeLine = [...typeCounts.entries()].map(([t, c]) => `${missTypeLabel(t)}が${c}問`).join('、') + 'でした。';
    }
    // 要注意（リーチ）だった問題が今回何問含まれていたか
    const leechWrongCount = sessionWrong.filter((q) => isLeechState(srs[q.id])).length;
    const leechLine = leechWrongCount > 0 ? `このうち要注意だった問題は${leechWrongCount}問でした。` : '';
    // マスター到達件数（セッション開始時点との差）
    const masteredDelta = masteredAtStartRef.current != null ? Math.max(0, masteredCount - masteredAtStartRef.current) : 0;
    const masteredLine = masteredDelta > 0 ? `このセッションで${masteredDelta}問がマスター済みになりました。` : '';
    masteredAtStartRef.current = null;
    // 聞き流しただけ（一度も自己採点していない）件数
    const ungradedCount = Math.max(0, n - gradedN);
    const ungradedLine = ungradedCount > 0 ? `${ungradedCount}問は聞くだけで、○△✕を付けていません。付けると記録に残ります。` : '';
    // #20：集計（ジャンル・タグ）だけでなく、具体的にまちがえた問題名まで声で要約する
    // （「今日：胃経15問、正解12問、まちがい：足三里、豊隆、内庭」のように声でメモする記憶術）。
    const wrongNames = sessionWrong.slice(0, 5).map((q) => effectiveTags(q, links)[0] || shortStem(q)).filter(Boolean);
    const wrongNamesLine = wrongNames.length > 0 ? `まちがいは、${wrongNames.join('、')}でした。` : '';
    // B3・B4：答えるまでの反応時間の気づき（forgetting.jsの忘却モデルは変えず、声での気づきのみ）。
    let latencyLine = '';
    if (sessionLatencies.length >= 3) {
      const avgMs = sessionLatencies.reduce((s, l) => s + l.ms, 0) / sessionLatencies.length;
      latencyLine = `答えるまでの平均時間はおよそ${Math.round(avgMs / 1000)}秒でした。`;
      const hesitantCount = sessionLatencies.filter((l) => l.kind === 'maru' && l.ms > Math.max(6000, avgMs * 1.5)).length;
      if (hesitantCount > 0) latencyLine += `正解と答えた問題のうち${hesitantCount}問は、答えるまで時間がかかっていました。忘れかけているかもしれません。`;
    }
    // M30：声で解答モード（voiceAnswerOn）の結果を完了時の要約に統合する。
    const voiceAnswerLine = voiceAnswerStats.attempts > 0
      ? `声で答える練習は${voiceAnswerStats.attempts}回行い、${voiceAnswerStats.matched}回正解できました。`
      : '';
    // G12：音声版の本番想定モードだけ、合格ライン60%との比較・所要時間を読む（参考スコア）。
    let mockExamLine = '';
    const wasMockExam = audioSessionKindRef.current === 'mockExam';
    if (wasMockExam) {
      const bpForLine = mockExamSessionRef.current === 'pm' ? EXAM_BLUEPRINT_PM : EXAM_BLUEPRINT_AM;
      const elapsedMin = mockExamStartAtRef.current ? Math.round((Date.now() - mockExamStartAtRef.current) / 60000) : null;
      const passLine = accuracyPct != null
        ? (accuracyPct >= 60 ? '合格ラインの目安60%に達しています。' : '合格ラインの目安60%には届いていません。')
        : '';
      mockExamLine = `本番想定モードの結果です（配分は確認中の参考値です）。${passLine}`
        + (elapsedMin != null ? `所要時間はおよそ${elapsedMin}分でした（本番の目安は${bpForLine.minutes}分です）。` : '');
    }
    cancelSpeech();
    const msg = `おつかれさまでした。${n}問、終わりました。${mockExamLine}${accuracyLine}${typeLine}${wrongNamesLine}${leechLine}${masteredLine}${ungradedLine}${latencyLine}${voiceAnswerLine}`;
    speak(msg, { rate, pitch: settings.speechPitch || 1, voice: selectedVoice() }).catch(() => {});
    recordAudioReviewFinish({ target: batchTarget, subject: subj, genre: gen, round: rnd, n, graded: gradedN, wrong: wrongN }).then(setAudioLog);
    // バックグラウンド時のローカル通知（既定オフのオプトイン。タブが生きている間だけ）。
    if (notifyOn && typeof document !== 'undefined' && document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification('音声学習', { body: `${n}問、終わりました。${accuracyPct != null ? `正答率約${accuracyPct}%` : ''}` }); } catch (e) { /* noop */ }
    }
    if (autoRequeueWrongOn && wrongN > 0 && !requeuedRef.current && source === 'review') {
      requeuedRef.current = true;
      const ids = sessionWrong.map((q) => q.id);
      setSessionWrong([]);
      setSessionWrongKinds({});
      setSessionLatencies([]);
      setVoiceAnswerStats({ attempts: 0, matched: 0 });
      setTimeout(() => {
        setCustomReviewIds(ids);
        setReviewTarget(null);
        onToast?.(`🔁 △・✕にした${ids.length}問を、もう一度だけ読み上げます`);
        // 以前は束を差し替えるだけで再生が始まらず、「もう一度読み上げます」と言ったまま黙っていた
        requestAutoPlay();
      }, 400);
      return;
    }
    // 新規#3：プレイリストに次の束が積まれていれば、休憩を挟まず自動で次へ進む。
    if (playlistQueue.length > 0) {
      const [nextItem, ...rest] = playlistQueue;
      setTimeout(() => {
        setPlaylistQueue(rest);
        setCustomReviewIds(null);
        setFilterSubject(nextItem.subject || '');
        // 積んだ時のジャンル・回もそろえる（以前は科目しか覚えておらず、今のジャンル・回のまま別の問題を流していた）
        setFilterGenre(nextItem.genre || '');
        setFilterRound(nextItem.round || '');
        setReviewOffsetPersist(0);
        setReviewTarget(nextItem.target);
        setSessionGradedCount(0);
        setSessionWrong([]);
        setSessionWrongKinds({});
        setSessionLatencies([]);
        setVoiceAnswerStats({ attempts: 0, matched: 0 });
        audioSessionKindRef.current = null;
        quickMinuteActiveRef.current = null;
        requeuedRef.current = false;
        onToast?.(`▶ 次の束へ進みます（${nextItem.subject || '全科目'}×${nextItem.target ?? 'すべて'}）`);
        requestAutoPlay();
      }, 600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.finished]);

  // A4・A5：周回速度ログ（音声版）＋完了画面のジャンル別正答率。学習10・60・300・900と同じ
  //   roundLog.jsのストレージを使うが、音声の所要時間・問題数はテキスト学習と単純比較できないため、
  //   Review.jsxのtoReviewRoundTarget（10000+）と同じ考え方でtoAudioRoundTarget（20000+）に
  //   名前空間を分ける（前回比較・通算回数がテキスト学習と混ざらないようにするため）。
  // keyword/daily/weakはキーワード単位の読み上げで「問題」の集計に馴染まないため対象外
  // （「🎯このセッションの設定」カードの件数しぼり込みと同じ除外範囲）。
  const audioRoundFinishedRef = useRef(false);
  const [audioLastRoundInfo, setAudioLastRoundInfo] = useState(null);
  const [audioGenreBreakdown, setAudioGenreBreakdown] = useState(null);
  const [showAllAudioGenres, setShowAllAudioGenres] = useState(false);
  // A3：3分の2バッファ術（学習10・60・300・900と同じ仕組み）。音声で「基礎タスク」分だけ
  //   聞いたらマネージャービューで振り返り、ご褒美復習／積み残し消化のどちらかへ続ける。
  const [audioBufferPlan, setAudioBufferPlan] = useState(null);
  const [audioBufferAwaitingReview, setAudioBufferAwaitingReview] = useState(false);
  const [audioBufferUsage, setAudioBufferUsage] = useState(null);
  const startAudioBufferPlan = (bufferPlan) => {
    rebuildStop();
    setAudioBufferPlan(bufferPlan);
    setAudioBufferUsage(null);
    setAudioBufferAwaitingReview(false);
    setMode(0);
    if (source !== 'filter' && source !== 'all') setSource('filter');
    setCustomReviewIds(null);
    setReviewOffsetPersist(0);
    setReviewTarget(bufferPlan.baseTaskQuestionCount);
    setSessionGradedCount(0);
    setSessionWrong([]);
    setSessionWrongKinds({});
    setSessionLatencies([]);
    setVoiceAnswerStats({ attempts: 0, matched: 0 });
    audioSessionKindRef.current = null;
    quickMinuteActiveRef.current = null;
    onToast?.(`🧩 基礎タスク（約${bufferPlan.baseTaskMinutes}分・${bufferPlan.baseTaskQuestionCount}問）を音声で始めます`);
    requestAutoPlay();
  };
  // A6：明日の最初の1タスク（学習10・60・300・900の完了画面と同じ仕組み・同じ保存先）。
  const [audioNextTaskInput, setAudioNextTaskInput] = useState('');
  const [audioNextTaskSavedAt, setAudioNextTaskSavedAt] = useState(0);
  useEffect(() => { loadNextTask().then((t) => { if (t && t.text) setAudioNextTaskInput(t.text); }); }, []);
  const saveAudioNextTaskDraft = () => {
    const text = audioNextTaskInput.trim();
    if (!text) return;
    saveNextTask(text);
    setAudioNextTaskSavedAt(Date.now());
    onToast?.('📌 明日の最初の1タスクを保存しました');
  };
  useEffect(() => {
    const justFinished = snap.finished && !audioRoundFinishedRef.current;
    audioRoundFinishedRef.current = snap.finished;
    if (!justFinished) return;
    // A3：基礎タスクが終わったら、普段の完了画面より先にマネージャービュー（振り返り）を出す。
    if (audioBufferPlan && !audioBufferUsage) setAudioBufferAwaitingReview(true);
    if (source === 'keyword' || source === 'daily' || source === 'weak') return;
    if (total === 0 || !audioSessionStartRef.current) return;
    const qCount = engine.getPlanDisplays().filter((d) => d?.q).length || total;
    const target = toAudioRoundTarget(reviewTarget || qCount);
    const ms = Date.now() - audioSessionStartRef.current;
    const graded = sessionGradedCount;
    const wrong = sessionWrong.length;
    const subjectForLog = filterSubject || undefined;
    loadRoundLog().then((log) => {
      const prev = previousForTarget(log, target, audioSessionStartRef.current);
      const roundNo = countForTarget(log, target) + 1;
      setAudioLastRoundInfo({ target, count: qCount, ms, prev, roundNo });
      appendRoundLog({ target, count: qCount, ms, at: audioSessionStartRef.current, graded, wrong, subject: subjectForLog });
    });
    // ジャンル別正答率（苦手順）。実際に自己採点した問題だけを対象にする。
    const wrongIds = new Set(sessionWrong.map((q) => q.id));
    const pairs = [...gradedIdsRef.current].map((id) => questionsById.get(id)).filter(Boolean).map((q) => ({ genre: q.genre, correct: !wrongIds.has(q.id) }));
    setAudioGenreBreakdown(pairs.length > 0 ? buildGenreBreakdown(pairs) : null);
    audioSessionStartRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.finished]);

  const changeSource = (s) => {
    rebuildStop();
    // 6つのボタンを選んだら検索フィルタは解除（どちらか一方のモード）
    setFilterSubject('');
    setFilterGenre('');
    setFilterKeyword('');
    setFilterRound(''); // 回も外す（外し忘れて、前に選んだ回のまま誤答・△✕がしぼられていた）
    setSource(s);
    audioSessionKindRef.current = null;
    quickMinuteActiveRef.current = null;
    if (s === 'keyword' && !selectedKeyword && hasKeywords) setSelectedKeyword(kwNames[0]);
  };

  // 連結モードの切り替え（同じものを再タップで通常へ戻す）
  const changeMode = (m) => {
    rebuildStop();
    setMode((cur) => (cur === m ? 0 : m));
    // バグ修正（再確認で発見）：ここでquickMinuteActiveRefを戻さないと、「5分だけ」完了直後に
    // 連結学習モードへ切り替えてそちらを最後まで聞き終えた時、無関係な完了画面にも
    // 「もう5分だけ続ける」ボタンが残ってしまう（audioSessionKindRefと同じ場所で戻すべきだった）。
    quickMinuteActiveRef.current = null;
    if (m > 0) {
      const usage = { ...(settings.audioModeUsage || {}) };
      usage[m] = (usage[m] || 0) + 1;
      updateSettings({ audioModeUsage: usage });
    }
  };

  // 検索フィルタの変更（科目→ジャンル→キーワードの順に段階的にしぼる）
  const applyFilter = (patch) => {
    rebuildStop();
    const ns = { subject: filterSubject, genre: filterGenre, keyword: filterKeyword, round: filterRound, ...patch };
    if ('subject' in patch) { ns.genre = ''; ns.keyword = ''; ns.round = ''; } // 上位が変わったら下位をリセット
    if ('genre' in patch) { ns.keyword = ''; ns.round = ''; }
    if ('keyword' in patch) { ns.round = ''; }
    setFilterSubject(ns.subject);
    setFilterGenre(ns.genre);
    setFilterKeyword(ns.keyword);
    setFilterRound(ns.round);
    // 「誤った問題」モード中に科目・ジャンル・回を選んだ／変えた場合は、そのモードを維持
    // したまま絞り込む（#24・#25。キーワードまで選んだ時だけ、従来通り通常の検索モードへ
    // 切り替える＝キーワードはスコープ外のまま）。
    if (source === 'review' && !ns.keyword) return;
    setSource(ns.subject || ns.genre || ns.keyword || ns.round || bookmarkOnly || newOnly || minRisk > 0 || riskTopN || minWrong > 0 || recentOnly ? 'filter' : 'all');
  };
  const clearFilter = () => {
    rebuildStop();
    audioSessionKindRef.current = null;
    quickMinuteActiveRef.current = null;
    setFilterSubject('');
    setFilterGenre('');
    setFilterKeyword('');
    setFilterRound('');
    setFilterTerm('');
    setBookmarkOnly(false);
    setNewOnly(false);
    setMinRisk(0);
    setRiskTopN(null);
    setMinWrong(0);
    setRecentOnly('');
    setRecentOnlyFilter(false);
    setDerivedOnly(false);
    setOxOnly(false);
    setRotateSubjects([]);
    setNagameOnly(false);
    setExcludeNagame(false);
    setSnoozedOnly(false);
    setExcludeSnoozed(false);
    setReviewTarget(null);
    // 覚えている件数も外す（外さないと、次に開いた時に消したはずの件数しぼり込みが戻っていた）
    updateSettings({ lastAudioReviewTarget: null });
    setReviewOffsetPersist(0);
    setSource('all');
    changeAudioNewPct(null);
  };
  const toggleRecentOnlyFilter = () => {
    rebuildStop();
    const next = !recentOnlyFilter;
    setRecentOnlyFilter(next);
    setSource(next || filterSubject || filterGenre || filterKeyword || filterRound || bookmarkOnly || newOnly ? 'filter' : 'all');
  };
  const toggleRotateSubject = (s) => {
    rebuildStop();
    setRotateSubjects((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
    setSource('filter');
  };
  const toggleNagameOnly = () => {
    rebuildStop();
    setNagameOnly((v) => { if (!v) setExcludeNagame(false); return !v; });
  };
  const toggleExcludeNagame = () => {
    rebuildStop();
    setExcludeNagame((v) => { if (!v) setNagameOnly(false); return !v; });
  };
  const toggleSnoozedOnly = () => {
    rebuildStop();
    setSnoozedOnly((v) => { if (!v) setExcludeSnoozed(false); return !v; });
  };
  const toggleExcludeSnoozed = () => {
    rebuildStop();
    setExcludeSnoozed((v) => { if (!v) setSnoozedOnly(false); return !v; });
  };
  // 自由語検索（学習(10・60・300・900)と同じく、キーワード選択と同様に「誤った問題」モードを解除する）
  const changeFilterTerm = (v) => {
    rebuildStop();
    setFilterTerm(v);
    if (source === 'review' && !v) return;
    setSource(v || filterSubject || filterGenre || filterKeyword || filterRound || bookmarkOnly || newOnly ? 'filter' : 'all');
  };
  const changeRecentOnly = (v) => {
    rebuildStop();
    const next = recentOnly === v ? '' : v;
    setRecentOnly(next);
    setSource(next || filterSubject || filterGenre || filterKeyword || filterRound || bookmarkOnly || newOnly ? 'filter' : 'all');
  };
  const toggleBookmarkOnly = () => {
    rebuildStop();
    const next = !bookmarkOnly;
    setBookmarkOnly(next);
    setSource(next || filterSubject || filterGenre || filterKeyword || filterRound || newOnly ? 'filter' : 'all');
  };
  // 出題形式でしぼる：一問一答（派生）だけ／マルバツ（○×）だけ。独立にON/OFFできる
  // （両方ONなら「派生かつ○×」だけに絞られる）。
  const toggleDerivedOnly = () => {
    rebuildStop();
    const next = !derivedOnly;
    setDerivedOnly(next);
    setSource(next || filterSubject || filterGenre || filterKeyword || filterRound || bookmarkOnly || newOnly ? 'filter' : 'all');
  };
  const toggleOxOnly = () => {
    rebuildStop();
    const next = !oxOnly;
    setOxOnly(next);
    setSource(next || filterSubject || filterGenre || filterKeyword || filterRound || bookmarkOnly || newOnly ? 'filter' : 'all');
  };
  // 🆕 まだ解いていない問題だけ（#29。復習と同じ件数チップのUIを使い回す）
  const toggleNewOnly = () => {
    rebuildStop();
    const next = !newOnly;
    setNewOnly(next);
    setReviewOffsetPersist(0);
    setSource(next || filterSubject || filterGenre || filterKeyword || filterRound || bookmarkOnly ? 'filter' : 'all');
  };
  // 忘却リスクの選び方：しきい値（minRisk）と上位◯件（riskTopN）は同時に使わない
  const changeMinRisk = (v) => { rebuildStop(); setMinRisk(v); if (v > 0) setRiskTopN(null); };
  const changeRiskTopN = (n) => {
    rebuildStop();
    setRiskTopN((cur) => (cur === n ? null : n));
    if (n) setMinRisk(0);
  };
  // 「間違えた問題を読み上げる」の件数しぼり込み（同じ値を再タップで「すべて」に戻す）。
  // 選んだ件数は次回も覚えておく（#1）。件数を変えたら「もう一度」のローテーションも0に戻す。
  const changeReviewTarget = (t) => {
    rebuildStop();
    setReviewOffsetPersist(0);
    setReviewTarget((cur) => {
      const next = cur === t ? null : t;
      updateSettings({ lastAudioReviewTarget: next });
      return next;
    });
  };
  // #41：通勤・隙間時間向けの「◯分だけ」ミニセッション。既存の「時間から選ぶ」チップと
  //   同じ逆算式を使い、まだ解いていない問題だけから即座に始める（検索・設定を一切経由しない）。
  const startQuickMinute = (min) => {
    rebuildStop();
    const perItem = 12 / Math.max(0.1, rate) + gap + nextGap;
    const count = Math.max(1, Math.round((min * 60) / perItem));
    setMode(0);
    setSource('filter');
    setNewOnly(true);
    setCustomReviewIds(null);
    setReviewOffsetPersist(0);
    setReviewTarget(count);
    updateSettings({ lastAudioReviewTarget: count });
    setSessionGradedCount(0);
    setSessionWrong([]);
    setSessionWrongKinds({});
    setSessionLatencies([]);
    setVoiceAnswerStats({ attempts: 0, matched: 0 });
    audioSessionKindRef.current = null;
    quickMinuteActiveRef.current = min;
    onToast?.(`🚃 約${min}分・${count}問のミニセッションを始めます`);
    requestAutoPlay();
  };
  // 盲目の受験生からの改善提案：体の場所法・紛らわしいペア・宿題リプレイのような
  // 「検索条件を経由しない、単発の読み上げモード」をまとめて始めるための共通ヘルパー。
  const startSimpleSource = (sourceVal, toastMsg) => {
    rebuildStop();
    setMode(0);
    setCustomReviewIds(null);
    setFilterSubject(''); setFilterGenre(''); setFilterKeyword(''); setFilterRound('');
    setReviewTarget(null);
    setReviewOffsetPersist(0);
    setSource(sourceVal);
    setSessionGradedCount(0);
    setSessionWrong([]);
    setSessionWrongKinds({});
    setSessionLatencies([]);
    setVoiceAnswerStats({ attempts: 0, matched: 0 });
    audioSessionKindRef.current = null;
    quickMinuteActiveRef.current = null;
    if (toastMsg) onToast?.(toastMsg);
    requestAutoPlay();
  };
  // #17・#18：就寝前まとめ復習。その日に解いた問題だけをまとめて読み直し、
  // 15〜30分の自動終了タイマー（既存のスリープタイマーをそのまま使う）を既定でセットする。
  const startBedtimeReview = (min) => {
    const todayKey = dateKey();
    const ids = [...new Set(
      history.filter((h) => dateKey(new Date(h.at)) === todayKey).map((h) => h.questionId)
    )];
    if (ids.length === 0) { onToast?.('今日はまだ解いた問題がありません'); return; }
    rebuildStop();
    setMode(0);
    setSource('review');
    setCustomReviewIds(ids);
    setFilterSubject(''); setFilterGenre(''); setFilterKeyword(''); setFilterRound('');
    setReviewTarget(null);
    setReviewOffsetPersist(0);
    setSleepMin(min);
    setSessionGradedCount(0);
    setSessionWrong([]);
    setSessionWrongKinds({});
    setSessionLatencies([]);
    setVoiceAnswerStats({ attempts: 0, matched: 0 });
    audioSessionKindRef.current = 'bedtime'; // 再生履歴の題（就寝前まとめ）に使う
    quickMinuteActiveRef.current = null;
    onToast?.(`🌙 今日解いた${ids.length}問をまとめて復習します（${min}分で自動終了）`);
    requestAutoPlay();
  };
  // 一番上の赤い長丸ボタン：「国家試験の科目×過去に間違えたところ」をタップするだけで開始する。
  // インプットに特化（outputModeOn・pureRecallOnを強制的にOFF＝自動で正解まで読み進める）。
  const startDailyWrongPill = () => {
    if (dailyWrongPick.pool.length === 0) return;
    rebuildStop();
    setMode(0);
    setCustomReviewIds(dailyWrongPick.pool.map((q) => q.id));
    setFilterSubject(''); setFilterGenre(''); setFilterKeyword(''); setFilterRound('');
    setReviewTarget(null);
    setReviewOffsetPersist(0);
    setSource('review');
    setOutputModeOn(false);
    setPureRecallOn(false);
    setSessionGradedCount(0);
    setSessionWrong([]);
    setSessionWrongKinds({});
    setSessionLatencies([]);
    setVoiceAnswerStats({ attempts: 0, matched: 0 });
    audioSessionKindRef.current = null;
    quickMinuteActiveRef.current = null;
    onToast?.(`🔴 今日の科目「${dailyWrongPick.subject}」の誤答・△✕問題（${dailyWrongPick.pool.length}問）を始めます`);
    requestAutoPlay();
  };
  // 🔁 もう一度（同じ件数で別の問題を）：対象プールの次の束へローテーションする（#2）
  // 🔁 もう一度（同じ件数で別の問題を）：対象プールの次の束へローテーションする（#2）。
  // 前回との問題の重複率も見る（新規・模試の「前回の同モードとの問題重複率」と同じ考え方）。
  // G11・G12：音声版の本番想定モード（午前/午後と同じ科目別配分で連続出題。参考スコア）。
  const startMockExam = (session) => {
    const bp = session === 'pm' ? EXAM_BLUEPRINT_PM : EXAM_BLUEPRINT_AM;
    const { order, shortfalls } = buildBlueprintExam(bp, questions, { srs });
    if (order.length === 0) { onToast?.('収録数が少なく、本番想定モードを組めませんでした'); return; }
    rebuildStop();
    setMode(0);
    setCustomReviewIds(order.map((q) => q.id));
    setFilterSubject(''); setFilterGenre(''); setFilterKeyword(''); setFilterRound('');
    setReviewTarget(null);
    setReviewOffsetPersist(0);
    setSource('review');
    setSessionGradedCount(0);
    setSessionWrong([]);
    setSessionWrongKinds({});
    setSessionLatencies([]);
    setVoiceAnswerStats({ attempts: 0, matched: 0 });
    audioSessionKindRef.current = 'mockExam';
    quickMinuteActiveRef.current = null;
    mockExamStartAtRef.current = Date.now();
    mockExamSessionRef.current = session;
    const warn = shortfalls.length ? `（収録不足のため一部調整しています）` : '';
    onToast?.(`⏱ 本番想定モード（${bp.label}・${order.length}問）を始めます。自己採点のみで進む参考スコアです${warn}`);
    requestAutoPlay();
  };
  // E9：混同しやすい科目の組をワンタップで複数科目ローテーションへ投入する。
  const pickSubjectPair = (pair) => {
    rebuildStop();
    setRotateSubjects(pair);
    setSource('filter');
  };
  const prevBatchIdsRef = useRef(null);
  const justRepeatedRef = useRef(false);
  const repeatWithNextBatch = () => {
    rebuildStop();
    // 件数が「すべて」の時は次の束が無いので、同じ束を最初から流す。以前は位置を0だけ進めて何も起きず、
    // 押しても無反応のうえ、重なりの知らせが次に条件を変えた時に場違いに出ていた。
    if (!reviewTarget) {
      justRepeatedRef.current = false;
      engine.seekTo(0);
      onToast?.('🔁 同じ束をもう一度、最初から再生します（件数が「すべて」のため別の問題はありません）');
      requestAutoPlay();
      return;
    }
    prevBatchIdsRef.current = new Set(plan.filter((p) => p.kind === 'question' && p.q).map((p) => p.q.id));
    justRepeatedRef.current = true;
    setReviewOffsetPersist((o) => o + (reviewTarget || 0));
  };
  useEffect(() => {
    if (!justRepeatedRef.current || !prevBatchIdsRef.current) return;
    justRepeatedRef.current = false;
    const newIds = plan.filter((p) => p.kind === 'question' && p.q).map((p) => p.q.id);
    if (!newIds.length) return;
    const overlap = newIds.filter((id) => prevBatchIdsRef.current.has(id)).length;
    const pct = Math.round((overlap / newIds.length) * 100);
    onToast?.(pct > 0 ? `🔁 前回との問題の重なり：約${pct}%` : '🔁 前回と重なる問題はありませんでした');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);
  const changeKeyword = (kw) => { rebuildStop(); setSelectedKeyword(kw); };
  const toggleChain = () => { rebuildStop(); setChain((v) => !v); };
  const toggleSummary = () => { rebuildStop(); setSummary((v) => !v); };
  const toggleFlashcard = () => { rebuildStop(); setFlashcard((v) => !v); };
  const toggleShuffle = () => { rebuildStop(); setShuffleOn((v) => !v); };

  // A2：二重記録防止（学習10・60・300・900のrecordedIdsと同じ考え方）。「前へ」で戻って
  //   同じ問題をもう一度自己採点しても、SRS・履歴・自己採点件数が上書きされないようにする。
  //   planが変わる（科目・条件変更・もう一度・プレイリストの次の束等）たびに自然に解除される。
  const gradedIdsRef = useRef(new Set());
  // #64：このセッション内で既に「連続2回外した」の言い換えを行った問題idの集合。
  //   1問につき言い換えは1回だけ（同じ問題が何度も対象になることはない＝上の二重記録防止）。
  const rephrasedOnceRef = useRef(new Set());
  // ○の見直し／○の高速回転の音声セッション中かどうか（学習10・60・300・900のisMaruSessionと
  //   同じ考え方）。recordAnswerのsource（'maru-review'）・見直し時の自動メモ印付けに使う。
  //   startMaruAudioが設定し、他の明示的なセッション開始経路（科目/条件の変更・バッファ開始）で
  //   nullに戻す（これらの開始直後はもう○の見直しではないため）。
  const audioSessionKindRef = useRef(null);
  // 派生#41：直前（または今）のセッションが「◯分だけ」ミニセッションなら、その分数を保持する。
  //   完了画面の「もう5分だけ続ける」ボタン用。startQuickMinuteが設定し、他の明示的な
  //   セッション開始経路（audioSessionKindRefと同じ場所）でnullに戻す。
  const quickMinuteActiveRef = useRef(null);
  // planは自己採点でsrsが変わるたびに再計算される（srsが依存配列にあるため）が、問題の構成・
  // 順序そのものは変わらないことが大半なので、参照ではなく内容（id列）で比較する
  // （参照で比較すると、1問採点するたびにガードがリセットされ、二重記録防止が機能しなくなる）。
  // 続きから再開した時、保存済みの二重記録防止idがあれば復元する（無ければ空にリセット）。
  // 数え直すのは、エンジンが実際に別の束を読み込んだ時だけ（snap.planSig が変わった時）。
  // 以前は並び（planIdsKey）が変わるたびに空にしていたため、間違えた問題（△✕）を聞いている途中で
  // 1問マスターして並びが変わる（束はそのまま続く）と、二重記録防止がそこで消えていた。
  const loadedSigForGradedRef = useRef(null);
  useEffect(() => {
    if (!audioReady) return;
    if (loadedSigForGradedRef.current === snap.planSig) return;
    loadedSigForGradedRef.current = snap.planSig;
    const saved = resumeAudioRef.current;
    if (saved && saved.sig === snap.planSig && Array.isArray(saved.graded)) {
      gradedIdsRef.current = new Set(saved.graded);
    } else {
      gradedIdsRef.current = new Set();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.planSig, audioReady]);
  // A10：誤答理由をその場で選べるように（以前は完了画面でまとめてだけだった）。
  // △・✕を選んだ直後だけ、その問題のid分類チップを表示する。
  const [justGradedWrongId, setJustGradedWrongId] = useState(null);
  // A9：自己説明ステップ（音声版）のメモ入力
  const [audioWhy, setAudioWhy] = useState('');
  // 「最初から（リセット）」の確認ステップ（ResetControl.jsxが単一の正。学習10・60・300・900と同じ）
  const [confirmAudioReset, setConfirmAudioReset] = useState(false);
  // 画面の見やすさ改善（2026-11-08追加）：連結学習モード一覧・声を選ぶ一覧・細かい設定を
  // 既定で折りたたみ、必要な時だけ開く（全部が常に全展開だと画面が長くなりすぎるため）。
  const [modesExpanded, setModesExpanded] = useState(false);
  const [voicesExpanded, setVoicesExpanded] = useState(false);
  const [detailSettingsOpen, setDetailSettingsOpen] = useState(false);
  // #10 聞きながら自己採点／キーワード追加（○＝できた, △・✕＝復習へ）
  const gradeCurrent = (kind) => {
    const q = current;
    if (!q) return;
    if (gradedIdsRef.current.has(q.id)) {
      onToast?.('この問題はすでに記録済みです（二重には記録しません）');
      return;
    }
    gradedIdsRef.current.add(q.id);
    const ok = kind === 'maru';
    // 学習(10・60・300・900)と同じく、grade・selfKindも渡す（Quiz.jsxで過去に実際に踏んだのと
    // 同じ型のバグ——渡さないと○の見直し等のselfKind依存機能から音声の自己採点が一切見えない）。
    // ○の見直し・○の高速回転中はsourceに印を付ける（Session.jsxのisMaruSessionと同じ考え方。
    // maruPool.jsのlastMaruReviewAtが「最後にいつふりかえったか」をここから追跡する）。
    const isMaruAudioSession = audioSessionKindRef.current === 'maruReview' || audioSessionKindRef.current === 'maruFast';
    // K21・M26：想起練習（recallMode／pureRecallOn）で答えた分だけを後から追える印
    // （historyのsourceに残す。○の見直し中は従来どおりmaru-review印を優先する）。
    const recallTagged = !isMaruAudioSession && (recallMode || pureRecallOn);
    const grade = ok ? GRADES.easy : GRADES.again;
    const leechEvent = recordAnswer(q, ok, grade, isMaruAudioSession ? 'maru-review' : (recallTagged ? 'audio-recall' : undefined), kind);
    // B3・B4：GAPに入ってから自己採点するまでの反応時間（答えるまでの迷い）を記録する。
    // forgetting.jsの忘却モデルは変えず、セッションの終わりに声で気づきを伝えるだけに使う。
    if (gapEnteredAtRef.current) {
      const latencyMs = Date.now() - gapEnteredAtRef.current;
      setSessionLatencies((prev) => [...prev, { ms: latencyMs, kind }]);
    }
    if (leechEvent === 'became') {
      onToast?.(`⚠️ 要注意（${LEECH_THRESHOLD}回以上の誤答）：「${(q.question || '（図の問題）').slice(0, 20)}」`);
    } else if (leechEvent === 'resolved') {
      onToast?.(`✅ 要注意を脱出！「${(q.question || '（図の問題）').slice(0, 20)}」がマスターになりました`);
    }
    if (kind === 'sankaku' || kind === 'batsu') {
      recordSelfKindCount(q.id, kind).then(setSelfKindCounts);
      // 「○の見直し」中に△・✕へ崩れた＝当初の○は思い違いだった可能性が高いので、
      //   間違いノート（MistakeNote.jsx）で見分けられるよう自動でメモに印を付ける
      //   （Session.jsxと同じ考え方。「高速回転」は対象外——判定基準はSession.jsxに合わせる）。
      if (audioSessionKindRef.current === 'maruReview') {
        const tag = '⚠️見直しで判明：うろ覚えだった可能性';
        const existing = memos[q.id] || '';
        if (!existing.includes(tag)) setMemo(q.id, existing ? `${existing} / ${tag}` : tag);
      }
    }
    setSessionGradedCount((n) => n + 1);
    // #64：連続2回同じ問題を外したら（✕のみ対象。△は中立で数えない）、その場で一度だけ
    //   別の角度から解説を読み直す（immediate retestingの直後フィードバックの考え方）。
    //   このセッション内では同じ問題を二度自己採点できない（上のgradedIdsRefによる二重記録
    //   防止）ため、「連続2回」は今回自身ではなくhistoryに残る直近の記録（前回の
    //   セッションのものでもよい）と突き合わせて判定する——そうしないと、この条件は
    //   セッション内では原理的に一度も満たせない（実装時に気づいた不具合。修正済み）。
    if (kind === 'batsu') {
      const lastForQ = history
        .filter((h) => h.questionId === q.id)
        .sort((a, b) => (b.at || 0) - (a.at || 0))[0];
      if (lastForQ && lastForQ.selfKind === 'batsu' && !rephrasedOnceRef.current.has(q.id)) {
        rephrasedOnceRef.current.add(q.id);
        setHadWrongStreak(true);
        recordRephrase(q.id).catch(() => {}); // 派生#64：週次の弱点ジャーナルの自動チップ化向け記録
        // comparisonsForKeywordは `c.title.includes(kw)` を含む判定のため、空文字を渡すと
        // 「すべての文字列に空文字は含まれる」でCOMPARISONS全件がヒットしてしまう
        // （curTags[0]が無い問題で、無関係な対比が紛れ込むバグになるところだった。実装時に発見）。
        const comp = mindmapData && curTags[0] ? (mindmapData.comparisonsForKeyword(curTags[0])[0] || null) : null;
        const others = comp ? (comp.members || []).filter((m) => m && !(q.question || '').includes(m)).slice(0, 2) : [];
        const angle = others.length ? `似ている「${others.join('」「')}」とはここが違います。` : '';
        setTimeout(() => {
          speak(`念のため、別の角度からもう一度。${angle}${q.explanation || ''}`, {
            rate, pitch: settings.speechPitch || 1, voice: selectedVoice(),
          }).catch(() => {});
        }, 500);
      }
    }
    if (!ok) {
      setSessionWrong((prev) => (prev.some((x) => x.id === q.id) ? prev : [...prev, q]));
      setSessionWrongKinds((prev) => ({ ...prev, [q.id]: kind }));
      setJustGradedWrongId(q.id); // A10：その場で誤答理由を選べるように
      // A9：自己説明ステップ（音声版）。QuestionCard.jsxのwhyPrompt（誤答時に自動で促す）と
      //   同じ考え方を、聞きながらでも使えるよう声でも一言促す。
      setAudioWhy('');
      speak('なぜこの答えだったか、一言メモしておくと、同じ間違いを繰り返しにくくなります。', {
        rate, pitch: settings.speechPitch || 1, voice: selectedVoice(),
      }).catch(() => {});
    } else {
      setJustGradedWrongId(null);
    }
    onToast?.(
      kind === 'maru'
        ? '「○ できた」を記録しました'
        : kind === 'sankaku'
        ? '「△ あいまい」を記録（復習に追加）'
        : '「✕ できない」を記録（復習に追加）'
    );
  };
  // 声コマンド「全部できた」：今の問題から最後までをまとめて○にし、そこで終える（新規#9）。
  // 長い移動中に最後まで聞き終えた時用。すでに△・✕を付けた問題を○で上書きしない
  // （以前は「害はない」として重ねて記録しており、付けたばかりの✕が○に書き換わっていた）。
  const gradeRestAsMaru = () => {
    // エンジンが実際に読んでいる束から取る（間違えた問題を聞いている途中で画面側の束だけ変わっている時、
    // 以前は聞いていない別の問題まで○にしていた）。すでに自己採点した問題は上書きしない。
    const remaining = engine.getPlanDisplays().slice(index).filter((d) => d?.q && !gradedIdsRef.current.has(d.q.id));
    remaining.forEach((d) => { gradedIdsRef.current.add(d.q.id); recordAnswer(d.q, true, GRADES.easy, undefined, 'maru'); });
    setSessionGradedCount((n) => n + remaining.length);
    onToast?.(`○ 残り${remaining.length}問をまとめて記録しました`);
    engine.finishNow();
  };
  const toggleCurrentBookmark = () => {
    const q = current;
    if (!q) return;
    toggleBookmark(q.id);
    onToast?.(bookmarks[q.id] ? 'ブックマークを解除しました' : '🔖 ブックマークに追加しました（後で見直す）');
  };
  // #16：自分の言葉で言い直す練習の録音（MediaRecorder、端末内のみ）。
  const [selfVoiceNotes, setSelfVoiceNotes] = useState([]);
  useEffect(() => { storage.loadSelfVoiceNotes().then(setSelfVoiceNotes); }, []);
  const [recordingOn, setRecordingOn] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const startSelfVoiceRecording = async (promptOverride) => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      onToast?.('この端末・ブラウザは録音に対応していません');
      return;
    }
    // H13・J20：「教えるモード」・誤答理由の自己分析、録音前に促す一言を読む。
    const framing = promptOverride || (teachModeOn ? '🧑‍🏫 これから後輩に教えるつもりで説明してください。' : null);
    if (framing) {
      onToast?.(framing);
      speak(framing.replace(/^[^぀-ヿ一-鿿]+/, ''), { rate, pitch: settings.speechPitch || 1, voice: selectedVoice() }).catch(() => {});
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recordStartAtRef.current = Date.now();
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        const qid = current?.id;
        if (qid) storage.saveSelfVoiceNote(qid, blob).then(setSelfVoiceNotes);
        onToast?.('🎙️ 録音しました。「▶ 自分の説明を聞く」で聞き比べられます');
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecordingOn(true);
    } catch (e) {
      onToast?.('マイクを使えませんでした（許可を確認してください）');
    }
  };
  const stopSelfVoiceRecording = () => {
    try { mediaRecorderRef.current?.stop(); } catch (e) { /* noop */ }
    setRecordingOn(false);
    // H14：無音そのものは検知できないため、代わりに「説明が短く終わった」ことを
    // 詰まりの手がかりとして使う（できないことをできるふりにしない、簡易な代替指標）。
    if (recordStartAtRef.current && Date.now() - recordStartAtRef.current < 2000) {
      onToast?.('🤔 説明が短く終わりました。ここが理解の穴かもしれません。');
    }
  };
  const playSelfVoiceNote = (questionId) => {
    const note = selfVoiceNotes.find((n) => n.questionId === questionId);
    if (!note) return;
    try {
      const url = URL.createObjectURL(note.blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.play().catch(() => {});
    } catch (e) { /* noop */ }
  };
  // 読み方の手動補正辞書（例：「経穴」→「けいけつ」）
  const addPronunciationFix = () => {
    const term = pfTerm.trim();
    const reading = pfReading.trim();
    if (!term || !reading) return;
    const cur = { ...(settings.pronunciationFixes || {}) };
    cur[term] = reading;
    updateSettings({ pronunciationFixes: cur });
    appendPronunciationReportLog({ term, reading }).then(setPronReportLog);
    setPfTerm('');
    setPfReading('');
    onToast?.(`「${term}」→「${reading}」を登録しました`);
  };
  // 盲目の受験生からの改善提案#8：文字入力が必要な設定（読み方の手動補正等）を、
  // 既存のlistenOnce（声コマンドと同じ仕組み）で声でも埋められるようにする。
  // customWords/parseVoiceCommandを経由せず、聞き取った生のテキストをそのまま使う
  // だけなので、voiceCommand.js側に新しい関数は要らない。
  const dictateInto = (setter, label) => {
    if (!isVoiceCommandSupported()) { onToast?.('この端末・ブラウザは音声入力に対応していません'); return; }
    onToast?.(`🎙️ ${label}を話してください`);
    listenOnce({
      onResult: (text) => { if (text) setter(text.trim()); },
      onError: () => onToast?.('聞き取れませんでした'),
    });
  };
  const removePronunciationFix = (term) => {
    const cur = { ...(settings.pronunciationFixes || {}) };
    delete cur[term];
    updateSettings({ pronunciationFixes: cur });
  };
  const addTag = () => {
    const q = current;
    const kw = tagInput.trim();
    if (!q || !kw) return;
    const cur = (links[q.id]?.keywords) || [];
    if (!cur.includes(kw)) setLink(q.id, { keywords: [...cur, kw] });
    setTagInput('');
    setTagOpen(false);
    onToast?.(`「${kw}」をキーワードに追加しました`);
  };

  if (!isSpeechSupported()) {
    return (
      <div className="view">
        <h2 className="view-title">音声学習</h2>
        <div className="empty">
          <div className="ico">🔇</div>
          <p>お使いのブラウザは音声合成（Web Speech API）に対応していません。</p>
          <p className="inline-note">iOS / Android の Safari・Chrome など、最新のブラウザでお試しください。</p>
        </div>
      </div>
    );
  }

  // A3：基礎タスク完了直後のマネージャービュー（Session.jsx・Quiz.jsxと同じ共有コンポーネント）。
  if (audioBufferAwaitingReview && audioBufferPlan) {
    return (
      <ManagerReview
        buffer={audioBufferPlan}
        onDecide={(completed, note) => {
          const usage = resolveBufferUsage(completed);
          setAudioBufferUsage(usage);
          setAudioBufferAwaitingReview(false);
          onToast?.(note ? `記録しました（${note}）` : '記録しました');
        }}
      />
    );
  }

  const rateOptions = [0.7, 0.85, 1.0, 1.15, 1.3, 1.5, 1.75, 2.0];
  const sleepOptions = [0, 5, 10, 15, 20, 30];
  const kwLike = source === 'keyword' || source === 'daily' || source === 'weak';
  const goalOptions = [0, 10, 30, 60, 100];
  // よく使うモードほど上に表示（使った回数、settings.audioModeUsage に保存）
  const modeUsage = settings.audioModeUsage || {};
  const sortedModes = MODES.slice().sort((a, b) => (modeUsage[b.id] || 0) - (modeUsage[a.id] || 0));

  return (
    <div className="view">
      <h2 className="view-title">音声学習 × 連結学習</h2>
      <p className="view-desc">
        「問題 →（間）→ 正解と解説」を自動で読み上げます。連結の工夫で、ひとつの言葉を
        いろいろな角度から耳で覚えられます。
      </p>

      <button
        type="button"
        className="daily-wrong-pill"
        disabled={dailyWrongPick.pool.length === 0}
        onClick={startDailyWrongPill}
      >
        <span className="daily-wrong-pill-main">🔴 今日の科目で誤答・△✕を聞く</span>
        <span className="daily-wrong-pill-sub">
          {dailyWrongPick.pool.length > 0
            ? `${dailyWrongPick.subject}・${dailyWrongPick.pool.length}問`
            : `${dailyWrongPick.subject}・まだ誤答がありません`}
        </span>
      </button>

      {streak > 0 && (
        <div className={`streak-card${studiedToday ? ' lit' : ''}`} style={{ marginBottom: 12 }}>
          <span className="streak-flame">🔥</span>
          <span className="streak-main"><strong>{streak}</strong>日連続</span>
          <span className="streak-sub">{studiedToday ? '今日も学習済み！' : '今日まだ未学習。1問でも解いて継続！'}</span>
        </div>
      )}

      {streakBreakReasonLabel && (
        <div className="card" style={{ marginBottom: 10 }}>
          きのうは『{streakBreakReasonLabel}』だったんですね。気にせず、今日は無理せず1問からいきましょう。
        </div>
      )}

      {/* 新規8：完了時に1つ目立つ見出しカードを出す（学習10・60・300・900の.sess-doneと同じ考え方。
          どのsource分岐で終わったかに関わらず、ここで一括して出す） */}
      {snap.finished && total > 0 && (() => {
        const graded = sessionGradedCount;
        const doneIco = graded >= 900 ? '🏆' : graded >= effectiveDailyGoal ? '🎉' : graded >= 60 ? '✅' : '🔁';
        const doneTitle = graded >= 900
          ? '1周（900問）終了！'
          : graded >= effectiveDailyGoal
          ? `今日の目標 ${effectiveDailyGoal}問 達成！`
          : graded >= 60
          ? '1セット（60問）完了！'
          : `すきま学習（${total}問）完了！`;
        return (
          <div className="card sess-done" style={{ marginBottom: 12 }}>
            <div className="sess-done-ico">{doneIco}</div>
            <h2 style={{ textAlign: 'center' }}>{doneTitle}</h2>
            <p className="view-desc" style={{ textAlign: 'center' }}>
              おつかれさまでした。全{total}問・自己採点{graded}問。
            </p>
            {/* 派生#41：直前が「◯分だけ」のミニセッションだった時だけ出す */}
            {quickMinuteActiveRef.current != null && (
              <button
                className="btn accent sm block"
                style={{ marginTop: 8 }}
                onClick={() => startQuickMinute(5)}
              >
                ▶ もう5分だけ続ける
              </button>
            )}
          </div>
        );
      })()}

      {/* A3：3分の2バッファ術の振り返り後、バッファ枠（ご褒美復習／積み残し消化）へ続ける */}
      {audioBufferUsage && audioBufferPlan && (
        <div className="card" style={{ marginBottom: 10 }}>
          <div className="section-label" style={{ marginTop: 0 }}>🧩 バッファ枠：{bufferUsageLabel(audioBufferUsage)}</div>
          <p className="inline-note" style={{ marginTop: 0 }}>ハリオ：「{harioBufferEncourage(audioBufferUsage)}」</p>
          <button
            className="btn primary block lg"
            onClick={() => {
              rebuildStop();
              if (audioBufferUsage === 'review') {
                setSource('review');
                setCustomReviewIds(null);
                setFilterSubject('');
              } else {
                // 積み残し消化：同じ条件のまま続きの束へ（もう一度と同じローテーション方式）
                setReviewOffsetPersist((off) => off + (reviewTarget || audioBufferPlan.baseTaskQuestionCount));
              }
              setReviewTarget(audioBufferPlan.bufferQuestionCount || null);
              setSessionGradedCount(0);
              setSessionWrong([]);
              setSessionWrongKinds({});
              setSessionLatencies([]);
              setVoiceAnswerStats({ attempts: 0, matched: 0 });
              setAudioBufferPlan(null);
              setAudioBufferUsage(null);
              requestAutoPlay();
            }}
          >
            🧩 バッファ枠（約{audioBufferPlan.bufferMinutes}分・{audioBufferPlan.bufferQuestionCount}問）を音声で始める
          </button>
          <button className="btn ghost sm block" style={{ marginTop: 6 }} onClick={() => { setAudioBufferPlan(null); setAudioBufferUsage(null); }}>
            今日はここまでにする
          </button>
        </div>
      )}

      {masteredCount > 0 && (
        <div className="card" style={{ marginBottom: 10 }}>
          🏆 マスター済み累計 <strong>{masteredCount}</strong> 問
          <div className="weekbar" title="直近7日の読み上げ量" style={{ marginTop: 6 }}>
            {weeklyAudio.map((c, i) => (
              <span key={i} className="weekbar-col">
                <i style={{ height: `${Math.round((c / weeklyAudioMax) * 100)}%` }} />
              </span>
            ))}
            <span className="weekbar-label">7日</span>
          </div>
        </div>
      )}

      {/* K21：想起練習（recallMode／pureRecallOn）限定の今週・先週の比較 */}
      {(recallWeekStats.thisCount > 0 || recallWeekStats.lastCount > 0) && (
        <div className="card" style={{ marginBottom: 10 }}>
          <div className="section-label" style={{ marginTop: 0 }}>🔁 想起練習の週次比較</div>
          <p className="inline-note" style={{ marginTop: 0 }}>
            今週：{recallWeekStats.thisCount}問{recallWeekStats.thisAcc != null ? `（正答率約${recallWeekStats.thisAcc}%）` : ''}
            先週：{recallWeekStats.lastCount}問{recallWeekStats.lastAcc != null ? `（正答率約${recallWeekStats.lastAcc}%）` : ''}
          </p>
        </div>
      )}

      {balanceWarning.hasWarning && (
        <div className="card" style={{ borderLeft: '4px solid var(--wrong)' }}>
          <div className="section-label" style={{ marginTop: 0 }}>⚖️ 科目バランスの偏りに注意</div>
          <p className="inline-note" style={{ marginTop: 0 }}>
            他の科目は平均{formatPercent(balanceWarning.avgAccuracy)}前後で解けているのに、次の科目だけ極端に低いままです。
          </p>
          <div className="btn-row" style={{ flexWrap: 'wrap' }}>
            {balanceWarning.weakSubjects.map((s) => (
              <button key={s.subject} className="chip" onClick={() => applyFilter({ subject: s.subject })}>
                {s.subject}<span className="inline-note" style={{ marginLeft: 4 }}>（{formatPercent(s.accuracy)}）</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {focusSubject && source !== 'review' && (
        <p className="inline-note" style={{ marginBottom: 10 }}>
          🧭 たまには苦手分野の「{focusSubject.subject.name}」の読み上げにも挑戦してみましょう（{focusSubject.reason}）。
          <button className="btn ghost sm" style={{ marginLeft: 8 }} onClick={() => applyFilter({ subject: focusSubject.subject.name })}>この科目にしぼる</button>
        </p>
      )}

      {forgettingPick && (
        <div className="card">
          <div className="section-label" style={{ marginTop: 0 }}>🧠 忘れそうな1問</div>
          <p className="inline-note" style={{ marginTop: 0 }}>
            「{(forgettingPick.question.question || '（図の問題）').slice(0, 40)}」の保持率は約{Math.round(forgettingPick.retrievability * 100)}%まで下がってきています。
          </p>
          <button className="btn ghost sm" onClick={() => { startReviewSource(); setCustomReviewIds([forgettingPick.question.id]); }}>
            🔊 この問題を今すぐ音声で確認する
          </button>
        </div>
      )}

      {lastSessionMisses.length > 0 && (
        <button
          className="btn block"
          style={{ marginBottom: 10 }}
          onClick={() => { startReviewSource(); setCustomReviewIds(lastSessionMisses.map((q) => q.id)); }}
        >
          📚 さっきの学習で間違えた{lastSessionMisses.length}問をすぐ読み上げ
        </button>
      )}

      {reviewPool.length >= 3 && source !== 'review' && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <div className="section-label" style={{ marginTop: 0 }}>🎯 今日のおすすめ</div>
          <p style={{ margin: '4px 0 10px' }}>
            間違えた問題（△・✕、念のため確認を含む）が <strong>{reviewPool.length}問</strong> たまっています。
            先に復習すると定着しやすくなります。
          </p>
          <button className="btn accent" onClick={startReviewSource}>🔁 間違えた問題を読み上げる</button>
        </div>
      )}

      {/* よく使う「科目×件数」の組み合わせ（2回以上使ったものだけ、上位3件） */}
      {source !== 'review' && !(source === 'filter' && newOnly) && topCombos(audioLog).length > 0 && (
        <div className="chip-row" style={{ marginBottom: 10 }}>
          <span className="section-hint">よく使う組み合わせ：</span>
          {topCombos(audioLog).map((c, i) => (
            <button
              key={i}
              className="chip"
              onClick={() => {
                startReviewSource();
                if (c.subject) setFilterSubject(c.subject);
                setReviewTarget(c.target);
              }}
            >
              {c.subject || '全科目'}×{c.target ?? 'すべて'}（{c.count}回）
            </button>
          ))}
        </div>
      )}
      {/* 改善案i4：2回以上使った組み合わせがまだ無い時は、直近1回だけの組み合わせを薄く案内する
          （「よく使う」ではないと分かるよう、chip ghostで控えめに表示） */}
      {source !== 'review' && !(source === 'filter' && newOnly) && topCombos(audioLog).length === 0 && recentCombo(audioLog) && (
        <div className="chip-row" style={{ marginBottom: 10 }}>
          <span className="section-hint">直近の組み合わせ：</span>
          {(() => {
            const c = recentCombo(audioLog);
            return (
              <button
                className="chip ghost"
                onClick={() => {
                  startReviewSource();
                  if (c.subject) setFilterSubject(c.subject);
                  setReviewTarget(c.target);
                }}
              >
                {c.subject || '全科目'}×{c.target ?? 'すべて'}
              </button>
            );
          })()}
        </div>
      )}

      {/* #41：通勤・隙間時間向けの「◯分だけ」ミニセッション（検索・設定を経由せず即開始） */}
      <div className="card" style={{ marginBottom: 10 }}>
        <div className="section-label" style={{ marginTop: 0 }}>🚃 隙間時間に</div>
        <p className="inline-note" style={{ marginTop: 0 }}>まだ解いていない問題から、今すぐ短いミニセッションを始めます。</p>
        <div className="btn-row">
          <button className="btn sm" onClick={() => startQuickMinute(5)}>5分だけ</button>
          <button className="btn sm" onClick={() => startQuickMinute(10)}>10分だけ</button>
        </div>
      </div>

      {/* 盲目の受験生からの改善提案（2026-11-15）：検索条件を経由しない単発の記憶術モード */}
      <div className="card" style={{ marginBottom: 10 }}>
        <div className="section-label" style={{ marginTop: 0 }}>🧠 記憶術モード</div>
        <div className="btn-row" style={{ flexWrap: 'wrap' }}>
          <button
            className="btn sm"
            onClick={() => startSimpleSource('bodyLocation', '🧘 体の場所法で読み上げます。触って位置を確認しながら聞いてください')}
          >
            🧘 体の場所法（八会穴）
          </button>
          <button
            className="btn sm"
            onClick={() => startSimpleSource('confusingPairs', `😵 紛らわしい名前のペアを${CONFUSING_PAIRS.length}組確認します`)}
          >
            😵 紛らわしいペア（{CONFUSING_PAIRS.length}組）
          </button>
          <button
            className="btn sm"
            disabled={!homophoneInfo}
            onClick={() => startSimpleSource('homophone', `🈁 同じ読みの経穴を${homophoneInfo ? homophoneInfo.groups.length : ''}組、聞き分けます`)}
          >
            🈁 同じ読みの経穴ドリル{homophoneInfo ? `（${homophoneInfo.groups.length}組）` : '（読み込み中）'}
          </button>
          {homeworkIds.length > 0 && (
            <button
              className="btn sm"
              onClick={() => startSimpleSource('homework', `🏠 宿題リプレイ：あとで調べるに登録した${homeworkIds.length}問を読み直します`)}
            >
              🏠 宿題リプレイ（{homeworkIds.length}問）
            </button>
          )}
        </div>
        <p className="inline-note" style={{ marginTop: 6 }}>
          体の場所法：頭→顔→首→肩→胸→お腹→腰→太もも→膝→すね→足の順に経穴を配置して読みます。
          同じ読みの経穴ドリル：少海・小海・照海のように読みが同じ経穴を、組ごとに「いくつある？」→1つずつ「どの字？」と聞き分けます。
          宿題リプレイ：「📌 あとで調べる」に登録してから一晩（12時間）以上経った問題だけを優先して読み直します。
        </p>
        {source === 'bodyLocation' && (
          <Opt
            on={keiketsuRecallOn}
            onToggle={() => setKeiketsuRecallOn((v) => !v)}
            title="🔁 経穴名・経絡も声に出してから聞く（双方向）"
            desc="「ここは◯◯です。経穴名と、経絡は？」と先に声に出してから、両方まとめて正解を聞きます。"
          />
        )}
      </div>

      {/* G11・G12：音声版の本番想定モード（午前/午後と同じ科目別配分で連続出題。自己採点のみ・参考スコア） */}
      <div className="card" style={{ marginBottom: 10 }}>
        <div className="section-label" style={{ marginTop: 0 }}>⏱ 本番想定モード</div>
        <p className="inline-note" style={{ marginTop: 0 }}>
          本番と同じ科目別配分（午前/午後）で連続出題します。自己採点のみで進み、合格ラインは
          あくまで参考（配分自体は公式資料で確認中の値です）。
        </p>
        <div className="btn-row">
          <button className="btn sm" onClick={() => startMockExam('am')}>午前の配分で始める</button>
          <button className="btn sm" onClick={() => startMockExam('pm')}>午後の配分で始める</button>
        </div>
      </div>

      {/* #17・#18：就寝前まとめ復習（その日に解いた問題だけを短く読み直し、自動終了タイマー付き） */}
      <div className="card" style={{ marginBottom: 10 }}>
        <div className="section-label" style={{ marginTop: 0 }}>🌙 就寝前まとめ復習</div>
        <p className="inline-note" style={{ marginTop: 0 }}>今日解いた問題だけを短く読み直します。寝る前の軽い復習に。睡眠を削ってまで続けないよう、時間になったら自動で終了します。</p>
        <div className="btn-row">
          <button className="btn sm" onClick={() => startBedtimeReview(15)}>15分で終了</button>
          <button className="btn sm" onClick={() => startBedtimeReview(20)}>20分で終了</button>
          <button className="btn sm" onClick={() => startBedtimeReview(30)}>30分で終了</button>
        </div>
      </div>

      {/* 上部の検索（科目名・ジャンル・キーワードでしぼり込む） */}
      <div className="card audio-search">
        <div className="section-label" style={{ marginTop: 0 }}>🔍 検索（しぼり込み）</div>
        <div className="search-grid">
          <label className="mini-field">
            <span>科目名</span>
            <select value={filterSubject} onChange={(e) => applyFilter({ subject: e.target.value })}>
              <option value="">指定なし</option>
              {subjectOptions.map((s, i) => (
                <option key={s} value={s}>{i + 1}. {s}</option>
              ))}
            </select>
          </label>
          <label className="mini-field">
            <span>ジャンル</span>
            <select value={filterGenre} onChange={(e) => applyFilter({ genre: e.target.value })}>
              <option value="">指定なし</option>
              {genreOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="mini-field">
            <span>キーワード</span>
            <select value={filterKeyword} onChange={(e) => applyFilter({ keyword: e.target.value })} disabled={keywordOptions.length === 0}>
              <option value="">指定なし</option>
              {keywordSections.map((sec) => (
                <optgroup key={sec.label} label={`- ${sec.label} -`}>
                  {sec.items.map((s) => (<option key={s} value={s}>{s}</option>))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="mini-field">
            <span>回（年度）</span>
            <select value={filterRound} onChange={(e) => applyFilter({ round: e.target.value })} disabled={roundOptions.length === 0}>
              <option value="">指定なし</option>
              {roundOptions.map((r) => (<option key={r} value={r}>{formatRound(r)}</option>))}
            </select>
          </label>
        </div>

        {/* 弱点タグ（学習(10・60・300・900)から移植）：誤答が多いタグをタップでしぼり込み */}
        {weakAudioTags.length > 0 && (
          <div className="weak-tags">
            <span className="weak-tags-label">弱点タグ</span>
            <div className="chip-row">
              {weakAudioTags.map((w) => (
                <button
                  key={w.tag}
                  className={`chip ${filterKeyword === w.tag ? 'active' : ''}`}
                  onClick={() => applyFilter({ keyword: filterKeyword === w.tag ? '' : w.tag })}
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
          value={filterTerm}
          onChange={(e) => changeFilterTerm(e.target.value)}
          placeholder="🔎 語で検索（例：顔面神経・足三里・糖尿病）科目をまたいで探せます"
          style={{ marginTop: 10 }}
        />

        <label className="autokw-row" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={bookmarkOnly} onChange={toggleBookmarkOnly} />
          <span>★ ブックマークした問題だけ読み上げ</span>
        </label>
        <label className="autokw-row" style={{ marginTop: 6 }}>
          <input type="checkbox" checked={newOnly} onChange={toggleNewOnly} />
          <span>🆕 まだ解いていない問題だけ（下に件数チップが出ます）</span>
        </label>
        <label className="autokw-row" style={{ marginTop: 6 }}>
          <input type="checkbox" checked={recentOnlyFilter} onChange={toggleRecentOnlyFilter} />
          <span>🆕 新着だけ（直近14日でコンテンツ更新により追加された問題）</span>
        </label>
        {/* 出題形式でしぼる（2026-11-08追加）。今までは科目を選んでも原問（4択の元問題）・
            一問一答の派生・○×が区別なく混ざって読み上げられていた。組み合わせ可能。 */}
        <label className="autokw-row" style={{ marginTop: 6 }}>
          <input type="checkbox" checked={derivedOnly} onChange={toggleDerivedOnly} />
          <span>📝 一問一答だけ（原問＝4択の元問題を除く）</span>
        </label>
        <label className="autokw-row" style={{ marginTop: 6 }}>
          <input type="checkbox" checked={oxOnly} onChange={toggleOxOnly} />
          <span>⭕ マルバツ（○×）だけ</span>
        </label>
        {(derivedOnly || oxOnly) && (
          <p className="inline-note" style={{ marginTop: 4 }}>
            両方チェックすると「一問一答かつ○×」だけに絞られます。この条件で
            <strong> {filteredPool.length}</strong> 問（下の件数チップの「すべて」＋繰り返しオフで
            もれなく1周できます。途中で閉じても「続きから」で再開できます）。
          </p>
        )}
        <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
          <label>複数科目をバランスよく混ぜて読む（2科目以上選ぶと単一の科目選択より優先）</label>
          <div className="chip-row" style={{ marginBottom: 0 }}>
            {subjectOptions.map((s, i) => (
              <button key={s} className={`chip ${rotateSubjects.includes(s) ? 'active' : ''}`} onClick={() => toggleRotateSubject(s)}>
                {i + 1}. {s}
              </button>
            ))}
          </div>
          {/* E9：混同しやすい科目の組をワンタップで選ぶ（インターリーブ学習の意図的な版）。 */}
          {CONFUSING_SUBJECT_PAIRS.filter(([a, b]) => subjectOptions.includes(a) && subjectOptions.includes(b)).length > 0 && (
            <div className="chip-row" style={{ marginTop: 6, marginBottom: 0 }}>
              <span className="section-hint">😵 紛らわしい科目の組を混ぜる：</span>
              {CONFUSING_SUBJECT_PAIRS.filter(([a, b]) => subjectOptions.includes(a) && subjectOptions.includes(b)).map((pair) => (
                <button key={pair.join('×')} className="chip ghost" onClick={() => pickSubjectPair(pair)}>
                  {pair[0]}×{pair[1]}
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="autokw-row" style={{ marginTop: 6 }}>
          <input type="checkbox" checked={leechFirst} onChange={(e) => setLeechFirst(e.target.checked)} />
          <span>⚠️ リーチ（要注意）問題を優先して読む</span>
        </label>
        {/* A7：要注意件数の開始前バナー（学習10・60・300・900の#7と同じ考え方） */}
        {audioLeechCount > 0 && (
          <p className="inline-note" style={{ marginTop: 8 }}>
            ⚠️ 要注意（{LEECH_THRESHOLD}回以上の誤答）の問題が<strong>{audioLeechCount}問</strong>あります。
            上の「リーチ（要注意）問題を優先して読む」で優先して聞けます。
            {onNavigate && <button className="btn ghost sm" style={{ marginLeft: 8 }} onClick={() => onNavigate('review')}>復習で見る</button>}
          </p>
        )}
        {(source === 'filter' || source === 'all') && (() => {
          const ratioPool = source === 'filter' ? filteredPool : questions;
          const newRemainingAudio = ratioPool.filter((q) => !srs[q.id] || (srs[q.id].seen || 0) === 0).length;
          const reviewRemainingAudio = reviewPoolFor(ratioPool, srs).length;
          return (
            <div className="field" style={{ marginTop: 8 }}>
              <div className="section-label" style={{ marginTop: 0 }}>
                新規と復習の割合（学習10・60・300・900と同じ考え方。未指定なら全件そのまま）
                <button
                  className="btn ghost sm"
                  style={{ float: 'right' }}
                  onClick={() => {
                    const rec = recommendNewPct(newRemainingAudio, reviewRemainingAudio, audioReviewStalledDays);
                    changeAudioNewPct(rec.pct);
                    onToast?.(rec.reason);
                  }}
                >
                  🎯 今日のおすすめ
                </button>
              </div>
              <p className="inline-note" style={{ marginTop: 0 }}>
                この条件で残り新規 <strong>{newRemainingAudio}</strong> 問・残り復習 <strong>{reviewRemainingAudio}</strong> 問
              </p>
              <div className="chip-row">
                {[
                  { p: 100, l: 'すべて新規' },
                  { p: 70, l: '新規多め' },
                  { p: 50, l: '半々' },
                  { p: 30, l: '復習多め' },
                  { p: 0, l: 'すべて復習' },
                ].map((o) => (
                  <button key={o.p} className={`chip ${audioNewPct === o.p ? 'active' : ''}`} onClick={() => changeAudioNewPct(o.p)}>
                    {o.l}
                  </button>
                ))}
              </div>
              <div className="range-row" style={{ marginTop: 8 }}>
                <input
                  type="range" min="0" max="100" step="10"
                  value={audioNewPct ?? 50}
                  onChange={(e) => changeAudioNewPct(Number(e.target.value))}
                />
                <span className="range-val">
                  {audioNewPct == null ? '未指定（全件そのまま）' : `新規${audioNewPct}% / 復習${100 - audioNewPct}%`}
                </span>
                {audioNewPct != null && (
                  <button className="btn ghost sm" onClick={() => changeAudioNewPct(null)}>解除</button>
                )}
              </div>
              <div className="hint">
                <strong>新規</strong>＝まだ一度も解いていない問題、<strong>復習</strong>＝一度解いて間違えた問題。
                <br />「<strong>すべて新規</strong>」を選ぶと、<strong>すでに解いた問題は読み上げず</strong>、未着手の問題だけを読みます（同じ問題は繰り返しません）。復習も混ぜたいときはスライダーで割合を下げてください。
              </div>
              {audioNewPct === 100 && newRemainingAudio === 0 && (
                <p className="inline-note" style={{ marginTop: 6, color: 'var(--warn, #e0a800)' }}>
                  この条件の新規問題はすべて解き終えました。復習するには割合を下げてください。
                </p>
              )}
              {audioNewPct === 0 && reviewRemainingAudio === 0 && (
                <p className="inline-note" style={{ marginTop: 6, color: 'var(--warn, #e0a800)' }}>
                  この条件で復習対象の問題はありません。新規を混ぜるには割合を上げてください。
                </p>
              )}
            </div>
          );
        })()}
        <div className="chip-row" style={{ marginTop: 8 }}>
          <span className="section-hint">直近の誤答だけ：</span>
          <button className={`chip ${recentOnly === 'today' ? 'active' : ''}`} onClick={() => changeRecentOnly('today')}>今日</button>
          <button className={`chip ${recentOnly === 'week' ? 'active' : ''}`} onClick={() => changeRecentOnly('week')}>今週</button>
        </div>
        <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
          <label>忘却リスクの下限（{riskTopN ? '上位件数を使用中' : minRisk === 0 ? '指定なし' : `${minRisk}%以上だけ`}）</label>
          <input
            type="range" min="0" max="90" step="10" value={minRisk} disabled={!!riskTopN}
            className={minRisk > 0 ? 'range-active' : ''}
            onChange={(e) => changeMinRisk(Number(e.target.value))}
          />
          <div className="chip-row" style={{ marginTop: 6, marginBottom: 0 }}>
            <span className="section-hint">しきい値ではなく上位◯件で選ぶ：</span>
            {[5, 10, 20, 30].map((n) => (
              <button key={n} className={`chip ${riskTopN === n ? 'active' : ''}`} onClick={() => changeRiskTopN(n)}>上位{n}件</button>
            ))}
          </div>
          <p className="inline-note" style={{ marginTop: 4 }}>
            どちらか一方だけが使えます。上位◯件を選ぶと、下限スライダーは自動で無効になります（解除するには上位◯件をもう一度タップ）。
          </p>
        </div>
        <div className="field" style={{ marginTop: 8 }}>
          <label>誤答回数の下限（{minWrong === 0 ? '指定なし' : `${minWrong}回以上だけ`}）</label>
          <input
            type="range" min="0" max="10" step="1" value={minWrong}
            className={minWrong > 0 ? 'range-active' : ''}
            onChange={(e) => { rebuildStop(); setMinWrong(Number(e.target.value)); }}
          />
        </div>
        <div className="search-foot">
          {filterActive ? (
            <>
              <span>この条件で <strong>{filteredPool.length}</strong> 問</span>
              <button className="btn ghost sm" onClick={clearFilter}>クリア</button>
            </>
          ) : (
            <span className="hint">科目・ジャンル・キーワードを選ぶと、その条件の問題だけを読み上げます（未選択でもOK）。</span>
          )}
        </div>
      </div>

      {/* #26：「あとで調べる」リスト（検索・用語集を開かず、その場で控えておいたキーワード） */}
      {laterLookup.length > 0 && (
        <div className="card" style={{ marginBottom: 10 }}>
          <button className="btn ghost sm block" onClick={() => setLaterLookupOpen((v) => !v)}>
            📌 あとで調べる（{laterLookup.length}件） {laterLookupOpen ? '▲' : '▼'}
          </button>
          {laterLookupOpen && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
              {laterLookup.map((e) => (
                <li key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <button className="chip" style={{ flex: 1, textAlign: 'left' }} onClick={() => applyFilter({ keyword: e.keyword })}>
                    {e.keyword}{e.subject ? `（${e.subject}）` : ''}
                  </button>
                  <button className="btn ghost sm" onClick={() => removeLaterLookup(e.id).then(setLaterLookup)}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* プレーヤー（検索のすぐ下に表示。くわしい設定は下にあります。2026-11-08追加） */}
      {builtPlan.length === 0 ? (
        <div className="empty">
          <div className="ico">🎧</div>
          <p>読み上げる項目がありません。</p>
          <p className="inline-note">
            {source === 'review'
              ? '復習対象がありません。一問一答や模擬試験で問題を解き、間違えた問題（△・✕）を溜めましょう。'
              : source === 'tagged'
              ? 'キーワード（連結キーワード / タグ）を付けた問題がありません。問題を解いたあと「キーワード・連結メモを追加」から付けられます。'
              : source === 'filter'
              ? '選んだ条件に合う問題がありません。上の検索で条件をゆるめる（別の科目・ジャンルにする、キーワードを「指定なし」に戻す）か、「クリア」してください。'
              : kwLike
              ? 'キーワード（連結キーワード / タグ）を付けた問題を用意すると、ここで回せます。問題を解いたあと「キーワード・連結メモを追加」から付けられます。'
              : 'まずは一問一答や模擬試験で問題を解き、間違えた問題を溜めましょう。'}
          </p>
        </div>
      ) : (
        <>
          {!settings.audioPlayerTipDismissed && (
            <p className="inline-note" style={{ marginBottom: 10 }}>
              💡 まずは▶を押すだけで始められます。くわしい設定（件数・連結学習モード・声など）は下にあります。
              <button className="btn ghost sm" style={{ marginLeft: 8 }} onClick={() => updateSettings({ audioPlayerTipDismissed: true })}>✕ 次回から表示しない</button>
            </p>
          )}
          {/* プレーヤー */}
          <div className="player" ref={playerRef} onTouchStart={onPlayerTouchStart} onTouchEnd={onPlayerTouchEnd}>
            {/* スクリーンリーダー向け：フェーズの切り替えを読み上げとは別に伝える */}
            <div aria-live="polite" className="sr-only">
              {phase === PHASES.QUESTION && '問題'}
              {phase === PHASES.GAP && '考え中'}
              {phase === PHASES.ANSWER && '正解と解説'}
              {phase === PHASES.NOTE && 'まとめ'}
            </div>
            {currentItem?.keyword && <div className="now-keyword">🔗 {currentItem.keyword}</div>}
            {/* 学習(10・60・300・900)の.sess-topbarと同じく、flexboxで分けて折り返しても
                読める形にする（以前は3つの.now-indexをfloat:rightで並べていたため、
                スマホ幅で折り返すと「📅 今日の目標 0/300問1 / 3301」のようにすき間なく
                連結して読めなくなるのを実機で確認した）。 */}
            <div className="player-topbar">
              <span className="now-phase">
                {phase === PHASES.KEYWORD && (currentItem?.kind === 'flashcard' ? '用語' : 'キーワード')}
                {phase === PHASES.QUESTION && '問題'}
                {phase === PHASES.GAP && '……考え中……'}
                {phase === PHASES.ANSWER && (currentItem?.kind === 'flashcard' ? '意味・要点' : '正解・解説')}
                {phase === PHASES.NOTE && (currentItem?.kind === 'summary' ? 'まとめ' : 'つながり')}
              </span>
              <span className="player-topbar-stats">
                <span className="now-index">{index + 1} / {total}</span>
                {effectiveGoal > 0 && (
                  <span className="now-index">
                    🎯 目標 {Math.min(goalHeardCount, effectiveGoal)} / {effectiveGoal}問
                    {mood === 'tired' && goal > 0 && effectiveGoal < goal && '（少なめに調整中）'}
                  </span>
                )}
                <span className="now-index">
                  📅 今日の目標 {dailyGoalCount}/{effectiveDailyGoal}問
                  {recallTodayCount > 0 && <span style={{ marginLeft: 6 }}>（想起{recallTodayCount}問）</span>}
                </span>
              </span>
            </div>
            {/* 視覚的な進捗バー（学習(10・60・300・900)の.progressと同じ考え方）。
                文字の分数だけより、ちらっと見ただけで進み具合が分かる。かつ、バーを動かして
                任意の問題番号へ直接ジャンプできる（ユーザー指定・2026-11-14。例：解剖学102問の
                時に53問や82問へ飛ばす）。ドラッグ中はonChangeで見た目（seekPreview）だけ更新し、
                指を離した時（onPointerUp/onMouseUp/onTouchEnd/onKeyUp）にだけ実際にジャンプする
                ——native rangeのonChangeはドラッグ中も連続発火するため、毎フレーム読み上げを
                飛ばし直すと音声がガタつく。 */}
            {total > 1 && (
              <div className={`player-progress player-seek-wrap${seekMarks.length ? ' has-marks' : ''}${seekPreview != null ? ' dragging' : ''}`}>
                {/* 6等分の目印（赤い点＋真上に問題番号）。ドラッグ中の吹き出しに近い番号は薄くして重ねない。
                    span にしない（.player-progress > span の帯の塗りが当たって白い棒になる） */}
                {seekMarks.map((m) => (
                  <div
                    key={m.n}
                    className={`player-seek-mark${seekPreview != null && Math.abs(m.ratio - (seekPreview - 1) / (total - 1)) < 0.12 ? ' dim' : ''}`}
                    style={{ left: `calc(8px + (100% - 16px) * ${m.ratio})` }}
                    aria-hidden="true"
                  >
                    <span className="player-seek-mark-label">{m.n}</span>
                  </div>
                ))}
                <input
                  type="range"
                  className="player-seek"
                  min={1}
                  max={total}
                  step={1}
                  value={seekPreview ?? index + 1}
                  onChange={(e) => previewSeek(Number(e.target.value))}
                  onPointerUp={commitSeek}
                  onPointerCancel={commitSeek}
                  onMouseUp={commitSeek}
                  onTouchEnd={commitSeek}
                  onKeyUp={commitSeek}
                  onBlur={() => { if (seekPreviewRef.current != null) commitSeek(); }}
                  aria-label="問題番号（ドラッグして移動）"
                  aria-valuetext={`${seekPreview ?? index + 1}問目 / 全${total}問`}
                  style={{
                    background: `linear-gradient(to right, #fff ${((seekPreview ?? index + 1) - 1) / (total - 1) * 100}%, rgba(255,255,255,0.18) ${((seekPreview ?? index + 1) - 1) / (total - 1) * 100}%)`,
                  }}
                />
                {seekPreview != null && (() => {
                  const r = (seekPreview - 1) / (total - 1);
                  // 右端に近い時は吹き出しを左上へ（はみ出さない）
                  const flip = r > 0.82;
                  return (
                    <div
                      className={`player-seek-bubble${flip ? ' flip' : ''}`}
                      style={{ left: `calc(8px + (100% - 16px) * ${r})` }}
                      aria-hidden="true"
                    >
                      {seekPreview}
                      <small>/{total}</small>
                    </div>
                  );
                })()}
              </div>
            )}
            {total === 1 && (
              <div className="player-progress">
                <span style={{ width: '100%' }} />
              </div>
            )}

            <div className="now-subject">
              {current && !['flashcard', 'summary', 'compare', 'number'].includes(currentItem?.kind) && (
                <span className={`badge ${current.type === 'ox' ? 'ox' : 'choice'}`} style={{ marginRight: 6 }}>
                  {current.type === 'ox' ? '○×' : '四択'}
                </span>
              )}
              {current?.subject ||
                (currentItem?.kind === 'flashcard'
                  ? '用語カード'
                  : currentItem?.kind === 'summary'
                  ? 'まとめ'
                  : currentItem?.kind === 'compare'
                  ? '比較・対比'
                  : currentItem?.kind === 'number'
                  ? '数値'
                  : '')}
            </div>
            {current?.image && <img className="now-image" src={current.image} alt="問題の図" loading="lazy" />}
            {current && needsFigureWarning(current) && (
              <div className="inline-note" style={{ color: 'var(--warn, #b06a00)' }}>
                ⚠ この設問は図・写真に言及していますが、画像が登録されていません。この問題は判断せず、あとで報告してください。
              </div>
            )}
            {/* 記録済みの誤答理由（型）があれば、学習(10・60・300・900)のQuestionCardと同じく表示する */}
            {current && latestMissType(missTypes[current.id])?.type && (
              <div className="inline-note">
                {missTypeLabel(latestMissType(missTypes[current.id]).type)}の記録がある問題です。
              </div>
            )}
            {current && gradedIdsRef.current.has(current.id) && (
              <div className="inline-note">
                📝 この問題はすでに記録済みです（見直し用に表示中。もう一度選んでも二重には記録しません）。
              </div>
            )}
            <div className="now-text">
              {currentItem?.kind === 'flashcard'
                ? `用語：${currentItem.keyword}`
                : currentItem?.kind === 'summary'
                ? `キーワード「${currentItem.keyword}」のまとめ`
                : currentItem?.kind === 'compare'
                ? `比較：${currentItem.comp.title}`
                : currentItem?.kind === 'number'
                ? `数字：${currentItem.num.topic}`
                : currentItem?.kind === 'cloze'
                ? `穴埋め：${current?.question || ''}`
                : current?.question
                ? highlightKeywordsInText(current.question, curTags)
                : current?.image ? '図を見て答える問題' : ''}
            </div>
            {/* 対策案15：この問題で読みを直して読んでいる言葉（読み上げだけの置き換え。画面の文字は変えない） */}
            {current && st && speechStyle.readFix && (() => {
              const list = st.termsWithReading(`${current.question || ''}${current.explanation || ''}`, readingDict, 6);
              return list.length ? (
                <div className="inline-note" style={{ marginTop: 6, opacity: 0.85 }}>
                  🔤 読みを直して読む言葉：{list.map((x) => `${x.term}（${x.reading}）`).join('・')}
                </div>
              ) : null;
            })()}
            {/* 四択の選択肢は画面に出す（読み上げはしない。ユーザー指定）。並べ替えて読む設定の時は、
                声の「正解は◯番」と同じ順で出す。正解・解説の段では正解に印を付ける。
                完全想起モード（選択肢を見ずに思い出す練習）では、答えが出るまで出さない。 */}
            {shownChoices && (!pureRecallOn || phase === PHASES.ANSWER || phase === PHASES.NOTE) && (
              <ol className="now-choices" aria-label="選択肢">
                {shownChoices.choices.map((c, i) => {
                  const isAns = (phase === PHASES.ANSWER || phase === PHASES.NOTE) && i === shownChoices.answerIdx;
                  return (
                    <li key={i} className={isAns ? 'correct' : ''}>
                      <span className="now-choice-no">{i + 1}</span>
                      <span>{c}</span>
                      {isAns && <span className="now-choice-mark" aria-label="正解">✓</span>}
                    </li>
                  );
                })}
              </ol>
            )}

            {/* C5〜C7：声で解答モード。GAP中は自動で聞き取り中なので、その場で透明性を出す
                （聞き取れなければ自動では✕にせず、そのまま正解を読む流れへ進むことも明記）。 */}
            {current && voiceAnswerOn && currentItem?.kind === 'question' && phase === PHASES.GAP && (
              <p className="inline-note" style={{ textAlign: 'center' }}>
                🎙️ 声で答えを言ってみましょう（聞き取れなければ、そのまま正解を読みます）
              </p>
            )}
            {current && voiceAnswerOn && voiceAnswerHeard && voiceAnswerHeard.questionId === current.id && (
              <p className="inline-note" style={{ textAlign: 'center' }}>
                🎙️ 聞き取り：「{voiceAnswerHeard.heard || '（聞き取れませんでした）'}」
                {voiceAnswerHeard.matched ? '　→　正解と判定しました' : ''}
              </p>
            )}
            {/* アウトプットモード：GAP（考え中）で自動には進まず、ここで止まって待つ。
                自分の中で解答を決めてから押すと正解・解説が読まれる。 */}
            {outputModeOn && phase === PHASES.GAP && snap.waitingManual && (
              <button className="btn accent block" style={{ marginTop: 8 }} onClick={() => engine.resumeManual()}>
                ✅ 解答を見る（自分の中で答えを決めてから押してください）
              </button>
            )}

            {phase === PHASES.ANSWER && current && (
              <div className="now-answer">
                <strong>
                  正解：
                  {!Array.isArray(current.choices)
                    ? '画面の図・解説を確認してください'
                    : current.type === 'ox'
                    ? current.choices[current.answer]
                    : shownChoices
                    ? `${shownChoices.answerIdx + 1}. ${shownChoices.choices[shownChoices.answerIdx]}`
                    : `${current.answer + 1}. ${current.choices[current.answer]}`}
                </strong>
                {/* #7派生：二重符号化のキーワード反転表示を解説文にも広げる（問題文だけだった） */}
                {current.explanation && <div style={{ marginTop: 6 }}>{highlightKeywordsInText(current.explanation, curTags)}</div>}
              </div>
            )}
            {phase === PHASES.ANSWER && currentItem?.kind === 'flashcard' && (
              <div className="now-answer"><div>{currentItem.text}</div></div>
            )}
            {phase === PHASES.ANSWER && currentItem?.kind === 'compare' && (
              <div className="now-answer">
                {(currentItem.comp.members || []).map((m, i) => (
                  <div key={i}>・{m}</div>
                ))}
                {currentItem.comp.note && <div style={{ marginTop: 6 }}>💡 {currentItem.comp.note}</div>}
              </div>
            )}
            {phase === PHASES.ANSWER && currentItem?.kind === 'number' && (
              <div className="now-answer">
                <strong>{currentItem.num.value}</strong>
                {currentItem.num.note && <div style={{ marginTop: 6 }}>{currentItem.num.note}</div>}
              </div>
            )}
            {phase === PHASES.NOTE && currentItem?.kind === 'summary' && (
              <div className="now-answer note"><div>{currentItem.text}</div></div>
            )}
            {phase === PHASES.NOTE && current && currentItem?.note && (
              <div className="now-answer note">
                <strong>つながり：</strong>
                <div style={{ marginTop: 4 }}>{currentItem.note}</div>
              </div>
            )}

            {/* 3分の2バッファ術：基礎タスクの残り問数が少ない時のハリオのリマインド（学習10・60・300・900と同じ） */}
            {audioBufferPlan && !audioBufferUsage && (() => {
              const bufRemaining = (reviewTarget || 0) - (index + 1);
              const reminder = bufRemaining > 0 && bufRemaining <= 5 ? harioBaseTaskReminder(bufRemaining) : null;
              return reminder ? <p className="inline-note" style={{ textAlign: 'center' }}>🧑‍⚕️ ハリオ：「{reminder}」</p> : null;
            })()}
            {/* 60問区切りのセット番号（学習10・60・300・900の「セット◯/◯」と同じ考え方の常設表示） */}
            {total >= 60 && (
              <p className="inline-note" style={{ textAlign: 'center', marginTop: 0 }}>
                セット{Math.floor(index / 60) + 1}/{Math.ceil(total / 60)}
              </p>
            )}

            <div className="phase-indicator">
              <div className={`seg ${phase === PHASES.KEYWORD || phase === PHASES.QUESTION ? 'on' : ''}`} />
              <div className={`seg ${phase === PHASES.GAP ? 'on' : ''}`} />
              <div className={`seg ${phase === PHASES.ANSWER || phase === PHASES.NOTE ? 'on' : ''}`} />
            </div>

            <div className="player-controls">
              {total > 1 && (
                <button
                  className="mark-jump"
                  onClick={() => jumpMark(-1)}
                  disabled={index === 0}
                  aria-label={`戻る（前の区切り${markTarget(-1) != null ? `・${markTarget(-1)}問目` : ''}へ）`}
                >◀</button>
              )}
              <button onClick={() => skip(-1)} disabled={index === 0} aria-label="前へ">⏮</button>
              <button className="main" onClick={togglePlay} aria-label="再生 / 一時停止">{playing ? '⏸' : '▶'}</button>
              <button onClick={() => skip(1)} disabled={index >= total - 1} aria-label="次へ">⏭</button>
              {total > 1 && (
                <button
                  className="mark-jump"
                  onClick={() => jumpMark(1)}
                  disabled={index >= total - 1}
                  aria-label={`進む（次の区切り${markTarget(1) != null ? `・${markTarget(1)}問目` : ''}へ）`}
                >▶</button>
              )}
            </div>
            {total > 1 && (
              <div className="mark-jump-hint">赤い◀▶：バーの赤い点（区切り）へ戻る・進む／⏮⏭：1問ずつ</div>
            )}
            {/* #43：60問区切りの小休止を選べる（以前はトーストで知らせるだけだった）。 */}
            {breakPending && (
              <div className="card" style={{ marginTop: 10 }} role="region" aria-label="休憩の選択" tabIndex={-1}>
                <div className="section-label" style={{ marginTop: 0 }}>
                  {breakReason === 'time' && '✋ 5分たちました。ひと休みしましょう'}
                  {breakReason === 'ear' && '👂 30分再生しました。耳を休めませんか？'}
                  {breakReason === 'count' && `✋ ${BREAK_EVERY}問区切りです。ひと休みしましょう`}
                </div>
                <div className="btn-row" style={{ flexWrap: 'wrap' }}>
                  <button ref={breakFirstBtnRef} className="btn accent sm" onClick={() => resumeFromBreak(0)}>▶ すぐ続ける</button>
                  {breakReason === 'ear' && (
                    <button
                      className="btn ghost sm"
                      onClick={() => { setTtsVolume((v) => Math.max(0.2, v - 0.2)); earRestNotifiedRef.current = false; playingAccumRef.current = 0; resumeFromBreak(0); }}
                    >
                      🔉 音量を少し下げて続ける
                    </button>
                  )}
                  <button className="btn ghost sm" onClick={() => resumeFromBreak(1)}>1分後に自動再開</button>
                  <button className="btn ghost sm" onClick={() => resumeFromBreak(5)}>5分後に自動再開</button>
                  <button className="btn ghost sm" onClick={() => setBreakPending(false)}>🏁 ここで終了する（あとで続きから）</button>
                </div>
              </div>
            )}
            {index > 0 && (
              <ResetControl
                label="音声学習を最初からリセットする"
                confirming={confirmAudioReset}
                onAsk={() => setConfirmAudioReset(true)}
                onConfirm={resetToStart}
                onCancel={() => setConfirmAudioReset(false)}
              />
            )}

            {/* 👆 画面を大きくタップして自己採点（タップ＝○・長押し＝✕） */}
            {current && wideTapOn && (
              <div
                className="wide-tap-zone"
                onPointerDown={() => { wideTapDownRef.current = Date.now(); }}
                onPointerUp={() => {
                  const dt = Date.now() - (wideTapDownRef.current || Date.now());
                  const isBatsu = dt >= 600;
                  // 盲目の受験生からの改善提案#5：見えない状態で採点すると、実際に
                  // どちらが記録されたか確認する手段が無かった。○＝上昇音・✕＝下降音で区別する。
                  beep(1, isBatsu ? 420 : 1200, 70);
                  gradeCurrent(isBatsu ? 'batsu' : 'maru');
                }}
              >
                👆 タップ＝○　長押し（0.6秒）＝✕
              </div>
            )}
            {/* #10 聞きながら自己採点＋キーワード追加＋ブックマーク */}
            {current && (
              <div className="selfgrade">
                <button className="sg-btn ok" onClick={() => gradeCurrent('maru')}>○ できた</button>
                <button className="sg-btn mid" onClick={() => gradeCurrent('sankaku')}>△ あいまい</button>
                <button className="sg-btn ng" onClick={() => gradeCurrent('batsu')}>✕ できない</button>
                <button className={`sg-btn q-bookmark${bookmarks[current.id] ? ' on' : ''}`} onClick={toggleCurrentBookmark}>
                  {bookmarks[current.id] ? '★ ブックマーク済み' : '☆ ブックマーク'}
                </button>
                <button className="sg-btn" onClick={() => setTagOpen((v) => !v)}>🔗 キーワード追加</button>
              </div>
            )}
            {/* #16：自分の言葉で言い直す練習を録音する（端末内保存のみ、直近20件）。 */}
            {current && (
              <label className="autokw-row" style={{ marginTop: 6 }}>
                <input type="checkbox" checked={teachModeOn} onChange={(e) => setTeachModeOn(e.target.checked)} />
                <span>🧑‍🏫 「後輩に教えるつもりで」と録音前に促す（教えるモード）</span>
              </label>
            )}
            {current && (
              <div className="btn-row" style={{ marginTop: 6, flexWrap: 'wrap' }}>
                {!recordingOn ? (
                  <button className="btn ghost sm" onClick={() => startSelfVoiceRecording()}>🎙️ 自分の声で言い直して録音</button>
                ) : (
                  <button className="btn accent sm" onClick={stopSelfVoiceRecording}>⏹ 録音を終える</button>
                )}
                {selfVoiceNotes.some((n) => n.questionId === current.id) && (
                  <>
                    <button className="btn ghost sm" onClick={() => playSelfVoiceNote(current.id)}>▶ 自分の説明を聞く</button>
                    <button
                      className="btn ghost sm"
                      onClick={() => storage.deleteSelfVoiceNote(current.id).then(setSelfVoiceNotes)}
                    >
                      🗑 録音を削除
                    </button>
                  </>
                )}
              </div>
            )}
            {/* A10：誤答理由をその場で選べるように（△・✕を選んだ直後だけ表示。
                完了画面でまとめて選ぶのとは別に、忘れないうちに今すぐ記録できる） */}
            {current && justGradedWrongId === current.id && (
              <div style={{ marginTop: 6 }}>
                <span className="inline-note" style={{ marginRight: 6 }}>この誤答、理由は？</span>
                {/* 学習(10・60・300・900)のQuestionCard.jsxと同じ.misstype-row（横スクロール・
                    折り返さない）に統一（レイアウト崩れ防止）。 */}
                <div className="misstype-row" style={{ marginTop: 4 }}>
                  {MISS_TYPES.map((t) => (
                    <button
                      key={t.id}
                      className="chip"
                      onClick={() => {
                        onMissType(current.id, t.id);
                        setJustGradedWrongId(null);
                        onToast?.(`「${t.label}」として記録しました`);
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                  <button className="chip ghost" onClick={() => setJustGradedWrongId(null)}>あとで</button>
                </div>
                {/* J20：誤答理由を声で自己分析し録音する（既存の自分の声で言い直す録音を再利用）。 */}
                <button
                  className="btn ghost sm"
                  style={{ marginTop: 6 }}
                  onClick={() => startSelfVoiceRecording('🤔 なぜ間違えたと思うか、話してください。')}
                >
                  🎙️ なぜ間違えたか録音する
                </button>
              </div>
            )}
            {/* A9：自己説明ステップ（音声版）。QuestionCard.jsxのwhyPromptと同じ考え方で、
                誤答直後に「なぜこの答え？」を一言メモできるようにする（声でも促す）。 */}
            {current && justGradedWrongId === current.id && (
              <div className="why-box">
                <div className="elaborate-head">🤔 なぜこの答え？（自分の言葉で一言）</div>
                <div className="goro-edit">
                  <input value={audioWhy} onChange={(e) => setAudioWhy(e.target.value)} placeholder="理由・つながりを一言" />
                  <button
                    className="btn primary sm"
                    disabled={!audioWhy.trim()}
                    onClick={() => {
                      const m = memos[current.id];
                      setMemo(current.id, (m ? m + ' / ' : '') + 'なぜ:' + audioWhy.trim());
                      setAudioWhy('');
                      onToast?.('メモに記録しました');
                    }}
                  >
                    記録
                  </button>
                </div>
              </div>
            )}
            {current && (
              <p className="inline-note" style={{ marginTop: 6 }}>
                ✓ ○/△/✕は今日の学習記録（マスコットの今日の目標）にも反映されます。
              </p>
            )}
            {/* 語呂合わせノート（kwMeta）との連携：登録済みならその場で表示、無ければ登録導線 */}
            {current && curTags[0] && (
              kwMeta[curTags[0]]?.mnemonic ? (
                <div className="card" style={{ marginTop: 8 }}>
                  <div className="section-label" style={{ marginTop: 0 }}>📔 語呂合わせ</div>
                  <p style={{ margin: 0 }}>{kwMeta[curTags[0]].mnemonic}</p>
                </div>
              ) : onOpenMnemonicKeyword ? (
                <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => onOpenMnemonicKeyword(curTags[0])}>
                  📔 語呂合わせを登録
                </button>
              ) : null
            )}
            {/* 知識グラフ・フラッシュカード・用語集への相互リンク（Review.jsxと同じ既存の中継を再利用） */}
            {current && (
              <div className="btn-row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                {onOpenGraphConcept && conceptsOf(current, links)[0] && (
                  <button className="btn ghost sm" onClick={() => onOpenGraphConcept(conceptsOf(current, links)[0])}>🕸️ 知識グラフで見る</button>
                )}
                {onOpenFlashcardKeyword && curTags[0] && (
                  <button className="btn ghost sm" onClick={() => onOpenFlashcardKeyword(curTags[0])}>🃏 カードで見る</button>
                )}
                {onOpenGlossaryTerm && curTags[0] && (
                  <button className="btn ghost sm" onClick={() => onOpenGlossaryTerm(curTags[0])}>📖 用語集で見る</button>
                )}
                {curTags[0] && (
                  <button
                    className="btn ghost sm"
                    onClick={() => addLaterLookup({ keyword: curTags[0], subject: current.subject || null, questionId: current.id })
                      .then((list) => { setLaterLookup(list); onToast?.(`📌 「${curTags[0]}」をあとで調べるに追加しました`); })}
                  >
                    📌 あとで調べる
                  </button>
                )}
                <button className="btn ghost sm" onClick={() => setPfQuickOpen((v) => !v)}>🔤 読み間違いを報告</button>
                <button className="btn ghost sm" onClick={() => {
                  // 対策案30：同じ文のくり返しではなく、答えと解説の最初の1文だけを短く言い直す
                  cancelSpeech();
                  speak(applyPronunciation(st ? st.shortRetellText(current) : answerText(current)), { rate, voice: selectedVoice() }).catch(() => {});
                }}>🔁 短く言い直す</button>
              </div>
            )}
            {current && pfQuickOpen && (
              <div className="chip-row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                <span className="inline-note" style={{ width: '100%' }}>誤って読まれた言葉をタップ（無ければ下に入力）：</span>
                {Array.from(new Set([...curTags, ...(st ? st.kanjiWords(`${current.question || ''}${current.explanation || ''}`, 14) : [])])).slice(0, 16).map((w) => (
                  <button key={w} className={`chip ${pfTerm === w ? 'active' : ''}`} onClick={() => {
                    setPfTerm(w);
                    const known = readingDict.find(([t]) => t === w);
                    setPfReading(settings.pronunciationFixes?.[w] || (known ? known[1] : ''));
                  }}>{w}</button>
                ))}
              </div>
            )}
            {current && pfQuickOpen && (
              <div className="kw-add" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                <input type="text" value={pfTerm} onChange={(e) => setPfTerm(e.target.value)} placeholder="誤って読まれた言葉" />
                {isVoiceCommandSupported() && (
                  <button className="btn ghost sm" aria-label="誤って読まれた言葉を声で入力" onClick={() => dictateInto(setPfTerm, '誤って読まれた言葉')}>🎙️</button>
                )}
                <input type="text" value={pfReading} onChange={(e) => setPfReading(e.target.value)} placeholder="正しい読み方（ひらがな）" />
                {isVoiceCommandSupported() && (
                  <button className="btn ghost sm" aria-label="正しい読み方を声で入力" onClick={() => dictateInto(setPfReading, '正しい読み方')}>🎙️</button>
                )}
                <button className="btn sm primary" onClick={() => { addPronunciationFix(); setPfQuickOpen(false); }}>登録</button>
              </div>
            )}
            {current && tagOpen && (
              <div className="kw-add" style={{ marginTop: 8 }}>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTag()}
                  placeholder="この問題に付けるキーワード"
                />
                <button className="btn sm primary" onClick={addTag}>追加</button>
              </div>
            )}
          </div>

          {/* 今のセッションの弱点分析（△・✕ をつけた問題から、ジャンル・キーワードの傾向を出す） */}
          {weaknessSummary && (
            <div className="card">
              <div className="section-label" style={{ marginTop: 0 }}>🧭 今のセッションの弱点分析</div>
              {weaknessSummary.topGenres.length > 0 && (
                <p style={{ margin: '4px 0' }}>ジャンル：{weaknessSummary.topGenres.map(([g, c]) => `${g}（${c}）`).join('、')}</p>
              )}
              {weaknessSummary.topTags.length > 0 && (
                <p style={{ margin: '4px 0' }}>キーワード：{weaknessSummary.topTags.map(([tg, c]) => `${tg}（${c}）`).join('、')}</p>
              )}
              <button
                className="btn ghost sm"
                onClick={() => {
                  cancelSpeech();
                  speak(weaknessSummaryToText(weaknessSummary), { rate, pitch: settings.speechPitch || 1, voice: selectedVoice() }).catch(() => {});
                }}
              >
                🔊 弱点分析を読み上げる
              </button>
              <p className="inline-note" style={{ marginTop: 6 }}>
                このボタンは今すぐ好きなタイミングで読み上げます。一周を最後まで聞き終えた時は、これとは別に自動で簡単な終了の知らせ（「一周終了です、お疲れ様でした」等）が流れます。
              </p>
              {/* #21：まちがえた問題"名"だけの軽量な弱点リスト（ジャンル・タグの集計とは別に、
                  個々の問題を聞き返せるようにする）。 */}
              {sessionWrong.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary className="btn ghost sm" style={{ display: 'inline-block' }}>📋 まちがえた問題の名前一覧（{sessionWrong.length}問）</summary>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
                    {sessionWrong.map((q) => (
                      <li key={q.id} style={{ padding: '2px 0' }}>・{effectiveTags(q, links)[0] || shortStem(q)}</li>
                    ))}
                  </ul>
                  <button
                    className="btn ghost sm"
                    style={{ marginTop: 6 }}
                    onClick={() => {
                      cancelSpeech();
                      const names = sessionWrong.map((q) => effectiveTags(q, links)[0] || shortStem(q)).filter(Boolean);
                      speak(`まちがえた問題は、${names.join('、')}でした。`, { rate, pitch: settings.speechPitch || 1, voice: selectedVoice() }).catch(() => {});
                    }}
                  >
                    🔊 読み上げる
                  </button>
                </details>
              )}
              {weaknessSummary.relatedComparisons.length > 0 && (
                <>
                  <div className="section-label">関連する対比（混同しやすいポイント）</div>
                  {weaknessSummary.relatedComparisons.map((c) => (
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
          )}
        </>
      )}

      {(source === 'review' || (source === 'filter' && newOnly)) && (() => {
        const isNewOnlyMode = source === 'filter' && newOnly;
        let n;
        if (isNewOnlyMode) {
          n = filteredPool.length;
        } else {
          let reviewBase = customReviewIds ? orderedByCustomIds(customReviewIds) : reviewPool;
          if (filterSubject) reviewBase = reviewBase.filter((q) => q.subject === filterSubject);
          if (filterGenre) reviewBase = reviewBase.filter((q) => q.genre === filterGenre);
          if (filterRound) reviewBase = reviewBase.filter((q) => isSameRound(q.round, filterRound));
          reviewBase = applyNagameAndSnooze(reviewBase);
          n = reviewBase.length;
        }
        const playCount = reviewTarget ? Math.min(n, reviewTarget) : n;
        const narrowedBy = [
          filterSubject && `科目「${filterSubject}」`,
          filterGenre && `ジャンル「${filterGenre}」`,
          filterRound && `回「${formatRound(filterRound)}」`,
        ].filter(Boolean).join('・');
        const rates = completionRateByTarget(audioLog);
        const rateInfo = rates[reviewTarget == null ? 'all' : String(reviewTarget)];
        const lowCompletion = rateInfo && rateInfo.starts >= 3 && rateInfo.rate != null && rateInfo.rate < 0.5;
        return (
          <div className="card" style={{ borderColor: 'var(--accent)', background: 'var(--surface-2)' }}>
            {n > 0
              ? isNewOnlyMode
                ? `🆕 まだ解いていない問題を読み上げ中（対象${n}問${reviewTarget ? `・今回は${playCount}問だけ` : ''}）。`
                : `🔁 「間違えた問題」を読み上げ中（対象${n}問${reviewTarget ? `・今回は${playCount}問だけ` : ''}${customReviewIds ? '・復習画面の絞り込み条件を反映' : ''}${narrowedBy ? `・${narrowedBy}に絞り込み中` : ''}）。上のキーワードを選ぶと通常の読み上げに戻ります（科目・ジャンル・回は選んだまま「誤った問題」を続けられます）。`
              : isNewOnlyMode
              ? 'まだ解いていない問題が0問でした。科目・ジャンル・キーワード・回の絞り込みをゆるめてください。'
              : `🔁 「間違えた問題」を読もうとしましたが、${narrowedBy ? `${narrowedBy}では` : ''}この条件では0問でした。${narrowedBy ? '絞り込みを外すか、' : ''}上のキーワードを選ぶと通常の読み上げに戻ります。`}
            {n > 0 && (
              <>
                {/* 改善案i2：在庫件数を選ぶ前から目立たせる */}
                <p style={{ margin: '8px 0 0', fontWeight: 700 }}>在庫：{n}問</p>
                {!isNewOnlyMode && (
                  <div style={{ marginTop: 6 }}>
                    <label className="autokw-row">
                      <input type="checkbox" checked={nagameOnly} onChange={toggleNagameOnly} />
                      <span>🔎 念のため確認だけ（マスター済みだが保持率が下がった問題のみ）</span>
                    </label>
                    <label className="autokw-row">
                      <input type="checkbox" checked={excludeNagame} onChange={toggleExcludeNagame} />
                      <span>念のため確認を除外（本当に期限が来ている問題だけ）</span>
                    </label>
                    <label className="autokw-row">
                      <input type="checkbox" checked={snoozedOnly} onChange={toggleSnoozedOnly} />
                      <span>😴 先送り（スヌーズ）中の問題だけ</span>
                    </label>
                    <label className="autokw-row">
                      <input type="checkbox" checked={excludeSnoozed} onChange={toggleExcludeSnoozed} />
                      <span>先送り（スヌーズ）中の問題を除外</span>
                    </label>
                  </div>
                )}
                <label className="section-label" style={{ marginTop: 6 }}>今回はどれだけ読みますか？（所要時間は目安）</label>
                <div className="sess-targets">
                  {SESSION_TARGETS.map((t) => {
                    const estSec = estimateAudioSeconds(Math.min(t, n), { rate, gapSeconds: gap, nextGapSeconds: nextGap });
                    return (
                      <button
                        key={t}
                        className={`sess-target ${reviewTarget === t ? 'active' : ''}`}
                        onClick={() => changeReviewTarget(t)}
                      >
                        <span className="sess-target-n">{t}</span>
                        <span className="sess-target-l">{sessionTargetLabel(t)}</span>
                        <span className="sess-target-est">{formatEstimateMinutes(estSec)}{t > n ? `・在庫${n}問` : ''}</span>
                      </button>
                    );
                  })}
                  <button
                    className={`sess-target ${!reviewTarget ? 'active' : ''}`}
                    onClick={() => changeReviewTarget(null)}
                  >
                    <span className="sess-target-n">すべて</span>
                    <span className="sess-target-l">{n}問</span>
                    <span className="sess-target-est">{formatEstimateMinutes(estimateAudioSeconds(n, { rate, gapSeconds: gap, nextGapSeconds: nextGap }))}</span>
                  </button>
                </div>
                {/* 新規#4：時間から件数を逆算して選ぶ（今の再生速度・間の設定から見積もる） */}
                <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
                  <label>時間から選ぶ（今の速度・間から件数を逆算）</label>
                  <div className="chip-row" style={{ marginBottom: 0 }}>
                    {[5, 10, 15, 20, 30].map((min) => (
                      <button
                        key={min}
                        className="chip"
                        onClick={() => {
                          const perItem = 12 / Math.max(0.1, rate) + gap + nextGap;
                          const count = Math.max(1, Math.min(n, Math.round((min * 60) / perItem)));
                          changeReviewTarget(count);
                        }}
                      >
                        {min}分
                      </button>
                    ))}
                  </div>
                </div>
                {reviewTarget && reviewTarget > n && (
                  <p className="inline-note" style={{ marginTop: 6 }}>
                    対象は{n}問しかないため、{reviewTarget}問には届かずそこで終わります（繰り返しはしません）。
                  </p>
                )}
                {lowCompletion && (
                  <p className="inline-note" style={{ marginTop: 6 }}>
                    💡 {reviewTarget ?? 'すべて'}はこれまで{rateInfo.starts}回中{rateInfo.finishes}回しか最後まで聞き終えていません。無理せずもう少し少ない件数にしてみては？
                  </p>
                )}
                {/* 完了率の科目別軸（件数の軸しかなかったものを科目でも見られるように） */}
                {(() => {
                  const subjRates = completionRateBySubject(audioLog);
                  const key = filterSubject || '全科目';
                  const r = subjRates[key];
                  if (!r || r.starts < 3 || r.rate == null || r.rate >= 0.5) return null;
                  return (
                    <p className="inline-note" style={{ marginTop: 6 }}>
                      💡 「{key}」はこれまで{r.starts}回中{r.finishes}回しか最後まで聞き終えていません。
                    </p>
                  );
                })()}
                {/* 新規#3：この束をプレイリストに積む（終わったら自動で次の束へ進む） */}
                <button
                  className="btn ghost sm"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    setPlaylistQueue((q) => [...q, { target: reviewTarget, subject: filterSubject || null, genre: filterGenre || null, round: filterRound || null }]);
                    onToast?.('🎵 プレイリストに積みました（今の束が終わると自動で次へ進みます）');
                  }}
                >
                  🎵 この束をプレイリストに積む
                </button>
                {' '}
                <button
                  className="btn ghost sm"
                  style={{ marginTop: 8 }}
                  onClick={() => downloadFile(logToCsv(audioLog), 'shinkyu_audio_review_log.csv', 'text/csv')}
                >
                  📄 実施ログを書き出す（CSV）
                </button>
                {playlistQueue.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <p className="inline-note" style={{ margin: 0 }}>🎵 プレイリスト（{playlistQueue.length}件、今の束の後に続きます）：</p>
                    <div className="chip-row" style={{ marginTop: 4 }}>
                      {playlistQueue.map((it, i) => (
                        <button
                          key={i}
                          className="chip"
                          onClick={() => setPlaylistQueue((q) => q.filter((_, j) => j !== i))}
                          title="タップで取り消し"
                        >
                          {it.subject || '全科目'}{it.genre ? `・${it.genre}` : ''}{it.round ? `・${formatRound(it.round)}` : ''}×{it.target ?? 'すべて'} ✕
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {snap.finished && total > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <button className="btn accent block" onClick={repeatWithNextBatch}>🔁 もう一度（同じ件数で別の問題を）</button>
                    {onOpenFlashcardKeyword && (
                      <button
                        className="btn ghost block"
                        style={{ marginTop: 6 }}
                        onClick={() => {
                          const tagCounts = new Map();
                          builtPlan.forEach(({ display: it }) => {
                            if (it?.q) effectiveTags(it.q, links).forEach((kw) => tagCounts.set(kw, (tagCounts.get(kw) || 0) + 1));
                          });
                          const top = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0];
                          if (top) onOpenFlashcardKeyword(top[0]);
                          else onNavigate && onNavigate('flashcards');
                        }}
                      >
                        🃏 今回の内容をFlashcardsで確認する
                      </button>
                    )}
                    {sessionWrong.filter((q) => !latestMissType(missTypes[q.id])).length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div className="section-label" style={{ marginTop: 0 }}>
                          この誤答、理由は？（未分類の{sessionWrong.filter((q) => !latestMissType(missTypes[q.id])).length}問）
                        </div>
                        {sessionWrong.filter((q) => !latestMissType(missTypes[q.id])).map((q) => (
                          <div key={q.id} style={{ marginBottom: 8 }}>
                            <span className="inline-note" style={{ marginRight: 6 }}>
                              {(q.question || '（図の問題）').slice(0, 20)}…
                            </span>
                            {/* 学習(10・60・300・900)のQuestionCard.jsxと同じ.misstype-row（横スクロール・
                                折り返さない）。以前は素のbtn-rowで、長いラベル（「ケアレス」等）が
                                混ざると折り返して崩れるリスクがあった。 */}
                            <div className="misstype-row" style={{ marginTop: 4 }}>
                              {MISS_TYPES.map((t) => (
                                <button key={t.id} className="chip" onClick={() => onMissType(q.id, t.id)}>
                                  {t.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* #23・#24：仕上げ期（ロードマップのkind:'goal'フェーズ）に入ったら、文字の過去問を
          増やす案内と倍速の総復習への切り替えを一度だけ声＋カードで案内する。 */}
      {(() => {
        const todayKey = dateKey();
        const isGoalPhase = phaseForDate(todayKey)?.kind === 'goal';
        if (!isGoalPhase || settings.goalPhaseAudioNoticeDate === todayKey) return null;
        return (
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="section-label" style={{ marginTop: 0 }}>🎯 仕上げ期に入りました</div>
            <p className="inline-note" style={{ marginTop: 0 }}>
              文字の過去問を解く練習を増やしましょう。本番は読んで解く形式なので、音だけで覚えた知識も文字で取り出せるようにしておく必要があります。
            </p>
            <div className="btn-row" style={{ flexWrap: 'wrap' }}>
              <button className="btn sm" onClick={() => onNavigate && onNavigate('exam')}>📝 模試（文字）を開く</button>
              <button
                className="btn sm"
                onClick={() => { setRate((r) => Math.max(r, 1.5)); onToast?.('⏩ 倍速（1.5倍以上）の総復習に切り替えました'); }}
              >
                ⏩ 倍速の総復習に切り替える
              </button>
              <button className="btn ghost sm" onClick={() => updateSettings({ goalPhaseAudioNoticeDate: todayKey })}>今日は非表示にする</button>
            </div>
          </div>
        );
      })()}

      {/* 新規#6：時間帯別パフォーマンス分析（Analytics.jsx）と連携 */}
      {(() => {
        const best = isNowBestTime(history);
        if (!best) return null;
        return (
          <div className="card" style={{ marginBottom: 10 }}>
            🕐 今は集中しやすい時間帯です（{best.label}の正答率が高い傾向・{Math.round(best.accuracy * 100)}%）。
          </div>
        );
      })()}

      {/* ⚡ 目を使わない高速インプット・アウトプットの工夫（件数チップと組み合わせて使う） */}
      {(source === 'review' || (source === 'filter' && newOnly)) && (
        <div className="card">
          <div className="section-label" style={{ marginTop: 0 }}>⚡ 目を使わない高速インプット・アウトプットの工夫</div>
          <Opt
            on={skipQuestionText}
            onToggle={() => { fastSkipAutoRef.current = false; setSkipQuestionText((v) => !v); }}
            title="問題文を省略し、正解と一言だけ素早く読む"
            desc="わかっているのに間違えた（ケアレスミス）問題向け。問題文の読み直しを省き、正解と解説の最初の一文だけ読みます。"
          />
          <Opt
            on={progressAnnounceOn}
            onToggle={() => setProgressAnnounceOn((v) => !v)}
            title="10問ごとに進み具合を声で知らせる"
            desc="画面を見ていなくても「ここまで◯問、残り◯問」が分かります。"
          />
          <Opt
            on={autoRequeueWrongOn}
            onToggle={() => setAutoRequeueWrongOn((v) => !v)}
            title="△・✕にした問題を、最後に自動でもう一度だけ"
            desc="今回のセッションで自己採点した△・✕の問題だけを、聞き終えた直後にもう一度だけ回します。"
          />
          <Opt
            on={beepOn}
            onToggle={() => setBeepOn((v) => !v)}
            title="🔔 考える時間（間）の前後に合図音を鳴らす"
            desc="「考え始め」「答えが来る」の境目を音で知らせます。"
          />
          <Opt
            on={vibrateTickOn}
            onToggle={() => setVibrateTickOn((v) => !v)}
            title="📳 次の問題に進むたびに軽く振動する"
            desc="振動はAndroid系のブラウザのみ対応（iPhone・パソコンは対象外。ブラウザ側の制約でこの設定では直せません）。"
          />
          <Opt
            on={wideTapOn}
            onToggle={() => setWideTapOn((v) => !v)}
            title="👆 画面を大きくタップして自己採点"
            desc="タップ＝○ できた／長押し（0.6秒）＝✕ できない。下の○△✕ボタンの代わりに使えます。"
          />
          <Opt
            on={headphoneOnly}
            onToggle={() => setHeadphoneOnly((v) => !v)}
            title="🎧 イヤホン接続を確認できた時だけ自動再生する"
            desc="誤って周囲にスピーカーで流してしまうのを防ぎます。この端末では正確に分からないことがあります（分からない時は下のチェックで確認してください）。"
          />
          {headphoneOnly && headphoneHint !== true && (
            <label className="autokw-row" style={{ marginTop: 6 }}>
              <input
                type="checkbox"
                checked={settings.audioHeadphoneConfirmedDate === dateKey()}
                onChange={(e) => updateSettings({ audioHeadphoneConfirmedDate: e.target.checked ? dateKey() : null })}
              />
              <span>✓ イヤホンを付けています（今日のうちは覚えておきます）</span>
            </label>
          )}
          <Opt
            on={notifyOn}
            onToggle={toggleNotify}
            title="📣 タブを離れていても、束が終わったら通知で知らせる"
            desc="この端末がこのタブを閉じずバックグラウンドにある間だけ通知します。アプリを閉じている時や画面OFF時は届きません（ブラウザの仕様）。既定オフで、ONにする時だけ通知の許可を求めます。"
          />
          <label className="autokw-row" style={{ marginTop: 6 }}>
            <input
              type="checkbox"
              checked={settings.audioWakeLockOff === true}
              onChange={(e) => updateSettings({ audioWakeLockOff: e.target.checked })}
            />
            <span>🔋 画面点灯の維持（Wake Lock）をオフにする（バッテリーを節約。再生中に画面が暗くなることがあります）</span>
          </label>
          <Opt
            on={voiceControlOn}
            onToggle={() => setVoiceControlOn((v) => !v)}
            title="🎙️ 声で自己採点・操作する（○/△/✕・次へ/前へ/止めて/全部できた/◯問目へ/詳細設定を開いて）"
            desc="正解・解説を読み終えたタイミングで一度だけ聞き取ります。「全部できた」で残りをまとめて○に、「53問目へ」で直接その番号へ、「詳細設定を開いて」で詳細設定を開けます。この端末のブラウザの音声認識機能を使うため、認識のために音声データが音声認識サーバーへ送られる場合があります（端末内保存方針の明示的な例外）。スピーカー再生中はマイクに読み上げ自体が混ざり誤認識することがあるため、イヤホン使用がおすすめです。"
            disabled={!isVoiceCommandSupported()}
          />
          {!isVoiceCommandSupported() && (
            <p className="inline-note">この端末・ブラウザは音声認識（SpeechRecognition）に対応していません。</p>
          )}
          {/* 盲目の受験生からの改善提案#4：聞き取り開始時は専用の合図音（高い二連音）が
              beepOnの設定に関わらず鳴るようになったため、案内文を更新した。 */}
          {voiceControlOn && (
            <p className="inline-note">💡 聞き取りが始まる直前に高い二連の合図音が鳴ります（この合図は上の「合図音」設定とは別で、常に鳴ります）。</p>
          )}
          {/* 新規#7：声コマンドの言い回しを自分で登録する辞書 */}
          {voiceControlOn && (
            <div style={{ marginTop: 8 }}>
              <div className="section-label" style={{ marginTop: 0 }}>🗣️ 自分の言い回しを登録する</div>
              {voiceCommandWords.length > 0 && (
                <ul className="pf-list" style={{ listStyle: 'none', padding: 0, margin: '0 0 8px' }}>
                  {voiceCommandWords.map((w, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                      <span>「{w.word}」→ {w.type === 'grade' ? { maru: '○', sankaku: '△', batsu: '✕' }[w.kind] : { next: '次へ', prev: '前へ', stop: '止めて', allDone: '全部できた', openSettings: '詳細設定を開く' }[w.kind]}</span>
                      <button
                        className="btn ghost sm"
                        onClick={() => updateSettings({ voiceCommandWords: voiceCommandWords.filter((_, j) => j !== i) })}
                      >
                        削除
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="kw-add" style={{ flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={vcWord}
                  onChange={(e) => setVcWord(e.target.value)}
                  placeholder="聞き取る言葉（例：分かった）"
                />
                <select value={vcKind} onChange={(e) => setVcKind(e.target.value)}>
                  <option value="maru">○ できた</option>
                  <option value="sankaku">△ あいまい</option>
                  <option value="batsu">✕ できない</option>
                  <option value="next">▶ 次へ</option>
                  <option value="prev">◀ 前へ</option>
                  <option value="stop">■ 止めて</option>
                  <option value="allDone">全部できた</option>
                  <option value="openSettings">詳細設定を開く</option>
                </select>
                <button
                  className="btn sm primary"
                  onClick={() => {
                    const word = vcWord.trim();
                    if (!word) return;
                    const type = ['maru', 'sankaku', 'batsu'].includes(vcKind) ? 'grade' : 'nav';
                    updateSettings({ voiceCommandWords: [...voiceCommandWords, { word, type, kind: vcKind }] });
                    setVcWord('');
                  }}
                >
                  追加
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* A3：3分の2バッファ術（学習10・60・300・900と同じ共有コンポーネント）。音声でも
          時間から計画し、基礎タスク分だけ先に聞けるようにする。 */}
      {!audioBufferPlan && !audioBufferUsage && !(source === 'review' || (source === 'filter' && newOnly) || source === 'keyword' || source === 'daily' || source === 'weak') && (
        <BufferPlanCard
          subject={filterSubject || undefined}
          history={history}
          settings={settings}
          updateSettings={updateSettings}
          mood={mood}
          onStart={startAudioBufferPlan}
          startDisabled={(source === 'filter' ? filteredPool.length : questions.length) === 0}
          onToast={onToast}
        />
      )}

      {/* ○の見直し・○の高速回転（学習10・60・300・900と同じ共有コンポーネント。検索の絞り込みを引き継ぐ） */}
      {!audioBufferPlan && !audioBufferUsage && !(source === 'review' || (source === 'filter' && newOnly) || source === 'keyword' || source === 'daily' || source === 'weak') && (
        <MaruReviewCard
          maruStatusAll={maruStatusAll}
          maruUncertainCount={maruUncertainCount}
          maruExcludeMastered={maruExcludeMastered}
          setMaruExcludeMastered={setMaruExcludeMastered}
          maruStatusFiltered={maruStatusFiltered}
          maruPool={maruPool}
          onStartReview={(pool) => startMaruAudio(pool, false)}
          onStartFast={(pool) => startMaruAudio(pool, true)}
          onGoAnalytics={onNavigate ? () => onNavigate('analytics') : undefined}
        />
      )}

      {/* 🎯 このセッションの設定（件数・再生スタイル）。「間違えた問題」「まだ解いていない問題だけ」
          には専用の件数チップが別にあるため、ここは連結学習モード（1〜10）・通常の全件読み上げ・
          タグ読み上げ・検索結果の読み上げ向け（二重のUIにならないよう排他にする）。 */}
      {!(source === 'review' || (source === 'filter' && newOnly) || source === 'keyword' || source === 'daily' || source === 'weak') && (() => {
        const n = mode > 0
          ? (filterActive ? filteredPool : questions).length
          : source === 'filter' ? filteredPool.length
          : source === 'tagged' ? taggedQuestions.length
          : questions.length;
        return (
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>🎯 このセッションの設定</div>
            <p className="inline-note" style={{ marginTop: 0 }}>
              今読み上げている内容（連結学習モード・全件・検索結果など）向けの件数設定です。
              「間違えた問題」「まだ解いていない問題だけ」を選ぶと、この代わりに専用の件数カードに切り替わります。
            </p>
            {n > 0 ? (
              <>
                <p style={{ margin: '0 0 8px', fontWeight: 700 }}>対象の目安：{n}問</p>
                <label className="section-label" style={{ marginTop: 0 }}>今回はどれだけ読みますか？</label>
                <div className="sess-targets">
                  {SESSION_TARGETS.map((t) => {
                    const estSec = estimateAudioSeconds(Math.min(t, n), { rate, gapSeconds: gap, nextGapSeconds: nextGap });
                    return (
                      <button
                        key={t}
                        className={`sess-target ${reviewTarget === t ? 'active' : ''}`}
                        onClick={() => changeReviewTarget(t)}
                      >
                        <span className="sess-target-n">{t}</span>
                        <span className="sess-target-l">{sessionTargetLabel(t)}</span>
                        <span className="sess-target-est">{formatEstimateMinutes(estSec)}{t > n ? `・在庫${n}問` : ''}</span>
                      </button>
                    );
                  })}
                  <button
                    className={`sess-target ${!reviewTarget ? 'active' : ''}`}
                    onClick={() => changeReviewTarget(null)}
                  >
                    <span className="sess-target-n">すべて</span>
                    <span className="sess-target-l">{n}問</span>
                    <span className="sess-target-est">{formatEstimateMinutes(estimateAudioSeconds(n, { rate, gapSeconds: gap, nextGapSeconds: nextGap }))}</span>
                  </button>
                </div>
                {reviewTarget && reviewTarget > n && (
                  <p className="inline-note" style={{ marginTop: 6 }}>
                    対象は{n}問しかないため、{reviewTarget}問には届かずそこで終わります（繰り返しはしません）。
                  </p>
                )}
                {/* ユーザー指定：科目の音声を再生していく（インプット）時も、10問ごとに
                    「残り◯◯問」を声で知らせられるように。以前は「間違えた問題」
                    「まだ解いていない問題だけ」専用カードにしかトグルが無く、
                    ここ（連結学習モード・全件読み上げ等）からは操作できなかった。 */}
                <Opt
                  on={progressAnnounceOn}
                  onToggle={() => setProgressAnnounceOn((v) => !v)}
                  title="🔔 10問ごとに残り件数を声で知らせる"
                  desc="画面を見ていなくても「残り◯◯問です」で進み具合が分かります。"
                />
                {snap.finished && total > 0 && (
                  <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={repeatWithNextBatch}>
                    🔁 もう一度（同じ件数で別の問題を）
                  </button>
                )}
                {/* A5：周回速度ログ（音声版）。学習10・60・300・900と同じ考え方で前回と所要時間を比べる */}
                {snap.finished && audioLastRoundInfo && audioLastRoundInfo.target === toAudioRoundTarget(reviewTarget || total) && (
                  <p className="inline-note" style={{ marginTop: 8 }}>
                    🔁 音声での通算{audioLastRoundInfo.roundNo}回目（{audioLastRoundInfo.count}問）・⏱ 所要時間 {formatDuration(audioLastRoundInfo.ms)}
                    {audioLastRoundInfo.prev && (() => {
                      const pct = speedupPct(audioLastRoundInfo.ms, audioLastRoundInfo.count, audioLastRoundInfo.prev.ms, audioLastRoundInfo.prev.count);
                      if (pct == null) return null;
                      return pct > 0 ? `（前回より1問あたり${pct}%短縮）` : pct < 0 ? `（前回より1問あたり${Math.abs(pct)}%遅くなっています）` : '（前回とほぼ同じペース）';
                    })()}
                  </p>
                )}
                {/* A4：完了画面のジャンル別正答率（苦手順）。Quiz/Session/Review/Examと同じ単一の正を使う */}
                {snap.finished && audioGenreBreakdown && audioGenreBreakdown.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div className="section-label" style={{ marginTop: 0 }}>ジャンル別正答率（苦手順）</div>
                    {/* 盲目の受験生からの改善提案#6：色分けバー（赤黄緑）は声だけでは伝わらない
                        ため、同じ内訳を読み上げるボタンを添える。 */}
                    <button
                      className="btn ghost sm"
                      style={{ marginBottom: 6 }}
                      onClick={() => {
                        cancelSpeech();
                        const txt = audioGenreBreakdown
                          .map(([g, s]) => `${g}、${Math.round((s.correct / s.total) * 100)}パーセント、${s.total}問中${s.correct}問正解`)
                          .join('。 ');
                        speak(`ジャンル別正答率、苦手順です。${txt}。`, { rate, pitch: settings.speechPitch || 1, voice: selectedVoice() }).catch(() => {});
                      }}
                    >
                      🔊 ジャンル別正答率を読み上げる
                    </button>
                    {/* 学習(10・60・300・900)と同じ色付きバー（赤=低い・黄=中・緑=高い）で
                        苦手度を一目で見せる（以前は文字だけだった）。 */}
                    <ul className="genre-stats">
                      {(showAllAudioGenres ? audioGenreBreakdown : audioGenreBreakdown.slice(0, 6)).map(([g, s]) => {
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
                    {audioGenreBreakdown.length > 6 && (
                      <button className="btn ghost sm block" style={{ marginTop: 6 }} onClick={() => setShowAllAudioGenres((v) => !v)}>
                        {showAllAudioGenres ? '折りたたむ' : `もっと見る（残り${audioGenreBreakdown.length - 6}件）`}
                      </button>
                    )}
                  </div>
                )}
                {/* 今回の誤答・あいまい一覧（学習10・60・300・900の完了画面と同じく、実際の問題文を見せる） */}
                {snap.finished && sessionWrong.length > 0 && (() => {
                  const sankakuN = sessionWrong.filter((q) => sessionWrongKinds[q.id] === 'sankaku').length;
                  const batsuN = sessionWrong.length - sankakuN;
                  return (
                    <div style={{ marginTop: 8 }}>
                      <div className="section-label" style={{ marginTop: 0 }}>今回の誤答・あいまい（{sessionWrong.length}問）</div>
                      <p className="inline-note" style={{ marginTop: 0 }}>
                        自己採点で「△ あいまい」「✕ できない」を選んだ問題も含みます（△{sankakuN}問・✕{batsuN}問）。
                      </p>
                      <ul className="wrong-list">
                        {sessionWrong.map((q) => {
                          const k = sessionWrongKinds[q.id] === 'sankaku' ? 'sankaku' : 'batsu';
                          return (
                            <li key={q.id}>
                              <span className={`wl-mark ${k}`}>{k === 'sankaku' ? '△' : '✕'}</span>
                              <span className="wl-ans">{q.type === 'ox' ? `正解 ${q.answer === 0 ? '○' : '✕'}` : `正解 ${q.answer + 1}`}</span>
                              <span className="wl-q">{q.question}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })()}
                {/* A6：明日の最初の1タスクを決めておく（学習10・60・300・900と同じ仕組み） */}
                {snap.finished && (
                  <div style={{ marginTop: 10 }}>
                    <div className="section-label" style={{ marginTop: 0 }}>📌 明日の最初の1タスクを決めておく</div>
                    <p className="inline-note" style={{ marginTop: 0 }}>
                      次にアプリを開いた時、ホーム画面の一番上に表示されます。
                    </p>
                    <div className="chip-row" style={{ marginBottom: 8 }}>
                      {sessionWrong.length > 0 && (
                        <button className="chip" onClick={() => setAudioNextTaskInput(`音声で苦手を${Math.min(sessionWrong.length, 10)}問だけ聞き直す`)}>
                          音声で苦手を{Math.min(sessionWrong.length, 10)}問だけ聞き直す
                        </button>
                      )}
                      <button className="chip" onClick={() => setAudioNextTaskInput('音声学習で5分だけ聞く')}>音声学習で5分だけ聞く</button>
                    </div>
                    <div className="kw-add">
                      <input
                        type="text"
                        value={audioNextTaskInput}
                        onChange={(e) => setAudioNextTaskInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveAudioNextTaskDraft()}
                        placeholder="例：音声で苦手を5問だけ聞き直す"
                      />
                      <button className="btn sm primary" onClick={saveAudioNextTaskDraft}>保存</button>
                    </div>
                    {audioNextTaskSavedAt > 0 && <p className="hint" style={{ marginTop: 6 }}>保存しました。ホーム画面の一番上に出ます。</p>}
                  </div>
                )}
              </>
            ) : (
              <p className="inline-note">対象が0問です。検索条件をゆるめてください。</p>
            )}
            <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
              <label>再生スタイル</label>
              <div className="chip-row" style={{ marginBottom: 0 }}>
                <button className={`chip ${!outputModeOn ? 'active' : ''}`} onClick={() => setOutputModeOn(false)}>
                  📻 インプット（聞くだけ・自動で正解まで進む）
                </button>
                <button className={`chip ${outputModeOn ? 'active' : ''}`} onClick={() => setOutputModeOn(true)}>
                  ✋ アウトプット（止めて、自分で解答してから正解を見る）
                </button>
              </div>
              <p className="inline-note" style={{ marginTop: 6 }}>
                アウトプットを選ぶと、問題のあと自動では正解に進まず、「✅ 解答を見る」を押すまで止まって待ちます
                （解答選択の手が使えない時はインプットのままでも使えます）。
              </p>
            </div>
          </div>
        );
      })()}

      {/* 連結モード（1〜10）。検索でしぼった範囲に対して読み方を選ぶ。よく使う順に並びます。
          2026-11-08追加：10件すべてを常に全展開すると画面が長くなりすぎるため、既定では
          上位3件＋現在選んでいるモードだけを表示し、「もっと見る」で全展開する。 */}
      <div className="section-label">連結学習モード（読み方を選ぶ・よく使う順）</div>
      <div className="mode-list">
        <button className={`mode-card ${mode === 0 ? 'active' : ''}`} onClick={() => changeMode(0)}>
          <span className="mode-ico">🎧</span>
          <span className="mode-body">
            <span className="mode-title">通常（そのまま順に読む）</span>
            <span className="mode-desc">検索でしぼった問題を、問題→間→正解の順にそのまま読み上げます。</span>
          </span>
        </button>
        {(modesExpanded ? sortedModes : sortedModes.filter((m, i) => i < 3 || m.id === mode)).map((m) => (
          <button
            key={m.id}
            className={`mode-card ${mode === m.id ? 'active' : ''}`}
            onClick={() => changeMode(m.id)}
          >
            <span className="mode-ico">{m.icon}</span>
            <span className="mode-body">
              <span className="mode-title">{m.id}. {m.title}</span>
              <span className="mode-desc">{m.desc}</span>
              <span className="mode-when">✨ こんな時におすすめ：{m.when}</span>
            </span>
          </button>
        ))}
      </div>
      {sortedModes.length > 3 && (
        <button className="btn ghost sm block" style={{ marginBottom: 10 }} onClick={() => setModesExpanded((v) => !v)}>
          {modesExpanded ? '折りたたむ' : `もっと見る（他${sortedModes.length - 3}件の読み方）`}
        </button>
      )}

      {builtPlan.length > 0 && (
        <>
          {/* 読み上げる面（暗記カード：表＝問題／裏＝答え） */}
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>読み上げる面（表＝問題／裏＝答え）</div>
            <div className="chip-row">
              {[
                { v: 'both', l: '表面・裏面' },
                { v: 'front', l: '表面のみ（問題）' },
                { v: 'back', l: '裏面のみ（答え）' },
              ].map((o) => (
                <button key={o.v} className={`chip ${readSide === o.v ? 'active' : ''}`} onClick={() => setReadSide(o.v)}>
                  {o.l}
                </button>
              ))}
            </div>
            <div className="hint" style={{ marginTop: 6 }}>
              「表面のみ」で問題だけを聞いて思い出す練習、「裏面のみ」で答えの総ざらいができます。
            </div>
            <Opt
              on={readChoices}
              onToggle={() => setReadChoices((v) => !v)}
              title="表（問題）で選択肢も読む（四択）"
              desc="四択の1〜4の選択肢も表面で読み上げます。本番と同じ形で耳から確認できます。"
            />
            {(readChoices || mode === 6) && (
              <Opt
                on={shuffleChoicesOn}
                onToggle={() => setShuffleChoicesOn((v) => !v)}
                title="選択肢の順番をシャッフルして読む"
                desc="「いつも3番が正解」のように位置で覚えてしまうのを防ぎます。読み上げる時だけ順番を入れ替え、正解の番号も読み替えます。"
              />
            )}
            {(readChoices || mode === 6) && (
              <Opt
                on={firstLetterOnly}
                onToggle={() => setFirstLetterOnly((v) => !v)}
                title="🔤 選択肢は頭文字だけ読む（頭文字法）"
                desc="各選択肢の最初の1文字だけを読みます。頭文字をつなげて覚える練習向け。"
              />
            )}
            <Opt
              on={recallMode}
              onToggle={() => setRecallMode((v) => !v)}
              title="🧠 記憶定着モード（想起→答え→反復）"
              desc="問題のあと「答えは？」と促して“思い出す間”を長めにとり、正解の核心をもう一度読みます。手が使えなくても記憶に残りやすくなります。"
            />
            <Opt
              on={pureRecallOn}
              onToggle={() => setPureRecallOn((v) => !v)}
              title="🙊 完全想起モード（選択肢を読まない）"
              desc="記憶定着モードを兼ね、選択肢は一切読まず問題文だけ→無音→声に出す→正解、という本番に近い想起練習にします（間もさらに長めになります）。"
            />
            <Opt
              on={adaptiveGapOn}
              onToggle={() => setAdaptiveGapOn((v) => !v)}
              title="⏳ 無音の長さを自分のペースに合わせる"
              desc="固定の秒数ではなく、これまでの解答テンポ（科目ごとの目安）から1問ごとに間の長さを計算し直します。"
            />
            <Opt
              on={voiceAnswerOn}
              onToggle={() => setVoiceAnswerOn((v) => !v)}
              title="🎙️ 声で解答モード（新規性が高い機能）"
              desc="声で実際の答えを言い、音声認識の結果が正解語と一致した時だけ自動で○にします。聞き取れない・一致しない時は自動✕にはせず、黙ってそのまま正解を読みます（誤判定による不公平な自動✕を避ける安全設計）。"
            />
            {/* 盲目の受験生からの改善提案#3（2026-11-14）：スワイプ操作自体は「間違えた問題」
                限定ではなくどのモードのプレーヤーにも常に効くため、オフにする設定も同じく
                常に見える位置（読み上げる面カード）に置く（以前は「間違えた問題」専用カードの
                中にあり、他モードでは辿り着けなかった。実機QAで発見・修正）。 */}
            <Opt
              on={swipeNavOn}
              onToggle={() => setSwipeNavOn((v) => !v)}
              title="👉 左右スワイプで前へ／次へ"
              desc="スクリーンリーダー（VoiceOver・TalkBack等）自身のスワイプ操作とぶつかる場合はオフにしてください（自動では判別できません）。"
            />
            <Opt
              on={timeBreakOn}
              onToggle={() => setTimeBreakOn((v) => !v)}
              title="⏱ 5分ごとに休憩を提案する"
              desc="ファイルを長時間にしすぎないための時間基準の区切り（既存の60問区切りとは別）。"
            />
            <Opt
              on={earRestOn}
              onToggle={() => setEarRestOn((v) => !v)}
              title="👂 30分再生したら耳を休める提案をする"
              desc="再生し続けた時間（一時停止中は数えません）が30分を超えたら、休憩と音量を少し下げる提案をします。"
            />
          </div>

          {/* 2026-11-08追加：連結学習の工夫・再生モード（繰り返し/シャッフル/スリープ/今日の目標）・
              ボイスクローン・声を選ぶ・再生速度や間の調整・読み方の補正は、ふだんは一度決めたら
              あまり触らない細かい調整なので「詳細設定」として既定で折りたたむ
              （よく使う設定＝検索・件数・連結学習モード選びとは別に分ける）。 */}
          <button className="btn ghost sm block" style={{ margin: '10px 0' }} onClick={() => setDetailSettingsOpen((v) => !v)}>
            {detailSettingsOpen ? '🔧 詳細設定を閉じる' : '🔧 詳細設定を開く（連結学習の工夫・再生モード・声・再生速度・読み方の補正）'}
          </button>
          {detailSettingsOpen && (
            <>
          {/* 連結学習の工夫（初心者向け説明つき） */}
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>連結学習の工夫（読み上げ方）</div>
            <Opt
              on={readSubject}
              onToggle={() => setReadSubject((v) => !v)}
              title="科目もいっしょに読む（横断ミックス）"
              desc="同じ言葉を、解剖・生理などいろいろな科目の問題で聞けます。多方面から覚えられます。"
            />
            <Opt
              on={chain}
              onToggle={toggleChain}
              title="関連する言葉へ自動で続ける（芋づる式）"
              desc="1つの言葉が終わると、つながりの強い言葉へ自動で進みます。（キーワードで回す／今日の連結のとき）"
            />
            <Opt
              on={storyPauseOn}
              onToggle={() => setStoryPauseOn((v) => !v)}
              title="📖 場面が変わる所の間を長めに取る（ストーリー法）"
              desc="キーワード（場面）が切り替わる直前の間を長くして、話の場面転換として聞き取りやすくします。"
            />
            <Opt
              on={readingTemplateOn}
              onToggle={() => setReadingTemplateOn((v) => !v)}
              title="📐 科目の決まった順番を声で確認する"
              desc="科目を選んだ時に一度だけ、その科目の決まった読み上げ順（例：解剖学＝起始→停止→支配神経→作用）を案内します。問題ごとに自動で並べ替えるものではありません。"
            />
            <Opt
              on={readHint}
              onToggle={() => setReadHint((v) => !v)}
              title="答えの前にヒントを読む"
              desc="思い出すきっかけ（キーワード）を先に読み上げます。思い出す力が鍛えられます。"
            />
            <Opt
              on={keywordEmphasisOn}
              onToggle={() => setKeywordEmphasisOn((v) => !v)}
              title="🔊 キーワードを声でも強調する"
              desc="画面の反転表示（二重符号化）は声には乗りません。キーワードの前後に一拍おいて、声だけでも「ここが大事な語」と伝わるようにします。"
            />
            <Opt
              on={newSlowdownOn}
              onToggle={() => setNewSlowdownOn((v) => !v)}
              title="🐢 まだ解いていない新しい問題は等速で読む"
              desc="再生速度を上げていても、一度も解いたことが無い問題は、問題文も解答・解説も等速以下に戻します（倍速の上げすぎ対策）。"
            />
            <Opt
              on={whyOnAnswerOn}
              onToggle={() => setWhyOnAnswerOn((v) => !v)}
              title="🤔 答えの後に「なぜ」を一言添える"
              desc="正解・誤答に関わらず、答えのあとに「自分の言葉でもう一度言ってみましょう」を添えます。"
            />
            <Opt
              on={ifThenOn}
              onToggle={() => setIfThenOn((v) => !v)}
              title="🔀 「もし〜なら」を読む"
              desc="橈骨神経・正中神経など、代表的な神経が障害された時の所見（正常の逆）を答えのあとに読みます。"
            />
            <Opt
              on={prependReviewOn}
              onToggle={() => setPrependReviewOn((v) => !v)}
              title="🔁 新しい問題の前に復習を1問"
              desc="科目を選んで読み上げる時、始める前に復習対象を1問だけ挟みます（新しい範囲ばかりに偏らせない対策）。"
            />
            <Opt
              on={walkingDetectOn}
              onToggle={async () => {
                if (walkingDetectOn) { setWalkingDetectOn(false); return; }
                if (typeof window === 'undefined' || typeof window.DeviceMotionEvent === 'undefined') {
                  onToast?.('この端末・ブラウザはモーションの検知に対応していません');
                  return;
                }
                // iPhone はタップした瞬間（ユーザー操作の中）に許可を求めないと、許可の画面が出ないまま断られる
                if (typeof window.DeviceMotionEvent.requestPermission === 'function') {
                  try {
                    const perm = await window.DeviceMotionEvent.requestPermission();
                    if (perm !== 'granted') { onToast?.('モーションの許可が得られませんでした'); return; }
                  } catch (e) { onToast?.('モーションの許可が得られませんでした'); return; }
                }
                setWalkingDetectOn(true);
              }}
              title="🚶 歩行中は速度を少し落とす（モーション検知）"
              desc="体の動きの大きさから簡易的に判定するだけで、歩行そのものを正確に検知する技術ではありません。対応していない機種・ブラウザもあります。iPhoneでは最初にモーションの許可を求めます。"
            />
            <Opt
              on={reverse}
              onToggle={() => setReverse((v) => !v)}
              title="逆向きにも確認する"
              desc="答えから問題を思い出す練習を追加します。両方向で覚えられます。"
            />
            <Opt
              on={summary}
              onToggle={toggleSummary}
              title="最後にまとめを読む"
              desc="その言葉に関する要点を、最後にまとめて読み上げます。（キーワードで回すとき）"
            />
            <Opt
              on={flashcard}
              onToggle={toggleFlashcard}
              title="用語カードモード"
              desc="問題ではなく『言葉 → 意味・要点』だけを短く読みます。すき間時間の暗記に。（キーワードで回すとき）"
            />
          </div>

          {/* 再生モード */}
          <div className="card">
            <div className="mode-toggles">
              <button className={`mode-toggle ${loop ? 'on' : ''}`} onClick={() => setLoop((v) => !v)}>
                🔁 繰り返し {loop ? 'オン' : 'オフ'}
              </button>
              <button className={`mode-toggle ${shuffleOn ? 'on' : ''}`} onClick={toggleShuffle}>
                🔀 シャッフル {shuffleOn ? 'オン' : 'オフ'}
              </button>
            </div>
            <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
              <label>スリープタイマー（自動停止）</label>
              <div className="chip-row" style={{ marginBottom: 0 }}>
                {sleepOptions.map((m) => (
                  <button
                    key={m}
                    className={`chip ${sleepMin === m ? 'active' : ''}`}
                    onClick={() => {
                      setSleepMin(m);
                      engine.setSleep(m);
                    }}
                  >
                    {m === 0 ? 'オフ' : `${m}分`}
                  </button>
                ))}
              </div>
              <div className="hint">寝る前の“ながら再生”に。<strong>経過した「時間」</strong>で自動的に止めます（何問聞いたかは問いません）。</div>
            </div>
            <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
              <label>今日の目標（問題数）</label>
              <div className="chip-row" style={{ marginBottom: 0 }}>
                {goalOptions.map((g) => (
                  <button
                    key={g}
                    className={`chip ${goal === g ? 'active' : ''}`}
                    onClick={() => { setGoal(g); goalNotifiedRef.current = false; }}
                  >
                    {g === 0 ? 'オフ' : `${g}問`}
                  </button>
                ))}
              </div>
              <div className="hint">スリープタイマーとは別の仕組みです。自動では止まらず、<strong>解いた「問題数」</strong>が目標に達した時だけ声で知らせます。</div>
            </div>
          </div>

          {/* ボイスクローン（自分の声・任意／BYOK） */}
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>🎤 自分の声（ボイスクローン・任意）</div>
            {voiceClone.voiceId ? (
              <>
                <p className="inline-note">
                  登録済み：<strong>{voiceClone.voiceName || 'マイボイス'}</strong>
                  {!voiceCloneApiKey && '（APIキー未設定のため使用できません）'}
                </p>
                <label className="switch-row">
                  <input
                    type="checkbox"
                    checked={!!voiceClone.enabled}
                    onChange={(e) => updateSettings({ voiceClone: { ...voiceClone, enabled: e.target.checked } })}
                  />
                  <span>この声で読み上げる（オフ＝下の「声を選ぶ」を使用）</span>
                </label>
                {cloneActive && typeof navigator !== 'undefined' && navigator.connection &&
                  (navigator.connection.saveData || /2g/.test(navigator.connection.effectiveType || '')) && (
                  <p className="inline-note" style={{ color: 'var(--warn, #b06a00)' }}>
                    📶 データセーバー・低速回線が検出されました。自分の声（ボイスクローン）は読み上げのたびに通信が発生します。
                    気になる場合は上の「この声で読み上げる」をオフにしてください。
                  </p>
                )}
              </>
            ) : (
              <p className="inline-note">
                自分の声を読み上げ声にできます。
                <button className="btn ghost sm" style={{ marginLeft: 8 }} onClick={() => onNavigate && onNavigate('settings')}>
                  設定画面で追加
                </button>
              </p>
            )}
          </div>

          {/* 声を選ぶ（聞き取りやすい6種）。2026-11-08追加：6種を常に全展開すると場所を取るため、
              既定では今選んでいる声だけを表示し、「声を選び直す」で全展開する。 */}
          <div className="card" style={{ opacity: cloneActive ? 0.5 : 1 }}>
            <div className="section-label" style={{ marginTop: 0 }}>🎙️ 声を選ぶ（聞き取りやすい6種）</div>
            {!voicesExpanded && (() => {
              const cur = VOICE_PRESETS.find((p) => p.id === settings.voicePreset) || VOICE_PRESETS[0];
              return (
                <p className="inline-note" style={{ marginTop: 0 }}>
                  今の声：<strong>{cur?.gender === 'female' ? '👩' : '👨'} {cur?.label || '未選択'}</strong>
                  {cur?.desc ? `（${cur.desc}）` : ''}
                </p>
              );
            })()}
            <div className="voice-grid" style={voicesExpanded ? undefined : { display: 'none' }}>
              {VOICE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  className={`voice-card ${settings.voicePreset === p.id ? 'active' : ''}`}
                  onClick={() => pickVoicePreset(p)}
                >
                  <span className="voice-ico">{p.gender === 'female' ? '👩' : '👨'}</span>
                  <span className="voice-body">
                    <span className="voice-label">{p.label}</span>
                    <span className="voice-desc">{p.desc}</span>
                  </span>
                  <span className="voice-play">🔊</span>
                </button>
              ))}
            </div>
            <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => setVoicesExpanded((v) => !v)}>
              {voicesExpanded ? '折りたたむ' : '声を選び直す（6種から試聴）'}
            </button>
            <div className="hint" style={{ marginTop: 8 }}>
              タップするとその声で試聴します。端末で使える日本語音声に合わせて自動調整（声質・高さ・速さ）。
              {voices.length === 0 && ' ※この端末は日本語音声が見つかりません。端末の音声（TTS）を追加すると使えます。'}
            </div>
          </div>

          {/* 再生設定 */}
          <div className="card">
            <div className="field">
              <label>再生速度</label>
              <div className="chip-row">
                {rateOptions.map((r) => (
                  <button
                    key={r}
                    className={`chip ${Math.abs(rate - r) < 0.001 ? 'active' : ''}`}
                    onClick={() => { setRate(r); updateSettings({ speechRate: r }); }}
                  >
                    {r.toFixed(2)}×
                  </button>
                ))}
              </div>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>問題文と正解の「間」（秒）</label>
              <div className="range-row">
                <input
                  type="range" min="0" max="10" step="1" value={gap}
                  onChange={(e) => { const v = Number(e.target.value); setGap(v); updateSettings({ gapSeconds: v }); }}
                />
                <span className="range-val">{gap}秒</span>
              </div>
              <div className="hint">解答を思い出す時間として使えます。四択の問題は、選択肢を画面に出したうえで3秒で固定です（○×問題・比較・数字などはこの設定に従います）。</div>
            </div>
            <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
              <label>解答・解説のあと、次の問題まで待つ時間（秒）</label>
              <div className="range-row">
                <input
                  type="range" min="0" max="15" step="1" value={nextGap}
                  onChange={(e) => { const v = Number(e.target.value); setNextGap(v); updateSettings({ nextGapSeconds: v }); }}
                />
                <span className="range-val">{nextGap}秒</span>
              </div>
              <div className="hint">規定の時間がたつと自動で次の問題へ進みます（ボタン操作は不要です）。</div>
            </div>
          </div>

          {/* 読み上げ方の工夫（2026-11-23）。押した時に読み込む部品（起動時の束を増やさない） */}
          <Suspense fallback={<div className="card"><div className="hint">読み込み中…</div></div>}>
            <SpeechStyleCard
              speechStyle={speechStyle}
              setSpeechStyle={setSpeechStyle}
              recommended={SPEECH_RECOMMENDED}
              dictCount={readingDict.length}
              onToast={onToast}
            />
          </Suspense>

          {/* 読み方の手動補正辞書（TTSが誤読する語を直す） */}
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>🗣️ 読み方の手動補正</div>
            <div className="hint" style={{ marginBottom: 8 }}>
              音声合成が読み間違える言葉があれば、正しい読み方（ひらがな・カタカナ）を登録できます。読み上げの時だけ置き換わり、画面の文字は変わりません。
              ここで登録した読みは、アプリの読みの一覧よりいつも優先します。
              読み方の癖は声（端末の音声）ごとに違うので、直らない時は「声を選び直す」で別の声も試してください。
            </div>
            {Object.keys(settings.pronunciationFixes || {}).length > 0 && (
              <ul className="pf-list" style={{ listStyle: 'none', padding: 0, margin: '0 0 10px' }}>
                {Object.entries(settings.pronunciationFixes || {}).map(([term, reading]) => (
                  <li key={term} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                    <span>{term} → {reading}</span>
                    <button className="btn ghost sm" onClick={() => removePronunciationFix(term)}>削除</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="kw-add" style={{ flexWrap: 'wrap' }}>
              <input
                type="text"
                value={pfTerm}
                onChange={(e) => setPfTerm(e.target.value)}
                placeholder="誤読される言葉（例：経穴）"
              />
              {isVoiceCommandSupported() && (
                <button className="btn ghost sm" aria-label="誤読される言葉を声で入力" onClick={() => dictateInto(setPfTerm, '誤読される言葉')}>🎙️</button>
              )}
              <input
                type="text"
                value={pfReading}
                onChange={(e) => setPfReading(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPronunciationFix()}
                placeholder="正しい読み方（例：けいけつ）"
              />
              {isVoiceCommandSupported() && (
                <button className="btn ghost sm" aria-label="正しい読み方を声で入力" onClick={() => dictateInto(setPfReading, '正しい読み方')}>🎙️</button>
              )}
              <button className="btn sm primary" onClick={addPronunciationFix}>追加</button>
            </div>
            <Suspense fallback={null}>
              <ReadingDictTools
                readingDict={readingDict}
                userFixes={settings.pronunciationFixes || {}}
                onPreview={(t) => { cancelSpeech(); speak(applyPronunciation(t), { rate, voice: selectedVoice() }).catch(() => {}); }}
                onImport={(clean) => updateSettings({ pronunciationFixes: { ...(settings.pronunciationFixes || {}), ...clean } })}
                onToast={onToast}
              />
            </Suspense>
            {/* #52：誤読報告の履歴一覧（辞書は上書きされるため、いつ何を報告したかは別に残す） */}
            {pronReportLog.length > 0 && (
              <details style={{ marginTop: 10 }}>
                <summary className="btn ghost sm" style={{ display: 'inline-block' }}>📜 これまでの報告履歴（{pronReportLog.length}件）</summary>
                <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
                  {pronReportLog.map((e, i) => (
                    <li key={i} className="inline-note" style={{ padding: '3px 0' }}>
                      {new Date(e.at).toLocaleString('ja-JP')}：{e.term} → {e.reading}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
            </>
          )}

          <div className="audio-note">
            <strong>🎧 アプリ内なら画面を移動しても再生は続きます</strong>
            <p>
              再生中に「一問一答」や「分析」など他の画面へ移っても音声は途切れません。下に出るミニプレーヤーでどこからでも停止・スキップできます。
              再生中は<strong>ロック画面・通知にメディアプレーヤー（再生/停止・前へ/次へ）が表示</strong>され、他アプリに切り替えても残ります（対応ブラウザ）。
              ただし端末を完全にバックグラウンド化・画面OFFにすると、OSの仕様で読み上げ自体は止まることがあります（Webアプリ共通の制限）。
              いちばん途切れにくくするには、<strong>ホーム画面に追加してアプリとして起動</strong>してのご利用がおすすめです。
            </p>
          </div>
        </>
      )}
    </div>
  );
}
