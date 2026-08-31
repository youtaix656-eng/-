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
    // 鳴らし終わったらcloseする。毎回new AudioContext()するだけで閉じないと、
    // 通知音・フェーズ切り替え音が積み重なるたびにコンテキストが残り続け、
    // 1日使い続けるとブラウザ側の上限（同時に開けるAudioContext数）に達しうる。
    const totalMs = (t - ctx.currentTime) * 1000 + 100;
    setTimeout(() => { ctx.close().catch(() => {}); }, totalMs);
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

// 分・回数などの数値入力欄。value(確定値)をそのままcontrolled inputに渡すと、
// 全消しして2桁の新しい数字を打つ途中（一瞬空文字→0扱い）にmin側へ強制的に
// スナップして「一桁残さないと入力できない」状態になる。ここでは入力中は
// 自由な文字列（空欄も含む）をローカルに保持し、フォーカスが外れた時にだけ
// min/maxへ丸めて確定する。
function PomoNumberField({ label, value, min, max, onCommit }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = () => {
    const n = parseInt(draft, 10);
    const clamped = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : value;
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };
  return (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
    </label>
  );
}

// 科目の重さ・場面別プリセット（ワンタップで勉強/短い休憩の分数を切り替える）。
// 長い休憩・サイクル回数は個人差が大きいのでプリセットに含めず、既存の設定のまま残す。
const POMO_PRESETS = [
  { id: 'heavy', label: '重い科目（25+5）', study: 25, shortBreak: 5, hint: '解剖学・生理学など、じっくり読み解く科目向け' },
  { id: 'light', label: '軽い科目（15+5）', study: 15, shortBreak: 5, hint: '一問一答の反復など、テンポよく回す科目向け' },
  { id: 'gap', label: '隙間時間（10分×3）', study: 10, shortBreak: 3, hint: '通勤・休憩の合間など、短時間だけ確保できる時' },
];

export default function Pomodoro({ store, onToast }) {
  const cfg = store.settings.pomodoro || {};
  const { updateSettings } = store;

  const [phase, setPhase] = useState('idle');
  const [running, setRunning] = useState(false);
  const [min, setMin] = useState(true); // 省スペース：既定は最小化（#12）
  const [remaining, setRemaining] = useState((cfg.study || 25) * 60);
  const [done, setDone] = useState(0); // 完了した勉強回数（長休憩の判定に使用）
  const [open, setOpen] = useState(false);
  const [musicUrl, setMusicUrl] = useState(null);
  const [hasMusic, setHasMusic] = useState(false);
  const audioRef = useRef(null);
  const fileRef = useRef(null);
  const tickRef = useRef(null);
  const barRef = useRef(null);

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

  // 1秒ごとのカウントダウン。
  // 設定画面で「表示」をオフにした時、この効果自体は無条件に呼ばれ続けるため
  // （下のreturn nullは表示だけを止め、hooksの実行やintervalは止めない）、
  // !cfg.enabledでも明示的に止めないと、非表示の間もカウントダウン・通知・
  // 効果音が裏で進み続けてしまう（実際に確認された不具合）。
  useEffect(() => {
    if (!running || !cfg.enabled) {
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
  }, [running, cfg.enabled, phase, cfg.notifyEvery, cfg.study, cfg.shortBreak, cfg.longBreak, cfg.cycles]);

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
  // 実行中に分数設定を変えて total < remaining になっても、進捗バーの幅が
  // 負の%やCSS上不正な値にならないよう0〜100へ丸める。
  const pct = total > 0 ? Math.min(100, Math.max(0, ((total - remaining) / total) * 100)) : 0;
  const ph = PHASES[phase];
  const cycles = cfg.cycles || 4;

  // 最小化表示（#12）：使っていない時は細い1行だけにして画面を占有しない
  if (min) {
    return (
      <div className={`pomo-bar mini ${ph.cls}`} ref={barRef}>
        <audio ref={audioRef} src={musicUrl || undefined} preload="auto" />
        <button className="pomo-mini-body" onClick={() => setMin(false)} aria-label="タイマーを開く">
          <span className="pomo-phase">{phase === 'study' ? '📖' : phase === 'short' ? '☕' : phase === 'long' ? '🌴' : '⏱️'}</span>
          <span className="pomo-time sm">{mmss(remaining)}</span>
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

      {open && (
        <div className="pomo-config">
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
          </div>
          <div className="pomo-config-grid">
            <PomoNumberField label="勉強（分）" min={1} max={180} value={cfg.study || 25} onCommit={(n) => setCfg({ study: n })} />
            <PomoNumberField label="短い休憩（分）" min={1} max={60} value={cfg.shortBreak || 5} onCommit={(n) => setCfg({ shortBreak: n })} />
            <PomoNumberField label="長い休憩（分）" min={1} max={120} value={cfg.longBreak || 15} onCommit={(n) => setCfg({ longBreak: n })} />
            <PomoNumberField label="長休憩まで（回）" min={1} max={12} value={cfg.cycles || 4} onCommit={(n) => setCfg({ cycles: n })} />
            <PomoNumberField
              label="勉強中の通知（分おき・0でなし）"
              min={0}
              max={60}
              value={cfg.notifyEvery || 0}
              onCommit={(n) => {
                setCfg({ notifyEvery: n });
                // 実行中に0→有効へ切り替えた時、次のstart()を待たず今すぐ許可を求める
                // （許可が無いままだと通知は一つも出ず、原因も画面に出ないまま気づけない）。
                if (n > 0 && typeof Notification !== 'undefined' && Notification.permission === 'default') {
                  Notification.requestPermission().catch(() => {});
                }
              }}
            />
          </div>
          {(cfg.notifyEvery || 0) > 0 && (cfg.notifyEvery || 0) >= (cfg.study || 25) && (
            <p className="pomo-hint" style={{ color: 'var(--wrong, #c62828)' }}>
              ⚠️ 通知間隔（{cfg.notifyEvery}分）が勉強時間（{cfg.study || 25}分）以上のため、この設定では通知が一度も鳴りません。
            </p>
          )}

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
