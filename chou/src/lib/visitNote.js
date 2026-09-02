// 受診メモの本文を組み立てる。**このアプリを持つ理由がここ。**
//
// 決めていること
//  1. **解釈を書かない。** 「過敏性腸症候群の疑い」「◯◯が原因と思われる」は書かない。
//     並べるのは、本人が記録した事実と、その数え方だけ（鏡の `toConsultText` と同じ線）。
//  2. **数えたもとを必ず添える**（何日ぶんのうち何日記録したか）。記録していない日を
//     「症状が無かった日」と読ませないため。
//  3. **アプリが医療者へ送らない。** 作るのは文章まで。渡す相手は本人が選ぶ。

import { BELLY_STEPS, BRISTOL_GROUPS, STOOL_MARKS } from '../data/scales.js';
import { formatKey } from './dates.js';
import { hasRecord } from './days.js';
import { fillOf, bellyCounts, bristolCounts, stoolPerDay, markDays, topFoods } from './stats.js';

/** 「1日 1〜1回」と書かない（幅が無いときは幅で言わない） */
export function perDayText(per) {
  if (!per) return '';
  return per.min === per.max ? `1日 ${per.min}回` : `1日 ${per.min}〜${per.max}回`;
}

export const NOTE_PARTS = [
  { id: 'stool', label: 'お通じ（回数・かたさ）', fixed: true },
  { id: 'belly', label: 'お腹の調子' },
  { id: 'marks', label: '気になった項目（血が混じった・間に合わない感じ など）' },
  { id: 'foods', label: 'よく食べていたもの' },
  { id: 'notes', label: 'ひとことメモ' },
];

export const DEFAULT_PARTS = ['stool', 'belly', 'marks', 'notes'];

const markLabel = (id) => {
  const found = STOOL_MARKS.find((m) => m.id === id);
  return found ? found.label : id;
};

/**
 * @param {object} days   日付キーの記録
 * @param {string[]} keys 期間のキー（古い順）
 * @param {string[]} parts 入れるもの（NOTE_PARTS の id）
 * @returns {string} そのまま読める本文
 */
export function buildVisitNote(days, keys, parts = DEFAULT_PARTS) {
  if (!keys.length) return '';
  const on = (id) => id === 'stool' || parts.includes(id);
  const lines = [];
  const fill = fillOf(days, keys);

  lines.push(`【お腹の記録】${formatKey(keys[0])} 〜 ${formatKey(keys[keys.length - 1])}`);
  lines.push(`期間 ${keys.length}日間のうち、記録した日 ${fill.done}日`);
  if (fill.done === 0) {
    lines.push('');
    lines.push('この期間の記録はまだありません。');
    return lines.join('\n');
  }
  lines.push('');

  if (on('stool')) {
    const b = bristolCounts(days, keys);
    const per = stoolPerDay(days, keys);
    lines.push('■ お通じ');
    lines.push(`　回数：計${b.total}回${per ? `（記録した日の中で ${perDayText(per)}）` : ''}`);
    if (b.total > 0) {
      lines.push('　かたさ（ブリストルスケール）：');
      for (const group of BRISTOL_GROUPS) {
        const n = b.byGroup[group.id];
        const range = `${group.range[0]}〜${group.range[1]}`;
        lines.push(`　　${range}（${group.label}）：${n}回`);
      }
      if (b.unknown) lines.push(`　　かたさの記録なし：${b.unknown}回`);
    }
    lines.push('');
  }

  if (on('belly')) {
    const { counts, recorded } = bellyCounts(days, keys);
    lines.push('■ お腹の調子（本人の感じ方・5段階）');
    if (recorded === 0) {
      lines.push('　記録なし');
    } else {
      for (const step of BELLY_STEPS) {
        if (counts[step.id]) lines.push(`　${step.label}：${counts[step.id]}日`);
      }
    }
    lines.push('');
  }

  if (on('marks')) {
    const marks = markDays(days, keys);
    lines.push('■ 気になった項目（付いた日数）');
    const listed = STOOL_MARKS.filter((m) => marks[m.id]);
    if (!listed.length) {
      lines.push('　記録した範囲では、いずれも付いていません');
    } else {
      for (const mark of listed) lines.push(`　${markLabel(mark.id)}：${marks[mark.id]}日`);
    }
    lines.push('');
  }

  if (on('foods')) {
    const foods = topFoods(days, keys, 10);
    lines.push('■ よく食べていたもの（食べた日数）');
    if (!foods.length) {
      lines.push('　数えられるだけの記録がありません');
    } else {
      lines.push(`　${foods.map((f) => `${f.food} ${f.days}日`).join(' / ')}`);
    }
    lines.push('');
  }

  if (on('notes')) {
    const noted = keys.filter((k) => days[k] && days[k].note && days[k].note.trim());
    lines.push('■ 本人のメモ');
    if (!noted.length) {
      lines.push('　記録なし');
    } else {
      for (const key of noted.slice(-10)) {
        lines.push(`　${formatKey(key, { withYear: false })} ${days[key].note.trim()}`);
      }
      if (noted.length > 10) lines.push(`　（ほかに${noted.length - 10}日ぶん）`);
    }
    lines.push('');
  }

  lines.push('※ 本人がアプリに記録したものです。診断ではありません。');
  lines.push('※ 記録の無い日は「症状が無かった日」ではなく「記録していない日」です。');
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** 書き出すファイル名。日付を入れておくと、後から見分けられる */
export function visitNoteFilename(keys) {
  if (!keys.length) return 'onaka-kiroku.txt';
  return `onaka-kiroku_${keys[0]}_${keys[keys.length - 1]}.txt`;
}

/** 期間の選択肢 */
export const NOTE_RANGES = [
  { id: 14, label: '直近2週間' },
  { id: 30, label: '直近1か月' },
  { id: 90, label: '直近3か月' },
];

export { hasRecord };
