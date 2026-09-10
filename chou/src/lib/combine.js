// 食べ合わせを「アダムスキー式ではどう言われるか」で並べる。
//
// **判定しない・保存しない。** 出すのは「この考え方ではこう言われる」までで、
// 「詰まっている」「毒素が出ている」とアプリが言い切ることはしない
// （`data/adamski.js` の決めごと1）。返した結果も端末に保存しない
// （保存するのは入力だけ＝README 決まり12）。

import {
  SPEED_NAMED,
  SPEED_BY_CATEGORY,
  SPEED_DEFAULT,
  SPEED_BY_ID,
  MEAL_GAP_HOURS,
} from '../data/adamski.js';
import { FODMAP_FOODS } from '../data/fodmap.js';
import { splitFoods } from './days.js';
import { timeOrder } from './dates.js';
import { foldKana } from './yomi.js';

const NAMED = new Map(SPEED_NAMED.map((f) => [f.name, f]));
const FOOD_BY_NAME = new Map(FODMAP_FOODS.map((f) => [f.name, f]));

// **表記のゆれで取りこぼさない。** 書く人は「ジャガイモ」とも「じゃがいも」とも書く。
// カタカナ・ひらがな・濁点をそろえた形でも引けるようにする（`foldKana` は目次と同じもの）。
const NAMED_FOLDED = new Map(SPEED_NAMED.map((f) => [foldKana(f.name), f]));
const FOOD_FOLDED = new Map(FODMAP_FOODS.map((f) => [foldKana(f.name), f]));

/** 表記のゆれを軽くそろえる（前後の空白と全角の記号だけ。中身は書き換えない） */
function tidy(name) {
  return String(name || '').trim();
}

/**
 * 食べものの速さと、**その出どころ**を返す。
 * 出どころ（basis）を必ず一緒に返すのは、**当てはめたものを名指しと同じ顔で見せない**ため。
 *
 * @returns {{ name: string, speed: 'fast'|'slow'|'neutral'|null, basis: 'named'|'category'|'default'|'unknown' }}
 */
export function speedOf(name) {
  const key = tidy(name);
  if (!key) return { name: key, speed: null, basis: 'unknown' };
  const folded = foldKana(key);
  const named = NAMED.get(key) || NAMED_FOLDED.get(folded);
  if (named) return { name: key, speed: named.speed, basis: 'named' };
  const food = FOOD_BY_NAME.get(key) || FOOD_FOLDED.get(folded);
  if (food) {
    const byCategory = SPEED_BY_CATEGORY[food.category];
    if (byCategory) return { name: key, speed: byCategory, basis: 'category' };
    return { name: key, speed: SPEED_DEFAULT, basis: 'default' };
  }
  return { name: key, speed: null, basis: 'unknown' };
}

/** 名前を部分一致でも探す（「トマトソース」で「トマト」に当てる）。**当たった語を返す** */
export function findSpeedIn(text) {
  const raw = tidy(text);
  if (!raw) return [];
  const hits = [];
  const seen = new Set();
  // **同じ語に二度当てない。** 「メロン」で名指しの『メロン』と一覧の『メロン（マスクメロン）』の
  // 両方が当たると、同じものが2行並んで見える（実機で出た）。先に当たった側だけを残す。
  const matchedSeen = new Set();
  for (const source of [SPEED_NAMED, FODMAP_FOODS]) {
    for (const food of source) {
      const name = food.name;
      if (seen.has(name)) continue;
      // 「（小麦）」のような注記を外した見出しでも当てる
      const head = name.replace(/[（(].*$/, '');
      if (!head) continue;
      if (raw.includes(name) || raw.includes(head)) {
        const matched = raw.includes(name) ? name : head;
        if (matchedSeen.has(matched)) continue;
        matchedSeen.add(matched);
        seen.add(name);
        hits.push({ ...speedOf(name), matched });
      }
    }
  }
  return hits;
}

/**
 * 組み合わせを見る。**「よい・悪い」を返さない**——数えた結果だけを返し、
 * 言葉にするのは画面側（しかも「この考え方では」と必ず添える）。
 */
export function checkCombination(names) {
  const list = (Array.isArray(names) ? names : []).map(tidy).filter(Boolean);
  const items = [...new Set(list)].map(speedOf);
  const counts = { fast: 0, slow: 0, neutral: 0, unknown: 0 };
  for (const item of items) counts[item.speed || 'unknown'] += 1;
  return {
    items,
    counts,
    // 速いものと遅いものが同じ食事に並んでいるか（出典が言う「合わない組み合わせ」の形）
    mixed: counts.fast > 0 && counts.slow > 0,
    hasNeutral: counts.neutral > 0,
    unknown: items.filter((i) => i.basis === 'unknown').map((i) => i.name),
    // 当てはめただけのもの（名指しではない）は必ず数えて画面に出す
    guessed: items.filter((i) => i.basis === 'category' || i.basis === 'default').length,
  };
}

/** その日のたべものメモから、食事1件ずつの組み合わせを見る */
export function checkDay(day) {
  if (!day || !Array.isArray(day.meals)) return [];
  return day.meals.map((meal) => ({
    id: meal.id,
    at: meal.at || '',
    text: meal.text,
    result: checkCombination(splitFoods(meal.text)),
  }));
}

/**
 * 食事と食事の間隔（分）。
 * **時刻の無い記録は数えない**——数えないことも返して、黙って0件にしない。
 */
export function mealGaps(day) {
  const meals = ((day && day.meals) || []).filter((m) => /^\d{1,2}:\d{2}$/.test(m.at || ''));
  const skipped = ((day && day.meals) || []).length - meals.length;
  const sorted = [...meals].sort((a, b) => timeOrder(a.at) - timeOrder(b.at));
  const gaps = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const minutes = timeOrder(sorted[i].at) - timeOrder(sorted[i - 1].at);
    gaps.push({
      from: sorted[i - 1].at,
      to: sorted[i].at,
      minutes,
      // 出典が言う目安（4時間）に届いたか。**守れなかったことを責めない**ための素の値
      reachesGuide: minutes >= MEAL_GAP_HOURS * 60,
    });
  }
  return { gaps, skipped, guideHours: MEAL_GAP_HOURS };
}

/**
 * その日の最初の食事が「速いものだけ」だったか。
 * **時刻が無ければ見ない**（勝手に「朝の食事」と決めない）。
 */
export function morningCheck(day) {
  const meals = ((day && day.meals) || []).filter((m) => /^\d{1,2}:\d{2}$/.test(m.at || ''));
  if (!meals.length) return { known: false, reason: '時刻の入った食事の記録がありません' };
  const first = [...meals].sort((a, b) => timeOrder(a.at) - timeOrder(b.at))[0];
  const result = checkCombination(splitFoods(first.text));
  if (!result.items.length) return { known: false, reason: '食べたものが読み取れませんでした', at: first.at };
  return {
    known: true,
    at: first.at,
    text: first.text,
    // 速い・ニュートラルだけで、遅いものが入っていない
    lightOnly: result.counts.slow === 0 && result.counts.fast > 0,
    result,
  };
}

/** 画面に出す時の言い方（速さの呼び名は `SPEED_CLASSES` が単一の正） */
export function speedLabel(speed) {
  return SPEED_BY_ID[speed] ? SPEED_BY_ID[speed].label : '出典に出てきません';
}
