import { useEffect, useRef, useState } from 'react';
import {
  loadPomoPlaylist,
  addPomoPlaylistSongs,
  removePomoPlaylistSong,
  migratePomoMusicToPlaylist,
} from '../lib/storage.js';

// ポモドーロタイマーの設定一式。2026-11-08、ユーザー指定で「全機能を一度リセットし、
// ①タイマーの時間（+/-のみ）②スマホ内の音楽を1曲だけ設定してループ再生、の2つだけに
// 絞る」よう全面的に作り直した（以前にあったプリセット・短い休憩/長い休憩/サイクル回数・
// 通知間隔・1日の目標・効果音・振動・画面常時点灯・集中モード・バー位置・タブを閉じる時の
// 確認・週間統計グラフ/CSV書き出しは、このバッチで意図的にすべて削除した）。
// 2026-11-14、ユーザー指定で「曲選択のところにプレイリストを作りたい。選択したら音楽が
// 表示されるようにしたい」のため、単曲選択を複数曲のプレイリスト（追加・選択・削除）へ拡張。
// 選んだ1曲だけを勉強中にループ再生する点は変えていない（storage.jsのコメント参照）。
// Pomodoro.jsx（バー自体の設定パネル）とSettings.jsx（バーがオフの間も調整できる場所）の
// 両方から同じものを使う単一の正。
const MIN_MIN = 1;
const MAX_MIN = 180;
const STEP_MIN = 1;
const MAX_BYTES = 15 * 1024 * 1024; // 15MB。上限なしだと端末内保存(IndexedDB)を圧迫するため

export function PomodoroConfigFields({ cfg, setCfg, onToast, onMusicChange }) {
  const fileRef = useRef(null);
  const [playlist, setPlaylist] = useState([]);
  useEffect(() => {
    migratePomoMusicToPlaylist().then((list) => {
      setPlaylist(list);
      // 移行直後・まだ何も選んでいない時は、先頭の曲を自動で選択済みにする
      if (list.length > 0 && !cfg.activeSongId) {
        setCfg({ activeSongId: list[0].id });
        onMusicChange?.();
      }
    });
    // 初回マウント時だけ実行（移行は1度きりの処理のため）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeId = cfg.activeSongId;
  const activeSong = playlist.find((s) => s.id === activeId) || playlist[0] || null;

  const addSongs = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const ok = [];
    let overSize = 0;
    for (const f of files) {
      if (f.size > MAX_BYTES) { overSize += 1; continue; }
      ok.push(f);
    }
    if (overSize > 0) onToast?.(`⚠️ ${overSize}件はファイルが大きすぎます（15MBまで）。短い曲を選んでください。`);
    if (!ok.length) return;
    const next = await addPomoPlaylistSongs(ok);
    setPlaylist(next);
    // 追加した曲が最初の1曲なら、そのまま選択済みにする
    if (!activeSong) setCfg({ activeSongId: next[next.length - ok.length].id });
    onMusicChange?.();
    onToast?.(ok.length === 1 ? '曲をプレイリストに追加しました' : `曲を${ok.length}件プレイリストに追加しました`);
  };
  const selectSong = (id) => {
    setCfg({ activeSongId: id });
    onMusicChange?.();
  };
  const removeSong = async (id) => {
    const next = await removePomoPlaylistSong(id);
    setPlaylist(next);
    if (activeId === id) setCfg({ activeSongId: next[0]?.id || null });
    onMusicChange?.();
    onToast?.('プレイリストから削除しました');
  };

  const bump = (delta) => {
    const cur = cfg.durationMin || 25;
    setCfg({ durationMin: Math.min(MAX_MIN, Math.max(MIN_MIN, cur + delta)) });
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
        <p className="pomo-hint" style={{ marginTop: 0 }}>
          曲のプレイリスト（複数曲を追加できます。選んだ1曲だけを勉強中にループ再生します）
        </p>
        <p className="pomo-hint" style={{ fontWeight: 700, color: 'var(--accent)' }}>
          {activeSong ? `🎵 現在の曲：${activeSong.name}` : '🎵 曲が選ばれていません'}
        </p>
        <div className="pomo-music-row">
          <input ref={fileRef} type="file" accept="audio/*" multiple onChange={addSongs} style={{ display: 'none' }} />
          <button type="button" className="btn sm" onClick={() => fileRef.current?.click()}>
            🎵 曲を追加
          </button>
        </div>
        {playlist.length === 0 && (
          <p className="pomo-hint">スマホ内の音楽ファイルを追加できます（1曲15MBまで、複数選択可）。</p>
        )}
        {playlist.length > 0 && (
          <ul className="pomo-playlist">
            {playlist.map((s) => (
              <li key={s.id} className={s.id === activeSong?.id ? 'pomo-playlist-item active' : 'pomo-playlist-item'}>
                <button
                  type="button"
                  className="pomo-playlist-pick"
                  onClick={() => selectSong(s.id)}
                  aria-pressed={s.id === activeSong?.id}
                >
                  {s.id === activeSong?.id ? '🔊' : '▫️'} {s.name}
                </button>
                <button type="button" className="btn sm ghost" onClick={() => removeSong(s.id)} aria-label={`${s.name}をプレイリストから削除`}>
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="range-row" style={{ marginTop: 8 }}>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={Math.round((cfg.musicVolume ?? 1) * 100)}
            onChange={(e) => setCfg({ musicVolume: Number(e.target.value) / 100 })}
            aria-label="曲の音量"
          />
          <span className="range-val">音量 {Math.round((cfg.musicVolume ?? 1) * 100)}%</span>
        </div>
      </div>
    </>
  );
}
