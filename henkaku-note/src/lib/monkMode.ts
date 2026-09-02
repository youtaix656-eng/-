// モンクモード（海外式）。プリンスEAの解説を軸にした動画の要約から。
//
// 出典: 解説動画の内容を本人がまとめた要約（2026-09-02 受領）。原典の動画・研究は未確認。
//
// このアプリは既に「ゴーストモード7ステップ」を土台にしている。モンクモードは近い家系の話なので、
// **重なる部分は既存の記録へ寄せ、この層は重なっていないものだけを持つ**。
//   瞑想10分        → meditation.ts（実装ずみ）
//   加工食品を避ける → condition.ts の🦠腸内環境（実装ずみ）
//   人との距離       → condition.ts の🤝人間関係（実装ずみ。ただし下の CONFLICTS を参照）
//   SNSの制限        → ゴーストモード③「無駄の排除」に、具体的なやり方を足す形で持つ
//
// ⚠ この題材で最も注意が要るのは、**既に入っている別の出典と正面から食い違う主張がある**こと。
//    モンクモード「友人と距離を置く／孤独になれ」
//    最高の体調  「いい人間関係を持とう（孤独は禁煙より体に悪い／最大15年）」
//    どちらが正しいかをアプリが決めることはできない。**食い違っている事実をそのまま出す。**
//    実装するのは「人間関係を切る」ではなく「一人で集中する時間を確保する」ほう
//    （出典が実際に挙げている例も、ビル・ゲイツが年に一度こもる、という時間の取り方）。

import type { DayRecord, MonkRecord, Settings } from '../types/index.js';
import { toMinutes, formatClock } from './date.js';

// ── 66日の根拠 ───────────────────────────────────────

/** 出典がすすめる期間。連続でなくてよい（累計で数える） */
export const MONK_DAYS = 66;

export const MONK_PERIOD_NOTE =
  '出典は66日をすすめています（新しい習慣が身につくまで18〜254日かかり、その平均が66日、という研究の紹介）。'
  + 'ただし「66日連続」ではなく、**累計で66日**という数え方でよい、とも言っています。'
  + '1か月やって2〜3日休み、また1か月、という形で構いません。'
  + '※要確認：この数字と「脳の配線が変わる」という言い方の裏は取れていません。';

// ── 3つの領域 ────────────────────────────────────────

export interface MonkArea {
  id: 'mind' | 'body' | 'spirit';
  title: string;
  reading: string;
  icon: string;
  why: string;
}

export const MONK_AREAS: MonkArea[] = [
  {
    id: 'mind',
    title: 'マインドを整える',
    reading: 'まいんどをととのえる',
    icon: '🧠',
    why:
      '入れるもので質が決まる、という考え方。粗悪な情報を止めて、質の高いものを入れる。'
      + '毎日「目標のこと」を考えている人と「週末のこと」を考えている人では、1年後に差が出る、という話。',
  },
  {
    id: 'body',
    title: '肉体を整える',
    reading: 'にくたいをととのえる',
    icon: '🏃',
    why:
      '体は「乗り物」。運転手（脳）が同じでも、乗り物の性能で行ける距離が変わる。'
      + 'モンクモード中は人にも会わず刺激も減るので、**運動が事実上ただ一つのストレス発散**になる。'
      + 'ここを抜くと、途中で糸が切れる。',
  },
  {
    id: 'spirit',
    title: '心を整える',
    reading: 'こころをととのえる',
    icon: '🕯',
    why:
      '海外式のモンクモードで特徴的な部分。物質的な成功だけを追っても、心が満たされていなければ続かない、という考え方。'
      + '具体的にやることは1日10分の瞑想。',
  },
];

// ── 記録する行動（重なっていないものだけ）──────────────────

/** SNSの制限の仕方。出典が挙げていた順に、ゆるい→きつい */
export const SNS_RULES = [
  { id: 'morning_off', label: '午前中はスマホの電源を切る', detail: '別の部屋かカバンに入れる。出典が最初に挙げているやり方。' },
  { id: 'pc_only', label: '見るのは夜・PCからだけ', detail: 'アプリを消してブラウザから入るだけでも同じ効果。面倒さが上がって自然に減る。' },
  { id: 'uninstalled', label: 'アプリをアンインストール', detail: '出典が基本としているやり方。' },
] as const;

export const SNS_RULE_MAP = Object.fromEntries(SNS_RULES.map((r) => [r.id, r]));

/** 出典の目安。設定で変えられる（ここは「アプリの初期値」であって医学的な推奨ではない） */
export const DEFAULT_TARGETS = {
  waterMl: 2000,
  steps: 8000,
  workoutPerWeek: 3,
  workoutMinutes: 60,
  readingMinutesPerDay: 30,
  soloMinutes: 60,
};

