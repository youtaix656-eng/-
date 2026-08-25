// AI Router — 「どのエンジンでこのタスクを実行するか」を決める。
//
//   タスク → AI社員 → AI Router → 最適モデル → 実行
//
// 特定AIへの依存を作らないため、ここは「登録されているエンジンの中から選ぶ」
// という形にしてあり、Claude / GPT / Gemini の名前で分岐しない。
// 選ぶ基準は (1) 必要な能力 (2) 社員の希望 (3) 難易度に見合ったコスト。

import { PROVIDERS, providerById, availableProviders } from './providers/index.js';

// ── 新項目25：詰まっているエンジンをしばらく避ける ──
//
// 混雑（429など）を返したエンジンは、続けて投げてもまた断られる。
// **エンジン名で分岐しない**方針は保ったまま、「直前に混んでいた id」を
// 覚えておき、他に選べるものがあるときだけ避ける。
// 他に無ければ避けない——避けた結果どこにも投げられない、では意味が無い。
const COOLDOWN_MS = 60_000;
const busyUntil = new Map();

/** 混んでいたエンジンを記録する（runtime.js から呼ぶ）。 */
export function markBusy(providerId, ms = COOLDOWN_MS) {
  if (!providerId) return;
  busyUntil.set(providerId, Date.now() + Math.max(1000, ms));
}

/** いま避けたほうがよいか。 */
export function isBusy(providerId, now = Date.now()) {
  const until = busyUntil.get(providerId);
  if (!until) return false;
  if (until <= now) {
    busyUntil.delete(providerId);
    return false;
  }
  return true;
}

/** テスト用：記録を消す。 */
export function clearBusy() {
  busyUntil.clear();
}

// タスクの重さ。重いほど上位モデルへ。
export const WEIGHTS = { light: 1, normal: 2, heavy: 3 };

const TIER_ORDER = { low: 1, mid: 2, high: 3 };

/** 依頼文と役職から仕事の重さを見積もる。 */
export function weighTask(request = '', roleId = '') {
  const text = String(request);
  const long = text.length > 400;
  const heavyWords = /戦略|設計|analy|徹底|網羅|検証|比較|レポート|企画書|提案書/;
  const lightWords = /要約|一覧|列挙|言い換え|短く|タイトル/;
  if (lightWords.test(text) && !long) return WEIGHTS.light;
  if (heavyWords.test(text) || long) return WEIGHTS.heavy;
  if (roleId === 'strategist' || roleId === 'reviewer') return WEIGHTS.heavy;
  return WEIGHTS.normal;
}

/**
 * 実行するエンジンとモデルを決める。
 * @param {object} o
 * @param {object} o.employee   社員（providerPref / modelPref / toolIds を見る）
 * @param {object} o.secrets    登録済みのAPIキー
 * @param {string} o.request    依頼文
 * @param {string} o.mode       'auto' | 'manual'
 * @param {string[]} o.needs    必要な能力（'web' | 'webfetch' | 'pdf'）
 * @returns {{providerId, model, reason, offline}}
 */
export function route({ employee = {}, secrets = {}, request = '', mode = 'auto', needs = [] } = {}) {
  const usable = availableProviders(secrets);

  // 手動指定：社員の希望どおりに。使えないときだけ自動へ落とす。
  if (mode === 'manual' && employee.providerPref && employee.providerPref !== 'auto') {
    const p = usable.find((x) => x.id === employee.providerPref);
    if (p) {
      return {
        providerId: p.id,
        model: pickModel(p, employee, WEIGHTS.normal),
        reason: '手動指定',
        offline: p.id === 'local',
      };
    }
  }

  // 必要な能力を満たすエンジンに絞る（例：Web検索が要るなら検索できるものだけ）
  const capable = usable.filter((p) => needs.every((n) => hasCapability(p, n)));
  const poolAll = capable.length ? capable : usable;

  // 新項目25：直前に混んでいたエンジンを外す。
  // 全部外れてしまう時は、外さない（投げ先が無くなるより、混んでいても投げる）。
  const free = poolAll.filter((p) => !isBusy(p.id));
  const pool = free.length ? free : poolAll;
  // 「混んでいたので別へ回した」と言ってよいのは、**実際に希望が外れた時だけ**。
  // どれか1つでも冷ましているだけで理由に書くと、希望どおり動いた時にも
  // 「混んでいた」と記録されてしまう。
  const avoided = Boolean(
    employee.providerPref &&
      poolAll.some((p) => p.id === employee.providerPref) &&
      !pool.some((p) => p.id === employee.providerPref)
  );

  // 社員の希望が使えるなら尊重する
  const preferred = pool.find((p) => p.id === employee.providerPref);
  const weight = weighTask(request, employee.roleId);

  const chosen =
    preferred ||
    // キーが要るエンジンを優先（local はあくまで最後の受け皿）
    pool.find((p) => p.needsKey) ||
    pool[0] ||
    providerById('local');

  return {
    providerId: chosen.id,
    model: pickModel(chosen, employee, weight),
    reason: reasonFor({ preferred, needs, capable, chosen, weight, avoided }),
    offline: chosen.id === 'local',
  };
}

function hasCapability(provider, need) {
  if (need === 'pdf') return Boolean(provider.supportsPdf);
  return Boolean(provider.serverTools && provider.serverTools[need]);
}

function pickModel(provider, employee, weight) {
  if (employee.modelPref && employee.modelPref !== 'auto') {
    const m = provider.models.find((x) => x.id === employee.modelPref);
    if (m) return m.id;
  }
  const sorted = [...provider.models].sort(
    (a, b) => (TIER_ORDER[a.tier] || 2) - (TIER_ORDER[b.tier] || 2)
  );
  if (!sorted.length) return null;
  if (weight >= WEIGHTS.heavy) return sorted[sorted.length - 1].id;
  if (weight <= WEIGHTS.light) return sorted[0].id;
  return sorted[Math.min(1, sorted.length - 1)].id;
}

function reasonFor({ preferred, needs, capable, chosen, weight, avoided = false }) {
  if (chosen.id === 'local') return 'AIエンジン未接続のためローカル社員が対応';
  if (avoided) return '希望のエンジンが混んでいたため別のエンジンへ';
  if (needs.length && capable.length) return `${needs.join('・')}が必要なため`;
  if (preferred) return '社員の希望';
  return weight >= WEIGHTS.heavy ? '重い仕事のため上位モデル' : '標準';
}

export function providerLabel(id) {
  const p = PROVIDERS.find((x) => x.id === id);
  return p ? p.name : id;
}
