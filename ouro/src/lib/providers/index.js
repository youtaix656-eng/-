// AI Provider（思考エンジン）の登録所。
//
// **AI社員（AIEmployee）とエンジン（AIProvider）は別物。**
// 社員は「どのエンジンを使いたいか（providerPref）」を持つだけで、
// エンジンそのものを持たない。ここに1件足せば全社員が使えるようになるし、
// 将来モデルが廃止されても社員データは無傷で残る。

import localProvider from './local.js';
import anthropicProvider from './anthropic.js';
import openaiProvider from './openai.js';
import geminiProvider from './gemini.js';
import compatProvider from './compat.js';

export const PROVIDERS = [localProvider, anthropicProvider, openaiProvider, geminiProvider, compatProvider];

export function providerById(id) {
  return PROVIDERS.find((p) => p.id === id) || null;
}

export function modelById(providerId, modelId) {
  const p = providerById(providerId);
  if (!p) return null;
  return p.models.find((m) => m.id === modelId) || p.models[0] || null;
}

/**
 * 実際に使えるエンジンの一覧。local は常に使える。
 *
 * **`needsKey` だけで見ない。** ローカルAI（compat）はキーではなく
 * 「宛先のURL」で使えるかどうかが決まるので、そういうエンジンは
 * `isReady(secrets, settings)` で判定する。
 */
export function availableProviders(secrets = {}, settings = {}) {
  return PROVIDERS.filter((p) => {
    if (typeof p.isReady === 'function') return p.isReady(secrets, settings);
    return !p.needsKey || Boolean(secrets[p.id]);
  });
}

/** 設定・接続がまだ済んでいないエンジン（画面で「つなぐ」を出すため）。 */
export function pendingProviders(secrets = {}, settings = {}) {
  const ready = new Set(availableProviders(secrets, settings).map((p) => p.id));
  return PROVIDERS.filter((p) => p.id !== 'local' && !ready.has(p.id));
}

/** 概算コスト（USD）。ユーザーが「いくらかかったか」を見られるように必ず出す。 */
export function estimateCost(providerId, modelId, usage = {}) {
  const m = modelById(providerId, modelId);
  if (!m) return 0;
  const inCost = ((usage.input || 0) / 1e6) * (m.inputPer1M || 0);
  const outCost = ((usage.output || 0) / 1e6) * (m.outputPer1M || 0);
  return inCost + outCost;
}
