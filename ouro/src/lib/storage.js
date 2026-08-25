// Ouro の永続化レイヤー。IndexedDB を既定、使えなければ localStorage。
// このファイルはネットワークに一切触れない（端末内保存の単一の窓口）。
//
// 新しい保存キーを足すときは必ず KEYS に登録すること。
// 直接 idbSet('...') を呼ぶと書き出し・移行から漏れる。
//
// ── 書き込みの方針（実測にもとづく） ──
// 名前を1文字打つたびに社員全員ぶんの配列（27KB）を書き直していたため、
// 次の3つを入れている。
//   ① まとめ書き …… 指が止まってから書く（連打しても1回）
//   ② 変化の確認 …… 中身が同じなら書かない
//   ③ 1件ずつ保存 … 増え続けるものは配列ごとではなく、変わった1件だけ書く
// **①を入れる以上、閉じる直前に必ず書き切る受け皿（flushNow）が要る。**
// これが無いと「書く前にタブを閉じた」ときにデータが消える。

import * as perf from './perf.js';
import {
  idbGet,
  idbSet,
  idbDelete,
  idbGetMany,
  idbWriteMany,
  idbGetPrefix,
  isIdbSupported,
} from './db.js';

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
  genres: 'ouro:genres',
  events: 'ouro:events',
  settings: 'ouro:settings',
  secrets: 'ouro:secrets', // APIキー。書き出しには絶対に含めない
  seeded: 'ouro:seeded',
};

// 書き出し（バックアップ・端末移行）に含めないキー。
// APIキーがバックアップファイルに混ざる事故を防ぐ。
export const EXPORT_EXCLUDE = [KEYS.secrets];

/**
 * 1件ずつ保存するコレクション。
 *  mode 'ids'    … 並び順を manifest に持つ（順番が意味を持つもの）
 *  mode 'sorted' … レコードのキー自体が並び順（追記しかしないもの）
 * manifest は元のキーに置き、レコードは `<key>#<id>` に置く。
 */
export const RECORD_COLLECTIONS = {
  [KEYS.employees]: { mode: 'ids' },
  [KEYS.knowledge]: { mode: 'ids' },
  [KEYS.sources]: { mode: 'ids' },
  [KEYS.tasks]: { mode: 'ids' },
  [KEYS.meetings]: { mode: 'ids' },
  [KEYS.deals]: { mode: 'ids' },
  [KEYS.approvals]: { mode: 'ids' },
  // 操作履歴は追記しかしない。並び順を manifest に持つと、1件足すたびに
  // 2000件ぶんの id を書き直すことになるので、キーで並べる方式にする。
  [KEYS.audit]: {
    mode: 'sorted',
    keyOf: (e) => `${String(e.at || 0).padStart(14, '0')}_${e.id || ''}`,
  },
};

const MANIFEST_TAG = '__ouroRecords';
const useIdb = isIdbSupported();

function isManifest(v) {
  return Boolean(v && typeof v === 'object' && !Array.isArray(v) && v[MANIFEST_TAG]);
}

function recordKey(key, id) {
  return `${key}#${id}`;
}

// 直前に書いた内容（キー→値）。同じものを二度書かないために持つ。
const lastWritten = new Map();
// 1件ずつ保存するコレクションの、直前の中身（id→レコード）。差分を出すために持つ。
const recordCache = new Map();

// ───────────────────────── 読み込み ─────────────────────────

