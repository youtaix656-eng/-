import { useEffect, useRef, useState } from 'react';
import { loadPomoMusic, savePomoMusic, clearPomoMusic } from '../lib/storage.js';

// ポモドーロタイマーの設定一式。2026-11-08、ユーザー指定で「全機能を一度リセットし、
// ①タイマーの時間（+/-のみ）②スマホ内の音楽を1曲だけ設定してループ再生、の2つだけに
// 絞る」よう全面的に作り直した（以前にあったプリセット・短い休憩/長い休憩/サイクル回数・
// 通知間隔・1日の目標・効果音・振動・画面常時点灯・集中モード・バー位置・タブを閉じる時の
// 確認・週間統計グラフ/CSV書き出しは、このバッチで意図的にすべて削除した）。
// Pomodoro.jsx（バー自体の設定パネル）とSettings.jsx（バーがオフの間も調整できる場所）の
// 両方から同じものを使う単一の正。
const MIN_MIN = 1;
const MAX_MIN = 180;
const STEP_MIN = 1;
const MAX_BYTES = 15 * 1024 * 1024; // 15MB。上限なしだと端末内保存(IndexedDB)を圧迫するため

export function PomodoroConfigFields({ cfg, setCfg, onToast, onMusicChange }) {
  const fileRef = useRef(null);
  const [hasMusic, setHasMusic] = useState(false);
  useEffect(() => {
    loadPomoMusic().then((blob) => setHasMusic(!!blob));
  }, []);
  const bump = (delta) => {
    const cur = cfg.durationMin || 25;
    setCfg({ durationMin: Math.min(MAX_MIN, Math.max(MIN_MIN, cur + delta)) });
  };
  const pickMusic = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > MAX_BYTES) {
      onToast?.('⚠️ ファイルが大きすぎます（15MBまで）。短い曲を選んでください。');
      return;
    }
    await savePomoMusic(f);
    setHasMusic(true);
    onMusicChange?.();
    onToast?.('曲を設定しました（勉強中はこの1曲だけをループ再生します）');
  };
  const removeMusic = async () => {
    await clearPomoMusic();
    setHasMusic(false);
    onMusicChange?.();
    onToast?.('曲を削除しました');
  };
  return (
    <>
      <div className="pomo-config-grid">
        <label>
          タイマーの時間（分）
          <span className="pomo-num-row">
            <button type="button" className="pomo-num-step" onClick={() => bump(-STEP_MIN)} aria-label="時間を減らす">－</button>
            <span style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 16 }}>{cfg.durationMin || 25}分</span>
            <button type="button" className="pomo-num-step" onClick={() => bump(STEP_MIN)} aria-label="時間を増やす">＋</button>
          </span>
        </label>
      </div>
      <div className="pomo-music">
        <p className="pomo-hint" style={{ marginTop: 0 }}>曲（1曲だけ設定でき、勉強中はその曲だけをループ再生します）</p>
        <div className="pomo-music-row">
          <input ref={fileRef} type="file" accept="audio/*" onChange={pickMusic} style={{ display: 'none' }} />
          <button type="button" className="btn sm" onClick={() => fileRef.current?.click()}>
            {hasMusic ? '🎵 曲を変更' : '🎵 曲を選ぶ'}
          </button>
          {hasMusic && <button type="button" className="btn sm ghost" onClick={removeMusic}>削除</button>}
        </div>
        <p className="pomo-hint">{hasMusic ? '設定済みです。' : 'スマホ内の音楽ファイルを1曲だけ選べます（15MBまで）。'}</p>
      </div>
    </>
  );
}
