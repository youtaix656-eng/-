// ポモドーロの勉強時間ログ（今日・今週の合計時間、完了回数を出すための記録）。
// 端末内のみ・直近500件だけ保持する。studyフェーズを完走した時にだけ1件追加する
// （休憩は数えない）。

import { idbGet, idbSet, idbDelete, isIdbSupported } from './db.js';

const KEY = 'shinkyu:pomoLog';
const MAX_ENTRIES = 500;
const useIdb = isIdbSupported();

// IndexedDB優先・localStorageフォールバック（pomoState.jsと同じ考え方）。
async function readLog() {
  try {
    if (useIdb) {
      const v = await idbGet(KEY);
      if (v !== undefined) return v || [];
    }
  } catch (e) { /* 下のlocalStorageで試す */ }
  try {
    const raw = localStorage.getItem(KEY);
    return raw == null ? [] : JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

async function writeLog(next) {
  try {
    if (useIdb) { await idbSet(KEY, next); return; }
  } catch (e) { /* 下のlocalStorageで試す */ }
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) { /* noop */ }
}

/** @returns {Promise<Array<{studySec:number, at:number, label?:string}>>} */
export async function loadPomoLog() {
  return readLog();
}

/**
 * 勉強フェーズ完走を1件記録する。
 * @param {{studySec:number, at:number, label?:string}} entry label は「今回の勉強内容」の任意メモ
 */
export async function appendPomoLog(entry) {
  const log = await loadPomoLog();
  const next = [...log, entry].slice(-MAX_ENTRIES);
  await writeLog(next);
  return next;
}

/** 統計データをすべて消去する（本人の明示操作でのみ呼ぶこと）。 */
export async function clearPomoLog() {
  try { if (useIdb) await idbDelete(KEY); } catch (e) { /* noop */ }
  try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
}

/** sinceMs より前の記録を取り除く（手動整理。件数上限とは別に、古いものだけ狙って消したい時用）。 */
export async function trimPomoLogBefore(sinceMs) {
  const log = await loadPomoLog();
  const next = log.filter((e) => e.at >= sinceMs);
  await writeLog(next);
  return next;
}

export function todayStart(now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function weekStart(now = Date.now()) {
  const d = new Date(now);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function totalStudySecSince(log, sinceMs) {
  return (log || []).filter((e) => e.at >= sinceMs).reduce((s, e) => s + (e.studySec || 0), 0);
}

export function countSince(log, sinceMs) {
  return (log || []).filter((e) => e.at >= sinceMs).length;
}

/**
 * 直近days日分（当日含む）を日付ごとに集計する（週間グラフ用）。
 * 戻り値は古い日→新しい日の順（左から右へ読めるように）。
 * @returns {Array<{dateKey:string, sec:number, count:number}>}
 */
export function dailyBreakdown(log, days = 7, now = Date.now()) {
  const rows = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const start = d.getTime();
    const end = start + 24 * 60 * 60 * 1000;
    const dayLog = (log || []).filter((e) => e.at >= start && e.at < end);
    rows.push({
      dateKey: `${d.getMonth() + 1}/${d.getDate()}`,
      sec: dayLog.reduce((s, e) => s + (e.studySec || 0), 0),
      count: dayLog.length,
    });
  }
  return rows;
}

function esc(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** 統計データのCSV書き出し（表計算ソフトでの独自集計向け）。既存のhistoryExport.jsと同じ書式・付与規則。 */
export function exportPomoLogCsv(log) {
  const header = ['日時', '勉強時間（分）', '内容メモ'];
  const lines = [header.join(',')];
  for (const e of log || []) {
    const row = [e.at ? new Date(e.at).toLocaleString('ja-JP') : '', Math.round((e.studySec || 0) / 60), e.label || ''];
    lines.push(row.map(esc).join(','));
  }
  return lines.join('\n');
}
