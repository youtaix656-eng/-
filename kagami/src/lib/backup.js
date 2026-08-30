// この端末に入っているものを、まるごと持ち出す／取り込む。
//
// 守ること:
//   1. **ネットワークに触れない。** 書き出すのは文字列だけで、送るのは人の手。
//   2. **取り込みは必ず確認を出してから**（画面側の役目）。ここは検めるだけ。
//   3. **知らない形のものを黙って入れない。** 何が入っているかを数えて返す。
//   4. **貼った文面が入る**ので、画面には必ず「置き場所に気をつけて」と書く。

import { normalizeCase } from './cases.js';
import { makeRecord } from './records.js';
import { makeTry } from './tried.js';

export const FORMAT = 'kagami-backup-v1';

export function toBackup(state = {}) {
  return {
    format: FORMAT,
    at: Date.now(),
    records: state.records || [],
    cases: state.cases || [],
    tries: state.tries || [],
    myHabits: state.myHabits || [],
    personView: state.personView || {},
    settings: state.settings || {},
  };
}

/**
 * 取り込む前に検める。
 * @returns {{ok:boolean, reason?:string, counts?:object, data?:object}}
 */
export function parseBackup(text) {
  let raw;
  try {
    raw = JSON.parse(String(text || ''));
  } catch {
    return { ok: false, reason: 'ファイルの形が読めませんでした（JSONではないようです）' };
  }
  if (!raw || raw.format !== FORMAT) {
    return { ok: false, reason: 'このアプリの書き出しではないようです（人間分析だけの書き出しは、人間分析の画面から取り込めます）' };
  }
  const records = Array.isArray(raw.records)
    ? raw.records.filter((r) => r && r.id).map((r) => ({ ...makeRecord({ ...r, keepRaw: true }), id: r.id, at: Number(r.at) || Date.now(), masked: !!r.masked }))
    : [];
  const cases = Array.isArray(raw.cases) ? raw.cases.map((c) => normalizeCase(c)).filter(Boolean) : [];
  const tries = Array.isArray(raw.tries) ? raw.tries.filter((t) => t && t.id && t.tacticId).map((t) => makeTry(t)) : [];
  const myHabits = Array.isArray(raw.myHabits) ? raw.myHabits.filter((h) => typeof h === 'string') : [];
  return {
    ok: true,
    counts: { records: records.length, cases: cases.length, tries: tries.length, myHabits: myHabits.length },
    data: { records, cases, tries, myHabits, personView: raw.personView || null },
  };
}

/** 同じ id は、あとから直したほうを残す（記録は id 一致だけ見る） */
export function mergeRecords(mine = [], theirs = []) {
  const map = new Map(mine.map((r) => [r.id, r]));
  for (const r of theirs) if (!map.has(r.id)) map.set(r.id, r);
  return [...map.values()];
}
