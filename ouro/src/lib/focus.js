// 飛び先へ運んで、そこを一時的に光らせる。
//
// **React に依存させない**（素の JS のまま試験できる）。画面ごとに書くと、
// 片方だけ直したときに必ず食い違うので、飛び先の仕組みはここ1か所に置く。
//
// 決まりごと：
//  ・**印は `className` ではなく属性で付ける**（`FLASH_ATTR`＝`data-flash`）。
//    飛び先のカードは「開く」で className が変わるため、class で印を付けると
//    次の描き直しで React が className をまるごと書き直し、
//    **運べているのに印だけが消える**（同じ事故を他のアプリで実際に踏んでいる）。
//  ・**印を外すのは `setTimeout`**（アニメーションの終わりを待たない。
//    途中で別の所へ飛んだ時に、前の印が残らないよう毎回消してから付ける）。
//  ・**「画面の先頭へ戻す」を副作用にしない**——飛んだ直後に先頭へ戻す
//    `useEffect` を置くと、運んだ画面が引き戻される。先頭へ戻すのは画面遷移の側でやる。

export const FLASH_ATTR = 'data-flash';
export const FLASH_MS = 1600;

let timer = null;
let lastEl = null;

/** いま付いている印を消す（別の所へ飛ぶ前に必ず通る）。 */
export function clearFlash() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (lastEl && lastEl.removeAttribute) lastEl.removeAttribute(FLASH_ATTR);
  lastEl = null;
}

/**
 * id の要素まで運んで光らせる。
 * @param {string} id 飛び先の id（目次の `anchor`）
 * @param {object} o { doc, behavior, ms }
 * @returns {boolean} 見つかって運べたか（**見つからない時は黙って true を返さない**）
 */
export function flashTo(id, { doc = typeof document === 'undefined' ? null : document, behavior = 'smooth', ms = FLASH_MS } = {}) {
  if (!id || !doc || !doc.getElementById) return false;
  const el = doc.getElementById(id);
  if (!el) return false;

  clearFlash();
  if (el.scrollIntoView) el.scrollIntoView({ behavior, block: 'start' });
  if (el.setAttribute) el.setAttribute(FLASH_ATTR, 'on');
  lastEl = el;
  timer = setTimeout(() => {
    if (el.removeAttribute) el.removeAttribute(FLASH_ATTR);
    if (lastEl === el) lastEl = null;
    timer = null;
  }, ms);
  return true;
}
