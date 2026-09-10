import { useEffect, useMemo, useRef, useState } from 'react';
import ResetInline from './ResetInline.jsx';
import * as storage from '../lib/storage.js';
import { effectiveTags } from '../lib/query.js';
import { genreAccuracy, keywordAccuracy, topByAccuracy, relatedKeywordMap } from '../lib/audioplan.js';
import { buildGenreBreakdown } from '../lib/genreBreakdown.js';
import { buildBlueprintExam, blueprintAvailability, preferUnused, shuffle } from '../lib/examBuilder.js';
import { EXAM_BLUEPRINT_AM, EXAM_BLUEPRINT_PM } from '../data/examBlueprint.js';
import { buildKanaIndex } from '../lib/yomi.js';
import { figureFor } from '../data/figures.jsx';
import { normalize, isLeech, LEECH_THRESHOLD } from '../lib/srs.js';
import { buildWeaknessSummary } from '../lib/reviewPool.js';
import { SUBJECT_TAG_NAMES } from '../data/examScope.js';
import { roundKey, formatRound, isSameRound } from '../lib/round.js';
import { expectedProgress, isBehindPace, rankSlowQuestions } from '../lib/examPace.js';
import { halfSplitAccuracy } from '../lib/examHalfSplit.js';
import { loadExamUsageLog, appendExamUsageLog, recentlyUsedIds, overlapWithLast } from '../lib/examUsageLog.js';
import { scoreContribution, pointsShortOfPassLine } from '../lib/examScoreContribution.js';
import { phaseForDate } from '../data/roadmapPhases.js';
import { daikoumokuRank } from '../lib/pastExamTrends.js';
import { genreOf, daikoumoku } from '../lib/genreClassification.js';

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// 合格基準は総得点の60%（鍼灸国試の目安）
const PASS_RATE = 0.6;
// 得意／苦手／選択式モードの1回あたりの出題数上限
const PRACTICE_COUNT = 90;

