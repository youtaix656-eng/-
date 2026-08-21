// 習慣リスト。ゴーストモードの7ステップを初期値（デフォルト）として持つ。
//
// ⚠ ステップ⑤だけは原典のまま使わない。
//    原典は「夜11時就寝」だが、りらくるの夜勤は終業が深夜0時前後で物理的に守れない。
//    守れない目標を並べると、達成できないのが常態になってチェック自体をやめてしまう。
//    そのため「シフト終了後◯時間以内に就寝」へ置き換えている（shift.ts が目標時刻を計算する）。
//
// 7つはあくまで初期値で、編集・追加・削除できる（habits は保存対象のデータ）。

import type { DayRecord, Habit, StepNumber } from '../types/index.js';

export interface HabitSeed {
  id: string;
  step: StepNumber;
  title: string;
  reading: string;
  criterion: string;
  note?: string;
}

export const DEFAULT_HABIT_SEEDS: HabitSeed[] = [
  {
    id: 'step1-peers',
    step: 1,
    title: '仲間',
    reading: 'なかま',
    criterion: '目標に向かう仲間と、今日ひとつでも接点を持てた（共有・質問・添削のやり取りなど）',
  },
  {
    id: 'step2-onegoal',
    step: 2,
    title: '目標1つに集中',
    reading: 'もくひょうひとつにしゅうちゅう',
    criterion: '今日、最上位の目標に直接つながる行動を取れた',
    note: '最上位の目標は、実践期間ごとに1つだけ決める（設定画面）。それ以外は今日やらなくてよい。',
  },
  {
    id: 'step3-noise',
    step: 3,
    title: '無駄の排除',
    reading: 'むだのはいじょ',
    criterion: '学習の時間帯に、娯楽・SNSを持ち込まなかった',
    note: '「一切見ない」ではなく「学習時間帯から隔離する」。時間帯の外で見るのは無駄ではない。',
  },
  {
    id: 'step4-zero-morning',
    step: 4,
    title: 'ゼロ・モーニングルーティン',
    reading: 'ぜろもーにんぐるーちん',
    criterion: '起きてから15〜20分以内に、学習または作業を始められた',
    note: '夜勤明けの日は「起床」が昼過ぎになることもある。時計ではなく“起きてから”で測る。',
  },
  {
    id: 'step5-bedtime',
    step: 5,
    title: '就寝ルール（シフト対応）',
    reading: 'しゅうしんるーる',
    criterion: 'その日の就寝目標時刻までに寝られた',
    note: '原典の「夜11時就寝」は夜勤と両立しないため、「終業から◯分以内」に置き換えている。休日は固定時刻。',
  },
  {
    id: 'step6-reward',
    step: 6,
    title: '報酬',
    reading: 'ほうしゅう',
    criterion: '強い刺激（スマホ・動画の流し見など）ではない報酬で、自分をねぎらえた',
  },
  {
    id: 'step7-weekly',
    step: 7,
    title: '週次振り返り',
    reading: 'しゅうじふりかえり',
    criterion: '週の区切りに、うまくできたこと／改善できたこと／来週集中することを書けた',
    note: '週次振り返り画面で書くと、この習慣は自動でチェックが入る。',
  },
];

/** 週次振り返り画面と連動する習慣（書いたら自動でチェックが入る） */
export const WEEKLY_REVIEW_HABIT_ID = 'step7-weekly';

export function buildDefaultHabits(at: number): Habit[] {
  return DEFAULT_HABIT_SEEDS.map((s) => ({
    id: s.id,
    step: s.step,
    title: s.title,
    reading: s.reading,
    criterion: s.criterion,
    note: s.note,
    createdAt: at,
    archivedAt: null,
  }));
}

export const HABIT_TITLE_MAX = 24;
export const HABIT_CRITERION_MAX = 120;

export function makeCustomHabit(
  input: { title: string; reading?: string; criterion?: string },
  at: number,
  seed: number,
): Habit {
  return {
    id: `habit-${at}-${String(seed || at).slice(-4)}`,
    step: null,
    title: String(input.title || '').trim().slice(0, HABIT_TITLE_MAX),
    reading: String(input.reading || '').trim().slice(0, HABIT_TITLE_MAX),
    criterion: String(input.criterion || '').trim().slice(0, HABIT_CRITERION_MAX),
    createdAt: at,
    archivedAt: null,
  };
}

const KANJI = /[㐀-䶿一-鿿]/;
const HIRAGANA_ONLY = /^[ぁ-んー・\s]*$/;

/** 習慣の入力チェック。読みの扱いは他アプリの目次ルールと合わせる */
export function validateHabit(habit: Pick<Habit, 'id' | 'title' | 'reading'>, others: Habit[] = []) {
  const errors: string[] = [];
  const title = String(habit.title || '').trim();
  const reading = String(habit.reading || '').trim();
  if (!title) errors.push('習慣の名前を入れてください。');
  if (title.length > HABIT_TITLE_MAX) errors.push(`名前は${HABIT_TITLE_MAX}文字までにしてください。`);
  if (title && others.some((o) => o.id !== habit.id && o.archivedAt === null && o.title.trim() === title)) {
    errors.push('同じ名前の習慣がすでにあります。');
  }
  if (KANJI.test(title) && !reading) errors.push('漢字を含む名前には、読み（ひらがな）を入れてください。');
  if (reading && !HIRAGANA_ONLY.test(reading)) errors.push('読みはひらがなで入れてください。');
  return { ok: errors.length === 0, errors };
}

/** 使っている（寝かせていない）習慣だけ */
export function activeHabits(habits: Habit[]): Habit[] {
  return habits.filter((h) => h.archivedAt === null);
}

/** 並び順：①〜⑦が先（番号順）、そのあとカスタムを読みの五十音で */
export function sortHabits(habits: Habit[]): Habit[] {
  return [...habits].sort((a, b) => {
    if (a.step !== null && b.step !== null) return a.step - b.step;
    if (a.step !== null) return -1;
    if (b.step !== null) return 1;
    const ka = a.reading || a.title;
    const kb = b.reading || b.title;
    return ka.localeCompare(kb, 'ja');
  });
}

/**
 * その日の達成率（0〜1）。
 * 分母は「その日に有効だった習慣」＝作成済みで、まだ寝かせていないもの。
 * あとから習慣を増やしても過去の達成率が下がらないようにする。
 */
export function completionRate(record: DayRecord | undefined, habits: Habit[]): number {
  const target = habitsForDate(habits, record?.date ?? '');
  if (target.length === 0) return 0;
  const done = new Set(record?.checked ?? []);
  const hit = target.filter((h) => done.has(h.id)).length;
  return hit / target.length;
}

/** その日に有効だった習慣（作成日以降・寝かせる前） */
export function habitsForDate(habits: Habit[], date: string): Habit[] {
  if (!date) return activeHabits(habits);
  const endOfDay = new Date(`${date}T23:59:59`).getTime();
  const startOfDay = new Date(`${date}T00:00:00`).getTime();
  return habits.filter((h) => h.createdAt <= endOfDay && (h.archivedAt === null || h.archivedAt >= startOfDay));
}

/**
 * 達成率 → カレンダーのマスの色（夜色 → 朝焼け色）。
 * 0 は「まだ記録なし」と同じ見た目にせず、記録があれば必ず少し明るくする
 * （書いたのに何も変わらないと、書く手が止まるため）。
 */
export function toneFor(rate: number, hasRecord: boolean): number {
  if (!hasRecord) return 0;
  const r = Math.max(0, Math.min(1, rate));
  return 0.12 + r * 0.88;
}
