// 間違いの「型」記録（#9）— 誤答/△/✕のとき「勘違い・知識不足・ケアレス」をワンタップ記録。
//   端末内のみ（外部送信なし）。型別に復習の効かせ方を変える基礎データにする。
//
// データ形式：{ [questionId]: [{type, at}, ...] }（新しい記録ほど配列の末尾）。
//   以前は最新1件（{type,at}）だけを上書き保存していたため、同じ問題を何度も間違えた時に
//   「前はどの型だったか」が分からなかった（#5）。旧形式（単一オブジェクト）のデータも
//   読めるよう、読み出し側（latestMissType等）で吸収する。

import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:missTypes';
// 以前は問題ごとに直近20件だけを自動で残していたが、ユーザー指定により
// 「誤答理由は消さない（自動で間引かない）。消すときは手動で消す」仕様に変更（#23）。
// 削除は clearMissTypeHistory / clearAllMissTypes からのみ行う（Settings.jsx導線）。

export const MISS_TYPES = [
  { id: 'kanchigai', label: '勘違い', hint: '対比で整理' },
  { id: 'chishiki', label: '知識不足', hint: '解説を強化' },
  { id: 'careless', label: 'ケアレス', hint: '落ち着いて再確認' },
];

export function missTypeLabel(id) {
  return MISS_TYPES.find((t) => t.id === id)?.label || '';
}

// 型別の再出題までの間隔。ケアレスは短め（もう一度落ち着いて確認）、
//   知識不足は長め（解説を読み込む時間を作ってから再出題）。既定（型なし）は20分。
export const MISS_TYPE_DELAY_MS = {
  careless: 10 * 60 * 1000,
  kanchigai: 20 * 60 * 1000,
  chishiki: 24 * 60 * 60 * 1000,
};

export async function loadMissTypes() {
  try { return (await idbGet(KEY)) || {}; } catch (e) { return {}; }
}

// entryは新旧どちらの形式もありうる（配列＝新形式、{type,at}＝旧形式、未登録＝null）。
// 常に配列として扱えるように正規化する。
function historyOf(entry) {
  if (!entry) return [];
  if (Array.isArray(entry)) return entry;
  return [entry];
}

// 直近の型（表示・フィルタで「今の型」として使う値）。
export function latestMissType(entry) {
  const h = historyOf(entry);
  return h.length > 0 ? h[h.length - 1] : null;
}

export async function recordMissType(questionId, type) {
  const m = await loadMissTypes();
  const history = historyOf(m[questionId]);
  // 自動では間引かない（#23）。件数の上限は持たず、消すのは手動のみ。
  m[questionId] = [...history, { type, at: Date.now() }];
  try { await idbSet(KEY, m); } catch (e) { /* noop */ }
  return m;
}

// この問題の誤答理由の記録だけを手動で消す（#23）。
export async function clearMissTypeHistory(questionId) {
  const m = await loadMissTypes();
  if (m[questionId] == null) return m;
  const next = { ...m };
  delete next[questionId];
  try { await idbSet(KEY, next); } catch (e) { /* noop */ }
  return next;
}

// 誤答理由の記録をすべて手動で消す（#23。設定画面から確認のうえ実行）。
export async function clearAllMissTypes() {
  try { await idbSet(KEY, {}); } catch (e) { /* noop */ }
  return {};
}

// 全問題ぶんの誤答理由の記録件数（Settings.jsxの削除確認表示に使う）。
export function totalMissTypeCount(missTypes) {
  let n = 0;
  for (const entry of Object.values(missTypes || {})) n += historyOf(entry).length;
  return n;
}

// 基準時刻以降の型別件数（全問題ぶんの記録を横断して集計）。
export function missTypeCounts(missTypes, sinceMs = 0) {
  const counts = {};
  for (const id of MISS_TYPES.map((t) => t.id)) counts[id] = 0;
  for (const entry of Object.values(missTypes || {})) {
    for (const rec of historyOf(entry)) {
      if (rec.at >= sinceMs && counts[rec.type] != null) counts[rec.type] += 1;
    }
  }
  return counts;
}

// 直近window日と、その前のwindow日を比べ、最も増えた型を1つ返す（#6「最近はケアレスが多い」）。
// 母数が少ない時（合計5件未満）は当てずっぽうになるためnullを返す。
export function missTypeTrend(missTypes, now = Date.now(), windowMs = 7 * 24 * 60 * 60 * 1000) {
  const recent = missTypeCounts(missTypes, now - windowMs);
  const prior = missTypeCounts(missTypes, now - windowMs * 2);
  const recentTotal = Object.values(recent).reduce((a, b) => a + b, 0);
  if (recentTotal < 5) return null;
  let best = null;
  for (const id of Object.keys(recent)) {
    const priorCount = Math.max(0, prior[id] - recent[id]); // priorは2窓分の累計なので、直近分を引いて「前の窓だけ」にする
    const delta = recent[id] - priorCount;
    if (!best || delta > best.delta) best = { type: id, count: recent[id], delta };
  }
  return best;
}

// 今日の型別合計が、直近days日間の1日あたり平均よりも明らかに多いか（#30 異常な急増検知）。
// 「明らか」の基準は3件以上かつ平均の2倍以上（少ない母数で過敏に反応しないように）。
export function missTypeAnomaly(missTypes, now = Date.now(), days = 14) {
  const dayMs = 24 * 60 * 60 * 1000;
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayTotal = Object.values(missTypeCounts(missTypes, todayStart.getTime())).reduce((a, b) => a + b, 0);
  const periodStart = todayStart.getTime() - days * dayMs;
  const periodTotal = Object.values(missTypeCounts(missTypes, periodStart)).reduce((a, b) => a + b, 0);
  const priorTotal = Math.max(0, periodTotal - todayTotal);
  const avgPerDay = priorTotal / days;
  const isAnomaly = todayTotal >= 3 && todayTotal >= avgPerDay * 2;
  return { todayTotal, avgPerDay: Math.round(avgPerDay * 10) / 10, isAnomaly };
}
