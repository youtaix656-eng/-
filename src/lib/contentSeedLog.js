// コンテンツ拡充パイプラインのログ（#15・#24）。
//   同梱データ（<科目>Questions.js）の版番号が上がって新しい問題が実際に追加された時、
//   いつ・どの科目に何問追加されたかを記録する。useStore.jsの起動時シード処理が
//   質問オブジェクト自体のidの差分から検出し、ここへ積む（起動時トーストと同じ発生源）。
//   Home.jsxの通知・CoverageMap.jsxの「最終更新」表示・週次の弱点ジャーナルの自動追記・
//   ハリオ先生のお祝いコメントは、すべてこのログだけを参照する（画面ごとに定義がズレないため）。

import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:contentSeedLog';
const MAX_ENTRIES = 30;

export async function loadContentSeedLog() {
  try { return (await idbGet(KEY)) || []; } catch (e) { return []; }
}

// entry: { totalAdded, bySubject: [{subject, count}], ids: [...] }
export async function appendContentSeedLog(entry) {
  const log = await loadContentSeedLog();
  const next = [{ at: Date.now(), ...entry }, ...log].slice(0, MAX_ENTRIES);
  try { await idbSet(KEY, next); } catch (e) { /* noop */ }
  return next;
}

// 科目ごとの最新の追加日時・このログ内での累計追加数（#6・#7：CoverageMap.jsxの最終更新表示）。
export function lastUpdateBySubject(log) {
  const map = new Map(); // subject -> { at, totalAdded }
  for (const entry of log || []) {
    for (const s of entry.bySubject || []) {
      if (!map.has(s.subject)) map.set(s.subject, { at: entry.at, totalAdded: 0 });
      const row = map.get(s.subject);
      if (entry.at > row.at) row.at = entry.at;
      row.totalAdded += s.count;
    }
  }
  return map;
}

// 直近1件のログ（起動時トーストの内容確認・#15）
export function latestSeedEntry(log) {
  return (log && log[0]) || null;
}

// 基準時刻以降に追加された分だけを返す（週次の弱点ジャーナルの自動追記・#30）
export function seedEntriesSince(log, sinceMs) {
  return (log || []).filter((e) => e.at >= sinceMs);
}
