export interface AnimalSleepFact {
  animal: string;
  emoji: string;
  hours: number;
  fact: string;
}

// 分割睡眠アプリのテーマに寄せて、単相/多相睡眠や半球睡眠の動物も交えている。
export const ANIMAL_SLEEP_FACTS: AnimalSleepFact[] = [
  { animal: 'コアラ', emoji: '🐨', hours: 22, fact: 'ユーカリの毒素を分解するのにエネルギーを使うため、1日22時間ほど眠って過ごします。' },
  { animal: 'キリン', emoji: '🦒', hours: 2, fact: '哺乳類の中でも屈指の短さ。立ったまま数分の仮眠を繰り返す多相睡眠で1日を乗り切ります。' },
  { animal: 'ゾウ', emoji: '🐘', hours: 2, fact: '野生のゾウは1日2時間ほどしか眠らず、数日眠らないこともある超短眠の代表格です。' },
  { animal: 'ネコ', emoji: '🐱', hours: 14, fact: '1日12〜16時間ほど眠りますが、多くは浅い眠りで、いつでも動ける状態を保っています。' },
  { animal: 'イルカ', emoji: '🐬', hours: 8, fact: '脳を左右交互に眠らせる「半球睡眠」の達人。泳ぎながら呼吸を続けつつ眠れます。' },
  { animal: 'アホウドリ', emoji: '🐦', hours: 0.5, fact: '数週間におよぶ飛行中、片方の脳だけを数十秒〜数分ずつ眠らせながら飛び続けます。' },
  { animal: 'ラッコ', emoji: '🦦', hours: 11, fact: '流されないよう仲間と手をつないだり、体に海藻を巻きつけたりして眠ります。' },
  { animal: 'コウモリ', emoji: '🦇', hours: 20, fact: '哺乳類でも屈指の長時間睡眠者。逆さまにぶら下がったまま1日20時間ほど眠ります。' },
  { animal: 'ライオン', emoji: '🦁', hours: 13, fact: '狩りの成功率が低いぶん省エネが重要で、1日13時間前後を休息に充てます。' },
  { animal: 'ウマ', emoji: '🐴', hours: 3, fact: '立ったまま浅い眠りを取り、深い眠り（横になる時間）は1日30分程度しかありません。' },
  { animal: 'ヒグマ', emoji: '🐻', hours: 8, fact: '普段は8時間ほどですが、冬眠中は数ヶ月にわたり代謝を落として眠り続けます。' },
  { animal: 'ヒト', emoji: '🧑', hours: 7, fact: '一般的な推奨は7〜9時間。ただしショートスリーパーや、分割睡眠で乗り切る人もいます。' },
];

// 日付ごとに固定の1件を選ぶ（同じ日に開いても表示が変わらないようにする）。
export function pickAnimalOfTheDay(dateSeed = new Date()): AnimalSleepFact {
  const dayIndex = Math.floor(dateSeed.getTime() / (24 * 60 * 60 * 1000));
  const idx = ((dayIndex % ANIMAL_SLEEP_FACTS.length) + ANIMAL_SLEEP_FACTS.length) % ANIMAL_SLEEP_FACTS.length;
  return ANIMAL_SLEEP_FACTS[idx];
}
