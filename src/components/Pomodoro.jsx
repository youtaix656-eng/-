import { useEffect, useRef, useState, useCallback } from 'react';
import * as storage from '../lib/storage.js';
import { durationSec, mmss, nextPhaseAfter, advanceState, remainingSecOf } from '../lib/pomodoroLogic.js';
import { loadPomoState, savePomoState, clearPomoState } from '../lib/pomoState.js';
import { loadPomoLog, appendPomoLog, todayStart, weekStart, totalStudySecSince, countSince } from '../lib/pomoLog.js';

// ポモドーロタイマー（全画面の上部に固定表示）
// ・勉強／短い休憩／長い休憩の時間を自由に設定
// ・勉強中、任意で通知（例：30分なら10分おき）
// ・勉強開始Musicの再生ON/OFF＋音声ファイルの設定
// App のルートに常駐するので、画面を切り替えてもカウントは継続する。
//
// 時刻ベース設計：残り時間を1秒ずつ減算するのではなく「フェーズが終わる時刻
// （phaseEndAt）」を持ち、今の時刻との差から毎回計算し直す（lib/pomodoroLogic.js）。
// バックグラウンドでタブが眠っていても、再開時に正しい位置まで一気に辿れる。
const PHASES = {
  idle: { label: '待機中', cls: 'idle' },
  study: { label: '勉強', cls: 'study' },
  short: { label: '短い休憩', cls: 'short' },
  long: { label: '長い休憩', cls: 'long' },
};

const BC_NAME = 'shinkyu-pomo';

function beep(times = 1, freq = 880) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    let t = ctx.currentTime;
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.start(t);
      o.stop(t + 0.26);
      t += 0.34;
    }
    // 鳴らし終わったらcloseする。開けっぱなしのAudioContextが積み重なると
    // ブラウザ側の上限に達しうるため。
    const totalMs = (t - ctx.currentTime) * 1000 + 100;
    setTimeout(() => { ctx.close().catch(() => {}); }, totalMs);
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

// 通知の許可を1か所からリクエストする（複数箇所に同じ分岐が散らばっていたのを統一）。
function requestNotifyPermissionIfNeeded() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

function notifyStatusLabel() {
  if (typeof Notification === 'undefined') return 'この端末では通知に対応していません';
  if (Notification.permission === 'granted') return '許可済み';
  if (Notification.permission === 'denied') return 'ブロックされています（ブラウザの設定から許可してください）';
  return '未確認（通知間隔を設定すると確認されます）';
}

// 科目の重さ・場面別プリセット（ワンタップで勉強/短い休憩の分数を切り替える）。
// 長い休憩・サイクル回数は個人差が大きいのでプリセットに含めず、既存の設定のまま残す。
const POMO_PRESETS = [
  { id: 'heavy', label: '重い科目（25+5）', study: 25, shortBreak: 5, hint: '解剖学・生理学など、じっくり読み解く科目向け' },
  { id: 'light', label: '軽い科目（15+5）', study: 15, shortBreak: 5, hint: '一問一答の反復など、テンポよく回す科目向け' },
  { id: 'gap', label: '隙間時間（10分×3）', study: 10, shortBreak: 3, hint: '通勤・休憩の合間など、短時間だけ確保できる時' },
];

// 分・回数などの数値入力欄。value(確定値)をそのままcontrolled inputに渡すと、
// 全消しして2桁の新しい数字を打つ途中（一瞬空文字→0扱い）にmin側へ強制的に
// スナップして「一桁残さないと入力できない」状態になる。ここでは入力中は
// 自由な文字列（空欄も含む）をローカルに保持し、フォーカスが外れた時にだけ
// min/maxへ丸めて確定する。stepボタン（＋/－）も併設し、スマホでも調整しやすくする。
export function PomoNumberField({ label, value, min, max, step = 1, onCommit }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = (raw) => {
    const n = parseInt(raw, 10);
    const clamped = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : value;
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };
  const bump = (delta) => {
    const cur = Number.isFinite(parseInt(draft, 10)) ? parseInt(draft, 10) : value;
    commit(String(Math.min(max, Math.max(min, cur + delta))));
  };
  return (
    <label>
      {label}
      <span className="pomo-num-row">
        <button type="button" className="pomo-num-step" onClick={() => bump(-step)} aria-label={`${label}を減らす`}>－</button>
        <input
          type="number"
          min={min}
          max={max}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        />
        <button type="button" className="pomo-num-step" onClick={() => bump(step)} aria-label={`${label}を増やす`}>＋</button>
      </span>
    </label>
  );
}

