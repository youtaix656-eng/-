// 音声学習×連結学習の「📌 あとで調べる」リスト（単一の発生源）。
// 聞き上げ中に出た用語を、検索・用語集を開かずその場で控えておき、あとでまとめて見返せるようにする。
import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:laterLookup';
const MAX = 200;

export async function loadLaterLookup() {
  const v = await idbGet(KEY);
  return Array.isArray(v) ? v : [];
}

export async function addLaterLookup(entry) {
  const list = await loadLaterLookup();
  const item = {
    id: `ll-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    ...entry,
  };
  const next = [item, ...list].slice(0, MAX);
  await idbSet(KEY, next);
  return next;
}

export async function removeLaterLookup(id) {
  const list = await loadLaterLookup();
  const next = list.filter((x) => x.id !== id);
  await idbSet(KEY, next);
  return next;
}
