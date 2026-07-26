import { useEffect, useRef, useState } from 'react';
import * as storage from '../lib/storage.js';

// ポモドーロタイマー（全画面の上部に固定表示）
// ・勉強／短い休憩／長い休憩の時間を自由に設定
// ・勉強中、任意で通知（例：30分なら10分おき）
// ・勉強開始Musicの再生ON/OFF＋音声ファイルの設定
// App のルートに常駐するので、画面を切り替えてもカウントは継続する。
const PHASES = {
  idle: { label: '待機中', cls: 'idle' },
  study: { label: '勉強', cls: 'study' },
  short: { label: '短い休憩', cls: 'short' },
  long: { label: '長い休憩', cls: 'long' },
};

function beep(times = 1) {
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
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.start(t);
      o.stop(t + 0.26);
      t += 0.34;
    }
  } catch (e) {
    /* noop */
  }
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

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function Pomodoro({ store, onToast }) {
  const cfg = store.settings.pomodoro || {};
  const { updateSettings } = store;

  const [phase, setPhase] = useState('idle');
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState((cfg.study || 25) * 60);
  const [done, setDone] = useState(0); // 完了した勉強回数（長休憩の判定に使用）
  const [open, setOpen] = useState(false);
  const [musicUrl, setMusicUrl] = useState(null);
  const [hasMusic, setHasMusic] = useState(false);
  const audioRef = useRef(null);
  const fileRef = useRef(null);
  const tickRef = useRef(null);

  const dur = (p) =>
    (p === 'study' ? cfg.study || 25 : p === 'short' ? cfg.shortBreak || 5 : p === 'long' ? cfg.longBreak || 15 : cfg.study || 25) * 60;

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

  // 1秒ごとのカウントダウン
  useEffect(() => {
    if (!running) {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    tickRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r > 1) {
          const next = r - 1;
          // 勉強中の途中通知（例：30分で10分おき）
          if (phase === 'study' && (cfg.notifyEvery || 0) > 0) {
            const elapsed = dur('study') - next;
            if (elapsed > 0 && elapsed % (cfg.notifyEvery * 60) === 0 && next > 0) {
              beep(1);
              const mins = Math.round(elapsed / 60);
              onToast?.(`⏱️ 勉強${mins}分経過（残り${Math.round(next / 60)}分）`);
              notify('ポモドーロ', `勉強${mins}分経過（残り${Math.round(next / 60)}分）`);
            }
          }
          return next;
        }
        // フェーズ終了 → 次へ
        advance();
        return 0;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase, cfg.notifyEvery, cfg.study, cfg.shortBreak, cfg.longBreak, cfg.cycles]);

  const advance = () => {
    if (phase === 'study') {
      const n = done + 1;
      setDone(n);
      const isLong = n % (cfg.cycles || 4) === 0;
      const nextPhase = isLong ? 'long' : 'short';
      beep(2);
      onToast?.(isLong ? '🎉 長い休憩の時間です' : '☕ 短い休憩の時間です');
      notify('ポモドーロ', isLong ? '長い休憩の時間です' : '短い休憩の時間です');
      setPhase(nextPhase);
      setRemaining(dur(nextPhase));
    } else {
      // 休憩終了 → 勉強へ
      beep(2);
      onToast?.('📖 勉強を再開しましょう');
      notify('ポモドーロ', '勉強を再開しましょう');
      setPhase('study');
      setRemaining(dur('study'));
    }
  };

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
    if ((cfg.notifyEvery || 0) > 0 && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    if (phase === 'idle') {
      setPhase('study');
      setRemaining(dur('study'));
      playStartMusic(); // 勉強開始Music（気分を上げる）
    }
    setRunning(true);
  };
  const pause = () => setRunning(false);
  const toggle = () => (running ? pause() : start());
  const reset = () => {
    setRunning(false);
    setPhase('idle');
    setDone(0);
    setRemaining(dur('study'));
    stopMusic();
  };
  const skip = () => {
    stopMusic();
    if (phase === 'idle') {
      setPhase('study');
      setRemaining(dur('study'));
    } else {
      advance();
    }
  };

  const setCfg = (patch) => updateSettings({ pomodoro: { ...cfg, ...patch } });

  const pickMusic = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
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

  if (!cfg.enabled) return null;

  const total = dur(phase === 'idle' ? 'study' : phase);
  const pct = total > 0 ? ((total - remaining) / total) * 100 : 0;
  const ph = PHASES[phase];
  const cycles = cfg.cycles || 4;

  return (
    <div className={`pomo-bar ${ph.cls}`}>
      <audio ref={audioRef} src={musicUrl || undefined} preload="auto" />
      <div className="pomo-main">
        <span className="pomo-phase">
          {phase === 'study' ? '📖' : phase === 'short' ? '☕' : phase === 'long' ? '🌴' : '⏱️'} {ph.label}
        </span>
        <span className="pomo-time">{mmss(remaining)}</span>
        <div className="pomo-controls">
          <button className="pomo-btn main" onClick={toggle} aria-label="開始/一時停止">{running ? '⏸' : '▶'}</button>
          <button className="pomo-btn" onClick={skip} aria-label="次へ">⏭</button>
          <button className="pomo-btn" onClick={reset} aria-label="リセット">⟲</button>
          <button className="pomo-btn" onClick={() => setOpen((v) => !v)} aria-label="設定">⚙</button>
        </div>
      </div>
      <div className="pomo-progress"><span style={{ width: `${pct}%` }} /></div>
      <div className="pomo-cycles">
        {Array.from({ length: cycles }).map((_, i) => (
          <i key={i} className={i < done % cycles || (done > 0 && done % cycles === 0 && phase === 'long') ? 'on' : ''} />
        ))}
        <span className="pomo-cycles-label">サイクル {(done % cycles) || (done > 0 && done % cycles === 0 ? cycles : 0)}/{cycles}</span>
      </div>

      {open && (
        <div className="pomo-config">
          <div className="pomo-config-grid">
            <label>勉強（分）
              <input type="number" min="1" max="180" value={cfg.study || 25} onChange={(e) => setCfg({ study: Math.max(1, +e.target.value || 1) })} />
            </label>
            <label>短い休憩（分）
              <input type="number" min="1" max="60" value={cfg.shortBreak || 5} onChange={(e) => setCfg({ shortBreak: Math.max(1, +e.target.value || 1) })} />
            </label>
            <label>長い休憩（分）
              <input type="number" min="1" max="120" value={cfg.longBreak || 15} onChange={(e) => setCfg({ longBreak: Math.max(1, +e.target.value || 1) })} />
            </label>
            <label>長休憩まで（回）
              <input type="number" min="1" max="12" value={cfg.cycles || 4} onChange={(e) => setCfg({ cycles: Math.max(1, +e.target.value || 1) })} />
            </label>
            <label>勉強中の通知（分おき・0でなし）
              <input type="number" min="0" max="60" value={cfg.notifyEvery || 0} onChange={(e) => setCfg({ notifyEvery: Math.max(0, +e.target.value || 0) })} />
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
              {hasMusic ? '設定済み。勉強開始時に再生されます。' : '端末の音楽ファイルを選ぶと、勉強開始時に再生できます。'}
            </div>
          </div>

          <button className="btn ghost sm block" style={{ marginTop: 8 }} onClick={() => { reset(); setCfg({ enabled: false }); setOpen(false); }}>
            ポモドーロを閉じる（オフにする）
          </button>
        </div>
      )}
    </div>
  );
}
