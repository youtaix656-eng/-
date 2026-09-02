// 「今強化すべき機能ベスト3」の提案（2026-09-02、ユーザーとの相談で決めた内容をユーザー指定で
// アプリ内にも記録。CLAUDE.mdの「ユーザー本人の学習スケジュール」と対になる開発優先度メモ）。
// 期限は決めず、ユーザーが「もう表示しない」を押すまでホーム画面で日替わりに1件だけ出し続ける
// （featureDiscovery.jsのsuggestUnvisitedFeatureと同じ日替わりローテーション方式）。

import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:priorityFocusDismissed';

export const PRIORITY_FOCUS_ITEMS = [
  {
    id: 'coverage',
    title: '① 網羅マップ・手薄科目の問題拡充',
    reason: '出題基準に対して問題数が少ない科目（関係法規・医療概論など）があると、復習・分析の精度そのものが上がりません。今の一番のボトルネックです。',
    view: 'coverage',
    cta: '網羅マップを見る',
  },
  {
    id: 'exam',
    title: '② 模試の精度（配分・問題プール）',
    reason: '合格ゴールの判定基準そのもの（模試60%を2回連続）です。科目別配分が出題基準と合っているか、直前期に問題が枯渇しないかを確認しましょう。',
    view: 'exam',
    cta: '模試へ',
  },
  {
    id: 'review',
    title: '③ 復習・SRSを毎日ゼロに戻す',
    reason: '仕組みはすでに強力です。あとは「要注意」バッジと「○にした問題のふりかえり」を毎日実際に使う運用が効きます。',
    view: 'review',
    cta: '復習へ',
  },
];

// 日替わりで安定した1件を選ぶ（同じ日はHomeを何度再描画しても同じ提案のまま）。
function dayIndex(date = new Date()) {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const diff = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start;
  return Math.floor(diff / 86400000);
}

export async function loadDismissedPriorityFocus() {
  try { return (await idbGet(KEY)) || []; } catch (e) { return []; }
}

// 「もう表示しない」を押した項目を手動で消す（期限は設けず、消すのはユーザーの操作のみ）。
export async function dismissPriorityFocus(id) {
  const list = await loadDismissedPriorityFocus();
  if (list.includes(id)) return list;
  const next = [...list, id];
  try { await idbSet(KEY, next); } catch (e) { /* noop */ }
  return next;
}

// 消していない項目の中から、日替わりで1件だけ選ぶ。全部消していればnull。
export function suggestPriorityFocus(dismissedIds, date = new Date()) {
  const dismissed = new Set(dismissedIds || []);
  const candidates = PRIORITY_FOCUS_ITEMS.filter((it) => !dismissed.has(it.id));
  if (candidates.length === 0) return null;
  const idx = dayIndex(date) % candidates.length;
  return candidates[idx];
}
