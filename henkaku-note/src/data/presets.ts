// 追加できる習慣のプリセット。
//
// ゴーストモードの7ステップ（habits.ts）とは別枠。
// 「学んだことを習慣に落とす」時の受け皿で、タップ1つで習慣リストに足せる。
// 出典が本人の要約であることを必ず一緒に持ち、断定した効果は書かない。

import type { Habit } from '../types/index.js';

export interface KnowledgeSource {
  id: string;
  label: string;
  /** どこから来た内容か。あとから「これは誰が言ったことか」を追えるようにする */
  origin: string;
  receivedAt: string;
  /** 鵜呑みにしない方がよい点。画面にそのまま出す */
  caution?: string;
}

export const MEDITATION_SOURCE: KnowledgeSource = {
  id: 'meditation-2026-08',
  label: '瞑想の効果（要約）',
  origin: '動画の内容を本人がまとめた要約（このアプリの利用者が入力）',
  receivedAt: '2026-08-21',
  caution:
    '一次資料（論文・ガイドライン）には当たっていません。ここに書かれた効果は「そう報告されている」水準の話で、'
    + '保証ではありません。体調に関わる判断は専門家に相談してください。',
};

export interface HabitPreset {
  id: string;
  title: string;
  reading: string;
  criterion: string;
  note: string;
  sourceId: string;
  /** この習慣を足すとき、あわせて有効にする機能 */
  enables?: 'meditation';
}

export const HABIT_PRESETS: HabitPreset[] = [
  {
    id: 'preset-meditation',
    title: '瞑想',
    reading: 'めいそう',
    criterion: 'その日に瞑想を1回でも記録できた（長さは問わない）',
    note:
      '10分が最小単位とされる長さです。効果は「量」より「続けた日数」に強く依存するとされるため、'
      + '長さではなく“やった日”で判定します。しんどい日は3分でも達成にしてください。',
    sourceId: MEDITATION_SOURCE.id,
    enables: 'meditation',
  },
  {
    id: 'preset-urge',
    title: '衝動に気づいて手放す',
    reading: 'しょうどうにきづいててばなす',
    criterion: '欲求・衝動が出た瞬間に「いま来たな」と気づいて、そのまま流せた場面が1回でもあった',
    note:
      '瞑想の応用として語られる練習です。衝動を我慢で押さえ込むのではなく、'
      + '起きたことに気づいて観察する、という形にしています。'
      + '※要確認：禁欲そのものの生理学的効果（テストステロンが急上昇する等）は根拠が弱い、'
      + 'または誇張されているとされます。効果を数字で謳う情報は鵜呑みにしないでください。',
    sourceId: MEDITATION_SOURCE.id,
  },
];

export function presetToHabit(preset: HabitPreset, at: number): Habit {
  return {
    id: preset.id,
    step: null,
    title: preset.title,
    reading: preset.reading,
    criterion: preset.criterion,
    note: preset.note,
    createdAt: at,
    archivedAt: null,
  };
}

/** 瞑想の記録UIを出すかどうかは、この習慣が入っているかで決める */
export const MEDITATION_HABIT_ID = 'preset-meditation';
