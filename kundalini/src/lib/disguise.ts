// 表示名の偽装（人に見られたくないとき）。
//
// ⚠ できること・できないことを正直に分ける：
//   ○ ブラウザのタブに出る名前とアイコン（favicon）は、開いている間だけ差し替えられる。
//   ✕ **ホーム画面に追加済みのアイコンの名前は変えられない**
//     （manifest.webmanifest は静的ファイルで、追加した時点の名前が焼き付く）。
//     変えたい場合は、いったんホーム画面から削除してから追加し直す必要がある。
//   この2つを混ぜて「アイコン偽装できます」と書かない。

export const REAL_TITLE = 'クンダリーニトラッカー';
export const REAL_ICON = '🧘';

/** 選びやすい候補（ここに無い名前・絵文字も自由に入れられる） */
export const PRESETS = [
  { title: 'メモ', icon: '📝' },
  { title: '天気', icon: '☁️' },
  { title: '電卓', icon: '🧮' },
  { title: '読書ログ', icon: '📚' },
  { title: '家計簿', icon: '💰' },
  { title: 'ストレッチ', icon: '🤸' },
];

function faviconFor(icon: string): string {
  const safe = icon.replace(/[<>&"]/g, '');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`
    + `<rect width="64" height="64" rx="14" fill="#000000"/>`
    + `<text x="32" y="44" font-size="36" text-anchor="middle">${safe}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** タブの名前とアイコンを差し替える（開いている間だけ効く） */
export function applyDisguise(enabled: boolean, title: string, icon: string): void {
  if (typeof document === 'undefined') return;
  const t = enabled && title.trim() ? title.trim() : REAL_TITLE;
  const i = enabled && icon.trim() ? icon.trim() : REAL_ICON;
  document.title = t;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = faviconFor(i);
}
