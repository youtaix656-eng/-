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
import { PREBIOTIC_FOODS, KIND_BY_ID } from '../data/prebiotics.js';
import { HELPFUL_HABITS, WEAK_STOMACH_AVOID } from '../data/gutHabits.js';
import { PROTEIN_GUIDES, ELIMINATION_TARGETS } from '../data/protein.js';
import { FASTING_SHAPES } from '../data/fasting.js';
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

/**
 * 善玉菌の餌（プレバイオティクス）を、低FODMAP と突き合わせる。
 *
 * **この2つは目的が反対を向いている。** プレバイオティクスは大腸で発酵する糖・繊維を
 * わざと増やす考え方で、低FODMAP はその発酵しやすい糖を減らす考え方。
 * お腹の張りで困っている人には、片方が合って片方が合わないことがある。
 * **どちらが正しいかは決めない。**
 *
 * 突き合わせる相手（`fodmapName`）は**手で書いてある**——名前の当てずっぽうな一致で
 * 食い違いを作らないため。書いていないものは「一覧に出てきません」と正直に出す。
 */
export function prebioticViews() {
  return PREBIOTIC_FOODS.map((food) => {
    const inFodmap = food.fodmapName ? FODMAP_FOODS.find((f) => f.name === food.fodmapName) : null;
    const level = inFodmap ? levelLabel(inFodmap.level) : null;
    return {
      name: food.name,
      reading: food.reading,
      kind: KIND_BY_ID[food.kind] ? KIND_BY_ID[food.kind].label : food.kind,
      note: food.note,
      fodmap: level,
      fodmapName: food.fodmapName,
      // 低FODMAP が「多め／量による」なら、餌を増やす考え方とぶつかる
      conflict: Boolean(inFodmap && inFodmap.level !== 'low'),
      views: [
        `腸活では：善玉菌の餌（${KIND_BY_ID[food.kind] ? KIND_BY_ID[food.kind].label : food.kind}）として勧められています。`,
        level
          ? `低FODMAP の一覧では「${food.fodmapName}」が「${level}」に入っています。`
          : '低FODMAP の一覧には出てきません。',
      ],
    };
  });
}

/** 餌を増やす考え方と、減らす考え方がぶつかる食べもの */
export function prebioticConflicts() {
  return prebioticViews().filter((v) => v.conflict);
}

/** 目的が反対を向いていることを、必ず添える一文 */
export const PREBIOTIC_VS_FODMAP_NOTE =
  '「善玉菌の餌を増やす」と「発酵しやすい糖を減らす（低FODMAP）」は、目的が反対を向いています。'
  + 'どちらが正しいかはこのアプリでは決めません。お腹の張りやガスで困っているなら、'
  + '増やすほうを少しずつ試して、合わなければやめてください。';

// ───────────────────────── 食物繊維：胃の側 ⇄ 腸の側 ─────────────────────────
//
// **これは食べものの食い違いではなく、「どの臓器を見ているか」の食い違い。**
// 胃の側は「かき混ぜるのに時間がかかるから、弱っているときは避ける」と言い、
// 腸の側は「もともといる菌の餌になるから増やす」と言う。どちらも同じ食べものの話で、
// **見ている場所が違うだけなので、どちらかが嘘というわけではない。**
// だからこそアプリが片方を選ぶと、もう片方を必要としている人を取りこぼす。

/**
 * 食物繊維についての2つの言い分を、そのまま並べて返す。
 * `applies` は「いつの話か」——読む人が自分の今と照らせるようにするためのもの
 * （アプリが今の状態を判定して出し分けたりはしない）。
 */
export function fiberViews() {
  return [
    {
      id: 'stomach',
      side: '胃の側（胃腸を強くする habits）',
      applies: '胃が弱っているとき',
      says: '食物繊維の多いきのこ・野菜と、脂肪の多い肉・魚は避ける',
      why: '胃は消化そのものより下ごしらえ（かき混ぜる）をしていて、この2つに時間がかかるとされるため',
    },
    {
      id: 'gut',
      side: '腸の側（善玉菌の餌 prebiotics）',
      applies: '善玉菌を増やしたいとき',
      says: '水溶性食物繊維・オリゴ糖・レジスタントスターチを増やす',
      why: 'もともといる菌の餌になるとされるため',
    },
    {
      id: 'fodmap',
      side: '低FODMAP',
      applies: 'お腹の張り・ガスで困っているとき',
      says: '発酵しやすい糖を減らす（食物繊維の多いものにも当てはまるものがある）',
      why: '大腸で発酵するとガスが出て、張りや痛みにつながるとされるため',
    },
  ];
}

export const FIBER_NOTE =
  '同じ食物繊維の話でも、見ている場所が違うと言うことが逆になります。'
  + 'どれかが嘘というわけではありません。このアプリはどれが正しいかを決めません——'
  + 'いま困っているのが胃なのかお腹なのかで、読む先が変わります。';

/**
 * 同じ出典の中で言うことが割れているところ（`gutHabits.js`）。
 * **1つの出典の中の食い違いなので、出典どうしの食い違い（`SOURCE_CONFLICTS`）とは別に持つ。**
 */
