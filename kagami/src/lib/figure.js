// 開くたびに変わる、地の面（おもて）を選ぶ。
//
// 守ること:
//   1. **開き直したら必ず変わる。** 前に出したものを避けて選ぶ
//      （ただの乱数だと、同じものが続けて出て「変わらない」と見える）。
//   2. **ネットワークに触れない。** 選ぶだけで、絵はその場で描く（画像を持たない）。
//   3. 知らない id が入っていても落ちない。

/**
 * 前に出したものを避けて1つ選ぶ。
 * @param {string[]} ids 候補
 * @param {string} [lastId] 前に出したもの
 * @param {() => number} [rand] 0以上1未満を返すもの（試験で差し替える）
 * @returns {string} 選んだ id（候補が空なら空文字）
 */
export function pickFigureId(ids = [], lastId = '', rand = Math.random) {
  const list = ids.filter(Boolean);
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  const rest = list.filter((id) => id !== lastId);
  const pool = rest.length > 0 ? rest : list;
  const i = Math.floor(rand() * pool.length);
  return pool[Math.min(Math.max(i, 0), pool.length - 1)];
}
