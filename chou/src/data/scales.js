// 記録に使う物差し。**この配列が単一の正**で、画面にも集計にも同じものを使う。
//
// 決めていること
//  - お腹の調子は**点数ではなく段**（README 決まり2）。`order` は並べ替えのためだけに使い、
//    画面には出さない・平均を取らない。
//  - ブリストルスケールだけは 1〜7 の数値でよい（医療で通じる共通の物差しなので、
//    受診メモにもこの数字のまま書く）。ただし**平均を出さない**——
//    1と7が1回ずつの日の平均4は「ふつうの便が1回あった」ではない。

/** お腹の調子（5つの段） */
export const BELLY_STEPS = [
  { id: 'very_easy', label: 'とても楽', order: 1, shade: 0.06 },
  { id: 'easy', label: '楽', order: 2, shade: 0.2 },
  { id: 'usual', label: 'ふつう', order: 3, shade: 0.38 },
  { id: 'hard', label: 'つらい', order: 4, shade: 0.62 },
  { id: 'very_hard', label: 'とてもつらい', order: 5, shade: 0.86 },
];

export const BELLY_BY_ID = Object.fromEntries(BELLY_STEPS.map((s) => [s.id, s]));

/** 痛み・張り・ストレスに共通で使う4段 */
export const LEVELS = [
  { id: 'none', label: 'なし', order: 0 },
  { id: 'slight', label: 'すこし', order: 1 },
  { id: 'some', label: 'ある', order: 2 },
  { id: 'strong', label: 'つよい', order: 3 },
];

export const LEVEL_BY_ID = Object.fromEntries(LEVELS.map((s) => [s.id, s]));

/**
 * 体を動かしたか。**時間や歩数を数えない**——「何分やれば効く」という基準が手元に無いので、
 * 自分の感じ方の段だけを残す（出典が挙げる「消化管が働きにくくなる3つの原因」のひとつ）。
 */
export const EXERCISE_STEPS = [
  { id: 'none', label: 'していない', order: 0 },
  { id: 'little', label: 'すこし動いた', order: 1 },
  { id: 'some', label: 'まあまあ動いた', order: 2 },
  { id: 'much', label: 'しっかり動いた', order: 3 },
];

export const EXERCISE_BY_ID = Object.fromEntries(EXERCISE_STEPS.map((s) => [s.id, s]));

/** ストレス。痛み・張りと同じ4段を使いまわす（段を増やして迷わせない） */
export const STRESS_LEVELS = LEVELS;

/** ブリストルスケール（7段階）。説明は医療の言い方に寄せ、からかう言葉を入れない。
 * `reading` は目次・索引のためのもの（**手で書く。漢字の読みを機械が当てない**）。 */
export const BRISTOL = [
  { n: 1, label: 'コロコロ', desc: 'かたく小さな塊が、ばらばらに出る' , reading: 'ころころ' },
  { n: 2, label: 'かたい', desc: '小さな塊が集まった、ごつごつした形' , reading: 'かたい' },
  { n: 3, label: 'ややかたい', desc: '表面にひび割れのある、細長い形' , reading: 'ややかたい' },
  { n: 4, label: 'ふつう', desc: 'なめらかでやわらかい、細長い形' , reading: 'ふつう' },
  { n: 5, label: 'ややゆるい', desc: 'はっきりしたしわのある、やわらかい塊' , reading: 'ややゆるい' },
  { n: 6, label: 'どろどろ', desc: '形の境目がくずれた、ふにゃふにゃした状態' , reading: 'どろどろ' },
  { n: 7, label: '水のよう', desc: '固形の部分がない、液体の状態' , reading: 'みずのよう' },
];

/** 受診メモに書くときのまとまり。**「便秘」「下痢」と決めつけない**（本人の記録であって診断ではない） */
export const BRISTOL_GROUPS = [
  { id: 'firm', label: 'かたいほう', range: [1, 2] },
  { id: 'middle', label: 'まんなか', range: [3, 5] },
  { id: 'loose', label: 'やわらかいほう', range: [6, 7] },
];

export function bristolGroupOf(n) {
  const found = BRISTOL_GROUPS.find((g) => n >= g.range[0] && n <= g.range[1]);
  return found ? found.id : null;
}

/** 気になったこと（お通じ1回ごとに付ける印）。ここに書くのは事実だけで、意味づけはしない */
export const STOOL_MARKS = [
  { id: 'urgent', label: '間に合わない感じがした' },
  { id: 'blood', label: '血が混じった', flag: true },
  { id: 'black', label: '黒っぽかった', flag: true },
  { id: 'incomplete', label: '出しきれない感じが残った' },
  { id: 'pain', label: '出すときに痛かった' },
];

/** `flag: true` の印は「受診の目安」に載っている項目。付いたら読める場所を出す（判定はしない） */
export const FLAG_MARK_IDS = STOOL_MARKS.filter((m) => m.flag).map((m) => m.id);
