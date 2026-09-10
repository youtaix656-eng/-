// ためしにやめてみる期間（小麦・乳製品など）。
//
// 決めていること
//  1. **連続日数を数えない。** 出すのは「始めてから何日目か」だけで、
//     守れた日・守れなかった日を数えない（README 決まり5。断食の日数も同じ扱い）。
//  2. **効いたかを採点しない。** 期間が来たら「戻してみる頃です」と出すだけ。
//     良くなった・悪くなったの判定はしない——判定できる材料をアプリが持っていないため。
//  3. **やめたままにさせない。** 除去は**試すためのもので、続けるためのものではない**。
//     期間が過ぎたら必ず「一度戻して、変わるかを見る」を出す（低FODMAP と同じ考え方）。
//  4. **保存するのは入力だけ**（いつ始めた・いつ終えた・ひとこと）。判定結果は保存しない。
//  5. **同じ食べものを一度に2つ以上やめない**——2つ同時にやめると、どちらが効いたのか
//     分からなくなる。`canStart` が実行中の1件を見て断る（**勝手に入れ替えない**）。

import { ELIMINATION_TARGETS } from '../data/protein.js';
import { diffDays, parseKey, todayKey } from './dates.js';

const NOTE_MAX = 300;
const TARGET_IDS = ELIMINATION_TARGETS.map((t) => t.id);

export const TARGET_BY_ID = Object.fromEntries(ELIMINATION_TARGETS.map((t) => [t.id, t]));

/** 1件ぶんの形 */
export function normalizeElimination(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!TARGET_IDS.includes(raw.targetId)) return null;
  if (!parseKey(raw.startedOn)) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `e${raw.targetId}${raw.startedOn}`,
    targetId: raw.targetId,
    startedOn: raw.startedOn,
    endedOn: parseKey(raw.endedOn) ? raw.endedOn : '',
    note: typeof raw.note === 'string' ? raw.note.slice(0, NOTE_MAX) : '',
  };
}

export function normalizeEliminations(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeElimination).filter(Boolean);
}

/** いま試している最中のもの（終わっていないもの）。**同時に走るのは1件だけ** */
export function running(list) {
  return (list || []).find((e) => !e.endedOn) || null;
}

/**
 * 始めてよいか。**2つ同時にやめない**——どちらが効いたのか分からなくなるため。
 * 断るだけで、**勝手に入れ替えない**（どちらをやめるかは本人が決める）。
 */
export function canStart(list, targetId) {
  if (!TARGET_IDS.includes(targetId)) return { ok: false, reason: 'この食べものは一覧にありません。' };
  const now = running(list);
  if (!now) return { ok: true, reason: '' };
  const name = TARGET_BY_ID[now.targetId] ? TARGET_BY_ID[now.targetId].name : now.targetId;
  return {
    ok: false,
    reason:
      `いま「${name}」を試している最中です。2つ同時にやめると、どちらが効いたのか分からなくなります。`
      + '先にこちらを終えてください。',
  };
}

/**
 * 試している様子。
 * @returns {{ known:boolean, elapsed:number, target:number, reached:boolean, name:string }}
 *   `elapsed` は**始めてから何日目か**だけ（守れた日数は数えない）。
 */
export function progressOf(entry, today = todayKey()) {
  if (!entry) return { known: false, elapsed: 0, target: 0, reached: false, name: '' };
  const target = TARGET_BY_ID[entry.targetId];
  const last = entry.endedOn || today;
  const elapsed = Math.max(0, diffDays(entry.startedOn, last)) + 1;
  const days = target ? target.days : 0;
  return {
    known: true,
    elapsed,
    target: days,
    reached: days > 0 && elapsed >= days,
    name: target ? target.name : entry.targetId,
    ended: Boolean(entry.endedOn),
  };
}

/**
 * 期間が来たときに出す一言。
 * **「よくなったか」を聞かない**——聞くと、期待した答えのほうへ寄ってしまう。
 * 出すのは「一度戻してみる」という次の一手だけ。
 */
export function progressLine(progress) {
  if (!progress.known) return '試しているものはありません。';
  if (progress.ended) {
    return `「${progress.name}」を試した記録です（${progress.elapsed}日間）。`;
  }
  if (!progress.reached) {
    return `「${progress.name}」をやめてみて${progress.elapsed}日目です（目安は${progress.target}日）。`;
  }
  return (
    `「${progress.name}」をやめてみて${progress.elapsed}日たちました。`
    + '**一度もとに戻して、変わるかどうかを見る頃です**——'
    + '戻して何ともなければ、やめ続ける理由はありません。'
  );
}

/** やめたままにさせないための一文（画面に必ず出す） */
export const RESTORE_NOTE =
  '除去は**試すためのもので、続けるためのものではありません。**'
  + '期間が終わったら一度もとに戻して、変わるかどうかを見てください。'
  + '食べられるものを減らしたままにすると、栄養が偏るほうが害になります。';

/** 済んだもの（新しい順）。**採点はしないので、並べるだけ** */
export function finished(list) {
  return (list || [])
    .filter((e) => e.endedOn)
    .slice()
    .sort((a, b) => (a.endedOn < b.endedOn ? 1 : -1));
}
