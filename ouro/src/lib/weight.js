// 読ませた量——「たくさん読ませるほど賢くなる」ではない。
//
// 材料を増やすほど答えは良くなる、と思って層を足していくと、
// **入れすぎたところで急に答えがぼやける。** しかも入力ぶんの料金は毎回かかる。
// どこで増えているのかは、入れた本人にしか見えない——だから見えるようにする。
//
// 決まりごと：
//  ・**AIを呼ばない。** 実行のときに残した文字数を並べ直すだけ。
//  ・**勝手に削らない。** 削ると材料として使えなくなる。多いと知らせるだけ
//    （見張り・確約と同じ線）。
//  ・**分からない量を0と書かない。** 実行していない手順は null。

/** 層の呼び名。`memory.js` の layer と合わせる。 */
export const LAYER_NAMES = {
  brief: '会社の現在地',
  knowledge: '会社の知識',
  self: 'その人の記憶',
  board: '掲示板',
  related: '関係する仕事',
  pitfall: 'つまずき集',
  style: '書き方の見本',
  rivals: '競合の観測',
  handoff: '前からの引き継ぎ',
  task: 'この仕事の補足',
};

/** これを超えたら知らせる目安（1手順あたりの文字数）。 */
export const HEAVY_CHARS = 12000;

/**
 * 手順ごとの「読ませた量」。
 * @returns {{steps:object[], max:number, total:number, heavy:boolean, byLayer:object[]}}
 */
export function weightOf(task) {
  const steps = (task && task.steps ? task.steps : [])
    .filter((s) => s.status === 'done' || s.status === 'failed')
    .map((s) => ({
      id: s.id,
      name: s.employeeName || s.roleId || '担当',
      // 実行していない・記録が無い手順は null（0と書かない）
      chars: Number.isFinite(s.contextChars) && s.contextChars > 0 ? s.contextChars : null,
      layers: (s.layers || []).map((l) => ({
        layer: l.layer,
        name: LAYER_NAMES[l.layer] || l.layer,
        chars: Number(l.chars) || 0,
      })),
    }));

  const known = steps.filter((s) => s.chars !== null);
  const max = known.length ? Math.max(...known.map((s) => s.chars)) : 0;
  const total = known.reduce((n, s) => n + s.chars, 0);

  // どの層が重いか（全手順を足して多い順）
  const sums = new Map();
  for (const s of steps) {
    for (const l of s.layers) sums.set(l.layer, (sums.get(l.layer) || 0) + l.chars);
  }
  const byLayer = [...sums.entries()]
    .map(([layer, chars]) => ({ layer, name: LAYER_NAMES[layer] || layer, chars }))
    .filter((x) => x.chars > 0)
    .sort((a, b) => b.chars - a.chars);

  return { steps, max, total, heavy: max >= HEAVY_CHARS, byLayer };
}

/** 画面に出す1行。**削れとは言わない**（決めるのは人）。 */
export function weightLine(w) {
  if (!w || !w.steps.length) return '';
  if (!w.max) return '読ませた量は記録されていません（この仕組みより前の仕事です）。';
  const top = w.byLayer[0];
  // **単位を混ぜない。** max は「1手順あたり」、byLayer は「全手順の合計」なので、
  // 並べて出すと数が合わないように見える。どちらの話かを必ず書く。
  const where = top ? `全手順で見ると「${top.name}」がいちばん多く読まれています。` : '';
  if (w.heavy) {
    return `1手順あたり最大${w.max.toLocaleString('ja-JP')}字を読ませています。${where}多いほど答えがぼやけ、入力ぶんの料金も毎回かかります。`;
  }
  return `1手順あたり最大${w.max.toLocaleString('ja-JP')}字。${where}`;
}
