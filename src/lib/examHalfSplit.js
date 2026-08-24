// 模試の前半/後半 正答率比較（⑧）— 集中力が持続しているかの目安。
// ペース管理（examPace.js）は時間の遅れを見るが、こちらは正答率の推移で別角度から見る。

export function halfSplitAccuracy(order, answers) {
  const n = order.length;
  if (n < 2) return null;
  const mid = Math.ceil(n / 2);
  const calc = (from, to) => {
    let total = 0;
    let correct = 0;
    for (let i = from; i < to; i++) {
      total += 1;
      if (answers[i] === order[i].answer) correct += 1;
    }
    return { total, correct, accuracy: total > 0 ? correct / total : null };
  };
  const first = calc(0, mid);
  const second = calc(mid, n);
  const dropPt =
    first.accuracy != null && second.accuracy != null ? Math.round((first.accuracy - second.accuracy) * 100) : null;
  return { first, second, dropPt };
}
