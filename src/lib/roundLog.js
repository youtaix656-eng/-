// 周回速度ログ（G-100由来）— 学習(10・60・300・900)の1回分（1周）にかかった実時間を記録し、
//   同じ目標での前回と比べて「短縮できているか」を見せる。端末内のみ・直近500件だけ保持する
//   （無制限に増やさない。古いものは自然に落ちる）。
//   500件にしているのはG-100（1〜100周）の「通算◯回目」表示のため。50件だと
//   ターゲットを混在させて使うだけで100周分より先に古い記録が溢れ、通算カウンターが
//   実際より少なく出てしまう。1エントリはごく小さいので500件でも容量上の問題は無い。

import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:roundLog';
const MAX_ENTRIES = 500;

export async function loadRoundLog() {
  try { return (await idbGet(KEY)) || []; } catch (e) { return []; }
}

// target: 押した目標値（10/60/300/900）、count: 実際に出題された問数、ms: 所要時間（ミリ秒）。
// graded/wrong（省略可・後方互換）: 自己採点した問数・そのうち誤答数。前回との正答率比較に使う。
// subject（省略可）: 単一科目に絞っていた場合の科目名（複数科目・全科目の時は省略）。
export async function appendRoundLog({ target, count, ms, at = Date.now(), graded, wrong, subject }) {
  const log = await loadRoundLog();
  const entry = { target, count, ms, at };
  if (graded != null) entry.graded = graded;
  if (wrong != null) entry.wrong = wrong;
  if (subject) entry.subject = subject;
  const next = [...log, entry].slice(-MAX_ENTRIES);
  try { await idbSet(KEY, next); } catch (e) { /* noop */ }
  return next;
}

// 同じtargetで完了した直近の回を探す（excludeAtで今回自身を除外できる）
export function previousForTarget(log, target, excludeAt) {
  const matches = (log || []).filter((e) => e.target === target && e.at !== excludeAt);
  if (matches.length === 0) return null;
  return matches.reduce((a, b) => (a.at > b.at ? a : b));
}

// 同じtargetで完了した回数（通算◯周目の表示用）。ログはMAX_ENTRIES件で古いものから
// 落ちるため、あくまで直近の保持件数内での通算であることに注意（正確な生涯合計ではない）。
export function countForTarget(log, target) {
  return (log || []).filter((e) => e.target === target).length;
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

// 同じtargetの直近2回を比べた短縮率（これまでSession.jsxの完了画面にしか出ておらず、
// 週次ジャーナルや合格体験記の下書きでは使われていなかった「成長の数字」）。
// 記録が2回未満ならnull。
export function latestSpeedup(log, target) {
  const matches = (log || []).filter((e) => e.target === target).sort((a, b) => b.at - a.at);
  if (matches.length < 2) return null;
  const [latest, prev] = matches;
  return speedupPct(latest.ms, latest.count, prev.ms, prev.count);
}

// 前回との正答率比較（音声学習のaudioReviewLog.jsのpreviousFinishと同じ考え方）。
// graded/wrongを記録していない回（旧データ・自己採点なし）は比較対象から除く。
// excludeAtで今回自身を除外できる。
export function previousAccuracyForTarget(log, target, excludeAt) {
  const matches = (log || []).filter(
    (e) => e.target === target && e.at !== excludeAt && e.graded != null && e.graded > 0
  );
  if (matches.length === 0) return null;
  const prev = matches.reduce((a, b) => (a.at > b.at ? a : b));
  return { accuracyPct: Math.round(((prev.graded - (prev.wrong || 0)) / prev.graded) * 100), at: prev.at };
}

// 学習セッションの「開始」ログ（完了率の算出用。audioReviewLog.jsの考え方を移植）。
// 誤答復習・○の見直し・バッファ枠等の可変長セッション（session.label/session.bufferあり）は
// 対象外——標準セッション（10/60/300/900）だけで比べる。
const START_KEY = 'shinkyu:roundStartLog';
const START_MAX_ENTRIES = 200;

export async function loadRoundStartLog() {
  try { return (await idbGet(START_KEY)) || []; } catch (e) { return []; }
}

export async function recordRoundStart(target) {
  const log = await loadRoundStartLog();
  const next = [...log, { target, at: Date.now() }].slice(-START_MAX_ENTRIES);
  try { await idbSet(START_KEY, next); } catch (e) { /* noop */ }
  return next;
}

// targetごとの完了率（開始したうち、実際に最後まで終えた割合）。
// 低いtargetに「無理せずもう少し少ない件数にしてみては？」と提案する材料にする。
export function completionRateByTarget(startLog, finishLog) {
  const starts = new Map();
  for (const e of startLog || []) starts.set(e.target, (starts.get(e.target) || 0) + 1);
  const finishes = new Map();
  for (const e of finishLog || []) finishes.set(e.target, (finishes.get(e.target) || 0) + 1);
  const out = {};
  for (const [target, s] of starts) {
    const f = finishes.get(target) || 0;
    out[target] = { starts: s, finishes: f, rate: s > 0 ? f / s : null };
  }
  return out;
}

function escCsv(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// 周回ログの書き出し（audioReviewLog.jsのlogToCsvと同じパターン）。
export function roundLogToCsv(log) {
  const header = ['目標件数', '日時', '出題数', '所要時間', '科目', '自己採点数', '誤答数'];
  const rows = (log || []).map((e) =>
    [
      e.target,
      e.at ? new Date(e.at).toLocaleString('ja-JP') : '',
      e.count,
      formatDuration(e.ms),
      e.subject || '',
      e.graded ?? '',
      e.wrong ?? '',
    ]
      .map(escCsv)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}
