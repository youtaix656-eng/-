// 接続できる外部サービスの上限。
// **画面に 3 や 6 を直書きしない。** 判定は connectionLimit() の1か所だけ。
// 将来プランを増やす／上限を変えるときも、ここだけを直す。

export const PLANS = [
  {
    id: 'free',
    name: 'ソロ',
    maxConnections: 2,
    maxEmployees: 24,
    desc: 'まず動かしてみる段階。無料で使えるAI・Webだけで回す。',
  },
  {
    id: 'standard',
    name: 'スタンダード',
    maxConnections: 3,
    maxEmployees: 60,
    desc: '道具を3つまで。ひとつの仕事の流れを最後まで回せる。',
  },
  {
    id: 'pro',
    name: 'プロ',
    maxConnections: 6,
    maxEmployees: 200,
    desc: '道具を6つまで。複数の部署が並行して動く規模。',
  },
];

export const DEFAULT_PLAN_ID = 'free';

export function planById(id) {
  return PLANS.find((p) => p.id === id) || PLANS.find((p) => p.id === DEFAULT_PLAN_ID);
}

/**
 * 接続上限。company.limitOverrides.maxConnections があればそれを優先する
 * （将来プランを作り替えても既存ユーザーの設定が壊れないようにするため）。
 */
export function connectionLimit(planId, overrides) {
  const o = overrides && overrides.maxConnections;
  if (Number.isFinite(o) && o >= 0) return o;
  return planById(planId).maxConnections;
}

export function employeeLimit(planId, overrides) {
  const o = overrides && overrides.maxEmployees;
  if (Number.isFinite(o) && o >= 0) return o;
  return planById(planId).maxEmployees;
}
