import { useEffect, useMemo, useRef, useState } from 'react';
import { isSpeechSupported, loadVoices, speak, cancelSpeech } from '../lib/speech.js';
import * as storage from '../lib/storage.js';
import * as engine from '../lib/audioEngine.js';
import { useAudioEngine } from '../lib/audioEngine.js';
import { VOICE_PRESETS, resolveVoiceURI, presetById } from '../data/voices.js';
import { effectiveTags, shuffle } from '../lib/query.js';
import { dateKey } from '../lib/connect.js';
import { SUBJECT_TAG_NAMES } from '../data/examScope.js';
import { useMindmapData } from '../lib/mindmapDataLoader.js';
import { buildKanaIndex } from '../lib/yomi.js';
import { reviewPoolFor, buildWeaknessSummary, weaknessSummaryToText, recommendNewPct } from '../lib/reviewPool.js';
import { studyStreak, subjectBalanceWarning, formatPercent } from '../lib/stats.js';
import { normalize, MASTER_STREAK, isLeech as isLeechState } from '../lib/srs.js';
import { riskOf } from '../lib/reviewOrder.js';
import { SESSION_TARGETS, sessionTargetLabel, estimateAudioSeconds, formatEstimateMinutes } from '../lib/sessionTargets.js';
import { loadTodayMood } from '../lib/mood.js';
import { detectBrokenYesterday, loadStreakBreakLog, breakReasonLabel } from '../lib/streakBreak.js';
import { loadNextTask } from '../lib/nextTask.js';
import { roundKey, formatRound, isSameRound } from '../lib/round.js';
import { beep, vibrate } from '../lib/sound.js';
import { isVoiceCommandSupported, parseVoiceCommand, listenOnce } from '../lib/voiceCommand.js';
import { detectHeadphoneHint } from '../lib/headphones.js';
import {
  loadAudioReviewLog, recordAudioReviewStart, recordAudioReviewFinish,
  completionRateByTarget, completionRateBySubject, topCombos, recentCombo, previousFinish, logToCsv,
} from '../lib/audioReviewLog.js';
import { loadMissTypes, latestMissType, missTypeLabel, recordMissType, MISS_TYPES } from '../lib/missTypes.js';
import { isNowBestTime } from '../lib/timeOfDay.js';
import { buildCaseLinkMap, keepCasePairsAdjacentObjects } from '../lib/casePairs.js';
import { dailyForgettingPick } from '../lib/forgetting.js';
import { todayFocusSubjects } from '../lib/todayFocus.js';
import { scopeCoverage } from '../data/examScope.js';
import { daysUntil } from '../lib/gamify.js';
import { loadSnoozeLog, snoozeCount } from '../lib/snoozeLog.js';
import { loadContentSeedLog, recentlyAddedIds } from '../lib/contentSeedLog.js';
import { conceptsOf } from '../lib/concepts.js';
import { downloadFile } from '../lib/download.js';

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

// 複数科目を交互に（位置ごとに1件ずつ）混ぜる。科目ローテーション用。
function roundRobinMerge(lists) {
  const out = [];
  let i = 0;
  let any = lists.some((l) => l.length > 0);
  while (any) {
    any = false;
    for (const l of lists) {
      if (i < l.length) { out.push(l[i]); any = true; }
    }
    i += 1;
  }
  return out;
}

