import { useEffect, useMemo, useRef, useState } from 'react';
import {
  isSpeechSupported,
  loadVoices,
  speak,
  cancelSpeech,
  wait,
} from '../lib/speech.js';
import { allTags, effectiveTags, shuffle } from '../lib/query.js';

// 音声学習モード（最重要機能）
// 間違えた問題などを音声合成で読み上げる。
//   基本フロー: 問題文 → （数秒間） → 正解＋解説 → 次の問題…
// 連続再生・一時停止・スキップ・再生速度調整に対応。
//
// ★ 連結学習モード（キーワードで回す）
//   同じキーワード（連結キーワード / タグ）を持つ問題をまとめて連続再生し、
//   「つながりメモ」も読み上げる。ひとつのキーワードを多方面から強化できる。
//   特定のキーワード1つを回す／全キーワードを順番に回す、を選べる。
//
// ※ アプリを開いた状態での利用を想定（画面OFF時の継続再生は不可）。

const PHASES = { KEYWORD: 'keyword', QUESTION: 'question', GAP: 'gap', ANSWER: 'answer', NOTE: 'note' };
const ALL_KW = '__all__';

export default function AudioMode({ store }) {
  const { reviewQuestions, questions, links, settings, updateSettings } = store;

  // タグ（連結キーワード）が付いた問題
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

  // 連結キーワードの一覧（関連問題が多い順）
  const keywordList = useMemo(() => {
    const tags = allTags(questions, links);
    return tags
      .map((kw) => ({
        keyword: kw,
        count: questions.filter((q) => effectiveTags(q, links).includes(kw)).length,
      }))
      .filter((k) => k.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [questions, links]);
  const hasKeywords = keywordList.length > 0;

  const [source, setSource] = useState('review'); // 'review' | 'tagged' | 'all' | 'keyword'
  const [selectedKeyword, setSelectedKeyword] = useState('');
  const [loop, setLoop] = useState(false);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [sleepMin, setSleepMin] = useState(0); // 0=オフ

  // 再生プラン（読み上げ項目の配列）
  //   item = { q, keyword?, intro?, note? }
  const plan = useMemo(() => {
    if (source === 'keyword') {
      if (!hasKeywords) return [];
      const kws =
        selectedKeyword === ALL_KW || !selectedKeyword
          ? keywordList.map((k) => k.keyword)
          : [selectedKeyword];
      const items = [];
      kws.forEach((kw) => {
        let qs = questions.filter((q) => effectiveTags(q, links).includes(kw));
        if (shuffleOn) qs = shuffle(qs);
        qs.forEach((q, i) => {
          const note = (links[q.id] && links[q.id].note && links[q.id].note.trim()) || '';
          items.push({
            q,
            keyword: kw,
            intro:
              i === 0
                ? `キーワード、${kw}。関連する問題を${qs.length}問、続けて確認します。`
                : '',
            note,
          });
        });
      });
      return items;
    }
    let base =
      source === 'review' && hasReview
        ? reviewQuestions
        : source === 'tagged' && hasTagged
        ? taggedQuestions
        : questions;
    if (shuffleOn) base = shuffle(base);
    return base.map((q) => ({ q }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, selectedKeyword, shuffleOn, questions, links, reviewQuestions, taggedQuestions, keywordList]);

  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState(PHASES.QUESTION);
  const [rate, setRate] = useState(settings.speechRate);
  const [gap, setGap] = useState(settings.gapSeconds);
  const [voices, setVoices] = useState([]);

  // 再生ループの中断・参照用
  const abortRef = useRef(null);
  const playingRef = useRef(false);
  const indexRef = useRef(0);
  const rateRef = useRef(rate);
  const gapRef = useRef(gap);
  const loopRef = useRef(loop);
  const planRef = useRef(plan);
  const wakeLockRef = useRef(null);
  const sleepTimerRef = useRef(null);

  useEffect(() => { rateRef.current = rate; }, [rate]);
  useEffect(() => { gapRef.current = gap; }, [gap]);
  useEffect(() => { indexRef.current = index; }, [index]);
  useEffect(() => { loopRef.current = loop; }, [loop]);
  useEffect(() => { planRef.current = plan; }, [plan]);

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
        wakeLockRef.current.addEventListener?.('release', () => {
          wakeLockRef.current = null;
        });
      }
    } catch (e) {
      /* 取得できなくても再生は継続する */
    }
  };
  const releaseWakeLock = () => {
    try {
      wakeLockRef.current?.release();
    } catch (e) {
      /* noop */
    }
    wakeLockRef.current = null;
  };

  const clearSleepTimer = () => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
  };

  const selectedVoice = () => {
    if (!settings.voiceURI) return voices[0] || null;
    return voices.find((v) => v.voiceURI === settings.voiceURI) || voices[0] || null;
  };

  const answerText = (q) => {
    const correct = q.choices[q.answer];
    const label = q.type === 'ox' ? '正解は、' : `正解は、${q.answer + 1}番、`;
    let t = `${label}${correct}。`;
    if (q.explanation) t += ` 解説。${q.explanation}`;
    return t;
  };

  const questionText = (q) => {
    if (q.question) return q.question;
    if (q.image) return '図を見て答える問題です。画面をご確認ください。';
    return '';
  };

  // 1項目を読み上げる（キーワード導入 → 問題 → 間 → 解答 → つながりメモ）
  const playOne = async (item, signal) => {
    const voice = selectedVoice();
    const q = item.q;

    if (item.intro) {
      setPhase(PHASES.KEYWORD);
      await speak(item.intro, { rate: rateRef.current, voice, signal });
      await wait(300, signal);
    }

    setPhase(PHASES.QUESTION);
    await speak(`問題。${questionText(q)}`, { rate: rateRef.current, voice, signal });

    setPhase(PHASES.GAP);
    await wait(gapRef.current * 1000, signal);

    setPhase(PHASES.ANSWER);
    await speak(answerText(q), { rate: rateRef.current, voice, signal });

    if (item.note) {
      setPhase(PHASES.NOTE);
      await speak(`つながり。${item.note}`, { rate: rateRef.current, voice, signal });
    }

    await wait(700, signal);
  };

  // 連続再生ループ（loop 有効時は最後まで行くと先頭へ戻る）
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
          if (loopRef.current && list.length > 0) {
            i = 0;
          } else {
            break;
          }
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
    // スリープタイマー
    clearSleepTimer();
    if (sleepMin > 0) {
      sleepTimerRef.current = setTimeout(() => stopPlayback(), sleepMin * 60 * 1000);
    }
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

  const togglePlay = () => {
    if (playing) stopPlayback();
    else startPlayback();
  };

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

  const changeSource = (s) => {
    stopPlayback();
    setSource(s);
    if (s === 'keyword' && !selectedKeyword && hasKeywords) {
      setSelectedKeyword(keywordList[0].keyword);
    }
    setIndex(0);
    indexRef.current = 0;
    setPhase(PHASES.QUESTION);
  };

  const changeKeyword = (kw) => {
    stopPlayback();
    setSelectedKeyword(kw);
    setIndex(0);
    indexRef.current = 0;
    setPhase(PHASES.QUESTION);
  };

  const toggleShuffle = () => {
    stopPlayback();
    setShuffleOn((v) => !v);
    setIndex(0);
    indexRef.current = 0;
  };

  // 未対応環境
  if (!isSpeechSupported()) {
    return (
      <div className="view">
        <h2 className="view-title">音声学習</h2>
        <div className="empty">
          <div className="ico">🔇</div>
          <p>お使いのブラウザは音声合成（Web Speech API）に対応していません。</p>
          <p className="inline-note">
            iOS / Android の Safari・Chrome など、最新のブラウザでお試しください。
          </p>
        </div>
      </div>
    );
  }

  const current = plan[index]?.q;
  const currentItem = plan[index];
  const rateOptions = [0.7, 0.85, 1.0, 1.15, 1.3, 1.5, 1.75, 2.0];
  const sleepOptions = [0, 5, 10, 15, 20, 30];

  return (
    <div className="view">
      <h2 className="view-title">音声学習</h2>
      <p className="view-desc">
        「問題 → 数秒の間 → 正解と解説」を自動で読み上げます。
        連結モードなら、同じキーワードの問題をまとめて回して弱点を集中強化できます。
      </p>

      {/* 読み上げ対象 */}
      <div className="chip-row">
        {hasReview && (
          <button className={`chip ${source === 'review' ? 'active' : ''}`} onClick={() => changeSource('review')}>
            間違えた問題（{reviewQuestions.length}）
          </button>
        )}
        {hasTagged && (
          <button className={`chip ${source === 'tagged' ? 'active' : ''}`} onClick={() => changeSource('tagged')}>
            タグ付き（{taggedQuestions.length}）
          </button>
        )}
        <button className={`chip ${source === 'all' ? 'active' : ''}`} onClick={() => changeSource('all')}>
          全問題（{questions.length}）
        </button>
        {hasKeywords && (
          <button className={`chip ${source === 'keyword' ? 'active' : ''}`} onClick={() => changeSource('keyword')}>
            🔗 キーワードで回す
          </button>
        )}
      </div>

      {/* 連結キーワードの選択 */}
      {source === 'keyword' && (
        <div className="card kw-picker">
          <div className="section-label" style={{ marginTop: 0 }}>回すキーワードを選ぶ</div>
          {!hasKeywords ? (
            <p className="inline-note">
              連結キーワードがまだありません。問題を解いたあとに「キーワード・連結メモを追加」で
              キーワードを付けると、ここでまとめて回せます。
            </p>
          ) : (
            <div className="chip-row" style={{ marginBottom: 0 }}>
              <button
                className={`chip ${selectedKeyword === ALL_KW ? 'active' : ''}`}
                onClick={() => changeKeyword(ALL_KW)}
              >
                すべて順番に（{keywordList.length}語）
              </button>
              {keywordList.map((k) => (
                <button
                  key={k.keyword}
                  className={`chip ${selectedKeyword === k.keyword ? 'active' : ''}`}
                  onClick={() => changeKeyword(k.keyword)}
                >
                  {k.keyword}（{k.count}）
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {plan.length === 0 ? (
        <div className="empty">
          <div className="ico">🎧</div>
          <p>読み上げる問題がありません。</p>
          <p className="inline-note">
            {source === 'keyword'
              ? 'キーワードを付けた問題を用意すると、ここで連続再生できます。'
              : 'まずは一問一答や模擬試験で問題を解き、間違えた問題を溜めましょう。'}
          </p>
        </div>
      ) : (
        <>
          {/* プレーヤー */}
          <div className="player">
            {currentItem?.keyword && (
              <div className="now-keyword">🔗 {currentItem.keyword}</div>
            )}
            <div>
              <span className="now-phase">
                {phase === PHASES.KEYWORD && 'キーワード'}
                {phase === PHASES.QUESTION && '問題'}
                {phase === PHASES.GAP && '……考え中……'}
                {phase === PHASES.ANSWER && '正解・解説'}
                {phase === PHASES.NOTE && 'つながり'}
              </span>
              <span className="now-index">
                {index + 1} / {plan.length}
              </span>
            </div>
            <div className="now-subject">{current.subject}</div>
            {current.image && <img className="now-image" src={current.image} alt="問題の図" loading="lazy" />}
            <div className="now-text">
              {current.question || (current.image ? '図を見て答える問題' : '')}
            </div>
            {phase === PHASES.ANSWER && (
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
            {phase === PHASES.NOTE && currentItem?.note && (
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
              <button onClick={() => skip(-1)} disabled={index === 0} aria-label="前の問題">⏮</button>
              <button className="main" onClick={togglePlay} aria-label="再生 / 一時停止">
                {playing ? '⏸' : '▶'}
              </button>
              <button onClick={() => skip(1)} disabled={index >= plan.length - 1} aria-label="次の問題">⏭</button>
            </div>
            {index > 0 && (
              <button className="btn ghost sm block" style={{ marginTop: 10 }} onClick={resetToStart}>
                最初から
              </button>
            )}
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
                    onClick={() => {
                      setRate(r);
                      rateRef.current = r;
                      updateSettings({ speechRate: r });
                    }}
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
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={gap}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setGap(v);
                    gapRef.current = v;
                    updateSettings({ gapSeconds: v });
                  }}
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
