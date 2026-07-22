import { useEffect, useMemo, useRef, useState } from 'react';
import { isSpeechSupported, loadVoices, speak, cancelSpeech, wait } from '../lib/speech.js';
import { effectiveTags, shuffle } from '../lib/query.js';
import { dateKey } from '../lib/connect.js';
import { SUBJECT_TAG_NAMES } from '../data/examScope.js';
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

export default function AudioMode({ store, onToast }) {
  const { reviewQuestions, questions, links, history, settings, updateSettings, recordAnswer, setLink } = store;

  const taggedQuestions = useMemo(
    () =>
      questions.filter(
        (q) =>
          (q.tags && q.tags.length) ||
          (links[q.id] && links[q.id].keywords && links[q.id].keywords.length)
      ),
    [questions, links]
  );
  const hasReview = reviewQuestions.length > 0;
  const hasTagged = taggedQuestions.length > 0;

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
  const [selectedKeyword, setSelectedKeyword] = useState('');

  // 上部の検索フィルタ（科目名 / ジャンル / キーワード、いずれも未選択OK）
  const [filterSubject, setFilterSubject] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');
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
  const filteredPool = useMemo(
    () => (filterKeyword ? afterGenre.filter((q) => kwsOf(q).includes(filterKeyword)) : afterGenre),
    [afterGenre, filterKeyword, links] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const filterActive = !!(filterSubject || filterGenre || filterKeyword);

  // 連結の工夫（プラン構造を変えるもの＝再構築が必要）
  const [chain, setChain] = useState(false); // #1 関連へ連鎖
  const [summary, setSummary] = useState(true); // #7 まとめ読み
  const [flashcard, setFlashcard] = useState(false); // #8 用語カード
  const [shuffleOn, setShuffleOn] = useState(false);

  // 読み上げの工夫（音声だけ＝再生中でも即反映）
  const [readSubject, setReadSubject] = useState(true); // #2 科目も読む
  const [readHint, setReadHint] = useState(false); // #5 ヒント
  const [reverse, setReverse] = useState(false); // #6 逆向き

  const [loop, setLoop] = useState(false);
  const [sleepMin, setSleepMin] = useState(0);

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

    if (source === 'filter') {
      let base = filteredPool;
      if (shuffleOn) base = shuffle(base);
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
    let base =
      source === 'review' && hasReview
        ? reviewQuestions
        : source === 'tagged' && hasTagged
        ? taggedQuestions
        : questions;
    if (shuffleOn) base = shuffle(base);
    return base.map((q) => ({ kind: 'question', q }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, selectedKeyword, chain, summary, flashcard, shuffleOn, clusters, kwNames, relatedMap, weakNames, dailyKw, questions, links, reviewQuestions, taggedQuestions, hasKeywords, hasReview, hasTagged, filteredPool]);

  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState(PHASES.QUESTION);
  const [rate, setRate] = useState(settings.speechRate);
  const [gap, setGap] = useState(settings.gapSeconds);
  const [voices, setVoices] = useState([]);
  const [tagOpen, setTagOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const abortRef = useRef(null);
  const playingRef = useRef(false);
  const indexRef = useRef(0);
  const rateRef = useRef(rate);
  const gapRef = useRef(gap);
  const loopRef = useRef(loop);
  const planRef = useRef(plan);
  const optsRef = useRef({ readSubject, readHint, reverse });
  const wakeLockRef = useRef(null);
  const sleepTimerRef = useRef(null);

  useEffect(() => { rateRef.current = rate; }, [rate]);
  useEffect(() => { gapRef.current = gap; }, [gap]);
  useEffect(() => { indexRef.current = index; }, [index]);
  useEffect(() => { loopRef.current = loop; }, [loop]);
  useEffect(() => { planRef.current = plan; }, [plan]);
  useEffect(() => { optsRef.current = { readSubject, readHint, reverse }; }, [readSubject, readHint, reverse]);

  useEffect(() => {
    loadVoices().then((vs) => setVoices(vs.filter((v) => v.lang && v.lang.startsWith('ja'))));
    const onVisible = () => {
      if (document.visibilityState === 'visible' && playingRef.current) requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      cancelSpeech();
      if (abortRef.current) abortRef.current.abort();
      releaseWakeLock();
      clearSleepTimer();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener?.('release', () => { wakeLockRef.current = null; });
      }
    } catch (e) { /* 継続 */ }
  };
  const releaseWakeLock = () => {
    try { wakeLockRef.current?.release(); } catch (e) { /* noop */ }
    wakeLockRef.current = null;
  };
  const clearSleepTimer = () => {
    if (sleepTimerRef.current) { clearTimeout(sleepTimerRef.current); sleepTimerRef.current = null; }
  };

  const selectedVoice = () => {
    if (!settings.voiceURI) return voices[0] || null;
    return voices.find((v) => v.voiceURI === settings.voiceURI) || voices[0] || null;
  };

  // 1項目を読み上げる
  const playOne = async (item, signal) => {
    const voice = selectedVoice();
    const o = optsRef.current;
    const say = (t) => speak(t, { rate: rateRef.current, voice, signal });

    if (item.kind === 'flashcard') {
      setPhase(PHASES.KEYWORD);
      await say(`用語。${item.keyword}。`);
      setPhase(PHASES.GAP);
      await wait(gapRef.current * 1000, signal);
      setPhase(PHASES.ANSWER);
      await say(item.text);
      await wait(700, signal);
      return;
    }
    if (item.kind === 'summary') {
      setPhase(PHASES.NOTE);
      await say(item.text);
      await wait(700, signal);
      return;
    }

    const q = item.q;
    if (item.intro) {
      setPhase(PHASES.KEYWORD);
      await say(item.intro);
      await wait(300, signal);
    }
    setPhase(PHASES.QUESTION);
    const subj = o.readSubject && q.subject ? `${q.subject}。` : '';
    await say(`${subj}問題。${questionText(q)}`);

    setPhase(PHASES.GAP);
    await wait(gapRef.current * 1000, signal);

    if (o.readHint) {
      const hint = item.keyword || effectiveTags(q, links)[0] || '';
      if (hint) {
        await say(`ヒント。キーワードは、${hint}。`);
        await wait(600, signal);
      }
    }

    setPhase(PHASES.ANSWER);
    await say(answerText(q));

    if (item.note) {
      setPhase(PHASES.NOTE);
      await say(`つながり。${item.note}`);
    }

    if (o.reverse) {
      setPhase(PHASES.QUESTION);
      await say(`逆に確認。答えは、${shortAnswer(q)}。これは何を問う問題だったか思い出しましょう。`);
      await wait(gapRef.current * 1000, signal);
      await say(`問題は、${questionText(q)}`);
    }

    await wait(700, signal);
  };

  const runFrom = async (startIndex) => {
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;
    playingRef.current = true;
    setPlaying(true);
    try {
      const list = planRef.current;
      let i = startIndex;
      while (playingRef.current) {
        if (i >= list.length) {
          if (loopRef.current && list.length > 0) i = 0;
          else break;
        }
        setIndex(i);
        indexRef.current = i;
        await playOne(list[i], signal);
        i += 1;
      }
      if (!loopRef.current && i >= list.length && playingRef.current) {
        stopPlayback();
        setPhase(PHASES.QUESTION);
        setIndex(0);
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.warn('audio error', e);
    }
  };

  const startPlayback = () => {
    if (plan.length === 0) return;
    updateSettings({ speechRate: rate, gapSeconds: gap });
    requestWakeLock();
    clearSleepTimer();
    if (sleepMin > 0) sleepTimerRef.current = setTimeout(() => stopPlayback(), sleepMin * 60 * 1000);
    runFrom(indexRef.current < plan.length ? indexRef.current : 0);
  };
  const stopPlayback = () => {
    releaseWakeLock();
    clearSleepTimer();
    playingRef.current = false;
    setPlaying(false);
    if (abortRef.current) abortRef.current.abort();
    cancelSpeech();
  };
  const togglePlay = () => (playing ? stopPlayback() : startPlayback());

  const skip = (delta) => {
    const wasPlaying = playingRef.current;
    stopPlayback();
    let next = indexRef.current + delta;
    next = Math.max(0, Math.min(plan.length - 1, next));
    setIndex(next);
    indexRef.current = next;
    setPhase(PHASES.QUESTION);
    if (wasPlaying) setTimeout(() => runFrom(next), 120);
  };
  const resetToStart = () => {
    stopPlayback();
    setIndex(0);
    indexRef.current = 0;
    setPhase(PHASES.QUESTION);
  };
  // プラン構造を変える操作は停止して先頭へ
  const rebuildStop = () => {
    stopPlayback();
    setIndex(0);
    indexRef.current = 0;
    setPhase(PHASES.QUESTION);
  };

  const changeSource = (s) => {
    rebuildStop();
    // 6つのボタンを選んだら検索フィルタは解除（どちらか一方のモード）
    setFilterSubject('');
    setFilterGenre('');
    setFilterKeyword('');
    setSource(s);
    if (s === 'keyword' && !selectedKeyword && hasKeywords) setSelectedKeyword(kwNames[0]);
  };

  // 検索フィルタの変更（科目→ジャンル→キーワードの順に段階的にしぼる）
  const applyFilter = (patch) => {
    rebuildStop();
    const ns = { subject: filterSubject, genre: filterGenre, keyword: filterKeyword, ...patch };
    if ('subject' in patch) { ns.genre = ''; ns.keyword = ''; } // 上位が変わったら下位をリセット
    if ('genre' in patch) { ns.keyword = ''; }
    setFilterSubject(ns.subject);
    setFilterGenre(ns.genre);
    setFilterKeyword(ns.keyword);
    setSource(ns.subject || ns.genre || ns.keyword ? 'filter' : 'all');
  };
  const clearFilter = () => {
    rebuildStop();
    setFilterSubject('');
    setFilterGenre('');
    setFilterKeyword('');
    setSource('all');
  };
  const changeKeyword = (kw) => { rebuildStop(); setSelectedKeyword(kw); };
  const toggleChain = () => { rebuildStop(); setChain((v) => !v); };
  const toggleSummary = () => { rebuildStop(); setSummary((v) => !v); };
  const toggleFlashcard = () => { rebuildStop(); setFlashcard((v) => !v); };
  const toggleShuffle = () => { rebuildStop(); setShuffleOn((v) => !v); };

  // #10 聞きながら自己採点／キーワード追加
  const gradeCurrent = (ok) => {
    const q = plan[index]?.q;
    if (!q) return;
    recordAnswer(q, ok);
    onToast?.(ok ? '「できた」を記録しました' : '「できない」を記録（復習に追加）');
  };
  const addTag = () => {
    const q = plan[index]?.q;
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

  const currentItem = plan[index];
  const current = currentItem?.q;
  const rateOptions = [0.7, 0.85, 1.0, 1.15, 1.3, 1.5, 1.75, 2.0];
  const sleepOptions = [0, 5, 10, 15, 20, 30];
  const kwLike = source === 'keyword' || source === 'daily' || source === 'weak';

  return (
    <div className="view">
      <h2 className="view-title">音声学習 × 連結学習</h2>
      <p className="view-desc">
        「問題 →（間）→ 正解と解説」を自動で読み上げます。連結の工夫で、ひとつの言葉を
        いろいろな角度から耳で覚えられます。
      </p>

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
              {keywordOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
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

      {/* 検索で読み上げ対象をしぼり込みます。未選択なら全問題を読み上げます。 */}

      {plan.length === 0 ? (
        <div className="empty">
          <div className="ico">🎧</div>
          <p>読み上げる項目がありません。</p>
          <p className="inline-note">
            {source === 'filter'
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
              <span className="now-index">{index + 1} / {plan.length}</span>
            </div>

            <div className="now-subject">
              {current?.subject ||
                (currentItem?.kind === 'flashcard' ? '用語カード' : currentItem?.kind === 'summary' ? 'まとめ' : '')}
            </div>
            {current?.image && <img className="now-image" src={current.image} alt="問題の図" loading="lazy" />}
            <div className="now-text">
              {currentItem?.kind === 'flashcard'
                ? `用語：${currentItem.keyword}`
                : currentItem?.kind === 'summary'
                ? `キーワード「${currentItem.keyword}」のまとめ`
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
              <button onClick={() => skip(1)} disabled={index >= plan.length - 1} aria-label="次へ">⏭</button>
            </div>
            {index > 0 && (
              <button className="btn ghost sm block" style={{ marginTop: 10 }} onClick={resetToStart}>最初から</button>
            )}

            {/* #10 聞きながら自己採点＋キーワード追加 */}
            {current && (
              <div className="selfgrade">
                <button className="sg-btn ok" onClick={() => gradeCurrent(true)}>⭕ できた</button>
                <button className="sg-btn ng" onClick={() => gradeCurrent(false)}>❌ できない</button>
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
                      if (playingRef.current) {
                        clearSleepTimer();
                        if (m > 0) sleepTimerRef.current = setTimeout(() => stopPlayback(), m * 60 * 1000);
                      }
                    }}
                  >
                    {m === 0 ? 'オフ' : `${m}分`}
                  </button>
                ))}
              </div>
              <div className="hint">寝る前の“ながら再生”に。指定時間で自動停止します。</div>
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
                    onClick={() => { setRate(r); rateRef.current = r; updateSettings({ speechRate: r }); }}
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
                  onChange={(e) => { const v = Number(e.target.value); setGap(v); gapRef.current = v; updateSettings({ gapSeconds: v }); }}
                />
                <span className="range-val">{gap}秒</span>
              </div>
              <div className="hint">解答を思い出す時間として使えます。</div>
            </div>
          </div>

          <div className="audio-note">
            <strong>🔆 画面をつけたままご利用ください</strong>
            <p>
              再生中は画面が消えないように自動で抑制します（対応ブラウザのみ）。ただし端末の画面を手動でOFFにしたり、ブラウザをバックグラウンドにすると、OSの仕様で音声が止まります。ポケットに入れての“ながら再生”には向きません。
            </p>
          </div>
        </>
      )}
    </div>
  );
}
