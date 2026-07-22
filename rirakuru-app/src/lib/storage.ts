// ============================================================
// localStorage の安全なラッパー
// SSR（サーバー側）や localStorage 無効環境でも落ちないようにする。
// ============================================================

/** JSON を読み出す。失敗時は fallback を返す。 */
export function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** JSON を書き込む。失敗しても例外を投げない。 */
export function writeJSON<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 保存できなくても致命的ではないので握りつぶす
  }
}

/** localStorage のキー一覧（重複防止のため一元管理） */
export const STORAGE_KEYS = {
  favorites: "rirakuru:favorites",
  checklist: "rirakuru:checklist",
  theme: "rirakuru:theme",
} as const;
