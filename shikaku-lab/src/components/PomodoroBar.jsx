import React, { useEffect, useRef, useState } from 'react';
import { actions } from '../lib/useStore.js';
import { PHASES, remainMs, isFinished, formatRemain, phaseDuration, todayCount, totalCount, activeDays, todayMinutes } from '../lib/pomodoro.js';

// 画面の上に常設するポモドーロタイマー。
//
// 決めていること:
// 1. **残りは「終わる時刻」から毎回引き算する**（1秒ずつ減らさない）。
//    タブを裏に回すとブラウザは setInterval を間引くので、減算方式だと戻った時に必ずズレる。
//    ここは1秒ごとに「今の時刻」で計算し直しているだけなので、裏に回っても戻ればすぐ正しくなる。
// 2. **連続日数を出さない。** 出すのは今日の本数と通算の本数・日数だけ。
// 3. 音は端末の中で作る（音声ファイルを持たない＝オフラインでも鳴る・起動が速い）。
//    自動再生の制限があるので、**ユーザーが押した時に AudioContext を作る**。
// 4. 押しても何も起きないボタンを出さない（走っていない時に「一時停止」を出さない）。

function beep(times = 2) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    for (let i = 0; i < times; i += 1) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      const at = ctx.currentTime + i * 0.35;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.3);
    }
    setTimeout(() => ctx.close().catch(() => {}), times * 400 + 500);
  } catch {
    /* 鳴らせない環境でも止めない */
  }
}

export default function PomodoroBar({ state }) {
  const { timer, pomodoro, pomodoroLog } = state;
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const firedRef = useRef(null);

  const running = Boolean(timer?.endsAt);
  const paused = timer?.pausedRemain != null;

  // 走っている間だけ1秒ごとに描き直す（止まっている時はタイマーを持たない）
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  // タブに戻ってきた時は、間引かれていたぶんをその場で取り戻す
  useEffect(() => {
    const sync = () => setNow(Date.now());
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  // 終わったら1回だけ記録する（同じ区間で二度数えないよう endsAt を覚えておく）
  useEffect(() => {
    if (!running || !isFinished(timer, now)) return;
    if (firedRef.current === timer.endsAt) return;
    firedRef.current = timer.endsAt;
    if (pomodoro.sound) beep(timer.phase === 'focus' ? 3 : 2);
    if (pomodoro.vibrate && navigator.vibrate) {
      try { navigator.vibrate(timer.phase === 'focus' ? [200, 100, 200] : [120]); } catch { /* 非対応でも止めない */ }
    }
    actions.finishPhase();
  }, [running, timer, now, pomodoro.sound, pomodoro.vibrate]);

  const phase = timer?.phase || 'focus';
  const meta = PHASES[phase] || PHASES.focus;
  const ms = timer && (running || paused) ? remainMs(timer, now) : phaseDuration(phase, pomodoro);
  const today = todayCount(pomodoroLog);

  const barClass = running ? (phase === 'focus' ? 'pomo-bar running-focus' : 'pomo-bar running-break') : 'pomo-bar';

  return (
    <>
      <div className={barClass}>
        <button
          type="button"
          className="icon-btn ghost"
          aria-label={open ? 'タイマーの設定を閉じる' : 'タイマーの設定を開く'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {meta.icon}
        </button>
        <div>
          <div className="pomo-phase">{meta.label}</div>
          <div className="pomo-time">{formatRemain(ms)}</div>
        </div>

        <div className="pomo-actions">
          {!running && !paused && (
            <button type="button" className="primary small" onClick={() => actions.startPhase(phase)}>
              開始
            </button>
          )}
          {running && (
            <button type="button" className="small" onClick={() => actions.pause()}>
              一時停止
            </button>
          )}
          {paused && (
            <button type="button" className="primary small" onClick={() => actions.resume()}>
              再開
            </button>
          )}
          {(running || paused) && (
            <button type="button" className="small ghost" onClick={() => actions.stopTimer()} title="記録には残りません">
              やめる
            </button>
          )}
          {!running && !paused && phase !== 'focus' && (
            <button type="button" className="small ghost" onClick={() => actions.skipBreak()}>
              休憩を飛ばす
            </button>
          )}
        </div>

        <div className="pomo-count">今日 {today}本</div>
      </div>

      {open && (
        <div className="pomo-panel">
          <div className="row">
            <label>
              集中
              <input
                type="number"
                min="1"
                max="120"
                value={pomodoro.focusMin}
                onChange={(e) => actions.setPomodoro({ focusMin: Number(e.target.value) || 1 })}
              />
              分
            </label>
            <label>
              休憩
              <input
                type="number"
                min="1"
                max="60"
                value={pomodoro.shortMin}
                onChange={(e) => actions.setPomodoro({ shortMin: Number(e.target.value) || 1 })}
              />
              分
            </label>
          </div>
          <div className="row">
            <label>
              長い休憩
              <input
                type="number"
                min="1"
                max="90"
                value={pomodoro.longMin}
                onChange={(e) => actions.setPomodoro({ longMin: Number(e.target.value) || 1 })}
              />
              分
            </label>
            <label>
              長い休憩は
              <input
                type="number"
                min="1"
                max="12"
                value={pomodoro.longEvery}
                onChange={(e) => actions.setPomodoro({ longEvery: Number(e.target.value) || 1 })}
              />
              本ごと
            </label>
          </div>
          <div className="row">
            <button type="button" className={`chip ${pomodoro.sound ? 'on' : ''}`} onClick={() => actions.setPomodoro({ sound: !pomodoro.sound })}>
              🔔 音 {pomodoro.sound ? 'あり' : 'なし'}
            </button>
            <button type="button" className={`chip ${pomodoro.vibrate ? 'on' : ''}`} onClick={() => actions.setPomodoro({ vibrate: !pomodoro.vibrate })}>
              📳 振動 {pomodoro.vibrate ? 'あり' : 'なし'}
            </button>
            <button type="button" className={`chip ${pomodoro.autoNext ? 'on' : ''}`} onClick={() => actions.setPomodoro({ autoNext: !pomodoro.autoNext })}>
              ⏭ 次へ自動 {pomodoro.autoNext ? 'あり' : 'なし'}
            </button>
          </div>
          <p className="muted">
            今日 {today}本（約{todayMinutes(pomodoroLog, pomodoro)}分）／通算 {totalCount(pomodoroLog)}本・{activeDays(pomodoroLog)}日。
            <br />
            連続日数は出していません。1日休んでも数字は減りません。
          </p>
        </div>
      )}
    </>
  );
}
