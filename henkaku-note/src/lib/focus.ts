// 目次から飛んだ先で、その項目まで運んで一時的に光らせる。
//
// **1か所に置く**——画面ごとに書くと、片方だけ直したときに
// 「飛んだのに画面の先頭で止まる」が必ず再発する。
// anchor（DOM の id）を持っているのは各画面の側なので、id は呼ぶ側が決める。
//
// **印は className ではなく属性（data-flash）で付ける。**
// 飛び先のカードは「開く」などで className が変わるので、class で印を付けると
// 次の描き直しで React が className をまるごと書き直し、
// **運べているのに印だけが消える**（同じリポジトリの鏡アプリで実際に踏んだ）。
//
// **React に依存させない**（素の JS のまま試験できるようにするため）。

export const FLASH_MS = 1900;
export const FLASH_ATTR = 'data-flash';

/** flashTo が触る最小限の DOM の形（試験でも差し替えられるように型で持つ） */
export interface FlashElement {
  scrollIntoView?: (opts?: unknown) => void;
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
}
export interface FlashDocument {
  getElementById: (id: string) => FlashElement | null;
}

/**
 * その id の要素まで運び、一時的に光らせる。
 * @returns 運べたか（要素が無ければ false。**落ちない**）
 */
export function flashTo(
  anchorId: string,
  doc: FlashDocument | null = typeof document === 'undefined' ? null : (document as unknown as FlashDocument),
): boolean {
  if (!anchorId || !doc) return false;
  const el = doc.getElementById(anchorId);
  if (!el) return false;
  if (el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  el.setAttribute(FLASH_ATTR, '1');
  setTimeout(() => el.removeAttribute(FLASH_ATTR), FLASH_MS);
  return true;
}
