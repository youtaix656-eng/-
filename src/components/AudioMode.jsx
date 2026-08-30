import { useEffect, useMemo, useRef, useState } from 'react';
import { isSpeechSupported, loadVoices, speak, cancelSpeech } from '../lib/speech.js';
import * as storage from '../lib/storage.js';
import * as engine from '../lib/audioEngine.js';
import { useAudioEngine } from '../lib/audioEngine.js';
import { VOICE_PRESETS, resolveVoiceURI, presetById } from '../data/voices.js';
import { effectiveTags, shuffle } from '../lib/query.js';
import { dateKey } from '../lib/connect.js';
import { SUBJECT_TAG_NAMES } from '../data/examScope.js';
import { COMPARISONS, NUMBER_FACTS } from '../data/mindmapData.js';
import { buildKanaIndex } from '../lib/yomi.js';
import { reviewPoolFor, buildWeaknessSummary, weaknessSummaryToText, recommendNewPct } from '../lib/reviewPool.js';
import { studyStreak } from '../lib/stats.js';
import { normalize, MASTER_STREAK, isLeech as isLeechState } from '../lib/srs.js';
import { riskOf } from '../lib/reviewOrder.js';
import { loadTodayMood } from '../lib/mood.js';
import { detectBrokenYesterday, loadStreakBreakLog, breakReasonLabel } from '../lib/streakBreak.js';
import { loadNextTask } from '../lib/nextTask.js';
import { roundKey, formatRound, isSameRound } from '../lib/round.js';

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

