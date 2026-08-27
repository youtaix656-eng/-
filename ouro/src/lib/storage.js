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
  idbGetPrefixLast,
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
  funnel: 'ouro:funnel', // 収益導線（週ごとの数字）
  board: 'ouro:board',   // 社内掲示板（社員どうしの共通記憶・30日で消える）
  pitfalls: 'ouro:pitfalls', // つまずき集（役職別の失敗・消えない）
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
/**
 * @param {boolean} track 読んだ内容を差分計算用に覚えるか。
 *   書き出し（exportAll）のように「全部読むが、次の保存の基準にはしない」場合は false。
 *   ここで覚えてしまうと、画面が持っている一部だけの配列を保存した時に
 *   「覚えている全件」との差分で古いレコードが消される。
 */
async function readCollection(key, manifest, fallback, limit = 0, track = true) {
  const conf = RECORD_COLLECTIONS[key];

  // 並び順を manifest に持つもの（社員・仕事・知識など）は、
  // 先頭 limit 件の id だけを読む。仕事は1件が手順の本文をまるごと抱えるので、
  // 全部読むと使い込むほど起動が遅くなる（実測 600件で 377ms → 962ms）。
  if (limit > 0 && conf.mode === 'ids' && Array.isArray(manifest.ids) && manifest.ids.length > limit) {
    const head = manifest.ids.slice(0, limit);
    let got;
    try {
      got = await idbGetMany(head.map((id) => recordKey(key, id)));
    } catch {
      return fallback;
    }
    const list = head.map((id) => got.get(recordKey(key, id))).filter((v) => v !== undefined);
    if (track) {
      partialKeys.add(key);
      partialTail.set(key, manifest.ids.slice(limit));
      const cache = new Map();
      for (const id of head) {
        const rk = recordKey(key, id);
        if (got.has(rk)) cache.set(rk, got.get(rk));
      }
      recordCache.set(key, cache);
      lastWritten.set(key, manifest);
    }
    return list;
  }

  // 新項目09：並び順がキー自体にあるもの（操作履歴）は、新しい方から limit 件だけ読む。
  // 全部読むと2000件ぶんの往復になるが、画面に出るのは最近のぶんだけ。
  const paged = limit > 0 && conf.mode === 'sorted';
  let map;
  try {
    map = paged ? await idbGetPrefixLast(`${key}#`, limit) : await idbGetPrefix(`${key}#`);
  } catch {
    return fallback;
  }
  if (track) {
    if (paged && map.size >= limit) partialKeys.add(key);
    else {
      partialKeys.delete(key);
      partialTail.delete(key);
    }
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

  if (track) {
    // 次回の差分計算のために、いま読んだ内容を覚えておく
    const cache = new Map();
    for (const [k, v] of map) cache.set(k, v);
    recordCache.set(key, cache);
    lastWritten.set(key, manifest);
  }
  return list;
}

export async function load(key, fallback, limit = 0, track = true) {
  const conf = RECORD_COLLECTIONS[key];
  const raw = await readRaw(key, undefined);

  if (conf && isManifest(raw)) return readCollection(key, raw, fallback, limit, track);

  // 1件ずつ保存に切り替える前のデータ（ただの配列）はそのまま返す。
  // 次に save() したときに新しい形へ移る。
  if (raw !== undefined) lastWritten.set(key, raw);
  return raw === undefined ? fallback : raw;
}

/**
 * 複数キーを1回のトランザクションでまとめて読む（起動を速くするため）。
 * 1件ずつ保存のコレクションは、そのあと個別に組み立てる。
 */
export async function loadMany(keys, fallbacks = {}, limits = {}) {
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
      pending.push(readCollection(key, raw, fb, limits[key] || 0).then((v) => { out[key] = v; }));
    } else {
      if (raw !== undefined) lastWritten.set(key, raw);
      out[key] = raw === undefined ? fb : raw;
    }
  }
  await Promise.all(pending);
  return out;
}

// ───────────────────────── 書き込み ─────────────────────────

// 新項目07：書き込みに優先度をつける。
//   normal … いま画面で編集しているもの（社員・知識・設定）。指が止まったらすぐ書く。
//   low    … 記録として積むだけのもの（操作履歴）。急がないので長めに待ち、
//            そのあいだに何度積まれても1回にまとまる。
// **急がない側を長く待たせるだけで、書く順番は変えない。**
// 先に積まれたものを後回しにすると、閉じる直前の書き切りで順序が入れ替わる。
const DEBOUNCE_MS = 400;
const LOW_DEBOUNCE_MS = 2500;
export const PRIORITY_DELAY = { normal: DEBOUNCE_MS, low: LOW_DEBOUNCE_MS };

const pending = new Map(); // key → { value, due }（まだ書いていないもの）
let timer = null;
let idleId = null;

// 新項目09：一部だけ読み込んだコレクション。
// 読んでいない古いレコードを「消えた」と誤解して削除しないための印。
const partialKeys = new Set();

