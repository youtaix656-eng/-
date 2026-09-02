// 起きて最初のルーティン（ハル・エルロッドの朝の6習慣の解説から）。
//
// 出典: 解説動画の内容を本人がまとめた要約（2026-09-02 受領）。書籍・原典は未確認。
//
// ⚠ **「朝」と呼ばない。** 出典自身が「必ずしも朝にやる必要はない。起きた最初にやってほしい」
//    と言っている。このアプリの利用者は夜勤（終業が深夜0時前後）なので、
//    「朝◯時に起きる」を前提にすると、そもそも実行できない機能になる。
//    名前も判定も「起きて最初の◯分」で通す。
//
// ⚠ 既存と重なるものは、この層に作らず**既存の記録へ書き込む**:
//    瞑想     → meditation.ts（addMeditation）
//    運動・読書 → monkMode.ts（setMonk）
//    ジャーナルの「今日やること」→ threeRules.ts（今日の3つ）
//    水       → monkMode.ts（waterMl）
//    朝食     → fasting.ts（最初の食事の時刻）。※出典は「抜くのが最強」と言うが、そこは fasting 側の注意に従う

import { toMinutes } from './date.js';
import type { RoutineRecord, Settings } from '../types/index.js';

export interface RoutineStep {
  id: string;
  title: string;
  reading: string;
  icon: string;
  /** 何をやるか。走らせている最中に読む文 */
  how: string;
  /** 出典の60分版での配分（分） */
  fullMinutes: number;
  /** 短縮版（6分版）での配分（分） */
  shortMinutes: number;
  /** 終わった時に、どの既存機能へ記録するか */
  writesTo?: 'meditation' | 'workout' | 'reading' | 'threeRules';
}

/** 出典の6つ。並び順は変えられる（解説者自身も順番を入れ替えている） */
export const ROUTINE_STEPS: RoutineStep[] = [
  {
    id: 'meditation',
    title: '瞑想',
    reading: 'めいそう',
    icon: '🧘',
    how: '静かな場所に座り、目を閉じるか一点を見つめて呼吸に意識を向けます。逸れたら呼吸に戻す。それだけで構いません。',
    fullMinutes: 5,
    shortMinutes: 1,
    writesTo: 'meditation',
  },
  {
    id: 'affirmation',
    title: 'アファメーション',
    reading: 'あふぁめーしょん',
    icon: '🗣',
    how: '決めておいた目標を声に出す（心の中で唱えるのでも構いません）。数字と期限が入っているものほど、目指す先がはっきりします。',
    fullMinutes: 5,
    shortMinutes: 1,
  },
  {
    id: 'visualize',
    title: 'イメージング',
    reading: 'いめーじんぐ',
    icon: '🌄',
    how: '深呼吸して、今日この後の1日を思い浮かべます。仕事を楽にこなしている自分、問題が起きても解決している自分、終わって良い気分でいる自分。',
    fullMinutes: 5,
    shortMinutes: 1,
  },
  {
    id: 'exercise',
    title: 'エクササイズ',
    reading: 'えくささいず',
    icon: '🏃',
    how: '激しい運動でなくて構いません。少し脈が上がればよい、という程度。散歩・ヨガ・スクワットなど、続けやすいもので。',
    fullMinutes: 20,
    shortMinutes: 1,
    writesTo: 'workout',
  },
  {
    id: 'reading',
    title: '読書',
    reading: 'どくしょ',
    icon: '📖',
    how: '「今日この後で使えるところはないか」という目で読みます。10ページでも、1ページでも構いません。',
    fullMinutes: 20,
    shortMinutes: 1,
    writesTo: 'reading',
  },
  {
    id: 'journal',
    title: 'ジャーナル',
    reading: 'じゃーなる',
    icon: '✍️',
    how: '今日終わらせることを書き出します。感謝したこと・できたこと・直したいことを足しても構いません。',
    fullMinutes: 5,
    shortMinutes: 1,
    writesTo: 'threeRules',
  },
];

export const STEP_MAP = Object.fromEntries(ROUTINE_STEPS.map((s) => [s.id, s]));

export const PRESETS = [
  { id: 'full', label: '60分版', note: '出典の配分（瞑想5・アファメーション5・イメージング5・運動20・読書20・ジャーナル5）。' },
  { id: 'short', label: '6分版', note: '時間が取れない日のための短縮版。出典も「これでもやらないより差が出る」としています。' },
  { id: 'custom', label: '自分で決める', note: '順番も長さも変えて構いません。出典も「好きにカスタマイズしてよい」と言っています。' },
] as const;

export type PresetId = (typeof PRESETS)[number]['id'];

