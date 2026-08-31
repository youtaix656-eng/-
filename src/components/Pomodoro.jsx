import { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react';
import * as storage from '../lib/storage.js';
import { durationSec, mmss, nextPhaseAfter, advanceState, remainingSecOf, toneFreq } from '../lib/pomodoroLogic.js';
import { loadPomoState, savePomoState, clearPomoState } from '../lib/pomoState.js';
import {
  loadPomoLog, appendPomoLog, todayStart, weekStart, totalStudySecSince, countSince,
  exportPomoLogCsv, clearPomoLog,
} from '../lib/pomoLog.js';
import { appendPomoFocus, FOCUS_LEVELS } from '../lib/pomoFocus.js';
import { appendPauseReason, PAUSE_REASONS } from '../lib/pomoPause.js';
import { makeTabId, isLeader as computeIsLeader } from '../lib/pomoLeader.js';
import { requestNotifyPermissionIfNeeded } from '../lib/pomoNotify.js';
import { useLongPress } from '../lib/useLongPress.js';
import { downloadFile } from '../lib/download.js';
import { harioPomoEncourage } from '../data/haripan.js';

// 設定パネル（プリセット・分数・音・統計のUI一式）はここでだけlazy importする。
// Pomodoro自体はApp.jsxの常時マウント対象（下部ナビ以外で唯一の例外）なので、
// 開くまで使わない設定UIをここに静的importすると起動時バンドルが膨らむ。
const PomodoroConfigFields = lazy(() =>
  import('./PomodoroConfigFields.jsx').then((m) => ({ default: m.PomodoroConfigFields }))
);
const PomodoroStatsPanel = lazy(() =>
  import('./PomodoroConfigFields.jsx').then((m) => ({ default: m.PomodoroStatsPanel }))
);

// ポモドーロタイマー（全画面の上部に固定表示）
// ・勉強／短い休憩／長い休憩の時間を自由に設定
// ・勉強中、任意で通知（例：30分なら10分おき）
// ・勉強開始Musicの再生ON/OFF＋音声ファイルの設定
// App のルートに常駐するので、画面を切り替えてもカウントは継続する。
//
// 時刻ベース設計：残り時間を1秒ずつ減算するのではなく「フェーズが終わる時刻
// （phaseEndAt）」を持ち、今の時刻との差から毎回計算し直す（lib/pomodoroLogic.js）。
// バックグラウンドでタブが眠っていても、再開時に正しい位置まで一気に辿れる。
//
// 複数タブ対策：同じアプリを2つのタブで開いて両方実行中だと、フェーズ終了の検知が
// 両方で独立して起きるため、放っておくと統計記録・通知・効果音が2重になる。
// lib/pomoLeader.js の「幹事タブ」判定で、統計記録・通知・保存を行うのは1つのタブだけに絞る
// （単独タブしか無い時は常にそのタブが幹事になるので、通常利用への影響は無い）。
const PHASES = {
  idle: { label: '待機中', cls: 'idle' },
  study: { label: '勉強', cls: 'study' },
  short: { label: '短い休憩', cls: 'short' },
  long: { label: '長い休憩', cls: 'long' },
};

const BC_NAME = 'shinkyu-pomo';
const HELLO_INTERVAL_MS = 4000; // 幹事タブ判定のための生存報告の間隔
const LEADER_SETTLE_MS = 300; // 起動直後の復元処理だけ、他タブのhelloが届くのを少し待つ
const PERSIST_INTERVAL_TICKS = 10; // 実行中の秒だけの保存間隔（毎秒書き込みしない）
const BREAK_TIPS = ['👀 遠くを見て目を休めましょう', '🧘 肩を軽く回してみましょう', '💧 水分をとりましょう', '🚶 少し立って伸びをしましょう'];

let audioBlockWarned = false; // 自動再生ブロックの警告は1ページ生存中に1回だけで十分

function beep(times = 1, freq = 880, volumePct = 100, onBlocked) {
  if (volumePct <= 0) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const peakGain = Math.max(0.0001, 0.3 * Math.min(100, volumePct) / 100);
    let t = ctx.currentTime;
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peakGain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.start(t);
      o.stop(t + 0.26);
      t += 0.34;
    }
    // 鳴らし終わったらcloseする。開けっぱなしのAudioContextが積み重なると
    // ブラウザ側の上限に達しうるため。
    const totalMs = (t - ctx.currentTime) * 1000 + 100;
    setTimeout(() => {
      // ユーザー操作を伴わない自動再生はブラウザにブロックされることがある（resumeしても
      // suspendedのまま）。気づけるよう一度だけ知らせる。
      if (ctx.state === 'suspended' && !audioBlockWarned) {
        audioBlockWarned = true;
        onBlocked?.();
      }
      ctx.close().catch(() => {});
    }, totalMs);
  } catch (e) {
    /* noop */
  }
}

