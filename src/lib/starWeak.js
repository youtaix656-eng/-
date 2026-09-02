// ★弱点タグ（G-100由来のアイデア）— 復習中に選んだ○△✕の「質」の組み合わせから、
//   自動で3段階の優先度（★1〜★3）を付ける。既存の「リーチ（誤答回数が規定以上）」は
//   ○△✕を区別しない単純な閾値判定だが、こちらは「わからない（✕）」を重く、
//   「あいまい（△）」を軽く数えることで、もう一段細かく「今日絶対つぶす」問題を
//   浮かび上がらせる。端末内のみ・△✕の累計回数は一度上がったら下がらない
//   （wrongCount と同じ考え方。カウントをリセットする画面は用意しない）。

import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:selfKindCounts'; // { [questionId]: { sankaku: n, batsu: n } }

// ✕が2回以上→★3（毎日つぶす）、△が3回以上→★2、それ未満は★なし。
export const STAR_RULES = { batsuFor3: 2, sankakuFor2: 3 };

export async function loadSelfKindCounts() {
  try { return (await idbGet(KEY)) || {}; } catch (e) { return {}; }
}

export async function recordSelfKindCount(questionId, kind) {
  if (kind !== 'sankaku' && kind !== 'batsu') return loadSelfKindCounts();
  const counts = await loadSelfKindCounts();
  const cur = counts[questionId] || { sankaku: 0, batsu: 0 };
  const next = { ...counts, [questionId]: { ...cur, [kind]: (cur[kind] || 0) + 1 } };
  try { await idbSet(KEY, next); } catch (e) { /* noop */ }
  return next;
}

// ★レベル（0〜3）。✕優先で判定する（✕2回＝★3は、△が何回あっても★3のまま）。
export function starLevelOf(counts) {
  const c = counts || {};
  const batsu = c.batsu || 0;
  const sankaku = c.sankaku || 0;
  if (batsu >= STAR_RULES.batsuFor3) return 3;
  if (sankaku >= STAR_RULES.sankakuFor2) return 2;
  return 0;
}

export function starLabel(level) {
  return level > 0 ? '★'.repeat(level) : '';
}