/** その設定での各ステップの分数 */
export function planMinutes(settings: Settings): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of ROUTINE_STEPS) {
    if (settings.routinePreset === 'full') out[s.id] = s.fullMinutes;
    else if (settings.routinePreset === 'short') out[s.id] = s.shortMinutes;
    else out[s.id] = settings.routineCustomMinutes[s.id] ?? s.fullMinutes;
  }
  return out;
}

/** 実行する順番（設定にあればそれ、無ければ既定の並び）。知らないidは無視する */
export function planOrder(settings: Settings): RoutineStep[] {
  const saved = settings.routineOrder;
  if (!saved || saved.length === 0) return ROUTINE_STEPS;
  const known = saved.map((id) => STEP_MAP[id]).filter(Boolean);
  const rest = ROUTINE_STEPS.filter((s) => !saved.includes(s.id));
  return [...known, ...rest];
}

/** 使うステップだけ（0分にしたものは外す） */
export function activeSteps(settings: Settings): RoutineStep[] {
  const minutes = planMinutes(settings);
  return planOrder(settings).filter((s) => (minutes[s.id] ?? 0) > 0);
}

export function totalMinutes(settings: Settings): number {
  const minutes = planMinutes(settings);
  return activeSteps(settings).reduce((a, s) => a + (minutes[s.id] ?? 0), 0);
}

// ── アファメーション ──────────────────────────────────

export const AFFIRMATION_MAX = 80;
export const AFFIRMATION_SLOTS = 3;

const HAS_NUMBER = /[0-9０-９]/;
const HAS_DEADLINE = /(年|月|日|まで|までに)/;

/**
 * 出典は「明確な数字や期限を必ず入れる」と言っている。書けているかを見て、足りない点を返す。
 * **書けていなくても止めない**（言い方を直すのは本人）。
 */
export function checkAffirmation(text: string): { ok: boolean; missing: string[]; hint: string } {
  const t = String(text ?? '').trim();
  if (!t) return { ok: false, missing: ['本文'], hint: '目標を1文で書いてください。' };
  const missing: string[] = [];
  if (!HAS_NUMBER.test(t)) missing.push('数字');
  if (!HAS_DEADLINE.test(t)) missing.push('期限');
  if (missing.length === 0) return { ok: true, missing: [], hint: '' };
  return {
    ok: false,
    missing,
    hint: `${missing.join('と')}が入っていません。出典は「数字と期限を入れるほど、目指す先がはっきりする」としています（例：2027年3月までに◯◯する）。`,
  };
}

export function normalizeAffirmations(list: string[] | undefined): string[] {
  const base = (list ?? []).map((s) => String(s ?? '').slice(0, AFFIRMATION_MAX));
  while (base.length < AFFIRMATION_SLOTS) base.push('');
  return base.slice(0, AFFIRMATION_SLOTS);
}

// ── 起きた時刻・寝る前のマインド ──────────────────────────

export function emptyRoutine(): RoutineRecord {
  return { doneSteps: [], startedAt: null, wakeAt: null, waterOnWaking: false };
}

export function routineOf(record: { routine?: RoutineRecord } | undefined): RoutineRecord {
  return { ...emptyRoutine(), ...(record?.routine ?? {}) };
}

/** 出典：起きてすぐスマホではなく、コップ1杯の水。だるさは睡眠ではなく水分不足のことが多い、という話 */
export const WATER_ON_WAKING_NOTE =
  '起きた時は水分が足りていないことが多く、それをだるさと感じている場合がある、という話です。'
  + 'まず水を1杯。スマホを見るのはそのあとで。';

/** 出典：必ずしも朝でなくてよい。起きた最初にやる */
export const WAKE_FIRST_NOTE =
  '出典は「必ずしも朝にやる必要はない。起きて最初にやってほしい」と言っています。'
  + '夜勤明けで起きるのが昼過ぎでも、それがあなたの「朝」です。時計ではなく、起きてからで測ります。';

/**
 * 寝る前の言い方。
 * 出典：「朝起きて最初に考えることは、たいてい寝る前に最後に考えたことと同じ」。
 * だから「◯時間しか眠れない」ではなく「◯時間も眠れる」と言い換える。
 * **「しか」を使う文は返さない。**
 */
export function sleepPhrase(hours: number): string {
  const h = Math.max(0, Math.round(hours * 10) / 10);
  return `今夜は${h}時間も眠れます。起きる時刻をはっきり思い浮かべてから、目を閉じてください。`;
}

/** 就寝目標と起床予定から、眠れる時間を出す。材料が足りなければ null */
export function hoursUntilWake(bedMinutes: number | null, wakeAt: string | null | undefined): number | null {
  const wake = toMinutes(String(wakeAt ?? ''));
  if (bedMinutes === null || wake === null) return null;
  // 就寝の分は「その日の0:00から」なので、起床は必ずそのあと
  let target = wake;
  while (target <= bedMinutes) target += 1440;
  const hours = (target - bedMinutes) / 60;
  if (hours > 24) return null;
  return Math.round(hours * 10) / 10;
}

