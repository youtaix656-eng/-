// 配点貢献度分析（#6・#25）— 模試の結果を、配分（examBlueprint.js）の重みと突き合わせる。

// perSubject: { [subject]: {total, correct} }（Exam.jsxの結果集計と同じ形）
// blueprint: EXAM_BLUEPRINT_AM/PM（スロットのcountを出題数の重みとして使う）。
// 失点貢献度＝出題数の重み×間違えた割合。高いほど「この科目を伸ばすと全体のスコアへの
// 影響が大きい」という優先度の目安になる（配点そのものは公式には未確認なので、
// 「配点」ではなく「出題数の重み」として扱い、断定しない＝#6）。
export function scoreContribution(perSubject, blueprint) {
  const totalCount = blueprint.totalCount;
  return blueprint.slots
    .map((slot) => {
      const stat = perSubject[slot.subject];
      const weight = totalCount > 0 ? slot.count / totalCount : 0;
      const accuracy = stat && stat.total > 0 ? stat.correct / stat.total : null;
      const lossContribution = accuracy != null ? weight * (1 - accuracy) : null;
      return { subject: slot.subject, note: slot.note || slot.subject, weight, accuracy, lossContribution };
    })
    .filter((r) => r.accuracy != null)
    .sort((a, b) => b.lossContribution - a.lossContribution);
}

// 合格ラインまであと何問正解していればよかったか（#25）。届いていれば0。
export function pointsShortOfPassLine(correctCount, totalCount, passRate) {
  const needed = Math.ceil(totalCount * passRate);
  return Math.max(0, needed - correctCount);
}
