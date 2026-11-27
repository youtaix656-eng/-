// アプリ版（Android の WebView）で、音声学習の「続きから」と再生履歴を閉じても失わないための控え
// （2026-11-27・ユーザー指定「再生してる途中経過が記録に残りアプリを開いたら再開できるように」）。
//
// WebView の localStorage は書いてから少し経ってからファイルへ書き出すので、OS がアプリを
// 急に終わらせる（裏に回したまま回収される・スワイプで閉じる）と、直前の位置が残らないことがある。
// 端末の SharedPreferences（android/ の NativePrefsPlugin.kt、commit＝その場でファイルへ書く）にも
// 同じ値を残し、起動時に新しい方を localStorage へ戻す。ブラウザ版では何もしない。
// @capacitor/core は import しない（nativeBridge.js と同じく window.Capacitor だけを見る）。

export const MIRRORED_KEYS = ['shinkyu:audioProgressSync', 'shinkyu:audioPlayHistory'];

function prefs() {
  try {
    if (typeof window === 'undefined') return null;
    const cap = window.Capacitor;
    if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return null;
    return cap.Plugins?.NativePrefs || null;
  } catch {
    return null;
  }
}

// 値の新しさ（純関数）：オブジェクトは at、配列は中の at のいちばん新しいもの。読めなければ0。
export function stampOf(raw) {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(v)) return v.reduce((m, e) => Math.max(m, Number(e?.at) || 0), 0);
    if (v && typeof v === 'object') return Number(v.at) || 0;
  } catch { /* noop */ }
  return 0;
}

// 2つのうち新しい方の文字列（純関数）。片方しか無ければそれ。
export function pickNewerRaw(local, native) {
  if (!native) return local || null;
  if (!local) return native;
  return stampOf(native) > stampOf(local) ? native : local;
}

export function mirrorToNative(key, raw) {
  const p = prefs();
  if (!p) return;
  try {
    const r = raw == null ? p.remove({ key }) : p.set({ key, value: String(raw) });
    Promise.resolve(r).catch(() => {});
  } catch { /* 書けなくても再生は続ける */ }
}

// 起動時に一度だけ：端末の控えの方が新しければ localStorage へ戻す。最大 ms だけ待つ（起動を止めない）。
export async function restoreFromNative(ms = 1200) {
  const p = prefs();
  if (!p || typeof localStorage === 'undefined') return 0;
  const work = (async () => {
    let restored = 0;
    for (const key of MIRRORED_KEYS) {
      try {
        const r = await p.get({ key });
        const native = r && typeof r.value === 'string' ? r.value : null;
        const local = localStorage.getItem(key);
        const pick = pickNewerRaw(local, native);
        if (pick && pick !== local) { localStorage.setItem(key, pick); restored++; }
      } catch { /* noop */ }
    }
    return restored;
  })();
  return Promise.race([work, new Promise((res) => setTimeout(() => res(0), ms))]);
}