export const BEDTIME_MINDSET_NOTE =
  '出典が挙げている実験は、本人1人が自分で試したもので、研究ではありません（※要確認）。'
  + 'ただ「足りない」と思って寝るより「眠れる」と思って寝るほうが、起きた時の気分は変えやすいはずです。';

// ── 実行と集計 ───────────────────────────────────────

/** 起きてから開始までの分。ゴーストモード④「起床後15〜20分以内に始める」と同じ見方 */
export function minutesFromWake(record: { routine?: RoutineRecord } | undefined): number | null {
  const r = routineOf(record);
  const wake = toMinutes(String(r.wakeAt ?? ''));
  const start = toMinutes(String(r.startedAt ?? ''));
  if (wake === null || start === null) return null;
  const diff = start >= wake ? start - wake : start + 1440 - wake;
  if (diff > 12 * 60) return null;
  return diff;
}

export const ZERO_MORNING_LIMIT = 20;

/** 起きてから始めるまでが早かったか（ゴーストモード④と同じ基準） */
export function startedQuickly(record: { routine?: RoutineRecord } | undefined): boolean | null {
  const m = minutesFromWake(record);
  return m === null ? null : m <= ZERO_MORNING_LIMIT;
}

/** その日、ルーティンをやったか（1つでもやれば「やった」） */
export function didRoutine(record: { routine?: RoutineRecord } | undefined): boolean {
  return routineOf(record).doneSteps.length > 0;
}

/** 週の集計。連続日数は数えない（このアプリ全体の方針） */
export function summarizeRoutine(records: ({ routine?: RoutineRecord } | undefined)[]) {
  const perStep = new Map<string, number>();
  let days = 0;
  let quickDays = 0;
  let waterDays = 0;
  for (const r of records) {
    const rt = routineOf(r);
    if (rt.doneSteps.length === 0) continue;
    days += 1;
    if (startedQuickly(r) === true) quickDays += 1;
    if (rt.waterOnWaking) waterDays += 1;
    for (const id of rt.doneSteps) perStep.set(id, (perStep.get(id) ?? 0) + 1);
  }
  const steps = ROUTINE_STEPS.map((s) => ({ step: s, days: perStep.get(s.id) ?? 0 }));
  // 一番できていないステップ（記録が3日以上ある時だけ）
  const weakest = days >= 3 ? [...steps].sort((a, b) => a.days - b.days)[0] : null;
  return { days, quickDays, waterDays, steps, weakest };
}

// ── 断定しないもの ───────────────────────────────────

export const ROUTINE_UNVERIFIED = [
  {
    id: 'weeks',
    claim: 'これをやった人は軒並み数週間で人生が変わっている',
    note: '出典の紹介する言い方です。数週間で変わると期待して始めると、変わらなかった時に続かなくなります。まず「起きた最初にやる形を作る」だけを目標にしてください。',
  },
  {
    id: 'early_success',
    claim: '成功している人は早起きしている（だから早起きすると成功する）',
    note: '早起きの人に成功者が多いとしても、早起きが原因だとは限りません。出典自身も「早起きしただけで成功するとは言わない」と言っています。',
  },
  {
    id: 'affirm_rate',
    claim: '明確な数字を入れれば入れるほど実現する確率は跳ね上がる',
    note: '裏は取れていません。ただ、目標をはっきりさせること自体は、何をするか決めやすくなります。',
  },
  {
    id: 'hippocampus',
    claim: '瞑想している人は海馬の灰白質が大きくなっているという報告がある',
    note: '報告がある、という水準の話です（🧘瞑想の「効果の見通し」でも同じ扱いにしています）。',
  },
  {
    id: 'recording_diet',
    claim: '体重を記録するだけで痩せる（記録の効果）',
    note: '記録すると意識が向きやすくなるのは確かですが、記録だけで結果が出ると考えないでください。',
  },
  {
    id: 'sleep_experiment',
    claim: '寝る前に「足りない」と思うと、9時間寝ても疲れて起きる',
    note: '出典の著者が自分1人で試した話で、研究ではありません。言い方を変えてみる価値はありますが、睡眠時間そのものの代わりにはなりません。',
  },
  {
    id: 'no_breakfast',
    claim: '朝食を抜くと集中力が上がる。最強クラスのライフハック',
    note: '人によります。血糖に関わる持病・服薬・妊娠授乳・成長期・摂食障害の経験がある場合は、自己判断で始めないでください。🍚食事の時間と量の「始める前の確認」も見てください。',
    hard: true,
  },
];
