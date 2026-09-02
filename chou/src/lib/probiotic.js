// 整腸剤を「試している期間」を見る。
//
// 決めていること
//  1. **連続日数を数えない。** 数えるのは通算の飲んだ日数と、始めてからの日数だけ
//     （飲めなかった日を責める作りにしない。README 決まり5と同じ線）。
//  2. **効いたかを採点しない。** 期間が来たら「続けるか、別の菌のものへ替えるかを決める頃です」
//     と出すだけで、アプリは判定しない。
//  3. **飲み合わせを調べない**（`docs/MVP.md` の「作らない」を守る）。

import { TRIAL_DAYS } from '../data/probiotics.js';
import { diffDays, parseKey, todayKey, rangeKeys } from './dates.js';

/** 端末に持つ形（登録していなければ null 相当） */
export function emptyProbiotic() {
  return { name: '', productId: '', startedOn: '', note: '' };
}

export function normalizeProbiotic(raw) {
  const base = emptyProbiotic();
  if (!raw || typeof raw !== 'object') return base;
  return {
    name: typeof raw.name === 'string' ? raw.name.slice(0, 60) : '',
    productId: typeof raw.productId === 'string' ? raw.productId : '',
    startedOn: parseKey(raw.startedOn) ? raw.startedOn : '',
    note: typeof raw.note === 'string' ? raw.note.slice(0, 300) : '',
  };
}

export function isRegistered(probiotic) {
  return Boolean(probiotic && probiotic.name && probiotic.startedOn);
}

/**
 * 試している期間の様子。
 * @returns {{ known:boolean, elapsed:number, takenDays:number, target:number, reached:boolean }}
 *   `takenDays` は**飲んだ日の通算**（連続ではない）。
 */
export function trialProgress(probiotic, days, today = todayKey()) {
  if (!isRegistered(probiotic)) return { known: false, elapsed: 0, takenDays: 0, target: TRIAL_DAYS, reached: false };
  const elapsed = Math.max(0, diffDays(probiotic.startedOn, today)) + 1;
  const keys = rangeKeys(probiotic.startedOn, today);
  const takenDays = keys.filter((k) => days[k] && days[k].probiotic).length;
  return {
    known: true,
    elapsed,
    takenDays,
    target: TRIAL_DAYS,
    reached: elapsed >= TRIAL_DAYS,
    startedOn: probiotic.startedOn,
  };
}

/**
 * 期間が来たときに出す一言。**どうするかは決めない**（続けるのも替えるのも本人）。
 * 責める言い方にしない——飲めなかった日があっても、それを理由にしない。
 */
export function trialLine(progress) {
  if (!progress.known) return '飲んでいる整腸剤を登録すると、試している期間が出ます。';
  if (!progress.reached) {
    return `始めてから${progress.elapsed}日目です（飲んだ日は通算${progress.takenDays}日）。`;
  }
  return (
    `始めてから${progress.elapsed}日たちました（飲んだ日は通算${progress.takenDays}日）。`
    + '出典の目安の期間です。このまま続けるか、別の菌が入ったものへ替えるかを決める頃です——'
    + 'どちらにするかはご自分で決めてください。'
  );
}

/** 次に試すなら、いま飲んでいるものと違う菌のものを（出典の勧め方）。**順位は付けない** */
export function othersThan(productId, products) {
  return products.filter((p) => p.id !== productId);
}
