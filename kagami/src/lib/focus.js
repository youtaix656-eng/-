// 目次から飛んだ先で、その項目まで運んで一時的に光らせる。
//
// **1か所に置く**——画面ごとに書くと、片方だけ直したときに
// 「飛んだのに画面の先頭で止まる」が必ず再発する（実際に一度そうなった）。
// anchor（DOM の id）を持っているのは各画面の側なので、prefix は呼ぶ側が決める。
//
// **ここは React に依存させない。** lib/ を素の JS のままにしておくと、
// アプリの依存を入れていない状態（リポジトリ直下の npm test）でも試験できる。
// フックは components/useFocusJump.js 側に置く。
//
// **光らせる印を className に足さない（2026-08-30）。** 飛び先のカードは
// 「開く」で className が変わるので、class で印を付けると次の描き直しで
// React が className をまるごと書き直し、**印だけが消える**
// （運ぶところまでは動くので、飛べているのに光らない状態になる。実際に踏んだ）。
// React が書き戻さない属性に付ければ、あとから開いても閉じても残る。

export const FLASH_MS = 1900;
export const FLASH_ATTR = 'data-flash';

/**
 * その id の要素まで運び、一時的に光らせる。
 * @returns {boolean} 運べたか（要素が無ければ false。**落ちない**）
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
