// 目次から飛んだ先で、その項目まで運んで一時的に光らせる。
//
// **1か所に置く**——画面ごとに書くと、片方だけ直したときに
// 「飛んだのに画面の先頭で止まる」が再発しやすい。anchor（DOM の id）を
// 持っているのは各画面の側なので、id の付け方は呼ぶ側が決める。
//
// **ここは React に依存させない。** lib/ を素の JS のままにしておくと、
// アプリの依存を入れていない状態（`node --test`）でも試験できる。
// フックは components/useFocusJump.js 側に置く。
//
// **光らせる印を className に足さない。** 飛び先のカードは開閉等の操作で
// className が変わることがあり、印を class で付けると次の描き直しで
// React が className をまるごと書き直し、印だけが消える（運べているのに
// 光らない状態になる）。React が書き戻さない data 属性に付ければ、
// あとから開いても閉じても印は残る。

export const FLASH_MS = 1900;
export const FLASH_ATTR = 'data-flash';

/**
 * その id の要素まで運び、一時的に光らせる。
 * @returns {boolean} 運べたか（要素が無ければ false。落ちない）
 */
export function flashTo(anchorId, doc = typeof document === 'undefined' ? null : document) {
  if (!anchorId || !doc) return false;
  const el = doc.getElementById(anchorId);
  if (!el) return false;
  if (el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  if (el.setAttribute) {
    el.setAttribute(FLASH_ATTR, 'on');
    setTimeout(() => {
      if (el.removeAttribute) el.removeAttribute(FLASH_ATTR);
    }, FLASH_MS);
  }
  return true;
}
