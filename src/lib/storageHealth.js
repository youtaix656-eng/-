// 端末ストレージの健全性（#1）— 容量の監視と永続化要求。
//   IndexedDB が容量超過で消えたり書けなくなる前に、残量を可視化し persist を要求する。

// 使用量・上限の見積り（対応していない環境では null）。
export async function estimateStorage() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      const percent = quota > 0 ? Math.round((usage / quota) * 100) : null;
      return { usage, quota, percent };
    }
  } catch (e) { /* noop */ }
  return null;
}

// 端末が「消えにくい永続ストレージ」になっているか
export async function isPersisted() {
  try {
    if (navigator.storage && navigator.storage.persisted) return await navigator.storage.persisted();
  } catch (e) { /* noop */ }
  return false;
}

// 永続化を要求（ユーザー操作起点で呼ぶと通りやすい）。付与されたら true。
export async function requestPersistent() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch (e) { /* noop */ }
  return false;
}

// バイト数を読みやすく（KB/MB）
export function formatBytes(n) {
  if (!n || n < 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
