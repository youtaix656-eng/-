// 自動世代バックアップ（#3）— 端末内にローテーション式スナップショットを保持する。
//   万一データが壊れても直近の世代へ巻き戻せる。問題バンク本体（大容量・再生成可能）と
//   ログイン情報は除外し、学習の進捗・設定など軽い部分だけを最大 MAX 世代だけ残す。

import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:snapshots';
export const MAX_SNAPSHOTS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

// リングバッファ（純粋）：新しい世代を先頭に足し、max 件に切り詰める。
export function rotateSnapshots(list, entry, max = MAX_SNAPSHOTS) {
  return [entry, ...(Array.isArray(list) ? list : [])].slice(0, max);
}

// スナップショットに残すデータだけを抜き出す（questions/auth は除外＝軽量・安全）。
function slim(full) {
  const { questions, auth, ...rest } = full || {};
  return rest;
}

function counts(data) {
  return {
    srs: data.srs ? Object.keys(data.srs).length : 0,
    history: Array.isArray(data.history) ? data.history.length : 0,
    memos: data.memos ? Object.keys(data.memos).length : 0,
    examResults: Array.isArray(data.examResults) ? data.examResults.length : 0,
  };
}

export async function listSnapshots() {
  return (await idbGet(KEY)) || [];
}

// 1世代取得して保存。storage は src/lib/storage.js（exportAll を持つ）。
export async function takeSnapshot(storage, { auto = false } = {}) {
  const full = await storage.exportAll();
  const data = slim(full);
  const entry = { id: `${Date.now()}`, at: Date.now(), auto, counts: counts(data), data };
  const next = rotateSnapshots(await listSnapshots(), entry);
  await idbSet(KEY, next);
  return entry;
}

// 直近スナップショットから一定時間空いていれば自動取得（起動時などに呼ぶ）。
export async function maybeAutoSnapshot(storage, { minGapMs = DAY_MS } = {}) {
  const list = await listSnapshots();
  const last = list[0];
  if (last && Date.now() - last.at < minGapMs) return null;
  return takeSnapshot(storage, { auto: true });
}

// 復元：指定世代を importAll で書き戻す。
export async function restoreSnapshot(storage, id) {
  const list = await listSnapshots();
  const snap = list.find((s) => s.id === id);
  if (!snap) throw new Error('スナップショットが見つかりません');
  await storage.importAll(snap.data);
  return snap;
}

export async function deleteSnapshot(id) {
  const list = await listSnapshots();
  await idbSet(KEY, list.filter((s) => s.id !== id));
}
