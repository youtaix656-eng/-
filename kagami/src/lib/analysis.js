// 人間分析 — チェックしたふるまいから、近い型と距離の取り方を出す。
//
// 守ること:
//   1. **点数・順位・診断名を出さない。** 出すのは「あなたがチェックしたふるまい」と
//      「その型で取れる距離」だけ。「危険度」「◯点」を返さない（型カタログと同じ線）。
//   2. **1つでは型と言わない。** どんな人にも当てはまる項目が1つ当たっただけで
//      「この人は◯◯だ」と出すのは、当てずっぽうの断定と同じ。
//   3. **チェックが少ないうちは黙らない。** 「まだ足りない」と言い分ける
//      （出ない理由が分からないと、壊れているのか足りないのか判断できない）。
//   4. **保存しない。** この関数も画面も、結果を端末に残さない。
//      人物の記録が端末に貯まると、端末を見られた時にいちばん危ないものになる。
//      （記録に残したい時は「記録」画面へ。あちらは氏名も相手も持たない形になっている）
//   5. **ネットワークに触れない。**

/** この数だけ当たって初めて、その型を出す */
export const MIN_PER_TYPE = 2;

/** 全体でこの数に届くまでは、型を出さずに「まだ足りない」と言う */
export const MIN_TOTAL = 3;

/**
 * @param {string[]} checkedIds allBehaviors() の id の配列
 * @param {Array} types data/people.js の PERSON_TYPES
 * @returns {{status:'empty'|'few'|'none'|'ok', checked:number, matches:Array}}
 *   matches は [{ type, behaviors: string[] }]。当たった数の多い順、
 *   同数ならカタログの並び順（**点数ではない**）。
 */
export function analyzePerson(checkedIds = [], types = []) {
  const checked = new Set(checkedIds);
  if (checked.size === 0) return { status: 'empty', checked: 0, matches: [] };

  const matches = [];
  types.forEach((type, order) => {
    const hit = type.behaviors.filter((_, i) => checked.has(`${type.id}:${i}`));
    if (hit.length < MIN_PER_TYPE) return;
    matches.push({ type, behaviors: hit, order });
  });
  matches.sort((a, b) => b.behaviors.length - a.behaviors.length || a.order - b.order);
  const clean = matches.map(({ order, ...m }) => m);

  if (checked.size < MIN_TOTAL) return { status: 'few', checked: checked.size, matches: [] };
  return { status: clean.length ? 'ok' : 'none', checked: checked.size, matches: clean };
}

/**
 * 当たった型がどの芯（一貫性・境界線・責任）に触れているかを数える。
 * **芯そのものを点数にしない**——出すのは「どの芯に当たったか」だけ。
 * @returns {string[]} 芯の id（重複なし。当たった型の並び順）
 */
export function coresOf(matches = []) {
  const seen = [];
  for (const m of matches) {
    for (const c of m.type.cores || []) if (!seen.includes(c)) seen.push(c);
  }
  return seen;
}
