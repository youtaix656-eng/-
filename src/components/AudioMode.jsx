import { useEffect, useRef, useState } from 'react';
import {
  isSpeechSupported,
  loadVoices,
  speak,
  cancelSpeech,
  wait,
} from '../lib/speech.js';

// 音声学習モード（最重要機能）
// 間違えた問題を音声合成で読み上げる。
//   フロー: 問題文 → （数秒間） → 正解＋解説 → 次の問題…
// 連続再生・一時停止・スキップ・再生速度調整に対応。
// ※ アプリを開いた状態での利用を想定（画面OFF時の継続再生は不可）。

const PHASES = { QUESTION: 'question', GAP: 'gap', ANSWER: 'answer' };

export default function AudioMode({ store }) {
  const { reviewQuestions, questions, settings, updateSettings } = store;

  // 読み上げ対象：復習リストが空ならデバッグ用に全問から選べるようにする
  const hasReview = reviewQuestions.length > 0;
  const [source, setSource] = useState('review'); // 'review' | 'all'
  const list = source === 'review' && hasReview ? reviewQuestions : questions;

  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState(PHASES.QUESTION);
  const [rate, setRate] = useState(settings.speechRate);
  const [gap, setGap] = useState(settings.gapSeconds);
  const [voices, setVoices] = useState([]);

  // 再生ループの中断用
  const abortRef = useRef(null);
  const playingRef = useRef(false);
  const indexRef = useRef(0);
  const rateRef = useRef(rate);
  const gapRef = useRef(gap);
  const wakeLockRef = useRef(null);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);
  useEffect(() => {
    gapRef.current = gap;
  }, [gap]);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    loadVoices().then((vs) => setVoices(vs.filter((v) => v.lang && v.lang.startsWith('ja'))));
    // 画面が復帰したら（再生中なら）WakeLock を取り直す
    const onVisible = () => {
      if (document.visibilityState === 'visible' && playingRef.current) requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVisible);
    // アンマウント時に必ず停止
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      cancelSpeech();
      if (abortRef.current) abortRef.current.abort();
      releaseWakeLock();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 画面スリープを抑止（対応ブラウザのみ）。ながら再生中に画面が消えるのを緩和する。
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener?.('release', () => {
          wakeLockRef.current = null;
        });
      }
    } catch (e) {
      // 取得できなくても再生は継続する
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

  const selectedVoice = () => {
    if (!settings.voiceURI) return voices[0] || null;
    return voices.find((v) => v.voiceURI === settings.voiceURI) || voices[0] || null;
  };

  // 正解テキストを組み立てる
  const answerText = (q) => {
    const correct = q.choices[q.answer];
    const label = q.type === 'ox' ? '正解は、' : `正解は、${q.answer + 1}番、`;
    let t = `${label}${correct}。`;
    if (q.explanation) t += ` 解説。${q.explanation}`;
    return t;
  };

  // 問題文（図のみの問題にも対応）
  const questionText = (q) => {
    if (q.question) return q.question;
    if (q.image) return '図を見て答える問題です。画面をご確認ください。';
    return '';
  };

  // 1問を読み上げる（問題→間→解答）。中断されたら例外を投げる。
  const playOne = async (q, signal) => {
    const voice = selectedVoice();

    setPhase(PHASES.QUESTION);
    await speak(`問題。${questionText(q)}`, { rate: rateRef.current, voice, signal });

    setPhase(PHASES.GAP);
    await wait(gapRef.current * 1000, signal);

    setPhase(PHASES.ANSWER);
    await speak(answerText(q), { rate: rateRef.current, voice, signal });

    // 問題間の小休止
    await wait(700, signal);
  };

  // 連続再生ループ
  const runFrom = async (startIndex) => {
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;
    playingRef.current = true;
    setPlaying(true);

    try {
      let i = startIndex;
      while (i < list.length && playingRef.current) {
        setIndex(i);
        indexRef.current = i;
        await playOne(list[i], signal);
        i += 1;
      }
      if (i >= list.length && playingRef.current) {
        // 最後まで再生した
        stopPlayback();
        setPhase(PHASES.QUESTION);
        setIndex(0);
      }
    } catch (e) {
      // 中断（AbortError）は正常。それ以外はログ。
      if (e.name !== 'AbortError') console.warn('audio error', e);
    }
  };

  const startPlayback = () => {
    if (list.length === 0) return;
    updateSettings({ speechRate: rate, gapSeconds: gap });
    requestWakeLock();
    runFrom(indexRef.current < list.length ? indexRef.current : 0);
  };

  const stopPlayback = () => {
    releaseWakeLock();
    playingRef.current = false;
    setPlaying(false);
    if (abortRef.current) abortRef.current.abort();
    cancelSpeech();
  };

  const togglePlay = () => {
    if (playing) stopPlayback();
    else startPlayback();
  };

  // スキップ（前後の問題へ）：再生中なら現在を中断して移動
  const skip = (delta) => {
    const wasPlaying = playingRef.current;
    stopPlayback();
    let next = indexRef.current + delta;
    next = Math.max(0, Math.min(list.length - 1, next));
    setIndex(next);
    indexRef.current = next;
    setPhase(PHASES.QUESTION);
    if (wasPlaying) {
      // 少し待ってから再開（cancel の反映を待つ）
      setTimeout(() => runFrom(next), 120);
    }
  };

  // ソース切り替え時は停止してリセット
  const changeSource = (s) => {
    stopPlayback();
    setSource(s);
    setIndex(0);
    indexRef.current = 0;
    setPhase(PHASES.QUESTION);
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

  // 対象が無い
  if (list.length === 0) {
    return (
      <div className="view">
        <h2 className="view-title">音声学習</h2>
        <div className="empty">
          <div className="ico">🎧</div>
          <p>読み上げる問題がありません。</p>
          <p className="inline-note">
            まずは一問一答や模擬試験で問題を解き、間違えた問題を溜めましょう。
          </p>
        </div>
      </div>
    );
  }

  const current = list[index];
  const rateOptions = [0.7, 0.85, 1.0, 1.15, 1.3, 1.5, 1.75, 2.0];

  return (
    <div className="view">
      <h2 className="view-title">音声学習</h2>
      <p className="view-desc">
        間違えた問題を読み上げます。「問題 → 数秒の間 → 正解と解説」の順で自動再生します。
      </p>

      {hasReview && (
        <div className="chip-row">
          <button
            className={`chip ${source === 'review' ? 'active' : ''}`}
            onClick={() => changeSource('review')}
          >
            間違えた問題（{reviewQuestions.length}）
          </button>
          <button
            className={`chip ${source === 'all' ? 'active' : ''}`}
            onClick={() => changeSource('all')}
          >
            全問題（{questions.length}）
          </button>
        </div>
      )}

      {/* プレーヤー */}
      <div className="player">
        <div>
          <span className="now-phase">
            {phase === PHASES.QUESTION && '問題'}
            {phase === PHASES.GAP && '……考え中……'}
            {phase === PHASES.ANSWER && '正解・解説'}
          </span>
          <span className="now-index">
            {index + 1} / {list.length}
          </span>
        </div>
        <div className="now-subject">{current.subject}</div>
        {current.image && (
          <img className="now-image" src={current.image} alt="問題の図" loading="lazy" />
        )}
        <div className="now-text">{current.question || (current.image ? '図を見て答える問題' : '')}</div>
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

        <div className="phase-indicator">
          <div className={`seg ${phase === PHASES.QUESTION ? 'on' : ''}`} />
          <div className={`seg ${phase === PHASES.GAP ? 'on' : ''}`} />
          <div className={`seg ${phase === PHASES.ANSWER ? 'on' : ''}`} />
        </div>

        <div className="player-controls">
          <button onClick={() => skip(-1)} disabled={index === 0} aria-label="前の問題">
            ⏮
          </button>
          <button className="main" onClick={togglePlay} aria-label="再生 / 一時停止">
            {playing ? '⏸' : '▶'}
          </button>
          <button
            onClick={() => skip(1)}
            disabled={index >= list.length - 1}
            aria-label="次の問題"
          >
            ⏭
          </button>
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
    </div>
  );
}