// 一部だけ読み込んだ時に、**読まなかった id の並び**を覚えておく。
//
// 順番を manifest に持つ形（mode:'ids'）では、これが無いと詰む：
// 手元の200件だけで manifest を書き直すと残りの id が消え、
// 逆に manifest を書かないと、新しく作ったものが manifest に載らず
// 次の起動で消える。読まなかった分を末尾に付け直すことで両方を避ける。
const partialTail = new Map();

// 新項目11：JSON化は1キーにつき1回だけにする。
// 以前は「変わったか確かめる」ためと「localStorage へ書く」ためで2回まわしていた。
const lastJson = new Map();

function toJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function sameValue(a, b) {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  const ja = toJson(a);
  const jb = toJson(b);
  return ja !== undefined && ja === jb;
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
  // 新項目09：一部だけ読み込んだコレクション（操作履歴の新しい400件など）では、
  // **読んでいない古いレコードを消してはいけない**。手元の配列に無い＝消された、
  // ではなく、単に読んでいないだけだから。
  if (!partialKeys.has(key)) {
    for (const rk of prev.keys()) if (!next.has(rk)) deleteKeys.push(rk);
  }

  // 一部だけ読み込んでいる時、順番を持つ側（ids）は
  // **読まなかった id を末尾に付け直してから**書く。
  // 手元の分だけで書くと残りが消え、書かないと新しく作った分が載らない。
  const tail = partialKeys.has(key) ? partialTail.get(key) || [] : [];
  const manifest =
    conf.mode === 'sorted'
      ? { [MANIFEST_TAG]: 2, mode: 'sorted', count: ids.length }
      : { [MANIFEST_TAG]: 2, mode: 'ids', ids: tail.length ? [...ids, ...tail.filter((id) => !ids.includes(id))] : ids };

  // 件数しか持たない側（sorted）は、一部読み込み中に書き換えない。
  // 400件しか読んでいないのに count:400 と書くと、実際の件数が分からなくなる。
  const skipManifest = partialKeys.has(key) && conf.mode === 'sorted';
  if (!skipManifest && !sameValue(lastWritten.get(key), manifest)) {
    entries.push([key, manifest]);
  }

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
  // 新項目11：JSON化はここで1回だけ。
  // 「変わったか」の判定にも localStorage への書き込みにも同じ文字列を使う。
  const json = toJson(value);
  if (json !== undefined && lastJson.get(key) === json) return; // 中身が同じなら書かない
  if (json === undefined && sameValue(lastWritten.get(key), value)) return; // JSON化できない値

  try {
    if (useIdb) {
      await idbSet(key, value);
      lastWritten.set(key, value);
      if (json !== undefined) lastJson.set(key, json);
      return;
    }
  } catch {
    /* localStorage へフォールバック */
  }
  try {
    localStorage.setItem(key, json !== undefined ? json : JSON.stringify(value));
    lastWritten.set(key, value);
    if (json !== undefined) lastJson.set(key, json);
  } catch {
    /* 容量超過などは黙って諦める */
  }
}

// いま走っている書き込み。flushNow() はこれを待たないと、
// 書いている途中のものを「もう無い」と誤って扱ってしまう。
let draining = null;

function drain(force = false) {
  timer = null;
  idleId = null;
  if (draining) return draining.then(() => (pending.size ? drain(force) : undefined));
  if (!pending.size) return Promise.resolve();

  const now = Date.now();
  // 期限が来たものだけ書く（新項目07）。force のときは全部書く。
  const batch = [];
  for (const [key, item] of pending) {
    if (force || item.due <= now) {
      batch.push([key, item.value]);
      pending.delete(key);
    }
  }
  if (!batch.length) {
    schedule(); // まだ早いものが残っている
    return Promise.resolve();
  }
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
      // 新項目28：どのキーを何件書いたかを残す（遅い保存の犯人が分かるように）
      perf.record(`保存 ${batch.length}件`, ms, 'save', {
        キー: batch.map(([k]) => String(k).replace(/^ouro:/, '')).join('・'),
      });
      // 書いた内容を他のタブへ知らせる（新項目12）
      announce(batch.map(([key]) => key));
      // 書いている間に新しく溜まったぶんを続けて書く
      if (pending.size) return drain(force);
      return undefined;
    });

  return draining;
}

function schedule() {
  if (!pending.size) return;
  let earliest = Infinity;
  for (const item of pending.values()) earliest = Math.min(earliest, item.due);
  const wait = Math.max(0, earliest - Date.now());

  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    // 空き時間に書く（操作中に引っかからないように）
    if (typeof requestIdleCallback === 'function') {
      idleId = requestIdleCallback(() => drain(), { timeout: 1000 });
    } else {
      drain();
    }
  }, wait);
}

/**
 * 保存（すぐには書かず、指が止まってからまとめて書く）。
 * @param {'normal'|'low'} priority 記録として積むだけのものは 'low'（新項目07）
 */
