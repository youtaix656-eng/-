// 見立てを、あとから読み直すための道具。
//
// 守ること:
//   1. **上書きで消さない。** 直すたびに前の版を残す（`snapshots`）。
//      同じ人でも、3か月前と今では見えているものが違う。
//   2. **勝手に消さない・勝手に直さない。** 古い見立てには印を付けるだけ
//      （競合台帳・知識ベースと同じ線）。
//   3. **比べても採点しない。** 出すのは「共通・増えた・減った」だけで、
//      良くなった／悪くなったは書かない。
//   4. ネットワークに触れない。

import { STALE_DAYS } from '../data/people.js';

/** 残す版の上限（古いものから落とす。端末の中を膨らませない） */
export const SNAPSHOT_MAX = 20;

/** 直す前の中身を1つの版として積む。中身が同じなら積まない */
export function pushSnapshot(existing, nextCheckedIds = []) {
  const before = existing.checkedIds || [];
  const same =
    before.length === nextCheckedIds.length && before.every((id) => nextCheckedIds.includes(id));
  if (same) return existing.snapshots || [];
  const snap = { at: existing.updatedAt || existing.createdAt, checkedIds: before };
  return [snap, ...(existing.snapshots || [])].slice(0, SNAPSHOT_MAX);
}

/** その見立ての移り変わり（新しい順。いまの中身を先頭に置く） */
export function timelineOf(c) {
  return [
    { at: c.updatedAt, checkedIds: c.checkedIds, now: true },
    ...(c.snapshots || []).map((s) => ({ ...s, now: false })),
  ];
}

/**
 * 2つを比べる。**採点しない**——出すのは共通・片方だけ、の3つ。
 * @returns {{both:string[], onlyA:string[], onlyB:string[]}}
 */
export function compare(a = [], b = []) {
  const A = new Set(a);
  const B = new Set(b);
  return {
    both: a.filter((x) => B.has(x)),
    onlyA: a.filter((x) => !B.has(x)),
    onlyB: b.filter((x) => !A.has(x)),
  };
}

/** 見直しの目安を過ぎているか（印を付けるだけ） */
export function isStale(c, now = Date.now()) {
  return now - (c.updatedAt || 0) > STALE_DAYS * 24 * 60 * 60 * 1000;
}

/** 何日前に直したか */
export function daysSince(at, now = Date.now()) {
  return Math.floor((now - (at || 0)) / (24 * 60 * 60 * 1000));
}

/** そのふるまいを、いつ見たことにしてあるか */
export function seenAtOf(c, behaviorId) {
  return (c.seenAt || {})[behaviorId] || 0;
}

/** チェックした時刻を控える（外したものは落とす） */
export function withSeenAt(prev = {}, checkedIds = [], now = Date.now()) {
  const out = {};
  for (const id of checkedIds) out[id] = prev[id] || now;
  return out;
}

/** 消したものを1件だけ持っておく（すぐ戻せるように） */
export function makeUndo(c) {
  return c ? { at: Date.now(), item: c } : null;
}

/** 戻せる時間（これを過ぎたら画面から消す） */
export const UNDO_MS = 20000;

/**
 * 同時に持っておける「消したもの」の数。
 * **1件だけだと、続けて消したときに前のぶんが黙って戻せなくなる**（実際に踏んだ）。
 */
export const UNDO_KEEP = 3;

export function undoAlive(undo, now = Date.now()) {
  return !!undo && now - undo.at < UNDO_MS;
}
