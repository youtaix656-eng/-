// Ouro の永続化レイヤー。IndexedDB を既定、使えなければ localStorage。
// このファイルはネットワークに一切触れない（端末内保存の単一の窓口）。
//
// 新しい保存キーを足すときは必ず KEYS に登録すること。
// 直接 idbSet('...') を呼ぶと書き出し・移行から漏れる。

import { idbGet, idbSet, idbDelete, isIdbSupported } from './db.js';

export const KEYS = {
  company: 'ouro:company',
  departments: 'ouro:departments',
  employees: 'ouro:employees',
  tasks: 'ouro:tasks',
  workflows: 'ouro:workflows',
  meetings: 'ouro:meetings',
  knowledge: 'ouro:knowledge',
  sources: 'ouro:sources',
  deals: 'ouro:deals',
  approvals: 'ouro:approvals',
  audit: 'ouro:audit',
  connections: 'ouro:connections',
  settings: 'ouro:settings',
  secrets: 'ouro:secrets', // APIキー。書き出しには絶対に含めない
  seeded: 'ouro:seeded',
};

// 書き出し（バックアップ・端末移行）に含めないキー。
// APIキーがバックアップファイルに混ざる事故を防ぐ。
export const EXPORT_EXCLUDE = [KEYS.secrets];

const useIdb = isIdbSupported();

async function read(key, fallback) {
  try {
    if (useIdb) {
      const v = await idbGet(key);
      return v === undefined ? fallback : v;
    }
  } catch {
    /* localStorage へフォールバック */
  }
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function write(key, value) {
  try {
    if (useIdb) {
      await idbSet(key, value);
      return;
    }
  } catch {
    /* localStorage へフォールバック */
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 容量超過などは黙って諦める */
  }
}

export const load = read;
export const save = write;

export async function remove(key) {
  try {
    if (useIdb) await idbDelete(key);
  } catch {
    /* noop */
  }
  try {
    localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

/** すべての保存データを書き出す（APIキーは除外）。 */
export async function exportAll() {
  const out = { app: 'ouro', version: 1, exportedAt: Date.now(), data: {} };
  for (const key of Object.values(KEYS)) {
    if (EXPORT_EXCLUDE.includes(key)) continue;
    const v = await read(key, undefined);
    if (v !== undefined) out.data[key] = v;
  }
  return out;
}

/** 書き出したデータを取り込む（APIキーは対象外）。 */
export async function importAll(payload) {
  if (!payload || payload.app !== 'ouro' || !payload.data) {
    throw new Error('Ouro のバックアップファイルではありません');
  }
  const known = new Set(Object.values(KEYS));
  let count = 0;
  for (const [key, value] of Object.entries(payload.data)) {
    if (!known.has(key) || EXPORT_EXCLUDE.includes(key)) continue;
    await write(key, value);
    count += 1;
  }
  return count;
}