// 設定フィールド一式（プリセット＋分数＋通知＋カスタムプリセット保存）。
// ポモドーロのバー（⚙）と、設定画面（表示オフの間も調整できるように）の両方から使う。
export function PomodoroConfigFields({ cfg, setCfg }) {
  const customPresets = cfg.customPresets || [];
  const [notifyStatus, setNotifyStatus] = useState(notifyStatusLabel());
  useEffect(() => {
    const t = setInterval(() => setNotifyStatus(notifyStatusLabel()), 2000);
    return () => clearInterval(t);
  }, []);
  const saveCustomPreset = () => {
    const label = `カスタム（${cfg.study || 25}+${cfg.shortBreak || 5}）`;
    if (customPresets.some((p) => p.study === (cfg.study || 25) && p.shortBreak === (cfg.shortBreak || 5))) return;
    const next = [...customPresets, { id: `custom-${Date.now()}`, label, study: cfg.study || 25, shortBreak: cfg.shortBreak || 5 }].slice(-5);
    setCfg({ customPresets: next });
  };
  const removeCustomPreset = (id) => setCfg({ customPresets: customPresets.filter((p) => p.id !== id) });

  return (
    <>
      <div className="chip-row" style={{ marginBottom: 8 }}>
        {POMO_PRESETS.map((p) => (
          <button
            key={p.id}
            className={`chip ${cfg.study === p.study && cfg.shortBreak === p.shortBreak ? 'active' : ''}`}
            onClick={() => setCfg({ study: p.study, shortBreak: p.shortBreak })}
            title={p.hint}
          >
            {p.label}
          </button>
        ))}
        {customPresets.map((p) => (
          <span key={p.id} className={`chip-with-remove ${cfg.study === p.study && cfg.shortBreak === p.shortBreak ? 'active' : ''}`}>
            <button className="chip" onClick={() => setCfg({ study: p.study, shortBreak: p.shortBreak })}>{p.label}</button>
            <button className="chip-remove" onClick={() => removeCustomPreset(p.id)} aria-label={`${p.label}を削除`}>×</button>
          </span>
        ))}
        <button className="chip" onClick={saveCustomPreset} title="今の勉強・短い休憩の分数を組み合わせとして保存">＋ 現在の組み合わせを保存</button>
      </div>
      <div className="pomo-config-grid">
        <PomoNumberField label="勉強（分）" min={1} max={180} step={5} value={cfg.study || 25} onCommit={(n) => setCfg({ study: n })} />
        <PomoNumberField label="短い休憩（分）" min={1} max={60} step={5} value={cfg.shortBreak || 5} onCommit={(n) => setCfg({ shortBreak: n })} />
        <PomoNumberField label="長い休憩（分）" min={1} max={120} step={5} value={cfg.longBreak || 15} onCommit={(n) => setCfg({ longBreak: n })} />
        <PomoNumberField
          label="長休憩まで（回）"
          min={1}
          max={12}
          value={cfg.cycles || 4}
          onCommit={(n) => setCfg({ cycles: n })}
        />
        <PomoNumberField
          label="勉強中の通知（分おき・0でなし）"
          min={0}
          max={60}
          value={cfg.notifyEvery || 0}
          onCommit={(n) => {
            setCfg({ notifyEvery: n });
            if (n > 0) requestNotifyPermissionIfNeeded();
          }}
        />
      </div>
      <p className="pomo-hint">通知の許可状態：{notifyStatus}</p>
      {(cfg.notifyEvery || 0) > 0 && (cfg.notifyEvery || 0) >= (cfg.study || 25) && (
        <p className="pomo-hint" style={{ color: 'var(--wrong, #c62828)' }}>
          ⚠️ 通知間隔（{cfg.notifyEvery}分）が勉強時間（{cfg.study || 25}分）以上のため、この設定では通知が一度も鳴りません。
        </p>
      )}
      <p className="pomo-hint">「長休憩まで（回）」を変更すると、現在の位置（◯/◯）もその場で新しい回数で数え直されます。</p>
      <label className="pomo-switch" style={{ marginTop: 10 }}>
        <input type="checkbox" checked={cfg.beepEnabled !== false} onChange={(e) => setCfg({ beepEnabled: e.target.checked })} />
        <span>フェーズ切り替え時に効果音を鳴らす</span>
      </label>
      <label className="pomo-switch" style={{ marginTop: 6 }}>
        <input type="checkbox" checked={!!cfg.wakeLock} onChange={(e) => setCfg({ wakeLock: e.target.checked })} />
        <span>実行中は画面を暗くしない（対応端末のみ）</span>
      </label>
    </>
  );
}

