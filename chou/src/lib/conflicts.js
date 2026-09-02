// 低FODMAP と アダムスキー式が**正面から食い違う**ところ。
//
// **アプリはどちらが正しいかを決めない**（変革ノートのモンクモード `CONFLICTS` と同じ線）。
// 両方の言い分を並べて、決めるのは本人——というのがこの機能でいちばん大事な所。
// 実際、ヨーグルト・はちみつ・たまねぎ・にんにく・牛乳は片方が「勧める側」、
// 片方が「多めなので減らす候補」で、そのまま反対になる。
//
// **一覧は元データから毎回導く**（書き写さない）。片方を直したときに黙って食い違わないため。

import { FODMAP_FOODS, FODMAP_LEVELS } from '../data/fodmap.js';
import { SPEED_NAMED, SPEED_BY_ID } from '../data/adamski.js';
import { FERMENTED_FOODS } from '../data/cleanup.js';
import { SPEED_BASIS_LABELS } from '../data/adamski.js';
import { speedOf, speedLabel } from './combine.js';

const levelLabel = (id) => {
  const found = FODMAP_LEVELS.find((l) => l.id === id);
  return found ? found.label : id;
};

/**
 * 食い違いの形は2つ。
 *  - `fodmap_high_but_fast`  … 低FODMAP では「多め（減らす候補）」なのに、
 *                              アダムスキー式では「速い（朝に勧められる）」
 *  - `fodmap_high_but_neutral` … 低FODMAP では「多め」なのに、
 *                              アダムスキー式では「消化を助ける」
 */
export const CONFLICT_KINDS = {
  fodmap_high_but_fast: '低FODMAP では減らす候補、アダムスキー式では朝に勧められる',
  fodmap_high_but_neutral: '低FODMAP では減らす候補、アダムスキー式では消化を助けるとされる',
};

/** 食い違う食べものを、両方の言い分つきで返す（名指しされているものだけを見る） */
export function conflictFoods() {
  const out = [];
  for (const named of SPEED_NAMED) {
    const food = FODMAP_FOODS.find((f) => f.name === named.name);
    if (!food || food.level !== 'high') continue;
    const kind = named.speed === 'fast' ? 'fodmap_high_but_fast' : named.speed === 'neutral' ? 'fodmap_high_but_neutral' : null;
    if (!kind) continue;
    out.push({
      name: named.name,
      reading: named.reading,
      kind,
      fodmap: levelLabel(food.level),
      speed: SPEED_BY_ID[named.speed].label,
      lines: [
        `低FODMAP の一覧では「${levelLabel(food.level)}」に入っています。`,
        `アダムスキー式では「${SPEED_BY_ID[named.speed].label}」とされています。`,
      ],
    });
  }
  return out;
}

/** その食べものが食い違っているか（一覧の脇に印を出すため） */
export function conflictOf(name) {
  return conflictFoods().find((c) => c.name === name) || null;
}

/** 食い違いを見つけた時に必ず出す文。**どちらかを選ばせない・どちらかを消さない** */
export const CONFLICT_NOTE =
  'この食べものは、2つの考え方で言っていることが反対になります。'
  + 'このアプリはどちらが正しいかを決めません。合うかどうかは、'
  + 'しばらく試して自分の記録で見つけてください。';

/** 名指しされている食べものに、片方の見方しか無いもの（片手落ちを黙らせないため） */
export function onlyInAdamski() {
  return SPEED_NAMED.filter((named) => !FODMAP_FOODS.some((f) => f.name === named.name)).map((n) => n.name);
}

export { speedOf };

/**
 * 発酵食品を、**3つの考え方から同時に見る**。
 *  - 腸活（この素材）：発酵食品として勧められている
 *  - 低FODMAP：多め／量による＝減らす候補になりうる
 *  - アダムスキー式：速い／遅い／ニュートラル
 *
 * **どれが正しいかを決めない。** 3つとも並べて、決めるのは本人。
 * ヨーグルトはこの3つが全部ぶつかる（勧められる／減らす候補／朝に勧められる）代表例。
 */
export function fermentViews() {
  return FERMENTED_FOODS.map((food) => {
    const inFodmap = FODMAP_FOODS.find((f) => f.name === food.name);
    const speed = speedOf(food.name);
    const level = inFodmap ? levelLabel(inFodmap.level) : null;
    return {
      name: food.name,
      reading: food.reading,
      cleanup: '発酵食品として勧められています',
      fodmap: level,
      fodmapId: inFodmap ? inFodmap.level : null,
      speed: speed.basis === 'unknown' ? null : speedLabel(speed.speed),
      speedBasis: speed.basis,
      // 低FODMAP が「多め／量による」なら、勧める側とぶつかる
      conflict: Boolean(inFodmap && inFodmap.level !== 'low'),
      views: [
        `腸活では：発酵食品として勧められています。`,
        level ? `低FODMAP の一覧では「${level}」に入っています。` : '低FODMAP の一覧には出てきません。',
        // **当てはめただけのものを名指しと同じ顔で見せない**（出どころを必ず添える）
        speed.basis === 'unknown'
          ? 'アダムスキー式には出てきません。'
          : `アダムスキー式では「${speedLabel(speed.speed)}」`
            + `（${SPEED_BASIS_LABELS[speed.basis]}）。`,
      ],
    };
  });
}

/**
 * 3つの考え方が全部そろっていて、しかも食い違うもの（いちばん迷うところ）。
 * **出典が名指ししているものだけ**を数える——区分から当てはめただけのものを
 * 「3つの考え方がぶつかっている」と見せると、当てずっぽうを断定にしてしまう。
 */
export function threeWayConflicts() {
  return fermentViews().filter((v) => v.conflict && v.speedBasis === 'named');
}

/** 発酵食品の食い違いにも、同じ一文を出す（どちらが正しいかを決めない） */
export const FERMENT_NOTE =
  '同じ食べものについて、考え方によって言うことが変わります。'
  + 'このアプリはどれが正しいかを決めません。合うかどうかは、しばらく試して自分の記録で見つけてください。';
