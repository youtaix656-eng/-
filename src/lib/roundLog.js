// 周回速度ログ（G-100由来）— 学習(10・60・300・900)の1回分（1周）にかかった実時間を記録し、
//   同じ目標での前回と比べて「短縮できているか」を見せる。端末内のみ・直近50件だけ保持する
//   （無制限に増やさない。古いものは自然に落ちる）。

import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:roundLog';
const MAX_ENTRIES = 50;

export async function loadRoundLog() {
  try { return (await idbGet(KEY)) || []; } catch (e) { return []; }
}

// target: 押した目標値（10/60/300/900）、count: 実際に出題された問数、ms: 所要時間（ミリ秒）
export async function appendRoundLog({ target, count, ms, at = Date.now() }) {
  const log = await loadRoundLog();
  const next = [...log, { target, count, ms, at }].slice(-MAX_ENTRIES);
  try { await idbSet(KEY, next); } catch (e) { /* noop */ }
  return next;
}

// 同じtargetで完了した直近の回を探す（excludeAtで今回自身を除外できる）
export function previousForTarget(log, target, excludeAt) {
  const matches = (log || []).filter((e) => e.target === target && e.at !== excludeAt);
  if (matches.length === 0) return null;
  return matches.reduce((a, b) => (a.at > b.at ? a : b));
}

export function formatDuration(ms) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m === 0 ? `${s}秒` : `${m}分${s}秒`;
}

// 前回比の短縮率（%）。1問あたりの所要時間で比べる（問数が毎回同じとは限らないため）。
// 正なら短縮・負なら遅くなった。比較できない場合はnull（0除算・欠損データを避ける）。
export function speedupPct(curMs, curCount, prevMs, prevCount) {
  if (!prevMs || !prevCount || !curCount) return null;
  const curPerQ = curMs / curCount;
  const prevPerQ = prevMs / prevCount;
  if (prevPerQ <= 0) return null;
  return Math.round(((prevPerQ - curPerQ) / prevPerQ) * 100);
}
