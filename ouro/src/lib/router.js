// AI Router — 「どのエンジンでこのタスクを実行するか」を決める。
//
//   タスク → AI社員 → AI Router → 最適モデル → 実行
//
// 特定AIへの依存を作らないため、ここは「登録されているエンジンの中から選ぶ」
// という形にしてあり、Claude / GPT / Gemini の名前で分岐しない。
// 選ぶ基準は (1) 必要な能力 (2) 社員の希望 (3) 難易度に見合ったコスト。

import { PROVIDERS, providerById, availableProviders } from './providers/index.js';

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
  const pool = capable.length ? capable : usable;

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
    reason: reasonFor({ preferred, needs, capable, chosen, weight }),
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

function reasonFor({ preferred, needs, capable, chosen, weight }) {
  if (chosen.id === 'local') return 'AIエンジン未接続のためローカル社員が対応';
  if (needs.length && capable.length) return `${needs.join('・')}が必要なため`;
  if (preferred) return '社員の希望';
  return weight >= WEIGHTS.heavy ? '重い仕事のため上位モデル' : '標準';
}

export function providerLabel(id) {
  const p = PROVIDERS.find((x) => x.id === id);
  return p ? p.name : id;
}
