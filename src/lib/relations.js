// 関係アノテーション・スキーマ（#3）— 概念間の「型付き関係」を定義・検証する。
//   ただの「関連」でなく、原因/対比/上位下位などの関係で結ぶための土台。

export const RELATION_TYPES = {
  causes: '原因→結果',
  contrast: '対比（まぎらわしい）',
  partOf: '上位→下位（部分）',
  treats: '治療・適応',
  locatedAt: '部位・位置',
  coOccurs: '共起（一緒に出る）',
};

export function isRelationType(t) {
  return Object.prototype.hasOwnProperty.call(RELATION_TYPES, t);
}

// 関係1件の妥当性。{ from, to, type } を検証しエラー配列を返す（空＝OK）。
export function validateRelation(r) {
  const errs = [];
  if (!r || typeof r !== 'object') return ['関係がオブジェクトでない'];
  if (typeof r.from !== 'string' || !r.from.trim()) errs.push('from が空');
  if (typeof r.to !== 'string' || !r.to.trim()) errs.push('to が空');
  if (r.from === r.to) errs.push('from と to が同一');
  if (!isRelationType(r.type)) errs.push(`type が不正（${r.type}）`);
  return errs;
}

export function validateRelations(list) {
  const bad = [];
  (list || []).forEach((r, i) => {
    const e = validateRelation(r);
    if (e.length) bad.push({ index: i, from: r && r.from, errors: e });
  });
  return { total: (list || []).length, bad, ok: bad.length === 0 };
}