export function save(key, value, priority = 'normal') {
  const delay = PRIORITY_DELAY[priority] ?? DEBOUNCE_MS;
  const prev = pending.get(key);
  // 同じキーに何度も積まれた時、期限は**最初に積まれた時のもの**を保つ。
  // 毎回いまから数え直すと、積み続けている間ずっと書かれないままになる。
  const due = prev ? Math.min(prev.due, Date.now() + delay) : Date.now() + delay;
  pending.set(key, { value, due });
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
  // 走っている最中のものも必ず待つ。
  // force を立てて、まだ期限の来ていない「急がない」書き込みも全部書き切る
  // （新項目07。期限待ちのまま閉じると、その分が消える）。
  await drain(true);
  if (draining) await draining;
}

/** そのコレクションを一部だけしか読み込んでいないか（新項目09）。 */
export function isPartial(key) {
  return partialKeys.has(key);
}

/**
 * 「いま全件を手元に持った」と宣言する。
 *
 * **全件を読んだ瞬間に印を外してはいけない。**
 * 読み終わってから画面が全件を受け取るまでのあいだに保存が1回でも走ると、
 * その保存は手元の一部だけを「全部」とみなし、読んでいないレコードを消す
 * （実際に 300件 → 121件 に減らした）。
 * 読む時は track:false で何も触らず、**画面が全件を受け取ったあとで**ここを呼ぶ。
 * await を挟まないので、その間に保存が割り込む隙が無い。
 */
export function adoptFullList(key, list = []) {
  const conf = RECORD_COLLECTIONS[key];
  if (!conf) return;
  const cache = new Map();
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const id = conf.mode === 'sorted' ? conf.keyOf(item) : String(item.id ?? '');
    if (id) cache.set(recordKey(key, id), item);
  }
  recordCache.set(key, cache);
  partialKeys.delete(key);
  partialTail.delete(key);
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
  lastJson.delete(key);
  partialKeys.delete(key);
  partialTail.delete(key);
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
    // 全部読むが、次の保存の基準にはしない（track:false）
    const v = await load(key, undefined, 0, false);
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
    // 取り込みは失われては困るので、まとめ書きに載せず即書きする。
    // 取り込む配列は「全部」なので、一部読み込みの印を外して
    // 古いレコードがちゃんと消えるようにする（外し忘れると孤児が残る）。
    partialKeys.delete(key);
    partialTail.delete(key);
    // eslint-disable-next-line no-await-in-loop
    await writeNow(key, value);
    count += 1;
  }
  return count;
}

// ───────────────── 他のタブへ知らせる（新項目12）─────────────────
//
// 同じ端末で2つ開いていると、片方の保存がもう片方の画面に出ない。
// 書いたキーの名前だけを流し、受け取った側が読み直す。
// **中身は流さない**（端末内保存の窓口をここ1つに保つため。
// 受け取り側も必ず load() を通って読む）。

const CHANNEL = 'ouro:changes';
let channel = null;
const listeners = new Set();

function getChannel() {
  if (channel !== null) return channel;
  try {
    if (typeof BroadcastChannel === 'function') {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = (e) => {
        const keys = (e.data && e.data.keys) || [];
        if (!keys.length) return;
        for (const fn of listeners) {
          try {
            fn(keys);
          } catch {
            /* 受け手の失敗で他の受け手を止めない */
          }
        }
      };
    } else {
      channel = false; // 対応していないブラウザ
    }
  } catch {
    channel = false;
  }
  return channel;
}

function announce(keys) {
  if (!keys || !keys.length) return;
  const ch = getChannel();
  if (!ch) return;
  try {
    ch.postMessage({ keys });
  } catch {
    /* noop */
  }
}

/**
 * 他のタブでの保存を受け取る。戻り値を呼ぶと解除。
 * 自分が書いたぶんは自分には届かない（BroadcastChannel の仕様）。
 */
export function onExternalChange(fn) {
  getChannel();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ───────────────── 保存容量の見張り（新項目10）─────────────────

/**
 * 端末に残っている保存容量の目安。
 * ブラウザが教えてくれない場合は null（＝分からない、ではなく「見張れない」）。
 * **ネットワークには触れない。**
 */
export async function storageEstimate() {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    if (!quota) return null;
    return { usage, quota, ratio: usage / quota };
  } catch {
    return null;
  }
}

/**
 * この端末の保存領域を「消さないでほしい」とブラウザに頼む（新規）。
 *
 * Ouro はサーバーを持たず、すべてが端末の中にしかない。
 * 既定のままだと、容量が逼迫した時にブラウザの判断で丸ごと消えることがある。
 * 頼めるのは1回だけで十分、断られても何もしない（動作には影響しない）。
 * **ネットワークには触れない。**
 */
export async function requestPersistent() {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

/** いま「消さない」設定になっているか。分からない端末では null。 */
export async function isPersistent() {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persisted) return null;
    return await navigator.storage.persisted();
  } catch {
    return null;
  }
}

/** 残りが少ないか（既定は9割を超えたら）。 */
export function isStorageTight(est, threshold = 0.9) {
  return Boolean(est && est.ratio >= threshold);
}