export default function AudioMode({ store, onToast, reviewPreset, onConsumePreset, onNavigate }) {
  const { questions, links, history, srs, settings, updateSettings, recordAnswer, setLink, bookmarks, toggleBookmark, voiceCloneApiKey } = store;
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
  const uniqJa = (arr) => Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja'));
  // 上の選択で段階的にしぼり込む（科目→ジャンル→キーワード）
  // 科目名は公式13科目（はり/きゅうは分割）＋実際に収録されている科目を合わせて表示。
  const subjectOptions = useMemo(
    () => uniqJa([...SUBJECT_TAG_NAMES, ...questions.map((q) => q.subject)]),
    [questions]
  );
  const afterSubject = useMemo(
    () => (filterSubject ? questions.filter((q) => q.subject === filterSubject) : questions),
    [questions, filterSubject]
  );
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
  const filteredPool = useMemo(() => {
    let pool = filterRound ? afterKeyword.filter((q) => isSameRound(q.round, filterRound)) : afterKeyword;
    if (bookmarkOnly) pool = pool.filter((q) => bookmarks[q.id]);
    if (minWrong > 0) pool = pool.filter((q) => (normalize(srs[q.id]).wrongCount || 0) >= minWrong);
    if (minRisk > 0) pool = pool.filter((q) => Math.round(riskOf(q, srs) * 100) >= minRisk);
    if (recentWrongIds) pool = pool.filter((q) => recentWrongIds.has(q.id));
    return pool;
  }, [afterKeyword, filterRound, bookmarkOnly, bookmarks, minWrong, minRisk, srs, recentWrongIds]);
  const filterActive = !!(filterSubject || filterGenre || filterKeyword || filterRound || bookmarkOnly || minWrong > 0 || minRisk > 0 || recentOnly);

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
  const weaknessSummary = useMemo(
    () => buildWeaknessSummary(sessionWrong, links, COMPARISONS),
    [sessionWrong, links]
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
  const answerText = (q) => {
    const correct = q.choices[q.answer];
    const label = q.type === 'ox' ? '正解は、' : `正解は、${q.answer + 1}番、`;
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
      if (mode === 2) return relevant(COMPARISONS).map((c) => ({ kind: 'compare', comp: c }));
      if (mode === 3) return relevant(NUMBER_FACTS).map((n) => ({ kind: 'number', num: n }));
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

    if (source === 'filter') {
      let base = filteredPool;
      if (shuffleOn) base = shuffle(base);
      if (leechFirst) base = [...base].sort((a, b) => (isLeechState(srs[b.id]) ? 1 : 0) - (isLeechState(srs[a.id]) ? 1 : 0));
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
    } else if (source === 'tagged') base = taggedQuestions;
    else base = questions;
    if (shuffleOn) base = shuffle(base);
    if (leechFirst) base = [...base].sort((a, b) => (isLeechState(srs[b.id]) ? 1 : 0) - (isLeechState(srs[a.id]) ? 1 : 0));
    return base.map((q) => ({ kind: 'question', q }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, source, selectedKeyword, chain, summary, flashcard, shuffleOn, clusters, kwNames, relatedMap, weakNames, weakRanked, dailyKw, questions, links, reviewPool, taggedQuestions, hasKeywords, filteredPool, filterActive, customReviewIds, leechFirst, srs]);

  const [rate, setRate] = useState(settings.speechRate);
  const [gap, setGap] = useState(settings.gapSeconds);
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
    if (item.kind === 'flashcard') {
      steps.push({ phase: K, say: `用語。${item.keyword}。` });
      steps.push({ phase: G, waitGap: true });
      steps.push({ phase: A, say: item.text });
      steps.push({ wait: 700 });
      return steps;
    }
    if (item.kind === 'summary') {
      steps.push({ phase: N, say: item.text });
      steps.push({ wait: 700 });
      return steps;
    }
    if (item.kind === 'compare') {
      const c = item.comp;
      steps.push({ phase: K, say: `比較。${c.title}。` });
      steps.push({ phase: G, waitGap: 'cap2' });
      steps.push({ phase: A, say: `${(c.members || []).join('。 ')}。` });
      if (c.note) steps.push({ phase: A, say: `ポイント。${c.note}` });
      steps.push({ wait: 700 });
      return steps;
    }
    if (item.kind === 'number') {
      const n = item.num;
      steps.push({ phase: K, say: `数字。${n.topic}。` });
      steps.push({ phase: G, waitGap: 'cap2' });
      steps.push({ phase: A, say: `${n.value}。${n.note || ''}` });
      steps.push({ wait: 700 });
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
      steps.push({ wait: 700 });
      return steps;
    }
    if (item.kind === 'choices') {
      const cq = item.q;
      const subj2 = readSubject && cq.subject ? `${cq.subject}。` : '';
      let t = `${subj2}問題。${questionText(cq)}。`;
      if (cq.type !== 'ox') cq.choices.forEach((c, i) => { t += `${i + 1}番、${c}。`; });
      else t += '正しいか、誤りか。';
      steps.push({ phase: Q, say: t });
      steps.push({ phase: G, waitGap: true });
      steps.push({ phase: A, say: answerText(cq) });
      steps.push({ wait: 700 });
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
    if (readChoices && q.type !== 'ox' && Array.isArray(q.choices)) {
      q.choices.forEach((c, i) => { frontText += `${i + 1}番、${c}。`; });
    }
    front.push({ phase: Q, say: frontText });
    // 裏（答え）
    const back = [];
    back.push({ phase: A, say: answerText(q) });
    if (item.note) back.push({ phase: N, say: `つながり。${item.note}` });

    if (readSide === 'front') {
      steps.push(...front);
      steps.push({ wait: 700 });
      return steps;
    }
    if (readSide === 'back') {
      steps.push(...back);
      steps.push({ wait: 700 });
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
    steps.push({ wait: 700 });
    return steps;
  };
  // 読み上げ文にだけ手動補正辞書を適用（画面表示のテキストには影響しない）
  const buildSteps = (item) => buildStepsRaw(item).map((s) => (s.say ? { ...s, say: applyPronunciation(s.say) } : s));

  // 再生計画（steps＝読み上げ手順, display＝画面表示用にそのままの item）
  const builtPlan = useMemo(
    () => plan.map((item) => ({ steps: buildSteps(item), display: item })),
    [plan, readSubject, readHint, reverse, readSide, readChoices, recallMode, links, settings.pronunciationFixes] // eslint-disable-line react-hooks/exhaustive-deps
  );
  // 構成が同じなら（画面を離れて戻ってきた等）再生位置を保つための署名
  const planSig = useMemo(
    () => JSON.stringify([
      source, mode, selectedKeyword, chain, summary, flashcard, shuffleOn,
      readSubject, readHint, reverse, readSide, readChoices, recallMode, filterSubject, filterGenre, filterKeyword,
      questions.length, plan.length,
    ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, mode, selectedKeyword, chain, summary, flashcard, shuffleOn, readSubject, readHint, reverse, readSide, readChoices, recallMode, filterSubject, filterGenre, filterKeyword, questions.length, plan.length]
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
  useEffect(() => { engine.configure({ loop }); }, [loop]);
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
  // 「今日の調子」がしんどい日は目標を自動で軽くする（Review.jsxと同じ考え方）
  const effectiveGoal = goal > 0 && mood === 'tired' ? Math.max(5, Math.round(goal * 0.5)) : goal;

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

  const togglePlay = () => {
    if (!playing) {
      updateSettings({ speechRate: rate, gapSeconds: gap });
      engine.configure({ rate, gapSeconds: gap, loop, voice: selectedVoice(), pitch: settings.speechPitch || 1 });
      engine.setSleep(sleepMin);
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
    setSource(ns.subject || ns.genre || ns.keyword || ns.round || bookmarkOnly || minRisk > 0 || minWrong > 0 || recentOnly ? 'filter' : 'all');
  };
  const clearFilter = () => {
    rebuildStop();
    setFilterSubject('');
    setFilterGenre('');
    setFilterKeyword('');
    setFilterRound('');
    setBookmarkOnly(false);
    setMinRisk(0);
    setMinWrong(0);
    setRecentOnly('');
    setSource('all');
  };
  const changeRecentOnly = (v) => {
    rebuildStop();
    const next = recentOnly === v ? '' : v;
    setRecentOnly(next);
    setSource(next || filterSubject || filterGenre || filterKeyword || filterRound || bookmarkOnly ? 'filter' : 'all');
  };
  const toggleBookmarkOnly = () => {
    rebuildStop();
    const next = !bookmarkOnly;
    setBookmarkOnly(next);
    setSource(next || filterSubject || filterGenre || filterKeyword || filterRound ? 'filter' : 'all');
  };
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
    if (!ok) setSessionWrong((prev) => (prev.some((x) => x.id === q.id) ? prev : [...prev, q]));
    onToast?.(
      kind === 'maru'
        ? '「○ できた」を記録しました'
        : kind === 'sankaku'
        ? '「△ あいまい」を記録（復習に追加）'
        : '「✕ できない」を記録（復習に追加）'
    );
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

  const currentItem = snap.display || builtPlan[index]?.display || builtPlan[0]?.display || null;
  const current = currentItem?.q;
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
          <input type="checkbox" checked={leechFirst} onChange={(e) => setLeechFirst(e.target.checked)} />
          <span>⚠️ リーチ（要注意）問題を優先して読む</span>
        </label>
        <div className="chip-row" style={{ marginTop: 8 }}>
          <span className="section-hint">直近の誤答だけ：</span>
          <button className={`chip ${recentOnly === 'today' ? 'active' : ''}`} onClick={() => changeRecentOnly('today')}>今日</button>
          <button className={`chip ${recentOnly === 'week' ? 'active' : ''}`} onClick={() => changeRecentOnly('week')}>今週</button>
        </div>
        <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
          <label>忘却リスクの下限（{minRisk === 0 ? '指定なし' : `${minRisk}%以上だけ`}）</label>
          <input type="range" min="0" max="90" step="10" value={minRisk} onChange={(e) => { rebuildStop(); setMinRisk(Number(e.target.value)); }} />
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

      {source === 'review' && (() => {
        const n = customReviewIds ? customReviewIds.length : reviewPool.length;
        return (
          <div className="card" style={{ borderColor: 'var(--accent)', background: 'var(--surface-2)' }}>
            {n > 0
              ? `🔁 「間違えた問題」を読み上げ中（${n}問${customReviewIds ? '・復習画面の絞り込み条件を反映' : ''}）。上の検索で条件を選ぶと通常の読み上げに戻ります。`
              : '🔁 「間違えた問題」を読もうとしましたが、復習対象が0問でした。上の検索で条件を選ぶと通常の読み上げに戻ります。'}
          </div>
        );
      })()}

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