export function emptyMonk(): MonkRecord {
  return {
    waterMl: 0,
    electrolyte: false,
    steps: 0,
    workoutMinutes: 0,
    workoutAt: null,
    readingMinutes: 0,
    snsRuleKept: null,
    soloMinutes: 0,
  };
}

export function monkOf(record: DayRecord | undefined): MonkRecord {
  return { ...emptyMonk(), ...(record?.monk ?? {}) };
}

/** その日、その領域の行動を置けたか（点数にはしない。真偽だけ） */
export function areaDone(record: DayRecord | undefined, areaId: MonkArea['id'], settings: Settings): boolean {
  const m = monkOf(record);
  switch (areaId) {
    case 'mind':
      return m.snsRuleKept === true || m.readingMinutes > 0 || m.soloMinutes > 0;
    case 'body':
      return m.waterMl >= settings.monkWaterMl || m.steps >= settings.monkSteps || m.workoutMinutes > 0;
    case 'spirit':
      return (record?.meditations ?? []).length > 0;
    default:
      return false;
  }
}

// ── 運動後のゴールデンタイム ──────────────────────────────

/** 出典：運動後3時間は、脳内物質が出続けるので集中しやすい（※要確認） */
export const GOLDEN_HOURS = 3;

export interface GoldenWindow {
  untilMinutes: number;
  label: string;
  text: string;
}

/**
 * 運動した時刻から、集中しやすいとされる時間帯の終わりを返す。
 * 記録が無ければ null（推測で出さない）。
 */
export function goldenWindow(record: DayRecord | undefined): GoldenWindow | null {
  const at = monkOf(record).workoutAt;
  const start = toMinutes(String(at ?? ''));
  if (start === null) return null;
  const until = start + GOLDEN_HOURS * 60;
  return {
    untilMinutes: until,
    label: formatClock(until),
    text: `運動後の${GOLDEN_HOURS}時間は集中しやすいとされます。${formatClock(until)}ごろまでに、30分でも机に向かうと乗りやすいです。`,
  };
}

// ── 週の集計 ────────────────────────────────────────

export function weeklyMonk(days: Record<string, DayRecord>, dateKeys: string[], settings: Settings) {
  let waterDays = 0;
  let stepDays = 0;
  let workouts = 0;
  let workoutMinutes = 0;
  let readingMinutes = 0;
  let snsKeptDays = 0;
  let soloMinutes = 0;
  const stepValues: number[] = [];

  for (const key of dateKeys) {
    const m = monkOf(days[key]);
    if (m.waterMl >= settings.monkWaterMl) waterDays += 1;
    if (m.steps > 0) stepValues.push(m.steps);
    if (m.steps >= settings.monkSteps) stepDays += 1;
    if (m.workoutMinutes > 0) {
      workouts += 1;
      workoutMinutes += m.workoutMinutes;
    }
    readingMinutes += m.readingMinutes;
    if (m.snsRuleKept === true) snsKeptDays += 1;
    soloMinutes += m.soloMinutes;
  }

  return {
    waterDays,
    stepDays,
    averageSteps: stepValues.length ? Math.round(stepValues.reduce((a, b) => a + b, 0) / stepValues.length) : null,
    workouts,
    workoutMinutes,
    readingMinutes,
    snsKeptDays,
    soloMinutes,
    /** 出典の目安（週3〜5回）に届いたか。届かない週を責めるためには使わない */
    workoutOnTrack: workouts >= settings.monkWorkoutPerWeek,
  };
}

/**
 * 運動が足りていない時だけ声をかける。
 * 出典が「モンクモード期間は運動が唯一のストレス発散」と言っているので、ここだけは先に出す。
 */
export function bodyReminder(weekly: ReturnType<typeof weeklyMonk>, settings: Settings): string {
  if (weekly.workouts >= settings.monkWorkoutPerWeek) return '';
  const left = settings.monkWorkoutPerWeek - weekly.workouts;
  return `今週の運動は${weekly.workouts}回です（目安 週${settings.monkWorkoutPerWeek}回、あと${left}回）。`
    + 'この期間は人にも会わず刺激も減るぶん、運動がほぼ唯一のストレスの逃がし方になります。作業時間を削ってでも先に入れたほうが、結果的に続きます。';
}

// ── 既に入っている別の出典との食い違い ────────────────────────

export interface Conflict {
  id: string;
  topic: string;
  a: { source: string; says: string };
  b: { source: string; says: string };
  handling: string;
}

/**
 * **アプリはどちらが正しいかを決めない。** 食い違っている事実をそのまま見せる。
 * 決めるのは本人。
 */
