// 目次から飛んだ先を光らせる仕組み。**React に依存させない**（素の JS のまま試験できる）。
//
// 決めていること（鏡で実際に踏んだ事故をそのまま持ち込まないため）
//  1. **印は `className` に足さない。** 飛び先のカードは「開く」等で className が変わるので、
//     class で印を付けると次の描き直しで React が className を丸ごと書き直し、
//     **運べているのに印だけが消える**。属性（`data-flash`）で受ける。
//  2. **「画面の先頭へ戻す」を副作用にしない。** 飛び先を指定した移動では先頭へ戻さない
//     （戻すと、運んだ画面がその直後に先頭へ引き戻される）。`shouldScrollTop` が単一の正。
//  3. 飛ぶのは**次のフレーム**（描き終わってから）。まだ描かれていない要素は掴めない。

export const FLASH_ATTR = 'data-flash';
export const FLASH_MS = 2200;

function nextFrame(fn, win) {
  const w = win || (typeof window === 'undefined' ? null : window);
  if (w && typeof w.requestAnimationFrame === 'function') w.requestAnimationFrame(fn);
  else setTimeout(fn, 0);
}

/**
 * 飛び先まで運んで光らせる。
 * @param {string} targetId 飛び先の要素の id
 * @param {{doc?: Document, win?: Window, duration?: number, timer?: Function}} deps
 *   テストから素の JS で呼べるよう、document / window / setTimeout は差し替えられる。
 * @returns {boolean} 掴めたかどうか（掴めなければ false。黙って成功と言わない）
 */
export function flashTo(targetId, deps = {}) {
  const doc = deps.doc || (typeof document === 'undefined' ? null : document);
  if (!doc || !targetId) return false;
  const el = doc.getElementById(targetId);
  if (!el) return false;
  const run = () => {
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    el.setAttribute(FLASH_ATTR, 'on');
    const timer = deps.timer || setTimeout;
    timer(() => el.removeAttribute(FLASH_ATTR), deps.duration || FLASH_MS);
  };
  if (deps.now) run();
  else nextFrame(run, deps.win);
  return true;
}

/** 飛び先を指定した移動では画面の先頭へ戻さない（決めていること2） */
export function shouldScrollTop(targetId) {
  return !targetId;
}