export function withinSourceFiberConflict() {
  const helpful = HELPFUL_HABITS.find((h) => h.id === 'fiber');
  return {
    id: 'fiber_same_source',
    title: '同じ出典の中でも、食物繊維の扱いが割れている',
    a: helpful ? helpful.body : '',
    b: WEAK_STOMACH_AVOID.body,
    note: WEAK_STOMACH_AVOID.note,
  };
}

// ───────────────── タンパク質ファースト ⇄ 胃が弱っているとき ─────────────────
//
// **同じ「肉と魚」について、正面から逆のことを言っている。**
// タンパク質の側は「炭水化物より先に、多めに」、胃の側は「弱っているときは避ける」。
// どちらも「胃にとどまる時間」を理由にしているのに、結論が反対になっているのが面白いところ。

/** タンパク質ファーストと、胃が弱っているときの避けかたを並べる（どちらも決めない） */
export function proteinViews() {
  const first = PROTEIN_GUIDES.find((g) => g.id === 'first');
  return [
    {
      id: 'protein_first',
      side: 'タンパク質と腸の側',
      applies: 'ふだん・タンパク質が足りていないと感じるとき',
      says: '炭水化物より先に、タンパク質（肉・魚・卵・大豆）を多めに',
      why: '炭水化物は胃に長くとどまり、未消化のまま腸へ行くと発酵して腸内環境を乱すとされるため',
      source: first ? first.said : '',
    },
    {
      id: 'weak_stomach',
      side: '胃腸の習慣の側',
      applies: '胃が弱っているとき',
      says: '脂肪の多い肉と魚、食物繊維の多いきのこ・野菜を避ける',
      why: '胃の仕事はかき混ぜる下ごしらえで、脂肪と食物繊維はそれに時間がかかるとされるため',
      source: WEAK_STOMACH_AVOID.body,
    },
  ];
}

export const PROTEIN_NOTE =
  '同じ「肉と魚」について、片方は増やせ、片方は避けろと言っています。'
  + 'どちらも「胃にとどまる時間」を理由にしているのに、結論が反対を向いているところです。'
  + 'このアプリはどちらが正しいかを決めません——いま胃が弱っているかどうかで、読む先が変わります。';

// ───────────────── 朝食を抜く ⇄ 朝に食べる ─────────────────
//
// **断食の側は「午前は固形物をとらない」、腸活の側は「朝に整腸剤と食べものを」。**
// 便のことで困っている人にとっては、ここがいちばん実害の出やすい食い違い。

/** 朝食についての言い分を並べる（どちらも決めない） */
export function breakfastViews() {
  const morning = FASTING_SHAPES.find((s) => s.id === 'morning_water');
  const banana = PREBIOTIC_FOODS.find((f) => f.name === 'バナナ');
  return [
    {
      id: 'skip',
      side: '断食の側',
      applies: '空腹の時間を長くしてみたいとき',
      says: '午前は固形物をとらず、水分だけにする',
      why: '午前は体が出す時間で、内臓を休ませるとされるため',
      source: morning ? morning.said : '',
    },
    {
      id: 'eat',
      side: '善玉菌の餌・整腸剤の側',
      applies: '便が出にくいとき',
      says: '朝に整腸剤と、餌になる食べもの（バナナなど）をとる',
      why: '食べものが胃に入ると腸が動きはじめるとされ、朝は出しやすい時間だとされるため',
      source: banana ? banana.note : '',
    },
  ];
}

export const BREAKFAST_NOTE =
  '朝食を抜くか、朝に食べるかで、言っていることが逆になります。'
  + '**便が出にくくて困っている人には、ここがいちばん実害の出やすいところ**です——'
  + '朝食を抜くと出にくくなる人がいます。このアプリはどちらが正しいかを決めません。'
  + '自分の記録で、どちらが自分に合うかを見てください。';

// ───────────────── 乳製品：3つの言い分 ─────────────────

/**
 * 乳製品についての言い分を、**元データから毎回導いて**並べる。
 * 腸活（発酵食品）／低FODMAP／今回の出典（やめてみる）で3つに割れる。
 */
export function dairyViews() {
  const names = ['ヨーグルト', '牛乳'];
  return names.map((name) => {
    const ferment = FERMENTED_FOODS.find((f) => f.name === name || (f.name && f.name.includes(name)));
    const fodmap = FODMAP_FOODS.find((f) => f.name === name);
    const target = ELIMINATION_TARGETS.find((t) => t.id === 'dairy');
    return {
      name,
      views: [
        ferment
          ? `腸活では：発酵食品として勧められています（${ferment.note || ''}）`.trim()
          : '腸活では：発酵食品として勧められることがあります。',
        fodmap
          ? `低FODMAP の一覧では「${levelLabel(fodmap.level)}」に入っています。`
          : '低FODMAP の一覧には出てきません。',
        target ? `タンパク質と腸の側では：一度やめて、体の変化を見ることを勧めています。` : '',
      ].filter(Boolean),
    };
  });
}

export const DAIRY_NOTE =
  '乳製品は、勧める側・減らす候補にする側・一度やめてみる側の3つに割れます。'
  + 'このアプリはどれが正しいかを決めません。合う・合わないは自分の記録で見つけてください。';