export const CONFLICTS: Conflict[] = [
  {
    id: 'social',
    topic: '人との距離',
    a: {
      source: 'モンクモード',
      says: '友人と距離を置き、一人になる時間を取る。付き合う人間で生きる世界が変わるので、いまの場所から抜け出すには一度離れる必要がある。',
    },
    b: {
      source: '最高の体調',
      says: '孤独だった人に友達ができると最大15年寿命が延びるという研究がある。健康への影響は禁煙より大きい、とも紹介されている。',
    },
    handling:
      'このアプリは「人間関係を切る」ほうは実装していません。記録するのは**一人で集中した時間**だけで、'
      + '人との接点は🤝人間関係にこれまで通り残します。両方を見て、自分で決めてください。'
      + '一人の時間が増えているのに人との接点が0の日が続いていたら、それは目標のためではなく孤立かもしれません。',
  },
];

/** 一人の時間が増える一方で、人との接点が無い日が続いていないか（孤立の早期発見） */
export function isolationWarning(days: Record<string, DayRecord>, dateKeys: string[]): string {
  let soloDays = 0;
  let noContactDays = 0;
  for (const key of dateKeys) {
    const d = days[key];
    if (monkOf(d).soloMinutes > 0) soloDays += 1;
    if (d?.condition?.social === 'none') noContactDays += 1;
  }
  if (soloDays >= 3 && noContactDays >= 4) {
    // 「孤立しています」と決めつけず、本人が答えられる問いの形にする
    return `一人の時間を取れた日が${soloDays}日ある一方で、誰とも話さなかった日が${noContactDays}日あります。`
      + 'これは目標のための一人の時間でしょうか、それとも孤立に近づいているでしょうか。'
      + '出典どうしで意見が割れている部分です（モンクモードは距離を置け、最高の体調は人といろ）。'
      + '集中のための一人の時間と、誰とも話さない状態は別ものとして見てください。';
  }
  return '';
}

// ── 出典に書かれていたが、断定しないもの ────────────────────────

export const MONK_UNVERIFIED = [
  {
    id: 'salt',
    claim: '朝、白湯にヒマラヤピンクソルトかシーソルトを3〜4g入れて飲む',
    note:
      '**この項目だけは特に注意してください。** 日本の食事はもともと食塩が多めです。'
      + '血圧が高い人、腎臓に不安がある人、塩分を制限されている人には勧められません。'
      + '真似する前に医師に相談してください。このアプリは塩の量を記録も推奨もしません。',
    hard: true,
  },
  {
    id: 'walking_bp',
    claim: 'ウォーキングの降圧作用は薬よりも効果的',
    note: '裏は取れていません。**服薬をやめる・減らすの判断は必ず医師と**行ってください。運動を足すこと自体は問題ありません。',
    hard: true,
  },
  {
    id: 'eggs',
    claim: '卵は完全栄養食で、どんなサプリメントよりも効果がある。1日3個食べるとよい',
    note: '裏は取れていません。持病や検査値によっては合わない場合があります。特定の食品を毎日決まった数、というのは自己判断で始めない方が無難です。',
  },
  {
    id: 'books_top5',
    claim: '専門書を毎月1冊読めば、5年以内に確実にトップ5%に入れる',
    note: '「確実に」と言い切れる根拠はありません。読書そのものは勧められますが、この数字は目安として受け取らないでください。',
  },
  {
    id: 'income',
    claim: '読書をする人は年収が上がるとデータで明確に出ている',
    note: '裏は取れていません。関係があったとしても、読書が原因だとは限りません。',
  },
  {
    id: 'brain66',
    claim: '66日続けると脳の配線ごと変わる',
    note: '習慣が身につくまでの日数（18〜254日、平均66日）の紹介が元ですが、「脳の配線が変わる」は言い過ぎです。区切りの目安として使ってください。',
  },
  {
    id: 'golden',
    claim: '運動後3時間は集中のゴールデンタイム',
    note: '裏は取れていません。ただ、運動のあとに手を付けやすいと感じる人はいます。自分に当てはまるかどうかを試す枠として使ってください。',
  },
];

/** 塩・血圧まわりの事前確認（fasting.ts の PRECHECKS と同じ考え方） */
export const MONK_PRECHECKS = [
  { id: 'blood_pressure', label: '血圧が高い、または塩分を制限している' },
  { id: 'kidney', label: '腎臓に不安がある' },
  { id: 'heart', label: '心臓の持病がある、運動を止められている' },
];

export const MONK_PRECHECK_NOTICE =
  '1つでも当てはまる場合、出典にある「朝に塩を3〜4g」や急な運動量の増やし方は、そのまま真似しないでください。'
  + '先に医師に相談を。このアプリは医療の判断をしません。';