export default function Pomodoro({ store, onToast }) {
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
  const [tick, setTick] = useState(0); // 1秒ごとに増やして表示を再計算させるためだけの値
  const [restored, setRestored] = useState(false);

  const audioRef = useRef(null);
  const fileRef = useRef(null);
  const tickRef = useRef(null);
  const barRef = useRef(null);
  const bcRef = useRef(null);
  const wakeLockRef = useRef(null);
  const persistTickRef = useRef(0);

  const now = () => Date.now();

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
        if (r.transitions.length > 0) processTransitions(r.transitions, { silent: r.transitions.length > 1 });
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

  // ---- 今日・今週の統計を読み込む ----
  const refreshStats = useCallback(() => {
    loadPomoLog().then((log) => {
      setStats({
        todaySec: totalStudySecSince(log, todayStart()),
        todayCount: countSince(log, todayStart()),
        weekSec: totalStudySecSince(log, weekStart()),
      });
    });
  }, []);
  useEffect(() => { refreshStats(); }, [refreshStats]);

  // ---- 複数タブ間の同期（BroadcastChannel対応環境のみ） ----
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const bc = new BroadcastChannel(BC_NAME);
    bcRef.current = bc;
    bc.onmessage = (ev) => {
      const s = ev.data;
      if (!s || typeof s !== 'object') return;
      setPhase(s.phase);
      setRunning(s.running);
      setDone(s.done);
      if (s.running) setPhaseEndAt(s.phaseEndAt);
      else setRemaining(s.remaining);
    };
    return () => bc.close();
  }, []);
  const broadcast = (s) => { try { bcRef.current?.postMessage(s); } catch (e) { /* noop */ } };

  // ---- 保存＋他タブへの共有をまとめて行う ----
  const persistAndBroadcast = useCallback((s) => {
    savePomoState(s);
    broadcast(s);
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

  // フェーズ遷移をまとめて処理（効果音・バイブ・トースト・通知・統計記録）。
  // silent=trueの時（バックグラウンドから復帰して複数フェーズをまとめて消化した時）は
  // 個別の音・トーストを繰り返さず、要約だけを1回出す。
  const processTransitions = useCallback((transitions, { silent = false } = {}) => {
    if (transitions.length === 0) return;
    for (const tr of transitions) {
      if (tr.wasStudy) {
        appendPomoLog({ studySec: durationSec('study', cfg), at: Date.now(), label: tag || undefined });
      }
    }
    refreshStats();
    if (silent) {
      const studyCount = transitions.filter((t) => t.wasStudy).length;
      const msg = `⏱️ 離れている間に${transitions.length}回分のフェーズが経過しました（勉強${studyCount}回分）`;
      onToast?.(msg);
      setAnnounce(msg);
      if (cfg.beepEnabled !== false) beep(1, 660);
      return;
    }
    const last = transitions[transitions.length - 1];
    const isLong = last.to === 'long';
    const msg = last.to === 'study' ? '📖 勉強を再開しましょう' : isLong ? '🎉 長い休憩の時間です' : '☕ 短い休憩の時間です';
    onToast?.(msg);
    setAnnounce(msg);
    notify('ポモドーロ', msg);
    if (cfg.beepEnabled !== false) beep(2, last.to === 'study' ? 660 : 880);
    vibrate([200, 80, 200]);
  }, [cfg, tag, onToast, refreshStats]);

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
        processTransitions(r.transitions);
        persistTickRef.current = 0;
        persistAndBroadcast({ phase: r.phase, running: r.phase !== 'idle', remaining, phaseEndAt: r.phaseEndAt, done: r.done });
      } else {
        // 勉強中の途中通知（例：30分で10分おき）
        if (phase === 'study' && (cfg.notifyEvery || 0) > 0) {
          const totalDur = durationSec('study', cfg);
          const remain = Math.max(0, Math.ceil((phaseEndAt - n) / 1000));
          const elapsed = totalDur - remain;
          if (elapsed > 0 && elapsed % (cfg.notifyEvery * 60) === 0) {
            beep(1);
            const mins = Math.round(elapsed / 60);
            onToast?.(`⏱️ 勉強${mins}分経過（残り${Math.round(remain / 60)}分）`);
            notify('ポモドーロ', `勉強${mins}分経過（残り${Math.round(remain / 60)}分）`);
          }
        }
        persistTickRef.current += 1;
        if (persistTickRef.current >= 15) { // 15秒おきに保存（毎秒書き込みしない）
          persistTickRef.current = 0;
          persistAndBroadcast({ phase, running: true, remaining, phaseEndAt, done });
        }
      }
      setTick((t) => t + 1);
    };
    tickRef.current = setInterval(check, 1000);
    return () => clearInterval(tickRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, cfg.enabled, phase, phaseEndAt, done, cfg.notifyEvery, cfg.study, cfg.shortBreak, cfg.longBreak, cfg.cycles]);

  // タブが再表示された瞬間にも即座に追いつかせる（バックグラウンドの間引き対策）
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && running) setTick((t) => t + 1);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
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
    let nextPhase = phase;
    let nextEnd = phaseEndAt;
    if (phase === 'idle') {
      nextPhase = 'study';
      nextEnd = now() + durationSec('study', cfg) * 1000;
      setPhase(nextPhase);
      setPhaseEndAt(nextEnd);
      playStartMusic();
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
    persistAndBroadcast({ phase, running: false, remaining: r, phaseEndAt, done });
  };
  const toggle = () => (running ? pause() : start());

  const doReset = () => {
    setRunning(false);
    setPhase('idle');
    setDone(0);
    setRemaining(durationSec('study', cfg));
    setConfirmReset(false);
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
    const { next, done: newDone, wasStudy } = nextPhaseAfter(phase, done, cfg);
    const nextEnd = now() + durationSec(next, cfg) * 1000;
    setPhase(next);
    setDone(newDone);
    setPhaseEndAt(nextEnd);
    processTransitions([{ from: phase, to: next, wasStudy }]);
    persistAndBroadcast({ phase: next, running: true, remaining, phaseEndAt: nextEnd, done: newDone });
  };

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
  useEffect(() => {
    if (!cfg.enabled || !barRef.current) return undefined;
    const el = barRef.current;
    const applyHeight = () => document.documentElement.style.setProperty('--pomo-h', `${el.offsetHeight}px`);
    applyHeight();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(applyHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cfg.enabled, min]);

  if (!cfg.enabled || !restored) return null;

  const total = durationSec(phase === 'idle' ? 'study' : phase, cfg);
  // 実行中に分数設定を変えて total < remaining になっても、進捗バーの幅が
  // 負の%やCSS上不正な値にならないよう0〜100へ丸める。
  const pct = total > 0 ? Math.min(100, Math.max(0, ((total - displayRemaining) / total) * 100)) : 0;
  const ph = PHASES[phase];
  const cycles = cfg.cycles || 4;

  const srAnnounce = <div aria-live="polite" className="sr-only">{announce}</div>;

  // 最小化表示：使っていない時は細い1行だけにして画面を占有しない
  if (min) {
    return (
      <div className={`pomo-bar mini ${ph.cls}`} ref={barRef}>
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
          <button className="pomo-btn" onClick={skip} aria-label="次へ">⏭</button>
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
      </div>

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
          <PomodoroConfigFields cfg={cfg} setCfg={setCfg} />

          <div className="pomo-tag-row">
            <label className="pomo-tag-label">
              今回の勉強内容（任意）
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="例：解剖学・上肢神経"
                maxLength={40}
              />
            </label>
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

          <p className="pomo-hint">キーボードのスペースキーで開始/一時停止できます（入力欄にフォーカスが無い時）。</p>

          <button className="btn ghost sm block" style={{ marginTop: 8 }} onClick={() => { doReset(); setCfg({ enabled: false }); setOpen(false); }}>
            ポモドーロを閉じる（オフにする）
          </button>
        </div>
      )}
    </div>
  );
}
