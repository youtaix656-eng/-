// イヤホン接続の「手がかり」判定（EarPomoのheadphones.tsと同じ考え方の移植）。
// Webにはイヤホンの抜き差しを直接教えるAPIが無いため、音声出力デバイス名に
// 手がかりがある時だけ「見つかった」とし、それ以外は「分からない」（null）として
// 本人の確認（settingsのチェック）に任せる。できないことをできるふりに書かない。
export async function detectHeadphoneHint() {
  // アプリ版は端末に聞く（WebView では機器の名前が取れず、いつも「分からない」になっていた）
  try {
    const cap = typeof window !== 'undefined' ? window.Capacitor : null;
    const p = cap?.isNativePlatform?.() ? cap.Plugins?.NativeTts : null;
    if (p && typeof p.headphones === 'function') {
      const r = await p.headphones({});
      return r?.connected ? true : null;
    }
  } catch (e) {
    /* 下のふつうの判定へ */
  }
  try {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return null;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const outs = devices.filter((d) => d.kind === 'audiooutput');
    if (!outs.length) return null;
    const KEYWORDS = ['headphone', 'headset', 'earphone', 'earbud', 'airpods', 'bluetooth', 'bud'];
    const found = outs.some((d) => KEYWORDS.some((k) => (d.label || '').toLowerCase().includes(k)));
    return found ? true : null;
  } catch (e) {
    return null;
  }
}