async function readRaw(key, fallback) {
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

/** manifest からレコードを組み立てて配列に戻す。 */
async function readCollection(key, manifest, fallback) {
  const conf = RECORD_COLLECTIONS[key];
  let map;
  try {
    map = await idbGetPrefix(`${key}#`);
  } catch {
    return fallback;
  }

  let list;
  if (conf.mode === 'sorted') {
    // キーの昇順＝保存した順。IndexedDB のカーソルは昇順で返す。
    list = [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map((e) => e[1]);
  } else {
    const byId = new Map();
    for (const [k, v] of map) byId.set(k.slice(key.length + 1), v);
    list = (manifest.ids || []).map((id) => byId.get(String(id))).filter((v) => v !== undefined);
  }

  // 次回の差分計算のために、いま読んだ内容を覚えておく
  const cache = new Map();
  for (const [k, v] of map) cache.set(k, v);
  recordCache.set(key, cache);
  lastWritten.set(key, manifest);
  return list;
}

export async function load(key, fallback) {
  const conf = RECORD_COLLECTIONS[key];
  const raw = await readRaw(key, undefined);

  if (conf && isManifest(raw)) return readCollection(key, raw, fallback);

  // 1件ずつ保存に切り替える前のデータ（ただの配列）はそのまま返す。
  // 次に save() したときに新しい形へ移る。
  if (raw !== undefined) lastWritten.set(key, raw);
  return raw === undefined ? fallback : raw;
}

/**
 * 複数キーを1回のトランザクションでまとめて読む（起動を速くするため）。
 * 1件ずつ保存のコレクションは、そのあと個別に組み立てる。
 */
export async function loadMany(keys, fallbacks = {}) {
  const out = {};
  let rawMap = new Map();
  if (useIdb) {
    try {
      rawMap = await idbGetMany(keys);
    } catch {
      rawMap = new Map();
    }
  }

  const pending = [];
  for (const key of keys) {
    const raw = useIdb ? rawMap.get(key) : await readRaw(key, undefined);
    const fb = fallbacks[key];
    const conf = RECORD_COLLECTIONS[key];
    if (conf && isManifest(raw)) {
      pending.push(readCollection(key, raw, fb).then((v) => { out[key] = v; }));
    } else {
      if (raw !== undefined) lastWritten.set(key, raw);
      out[key] = raw === undefined ? fb : raw;
    }
  }
  await Promise.all(pending);
  return out;
}

// ───────────────────────── 書き込み ─────────────────────────

const DEBOUNCE_MS = 400;
const pending = new Map(); // key → value（まだ書いていないもの）
let timer = null;
let idleId = null;

function sameValue(a, b) {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * 1件ずつ保存のコレクションを、変わったぶんだけ書く形に組み立てる。
 * @param {Map} prev いま保存されている中身（消えたレコードを消すために要る）
 */
function planCollection(key, list, prev) {
  const conf = RECORD_COLLECTIONS[key];
  const next = new Map();
  const entries = [];
  const ids = [];

  for (const item of Array.isArray(list) ? list : []) {
    if (!item || typeof item !== 'object') continue;
    const id = conf.mode === 'sorted' ? conf.keyOf(item) : String(item.id ?? '');
    if (!id) continue;
    const rk = recordKey(key, id);
    next.set(rk, item);
    ids.push(id);
    // 参照が同じなら中身も同じ（useStore は書き換えず作り直す方式のため）
    const before = prev.get(rk);
    if (before !== item && !sameValue(before, item)) entries.push([rk, item]);
  }

  const deleteKeys = [];
  for (const rk of prev.keys()) if (!next.has(rk)) deleteKeys.push(rk);

  const manifest =
    conf.mode === 'sorted'
      ? { [MANIFEST_TAG]: 2, mode: 'sorted', count: ids.length }
      : { [MANIFEST_TAG]: 2, mode: 'ids', ids };
  if (!sameValue(lastWritten.get(key), manifest)) entries.push([key, manifest]);

  return { entries, deleteKeys, manifest, next };
}

async function writeNow(key, value) {
  const conf = RECORD_COLLECTIONS[key];
  if (useIdb && conf && Array.isArray(value)) {
    try {
      return await writeCollection(key, value, conf);
    } catch {
      // IndexedDB が書けない端末（容量超過・プライベートモード等）では
      // localStorage に丸ごと退避する。ここで例外を投げると drain() が
      // 途中で止まり、同じ回に溜まっていた**他のキーまで消える**。
      try {
        localStorage.setItem(key, JSON.stringify(value));
        lastWritten.set(key, value);
      } catch {
        /* 容量超過などは諦める */
      }
      return undefined;
    }
  }
  return writePlain(key, value);
}

async function writeCollection(key, value, conf) {
  {
    // まだ一度も読んでいないコレクションは、いま保存されている中身が分からない。
    // そのまま書くと「消したはずのレコード」がディスクに残り、次に読んだ時に
    // 混ざってしまう（特に操作履歴は並び順を id で持たないので必ず混ざる）。
    let prev = recordCache.get(key);
    if (!prev) {
      try {
        prev = await idbGetPrefix(`${key}#`);
      } catch {
        prev = new Map();
      }
      recordCache.set(key, prev);
    }
    const { entries, deleteKeys, manifest, next } = planCollection(key, value, prev);
    if (!entries.length && !deleteKeys.length) return undefined;
    await idbWriteMany(entries, deleteKeys);
    recordCache.set(key, next);
    lastWritten.set(key, manifest);
    return undefined;
  }
}

async function writePlain(key, value) {
  if (sameValue(lastWritten.get(key), value)) return; // 中身が同じなら書かない
  try {
    if (useIdb) {
      await idbSet(key, value);
      lastWritten.set(key, value);
      return;
    }
  } catch {
    /* localStorage へフォールバック */
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
    lastWritten.set(key, value);
  } catch {
    /* 容量超過などは黙って諦める */
  }
}

// いま走っている書き込み。flushNow() はこれを待たないと、
// 書いている途中のものを「もう無い」と誤って扱ってしまう。
let draining = null;

function drain() {
  timer = null;
  idleId = null;
  if (draining) return draining.then(() => (pending.size ? drain() : undefined));
  if (!pending.size) return Promise.resolve();

  const batch = [...pending.entries()];
  pending.clear();
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();

  draining = (async () => {
    for (const [key, value] of batch) {
      // 1件が失敗しても残りは書く（writeNow が中で受け止める）
      // eslint-disable-next-line no-await-in-loop
      await writeNow(key, value);
    }
  })()
    .catch(() => {})
    .then(() => {
      draining = null;
      const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;
      perf.record(`保存 ${batch.length}件`, ms, 'save');
      // 書いている間に新しく溜まったぶんを続けて書く
      if (pending.size) return drain();
      return undefined;
    });

  return draining;
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    // 空き時間に書く（操作中に引っかからないように）
    if (typeof requestIdleCallback === 'function') {
      idleId = requestIdleCallback(() => drain(), { timeout: 1000 });
    } else {
      drain();
    }
  }, DEBOUNCE_MS);
}

/** 保存（すぐには書かず、指が止まってからまとめて書く）。 */
export function save(key, value) {
  pending.set(key, value);
  schedule();
}

/** 溜まっている書き込みを今すぐ全部書き切る。閉じる直前などに使う。 */
export async function flushNow() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (idleId != null && typeof cancelIdleCallback === 'function') {
    cancelIdleCallback(idleId);
    idleId = null;
  }
  // 走っている最中のものも必ず待つ
  await drain();
  if (draining) await draining;
}

/** 書き残しがあるか（テストと、閉じる前の判定に使う）。 */
export function hasPendingWrites() {
  return pending.size > 0 || draining != null;
}

// タブを閉じる／隠れる直前に必ず書き切る。まとめ書きとセットで必須。
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const flush = () => {
    flushNow().catch(() => {});
  };
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

export async function remove(key) {
  pending.delete(key);
  lastWritten.delete(key);
  try {
    if (useIdb) {
      if (RECORD_COLLECTIONS[key]) {
        const map = await idbGetPrefix(`${key}#`);
        await idbWriteMany([], [...map.keys(), key]);
        recordCache.delete(key);
      } else {
        await idbDelete(key);
      }
    }
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
  await flushNow(); // 書き残しを含めないため、先に書き切る
  const out = { app: 'ouro', version: 1, exportedAt: Date.now(), data: {} };
  for (const key of Object.values(KEYS)) {
    if (EXPORT_EXCLUDE.includes(key)) continue;
    const v = await load(key, undefined);
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
    // 取り込みは失われては困るので、まとめ書きに載せず即書きする
    // eslint-disable-next-line no-await-in-loop
    await writeNow(key, value);
    count += 1;
  }
  return count;
}