function vibrate(pattern) {
  try { navigator.vibrate?.(pattern); } catch (e) { /* noop */ }
}

function notify(title, body) {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
      new Notification(title, { body });
    }
  } catch (e) {
    /* noop */
  }
}

export default function Pomodoro({ store, onToast, activeView, onNavigate }) {
  const cfg = store.settings.pomodoro || {};
  const { updateSettings } = store;
  const setCfg = useCallback((patch) => updateSettings({ pomodoro: { ...(store.settings.pomodoro || {}), ...patch } }), [store.settings.pomodoro, updateSettings]);

  const [phase, setPhase] = useState('idle');
  const [running, setRunning] = useState(false);
  const [min, setMin] = useState(true); // 省スペース：既定は最小化
  const [remaining, setRemaining] = useState((cfg.study || 25) * 60); // 停止中の残り秒数
  const [phaseEndAt, setPhaseEndAt] = useState(0); // 実行中はこちらが正
  const [done, setDone] = useState(0);
  const [open, setOpen] = useState(false);
  const [musicUrl, setMusicUrl] = useState(null);
  const [hasMusic, setHasMusic] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [announce, setAnnounce] = useState(''); // aria-live用の読み上げテキスト
  const [tag, setTag] = useState(''); // 今回の勉強内容（任意メモ）
  const [stats, setStats] = useState({ todaySec: 0, todayCount: 0, weekSec: 0 });
  const [pomoLogRaw, setPomoLogRaw] = useState([]); // 週間グラフ・CSV書き出し用
  const [tick, setTick] = useState(0); // 1秒ごとに増やして表示を再計算させるためだけの値
  const [restored, setRestored] = useState(false);
  const [focusPrompt, setFocusPrompt] = useState(false); // 勉強フェーズ終了直後の集中度セルフチェック
  const [pauseReasonPrompt, setPauseReasonPrompt] = useState(false); // 勉強中に一時停止した理由（任意）

  const audioRef = useRef(null);
  const fileRef = useRef(null);
  const tickRef = useRef(null);
  const barRef = useRef(null);
  const bcRef = useRef(null);
  const wakeLockRef = useRef(null);
  const persistTickRef = useRef(0);
  const tabIdRef = useRef(makeTabId());
  const peersRef = useRef(new Map());
  const longBreakCountRef = useRef(0);
  const refreshDebounceRef = useRef(null);

  const now = () => Date.now();

  const isLeaderNow = useCallback(() => {
    if (typeof BroadcastChannel === 'undefined') return true; // 他タブと協調できない環境では常に自分が正
    const visible = typeof document !== 'undefined' && document.visibilityState === 'visible';
    peersRef.current.set(tabIdRef.current, { at: Date.now(), visible });
    return computeIsLeader(peersRef.current, tabIdRef.current, Date.now());
  }, []);

  // ---- 起動時：保存済みの状態を復元し、閉じていた間の経過を追いつかせる ----
  useEffect(() => {
    let alive = true;
    loadPomoState().then((s) => {
      if (!alive || !s) { setRestored(true); return; }
      if (s.running && s.phaseEndAt) {
        const r = advanceState({ phase: s.phase, phaseEndAt: s.phaseEndAt, done: s.done || 0, cfg });
        setPhase(r.phase);
        setPhaseEndAt(r.phaseEndAt);
        setDone(r.done);
        setRunning(r.phase !== 'idle');
        if (r.transitions.length > 0) {
          // 他タブも同時に復元中かもしれないので、少しだけ待って幹事タブが確定してから
          // 統計記録・通知を行う（両方のタブがここを通っても2重に記録しないため）。
          setTimeout(() => {
            if (!alive || !isLeaderNow()) return;
            processTransitions(r.transitions, { silent: r.transitions.length > 1 });
            persistAndBroadcast({ phase: r.phase, running: r.phase !== 'idle', remaining, phaseEndAt: r.phaseEndAt, done: r.done });
          }, LEADER_SETTLE_MS);
        }
      } else {
        setPhase(s.phase || 'idle');
        setRemaining(s.remaining ?? (cfg.study || 25) * 60);
        setDone(s.done || 0);
        setRunning(false);
      }
      setRestored(true);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 今日・今週の統計を読み込む（複数のフェーズ完走が短時間に続いても1回にまとめる） ----
  const refreshStats = useCallback(() => {
    if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
    refreshDebounceRef.current = setTimeout(() => {
      loadPomoLog().then((log) => {
        setPomoLogRaw(log);
        setStats({
          todaySec: totalStudySecSince(log, todayStart()),
          todayCount: countSince(log, todayStart()),
          weekSec: totalStudySecSince(log, weekStart()),
        });
      });
    }, 300);
  }, []);
  useEffect(() => { refreshStats(); }, [refreshStats]);

  // ---- 複数タブ間の同期＋幹事タブ判定（BroadcastChannel対応環境のみ） ----
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const bc = new BroadcastChannel(BC_NAME);
    bcRef.current = bc;
    const sendHello = () => {
      const visible = typeof document !== 'undefined' && document.visibilityState === 'visible';
      peersRef.current.set(tabIdRef.current, { at: Date.now(), visible });
      try { bc.postMessage({ type: 'hello', tabId: tabIdRef.current, visible }); } catch (e) { /* noop */ }
    };
    bc.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'hello') {
        peersRef.current.set(msg.tabId, { at: Date.now(), visible: !!msg.visible });
        return;
      }
      if (!('phase' in msg)) return;
      setPhase(msg.phase);
      setRunning(msg.running);
      setDone(msg.done);
      if (msg.running) setPhaseEndAt(msg.phaseEndAt);
      else setRemaining(msg.remaining);
    };
    sendHello();
    const helloTimer = setInterval(sendHello, HELLO_INTERVAL_MS);
    document.addEventListener('visibilitychange', sendHello);
    return () => {
      clearInterval(helloTimer);
      document.removeEventListener('visibilitychange', sendHello);
      bc.close();
    };
  }, []);
  const broadcast = (s) => { try { bcRef.current?.postMessage(s); } catch (e) { /* noop */ } };

  // ---- 保存＋他タブへの共有をまとめて行う ----
  // 実行中はphaseEndAtがあればremainingは受信側で使わないため、送るデータを削って
  // BroadcastChannelのメッセージを小さくする（保存の方は復元用にそのまま残す）。
  const persistAndBroadcast = useCallback((s) => {
    savePomoState(s);
    broadcast(s.running ? { phase: s.phase, running: true, phaseEndAt: s.phaseEndAt, done: s.done } : s);
  }, []);

  // 開始Music（保存済みBlob）を読み込む
  useEffect(() => {
    let url = null;
    storage.loadPomoMusic().then((blob) => {
      if (blob) {
        url = URL.createObjectURL(blob);
        setMusicUrl(url);
        setHasMusic(true);
      }
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  // 待機中は設定変更に合わせて残り時間を更新
  useEffect(() => {
    if (phase === 'idle' && !running) setRemaining((cfg.study || 25) * 60);
  }, [cfg.study, phase, running]);

  // ---- Wake Lock（実行中だけ画面を暗くしない。既定オフ） ----
  useEffect(() => {
    if (!running || !cfg.wakeLock || typeof navigator === 'undefined' || !navigator.wakeLock) return undefined;
    let cancelled = false;
    navigator.wakeLock.request('screen').then((lock) => { if (!cancelled) wakeLockRef.current = lock; else lock.release().catch(() => {}); }).catch(() => {});
    return () => {
      cancelled = true;
      wakeLockRef.current?.release?.().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [running, cfg.wakeLock]);

  const onBeepBlocked = useCallback(() => {
    onToast?.('🔇 効果音がブロックされました。画面のどこかを一度タップすると鳴るようになります。');
  }, [onToast]);

  // フェーズ遷移をまとめて処理（効果音・バイブ・トースト・通知・統計記録）。
  // silent=trueの時（バックグラウンドから復帰して複数フェーズをまとめて消化した時）は
  // 個別の音・トーストを繰り返さず、要約だけを1回出す。
  const processTransitions = useCallback((transitions, { silent = false } = {}) => {
    if (transitions.length === 0) return;
    for (const tr of transitions) {
      if (tr.wasStudy) {
        // 手動スキップで早めに切り上げた時は、実際に経過した秒数だけを記録する
        // （満額の勉強時間として記録すると統計が水増しされるため）。
        appendPomoLog({ studySec: tr.elapsedSec ?? durationSec('study', cfg), at: Date.now(), label: tag || undefined });
      }
    }
    refreshStats();
    const volume = cfg.beepVolume ?? 100;
    const suppressSound = activeView === 'audio'; // 音声学習中はビープを鳴らさず振動のみにする
    if (silent) {
      const studyCount = transitions.filter((t) => t.wasStudy).length;
      const msg = `⏱️ 離れている間に${transitions.length}回分のフェーズが経過しました（勉強${studyCount}回分）`;
      onToast?.(msg);
      setAnnounce(msg);
      if (cfg.beepEnabled !== false && !suppressSound) beep(1, toneFreq(cfg, 'break'), volume, onBeepBlocked);
      vibrate([120]);
      return;
    }
    const last = transitions[transitions.length - 1];
    const isLong = last.to === 'long';
    let msg;
    if (last.to === 'study') {
      msg = '📖 勉強を再開しましょう';
    } else if (isLong) {
      longBreakCountRef.current += 1;
      msg = `🎉 1セット完了！${harioPomoEncourage(longBreakCountRef.current)}`;
    } else {
      const tip = BREAK_TIPS[Math.floor(Math.random() * BREAK_TIPS.length)];
      msg = `☕ 短い休憩の時間です　${tip}`;
    }
    onToast?.(msg);
    setAnnounce(msg);
    notify('ポモドーロ', msg);
    if (cfg.beepEnabled !== false && !suppressSound) beep(2, last.to === 'study' ? toneFreq(cfg, 'study') : toneFreq(cfg, 'break'), volume, onBeepBlocked);
    vibrate([200, 80, 200]);
    if (last.wasStudy) setFocusPrompt(true); // 勉強フェーズが終わった直後：集中できたか聞く
  }, [cfg, tag, onToast, refreshStats, activeView, onBeepBlocked]);

  // ---- 1秒ごとの見直し（時刻ベース。表示はtickで再計算するだけ） ----
  useEffect(() => {
    if (!running || !cfg.enabled) {
      if (tickRef.current) clearInterval(tickRef.current);
      return undefined;
    }
    const check = () => {
      const n = now();
      if (n >= phaseEndAt) {
        const r = advanceState({ phase, phaseEndAt, done, cfg });
        setPhase(r.phase);
        setPhaseEndAt(r.phaseEndAt);
        setDone(r.done);
        // 統計記録・通知・保存は幹事タブだけが行う（複数タブでの2重カウント防止）。
        // 表示（phase/phaseEndAt/done）は全タブで同じ計算をするので、幹事以外でも正しく進む。
        if (isLeaderNow()) {
          processTransitions(r.transitions);
          persistTickRef.current = 0;
          persistAndBroadcast({ phase: r.phase, running: r.phase !== 'idle', remaining, phaseEndAt: r.phaseEndAt, done: r.done });
        }
      } else if (isLeaderNow()) {
        // 勉強中の途中通知（例：30分で10分おき）
        if (phase === 'study' && (cfg.notifyEvery || 0) > 0) {
          const totalDur = durationSec('study', cfg);
          const remain = Math.max(0, Math.ceil((phaseEndAt - n) / 1000));
          const elapsed = totalDur - remain;
          if (elapsed > 0 && elapsed % (cfg.notifyEvery * 60) === 0) {
            if (cfg.beepEnabled !== false && activeView !== 'audio') beep(1, toneFreq(cfg, 'break'), cfg.beepVolume ?? 100, onBeepBlocked);
            const mins = Math.round(elapsed / 60);
            onToast?.(`⏱️ 勉強${mins}分経過（残り${Math.round(remain / 60)}分）`);
            notify('ポモドーロ', `勉強${mins}分経過（残り${Math.round(remain / 60)}分）`);
          }
        }
        persistTickRef.current += 1;
        if (persistTickRef.current >= PERSIST_INTERVAL_TICKS) {
          persistTickRef.current = 0;
          persistAndBroadcast({ phase, running: true, remaining, phaseEndAt, done });
        }
      }
      setTick((t) => t + 1);
    };
    tickRef.current = setInterval(check, 1000);
    return () => clearInterval(tickRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, cfg.enabled, phase, phaseEndAt, done, cfg.notifyEvery, cfg.study, cfg.shortBreak, cfg.longBreak, cfg.cycles, cfg.beepEnabled, cfg.beepVolume, cfg.beepTone, activeView]);

  // タブが再表示された瞬間・bfcacheから復元された瞬間にも即座に追いつかせる
  // （バックグラウンドの間引き対策。pageshowはブラウザの「戻る」で復元された時に効く）。
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && running) setTick((t) => t + 1);
    };
    const onPageShow = () => { if (running) setTick((t) => t + 1); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [running]);

  const displayRemaining = remainingSecOf({ running, phaseEndAt, remaining }, now());
  void tick; // tickはこのレンダーを起こすためだけに参照する

  const playStartMusic = () => {
    if (cfg.startMusic && musicUrl && audioRef.current) {
      try {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      } catch (e) {
        /* noop */
      }
    }
  };
  const stopMusic = () => {
    try {
      audioRef.current?.pause();
    } catch (e) {
      /* noop */
    }
  };

  const start = () => {
    if ((cfg.notifyEvery || 0) > 0) requestNotifyPermissionIfNeeded();
    setFocusPrompt(false);
    setPauseReasonPrompt(false);
    let nextPhase = phase;
    let nextEnd = phaseEndAt;
    if (phase === 'idle') {
      nextPhase = 'study';
      nextEnd = now() + durationSec('study', cfg) * 1000;
      setPhase(nextPhase);
      setPhaseEndAt(nextEnd);
      playStartMusic();
      if (cfg.autoMinimizeOnStudy) setMin(true); // 集中モード：勉強が始まったら自動で最小化
    } else {
      // 一時停止からの再開：残り秒数から新しい終了時刻を組み立てる
      nextEnd = now() + remaining * 1000;
      setPhaseEndAt(nextEnd);
    }
    setRunning(true);
    persistAndBroadcast({ phase: nextPhase, running: true, remaining, phaseEndAt: nextEnd, done });
  };
  const pause = () => {
    const r = remainingSecOf({ running: true, phaseEndAt, remaining }, now());
    setRemaining(r);
    setRunning(false);
    if (phase === 'study') setPauseReasonPrompt(true); // 勉強中の中断だけ理由を任意で聞く
    persistAndBroadcast({ phase, running: false, remaining: r, phaseEndAt, done });
  };
  const toggle = () => (running ? pause() : start());

  const doReset = () => {
    setRunning(false);
    setPhase('idle');
    setDone(0);
    setRemaining(durationSec('study', cfg));
    setConfirmReset(false);
    setFocusPrompt(false);
    setPauseReasonPrompt(false);
    stopMusic();
    clearPomoState();
    broadcast({ phase: 'idle', running: false, remaining: durationSec('study', cfg), phaseEndAt: 0, done: 0 });
  };
  const reset = () => {
    // 進行中の記録が無ければ確認せずリセットする（待機中に押しても失うものが無いため）
    if (phase === 'idle' && done === 0) { doReset(); return; }
    setConfirmReset(true);
  };

  const skip = () => {
    stopMusic();
    if (phase === 'idle') {
      start();
      return;
    }
    // 勉強中に早めにスキップした場合は、満額ではなく実際に経過した秒数だけ記録する。
    const elapsedSec = phase === 'study'
      ? Math.max(0, durationSec('study', cfg) - remainingSecOf({ running, phaseEndAt, remaining }, now()))
      : undefined;
    const { next, done: newDone, wasStudy } = nextPhaseAfter(phase, done, cfg);
    const nextEnd = now() + durationSec(next, cfg) * 1000;
    setPhase(next);
    setDone(newDone);
    setPhaseEndAt(nextEnd);
    processTransitions([{ from: phase, to: next, wasStudy, elapsedSec }]);
    persistAndBroadcast({ phase: next, running: true, remaining, phaseEndAt: nextEnd, done: newDone });
  };
  // 勉強中のスキップは長押しでだけ確定する（誤操作で進行中の勉強を失わないため）。
  // 休憩中は失うものが無いので普通のタップでよい。
  const skipPress = useLongPress(
    () => skip(),
    () => { if (phase === 'study') onToast?.('⏭ 勉強中のスキップは長押しで確定します（誤操作防止）'); else skip(); }
  );

  // ワンタップ延長（+5分）。実行中はphaseEndAtへ、停止中はremainingへ加える。
  const extend = (sec = 300) => {
    if (running) {
      const nextEnd = phaseEndAt + sec * 1000;
      setPhaseEndAt(nextEnd);
      persistAndBroadcast({ phase, running: true, remaining, phaseEndAt: nextEnd, done });
    } else {
      const r = remaining + sec;
      setRemaining(r);
      persistAndBroadcast({ phase, running: false, remaining: r, phaseEndAt, done });
    }
  };

  const pickMusic = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const MAX_BYTES = 15 * 1024 * 1024; // 15MB。上限なしだと端末内保存(IndexedDB)を圧迫するため
    if (f.size > MAX_BYTES) {
      onToast?.('⚠️ ファイルが大きすぎます（15MBまで）。短い曲・効果音向けの音源を選んでください。');
      return;
    }
    await storage.savePomoMusic(f);
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    const url = URL.createObjectURL(f);
    setMusicUrl(url);
    setHasMusic(true);
    setCfg({ startMusic: true });
    onToast?.('開始Musicを設定しました');
  };
  const removeMusic = async () => {
    await storage.clearPomoMusic();
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    setMusicUrl(null);
    setHasMusic(false);
    setCfg({ startMusic: false });
    onToast?.('開始Musicを削除しました');
  };

  // 今回の勉強内容タグ：フォーカスが外れたら直近5件のユニークな履歴として覚え、
  // 次回はチップからワンタップで再利用できるようにする（毎回打ち直さなくて済むように）。
  const commitTagToHistory = () => {
    const t = tag.trim();
    if (!t) return;
    const hist = cfg.tagHistory || [];
    const next = [t, ...hist.filter((x) => x !== t)].slice(0, 5);
    if (JSON.stringify(next) !== JSON.stringify(hist)) setCfg({ tagHistory: next });
  };

  const exportStatsCsv = () => downloadFile(exportPomoLogCsv(pomoLogRaw), 'shinkyu_pomodoro_log.csv', 'text/csv');
  const resetStats = async () => {
    await clearPomoLog();
    setPomoLogRaw([]);
    setStats({ todaySec: 0, todayCount: 0, weekSec: 0 });
    onToast?.('ポモドーロの統計を消去しました');
  };

  // キーボードショートカット（スペースキーで開始/一時停止）。
  // 入力欄にフォーカスがある時は誤爆するので対象外にする。
  useEffect(() => {
    if (!cfg.enabled) return undefined;
    const onKey = (e) => {
      if (e.code !== 'Space') return;
      const tagName = document.activeElement?.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || document.activeElement?.isContentEditable) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.enabled, running, phase, phaseEndAt, remaining, done]);

  // 最小化バーとフルバーで実際の高さが違う（45px vs 66px）のに、下の.app-headerは
  // 固定値--pomo-hしか見ていなかったため、最小化時に約21pxの隙間ができていた。
  // 実測してCSS変数に反映することで、どちらの表示でも隙間が空かないようにする。
  // ただし「最小化中は画面下」設定の時は position: fixed で画面上のスペースを
  // 占有しないので、その場合だけ0に固定する（そうしないとヘッダーが不要に下がる）。
  useEffect(() => {
    if (!cfg.enabled || !barRef.current) return undefined;
    const el = barRef.current;
    const isFloating = cfg.barPosition === 'bottom' && min;
    const applyHeight = () => document.documentElement.style.setProperty('--pomo-h', isFloating ? '0px' : `${el.offsetHeight}px`);
    applyHeight();
    if (isFloating || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(applyHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cfg.enabled, min, cfg.barPosition]);

  if (!cfg.enabled || !restored) return null;

  const total = durationSec(phase === 'idle' ? 'study' : phase, cfg);
  // 実行中に分数設定を変えて total < remaining になっても、進捗バーの幅が
  // 負の%やCSS上不正な値にならないよう0〜100へ丸める。
  const pct = total > 0 ? Math.min(100, Math.max(0, ((total - displayRemaining) / total) * 100)) : 0;
  const ph = PHASES[phase];
  const cycles = cfg.cycles || 4;
  const dueReviewCount = store?.dueReviewQuestions?.length || 0;
  const beepOn = cfg.beepEnabled !== false;

  const srAnnounce = <div aria-live="polite" className="sr-only">{announce}</div>;

  // 最小化表示：使っていない時は細い1行だけにして画面を占有しない
  if (min) {
    const floating = cfg.barPosition === 'bottom';
    return (
      <div className={`pomo-bar mini ${floating ? 'bottom-float' : ''} ${ph.cls}`} ref={barRef}>
        <audio ref={audioRef} src={musicUrl || undefined} preload="auto" />
        {srAnnounce}
        <button className="pomo-mini-body" onClick={() => setMin(false)} aria-label="タイマーを開く">
          <span className="pomo-phase">{phase === 'study' ? '📖' : phase === 'short' ? '☕' : phase === 'long' ? '🌴' : '⏱️'}</span>
          <span className="pomo-time sm">{mmss(displayRemaining)}</span>
          {running && <span className="pomo-mini-run">●</span>}
          <span className="pomo-mini-hint">タイマー ▾</span>
        </button>
        <div className="pomo-controls">
          <button className="pomo-btn main" onClick={toggle} aria-label="開始/一時停止">{running ? '⏸' : '▶'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`pomo-bar ${ph.cls}`} ref={barRef}>
      <audio ref={audioRef} src={musicUrl || undefined} preload="auto" />
      {srAnnounce}
      <div className="pomo-main">
        <span className="pomo-phase">
          {phase === 'study' ? '📖' : phase === 'short' ? '☕' : phase === 'long' ? '🌴' : '⏱️'} {ph.label}
        </span>
        <span className="pomo-time">{mmss(displayRemaining)}</span>
        <div className="pomo-controls">
          <button className="pomo-btn main" onClick={toggle} aria-label="開始/一時停止">{running ? '⏸' : '▶'}</button>
          {phase !== 'idle' && (
            <button className="pomo-btn" onClick={() => extend(300)} aria-label="5分延長" title="5分延長">+5</button>
          )}
          <button className="pomo-btn" onClick={() => setCfg({ beepEnabled: !beepOn })} aria-label={beepOn ? '効果音をミュート' : '効果音を戻す'} title="効果音のクイックミュート">
            {beepOn ? '🔊' : '🔇'}
          </button>
          <button className="pomo-btn" {...skipPress} aria-label="次へ" title="勉強中は長押しでスキップ">⏭</button>
          <button className="pomo-btn" onClick={reset} aria-label="リセット">⟲</button>
          <button className="pomo-btn" onClick={() => setOpen((v) => !v)} aria-label="設定">⚙</button>
          <button className="pomo-btn" onClick={() => { setOpen(false); setMin(true); }} aria-label="最小化">▴</button>
        </div>
      </div>
      <div className="pomo-progress"><span style={{ width: `${pct}%` }} /></div>
      <div className="pomo-cycles">
        {Array.from({ length: cycles }).map((_, i) => (
          <i key={i} className={i < done % cycles || (done > 0 && done % cycles === 0 && phase === 'long') ? 'on' : ''} />
        ))}
        <span className="pomo-cycles-label">サイクル {(done % cycles) || (done > 0 && done % cycles === 0 ? cycles : 0)}/{cycles}</span>
      </div>
      <div className="pomo-stats">
        今日 {Math.round(stats.todaySec / 60)}分（{stats.todayCount}回）・今週 {Math.round(stats.weekSec / 60)}分
        {(cfg.dailyGoalMin || 0) > 0 && ` ／ 目標${cfg.dailyGoalMin}分中`}
      </div>
      {(cfg.dailyGoalMin || 0) > 0 && (
        <div className="pomo-progress goal"><span style={{ width: `${Math.min(100, (stats.todaySec / 60 / cfg.dailyGoalMin) * 100)}%` }} /></div>
      )}
      {dueReviewCount > 0 && phase !== 'idle' && (
        <div className="pomo-hint" style={{ color: 'rgba(255,255,255,0.75)' }}>📚 復習が{dueReviewCount}問たまっています（休憩の合間にどうぞ）</div>
      )}

      {focusPrompt && (
        <div className="pomo-focus-check">
          <span>集中できた？</span>
          {FOCUS_LEVELS.map((f) => (
            <button key={f.level} className="pomo-focus-btn" onClick={() => { appendPomoFocus(f.level); setFocusPrompt(false); }} title={f.label} aria-label={f.label}>{f.ico}</button>
          ))}
          <button className="pomo-focus-skip" onClick={() => setFocusPrompt(false)} aria-label="閉じる">×</button>
        </div>
      )}
      {pauseReasonPrompt && (
        <div className="pomo-pause-reason">
          <span>中断理由（任意）</span>
          <div className="chip-row">
            {PAUSE_REASONS.map((r) => (
              <button key={r} className="chip" onClick={() => { appendPauseReason(r); setPauseReasonPrompt(false); }}>{r}</button>
            ))}
            <button className="chip-remove" onClick={() => setPauseReasonPrompt(false)} aria-label="閉じる">×</button>
          </div>
        </div>
      )}

      {confirmReset && (
        <div className="pomo-config">
          <p className="pomo-hint" style={{ margin: '0 0 8px', color: 'var(--text)' }}>本当にリセットしますか？（現在の進行状況が失われます）</p>
          <div className="btn-row">
            <button className="btn danger sm" onClick={doReset}>はい、リセットする</button>
            <button className="btn ghost sm" onClick={() => setConfirmReset(false)}>いいえ</button>
          </div>
        </div>
      )}

      {open && !confirmReset && (
        <div className="pomo-config">
          <p className="pomo-hint" style={{ marginTop: 0 }}>📖勉強・☕短い休憩・🌴長い休憩</p>
          <Suspense fallback={<p className="pomo-hint">読み込み中…</p>}>
            <PomodoroConfigFields cfg={cfg} setCfg={setCfg} />
          </Suspense>

          <div className="pomo-tag-row">
            <label className="pomo-tag-label">
              今回の勉強内容（任意）
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                onBlur={commitTagToHistory}
                placeholder="例：解剖学・上肢神経"
                maxLength={40}
              />
            </label>
            {(cfg.tagHistory || []).length > 0 && (
              <div className="chip-row" style={{ marginTop: 6 }}>
                {(cfg.tagHistory || []).map((t) => (
                  <button key={t} className="chip" onClick={() => setTag(t)}>{t}</button>
                ))}
              </div>
            )}
          </div>

          <div className="pomo-music">
            <label className="pomo-switch">
              <input type="checkbox" checked={!!cfg.startMusic} onChange={(e) => setCfg({ startMusic: e.target.checked })} disabled={!hasMusic} />
              <span>勉強開始Musicを鳴らす（気分を上げる）</span>
            </label>
            <div className="pomo-music-row">
              <input ref={fileRef} type="file" accept="audio/*" onChange={pickMusic} style={{ display: 'none' }} />
              <button className="btn sm" onClick={() => fileRef.current?.click()}>🎵 音楽ファイルを選ぶ</button>
              {hasMusic && (
                <>
                  <button className="btn sm ghost" onClick={playStartMusic}>試聴</button>
                  <button className="btn sm ghost" onClick={removeMusic}>削除</button>
                </>
              )}
            </div>
            <div className="pomo-hint">
              {hasMusic ? '設定済み。勉強開始時に再生されます。' : '端末の音楽ファイルを選ぶと、勉強開始時に再生できます（15MBまで）。'}
            </div>
          </div>

          <Suspense fallback={null}>
            <PomodoroStatsPanel log={pomoLogRaw} onExportCsv={exportStatsCsv} onResetStats={resetStats} />
          </Suspense>

          {onNavigate && (
            <button className="btn ghost sm block" style={{ marginTop: 8 }} onClick={() => onNavigate('g100guide')}>
              ⏱️ G-100ガイドの「時間攻め」も見る（一問一答の5秒/10秒モード）
            </button>
          )}

          <p className="pomo-hint">キーボードのスペースキーで開始/一時停止できます（入力欄にフォーカスが無い時）。</p>

          <button className="btn ghost sm block" style={{ marginTop: 8 }} onClick={() => { doReset(); setCfg({ enabled: false }); setOpen(false); }}>
            ポモドーロを閉じる（オフにする）
          </button>
        </div>
      )}
    </div>
  );
}
