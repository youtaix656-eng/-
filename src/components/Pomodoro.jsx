import { useEffect, useRef, useState, useCallback } from 'react';
import { loadActivePomoSong } from '../lib/storage.js';
import { createYoutubePlayer } from '../lib/pomoYoutube.js';
import { setPomoRunning } from '../lib/runtimeFlags.js';
import { PomodoroConfigFields } from './PomodoroConfigFields.jsx';

// タイマー（全画面の上部に固定表示）。
// 2026-11-08、ユーザー指定で「全機能を一度リセットし、①タイマーの時間を自分で+/-で
// 設定できる ②スマホ内の音楽を1曲だけ設定し、勉強中はその1曲だけをループ再生する、の
// 2つだけに絞る」よう全面的に作り直した。
// 2026-11-14〜15、②を単曲→プレイリスト（取り込み・接続・YouTubeの3種類から追加できる、
// PomodoroConfigFields.jsx参照）へ拡張。選んだ1曲だけをループ再生する点は変えていない。
// 以前にあった多数の機能（プリセット・短い休憩/長い休憩/サイクル回数・勉強中の通知・
// 1日の目標勉強時間・効果音・振動・画面常時点灯・集中モード自動最小化・バー位置の切替・
// タブを閉じる時の確認・勉強内容メモ・週間統計グラフ/CSV書き出し・複数タブの幹事タブ判定
// （BroadcastChannel）・アプリアイコンのバッジ・終了時刻の通知予約・定期バックグラウンド
// 確認・集中度セルフチェック・中断理由の記録等）は、このバッチで意図的にすべて削除した
// （ユーザー確認済み・CLAUDE.md参照）。保存していたタイマーの実行状態（phaseEndAt等）は
// 新しいスキーマでは使わないため、アプリを再読み込みするとタイマーは待機中に戻る
// （これも「全機能のリセット」の結果として意図したもの）。
//
// 時刻ベース設計は維持する：残り時間を1秒ずつ減算せず「終わる時刻（endAt）」を持ち、
// 今の時刻との差から毎回計算し直す（タブが裏に回っていても、戻ってきた時に正確な
// 残り時間を表示できる）。
export default function Pomodoro({ store, onToast }) {
  const cfg = store.settings.pomodoro || {};
  const { updateSettings } = store;
  const setCfg = useCallback(
    (patch) => updateSettings({ pomodoro: { ...(store.settings.pomodoro || {}), ...patch, updatedAt: Date.now() } }),
    [store.settings.pomodoro, updateSettings]
  );

  const durationSec = (cfg.durationMin || 25) * 60;
  const [running, setRunning] = useState(false);
  const [endAt, setEndAt] = useState(0);
  const [remaining, setRemaining] = useState(durationSec); // 停止中の残り秒数
  const [finished, setFinished] = useState(false);
  const [min, setMin] = useState(true); // 省スペース：既定は最小化
  const [open, setOpen] = useState(false);
  const [musicUrl, setMusicUrl] = useState(null); // 取り込み・接続（file/filehandle）用
  const [musicKind, setMusicKind] = useState(null); // 'file' | 'youtube' | null
  const [musicVersion, setMusicVersion] = useState(0); // 設定パネルで曲を変更したら読み直す
  const [tick, setTick] = useState(0); // 表示を1秒ごとに再計算させるためだけの値

  const audioRef = useRef(null);
  const barRef = useRef(null);
  const tickRef = useRef(null);
  const ytContainerRef = useRef(null); // YouTubeプレイヤーの差し込み先（Reactは子要素を持たせない）
  const ytPlayerRef = useRef(null);

  // 停止中は分数設定の変更に合わせて残り時間を更新
  useEffect(() => {
    if (!running) setRemaining(durationSec);
  }, [durationSec, running]);

  // プレイリストで選ばれている曲を読み込む（設定パネルで追加・選択・削除された時も読み直す）。
  // 曲の種類（取り込み・接続＝musicUrl／YouTube＝YouTube IFrame Player）で読み込み方が違う。
  useEffect(() => {
    let url = null;
    let cancelled = false;
    (async () => {
      const song = await loadActivePomoSong(cfg.activeSongId);
      if (cancelled) return;
      try { ytPlayerRef.current?.destroy?.(); } catch (e) { /* noop */ }
      ytPlayerRef.current = null;
      if (!song) {
        setMusicUrl(null);
        setMusicKind(null);
        return;
      }
      if (song.kind === 'youtube') {
        setMusicUrl(null);
        setMusicKind('youtube');
        try {
          const player = await createYoutubePlayer(ytContainerRef.current, song.videoId, {
            volume: cfg.musicVolume ?? 1,
            onError: () => onToast?.('⚠️ YouTubeの動画を再生できませんでした（削除・非公開の可能性があります）'),
          });
          if (cancelled) { try { player.destroy(); } catch (e) { /* noop */ } return; }
          ytPlayerRef.current = player;
        } catch (e) {
          if (!cancelled) onToast?.('⚠️ YouTubeの読み込みに失敗しました（オフラインの可能性があります）');
        }
        return;
      }
      let blob = song.blob;
      if (song.kind === 'filehandle') {
        try {
          blob = await song.handle.getFile();
        } catch (e) {
          if (!cancelled) onToast?.(`⚠️「${song.name}」に再度アクセスできませんでした。設定でこの曲をもう一度選ぶと直るかもしれません。`);
          setMusicUrl(null);
          setMusicKind(null);
          return;
        }
      }
      if (cancelled) return;
      url = URL.createObjectURL(blob);
      setMusicUrl(url);
      setMusicKind('file');
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicVersion, cfg.activeSongId]);

  // 音量スライダー（設定画面側で変更された時も即座に反映する）
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = cfg.musicVolume ?? 1;
    try { ytPlayerRef.current?.setVolume?.(Math.round((cfg.musicVolume ?? 1) * 100)); } catch (e) { /* noop */ }
  }, [cfg.musicVolume]);

  // SW更新の反映保留判定（main.jsx）に、タイマーが実行中かどうかを伝える
  useEffect(() => {
    setPomoRunning(running);
    return () => setPomoRunning(false);
  }, [running]);

  const displayRemaining = running ? Math.max(0, Math.ceil((endAt - Date.now()) / 1000)) : remaining;
  void tick; // tickはこのレンダーを起こすためだけに参照する

  const playMusic = () => {
    if (musicKind === 'youtube') {
      try { ytPlayerRef.current?.playVideo?.(); } catch (e) { /* noop */ }
      return;
    }
    if (musicUrl && audioRef.current) {
      try {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      } catch (e) {
        /* noop */
      }
    }
  };
  const stopMusic = () => {
    if (musicKind === 'youtube') {
      try { ytPlayerRef.current?.pauseVideo?.(); } catch (e) { /* noop */ }
      return;
    }
    try { audioRef.current?.pause(); } catch (e) { /* noop */ }
  };

  const finish = useCallback(() => {
    setRunning(false);
    setRemaining(0);
    setFinished(true);
    stopMusic();
    onToast?.('⏰ タイマーが終了しました');
  }, [onToast]);

  const toggle = () => {
    if (running) {
      setRemaining(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
      setRunning(false);
      stopMusic();
      return;
    }
    const base = finished || remaining <= 0 ? durationSec : remaining;
    setFinished(false);
    setEndAt(Date.now() + base * 1000);
    setRemaining(base);
    setRunning(true);
    playMusic();
  };
  const reset = () => {
    setRunning(false);
    setFinished(false);
    setRemaining(durationSec);
    stopMusic();
  };

  // 1秒ごとの見直し（時刻ベース。表示はtickで再計算するだけ）
  useEffect(() => {
    if (!running) {
      if (tickRef.current) clearInterval(tickRef.current);
      return undefined;
    }
    tickRef.current = setInterval(() => {
      if (Date.now() >= endAt) { finish(); return; }
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [running, endAt, finish]);

  // タブが再表示された瞬間に即座に表示を追いつかせる
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible' && running) setTick((t) => t + 1); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [running]);

  // 最小化バーとフルバーで高さが違うため、ヘッダー側の--pomo-hへ実測値を反映する
  // （固定値だと最小化時に隙間ができる）。
  useEffect(() => {
    if (!barRef.current) return undefined;
    const el = barRef.current;
    const applyHeight = () => document.documentElement.style.setProperty('--pomo-h', `${el.offsetHeight}px`);
    applyHeight();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(applyHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [min, open]);

  if (!cfg.enabled) return null;

  const pct = durationSec > 0 ? Math.min(100, Math.max(0, ((durationSec - displayRemaining) / durationSec) * 100)) : 0;

  // YouTubeプレイヤーの差し込み先はReactが子要素を持たず空のまま渡す
  // （YT APIがこのDOM要素をiframeへ置き換えるため、Reactに再描画で触らせない）。
  const musicEls = (
    <>
      <audio ref={audioRef} src={musicUrl || undefined} preload="auto" loop />
      <div ref={ytContainerRef} style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', bottom: 0, right: 0 }} />
    </>
  );

  if (min) {
    return (
      <div className="pomo-bar mini" ref={barRef}>
        {musicEls}
        <button className="pomo-mini-body" onClick={() => setMin(false)} aria-label="タイマーを開く">
          <span className="pomo-phase">⏱️</span>
          <span className="pomo-time sm">{mmssOf(displayRemaining)}</span>
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
    <div className="pomo-bar" ref={barRef}>
      {musicEls}
      <div className="pomo-main">
        <span className="pomo-phase">⏱️ タイマー</span>
        <span className="pomo-time">{mmssOf(displayRemaining)}</span>
        <div className="pomo-controls">
          <button className="pomo-btn main" onClick={toggle} aria-label="開始/一時停止">{running ? '⏸' : '▶'}</button>
          <button className="pomo-btn" onClick={reset} aria-label="リセット">⟲</button>
          <button className="pomo-btn" onClick={() => setOpen((v) => !v)} aria-label="設定">⚙</button>
          <button className="pomo-btn" onClick={() => { setOpen(false); setMin(true); }} aria-label="最小化">▴</button>
        </div>
      </div>
      <div className="pomo-progress"><span style={{ width: `${pct}%` }} /></div>
      {finished && !running && (
        <p className="pomo-hint" style={{ color: 'var(--accent)' }}>⏰ 終了しました</p>
      )}
      {open && (
        <div className="pomo-config">
          <PomodoroConfigFields cfg={cfg} setCfg={setCfg} onToast={onToast} onMusicChange={() => setMusicVersion((v) => v + 1)} />
          <p className="pomo-hint" style={{ marginTop: 8 }}>
            間違って消してしまうことがあったため、ここには「閉じる」ボタンはありません。
            タイマーをオフにしたい時は、設定画面の「画面上部にポモドーロタイマーを表示」を
            オフにしてください。
          </p>
        </div>
      )}
    </div>
  );
}

function mmssOf(sec) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
