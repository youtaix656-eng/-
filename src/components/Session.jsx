import { useEffect, useMemo, useRef, useState } from 'react';
import QuestionCard from './QuestionCard.jsx';
import ManagerReview from './ManagerReview.jsx';
import FastCard from './FastCard.jsx';
import { GRADES, LEECH_THRESHOLD, isLeech as isLeechState } from '../lib/srs.js';
import { getSubjects } from '../lib/stats.js';
import { subjectMatches, SUBJECT_TAG_NAMES, scopeCoverage } from '../data/examScope.js';
import { buildKanaIndex } from '../lib/yomi.js';
import { effectiveTags } from '../lib/query.js';
import { useMindmapData } from '../lib/mindmapDataLoader.js';
import { buildGenreBreakdown } from '../lib/genreBreakdown.js';
import { reviewPoolFor, buildWeaknessSummary, recommendNewPct } from '../lib/reviewPool.js';
import { loadNextTask, saveNextTask } from '../lib/nextTask.js';
import { shuffle, spaceById, buildOrder, buildNewOnlyOrder, buildReviewOnlyOrder, buildMixedOrder, buildMixedNoRepeatOrder } from '../lib/sessionOrder.js';
import { resolveBufferUsage, bufferUsageLabel, estimatedAnswerSeconds } from '../lib/bufferSession.js';
import BufferPlanCard from './BufferPlanCard.jsx';
import { loadTodayMood } from '../lib/mood.js';
import { harioBufferEncourage, harioBaseTaskReminder } from '../data/haripan.js';
import { roundKey, formatRound, isSameRound } from '../lib/round.js';
import { loadRoundLog, appendRoundLog, previousForTarget, countForTarget, formatDuration, speedupPct, recordRoundStart, loadRoundStartLog, completionRateByTarget } from '../lib/roundLog.js';
import { latestMissType } from '../lib/missTypes.js';
import { useMissTypeHandling } from '../lib/useMissTypeHandling.js';
import { loadSelfKindCounts, recordSelfKindCount } from '../lib/starWeak.js';
import { todayFocusSubjects } from '../lib/todayFocus.js';
import { daysUntil } from '../lib/gamify.js';
import { useMaruReview } from '../lib/useMaruReview.js';
import MaruReviewCard from './MaruReviewCard.jsx';
import { weakTagClusters } from '../lib/weakClusters.js';
import { loadReviewZeroLog, daysSinceLastZero } from '../lib/reviewZeroLog.js';
import { SESSION_TARGETS as TARGETS, sessionTargetLabel } from '../lib/sessionTargets.js';
import BreakTimer from './BreakTimer.jsx';
import { roundRobinMerge } from '../lib/sessionOrder.js';
import { isVoiceCommandSupported, parseVoiceCommand, listenOnce } from '../lib/voiceCommand.js';
import { loadContentSeedLog, recentlyAddedIds } from '../lib/contentSeedLog.js';
import { downloadFile } from '../lib/download.js';
import { previousAccuracyForTarget, roundLogToCsv } from '../lib/roundLog.js';

const uniqJa = (arr) => Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja'));

// 学習セッション（60/300/900）
//   60問＝1セット（休憩の区切り） / 300問＝1日の基本目標 / 900問＝1周
//   1問ごとに位置を自動保存し、アプリを閉じても「続きから」再開できる。
const SET_SIZE = 60;

function poolFor(questions, subject) {
  if (subject === 'all') return questions;
  const exact = questions.filter((q) => q.subject === subject);
  if (exact.length) return exact;
  return questions.filter((q) => subjectMatches(q.subject, { name: subject }));
}
// 出題順の組み立ては src/lib/sessionOrder.js に集約（Quiz.jsxと共用）。