export default function AudioMode({
  store, onToast, reviewPreset, onConsumePreset, onNavigate,
  onOpenFlashcardKeyword, onOpenMnemonicKeyword, onOpenGraphConcept, onOpenGlossaryTerm,
}) {
  const {
    questions, links, history, srs, settings, updateSettings, recordAnswer, setLink, bookmarks, toggleBookmark,
    voiceCloneApiKey, kwMeta, examResults, reviewQuestions,
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
  const shuffledChoicesFor = (q) => {
    if (!shuffleChoicesOn || q.type === 'ox' || !Array.isArray(q.choices)) return { choices: q.choices, answerIdx: q.answer };
    const order = shuffle(q.choices.map((_, i) => i));
    return { choices: order.map((i) => q.choices[i]), answerIdx: order.indexOf(q.answer) };
  };

  // 読み間違いをその場で報告するミニフォーム（下の「読み方の手動補正」と同じ状態を使う）
  const [pfQuickOpen, setPfQuickOpen] = useState(false);

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
  const [source, setSource] = useState('all'); // all|filter（旧: review|tagged|keyword|daily|weak）
  const [mode, setMode] = useState(0); // 連結モード（0=通常, 1〜10）
  const [selectedKeyword, setSelectedKeyword] = useState('');
  // 復習画面の絞り込み条件から渡された問題idだけに絞る場合に使う（未指定なら通常の復習プール全体）
  const [customReviewIds, setCustomReviewIds] = useState(null);
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
  // 🎙️ 声で自己採点・操作（○/△/✕・次へ/前へ/止めて）。既定オフのオプトイン。
  const [voiceControlOn, setVoiceControlOn] = useState(false);
  // 🎧 イヤホン接続を確認できた時だけ自動再生する
  const [headphoneOnly, setHeadphoneOnly] = useState(false);
  const [headphoneHint, setHeadphoneHint] = useState(null);
  // 10問ごとに「ここまで◯問、残り◯問」を声で知らせる
  const [progressAnnounceOn, setProgressAnnounceOn] = useState(false);
  // このセッションで△・✕にした問題を、最後まで聞き終えたあと自動でもう一度だけ回す
  const [autoRequeueWrongOn, setAutoRequeueWrongOn] = useState(false);
  const requeuedRef = useRef(false);
  // 60問区切りで自動的にひと休み（Session.jsxの60問区切りの休憩と同じ考え方）
  const breakNotifiedRef = useRef(-1);
  // このセッションで自己採点した件数（声で読み上げる正答率の算出に使う。採点していなければnull扱い）
  const [sessionGradedCount, setSessionGradedCount] = useState(0);
  // 音声レビューの実施ログ（よく使う組み合わせ・完了率のおすすめに使う）
  const [audioLog, setAudioLog] = useState([]);
  useEffect(() => { loadAudioReviewLog().then(setAudioLog); }, []);
  useEffect(() => { detectHeadphoneHint().then(setHeadphoneHint); }, []);
  // 誤答理由（型）の分類データ（終了時の型別の件数読み上げに使う。新規#2。
  // ここでは新しく分類せず、Review.jsx等で過去に記録済みの分類を読むだけ）。
  const [missTypes, setMissTypes] = useState({});
  useEffect(() => { loadMissTypes().then(setMissTypes); }, []);
  // 🎵 束の「プレイリスト」（新規#3）。{target, subject}の配列。現在の束が終わったら次へ進む。
  const [playlistQueue, setPlaylistQueue] = useState([]);
  // 🎙️ 声コマンドの言い回しを自分で登録する辞書（新規#7）。[{word, type, kind}]。
  const voiceCommandWords = settings.voiceCommandWords || [];
  const [vcWord, setVcWord] = useState('');
  const [vcKind, setVcKind] = useState('maru');

  // 上部の検索フィルタ（科目名 / ジャンル / キーワード、いずれも未選択OK）
  const [filterSubject, setFilterSubject] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterRound, setFilterRound] = useState('');
  const [bookmarkOnly, setBookmarkOnly] = useState(false);
  const [minRisk, setMinRisk] = useState(0);
  const [minWrong, setMinWrong] = useState(0);
  const [leechFirst, setLeechFirst] = useState(false); // リーチ（要注意）を優先して読む
  const [recentOnly, setRecentOnly] = useState(''); // ''|'today'|'week'：直近の誤答だけに絞る
  const [recentOnlyFilter, setRecentOnlyFilter] = useState(false); // 🆕 新着だけ（直近14日に追加された問題）
  const uniqJa = (arr) => Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja'));
  // 上の選択で段階的にしぼり込む（科目→ジャンル→キーワード）
  // 科目名は公式13科目（はり/きゅうは分割）＋実際に収録されている科目を合わせて表示。
  const subjectOptions = useMemo(
    () => uniqJa([...SUBJECT_TAG_NAMES, ...questions.map((q) => q.subject)]),
    [questions]
  );
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
  const recentWrongIds = useMemo(() => {
    if (!recentOnly) return null;
    const now = Date.now();
    const since = recentOnly === 'today' ? now - 24 * 60 * 60 * 1000 : now - 7 * 24 * 60 * 60 * 1000;
    const ids = new Set();
    for (const h of history) if (!h.correct && h.at >= since) ids.add(h.questionId);
    return ids;
  }, [recentOnly, history]);
  // まだ一度も解いていない問題かどうかの判定用（#29「まだ解いていない問題だけ」）
  const answeredIds = useMemo(() => new Set(history.map((h) => h.questionId)), [history]);
  const filteredPool = useMemo(() => {
    let pool = filterRound ? afterKeyword.filter((q) => isSameRound(q.round, filterRound)) : afterKeyword;
    if (bookmarkOnly) pool = pool.filter((q) => bookmarks[q.id]);
    if (newOnly) pool = pool.filter((q) => !answeredIds.has(q.id));
    if (minWrong > 0) pool = pool.filter((q) => (normalize(srs[q.id]).wrongCount || 0) >= minWrong);
    // 忘却リスクは「しきい値以上」（minRisk）と「リスク上位◯件」（riskTopN）のどちらか一方。
    // riskTopNを選んでいる時はminRiskのしきい値は使わず、リスクの高い順に並べて件数で切る。
    if (riskTopN) {
      pool = [...pool].sort((a, b) => riskOf(b, srs) - riskOf(a, srs)).slice(0, riskTopN);
    } else if (minRisk > 0) {
      pool = pool.filter((q) => Math.round(riskOf(q, srs) * 100) >= minRisk);
    }
    if (recentWrongIds) pool = pool.filter((q) => recentWrongIds.has(q.id));
    if (recentOnlyFilter) pool = pool.filter((q) => recentIds.has(q.id));
    return pool;
  }, [afterKeyword, filterRound, bookmarkOnly, bookmarks, newOnly, answeredIds, minWrong, minRisk, riskTopN, srs, recentWrongIds, recentOnlyFilter, recentIds]);
  const filterActive = !!(filterSubject || filterGenre || filterKeyword || filterRound || bookmarkOnly || newOnly || minWrong > 0 || minRisk > 0 || riskTopN || recentOnly || recentOnlyFilter || rotateSubjects.length > 0);

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
  const [recallMode, setRecallMode] = useState(false); // 記憶定着（想起→答え→反復）

  const [loop, setLoop] = useState(false);
  const [sleepMin, setSleepMin] = useState(0);

  // 今日の目標（問題数）。0=未設定。再生位置(index)が目標に達したら1回だけ知らせる。
  const [goal, setGoal] = useState(0);
  const goalNotifiedRef = useRef(false);

  // 今のセッションで △・✕ と自己採点した問題（弱点分析の材料）
  const [sessionWrong, setSessionWrong] = useState([]);
  // まぎらわしい対比・数値まとめ（mindmapData.js）は連結モード2/3や弱点分析（3問以上）でしか
  // 使わないため、そのタイミングで遅延読み込みする（起動時バンドルから約14万字ぶんを外すため）。
  const mindmapData = useMindmapData(mode === 2 || mode === 3 || sessionWrong.length >= 3);
  const weaknessSummary = useMemo(
    () => buildWeaknessSummary(sessionWrong, links, mindmapData ? mindmapData.COMPARISONS : []),
    [sessionWrong, links, mindmapData]
  );

  // 読み方の手動補正辞書（TTSの誤読を直す）
  const [pfTerm, setPfTerm] = useState('');
  const [pfReading, setPfReading] = useState('');

  // ---- 読み上げ文の部品 ----
  const questionText = (q) => {
    if (!q) return '';
    if (q.question) return q.question;
    if (q.image) return '図を見て答える問題です。画面をご確認ください。';
    return '';
  };
  // 図表が必要そうな文面なのに画像・図が登録されていない設問（QuestionCard.jsxの警告と同じ基準）。
  // 音声だけでは判断できないので、読み上げにも注意を足し、自己採点を誤らせない。
  const needsFigureWarning = (q) => !!q && !q.image && !q.figure && /[図写真]/.test(q.question || '');
  const answerText = (q) => {
    const correct = q.choices[q.answer];
    const label = q.type === 'ox' ? '正解は、' : `正解は、${q.answer + 1}番、`;
    let t = `${label}${correct}。`;
    if (q.explanation) t += ` 解説。${q.explanation}`;
    return t;
  };
  const answerTextFor = (q, choices, answerIdx) => {
    const correct = choices[answerIdx];
    const label = q.type === 'ox' ? '正解は、' : `正解は、${answerIdx + 1}番、`;
    let t = `${label}${correct}。`;
    if (q.explanation) t += ` 解説。${q.explanation}`;
    return t;
  };
  const shortStem = (q) => {
    const t = questionText(q).replace(/\s+/g, ' ').trim();
    return t.length > 26 ? t.slice(0, 26) + '…' : t;
  };
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

      if (mode === 1) return poolKw.length ? readCluster(chainOrder(byCount[0], relatedMap, poolKw)) : fallback();
      if (mode === 2) return mindmapData ? relevant(mindmapData.COMPARISONS).map((c) => ({ kind: 'compare', comp: c })) : [];
      if (mode === 3) return mindmapData ? relevant(mindmapData.NUMBER_FACTS).map((n) => ({ kind: 'number', num: n })) : [];
      if (mode === 4) return seqQ(pool).map((q) => ({ kind: 'cloze', q }));
      if (mode === 5) return weakSort(pool).map((q) => ({ kind: 'question', q }));
      if (mode === 6) return seqQ(pool).map((q) => ({ kind: 'choices', q }));
      if (mode === 7) {
        const CATS = ['現代の医療と社会', '社会保障制度', '医療倫理', '医療と社会', '医療従事者', '医療・福祉施設', '医療経済', '医療保険のしくみ', '公費負担医療', '介護サービス行政', '医療倫理教育', '施術者としての倫理'];
        const order = CATS.filter((c) => cl.has(c));
        return order.length ? readCluster(order) : fallback();
      }
      if (mode === 8) return poolKw.length ? readCluster(byCount, true) : fallback();
      if (mode === 9) return weakSort(pool).map((q) => ({ kind: 'question', q }));
      if (mode === 10) {
        const dueFirst = reviewPool.filter((q) => poolIds.has(q.id)).map((q) => ({ kind: 'question', q }));
        const seed = dailyKw && cl.has(dailyKw) ? dailyKw : byCount[0];
        const chainItems = seed ? readCluster(chainOrder(seed, relatedMap, poolKw)) : [];
        const seen = new Set();
        return [...dueFirst, ...chainItems].filter((it) => {
          if (it.kind !== 'question') return true;
          if (seen.has(it.q.id)) return false;
          seen.add(it.q.id);
          return true;
        });
      }
      return fallback();
    }

    // 件数しぼり込み（学習の10・60・300・900と同じ考え方）。足りなければ繰り返さずそこで
    // 終わる（周回して埋めない、「すべて復習」モードと同じ方針）。「もう一度（同じ件数で
    // 別の問題を）」はreviewOffsetで対象プールの次の束へローテーションする。
    const applyTarget = (list) => {
      if (!reviewTarget) return list;
      const n = list.length;
      if (n === 0) return list;
      const off = reviewOffset % n;
      const rotated = off === 0 ? list : [...list.slice(off), ...list.slice(0, off)];
      return rotated.slice(0, reviewTarget);
    };
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

    if (source === 'filter') {
      let base = filteredPool;
      if (shuffleOn) base = shuffle(base);
      if (leechFirst) base = [...base].sort((a, b) => (isLeechState(srs[b.id]) ? 1 : 0) - (isLeechState(srs[a.id]) ? 1 : 0));
      base = adjustCasePairs(base);
      // 「まだ解いていない問題だけ」に限っては、復習と同じ件数チップのUIを使い回せる。
      if (newOnly) {
        base = applyTarget(base);
        return withProgressAnnounce(base);
      }
      return base.map((q) => ({ kind: 'question', q }));
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
      base = customReviewIds ? questions.filter((q) => customReviewIds.includes(q.id)) : reviewPool;
      // 「誤った問題」モード中でも科目・ジャンル・回でさらに絞り込める
      // （要望：科目選択＋誤った問題の組み合わせ、#24・#25でジャンル・回にも拡張）。
      if (filterSubject) base = base.filter((q) => q.subject === filterSubject);
      if (filterGenre) base = base.filter((q) => q.genre === filterGenre);
      if (filterRound) base = base.filter((q) => isSameRound(q.round, filterRound));
      base = applyNagameAndSnooze(base);
    } else if (source === 'tagged') base = taggedQuestions;
    else base = questions;
    if (shuffleOn) base = shuffle(base);
    if (leechFirst) base = [...base].sort((a, b) => (isLeechState(srs[b.id]) ? 1 : 0) - (isLeechState(srs[a.id]) ? 1 : 0));
    base = adjustCasePairs(base);
    if (source === 'review') {
      base = applyTarget(base);
      return withProgressAnnounce(base);
    }
    return base.map((q) => ({ kind: 'question', q }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, source, selectedKeyword, chain, summary, flashcard, shuffleOn, clusters, kwNames, relatedMap, weakNames, weakRanked, dailyKw, questions, links, reviewPool, taggedQuestions, hasKeywords, filteredPool, filterActive, customReviewIds, leechFirst, srs, mindmapData, filterSubject, filterGenre, filterRound, reviewTarget, reviewOffset, newOnly, progressAnnounceOn, caseLinkMap, nagameOnly, excludeNagame, snoozedOnly, excludeSnoozed, reviewIdSet, snoozeLogState]);

  const [rate, setRate] = useState(settings.speechRate);
  const [gap, setGap] = useState(settings.gapSeconds);
  // 解答・解説を読み終えてから次の問題へ進むまでの間（秒）。「規定の時間がたったら次へ」の間隔。
  const [nextGap, setNextGap] = useState(settings.nextGapSeconds ?? 1);
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
    const fixes = settings.pronunciationFixes || {};
    let t = text;
    for (const term of Object.keys(fixes)) {
      if (!term) continue;
      t = t.split(term).join(fixes[term]);
    }
    return t;
  };

  // 1項目を「読み上げステップ（phase／読む文／間）」の配列へ変換。
  // 画面OFF・バックグラウンドではOSの仕様で停止する点は従来どおり。
  const buildStepsRaw = (item) => {
    const K = PHASES.KEYWORD, Q = PHASES.QUESTION, G = PHASES.GAP, A = PHASES.ANSWER, N = PHASES.NOTE;
    const steps = [];
    if (item.kind === 'progress') {
      steps.push({ phase: N, say: `ここまで${item.done}問、残り${item.remain}問です。` });
      steps.push({ wait: 300 });
      return steps;
    }
    if (item.kind === 'flashcard') {
      steps.push({ phase: K, say: `用語。${item.keyword}。` });
      steps.push({ phase: G, waitGap: true });
      steps.push({ phase: A, say: item.text });
      steps.push({ waitNextGap: true });
      return steps;
    }
    if (item.kind === 'summary') {
      steps.push({ phase: N, say: item.text });
      steps.push({ waitNextGap: true });
      return steps;
    }
    if (item.kind === 'compare') {
      const c = item.comp;
      steps.push({ phase: K, say: `比較。${c.title}。` });
      steps.push({ phase: G, waitGap: 'cap2' });
      steps.push({ phase: A, say: `${(c.members || []).join('。 ')}。` });
      if (c.note) steps.push({ phase: A, say: `ポイント。${c.note}` });
      steps.push({ waitNextGap: true });
      return steps;
    }
    if (item.kind === 'number') {
      const n = item.num;
      steps.push({ phase: K, say: `数字。${n.topic}。` });
      steps.push({ phase: G, waitGap: 'cap2' });
      steps.push({ phase: A, say: `${n.value}。${n.note || ''}` });
      steps.push({ waitNextGap: true });
      return steps;
    }
    if (item.kind === 'cloze') {
      const cq = item.q;
      const ans = cq.choices[cq.answer];
      const base = cq.explanation || questionText(cq);
      const blanked = ans && base.includes(ans) ? base.split(ans).join('○○（ピー）') : questionText(cq);
      steps.push({ phase: Q, say: `穴埋め。${blanked}。○○に入るのは何でしょう。` });
      steps.push({ phase: G, waitGap: true });
      steps.push({ phase: A, say: `答えは、${ans}。` });
      steps.push({ waitNextGap: true });
      return steps;
    }
    if (item.kind === 'choices') {
      const cq = item.q;
      const subj2 = readSubject && cq.subject ? `${cq.subject}。` : '';
      const sc2 = shuffledChoicesFor(cq);
      let t = `${subj2}問題。${questionText(cq)}。`;
      if (needsFigureWarning(cq)) t = `注意。この問題は図を確認しないと判断できません。${t}`;
      if (cq.type !== 'ox') sc2.choices.forEach((c, i) => { t += `${i + 1}番、${c}。`; });
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
      const correct = sq.choices[sq.answer];
      const label = sq.type === 'ox' ? '正解は、' : `正解は、${sq.answer + 1}番、`;
      let t = `${label}${correct}。`;
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
      front.push({ wait: 300 });
    }
    const subj = readSubject && q.subject ? `${q.subject}。` : '';
    let frontText = `${subj}問題。${questionText(q)}。`;
    if (needsFigureWarning(q)) frontText = `注意。この問題は図を確認しないと判断できません。${frontText}`;
    const scFront = readChoices ? shuffledChoicesFor(q) : null;
    if (scFront && q.type !== 'ox' && Array.isArray(q.choices)) {
      scFront.choices.forEach((c, i) => { frontText += `${i + 1}番、${c}。`; });
    }
    front.push({ phase: Q, say: frontText });
    // 裏（答え）
    const back = [];
    back.push({ phase: A, say: scFront ? answerTextFor(q, scFront.choices, scFront.answerIdx) : answerText(q) });
    if (item.note) back.push({ phase: N, say: `つながり。${item.note}` });
    // 語呂合わせノート（kwMeta）に登録済みの語呂合わせがあれば、答えのあとに読む。
    const mnemonicTag = effectiveTags(q, links)[0];
    const mnemonicText = mnemonicTag && kwMeta[mnemonicTag]?.mnemonic;
    if (mnemonicText) back.push({ phase: N, say: `語呂合わせ。${mnemonicText}` });

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
    // 記憶定着：想起をうながし、追加の間をとる（アクティブリコール）
    if (recallMode) steps.push({ phase: G, say: '……答えは？ 思い出してみよう。' });
    steps.push({ phase: G, waitGap: true });
    if (recallMode) steps.push({ wait: 1600 });
    if (readHint) {
      const hint = item.keyword || effectiveTags(q, links)[0] || '';
      if (hint) { steps.push({ say: `ヒント。キーワードは、${hint}。` }); steps.push({ wait: 600 }); }
    }
    steps.push(...back);
    // 記憶定着：答えの核心をもう一度（反復で刷り込む）
    if (recallMode) {
      const key = shortAnswer(q) || '';
      if (key) { steps.push({ wait: 400 }); steps.push({ phase: A, say: `大事なところをもう一度。${key}。` }); }
    }
    if (reverse) {
      steps.push({ phase: Q, say: `逆に確認。答えは、${shortAnswer(q)}。これは何を問う問題だったか思い出しましょう。` });
      steps.push({ waitGap: true });
      steps.push({ say: `問題は、${questionText(q)}` });
    }
    steps.push({ waitNextGap: true });
    return steps;
  };
  // 読み上げ文にだけ手動補正辞書を適用（画面表示のテキストには影響しない）
  const buildSteps = (item) => buildStepsRaw(item).map((s) => (s.say ? { ...s, say: applyPronunciation(s.say) } : s));

  // 再生計画（steps＝読み上げ手順, display＝画面表示用にそのままの item）
  const builtPlan = useMemo(
    () => plan.map((item) => ({ steps: buildSteps(item), display: item })),
    [plan, readSubject, readHint, reverse, readSide, readChoices, recallMode, skipQuestionText, shuffleChoicesOn, kwMeta, links, settings.pronunciationFixes] // eslint-disable-line react-hooks/exhaustive-deps
  );
  // 構成が同じなら（画面を離れて戻ってきた等）再生位置を保つための署名
  const planSig = useMemo(
    () => JSON.stringify([
      source, mode, selectedKeyword, chain, summary, flashcard, shuffleOn,
      readSubject, readHint, reverse, readSide, readChoices, recallMode, filterSubject, filterGenre, filterKeyword, filterRound,
      reviewTarget, reviewOffset, newOnly, progressAnnounceOn, skipQuestionText,
      questions.length, plan.length,
    ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, mode, selectedKeyword, chain, summary, flashcard, shuffleOn, readSubject, readHint, reverse, readSide, readChoices, recallMode, filterSubject, filterGenre, filterKeyword, filterRound, reviewTarget, reviewOffset, newOnly, progressAnnounceOn, skipQuestionText, questions.length, plan.length]
  );

  // 保存済みの再生位置（続きから）。マウント時に一度だけ読み込む。
  const [audioReady, setAudioReady] = useState(false);
  const resumeAudioRef = useRef(null);
  useEffect(() => {
    let alive = true;
    storage.loadAudioProgress().then((p) => {
      if (!alive) return;
      resumeAudioRef.current = p && typeof p.index === 'number' ? p : null;
      setAudioReady(true);
    });
    return () => { alive = false; };
  }, []);

  // 計画をエンジンへ（同じ署名なら位置を保持。保存位置があれば続きから）
  useEffect(() => {
    if (!audioReady) return;
    const saved = resumeAudioRef.current;
    const startIndex = saved && saved.sig === planSig ? saved.index : 0;
    engine.load(builtPlan, { sig: planSig, startIndex });
  }, [builtPlan, planSig, audioReady]);

  // 再生位置を1問ごとに保存（続きから用）。読み込み完了後のみ。
  useEffect(() => {
    if (!audioReady || !planSig) return;
    storage.saveAudioProgress({ sig: planSig, index: snap.index || 0, at: Date.now() });
  }, [snap.index, planSig, audioReady]);

  // 再生設定をエンジンへ反映（再生中でも即時）
  useEffect(() => { engine.configure({ rate }); }, [rate]);
  useEffect(() => { engine.configure({ gapSeconds: gap }); }, [gap]);
  useEffect(() => { engine.configure({ nextGapSeconds: nextGap }); }, [nextGap]);
  useEffect(() => { engine.configure({ loop }); }, [loop]);
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
    setMode(0);
    setSource('review');
    setCustomReviewIds(null);
    setReviewOffsetPersist(0);
    requeuedRef.current = false;
    setSessionGradedCount(0);
    setSessionWrong([]);
  };
  useEffect(() => {
    if (!reviewPreset) return;
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

  // 今日の目標（問題数）に達したら1回だけ知らせる
  useEffect(() => {
    if (!effectiveGoal) { goalNotifiedRef.current = false; return; }
    if (index + 1 >= effectiveGoal) {
      if (!goalNotifiedRef.current) {
        goalNotifiedRef.current = true;
        onToast?.(`🎯 今日の目標（${effectiveGoal}問）を達成しました！`);
      }
    } else {
      goalNotifiedRef.current = false;
    }
  }, [index, effectiveGoal]); // eslint-disable-line react-hooks/exhaustive-deps

  // 件数チップ・まだ解いていない問題チップが対象にしている「束」の件数（なければnull＝すべて）
  const batchTarget = (source === 'review' || (source === 'filter' && newOnly)) ? reviewTarget : null;
  // マスター到達件数の読み上げ（新規）：セッション開始時点のマスター済み累計を覚えておく
  const masteredAtStartRef = useRef(null);
  const togglePlay = () => {
    if (!playing) {
      // 🎧 イヤホン接続時だけ自動再生する設定がONの時、確認できていなければ止める
      // 改善案i3：確認済みはその日のうちだけ覚えておく（毎回チェックしなくてよいように）。
      if (headphoneOnly && headphoneHint !== true && settings.audioHeadphoneConfirmedDate !== dateKey()) {
        onToast?.('🎧 イヤホンの接続を確認できませんでした。イヤホンをつないでから、下の「イヤホンを付けています」にチェックしてください。');
        return;
      }
      updateSettings({ speechRate: rate, gapSeconds: gap, nextGapSeconds: nextGap });
      engine.configure({ rate, gapSeconds: gap, nextGapSeconds: nextGap, loop, voice: selectedVoice(), pitch: settings.speechPitch || 1 });
      engine.setSleep(sleepMin);
      breakNotifiedRef.current = -1;
      // 実施ログ（#19）：件数チップを使っている束の、最初の再生だけを「開始」として記録する
      if (!snap.started && (source === 'review' || (source === 'filter' && newOnly)) && total > 0) {
        masteredAtStartRef.current = masteredCount;
        recordAudioReviewStart({
          target: batchTarget, subject: filterSubject || null,
          genre: filterGenre || null, round: filterRound || null, n: total,
        }).then(setAudioLog);
      }
    }
    engine.toggle();
  };
  const skip = (delta) => engine.skip(delta);
  const resetToStart = () => {
    engine.resetToStart();
    storage.clearAudioProgress();
    resumeAudioRef.current = null;
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
    if (total > BREAK_EVERY && (index + 1) % BREAK_EVERY === 0 && index + 1 < total && breakNotifiedRef.current !== index) {
      breakNotifiedRef.current = index;
      engine.stop();
      onToast?.(`✋ ${BREAK_EVERY}問区切りです。ひと休みしましょう（▶で続きから再生できます）`);
    }
  }, [index, playing, total, source, newOnly]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const handle = listenOnce({
      onResult: (text) => {
        const cmd = parseVoiceCommand(text, voiceCommandWords);
        if (!cmd) return;
        if (cmd.type === 'grade') gradeCurrent(cmd.kind);
        else if (cmd.type === 'nav' && cmd.kind === 'next') skip(1);
        else if (cmd.type === 'nav' && cmd.kind === 'prev') skip(-1);
        else if (cmd.type === 'nav' && cmd.kind === 'stop') engine.stop();
        else if (cmd.type === 'nav' && cmd.kind === 'allDone') gradeRestAsMaru();
      },
      onError: () => {},
    });
    return () => handle?.stop?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, voiceControlOn, current?.id]);

  // 件数チップで区切った束を最後まで読み終えたら、声で知らせ・実施ログに記録し、
  // 「間違えた問題だけもう一度」がONなら自動でもう一度だけ回す（#14・#15・#17・#19・#20）。
  // 前回との正答率比較（新規#1）・誤答理由（型）別の件数（新規#2）・プレイリストの次の束への
  // 自動進行（新規#3）もここでまとめて行う。
  const prevFinishedRef = useRef(false);
  useEffect(() => {
    const justFinished = snap.finished && !prevFinishedRef.current;
    prevFinishedRef.current = snap.finished;
    if (!justFinished) return;
    if (!(source === 'review' || (source === 'filter' && newOnly))) return;
    const n = total;
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
    cancelSpeech();
    const msg = `おつかれさまでした。${n}問、終わりました。${accuracyLine}${typeLine}${leechLine}${masteredLine}${ungradedLine}`;
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
      setTimeout(() => {
        setCustomReviewIds(ids);
        setReviewTarget(null);
        onToast?.(`🔁 △・✕にした${ids.length}問を、もう一度だけ読み上げます`);
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
        setReviewOffsetPersist(0);
        setReviewTarget(nextItem.target);
        setSessionGradedCount(0);
        setSessionWrong([]);
        requeuedRef.current = false;
        onToast?.(`▶ 次の束へ進みます（${nextItem.subject || '全科目'}×${nextItem.target ?? 'すべて'}）`);
        setTimeout(() => engine.play(), 300);
      }, 600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.finished]);

  const changeSource = (s) => {
    rebuildStop();
    // 6つのボタンを選んだら検索フィルタは解除（どちらか一方のモード）
    setFilterSubject('');
    setFilterGenre('');
    setFilterKeyword('');
    setSource(s);
    if (s === 'keyword' && !selectedKeyword && hasKeywords) setSelectedKeyword(kwNames[0]);
  };

  // 連結モードの切り替え（同じものを再タップで通常へ戻す）
  const changeMode = (m) => {
    rebuildStop();
    setMode((cur) => (cur === m ? 0 : m));
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
    setFilterSubject('');
    setFilterGenre('');
    setFilterKeyword('');
    setFilterRound('');
    setBookmarkOnly(false);
    setNewOnly(false);
    setMinRisk(0);
    setRiskTopN(null);
    setMinWrong(0);
    setRecentOnly('');
    setRecentOnlyFilter(false);
    setRotateSubjects([]);
    setNagameOnly(false);
    setExcludeNagame(false);
    setSnoozedOnly(false);
    setExcludeSnoozed(false);
    setReviewTarget(null);
    setReviewOffsetPersist(0);
    setSource('all');
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
  // 🔁 もう一度（同じ件数で別の問題を）：対象プールの次の束へローテーションする（#2）
  // 🔁 もう一度（同じ件数で別の問題を）：対象プールの次の束へローテーションする（#2）。
  // 前回との問題の重複率も見る（新規・模試の「前回の同モードとの問題重複率」と同じ考え方）。
  const prevBatchIdsRef = useRef(null);
  const justRepeatedRef = useRef(false);
  const repeatWithNextBatch = () => {
    rebuildStop();
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

  // #10 聞きながら自己採点／キーワード追加（○＝できた, △・✕＝復習へ）
  const gradeCurrent = (kind) => {
    const q = current;
    if (!q) return;
    const ok = kind === 'maru';
    recordAnswer(q, ok);
    setSessionGradedCount((n) => n + 1);
    if (!ok) setSessionWrong((prev) => (prev.some((x) => x.id === q.id) ? prev : [...prev, q]));
    onToast?.(
      kind === 'maru'
        ? '「○ できた」を記録しました'
        : kind === 'sankaku'
        ? '「△ あいまい」を記録（復習に追加）'
        : '「✕ できない」を記録（復習に追加）'
    );
  };
  // 声コマンド「全部できた」：今の問題から最後までをまとめて○にし、そこで終える（新規#9）。
  // 長い移動中に最後まで聞き終えた時用。既に自己採点した問題も含めて◯を重ねるだけなので、
  // 個別に採点していたものがあっても害はない（改めて正解扱いに書き直されるだけ）。
  const gradeRestAsMaru = () => {
    const remaining = builtPlan.slice(index).map((item) => item.display).filter((d) => d?.q);
    remaining.forEach((d) => recordAnswer(d.q, true));
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
  // 読み方の手動補正辞書（例：「経穴」→「けいけつ」）
  const addPronunciationFix = () => {
    const term = pfTerm.trim();
    const reading = pfReading.trim();
    if (!term || !reading) return;
    const cur = { ...(settings.pronunciationFixes || {}) };
    cur[term] = reading;
    updateSettings({ pronunciationFixes: cur });
    setPfTerm('');
    setPfReading('');
    onToast?.(`「${term}」→「${reading}」を登録しました`);
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

      {/* 上部の検索（科目名・ジャンル・キーワードでしぼり込む） */}
      <div className="card audio-search">
        <div className="section-label" style={{ marginTop: 0 }}>🔍 検索（しぼり込み）</div>
        <div className="search-grid">
          <label className="mini-field">
            <span>科目名</span>
            <select value={filterSubject} onChange={(e) => applyFilter({ subject: e.target.value })}>
              <option value="">指定なし</option>
              {subjectOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
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
        <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
          <label>複数科目をバランスよく混ぜて読む（2科目以上選ぶと単一の科目選択より優先）</label>
          <div className="chip-row" style={{ marginBottom: 0 }}>
            {subjectOptions.map((s) => (
              <button key={s} className={`chip ${rotateSubjects.includes(s) ? 'active' : ''}`} onClick={() => toggleRotateSubject(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <label className="autokw-row" style={{ marginTop: 6 }}>
          <input type="checkbox" checked={leechFirst} onChange={(e) => setLeechFirst(e.target.checked)} />
          <span>⚠️ リーチ（要注意）問題を優先して読む</span>
        </label>
        <div className="chip-row" style={{ marginTop: 8 }}>
          <span className="section-hint">直近の誤答だけ：</span>
          <button className={`chip ${recentOnly === 'today' ? 'active' : ''}`} onClick={() => changeRecentOnly('today')}>今日</button>
          <button className={`chip ${recentOnly === 'week' ? 'active' : ''}`} onClick={() => changeRecentOnly('week')}>今週</button>
        </div>
        <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
          <label>忘却リスクの下限（{riskTopN ? '上位件数を使用中' : minRisk === 0 ? '指定なし' : `${minRisk}%以上だけ`}）</label>
          <input type="range" min="0" max="90" step="10" value={minRisk} disabled={!!riskTopN} onChange={(e) => changeMinRisk(Number(e.target.value))} />
          <div className="chip-row" style={{ marginTop: 6, marginBottom: 0 }}>
            <span className="section-hint">しきい値ではなく上位◯件で選ぶ：</span>
            {[5, 10, 20, 30].map((n) => (
              <button key={n} className={`chip ${riskTopN === n ? 'active' : ''}`} onClick={() => changeRiskTopN(n)}>上位{n}件</button>
            ))}
          </div>
        </div>
        <div className="field" style={{ marginTop: 8 }}>
          <label>誤答回数の下限（{minWrong === 0 ? '指定なし' : `${minWrong}回以上だけ`}）</label>
          <input type="range" min="0" max="10" step="1" value={minWrong} onChange={(e) => { rebuildStop(); setMinWrong(Number(e.target.value)); }} />
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

      {(source === 'review' || (source === 'filter' && newOnly)) && (() => {
        const isNewOnlyMode = source === 'filter' && newOnly;
        let n;
        if (isNewOnlyMode) {
          n = filteredPool.length;
        } else {
          let reviewBase = customReviewIds ? questions.filter((q) => customReviewIds.includes(q.id)) : reviewPool;
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
                    setPlaylistQueue((q) => [...q, { target: reviewTarget, subject: filterSubject || null }]);
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
                          {it.subject || '全科目'}×{it.target ?? 'すべて'} ✕
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
                          <div key={q.id} className="btn-row" style={{ flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
                            <span className="inline-note" style={{ marginRight: 6 }}>
                              {(q.question || '（図の問題）').slice(0, 20)}…
                            </span>
                            {MISS_TYPES.map((t) => (
                              <button key={t.id} className="chip" onClick={() => recordMissType(q.id, t.id).then(setMissTypes)}>
                                {t.label}
                              </button>
                            ))}
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
            onToggle={() => setSkipQuestionText((v) => !v)}
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
            title="🎙️ 声で自己採点・操作する（○/△/✕・次へ/前へ/止めて/全部できた）"
            desc="正解・解説を読み終えたタイミングで一度だけ聞き取ります。「全部できた」で残りをまとめて○にして終えられます。この端末のブラウザの音声認識機能を使うため、認識のために音声データが音声認識サーバーへ送られる場合があります（端末内保存方針の明示的な例外）。スピーカー再生中はマイクに読み上げ自体が混ざり誤認識することがあるため、イヤホン使用がおすすめです。"
            disabled={!isVoiceCommandSupported()}
          />
          {!isVoiceCommandSupported() && (
            <p className="inline-note">この端末・ブラウザは音声認識（SpeechRecognition）に対応していません。</p>
          )}
          {/* 改善案i1：合図音と声コマンドを組み合わせるとタイミングが分かりやすいことを案内 */}
          {voiceControlOn && !beepOn && (
            <p className="inline-note">💡 上の「合図音」も一緒にONにすると、聞き取るタイミング（答えが来た直後）が分かりやすくなります。</p>
          )}
          {/* 新規#7：声コマンドの言い回しを自分で登録する辞書 */}
          {voiceControlOn && (
            <div style={{ marginTop: 8 }}>
              <div className="section-label" style={{ marginTop: 0 }}>🗣️ 自分の言い回しを登録する</div>
              {voiceCommandWords.length > 0 && (
                <ul className="pf-list" style={{ listStyle: 'none', padding: 0, margin: '0 0 8px' }}>
                  {voiceCommandWords.map((w, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                      <span>「{w.word}」→ {w.type === 'grade' ? { maru: '○', sankaku: '△', batsu: '✕' }[w.kind] : { next: '次へ', prev: '前へ', stop: '止めて', allDone: '全部できた' }[w.kind]}</span>
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

      {/* 連結モード（1〜10）。検索でしぼった範囲に対して読み方を選ぶ。よく使う順に並びます。 */}
      <div className="section-label">連結学習モード（読み方を選ぶ・よく使う順）</div>
      <div className="mode-list">
        <button className={`mode-card ${mode === 0 ? 'active' : ''}`} onClick={() => changeMode(0)}>
          <span className="mode-ico">🎧</span>
          <span className="mode-body">
            <span className="mode-title">通常（そのまま順に読む）</span>
            <span className="mode-desc">検索でしぼった問題を、問題→間→正解の順にそのまま読み上げます。</span>
          </span>
        </button>
        {sortedModes.map((m) => (
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
          {/* プレーヤー */}
          <div className="player">
            {/* スクリーンリーダー向け：フェーズの切り替えを読み上げとは別に伝える */}
            <div aria-live="polite" className="sr-only">
              {phase === PHASES.QUESTION && '問題'}
              {phase === PHASES.GAP && '考え中'}
              {phase === PHASES.ANSWER && '正解と解説'}
              {phase === PHASES.NOTE && 'まとめ'}
            </div>
            {currentItem?.keyword && <div className="now-keyword">🔗 {currentItem.keyword}</div>}
            <div>
              <span className="now-phase">
                {phase === PHASES.KEYWORD && (currentItem?.kind === 'flashcard' ? '用語' : 'キーワード')}
                {phase === PHASES.QUESTION && '問題'}
                {phase === PHASES.GAP && '……考え中……'}
                {phase === PHASES.ANSWER && (currentItem?.kind === 'flashcard' ? '意味・要点' : '正解・解説')}
                {phase === PHASES.NOTE && (currentItem?.kind === 'summary' ? 'まとめ' : 'つながり')}
              </span>
              <span className="now-index">{index + 1} / {total}</span>
              {effectiveGoal > 0 && (
                <span className="now-index" style={{ marginLeft: 8 }}>
                  🎯 目標 {Math.min(index + 1, effectiveGoal)} / {effectiveGoal}問
                  {mood === 'tired' && goal > 0 && effectiveGoal < goal && '（少なめに調整中）'}
                </span>
              )}
              <span className="now-index" style={{ marginLeft: 8 }}>
                📅 今日の目標 {dailyGoalCount}/{effectiveDailyGoal}問
              </span>
            </div>

            <div className="now-subject">
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
                : current?.question || (current?.image ? '図を見て答える問題' : '')}
            </div>

            {phase === PHASES.ANSWER && current && (
              <div className="now-answer">
                <strong>
                  正解：
                  {current.type === 'ox'
                    ? current.choices[current.answer]
                    : `${current.answer + 1}. ${current.choices[current.answer]}`}
                </strong>
                {current.explanation && <div style={{ marginTop: 6 }}>{current.explanation}</div>}
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

            <div className="phase-indicator">
              <div className={`seg ${phase === PHASES.KEYWORD || phase === PHASES.QUESTION ? 'on' : ''}`} />
              <div className={`seg ${phase === PHASES.GAP ? 'on' : ''}`} />
              <div className={`seg ${phase === PHASES.ANSWER || phase === PHASES.NOTE ? 'on' : ''}`} />
            </div>

            <div className="player-controls">
              <button onClick={() => skip(-1)} disabled={index === 0} aria-label="前へ">⏮</button>
              <button className="main" onClick={togglePlay} aria-label="再生 / 一時停止">{playing ? '⏸' : '▶'}</button>
              <button onClick={() => skip(1)} disabled={index >= total - 1} aria-label="次へ">⏭</button>
            </div>
            {index > 0 && (
              <button className="btn ghost sm block" style={{ marginTop: 10 }} onClick={resetToStart}>🔁 最初から（リセット）</button>
            )}

            {/* 👆 画面を大きくタップして自己採点（タップ＝○・長押し＝✕） */}
            {current && wideTapOn && (
              <div
                className="wide-tap-zone"
                onPointerDown={() => { wideTapDownRef.current = Date.now(); }}
                onPointerUp={() => {
                  const dt = Date.now() - (wideTapDownRef.current || Date.now());
                  gradeCurrent(dt >= 600 ? 'batsu' : 'maru');
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
                <button className="btn ghost sm" onClick={() => setPfQuickOpen((v) => !v)}>🔤 読み間違いを報告</button>
              </div>
            )}
            {current && pfQuickOpen && (
              <div className="kw-add" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                <input type="text" value={pfTerm} onChange={(e) => setPfTerm(e.target.value)} placeholder="誤って読まれた言葉" />
                <input type="text" value={pfReading} onChange={(e) => setPfReading(e.target.value)} placeholder="正しい読み方（ひらがな）" />
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
            </div>
          )}

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
            <Opt
              on={recallMode}
              onToggle={() => setRecallMode((v) => !v)}
              title="🧠 記憶定着モード（想起→答え→反復）"
              desc="問題のあと「答えは？」と促して“思い出す間”を長めにとり、正解の核心をもう一度読みます。手が使えなくても記憶に残りやすくなります。"
            />
          </div>

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
              on={readHint}
              onToggle={() => setReadHint((v) => !v)}
              title="答えの前にヒントを読む"
              desc="思い出すきっかけ（キーワード）を先に読み上げます。思い出す力が鍛えられます。"
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
              <div className="hint">寝る前の“ながら再生”に。指定時間で自動停止します。</div>
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
              <div className="hint">タイマーの代わりに「問題数」で今日のゴールを決めたい時に。達成したら知らせます。</div>
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

          {/* 声を選ぶ（聞き取りやすい6種） */}
          <div className="card" style={{ opacity: cloneActive ? 0.5 : 1 }}>
            <div className="section-label" style={{ marginTop: 0 }}>🎙️ 声を選ぶ（聞き取りやすい6種）</div>
            <div className="voice-grid">
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
              <div className="hint">解答を思い出す時間として使えます。</div>
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

          {/* 読み方の手動補正辞書（TTSが誤読する語を直す） */}
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>🗣️ 読み方の手動補正</div>
            <div className="hint" style={{ marginBottom: 8 }}>
              音声合成が読み間違える言葉があれば、正しい読み方（ひらがな・カタカナ）を登録できます。読み上げの時だけ置き換わり、画面の文字は変わりません。
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
              <input
                type="text"
                value={pfReading}
                onChange={(e) => setPfReading(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPronunciationFix()}
                placeholder="正しい読み方（例：けいけつ）"
              />
              <button className="btn sm primary" onClick={addPronunciationFix}>追加</button>
            </div>
          </div>

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