const MODES = [
  { id: 'am', label: '午前', emoji: '🌅', desc: '専門基礎科目 90問（本番同形式・時間制限あり）' },
  { id: 'pm', label: '午後', emoji: '🌇', desc: '専門科目 90問（本番同形式・時間制限あり）' },
  { id: 'full', label: '午前+午後 通し', emoji: '🏃', desc: '本番同様に午前90問→休憩→午後90問を通しで' },
  { id: 'strong', label: '得意な問題', emoji: '💪', desc: '得意なジャンル・キーワードを中心に最大90問' },
  { id: 'weak', label: '苦手な問題', emoji: '🎯', desc: '苦手なジャンル・キーワードを中心に最大90問' },
  { id: 'pick', label: '選択式', emoji: '🔍', desc: '科目・ジャンル・キーワードを選んで最大90問' },
];
const MODE_BY_ID = Object.fromEntries(MODES.map((m) => [m.id, m]));

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 模擬試験モード
// 午前／午後は本番同形式の科目配分・時間制限で通し演習。
// 得意／苦手／選択式は正答率の自動提案や検索条件から出題数を組み立てる演習モード。
// いずれも終了後に正答率・科目別内訳を表示し、解答はSRS・復習リストへ自動反映される。
export default function Exam({ store, onNavigate }) {
  const { questions, links, history, srs, recordAnswer, examResults, addExamResult, bookmarks } = store;

  const [stage, setStage] = useState('select'); // select | setup | running | result
  const [modeId, setModeId] = useState(null);
  const [order, setOrder] = useState([]);
  const [answers, setAnswers] = useState([]); // index による解答（null=未解答）
  const [idx, setIdx] = useState(0);
  const [remain, setRemain] = useState(0);
  const [timed, setTimed] = useState(false);
  const [shortfalls, setShortfalls] = useState([]);
  const [resume, setResume] = useState(null); // 前回の続きから
  const [paused, setPaused] = useState(false); // タイマーの一時停止
  const [zoom, setZoom] = useState(false); // 図の拡大表示
  const timerRef = useRef(null);
  const remainRef = useRef(0);
  useEffect(() => { remainRef.current = remain; }, [remain]);

  // #21：午前+午後 通しモード（'full'）。午前が終わったら休憩をはさみ、午後は別途組み立てて続行する。
  const [fullPhase, setFullPhase] = useState(null); // 'full'モード中のみ 'am' | 'pm'
  const [amSnapshot, setAmSnapshot] = useState(null); // 'full'モードの午前終了時点の{order,answers,slowQuestions}

  // #11・#15・#17・#18：模試の出題履歴（直近の使い回しを避ける）
  const [examUsageLogState, setExamUsageLogState] = useState([]);
  useEffect(() => { loadExamUsageLog().then(setExamUsageLogState); }, []);
  const [overlapPct, setOverlapPct] = useState(null); // 直前の同モードとの重複率（#15、結果画面用）
  // #14：直前期は常に「未出題優先」に固定する。それ以外はユーザーが選べる（#18）。
  const phase = useMemo(() => phaseForDate(todayStr()), []);
  const isChokuzenPhase = phase?.kind === 'chokuzen' || phase?.kind === 'final';
  const [avoidRepeatChoice, setAvoidRepeatChoice] = useState(true);
  const avoidRepeat = isChokuzenPhase ? true : avoidRepeatChoice;

  // #28：一時停止の回数・合計時間（本番相当の集中力で解けているかの目安）
  const [pauseCount, setPauseCount] = useState(0);
  const [pausedMs, setPausedMs] = useState(0);
  const pauseStartRef = useRef(null);
  const togglePause = () => {
    setPaused((v) => {
      const next = !v;
      if (next) {
        pauseStartRef.current = Date.now();
        setPauseCount((c) => c + 1);
      } else if (pauseStartRef.current) {
        setPausedMs((m) => m + (Date.now() - pauseStartRef.current));
        pauseStartRef.current = null;
      }
      return next;
    });
  };

  // ---- ペース管理（①）：本番形式(am/pm)の各問にかけた時間を計測し、
  //   リアルタイムの目安表示と、終了後の「時間を使いすぎた問題」ランキングに使う ----
  const timeSpentRef = useRef([]); // 秒、order[i] に対応
  const idxAtRef = useRef({ idx: 0, at: 0 });
  const [slowQuestions, setSlowQuestions] = useState([]); // 結果画面用（終了時にスナップショット）
  useEffect(() => {
    timeSpentRef.current = new Array(order.length).fill(0);
    idxAtRef.current = { idx: 0, at: Date.now() };
  }, [order]);
  useEffect(() => {
    if (stage !== 'running') return;
    const now = Date.now();
    const prev = idxAtRef.current;
    if (prev && timeSpentRef.current[prev.idx] != null) {
      timeSpentRef.current[prev.idx] += (now - prev.at) / 1000;
    }
    idxAtRef.current = { idx, at: now };
  }, [idx, stage]);
  const totalSecondsForMode = (mid) => {
    const bp = mid === 'am' ? EXAM_BLUEPRINT_AM : mid === 'pm' ? EXAM_BLUEPRINT_PM : null;
    return bp ? bp.minutes * 60 : null;
  };
  const totalSeconds = timed ? totalSecondsForMode(modeId === 'full' ? fullPhase : modeId) : null;
  const paceInfo = useMemo(() => {
    if (!timed || !totalSeconds || order.length === 0) return null;
    const elapsed = Math.max(0, totalSeconds - remain);
    const expectedIdx = expectedProgress(elapsed, totalSeconds, order.length);
    // #23：1問あたりの目安秒（配分は問題ごとにシャッフルされ科目順には並ばないため、
    // 科目別の区間目安ではなく「このペースを保てば間に合う」という単純な目安にする）。
    const secPerQuestion = Math.round(totalSeconds / order.length);
    return { expectedIdx, behind: isBehindPace(idx, expectedIdx), secPerQuestion };
  }, [timed, totalSeconds, remain, order.length, idx]);

  // ---- 得意／苦手モード：正答率から自動提案 ----
  const genreRanked = useMemo(() => genreAccuracy(questions, history), [questions, history]);
  const kwRanked = useMemo(() => keywordAccuracy(questions, links, history), [questions, links, history]);
  const direction = modeId === 'strong' ? 'strong' : modeId === 'weak' ? 'weak' : null;
  const suggestedGenres = useMemo(
    () => (direction ? topByAccuracy(genreRanked, { direction, limit: 3 }) : []),
    [genreRanked, direction]
  );
  const suggestedKeywords = useMemo(
    () => (direction ? topByAccuracy(kwRanked, { direction, limit: 3 }) : []),
    [kwRanked, direction]
  );
  const [selectedChips, setSelectedChips] = useState(new Set());
  const [chipSig, setChipSig] = useState('');
  useEffect(() => {
    if (!direction) return;
    const sig = [
      ...suggestedGenres.map((g) => `genre:${g.genre}`),
      ...suggestedKeywords.map((k) => `kw:${k.keyword}`),
    ].join(',');
    if (sig === chipSig) return;
    setChipSig(sig);
    setSelectedChips(new Set(sig ? sig.split(',') : []));
  }, [direction, suggestedGenres, suggestedKeywords, chipSig]);
  const toggleChip = (key) => {
    setSelectedChips((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const accuracyPool = useMemo(() => {
    if (!direction) return [];
    const byId = new Map();
    for (const g of suggestedGenres) {
      if (!selectedChips.has(`genre:${g.genre}`)) continue;
      for (const q of g.questions) byId.set(q.id, q);
    }
    for (const k of suggestedKeywords) {
      if (!selectedChips.has(`kw:${k.keyword}`)) continue;
      for (const q of k.questions) byId.set(q.id, q);
    }
    return [...byId.values()];
  }, [direction, suggestedGenres, suggestedKeywords, selectedChips]);

  // ---- 選択式モード：科目→ジャンル→キーワードのカスケード検索 ----
  const [filterSubject, setFilterSubject] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterRound, setFilterRound] = useState('');
  const [pickBookmarkOnly, setPickBookmarkOnly] = useState(false);
  const [relatedSelected, setRelatedSelected] = useState(new Set());
  // 出題基準の1〜14番順（基準にない科目名は末尾に五十音順）
  const subjectOptions = useMemo(() => {
    const present = Array.from(new Set(questions.map((q) => q.subject)));
    const ordered = SUBJECT_TAG_NAMES.filter((s) => present.includes(s));
    const extra = present.filter((s) => !SUBJECT_TAG_NAMES.includes(s)).sort((a, b) => a.localeCompare(b, 'ja'));
    return [...ordered, ...extra];
  }, [questions]);
  const afterSubject = useMemo(
    () => (filterSubject ? questions.filter((q) => q.subject === filterSubject) : questions),
    [questions, filterSubject]
  );
  const genreOptions = useMemo(
    () =>
      Array.from(new Set(afterSubject.flatMap((q) => (q.genre ? [q.genre] : [])))).sort((a, b) =>
        a.localeCompare(b, 'ja')
      ),
    [afterSubject]
  );
  const afterGenre = useMemo(
    () => (filterGenre ? afterSubject.filter((q) => q.genre === filterGenre) : afterSubject),
    [afterSubject, filterGenre]
  );
  const keywordOptions = useMemo(() => {
    const all = [];
    afterGenre.forEach((q) => all.push(...effectiveTags(q, links)));
    return Array.from(new Set(all)).sort((a, b) => a.localeCompare(b, 'ja'));
  }, [afterGenre, links]);
  const keywordSections = useMemo(() => buildKanaIndex(keywordOptions), [keywordOptions]);
  const relatedMapAll = useMemo(() => relatedKeywordMap(questions, links), [questions, links]);
  const relatedForKeyword = useMemo(() => {
    if (!filterKeyword) return [];
    return (relatedMapAll.get(filterKeyword) || []).filter((k) => k !== filterKeyword).slice(0, 8);
  }, [filterKeyword, relatedMapAll]);
  const roundOptions = useMemo(
    () => Array.from(new Set(afterGenre.map((q) => roundKey(q.round)).filter((r) => r != null))).sort((a, b) => Number(b) - Number(a)),
    [afterGenre]
  );
  const pickPool = useMemo(() => {
    let pool = afterGenre;
    if (filterKeyword) {
      const kwSet = new Set([filterKeyword, ...relatedSelected]);
      pool = pool.filter((q) => effectiveTags(q, links).some((t) => kwSet.has(t)));
    }
    if (filterRound) pool = pool.filter((q) => isSameRound(q.round, filterRound));
    if (pickBookmarkOnly) pool = pool.filter((q) => bookmarks[q.id]);
    return pool;
  }, [afterGenre, filterKeyword, relatedSelected, links, filterRound, pickBookmarkOnly, bookmarks]);
  const applyFilter = (patch) => {
    if ('subject' in patch) {
      setFilterSubject(patch.subject);
      setFilterGenre('');
      setFilterKeyword('');
      setRelatedSelected(new Set());
    }
    if ('genre' in patch) {
      setFilterGenre(patch.genre);
      setFilterKeyword('');
      setRelatedSelected(new Set());
    }
    if ('keyword' in patch) {
      setFilterKeyword(patch.keyword);
      setRelatedSelected(new Set());
    }
  };
  const toggleRelated = (kw) => {
    setRelatedSelected((prev) => {
      const next = new Set(prev);
      if (next.has(kw)) next.delete(kw);
      else next.add(kw);
      return next;
    });
  };

  // #11・#16・#17：avoidIds（直近の模試で使った問題）を渡すと後回しにする。
  const avoidIdsFor = (usageModeId) =>
    avoidRepeat ? recentlyUsedIds(examUsageLogState, usageModeId, { withinCount: 3 }) : new Set();

  const startExam = () => {
    let picked = [];
    let sf = [];
    let minutes = 0;
    let isTimed = false;
    let usageModeId = modeId;
    if (modeId === 'am' || modeId === 'pm') {
      const blueprint = modeId === 'am' ? EXAM_BLUEPRINT_AM : EXAM_BLUEPRINT_PM;
      const built = buildBlueprintExam(blueprint, questions, { avoidIds: avoidIdsFor(modeId), srs });
      picked = built.order;
      sf = built.shortfalls;
      minutes = blueprint.minutes;
      isTimed = true;
    } else if (modeId === 'full') {
      // #21：午前+午後 通し。まず午前を組み立てて開始し、午後は午前終了後の休憩画面で組み立てる。
      const built = buildBlueprintExam(EXAM_BLUEPRINT_AM, questions, { avoidIds: avoidIdsFor('am'), srs });
      picked = built.order;
      sf = built.shortfalls;
      minutes = EXAM_BLUEPRINT_AM.minutes;
      isTimed = true;
      usageModeId = 'am';
      setFullPhase('am');
      setAmSnapshot(null);
      setPauseCount(0);
      setPausedMs(0);
    } else if (modeId === 'strong' || modeId === 'weak') {
      picked = preferUnused(shuffle(accuracyPool), avoidIdsFor(modeId)).slice(0, PRACTICE_COUNT);
    } else if (modeId === 'pick') {
      picked = preferUnused(shuffle(pickPool), avoidIdsFor(modeId)).slice(0, PRACTICE_COUNT);
    }
    if (!picked.length) return;
    setShortfalls(sf);
    setOrder(picked);
    setAnswers(new Array(picked.length).fill(null));
    setIdx(0);
    setTimed(isTimed);
    setRemain(isTimed ? minutes * 60 : 0);
    setPaused(false);
    setOverlapPct(overlapWithLast(examUsageLogState, usageModeId, picked.map((q) => q.id)));
    setStage('running');
    appendExamUsageLog(usageModeId, picked.map((q) => q.id)).then(setExamUsageLogState);
  };

  // #21：午前が終わった後、休憩をはさんで午後を組み立てて開始する。
  const startPmHalf = () => {
    const built = buildBlueprintExam(EXAM_BLUEPRINT_PM, questions, { avoidIds: avoidIdsFor('pm'), srs });
    setShortfalls((prev) => [...prev, ...built.shortfalls]);
    setOrder(built.order);
    setAnswers(new Array(built.order.length).fill(null));
    setIdx(0);
    setTimed(true);
    setRemain(EXAM_BLUEPRINT_PM.minutes * 60);
    setPaused(false);
    setFullPhase('pm');
    setStage('running');
    appendExamUsageLog('pm', built.order.map((q) => q.id)).then(setExamUsageLogState);
  };

  // 保存済みの途中経過を読み込む（続きから）
  useEffect(() => {
    if (stage !== 'select' || !questions.length) return;
    let alive = true;
    storage.loadExamProgress().then((p) => {
      if (!alive || !p || !Array.isArray(p.ids) || !p.ids.length) return;
      if (p.timed && (p.remain || 0) <= 0) return;
      const byId = new Map(questions.map((q) => [q.id, q]));
      const rebuilt = p.ids.map((id) => byId.get(id)).filter(Boolean);
      if (rebuilt.length !== p.ids.length) return; // 収録が変わっていたら復元しない
      setResume(p);
    });
    return () => { alive = false; };
  }, [questions, stage]);

  const doResume = () => {
    if (!resume) return;
    const byId = new Map(questions.map((q) => [q.id, q]));
    setOrder(resume.ids.map((id) => byId.get(id)));
    setAnswers(resume.answers || new Array(resume.ids.length).fill(null));
    setIdx(Math.min(resume.idx || 0, resume.ids.length - 1));
    setRemain(resume.remain || 0);
    setModeId(resume.modeId || null);
    setTimed(!!resume.timed);
    setPaused(false);
    // #21：午前+午後 通しモードの続きから（午前分のスナップショットも一緒に復元する）
    setFullPhase(resume.fullPhase || null);
    setAmSnapshot(resume.amSnapshot || null);
    setResume(null);
    setStage('running');
  };

  // 試験中は1問ごと（解答・移動ごと）に途中経過を保存
  useEffect(() => {
    if (stage !== 'running' || order.length === 0) return;
    storage.saveExamProgress({
      ids: order.map((q) => q.id),
      answers,
      idx,
      remain: remainRef.current,
      modeId,
      timed,
      presetLabel: MODE_BY_ID[modeId]?.label,
      fullPhase,
      amSnapshot,
      at: Date.now(),
    });
  }, [stage, idx, answers, order]); // eslint-disable-line react-hooks/exhaustive-deps

  // 試験をリセット（途中経過を破棄してモード選択へ戻す）
  const resetExam = () => {
    clearInterval(timerRef.current);
    storage.clearExamProgress();
    setResume(null);
    setOrder([]);
    setAnswers([]);
    setIdx(0);
    setRemain(0);
    setPaused(false);
    setFullPhase(null);
    setAmSnapshot(null);
    setStage('select');
  };

  // タイマー（時間制限モードのみ・一時停止中はカウントしない）
  useEffect(() => {
    if (stage !== 'running' || !timed || paused) return;
    timerRef.current = setInterval(() => {
      setRemain((r) => {
        if (r <= 1) {
          clearInterval(timerRef.current);
          finish();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, timed, paused]);
  // 問題が切り替わったら図の拡大表示は閉じる
  useEffect(() => { setZoom(false); }, [idx]);

  const selectAnswer = (choiceIdx) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = choiceIdx;
      return next;
    });
  };

  // #22：合格ライン2回連続の判定用に、今回の結果が追加される「前」のexamResultsを覚えておく
  // （addExamResultの効果でexamResultsが更新された後の再描画では、examResults[0]が今回自身に
  // なってしまい「前回」の判定が崩れるため、finish()の時点でスナップショットする）。
  const examResultsSnapshotRef = useRef([]);

  const finish = () => {
    clearInterval(timerRef.current);
    storage.clearExamProgress(); // 採点したら途中経過は破棄
    // 最後に表示していた問題の経過時間を確定してから、時間を使いすぎた問題ランキングを作る
    const now = Date.now();
    const prev = idxAtRef.current;
    if (prev && timeSpentRef.current[prev.idx] != null) {
      timeSpentRef.current[prev.idx] += (now - prev.at) / 1000;
    }
    const slow = timed ? rankSlowQuestions(order, timeSpentRef.current, 5) : [];
    // #21：午前+午後 通しモードで午前が終わった場合は、まだ採点せず休憩をはさむ。
    if (modeId === 'full' && fullPhase === 'am') {
      setAmSnapshot({ order, answers, slowQuestions: slow, pauseCount, pausedMs });
      setStage('break');
      return;
    }
    examResultsSnapshotRef.current = examResults || [];
    setSlowQuestions(slow);
    setStage('result');
  };

  // 結果ステージに入ったら履歴へ記録（1回だけ）
  // 未解答（skip）はSRS・復習リストを汚さないよう記録しない（採点上は別途、不正解として集計）。
  // #21：通しモード（full）は午前・午後を合算した180問ぶんを1回の結果として記録する。
  const combinedOrder = modeId === 'full' && amSnapshot ? [...amSnapshot.order, ...order] : order;
  const combinedAnswers = modeId === 'full' && amSnapshot ? [...amSnapshot.answers, ...answers] : answers;
  const combinedSlowQuestions =
    modeId === 'full' && amSnapshot ? [...amSnapshot.slowQuestions, ...slowQuestions].sort((a, b) => b.sec - a.sec).slice(0, 5) : slowQuestions;
  const recordedRef = useRef(false);
  useEffect(() => {
    if (stage === 'result' && !recordedRef.current) {
      recordedRef.current = true;
      let correctCount = 0;
      const perSubject = {};
      combinedOrder.forEach((q, i) => {
        const correct = combinedAnswers[i] === q.answer;
        if (correct) correctCount += 1;
        if (!perSubject[q.subject]) perSubject[q.subject] = { total: 0, correct: 0 };
        perSubject[q.subject].total += 1;
        if (correct) perSubject[q.subject].correct += 1;
        if (combinedAnswers[i] == null) return; // 未解答はSRS・復習に記録しない
        recordAnswer(q, correct);
      });
      const scorePct = combinedOrder.length > 0 ? Math.round((correctCount / combinedOrder.length) * 100) : 0;
      addExamResult?.({
        mode: modeId,
        modeLabel: MODE_BY_ID[modeId]?.label,
        count: combinedOrder.length,
        correct: correctCount,
        scorePct,
        passed: scorePct >= PASS_RATE * 100,
        perSubject,
      });
    }
    if (stage !== 'result') recordedRef.current = false;
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- モード選択 ----
  if (stage === 'select') {
    return (
      <div className="view">
        <h2 className="view-title">模擬試験</h2>
        <p className="view-desc">
          本番同形式の午前・午後演習のほか、得意・苦手を中心にした演習、条件を選んで出題する演習ができます。
        </p>

        {resume && (
          <button className="btn primary block lg" style={{ marginBottom: 12 }} onClick={doResume}>
            ▶ 前回の続きから（{MODE_BY_ID[resume.modeId]?.label || '模試'}・{(resume.idx || 0) + 1}/{resume.ids.length}問
            {resume.timed ? `・残り${fmtTime(resume.remain || 0)}` : ''}）
          </button>
        )}

        <div className="mode-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {MODES.map((m) => (
            <button
              key={m.id}
              className="card tap"
              style={{ textAlign: 'left', cursor: 'pointer', width: '100%' }}
              onClick={() => {
                setModeId(m.id);
                setFullPhase(null);
                setAmSnapshot(null);
                setStage('setup');
              }}
            >
              <div style={{ fontSize: 26 }}>{m.emoji}</div>
              <div style={{ fontWeight: 700, marginTop: 4 }}>{m.label}</div>
              <div className="inline-note" style={{ marginTop: 4 }}>{m.desc}</div>
            </button>
          ))}
        </div>

        {/* #30：前回の模試（本番同形式）からの経過日数 */}
        {(() => {
          const lastFormal = (examResults || []).find((r) => !r.mode || r.mode === 'am' || r.mode === 'pm' || r.mode === 'full');
          if (!lastFormal) return null;
          return (
            <p className="inline-note" style={{ marginTop: 10 }}>
              前回の模試（{lastFormal.modeLabel || '演習'}）から
              {Math.max(0, Math.floor((Date.now() - lastFormal.at) / 86400000))}日
            </p>
          );
        })()}

        {examResults && examResults.length > 0 && <ExamHistory results={examResults} passLine={PASS_RATE} />}
      </div>
    );
  }

  // ---- セットアップ：午前／午後（本番同形式） ----
  if (stage === 'setup' && (modeId === 'am' || modeId === 'pm')) {
    const blueprint = modeId === 'am' ? EXAM_BLUEPRINT_AM : EXAM_BLUEPRINT_PM;
    const avail = blueprintAvailability(blueprint, questions);
    const shortfallSlots = avail.filter((a) => !a.sufficient);
    // #12・#13：あと何回ぶん、使い回しなしで模試を組めるか（少ないほど直前期に問題が枯渇するリスク）
    const lowRoundsSlots = avail.filter((a) => a.roundsPossible < 2);
    return (
      <div className="view">
        <button className="btn ghost sm" onClick={() => setStage('select')}>← モードを選び直す</button>
        <h2 className="view-title">{blueprint.label}問題（{blueprint.totalCount}問）</h2>
        <p className="view-desc">
          本番同形式の科目配分で出題します。総合問題は連問形式（1つの事例に2〜3問）で最後にまとめて出題されます。
        </p>
        {/* #14・#18：未出題優先トグル（直前期は常にON） */}
        <label className="autokw-row card" style={{ marginBottom: 10 }}>
          <input
            type="checkbox"
            checked={avoidRepeat}
            disabled={isChokuzenPhase}
            onChange={(e) => setAvoidRepeatChoice(e.target.checked)}
          />
          <span>
            🔁 直近使った問題を避けて出題する（使い回し対策）
            {isChokuzenPhase && <span className="inline-note">　直前期のため常にONです</span>}
          </span>
        </label>
        {lowRoundsSlots.length > 0 && (
          <p className="inline-note" style={{ color: 'var(--warn, #b06a00)' }}>
            ⚠ {lowRoundsSlots.map((a) => `${a.note}（あと${a.roundsPossible}回ぶん）`).join('・')}
            は収録数が少なく、使い回しなしで組める模試の回数が限られています。
            {onNavigate && (
              <>　<button className="btn ghost sm" onClick={() => onNavigate('coverage')}>網羅マップで確認する</button></>
            )}
          </p>
        )}
        <div className="card">
          <div className="section-label" style={{ marginTop: 0 }}>科目別の出題数</div>
          {avail.map((a) => (
            <div className="stat-row" key={a.subject}>
              <div className="stat-head">
                <span className="stat-subject">{a.note}</span>
                <span className="stat-pct">
                  {a.requested}問
                  {!a.sufficient && (
                    <span className="inline-note"> （収録{a.available + (a.fallbackAvailable || 0)}問で代替）</span>
                  )}
                </span>
              </div>
            </div>
          ))}
          <div className="tiles" style={{ marginTop: 10 }}>
            <div className="tile">
              <div className="num">{blueprint.totalCount}</div>
              <div className="lbl">問題数</div>
            </div>
            <div className="tile">
              <div className="num">{blueprint.minutes}</div>
              <div className="lbl">制限時間（分）</div>
            </div>
            <div className="tile">
              <div className="num">60%</div>
              <div className="lbl">合格ライン</div>
            </div>
          </div>
          {shortfallSlots.length > 0 && (
            <p className="inline-note">
              ※ {shortfallSlots.map((s) => s.note).join('・')}
              は収録数がまだ既定に届かないため、収録分＋関連科目の問題で代替します。総合問題は過去問を追加いただき次第、実例に切り替わります。
            </p>
          )}
          <button className="btn primary block lg" style={{ marginTop: 10 }} onClick={startExam}>
            試験を開始する
          </button>
        </div>
      </div>
    );
  }

  // ---- セットアップ：午前+午後 通し（#21） ----
  if (stage === 'setup' && modeId === 'full') {
    const availAm = blueprintAvailability(EXAM_BLUEPRINT_AM, questions);
    const availPm = blueprintAvailability(EXAM_BLUEPRINT_PM, questions);
    const shortfallSlots = [...availAm, ...availPm].filter((a) => !a.sufficient);
    const lowRoundsSlots = [...availAm, ...availPm].filter((a) => a.roundsPossible < 2);
    return (
      <div className="view">
        <button className="btn ghost sm" onClick={() => setStage('select')}>← モードを選び直す</button>
        <h2 className="view-title">午前+午後 通し（180問）</h2>
        <p className="view-desc">
          本番同様に午前90問→休憩→午後90問を通しで行います。午前が終わると休憩画面をはさみ、
          結果は180問分をまとめて表示します。
        </p>
        <label className="autokw-row card" style={{ marginBottom: 10 }}>
          <input
            type="checkbox"
            checked={avoidRepeat}
            disabled={isChokuzenPhase}
            onChange={(e) => setAvoidRepeatChoice(e.target.checked)}
          />
          <span>
            🔁 直近使った問題を避けて出題する（使い回し対策）
            {isChokuzenPhase && <span className="inline-note">　直前期のため常にONです</span>}
          </span>
        </label>
        {lowRoundsSlots.length > 0 && (
          <p className="inline-note" style={{ color: 'var(--warn, #b06a00)' }}>
            ⚠ {lowRoundsSlots.map((a) => `${a.note}（あと${a.roundsPossible}回ぶん）`).join('・')}
            は収録数が少なく、使い回しなしで組める模試の回数が限られています。
            {onNavigate && (
              <>　<button className="btn ghost sm" onClick={() => onNavigate('coverage')}>網羅マップで確認する</button></>
            )}
          </p>
        )}
        <div className="card">
          <div className="tiles" style={{ marginTop: 0 }}>
            <div className="tile">
              <div className="num">180</div>
              <div className="lbl">問題数</div>
            </div>
            <div className="tile">
              <div className="num">{EXAM_BLUEPRINT_AM.minutes + EXAM_BLUEPRINT_PM.minutes}</div>
              <div className="lbl">制限時間（分・合計）</div>
            </div>
            <div className="tile">
              <div className="num">60%</div>
              <div className="lbl">合格ライン</div>
            </div>
          </div>
          {shortfallSlots.length > 0 && (
            <p className="inline-note">
              ※ {shortfallSlots.map((s) => s.note).join('・')}
              は収録数がまだ既定に届かないため、収録分＋関連科目の問題で代替します。
            </p>
          )}
          <button className="btn primary block lg" style={{ marginTop: 10 }} onClick={startExam}>
            午前90問から開始する
          </button>
        </div>
      </div>
    );
  }

  // ---- セットアップ：得意／苦手 ----
  if (stage === 'setup' && (modeId === 'strong' || modeId === 'weak')) {
    const label = MODE_BY_ID[modeId].label;
    const noSuggestion = suggestedGenres.length === 0 && suggestedKeywords.length === 0;
    return (
      <div className="view">
        <button className="btn ghost sm" onClick={() => setStage('select')}>← モードを選び直す</button>
        <h2 className="view-title">{label}（最大{PRACTICE_COUNT}問）</h2>
        <p className="view-desc">
          解答実績からアプリが自動提案したジャンル・キーワードを中心に出題します。チップを外すと対象から除外できます（正答率は解答するたびに更新されます）。
        </p>
        {noSuggestion ? (
          <div className="empty">
            <div className="ico">📊</div>
            <p>解答実績がまだ少ないため自動提案できません。クイズや音声学習で何問か解いてから、もう一度お試しください。</p>
          </div>
        ) : (
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>{label}そうなジャンル</div>
            <div className="chip-row">
              {suggestedGenres.map((g) => (
                <button
                  key={g.genre}
                  className={`chip ${selectedChips.has(`genre:${g.genre}`) ? 'active' : ''}`}
                  onClick={() => toggleChip(`genre:${g.genre}`)}
                >
                  {g.genre}（{g.accuracy == null ? '未回答' : `${Math.round(g.accuracy * 100)}%`}）
                </button>
              ))}
            </div>
            <div className="section-label">{label}そうなキーワード</div>
            <div className="chip-row">
              {suggestedKeywords.map((k) => (
                <button
                  key={k.keyword}
                  className={`chip ${selectedChips.has(`kw:${k.keyword}`) ? 'active' : ''}`}
                  onClick={() => toggleChip(`kw:${k.keyword}`)}
                >
                  {k.keyword}（{k.accuracy == null ? '未回答' : `${Math.round(k.accuracy * 100)}%`}）
                </button>
              ))}
            </div>
            <div className="tiles" style={{ marginTop: 10 }}>
              <div className="tile">
                <div className="num">{Math.min(PRACTICE_COUNT, accuracyPool.length)}</div>
                <div className="lbl">出題数</div>
              </div>
            </div>
            {accuracyPool.length === 0 && <p className="inline-note">チップを1つ以上選んでください。</p>}
            <button
              className="btn primary block lg"
              style={{ marginTop: 10 }}
              onClick={startExam}
              disabled={accuracyPool.length === 0}
            >
              試験を開始する
            </button>
          </div>
        )}
      </div>
    );
  }

  // ---- セットアップ：選択式 ----
  if (stage === 'setup' && modeId === 'pick') {
    return (
      <div className="view">
        <button className="btn ghost sm" onClick={() => setStage('select')}>← モードを選び直す</button>
        <h2 className="view-title">選択式（最大{PRACTICE_COUNT}問）</h2>
        <p className="view-desc">
          科目・ジャンル・キーワードで絞り込んで出題します。キーワードを選ぶと関連キーワードも芋づる式に追加できます。
        </p>
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
              <select
                value={filterGenre}
                onChange={(e) => applyFilter({ genre: e.target.value })}
                disabled={!genreOptions.length}
              >
                <option value="">指定なし</option>
                {genreOptions.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>
            <label className="mini-field">
              <span>キーワード</span>
              <select
                value={filterKeyword}
                onChange={(e) => applyFilter({ keyword: e.target.value })}
                disabled={!keywordOptions.length}
              >
                <option value="">指定なし</option>
                {keywordSections.map((sec) => (
                  <optgroup key={sec.label} label={`- ${sec.label} -`}>
                    {sec.items.map((k) => (<option key={k} value={k}>{k}</option>))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="mini-field">
              <span>回（第◯回）</span>
              <select
                value={filterRound}
                onChange={(e) => setFilterRound(e.target.value)}
                disabled={!roundOptions.length}
              >
                <option value="">指定なし</option>
                {roundOptions.map((r) => (
                  <option key={r} value={r}>{formatRound(r)}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="autokw-row" style={{ marginTop: 8 }}>
            <input
              type="checkbox"
              checked={pickBookmarkOnly}
              onChange={(e) => setPickBookmarkOnly(e.target.checked)}
            />
            <span>★ ブックマークした問題だけ出題</span>
          </label>
          {relatedForKeyword.length > 0 && (
            <>
              <div className="section-label">関連キーワード（芋づる式に追加できます）</div>
              <div className="chip-row">
                {relatedForKeyword.map((k) => (
                  <button
                    key={k}
                    className={`chip ${relatedSelected.has(k) ? 'active' : ''}`}
                    onClick={() => toggleRelated(k)}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="tiles" style={{ marginTop: 10 }}>
            <div className="tile">
              <div className="num">{Math.min(PRACTICE_COUNT, pickPool.length)}</div>
              <div className="lbl">出題数</div>
            </div>
          </div>
          {pickPool.length === 0 && <p className="inline-note">条件に一致する問題がありません。条件を変えてください。</p>}
          <button
            className="btn primary block lg"
            style={{ marginTop: 10 }}
            onClick={startExam}
            disabled={pickPool.length === 0}
          >
            試験を開始する
          </button>
        </div>
      </div>
    );
  }

  // ---- 休憩（#21：午前+午後 通しモードの、午前終了後〜午後開始前） ----
  if (stage === 'break') {
    const pmAvail = blueprintAvailability(EXAM_BLUEPRINT_PM, questions);
    const pmShortfalls = pmAvail.filter((a) => !a.sufficient);
    const amCorrect = amSnapshot
      ? amSnapshot.order.reduce((acc, q, i) => acc + (amSnapshot.answers[i] === q.answer ? 1 : 0), 0)
      : 0;
    return (
      <div className="view">
        <h2 className="view-title">🍵 休憩</h2>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>午前90問、お疲れさまでした</div>
          <p className="inline-note" style={{ marginTop: 6 }}>
            午前の途中経過：{amSnapshot?.order.length || 0}問中 {amCorrect}問正解
            （結果は午後も終えてから、180問分をまとめて表示します）
          </p>
          <p className="inline-note">
            本番でも午前と午後の間に休憩があります。数分席を立ってから、準備ができたら午後を開始してください。
          </p>
        </div>
        {pmShortfalls.length > 0 && (
          <p className="inline-note">
            ※ {pmShortfalls.map((s) => s.note).join('・')} は収録数がまだ既定に届かないため、収録分＋関連科目の問題で代替します。
          </p>
        )}
        <button className="btn primary block lg" style={{ marginTop: 10 }} onClick={startPmHalf}>
          午後90問を開始する
        </button>
        <ResetInline label="模試をリセット（採点せず破棄）" onReset={resetExam} />
      </div>
    );
  }

  // ---- 結果 ----
  if (stage === 'result') {
    const correctCount = combinedOrder.reduce(
      (acc, q, i) => acc + (combinedAnswers[i] === q.answer ? 1 : 0),
      0
    );
    const rate = combinedOrder.length > 0 ? correctCount / combinedOrder.length : 0;
    const passed = rate >= PASS_RATE;
    const showPassLine = modeId === 'am' || modeId === 'pm' || modeId === 'full';
    const blueprintForScore = modeId === 'am' ? EXAM_BLUEPRINT_AM : modeId === 'pm' ? EXAM_BLUEPRINT_PM : null;
    const halfSplit = halfSplitAccuracy(combinedOrder, combinedAnswers);
    // 科目別の内訳
    const perSubject = {};
    combinedOrder.forEach((q, i) => {
      if (!perSubject[q.subject]) perSubject[q.subject] = { total: 0, correct: 0 };
      perSubject[q.subject].total += 1;
      if (combinedAnswers[i] === q.answer) perSubject[q.subject].correct += 1;
    });
    // #6・#25：出題数の重み×失点率で「伸ばすと効く科目」を出す（午前／午後のみ、配分が分かっているため）
    const contribution = blueprintForScore ? scoreContribution(perSubject, blueprintForScore) : [];
    const shortOfPass = showPassLine && !passed ? pointsShortOfPassLine(correctCount, combinedOrder.length, PASS_RATE) : 0;
    // #22：合格ライン到達が2回連続しているか（午前・午後のみが対象。CLAUDE.mdのゴール判定と同じ定義）
    const passLineHistory = examResultsSnapshotRef.current.filter((r) => !r.mode || r.mode === 'am' || r.mode === 'pm' || r.mode === 'full');
    const streakOk = showPassLine && passed && passLineHistory.length >= 1 && passLineHistory[0]?.passed;
    // ジャンル別の内訳（科目よりさらに細かい。genreBreakdown.jsが単一の正）
    const genreRows = buildGenreBreakdown(
      combinedOrder.map((q, i) => ({ genre: q.genre || q.subject, correct: combinedAnswers[i] === q.answer }))
    );
    // 誤答・未解答の一覧
    const wrongEntries = combinedOrder
      .map((q, i) => ({ q, chosen: combinedAnswers[i] }))
      .filter((e) => e.chosen !== e.q.answer);
    const wrongQs = wrongEntries.map((e) => e.q);
    const weakness = wrongQs.length > 0 ? buildWeaknessSummary(wrongQs, links) : null;
    const retryWrong = () => {
      if (wrongQs.length === 0) return;
      setFullPhase(null);
      setAmSnapshot(null);
      setShortfalls([]);
      setOrder(wrongQs);
      setAnswers(new Array(wrongQs.length).fill(null));
      setIdx(0);
      setTimed(false);
      setRemain(0);
      setPaused(false);
      setStage('running');
    };
    // #26：苦手だった科目だけをもう一度（正答率下位の科目）
    const retrySubject = (subjectName) => {
      const pool = combinedOrder.filter((q) => q.subject === subjectName);
      if (pool.length === 0) return;
      setFullPhase(null);
      setAmSnapshot(null);
      setShortfalls([]);
      setOrder(shuffle(pool));
      setAnswers(new Array(pool.length).fill(null));
      setIdx(0);
      setTimed(false);
      setRemain(0);
      setPaused(false);
      setStage('running');
    };
    const weakSubjects = Object.entries(perSubject)
      .filter(([, v]) => v.total >= 3 && v.correct / v.total < 0.6)
      .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
      .slice(0, 3);

    return (
      <div className="view">
        <h2 className="view-title">{MODE_BY_ID[modeId]?.label || '演習'}の結果</h2>

        <div className={`result-hero ${passed ? 'pass' : 'fail'}`}>
          {showPassLine && <div className="verdict">{passed ? '合格ライン到達' : '合格ライン未満'}</div>}
          <div className="score">
            {Math.round(rate * 100)}
            <small>%</small>
          </div>
          <div className="sub">
            {combinedOrder.length}問中 {correctCount}問正解 ／ {combinedOrder.length - correctCount}問不正解
            {showPassLine && `　合格ライン ${Math.round(PASS_RATE * 100)}%`}
          </div>
          {!showPassLine && (
            <div className="inline-note" style={{ marginTop: 4 }}>
              （参考：合格ラインは{Math.round(PASS_RATE * 100)}%。このモードは配分が本番と異なるため合否判定の対象外です＝#29）
            </div>
          )}
        </div>

        {showPassLine && !passed && shortOfPass > 0 && (
          <p className="inline-note">
            あと{shortOfPass}問正解していれば合格ラインでした。
          </p>
        )}
        {streakOk && (
          <p className="inline-note" style={{ color: 'var(--correct)' }}>
            🎉 2回連続で合格ラインに到達しました。CLAUDE.mdのゴール（合格ライン2回連続）に届いています。
          </p>
        )}

        {overlapPct != null && (
          <p className="inline-note">
            前回の同モードとの問題の重複率：{overlapPct}%{avoidRepeat ? '（未出題優先）' : ''}
          </p>
        )}
        {(pauseCount > 0 || (amSnapshot?.pauseCount || 0) > 0) && (
          <p className="inline-note">
            一時停止：{pauseCount + (amSnapshot?.pauseCount || 0)}回・合計{Math.round((pausedMs + (amSnapshot?.pausedMs || 0)) / 1000)}秒
            （本番相当の集中力で解けたかの目安＝#28）
          </p>
        )}

        {shortfalls.length > 0 && (
          <p className="inline-note">
            ※ {shortfalls.map((s) => s.note).join('・')} は収録不足のため一部を関連科目で代替しました。
          </p>
        )}

        {contribution.length > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 0 }}>📉 伸ばすと効く科目（出題数の重み×失点率）</div>
            <div className="card">
              <p className="inline-note" style={{ margin: '0 0 8px' }}>
                出題数が多く、かつ間違いが多い科目ほど全体スコアへの影響が大きくなります（配点そのものは未確認のため、あくまで出題数の重みでの目安＝#6）。
              </p>
              {contribution.slice(0, 5).map((r, i) => (
                <div className="stat-row" key={r.subject}>
                  <div className="stat-head">
                    <span className="stat-subject">{i + 1}. {r.note}</span>
                    <span className="stat-pct">正答率{Math.round(r.accuracy * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {combinedSlowQuestions.length > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 0 }}>⏱ 時間を使いすぎた問題</div>
            <div className="card">
              <p className="inline-note" style={{ margin: '0 0 8px' }}>
                本番はここで足が止まりやすいポイントです。分からない問題は一旦飛ばす練習をしましょう。
              </p>
              {combinedSlowQuestions.map((r, i) => {
                const g = genreOf(r.q);
                const dk = g ? daikoumoku(g) : null;
                const rank = dk ? daikoumokuRank(questions)[`${r.q.subject}|${dk}`] : null;
                return (
                  <div className="stat-row" key={r.q.id}>
                    <div className="stat-head">
                      <span className="stat-subject">
                        {i + 1}. {r.q.subject}
                        {rank && <span className="inline-note"> （頻出度{rank}）</span>}
                      </span>
                      <span className="stat-pct">{Math.round(r.sec)}秒</span>
                    </div>
                    <p className="inline-note" style={{ margin: '2px 0 0' }}>{r.q.question}</p>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {halfSplit && combinedOrder.length >= 4 && (
          <>
            <div className="section-label" style={{ marginTop: 0 }}>🔋 前半・後半の正答率</div>
            <div className="card">
              <div className="tiles">
                <div className="tile">
                  <div className="num">{halfSplit.first.accuracy != null ? Math.round(halfSplit.first.accuracy * 100) : '—'}<span style={{ fontSize: 14 }}>%</span></div>
                  <div className="lbl">前半（{halfSplit.first.total}問）</div>
                </div>
                <div className="tile">
                  <div className="num">{halfSplit.second.accuracy != null ? Math.round(halfSplit.second.accuracy * 100) : '—'}<span style={{ fontSize: 14 }}>%</span></div>
                  <div className="lbl">後半（{halfSplit.second.total}問）</div>
                </div>
              </div>
              <p className="inline-note" style={{ marginTop: 8 }}>
                {halfSplit.dropPt == null
                  ? '前半・後半どちらも解答が必要です。'
                  : halfSplit.dropPt >= 10
                  ? `後半で正答率が${halfSplit.dropPt}ポイント下がっています。集中力が切れやすいタイミングかもしれません。`
                  : halfSplit.dropPt <= -10
                  ? `後半の方が正答率が${Math.abs(halfSplit.dropPt)}ポイント高くなっています。ペースが掴めてきたようです。`
                  : '前半・後半で大きな差はなく、集中力を保てています。'}
              </p>
            </div>
          </>
        )}

        <div className="section-label" style={{ marginTop: 0 }}>
          科目別の内訳
        </div>
        {Object.entries(perSubject).map(([s, v]) => {
          const acc = v.correct / v.total;
          const cls = acc >= 0.7 ? 'bar-good' : acc >= 0.5 ? 'bar-mid' : 'bar-bad';
          return (
            <div className="stat-row" key={s}>
              <div className="stat-head">
                <span className="stat-subject">{s}</span>
                <span className="stat-pct">
                  {Math.round(acc * 100)}%
                  <span className="stat-sub"> （{v.correct}/{v.total}）</span>
                </span>
              </div>
              <div className={`bar ${cls}`}>
                <span style={{ width: `${acc * 100}%` }} />
              </div>
            </div>
          );
        })}

        {/* #26：苦手だった科目だけをもう一度 */}
        {weakSubjects.length > 0 && (
          <div className="chip-row" style={{ marginTop: 8 }}>
            {weakSubjects.map(([s, v]) => (
              <button key={s} className="chip" onClick={() => retrySubject(s)}>
                🔁 {s}だけもう一度（{Math.round((v.correct / v.total) * 100)}%）
              </button>
            ))}
          </div>
        )}

        <p className="inline-note" style={{ marginTop: 10 }}>
          不正解・未解答の問題は復習リストへ自動的に追加されました。
        </p>

        <button
          className="btn primary block lg"
          style={{ marginTop: 16 }}
          onClick={() => {
            setFullPhase(null);
            setAmSnapshot(null);
            setStage('setup');
          }}
        >
          もう一度挑戦する
        </button>
        {wrongQs.length > 0 && (
          <button className="btn accent block lg" style={{ marginTop: 10 }} onClick={retryWrong}>
            ✕ 誤答・未解答の{wrongQs.length}問だけ、もう一度
          </button>
        )}
        <button
          className="btn ghost block sm"
          style={{ marginTop: 8 }}
          onClick={() => setStage('select')}
        >
          他のモードを選ぶ
        </button>
        {onNavigate && wrongQs.length > 0 && (
          <button className="btn ghost block sm" style={{ marginTop: 8 }} onClick={() => onNavigate('mistakes')}>
            📓 間違いノートを開く
          </button>
        )}

        {/* ジャンル別の内訳（苦手順） */}
        {genreRows.length > 1 && (
          <div className="card" style={{ marginTop: 14 }}>
            <div className="section-label" style={{ marginTop: 0 }}>ジャンル別の内訳（苦手順）</div>
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

        {/* 弱点分析 */}
        {weakness && (
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>今回の弱点分析</div>
            <p className="inline-note" style={{ marginTop: 0 }}>
              {weakness.topGenres.length > 0 && (
                <>「{weakness.topGenres.map(([g, c]) => `${g}（${c}問）`).join('」「')}」で誤答が目立ちました。</>
              )}
              {weakness.topTags.length > 0 && (
                <><br />繰り返しつまずいたキーワード：{weakness.topTags.map(([tg, c]) => `${tg}（×${c}）`).join('・')}</>
              )}
            </p>
          </div>
        )}

        {/* 誤答・未解答の一覧（問題文・正解・解説） */}
        {wrongEntries.length > 0 && (
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>誤答・未解答（{wrongEntries.length}問）</div>
            {wrongEntries.map(({ q, chosen }) => (
              <div className="list-item" key={q.id}>
                <div className="li-subject">{q.subject}{isLeech(srs[q.id]) && <span className="risk-badge lv-hot" title={`${LEECH_THRESHOLD}回以上間違えています`}>⚠️ 要注意</span>}</div>
                <div className="li-q">{q.question || '（図の問題）'}</div>
                <div className="li-stat" style={{ color: 'var(--wrong)' }}>
                  あなたの解答：{chosen == null ? '未解答' : (q.type === 'ox' ? (chosen === 0 ? '○' : '✕') : `${chosen + 1}. ${q.choices[chosen]}`)}
                </div>
                <div className="li-stat" style={{ color: 'var(--correct)' }}>
                  正解：{q.type === 'ox' ? (q.answer === 0 ? '○' : '✕') : `${q.answer + 1}. ${q.choices[q.answer]}`}
                </div>
                {q.explanation && <div className="li-stat">解説：{q.explanation}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---- 試験中 ----
  const current = order[idx];
  const answered = answers.filter((a) => a !== null).length;
  const timeWarn = timed && remain <= 60;
  const CurFig = current.figure ? figureFor(current.figure) : null;
  // 総合問題（連問）のセクション区切り
  const isIntegrated = current.subject === '総合問題';
  const prevQ = idx > 0 ? order[idx - 1] : null;
  const enteringIntegrated = isIntegrated && (!prevQ || prevQ.subject !== '総合問題');
  let caseProgress = null;
  if (isIntegrated) {
    const cid = current.caseId || current.id;
    let start = idx;
    while (start > 0 && order[start - 1].subject === '総合問題' && (order[start - 1].caseId || order[start - 1].id) === cid) start--;
    let end = idx;
    while (end < order.length - 1 && order[end + 1].subject === '総合問題' && (order[end + 1].caseId || order[end + 1].id) === cid) end++;
    caseProgress = { pos: idx - start + 1, total: end - start + 1 };
  }

  return (
    <div className="view">
      <div className="exam-timer">
        {timed ? (
          <span className={`time ${timeWarn ? 'warn' : ''}`}>⏱ {paused ? '一時停止中' : fmtTime(remain)}</span>
        ) : (
          <span className="time">📝 演習モード（時間無制限）</span>
        )}
        <span className="count">
          解答済み {answered} / {order.length}
        </span>
        {timed && (
          <button className="btn ghost sm" onClick={togglePause}>
            {paused ? '▶ 再開' : '⏸ 一時停止'}
          </button>
        )}
      </div>
      <div className="progress">
        <span style={{ width: `${((idx + 1) / order.length) * 100}%` }} />
      </div>
      {paceInfo && (
        <div className={`inline-note ${paceInfo.behind ? 'exam-pace-warn' : ''}`} style={{ margin: '4px 0 8px' }}>
          ⏱ 目安：今ごろ{paceInfo.expectedIdx}問目くらい（今 {idx + 1}問目）・1問あたり約{paceInfo.secPerQuestion}秒
          {paceInfo.behind && '　ペースが遅れています。わからない問題は後回しに'}
        </div>
      )}

      {paused ? (
        <div className="empty">
          <div className="ico">⏸</div>
          <p>一時停止中です。再開するとタイマーが動き出します。</p>
        </div>
      ) : (
      <>
      {enteringIntegrated && (
        <div className="card" style={{ background: 'var(--accent-soft, #eef4ff)', textAlign: 'center' }}>
          <div style={{ fontWeight: 700 }}>🧩 ここから総合問題（連問）です</div>
          <p className="inline-note" style={{ margin: '4px 0 0' }}>
            同じ症例文をもとにした複数の設問が続きます。
          </p>
        </div>
      )}
      <div className="card">
        <div className="q-meta">
          <span className={`badge ${current.type === 'ox' ? 'ox' : 'choice'}`}>
            {current.type === 'ox' ? '○×' : '四択'}
          </span>
          <span className="q-subject">
            第{idx + 1}問 ・ {current.subject}
            {isIntegrated && caseProgress && ` （設問 ${caseProgress.pos}/${caseProgress.total}）`}
          </span>
        </div>
        <div className="q-text">{current.question}</div>
        {current.image && (
          <button className="q-figbtn" onClick={() => setZoom(true)} aria-label="図を拡大">
            <img className="q-image" src={current.image} alt="問題の図" loading="lazy" />
            <span className="q-zoom-hint">🔍 タップで拡大</span>
          </button>
        )}
        {CurFig && (
          <button className="q-figbtn" onClick={() => setZoom(true)} aria-label="図を拡大">
            <CurFig />
            <span className="q-zoom-hint">🔍 タップで拡大</span>
          </button>
        )}
        {zoom && (current.image || CurFig) && (
          <div className="fig-lightbox" onClick={() => setZoom(false)} role="dialog" aria-label="図の拡大">
            <div className="fig-lightbox-inner" onClick={(e) => e.stopPropagation()}>
              {current.image ? <img src={current.image} alt="問題の図（拡大）" /> : <CurFig />}
              <button className="btn primary block" onClick={() => setZoom(false)}>閉じる</button>
            </div>
          </div>
        )}
        <div className="choices">
          {current.choices.map((choice, i) => {
            const mark =
              current.type === 'ox'
                ? i === 0
                  ? '○'
                  : '×'
                : String.fromCharCode(0x2460 + i);
            return (
              <button
                key={i}
                className={`choice-btn ${answers[idx] === i ? 'selected' : ''}`}
                onClick={() => selectAnswer(i)}
              >
                <span className="mark">{mark}</span>
                <span>{choice}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="btn-row">
        <button className="btn" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>
          ← 前へ
        </button>
        {idx < order.length - 1 ? (
          <button className="btn primary" onClick={() => setIdx(idx + 1)}>
            次へ →
          </button>
        ) : (
          <button className="btn accent" onClick={finish}>
            採点する
          </button>
        )}
      </div>

      <button
        className="btn ghost block sm"
        style={{ marginTop: 10 }}
        onClick={() => {
          if (confirm('試験を終了して採点しますか？（未解答は誤答扱い）')) finish();
        }}
      >
        途中で終了して採点
      </button>

      <ResetInline label="模試をリセット（採点せず破棄）" onReset={resetExam} />
      </>
      )}
    </div>
  );
}

// 直近の模試スコアから合否を予測する
//  results は新しい→古い順。直近3回（無ければある分）の平均で判定し、傾向も見る。
function predictExam(results, passLine) {
  if (!results.length) return null;
  const passPct = Math.round(passLine * 100);
  const recent = results.slice(0, 3).map((r) => r.scorePct);
  const recentAvg = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
  // 傾向：直近と、その前の同数の平均を比べる
  const prev = results.slice(3, 6).map((r) => r.scorePct);
  const prevAvg = prev.length ? Math.round(prev.reduce((a, b) => a + b, 0) / prev.length) : null;
  const delta = prevAvg == null ? null : recentAvg - prevAvg;
  const gap = recentAvg - passPct; // 正なら合格ラインを上回る
  let zone, emoji, msg;
  if (gap >= 8) {
    zone = '合格圏';
    emoji = '🎉';
    msg = `直近平均は合格ライン+${gap}ポイント。この調子を維持しましょう。`;
  } else if (gap >= 0) {
    zone = 'ボーダー（合格圏内・僅差）';
    emoji = '🟢';
    msg = `合格ラインをわずかに上回っています（+${gap}ポイント）。取りこぼしを減らして余裕を作りましょう。`;
  } else if (gap >= -8) {
    zone = 'ボーダー（あと少し）';
    emoji = '🟡';
    msg = `合格ラインまであと${-gap}ポイント。弱点科目を重点復習すれば十分届きます。`;
  } else {
    zone = '要強化';
    emoji = '🔴';
    msg = `合格ラインまであと${-gap}ポイント。範囲のカバーと間違い直しを優先しましょう。`;
  }
  return { passPct, recentAvg, recentN: recent.length, delta, zone, emoji, msg };
}

// 模試の結果履歴と、合格ライン到達の推移グラフ＋合否予測
// 対象は午前／午後／午前+午後通し（本番同形式）の結果のみ（得意・苦手・選択式は合格ラインの対象外のため除く）。
function ExamHistory({ results, passLine }) {
  const scoped = results.filter((r) => !r.mode || r.mode === 'am' || r.mode === 'pm' || r.mode === 'full');
  if (scoped.length === 0) return null;
  // 古い→新しい（左→右）に並べ、直近20件
  const items = [...scoped].slice(0, 20).reverse();
  const passCount = scoped.filter((r) => r.passed).length;
  const best = Math.max(...scoped.map((r) => r.scorePct));
  const passPct = Math.round(passLine * 100);
  const pred = predictExam(scoped, passLine);
  return (
    <div style={{ marginTop: 18 }}>
      <div className="section-label" style={{ marginTop: 0 }}>午前・午後の記録（{scoped.length}回）</div>

      {pred && (
        <div className="card exam-predict">
          <div className="exam-predict-head">
            <span className="exam-predict-emoji">{pred.emoji}</span>
            <div>
              <div className="exam-predict-zone">合否予測：{pred.zone}</div>
              <div className="exam-predict-avg">
                直近{pred.recentN}回の平均 <strong>{pred.recentAvg}%</strong>
                （合格ライン {pred.passPct}%）
                {pred.delta != null && (
                  <span className={`exam-predict-delta ${pred.delta >= 0 ? 'up' : 'down'}`}>
                    {pred.delta >= 0 ? `▲ +${pred.delta}` : `▼ ${pred.delta}`}pt
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="exam-predict-gauge">
            <span className="epg-fill" style={{ width: `${Math.min(100, pred.recentAvg)}%` }} />
            <span className="epg-line" style={{ left: `${pred.passPct}%` }} title={`合格ライン ${pred.passPct}%`} />
          </div>
          <div className="inline-note">{pred.msg}</div>
          <div className="inline-note">※直近の模試スコアからの目安です。合格基準は年度により変動します。</div>
        </div>
      )}

      <div className="tiles">
        <div className="tile">
          <div className="num">{scoped.length}</div>
          <div className="lbl">受験回数</div>
        </div>
        <div className="tile">
          <div className="num" style={{ color: 'var(--correct)' }}>{passCount}</div>
          <div className="lbl">合格ライン到達</div>
        </div>
        <div className="tile">
          <div className="num">{best}%</div>
          <div className="lbl">ベストスコア</div>
        </div>
      </div>
      <div className="card">
        <div className="exam-chart">
          {items.map((r, i) => {
            // #27：その回答時点のロードマップフェーズ（直前期に入ってから受けたものかが分かるように）
            const d = new Date(r.at);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const ph = phaseForDate(dateStr);
            return (
              <div
                className="exam-chart-col"
                key={r.id || i}
                title={`${d.toLocaleDateString('ja-JP')}：${r.scorePct}%${ph ? `（${ph.label}）` : ''}`}
              >
                <div className={`exam-chart-bar ${r.passed ? 'pass' : 'fail'}`} style={{ height: `${Math.max(4, r.scorePct)}%` }} />
                <span className="exam-chart-lbl">{r.scorePct}</span>
                {ph && <span className="inline-note" style={{ fontSize: 9, color: ph.color }}>{ph.no}</span>}
              </div>
            );
          })}
          <div className="exam-chart-line" style={{ bottom: `${passPct}%` }} title={`合格ライン ${passPct}%`}>
            <span>合格{passPct}%</span>
          </div>
        </div>
        <div className="inline-note" style={{ textAlign: 'center', marginTop: 6 }}>
          緑＝合格ライン到達／灰＝未満。左（過去）→右（最近）。数字はロードマップのフェーズ番号（カーソルで詳細）。
        </div>
      </div>
    </div>
  );
}