export default function Session({ store, onToast, onOpenKeyword, onGoReview, onGoAudio, onGoAnalytics }) {
  const { questions, srs, history, session, startSession, updateSession, clearSession, memos, setMemo, links, setLink, recordAnswer, settings, updateSettings, bookmarks, toggleBookmark, loaded, setNextDue, examResults, casePairMap } = store;
  // 完了画面の弱点分析（まぎらわしい対比）用データ。完了画面に到達した時だけ遅延読み込みする
  // （起動時バンドルから約14万字ぶんを外すため。mindmapDataLoader.jsが単一の正）。
  const mindmapData = useMindmapData(!!(session && session.pos >= session.target));
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
  // 複数科目をバランスよく混ぜて読む（音声学習と同じ考え方。2科目以上選ぶと単一の科目選択より優先）
  const [rotateSubjects, setRotateSubjects] = useState([]);
  const toggleRotateSubject = (s) => setRotateSubjects((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  // 🆕 新着だけ（直近14日でコンテンツ更新により追加された問題。音声学習と同じ考え方）
  const [recentOnlyFilter, setRecentOnlyFilter] = useState(false);
  const [recentIds, setRecentIds] = useState(null); // null=未読み込み（絞り込みに使わない）
  useEffect(() => {
    loadContentSeedLog().then((log) => setRecentIds(recentlyAddedIds(log, Date.now() - 14 * 24 * 60 * 60 * 1000)));
  }, []);
  // 声で自己採点・操作（○/△/✕・次へ/前へ）。既定オフのオプトイン（音声データが音声認識サーバーへ
  // 送られる場合があるため。音声学習と同じ扱い）。
  const [voiceControlOn, setVoiceControlOn] = useState(false);
  const [voiceGradeSignal, setVoiceGradeSignal] = useState(null); // {kind, nonce}
  const voiceNonceRef = useRef(0);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  // 画面を大きくタップして自己採点（タップ＝○・長押し＝✕。音声学習と同じ操作方法）
  const [wideTapOn, setWideTapOn] = useState(false);
  // 🎵 複数のセッション設定を積んで、終わったら自動で次へ進む（プレイリスト。音声学習と同じ考え方）
  const [sessionPlaylist, setSessionPlaylist] = useState([]);
  const [showBreak, setShowBreak] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showAllGenres, setShowAllGenres] = useState(false); // 完了画面のジャンル別正答率を全件表示するか
  // 明日の最初の1タスク（完了画面で決めておく。次回ホーム画面の一番上に表示）
  const [nextTaskInput, setNextTaskInput] = useState('');
  const [nextTaskSavedAt, setNextTaskSavedAt] = useState(0);
  useEffect(() => {
    loadNextTask().then((t) => { if (t && t.text) setNextTaskInput(t.text); });
  }, []);
  const saveNextTaskDraft = () => {
    const text = nextTaskInput.trim();
    if (!text) return;
    saveNextTask(text);
    setNextTaskSavedAt(Date.now());
    onToast?.('📌 明日の最初の1タスクを保存しました');
  };
  // 新規◯割・復習◯割（0〜100の新規%）。既定は設定値。
  const [newPct, setNewPct] = useState(Math.round((settings.sessionNewRatio ?? 1) * 100));
  // settings はIndexedDBから非同期に読み込まれる。上のuseStateの初期値評価はマウント時の
  // 1回だけなので、この画面がsettings読み込み完了より先にマウントされていた場合、
  // 後から読み込まれた保存値（前回の新規/復習の割合）に追従しない。loadedがtrueになった
  // 最初の1回だけ同期する（以降はユーザーがスライダーを動かした値を優先し上書きしない）。
  const newPctSyncedRef = useRef(false);
  useEffect(() => {
    if (newPctSyncedRef.current || !loaded) return;
    newPctSyncedRef.current = true;
    setNewPct(Math.round((settings.sessionNewRatio ?? 1) * 100));
  }, [loaded, settings.sessionNewRatio]);

  // 3分の2バッファ術：学習予定時間（分）→ 基礎タスク/バッファの自動計算はBufferPlanCardに委ねる。
  //   体調連携は「今日の調子」（Home/Mascotで記録、音声学習・復習のノルマ調整と同じ値）を使う。
  const [mood, setMood] = useState(null);
  useEffect(() => { loadTodayMood().then(setMood); }, []);

  // 検索（科目→ジャンル→キーワード の段階しぼり＋フリーワード）
  // 複数科目をバランスよく混ぜて読む（2科目以上選んだ時は単一の科目選択より優先。音声学習と同じ考え方）
  const afterSubject = useMemo(
    () =>
      rotateSubjects.length >= 2
        ? roundRobinMerge(rotateSubjects.map((s) => questions.filter((q) => q.subject === s)))
        : subject === 'all' ? questions : poolFor(questions, subject),
    [questions, subject, rotateSubjects]
  );
  const genreOptions = useMemo(() => uniqJa(afterSubject.flatMap((q) => (q.genre ? [q.genre] : []))), [afterSubject]);
  const afterGenre = useMemo(() => (genre ? afterSubject.filter((q) => q.genre === genre) : afterSubject), [afterSubject, genre]);
  const kwOptions = useMemo(() => uniqJa(afterGenre.flatMap((q) => effectiveTags(q, links))), [afterGenre, links]);
  const kwSections = useMemo(() => buildKanaIndex(kwOptions), [kwOptions]);
  const afterKw = useMemo(() => (keyword ? afterGenre.filter((q) => effectiveTags(q, links).includes(keyword)) : afterGenre), [afterGenre, keyword, links]);
  // 回（第XX回）の選択肢（#5）
  const roundOptions = useMemo(
    () => Array.from(new Set(afterKw.map((q) => roundKey(q.round)).filter((r) => r != null))).sort((a, b) => Number(b) - Number(a)),
    [afterKw]
  );
  const afterRound = useMemo(() => (round ? afterKw.filter((q) => isSameRound(q.round, round)) : afterKw), [afterKw, round]);
  const filteredPool = useMemo(() => {
    let pool = afterRound;
    if (bookmarkOnly) pool = pool.filter((q) => bookmarks[q.id]);
    if (recentOnlyFilter && recentIds) pool = pool.filter((q) => recentIds.has(q.id));
    const t = term.trim().toLowerCase();
    if (!t) return pool;
    return pool.filter((q) => {
      const hay = [q.question, q.subject, q.round, ...(q.choices || []), q.explanation, ...effectiveTags(q, links)].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(t);
    });
  }, [afterRound, bookmarkOnly, bookmarks, term, links, recentOnlyFilter, recentIds]);

  // ○にした問題の見直し・高速回転用プール（上の絞り込み条件を引き継ぐ）。
  //   自己採点で最後に○（完璧）を選んだ問題だけを対象にし、
  //   ①問題演習で見直す（適当に○にしていないかの確認）②高速回転でインプット強化、の2通りに使う。
  //   （useMaruReview.jsが単一の正。Quiz.jsxも同じフックを使う）
  const {
    maruExcludeMastered, setMaruExcludeMastered,
    maruStatusAll, maruUncertainCount, maruStatusFiltered, maruPool,
  } = useMaruReview(filteredPool, history, srs);

  // 弱点タグ（#8）：直近の誤答が多いタグを上位に。タップでキーワードしぼり。
  //   weakClusters.jsのweakTagClustersが単一の正（表記ゆれの正規化・汎用タグの除外込み）。
  const weakTags = useMemo(
    () => weakTagClusters(history, questions, links, { minWrong: 2, limit: 8 }),
    [history, questions, links]
  );

  // 誤答理由の記録・次回間隔調整（useMissTypeHandling.jsが単一の正。Review.jsxと同じくsetNextDueで
  //   型別に間隔を調整する＝以前はSession.jsxだけ記録のみで間隔調整が効いていなかった不整合を解消）。
  const { missTypes, onMissType } = useMissTypeHandling(setNextDue);

  // 声で自己採点・操作（音声学習と同じ仕組み・既定オフ）。答えが開示されている時だけ一度聞き取る。
  // ○/△/✕はQuestionCardへvoiceGradeSignalで渡し（記録自体はQuestionCard内のpickSelfに任せる）、
  // 次へ/前へはこのコンポーネント側でpos移動する。フックの並びを崩さないよう、必ず本体の先頭
  // （他のuseEffectと同じ場所）に置く——条件分岐の後ろ（出題画面側）に置くとビルドがクラッシュする。
  useEffect(() => {
    if (!voiceControlOn || !answerRevealed || !session || session.fast || session.pos >= session.target) return;
    const handle = listenOnce({
      onResult: (text) => {
        const cmd = parseVoiceCommand(text);
        if (!cmd) return;
        if (cmd.type === 'grade') setVoiceGradeSignal({ kind: cmd.kind, nonce: ++voiceNonceRef.current });
        else if (cmd.type === 'nav' && cmd.kind === 'next') updateSession({ pos: Math.min(session.target - 1, session.pos + 1) });
        else if (cmd.type === 'nav' && cmd.kind === 'prev') updateSession({ pos: Math.max(0, session.pos - 1) });
      },
      onError: () => {},
    });
    return () => handle?.stop?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceControlOn, answerRevealed, session?.pos]);
  const [selfKindCounts, setSelfKindCounts] = useState({});
  useEffect(() => { loadSelfKindCounts().then(setSelfKindCounts); }, []);
  // #17：復習が何日ゼロに戻せていないか（「今日のおすすめ」の比率を復習側へさらに寄せる材料）
  const [reviewZeroLog, setReviewZeroLog] = useState({});
  useEffect(() => { loadReviewZeroLog().then(setReviewZeroLog); }, []);
  const reviewStalledDays = useMemo(() => daysSinceLastZero(reviewZeroLog) || 0, [reviewZeroLog]);

  // #7：要注意（リーチ、LEECH_THRESHOLD回以上の誤答）件数。開始前の画面で見えるようにし、
  //   復習画面への導線を出す（Review.jsxの一覧バッジと同じ定義）。
  const leechCount = useMemo(
    () => questions.filter((q) => isLeechState(srs[q.id])).length,
    [questions, srs]
  );

  // #11：今日集中すべき科目（todayFocus.js。Home.jsxと同じロジックを再利用）。
  //   問題の進捗や科目の手薄さ・過去問の頻出度から1件だけ提案し、
  //   「たまには苦手分野の〇〇にも挑戦してみましょう」と声掛けする。
  const focusSubject = useMemo(() => {
    const scope = scopeCoverage(questions, history);
    const picks = todayFocusSubjects(scope, daysUntil(settings.examDate), { questions, limit: 1, examResults });
    return picks[0] || null;
  }, [questions, history, settings.examDate, examResults]);

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

  // 周回速度ログ（G-100由来）：標準セッション（10・60・300・900。誤答復習・バッファ枠は対象外）が
  // 完了した瞬間に1回だけ所要時間を記録し、同じ目標での前回と比べる。
  const [lastRoundInfo, setLastRoundInfo] = useState(null);
  const loggedRoundRef = useRef(null);
  // B5：件数ごとの完了率（開始したうち実際に最後まで終えた割合）。低い件数に
  //   「無理せずもう少し少ない件数にしてみては？」と提案する（音声学習のaudioReviewLog.jsと同じ考え方）。
  const [roundCompletion, setRoundCompletion] = useState({});
  useEffect(() => {
    Promise.all([loadRoundStartLog(), loadRoundLog()]).then(([starts, finishes]) => {
      setRoundCompletion(completionRateByTarget(starts, finishes));
    });
  }, [session]);
  useEffect(() => {
    if (!session || session.pos < session.target) return;
    if (!session.startedAt || session.label || session.buffer) return;
    if (loggedRoundRef.current === session.startedAt) return; // 同じ完了を二重記録しない
    loggedRoundRef.current = session.startedAt;
    const target = session.requestedTarget || session.target;
    const ms = Date.now() - session.startedAt;
    const count = session.pos;
    // 自己採点した問数・そのうち誤答数（B4：前回との正答率比較に使う）。単一科目に絞っていた
    // 時だけ科目名も記録する（複数科目・全科目の時はsubjectを省略＝前回比較の対象をぶらさないため）。
    const idsSet = new Set(session.ids || []);
    let graded = 0, wrong = 0;
    for (const h of history) {
      if (h.at >= session.startedAt && idsSet.has(h.questionId)) { graded++; if (!h.correct) wrong++; }
    }
    const subjectForLog = session.subject && session.subject !== 'all' ? session.subject : undefined;
    loadRoundLog().then((log) => {
      const prev = previousForTarget(log, target, session.startedAt);
      const roundNo = countForTarget(log, target) + 1; // 今回を含めた通算回数
      const prevAccuracy = previousAccuracyForTarget(log, target, session.startedAt);
      setLastRoundInfo({ target, count, ms, prev, roundNo, graded, wrong, prevAccuracy });
      appendRoundLog({ target, count, ms, at: session.startedAt, graded, wrong, subject: subjectForLog });
    });
  }, [session]);

  // B3：プレイリストが積まれていれば、標準セッション完了時に自動で次の設定を開始する
  //   （誤答復習・バッファ枠・基礎タスクは対象外。音声学習の束の自動継続と同じ考え方）。
  const playlistAdvancedRef = useRef(null);
  useEffect(() => {
    if (!session || session.pos < session.target) return;
    if (!session.startedAt || session.label || session.buffer) return;
    if (sessionPlaylist.length === 0) return;
    if (playlistAdvancedRef.current === session.startedAt) return;
    playlistAdvancedRef.current = session.startedAt;
    const [next, ...rest] = sessionPlaylist;
    const t = setTimeout(() => {
      setSessionPlaylist(rest);
      onToast?.(`🎵 プレイリストの次へ：${next.subject === 'all' ? '全科目' : next.subject}・${next.target}問`);
      begin(next.target, { subject: next.subject, newRatio: next.newPct / 100, pool: poolFor(questions, next.subject) });
    }, 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // 開始ボタン共通の無効化条件（10・60・300・900のTARGETSボタンと、
  // 時間計画（3分の2バッファ術）の開始ボタンの両方で使う。以前は後者だけ
  // filteredPool.length===0しか見ておらず、押しても必ずトーストで失敗するだけの
  // 状態になり得た）。
  const startDisabled =
    filteredPool.length === 0 ||
    (newPct >= 100 && newRemaining === 0) ||
    (newPct <= 0 && reviewRemaining === 0) ||
    (newPct > 0 && newPct < 100 && newRemaining === 0 && reviewRemaining === 0);

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
    if (opts.ids) {
      // #1・#4：呼び出し側が既に並び順を決めている場合（○の見直し等）はシャッフルしない。
      ids = opts.ids;
    } else if (!opts.allowSeen) {
      if (ratio >= 1) {
        ids = buildNewOnlyOrder(pool, target, srs, casePairMap);
        if (ids.length === 0) {
          onToast?.('新規問題がありません（この条件はすべて解き終えています）。割合を下げて復習するか、条件を変えてください');
          return;
        }
      } else if (ratio <= 0) {
        ids = buildReviewOnlyOrder(pool, target, srs, casePairMap);
        if (ids.length === 0) {
          onToast?.('復習が必要な問題がありません（まだ間違えた問題がないか、復習対象がありません）。割合を上げて新規を混ぜるか、条件を変えてください');
          return;
        }
      } else {
        ids = buildMixedNoRepeatOrder(pool, target, ratio, srs, casePairMap);
        if (ids.length === 0) {
          onToast?.('この割合・条件に合う新規・復習問題がありません。割合や条件を変えてください');
          return;
        }
      }
    } else if (ratio >= 1) {
      ids = buildOrder(pool, target, casePairMap);
    } else {
      ids = buildMixedOrder(pool, target, ratio, srs, casePairMap);
    }
    // 該当数が指定問数に満たない場合は、その問数だけで1セッションとする
    const effTarget = Math.min(target, ids.length);
    updateSettings({ sessionNewRatio: ratio });
    setShowAllGenres(false);
    startSession({
      subject: subj, label: opts.label, ids, pos: 0, target: effTarget, requestedTarget: target,
      round, fast: useFast, newRatio: ratio, startedAt: Date.now(), recordedIds: [],
      ...(opts.buffer ? { buffer: opts.buffer } : {}),
    });
    setShowBreak(false);
    // B5：標準セッション（誤答復習・バッファ枠・基礎タスクは対象外）だけ「開始」ログを記録する
    //   （完了率＝開始したうち実際に最後まで終えた割合、の算出用。音声学習のaudioReviewLog.jsと同じ考え方）。
    if (!opts.label && !opts.buffer) recordRoundStart(target);
  };

  // 学習のリセット（進行中の学習セッションを破棄して開始画面へ戻す）
  const doReset = () => {
    clearSession();
    setShowBreak(false);
    setConfirmReset(false);
    onToast?.('学習をリセットしました');
  };

  // 記録（record）と次へ進める（advance）を分ける（Review.jsxと同じ形）。
  //   以前はonAnswered一発でrecordAnswer＋pos更新の両方を行っていたため、QuestionCardの
  //   key={id+pos}が次の問題へ即座に切り替わり、間違いの型を選ぶUI（onMissType）が
  //   表示される前に消えてしまっていた（#8はこの分離が前提）。
  const recordCurrent = (correct, grade, selfKind, objectiveCorrect) => {
    const cur = byId[session.ids[session.pos]];
    if (!cur) return;
    // 「← 前の問題」で解答済みの問題まで戻り、もう一度選んで自己採点しても、
    //   同じ問題を二重に記録しない（SRS・履歴・リーチ判定・selfKindCountsが
    //   上書きされて数字が狂うのを防ぐ）。見直し自体は自由にでき、advance()側で
    //   元いた最先端の位置へ戻す。
    if ((session.recordedIds || []).includes(cur.id)) return;
    // ○の見直し／○の高速回転セッションはsourceに印を付ける（#4・#12・#14。
    //   「最後にいつふりかえったか」「今日この仕上げをやったか」をhistoryだけから追跡できるように）。
    const isMaruSession = session.label === '○の見直し' || session.label === '○の高速回転';
    const leechEvent = recordAnswer(cur, correct, grade, isMaruSession ? 'maru-review' : undefined, selfKind, objectiveCorrect);
    if (leechEvent === 'became') {
      onToast?.(`⚠️ 要注意（${LEECH_THRESHOLD}回以上の誤答）：「${(cur.question || '（図の問題）').slice(0, 20)}」。解説の読み方を変えてみましょう`); // #6
    } else if (leechEvent === 'resolved') {
      onToast?.(`✅ 要注意を脱出！「${(cur.question || '（図の問題）').slice(0, 20)}」がマスターになりました`); // #6
    }
    if (selfKind === 'sankaku' || selfKind === 'batsu') {
      recordSelfKindCount(cur.id, selfKind).then(setSelfKindCounts); // #9
    }
    // 「○の見直し」中に△・✕へ崩れた＝当初の○は思い違いだった可能性が高いので、
    //   間違いノート（MistakeNote.jsx）で見分けられるよう自動でメモに印を付ける。
    if (session.label === '○の見直し' && (selfKind === 'sankaku' || selfKind === 'batsu')) {
      const tag = '⚠️見直しで判明：うろ覚えだった可能性';
      const existing = memos[cur.id] || '';
      if (!existing.includes(tag)) setMemo(cur.id, existing ? `${existing} / ${tag}` : tag);
    }
    updateSession({ recordedIds: [...(session.recordedIds || []), cur.id] });
  };
  // 次の未解答の位置へ進める。「← 前の問題」で解答済みの問題まで戻ってから完了した場合は
  //   pos+1へは進めず、まだ解答していない最初の位置（＝もといた最先端）まで一気に戻す
  //   （そうしないと、見直しのたびにセッションの進み具合が手前に巻き戻ってしまう）。
  const advance = () => {
    const recorded = new Set(session.recordedIds || []);
    let newPos = session.pos + 1;
    while (newPos < session.target && recorded.has(session.ids[newPos])) newPos++;
    updateSession({ pos: newPos });
    if (newPos < session.target && newPos % SET_SIZE === 0) setShowBreak(true);
  };
  // FastCard（高速回転モード）には間違いの型を尋ねる仕組みが無いため、
  //   記録と前進を1回でまとめて行う従来通りの動きにする。
  const answeredFast = (correct, grade, selfKind) => {
    recordCurrent(correct, grade, selfKind, undefined);
    advance();
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
                {roundOptions.map((r) => (<option key={r} value={r}>{formatRound(r)}</option>))}
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

          {/* #7：要注意（リーチ）件数。増えていることに気づけないと放置されがちなので開始前に見せる */}
          {leechCount > 0 && (
            <p className="inline-note" style={{ marginTop: 8 }}>
              ⚠️ 要注意（{LEECH_THRESHOLD}回以上の誤答）の問題が<strong>{leechCount}問</strong>あります。
              {onGoReview && <button className="btn ghost sm" style={{ marginLeft: 8 }} onClick={() => onGoReview()}>復習で見る</button>}
            </p>
          )}

          {/* #11：今日集中すべき科目の声掛け（問題の進捗・科目の手薄さ・過去問の頻出度から自動提案） */}
          {focusSubject && (
            <p className="inline-note" style={{ marginTop: 8 }}>
              🧭 たまには苦手分野の「{focusSubject.subject.name}」にも挑戦してみましょう（{focusSubject.reason}）。
              <button className="btn ghost sm" style={{ marginLeft: 8 }} onClick={() => setSubject(focusSubject.subject.name)}>この科目にしぼる</button>
            </p>
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
          <label className="autokw-row" style={{ marginTop: 6 }}>
            <input type="checkbox" checked={recentOnlyFilter} onChange={(e) => setRecentOnlyFilter(e.target.checked)} />
            <span>🆕 新着だけ（直近14日でコンテンツ更新により追加された問題）</span>
          </label>
          <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
            <label>複数科目をバランスよく混ぜて学習する（2科目以上選ぶと単一の科目選択より優先）</label>
            <div className="chip-row" style={{ marginBottom: 0 }}>
              {subjects.map((s) => (
                <button key={s} className={`chip ${rotateSubjects.includes(s) ? 'active' : ''}`} onClick={() => toggleRotateSubject(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <label className="autokw-row" style={{ marginTop: 6 }}>
            <input type="checkbox" checked={wideTapOn} onChange={(e) => setWideTapOn(e.target.checked)} />
            <span>👆 画面を大きくタップして自己採点（タップ＝○・長押し0.6秒＝✕）</span>
          </label>
          <label className="autokw-row" style={{ marginTop: 6 }}>
            <input
              type="checkbox"
              checked={voiceControlOn}
              disabled={!isVoiceCommandSupported()}
              onChange={(e) => setVoiceControlOn(e.target.checked)}
            />
            <span>
              🎙️ 声で自己採点・操作する（○/△/✕・次へ/前へ）。答えを開示したタイミングで一度だけ聞き取ります。
              この端末のブラウザの音声認識機能を使うため、認識のために音声データが音声認識サーバーへ送られる
              場合があります（端末内保存方針の明示的な例外）。
            </span>
          </label>
          {!isVoiceCommandSupported() && (
            <p className="inline-note">この端末・ブラウザは音声認識（SpeechRecognition）に対応していません。</p>
          )}

          <div className="section-label">
            新規と復習の割合
            <button
              className="btn ghost sm"
              style={{ float: 'right' }}
              onClick={() => {
                const rec = recommendNewPct(newRemaining, reviewRemaining, reviewStalledDays);
                setNewPct(rec.pct);
                onToast?.(rec.reason);
              }}
            >
              🎯 今日のおすすめ
            </button>
          </div>
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
                disabled={startDisabled}
              >
                <span className="sess-target-n">{t}</span>
                <span className="sess-target-l">{sessionTargetLabel(t)}</span>
              </button>
            ))}
          </div>
          {(() => {
            // B5：3回以上試して完了率5割未満の件数があれば、無理せず少なめを提案する
            const low = TARGETS.filter((t) => roundCompletion[t] && roundCompletion[t].starts >= 3 && roundCompletion[t].rate < 0.5);
            if (low.length === 0) return null;
            return (
              <p className="inline-note" style={{ marginTop: 6, color: 'var(--warn, #e0a800)' }}>
                「{low.map((t) => `${t}問（${sessionTargetLabel(t)}）`).join('」「')}」は最後まで終えられていない回が多いようです（完了率
                {low.map((t) => `${Math.round(roundCompletion[t].rate * 100)}%`).join('・')}）。無理せずもう少し少ない件数にしてみては？
              </p>
            );
          })()}
          {/* B6：時間から件数を逆算するチップ（音声学習の「時間から選ぶ」と同じ考え方。
              過去の実際の解答ペースから概算するだけで、バッファ術のような計画の分割は行わない） */}
          <div className="field" style={{ marginTop: 10 }}>
            <label>時間から件数を決める（これまでの解答ペースから概算）</label>
            <div className="chip-row">
              {[5, 10, 15, 20, 30].map((min) => {
                const secPer = estimatedAnswerSeconds(history, subject === 'all' ? undefined : subject);
                const n = Math.max(1, Math.round((min * 60) / secPer));
                return (
                  <button key={min} className="chip" disabled={startDisabled} onClick={() => begin(n)}>
                    {min}分（約{n}問）
                  </button>
                );
              })}
            </div>
          </div>
          {/* B3：プレイリスト（複数の設定を積んで、終わったら自動で次へ。音声学習と同じ考え方。
              積んだ時点の科目・新規復習比率をそのままスナップショットする＝ジャンル/キーワード等の
              細かい絞り込みは対象外とし、積んだあとに条件を変えても中身は変わらない） */}
          <div className="field" style={{ marginTop: 10 }}>
            <label>🎵 プレイリスト（複数の設定を積んで、終わったら自動で次へ進む）</label>
            <div className="chip-row">
              {TARGETS.map((t) => (
                <button
                  key={t}
                  className="chip"
                  onClick={() => setSessionPlaylist((cur) => [...cur, { target: t, subject, newPct }])}
                >
                  +積む（{t}問・{subject === 'all' ? '全科目' : subject}）
                </button>
              ))}
            </div>
            {sessionPlaylist.length > 0 && (
              <div className="chip-row" style={{ marginTop: 6 }}>
                {sessionPlaylist.map((p, i) => (
                  <button
                    key={i}
                    className="chip active"
                    title="タップで取り消し"
                    onClick={() => setSessionPlaylist((cur) => cur.filter((_, j) => j !== i))}
                  >
                    {i + 1}. {p.subject === 'all' ? '全科目' : p.subject}・{p.target}問 ✕
                  </button>
                ))}
              </div>
            )}
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
              一度も間違えていなくても保持率が下がってきた問題は「念のため確認」として少し混ざります。
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

        {/* ○にした問題の見直し・高速回転（上の絞り込みを引き継ぐ。MaruReviewCard.jsxが単一の正） */}
        <MaruReviewCard
          maruStatusAll={maruStatusAll}
          maruUncertainCount={maruUncertainCount}
          maruExcludeMastered={maruExcludeMastered}
          setMaruExcludeMastered={setMaruExcludeMastered}
          maruStatusFiltered={maruStatusFiltered}
          maruPool={maruPool}
          onStartReview={(pool) => begin(pool.length, { pool, ids: pool.map((q) => q.id), subject, allowSeen: true, newRatio: 1, fast: false, label: '○の見直し' })}
          onStartFast={(pool) => begin(pool.length, { pool, ids: pool.map((q) => q.id), subject, allowSeen: true, newRatio: 1, fast: true, label: '○の高速回転' })}
          onGoAnalytics={onGoAnalytics}
        />

        {/* 3分の2バッファ術：学習時間から基礎タスク/バッファを自動計算する（BufferPlanCard.jsxが単一の正） */}
        <BufferPlanCard
          subject={subject}
          history={history}
          settings={settings}
          updateSettings={updateSettings}
          mood={mood}
          onStart={(bufferPlan) => begin(bufferPlan.baseTaskQuestionCount, { buffer: bufferPlan })}
          startDisabled={startDisabled}
          onToast={onToast}
        />
      </div>
    );
  }

  // ===== マネージャービュー（3分の2バッファ術：基礎タスク完了直後の振り返り） =====
  if (session && session.pos >= session.target && session.buffer && !session.buffer.managerReview) {
    return (
      <ManagerReview
        buffer={session.buffer}
        onDecide={(completed, note) => {
          const usage = resolveBufferUsage(completed);
          updateSession({ buffer: { ...session.buffer, managerReview: { completed, ...(note ? { note } : {}) }, bufferUsage: usage } });
        }}
      />
    );
  }

  // ===== 完了画面 =====
  if (session && session.pos >= session.target) {
    const buf = session.buffer || null;
    const t = session.target; // 実際に出題された問数
    const requested = session.requestedTarget || session.target; // 押したボタンの目標値（見出し・絵文字の判定用）
    const capped = t < requested;
    // 10・60・300・900の定型セッションかどうか（誤答復習・バッファ枠・基礎タスクはlabel/bufferを持つ）。
    // これが無いと、これらの可変長セッションの長さがたまたま60/300/900をまたいだ時に
    // 無関係な「今日の目標300問達成！」等の文言・2周目ボタンが出てしまう。
    const isStandardSession = !session.label && !session.buffer;
    const dailyGoal = settings.dailyGoal ?? 300; // #12：今日の目標問数（設定で調整可）。300問固定の表示をやめる
    const doneIco = !isStandardSession ? (session.buffer ? '🧩' : '🔁') : requested >= 900 ? '🏆' : requested >= dailyGoal ? '🎉' : '✅';
    const doneTitle = !isStandardSession
      ? `${session.label || '基礎タスク'}完了！（${requested}問）`
      : requested >= 900
      ? '1周（900問）終了！'
      : requested >= dailyGoal
      ? `今日の目標 ${dailyGoal}問 達成！`
      : requested >= 60
      ? '1セット（60問）完了！'
      : `すきま学習（${requested}問）完了！`;
    const doneDesc = !isStandardSession
      ? 'おつかれさまでした。この調子で続けましょう。'
      : requested >= 900
      ? 'おつかれさまでした。苦手を分析して2周目へ進みましょう。'
      : requested >= dailyGoal
      ? 'すばらしい集中力です。苦手の復習で定着させましょう。'
      : requested >= 60
      ? 'いいペースです。続けて次のセットへ。'
      : '短い時間でもコツコツ積み上げ、えらい！もう1回いける？';
    // このセッションの解答を history から復元（誤答一覧・ジャンル別＝#1/#6）
    const idsSet = new Set(session.ids || []);
    const startedAt = session.startedAt || 0;
    const latest = new Map(); // questionId → { correct, selfKind }
    for (const h of history) {
      if (h.at >= startedAt && idsSet.has(h.questionId)) latest.set(h.questionId, { correct: h.correct, selfKind: h.selfKind });
    }
    // 誤答・あいまい（○以外）一覧。selfKind（'sankaku'|'batsu'）が分かれば△✕を区別して表示する。
    const wrongEntries = [...latest.entries()]
      .filter(([, v]) => !v.correct)
      .map(([qid, v]) => ({ q: byId[qid], selfKind: v.selfKind }))
      .filter((e) => e.q);
    const wrongQs = wrongEntries.map((e) => e.q);
    const sankakuCount = wrongEntries.filter((e) => e.selfKind === 'sankaku').length;
    const batsuCount = wrongEntries.length - sankakuCount;
    const genrePairs = [];
    for (const [qid, v] of latest) {
      const q = byId[qid]; if (!q) continue;
      genrePairs.push({ genre: q.genre || q.subject, correct: v.correct });
    }
    const genreRows = buildGenreBreakdown(genrePairs);
    const GENRE_ROWS_CAP = 8;
    const visibleGenreRows = showAllGenres ? genreRows : genreRows.slice(0, GENRE_ROWS_CAP);
    return (
      <div className="view">
        <div className="card sess-done">
          <div className="sess-done-ico">{doneIco}</div>
          <h2>{doneTitle}</h2>
          {capped && (
            <p className="inline-note" style={{ textAlign: 'center' }}>
              該当する問題が{t}問だったため、{t}問で終了しました。
            </p>
          )}
          <p className="view-desc" style={{ textAlign: 'center' }}>{doneDesc}</p>
          {isStandardSession && lastRoundInfo && lastRoundInfo.target === requested && (
            <p className="inline-note" style={{ textAlign: 'center' }}>
              🔁 通算{lastRoundInfo.roundNo}回目（{requested}問）・⏱ 所要時間 {formatDuration(lastRoundInfo.ms)}
              {lastRoundInfo.prev && (() => {
                const pct = speedupPct(lastRoundInfo.ms, lastRoundInfo.count, lastRoundInfo.prev.ms, lastRoundInfo.prev.count);
                if (pct == null) return null;
                return pct > 0
                  ? `（前回の${requested}問より1問あたり${pct}%短縮）`
                  : pct < 0
                  ? `（前回の${requested}問より1問あたり${Math.abs(pct)}%遅くなっています）`
                  : `（前回の${requested}問とほぼ同じペース）`;
              })()}
            </p>
          )}
          {/* B4：前回の同じ件数との正答率比較（音声学習のpreviousFinishと同じ考え方） */}
          {isStandardSession && lastRoundInfo && lastRoundInfo.target === requested && lastRoundInfo.graded > 0 && lastRoundInfo.prevAccuracy && (
            <p className="inline-note" style={{ textAlign: 'center' }}>
              {(() => {
                const curPct = Math.round(((lastRoundInfo.graded - lastRoundInfo.wrong) / lastRoundInfo.graded) * 100);
                const diff = curPct - lastRoundInfo.prevAccuracy.accuracyPct;
                return diff === 0
                  ? `📊 自己採点の正答率は前回と同じ約${curPct}%でした`
                  : `📊 自己採点の正答率は前回よりおよそ${Math.abs(diff)}ポイント${diff > 0 ? '上がり' : '下がり'}ました（今回約${curPct}%）`;
              })()}
            </p>
          )}
          {/* B10：周回ログの書き出し（Review.jsxの要注意一覧CSVと同じパターン） */}
          {isStandardSession && lastRoundInfo && (
            <button
              className="btn ghost sm block"
              style={{ marginTop: 6 }}
              onClick={async () => {
                const log = await loadRoundLog();
                downloadFile(roundLogToCsv(log), '周回速度ログ.csv', 'text/csv');
              }}
            >
              📄 周回速度ログをCSVで書き出す
            </button>
          )}
        </div>

        {/* 3分の2バッファ術：振り返り後のバッファ枠（ご褒美復習／積み残し消化） */}
        {buf && buf.managerReview && (
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>🧩 バッファ枠：{bufferUsageLabel(buf.bufferUsage)}</div>
            <p className="inline-note" style={{ marginTop: 0 }}>ハリオ：「{harioBufferEncourage(buf.bufferUsage)}」</p>
            <button
              className="btn primary block lg"
              onClick={() => {
                if (buf.bufferUsage === 'review') {
                  const pool = reviewPoolFor(poolFor(questions, session.subject), srs);
                  if (pool.length === 0) { onToast?.('復習対象が見つかりませんでした。またの機会に'); return; }
                  begin(Math.min(buf.bufferQuestionCount || pool.length, pool.length) || pool.length, {
                    pool, subject: session.subject, allowSeen: true, newRatio: 0, label: 'バッファ（ご褒美復習）',
                  });
                } else {
                  const pool = poolFor(questions, session.subject);
                  begin(Math.max(1, buf.bufferQuestionCount || 10), {
                    pool, subject: session.subject, allowSeen: true, newRatio: session.newRatio, label: 'バッファ（積み残し消化）',
                  });
                }
              }}
            >
              {buf.bufferUsage === 'review' ? `🎁 ご褒美復習（約${buf.bufferQuestionCount}問）を始める` : `📥 積み残し（約${buf.bufferQuestionCount}問）を消化する`}
            </button>
          </div>
        )}

        {/* ジャンル別の正答率（#6・苦手順） */}
        {genreRows.length > 1 && (
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>ジャンル別の正答率（苦手順）</div>
            <ul className="genre-stats">
              {visibleGenreRows.map(([g, s]) => {
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
            {genreRows.length > GENRE_ROWS_CAP && (
              <button className="btn ghost sm block" style={{ marginTop: 8 }} onClick={() => setShowAllGenres((v) => !v)}>
                {showAllGenres ? '折りたたむ' : `もっと見る（残り${genreRows.length - GENRE_ROWS_CAP}件）`}
              </button>
            )}
          </div>
        )}

        {/* 今回の弱点分析（誤答・△・✕をまとめて対象に、実際の頻度だけから作成） */}
        {wrongQs.length > 0 && mindmapData && (() => {
          const summary = buildWeaknessSummary(wrongQs, links, mindmapData.COMPARISONS);
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
            <p className="inline-note" style={{ marginTop: 0 }}>
              自己採点で「△ あいまい」「✕ わからない」を選んだ問題も含みます（△{sankakuCount}問・✕{batsuCount}問）。
            </p>
            <ul className="wrong-list">
              {wrongEntries.map(({ q, selfKind }) => (
                <li key={q.id}>
                  <span className={`wl-mark ${selfKind === 'sankaku' ? 'sankaku' : 'batsu'}`}>{selfKind === 'sankaku' ? '△' : '✕'}</span>
                  <span className="wl-ans">{q.type === 'ox' ? `正解 ${q.answer === 0 ? '○' : '✕'}` : `正解 ${q.answer + 1}`}</span>
                  <span className="wl-q">{q.question}</span>
                </li>
              ))}
            </ul>
            <button className="btn accent block" style={{ marginTop: 10 }} onClick={() => begin(wrongQs.length, { pool: wrongQs, subject: session.subject, newRatio: 1, allowSeen: true, label: '誤答復習' })}>
              🔁 誤答・あいまいだった{wrongQs.length}問を復習
            </button>
          </div>
        )}

        {/* #30：弱点分析・誤答一覧を見たあとに次の行動を選べるよう、「もう一度」等はここに置く
            （以前は完了直後の最上部にあり、下の弱点分析を見る前に押せてしまっていた） */}
        <div className="card">
          <div className="btn-row">
            <button className="btn accent" onClick={() => onGoReview?.()}>苦手を復習する</button>
            {onGoAudio && (
              <button className="btn" onClick={() => onGoAudio?.()}>🔊 音声で復習する</button>
            )}
            {isStandardSession && requested >= 900 ? (
              <button className="btn primary" onClick={() => begin(900, { subject: session.subject, round: (session.round || 1) + 1, fast: session.fast, newRatio: session.newRatio, pool: poolFor(questions, session.subject), allowSeen: true })}>2周目を開始</button>
            ) : isStandardSession ? (
              <button className="btn primary" onClick={() => begin(requested, { subject: session.subject, fast: session.fast, newRatio: session.newRatio, pool: poolFor(questions, session.subject), allowSeen: true, label: session.label })}>もう一度</button>
            ) : (
              // 誤答復習・○の見直し／高速回転・バッファ枠は、科目全体ではなく
              // 「このセッションで実際に出題した問題」だけを再演習する（poolFor(questions, subject)に
              // 差し替えると、無関係な新問を解いただけなのに「誤答復習完了！」等の見出しが
              // そのまま出てしまい、弱点を確認したと誤認させるバグになる）。
              <button
                className="btn primary"
                onClick={() => {
                  const curatedPool = (session.ids || []).map((id) => byId[id]).filter(Boolean);
                  // ○の見直し／高速回転は、開始時と同じく「うっかり○を先頭に、古い順」の並びを
                  // 保つため再シャッフルしない（idsをそのまま渡す＝begin()内のbuildOrderを経由しない）。
                  // それ以外（誤答復習・バッファ枠）は開始時から毎回シャッフルしていたので、
                  // もう一度でも同じくpoolだけ渡して再シャッフルさせる。
                  const isMaruLabel = session.label === '○の見直し' || session.label === '○の高速回転';
                  begin(curatedPool.length, {
                    pool: curatedPool, subject: session.subject, fast: session.fast, newRatio: session.newRatio,
                    allowSeen: true, label: session.label,
                    ...(isMaruLabel ? { ids: curatedPool.map((q) => q.id) } : {}),
                  });
                }}
              >
                もう一度
              </button>
            )}
          </div>
          <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => clearSession()}>終了する</button>
        </div>

        {/* 明日の最初の1タスク：次に開いた時「何から始めるか」で迷わないよう、1つだけ決めておく */}
        <div className="card">
          <div className="section-label" style={{ marginTop: 0 }}>📌 明日の最初の1タスクを決めておく</div>
          <p className="inline-note" style={{ marginTop: 0 }}>
            次にアプリを開いた時、ホーム画面の一番上に表示されます。迷う時間をなくすため、1つだけ決めましょう。
          </p>
          <div className="chip-row" style={{ marginBottom: 8 }}>
            {wrongQs.length > 0 && (
              <button className="chip" onClick={() => setNextTaskInput(`苦手を${Math.min(wrongQs.length, 10)}問だけ復習する`)}>
                苦手を{Math.min(wrongQs.length, 10)}問だけ復習する
              </button>
            )}
            <button className="chip" onClick={() => setNextTaskInput(`${requested}問から始める`)}>{requested}問から始める</button>
            <button className="chip" onClick={() => setNextTaskInput('音声学習で5分だけ聞く')}>音声学習で5分だけ聞く</button>
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
          {nextTaskSavedAt > 0 && <p className="hint" style={{ marginTop: 6 }}>保存しました。ホーム画面の一番上に出ます。</p>}
        </div>
      </div>
    );
  }

  // ===== 休憩画面（60問ごと） =====
  if (showBreak) {
    // target===300（かつ誤答復習・バッファ枠等の可変長セッションではない）の時だけ
    // 「今日の目標達成」を出す。posだけで判定すると、900問（1周）セッション中に
    // 300問地点を通過した瞬間に誤って表示されてしまう。
    const dailyGoal = settings.dailyGoal ?? 300; // #12
    const isDaily = !session.label && !session.buffer && session.target === dailyGoal && session.pos === dailyGoal;
    return (
      <div className="view">
        <div className="card sess-break">
          <div className="sess-done-ico">{isDaily ? '🎉' : '☕'}</div>
          <h2>{isDaily ? `今日の目標 ${dailyGoal}問 達成！` : `ひと区切り（${session.pos}問）`}</h2>
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
  // 3分の2バッファ術：基礎タスク進捗（実行役ビュー）＋ 未達が近い時のハリオのリマインド
  const bufRemaining = session.buffer ? session.target - session.pos : 0;
  const harioReminder = session.buffer && bufRemaining > 0 && bufRemaining <= 5 ? harioBaseTaskReminder(bufRemaining) : null;
  // 前の問題／次の問題への移動（タップで戻る・進める）。
  // target-1（このセッション最後の問題）より先へは進められない
  // （それ以上先へ進むとセッション完了扱いになり、answered()を経ずに完了してしまうため）。
  const canGoPrev = session.pos > 0;
  const canGoNext = session.pos < session.target - 1;
  const goToPos = (pos) => updateSession({ pos: Math.max(0, Math.min(session.target - 1, pos)) });
  // 「← 前の問題」で解答済みの問題まで戻って見返しているか（記録は上書きされない旨を伝える）
  const isReviewingAnswered = (session.recordedIds || []).includes(current.id);
  return (
    <div className="view">
      <div className="sess-topbar">
        <span className="sess-topbar-sub">
          {session.buffer && '🧩 基礎タスク・'}
          {session.subject === 'all' ? '全科目' : session.subject}
        </span>
        <span className="sess-topbar-frac">{session.pos + 1} / {session.target}　（セット{setNo}/{totalSets}）</span>
      </div>
      <div className="progress">
        <span style={{ width: `${((session.pos + 1) / session.target) * 100}%` }} />
      </div>
      <div className="btn-row" style={{ justifyContent: 'center', gap: 10, margin: '6px 0' }}>
        <button className="btn ghost sm" onClick={() => goToPos(session.pos - 1)} disabled={!canGoPrev}>← 前の問題</button>
        <button className="btn ghost sm" onClick={() => goToPos(session.pos + 1)} disabled={!canGoNext}>次の問題 →</button>
      </div>
      {harioReminder && (
        <p className="inline-note" style={{ textAlign: 'center' }}>🧑‍⚕️ ハリオ：「{harioReminder}」</p>
      )}
      {isReviewingAnswered && (
        <p className="inline-note" style={{ textAlign: 'center' }}>
          📝 この問題はすでに解答済みです（見直し用に表示中。もう一度答えても記録は上書きされません）
        </p>
      )}
      {session.fast ? (
        <FastCard key={current.id + '@' + session.pos} question={current} onGraded={answeredFast} GRADES={GRADES} />
      ) : (
        <QuestionCard
          key={current.id + '@' + session.pos}
          question={current}
          memo={memos[current.id]}
          onSetMemo={setMemo}
          link={links[current.id]}
          onSetLink={setLink}
          onOpenKeyword={onOpenKeyword}
          onAnswered={recordCurrent}
          onNext={advance}
          selfGrade
          simple
          compact
          bookmarked={!!bookmarks[current.id]}
          onToggleBookmark={toggleBookmark}
          GRADES={GRADES}
          onMissType={onMissType}
          missType={latestMissType(missTypes[current.id])?.type || ''}
          onRevealedChange={setAnswerRevealed}
          voiceGradeSignal={voiceGradeSignal}
          wideTap={wideTapOn}
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
