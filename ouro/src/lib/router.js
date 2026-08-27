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
 * @param {object} o.settings   ローカルAIの宛先など（availableProviders が見る）
 * @param {string} o.costMode   'auto' | 'cheap' | 'best'
 * @returns {{providerId, model, reason, offline}}
 */
export function route({
  employee = {},
  secrets = {},
  request = '',
  mode = 'auto',
  needs = [],
  settings = {},
  costMode = 'auto',
} = {}) {
  const usable = availableProviders(secrets, settings);

  // 手動指定：社員の希望どおりに。使えないときだけ自動へ落とす。
  if (mode === 'manual' && employee.providerPref && employee.providerPref !== 'auto') {
    const p = usable.find((x) => x.id === employee.providerPref);
    if (p) {
      return {
        providerId: p.id,
        model: pickModel(p, employee, WEIGHTS.normal, costMode),
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
    // **local を「最後の受け皿」にするなら、ここでも外すこと。**
    // pool[0] にすると、登録順の都合で local が先に来て、
    // せっかく繋いだローカルAIが一度も選ばれない（実際に踏んだ）。
    pool.find((p) => p.id !== 'local') ||
    pool[0] ||
    providerById('local');

  return {
    providerId: chosen.id,
    model: pickModel(chosen, employee, weight, costMode),
    reason: reasonFor({ preferred, needs, capable, chosen, weight, avoided, costMode }),
    offline: chosen.id === 'local',
  };
}

function hasCapability(provider, need) {
  if (need === 'pdf') return Boolean(provider.supportsPdf);
  return Boolean(provider.serverTools && provider.serverTools[need]);
}

/**
 * 使うモデルを決める。
 *
 * 新項目：**人が「この仕事は安いモデルでいい」と言えるようにする**（costMode）。
 * 自動判定だけだと、1行の要約にまで上位モデルが回ることがあり、
 * そこが積み上がって月の上限に当たる。
 *   cheap … いちばん安いモデルに固定（社員の希望より優先する）
 *   best  … いちばん上のモデルに固定
 *   auto  … これまでどおり仕事の重さで選ぶ
 */
function pickModel(provider, employee, weight, costMode = 'auto') {
  const sorted = [...provider.models].sort(
    (a, b) => (TIER_ORDER[a.tier] || 2) - (TIER_ORDER[b.tier] || 2)
  );
  if (!sorted.length) return null;
  // **安くしろ／良くしろ、は社員の希望より優先する。**
  // 希望を優先すると「安くしたのに変わらない」が起きる。
  if (costMode === 'cheap') return sorted[0].id;
  if (costMode === 'best') return sorted[sorted.length - 1].id;
  if (employee.modelPref && employee.modelPref !== 'auto') {
    const m = provider.models.find((x) => x.id === employee.modelPref);
    if (m) return m.id;
  }
  if (weight >= WEIGHTS.heavy) return sorted[sorted.length - 1].id;
  if (weight <= WEIGHTS.light) return sorted[0].id;
  return sorted[Math.min(1, sorted.length - 1)].id;
}

function reasonFor({ preferred, needs, capable, chosen, weight, avoided = false, costMode = 'auto' }) {
  if (chosen.id === 'local') return 'AIエンジン未接続のためローカル社員が対応';
  if (avoided) return '希望のエンジンが混んでいたため別のエンジンへ';
  if (costMode === 'cheap') return '安いモデルで、と指定されたため';
  if (costMode === 'best') return '良いモデルで、と指定されたため';
  if (needs.length && capable.length) return `${needs.join('・')}が必要なため`;
  if (preferred) return '社員の希望';
  return weight >= WEIGHTS.heavy ? '重い仕事のため上位モデル' : '標準';
}

/**
 * そのモデルが使えなかった時に、**同じエンジンの1つ下のモデル**を返す。
 *
 * 2つの行き止まりを塞ぐためにある：
 *  ・モデルが廃止された（404）——2026-08-27、新しいキーで 1.5/2.0/2.5 系が全部 404 になっていた
 *  ・無料枠にそのモデルが無い（429）——Gemini の Pro は無料枠が無いので、
 *    「重い仕事＝上位モデル」の判断がそのまま失敗になる
 *
 * 下が無ければ null（＝これ以上落とせない）。
 */
export function cheaperModel(provider, modelId) {
  if (!provider || !Array.isArray(provider.models)) return null;
  const sorted = [...provider.models].sort(
    (a, b) => (TIER_ORDER[a.tier] || 2) - (TIER_ORDER[b.tier] || 2)
  );
  const i = sorted.findIndex((m) => m.id === modelId);
  if (i <= 0) return null;
  return sorted[i - 1].id;
}

export function providerLabel(id) {
  const p = PROVIDERS.find((x) => x.id === id);
  return p ? p.name : id;
}
