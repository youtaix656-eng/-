// 食事の時間と量（『できる男は超小食』の解説要約から）。
//
// 出典: 解説動画の内容を本人がまとめた要約（2026-09-02 受領）。書籍・原論文は未確認。
//
// ⚠ この題材だけは、他（瞑想・最高の体調）より慎重に作ってある。理由は3つ:
//
//   1. **裏の取れない主張が混ざっている。**
//      「断食で脳から毒を排泄する」「消化はフルマラソン相当のエネルギーを使う」
//      「肉は腸内で腐敗して発がん」「牛乳のカゼインに発がん性」などは、
//      争いがある、または誇張とされる主張。**アプリの側から効果として断定しない。**
//      出典にそう書いてあることは隠さず出すが、必ず ※要確認 を添える。
//
//   2. **やってはいけない人がいる。**
//      血糖に関わる持病・服薬中・妊娠授乳中・成長期・摂食障害の経験・低体重の人にとって、
//      欠食や長時間の絶食は危険になりうる。始める前に必ず確認を出す。
//
//   3. **数えて煽ると害になりうる。**
//      断食の連続日数や記録更新を数える仕組みは作らない（`STREAK` を持たない）。
//      「食べない日を伸ばすほど良い」という方向に背中を押すと、
//      食事のことばかり考える状態や、体重が減り続ける状態を後押ししてしまう。
//      このファイルが数えるのは **「無理なく続けられているか」と「止めどき」** だけ。
//
// 出典自身が「断食に対して辛い・苦しいという感覚を持たないようにすることが大切」
// 「無理なく続けられるように工夫する」と言っている。その言葉をそのまま設計の芯にしている。

import { toMinutes, formatClock } from './date.js';
import type { DayRecord, Settings } from '../types/index.js';

// ── 段階（1段ずつしか上げない）─────────────────────────────

export interface Plan {
  id: string;
  label: string;
  summary: string;
  /** 段階の順番。null は並列の選択肢（週末だけ） */
  step: number | null;
  caution?: string;
}

export const PLANS: Plan[] = [
  {
    id: 'three',
    label: '1日3食のまま',
    summary: '時間と量だけ見る段階。まずは食べ終わりの時刻と、腹八分目を記録するところから。',
    step: 0,
  },
  {
    id: 'two',
    label: '朝を抜く（1日2食）',
    summary: '出典が「まずここから」としている段階。水・お茶・コーヒーは飲んでよい（砂糖とミルクは入れない）。',
    step: 1,
  },
  {
    id: 'one',
    label: '1日1食',
    summary: '2食に慣れてから。**その1食は腹八分目に抑える**（1食にしたぶんドカ食いをすると、かえって胃に負担がかかる）。',
    step: 2,
    caution: '出典も「1日1食にしたからといって、いくらでも食べていいわけではない」と繰り返し書いています。',
  },
  {
    id: 'weekend',
    label: '週末だけ整える',
    summary: '会食や接待で平日は難しい人向けに、出典が挙げている選び方。休みの日だけ食事を軽くする。',
    step: null,
  },
];

export const PLAN_MAP = Object.fromEntries(PLANS.map((p) => [p.id, p]));

/** いまの段階から見て、次に上げてよい段階（1段だけ）。上げてよくない時は null */
export function nextPlan(currentId: string): Plan | null {
  const cur = PLAN_MAP[currentId];
  if (!cur || cur.step === null) return null;
  const step = cur.step;
  return PLANS.find((p) => p.step === step + 1) ?? null;
}

/** 段階を上げる前に満たしたい日数（出典の「慣れてから」を機械的に言い換えたもの） */
export const DAYS_BEFORE_STEP_UP = 14;

// ── 空腹の時間 ───────────────────────────────────────

/**
 * 前日の最後の食事から、その日の最初の食事までの時間（時間・小数1桁）。
 * 材料がそろわなければ null（0にしない）。
 * 時刻は shift.ts と同じ「その日の0:00からの分」で扱い、日をまたいでも引き算だけで済ませる。
 */
export function fastingHours(
  prevLastMealAt: string | null | undefined,
  prevCrossesMidnight: boolean,
  todayFirstMealAt: string | null | undefined,
): number | null {
  const last = toMinutes(String(prevLastMealAt ?? ''));
  const first = toMinutes(String(todayFirstMealAt ?? ''));
  if (last === null || first === null) return null;
  // 前日の食事が日付をまたいでいれば、その日の側の時刻として扱う
  const lastAbs = prevCrossesMidnight ? last : last - 1440;
  const diff = first - lastAbs;
  if (diff <= 0) return null;
  return Math.round((diff / 60) * 10) / 10;
}

/**
 * 次に食べてよい目安の時刻（最後の食事＋目標時間）。
 * 出典は「前日の夕食から翌日の昼食まで◯時間以上空ける」としているが、
 * **受け取った文字起こしではその数字が欠けていた**ため、アプリの初期値として持ち、
 * 利用者が変えられるようにしている（勝手な数字を出典の値として出さない）。
 */
export function nextMealAt(
  lastMealAt: string | null | undefined,
  crossesMidnight: boolean,
  targetHours: number,
): { minutes: number; label: string } | null {
  const last = toMinutes(String(lastMealAt ?? ''));
  if (last === null) return null;
  const base = crossesMidnight ? last + 1440 : last;
  const minutes = base + Math.max(0, targetHours) * 60;
  return { minutes, label: formatClock(minutes) };
}

/** その日の目標時間。勤務日は短くできる（夜勤で長時間空けると負担になりうるため） */
export function targetHoursFor(record: Pick<DayRecord, 'shift'> | undefined, settings: Settings): number {
  if (record?.shift === 'work' && settings.fastingWorkdayHours > 0) return settings.fastingWorkdayHours;
  return settings.fastingTargetHours;
}

// ── 量（腹八分目）─────────────────────────────────────

export const FULLNESS_OPTIONS = [
  { id: 'eight', label: '腹八分目で止められた', tone: 'ok' as const },
  { id: 'full', label: '満腹まで食べた', tone: 'warn' as const },
  { id: 'over', label: '食べすぎた', tone: 'warn' as const },
];

// ── 安全のしくみ ─────────────────────────────────────

/** 始める前に確認すること。1つでも当てはまるなら、まず医師に相談してから */
export const PRECHECKS = [
  { id: 'blood_sugar', label: '血糖に関わる持病がある（糖尿病・低血糖など）' },
  { id: 'medication', label: '食事の時間に関わる薬を飲んでいる' },
  { id: 'pregnant', label: '妊娠中・授乳中' },
  { id: 'growing', label: '成長期にあたる' },
  { id: 'eating_disorder', label: '摂食障害の経験がある、または食事のことを考えすぎてしまう' },
  { id: 'underweight', label: '体重が少なめ、または最近減り続けている' },
];

export const PRECHECK_NOTICE =
  '1つでも当てはまる場合は、自分で判断せず、先に医師に相談してください。'
  + '欠食や長い絶食が体に合わない人がいます。このアプリは医療の判断をしません。';

/** 止めどきのサイン。出典の「辛い・苦しいと感じないようにする」を具体的にしたもの */
export const STOP_SIGNS = [
  { id: 'dizzy', label: 'ふらつく・めまいがする' },
  { id: 'foggy', label: '頭がぼんやりして集中できない' },
  { id: 'low_mood', label: '気分が落ち込む・いらいらする' },
  { id: 'obsessed', label: '食べ物のことばかり考えてしまう' },
  { id: 'losing', label: '体重が減り続けている' },
  { id: 'daily_life', label: '仕事や勉強に支障が出ている' },
];

export const STOP_SIGN_MAP = Object.fromEntries(STOP_SIGNS.map((s) => [s.id, s]));

/** 直近で見たサインの数がこれを超えたら、いったん普通に食べることをすすめる */
export const PAUSE_THRESHOLD = 3;

export interface PauseAdvice {
  shouldPause: boolean;
  /** 出ていたサイン（多い順） */
  signs: { id: string; label: string; count: number }[];
  text: string;
}

/**
 * 止めどきの判定。**続けることを勧める方向には使わない**（サインが無い時は何も言わない）。
 * 体重の増減そのものは扱わない（減量の目標をアプリが持たないため）。
 */
export function pauseAdvice(records: (DayRecord | undefined)[]): PauseAdvice {
  const counts = new Map<string, number>();
  for (const r of records) {
    for (const id of r?.meal?.signs ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const signs = [...counts.entries()]
    .map(([id, count]) => ({ id, label: STOP_SIGN_MAP[id]?.label ?? id, count }))
    .sort((a, b) => b.count - a.count);
  const total = signs.reduce((a, b) => a + b.count, 0);
  // 体重が減り続けている・食べ物のことばかり考える は、1回でも止めどきとして扱う
  const serious = signs.some((s) => (s.id === 'losing' || s.id === 'obsessed') && s.count >= 1);
  const shouldPause = serious || total >= PAUSE_THRESHOLD;
  return {
    shouldPause,
    signs,
    text: shouldPause
      ? '体からのサインが出ています。今日は普通に食べて、段階をひとつ戻すか、しばらく休んでください。つらいまま続けるものではありません。'
      : '',
  };
}

/**
 * 次の段階へ進めてよいか。
 * サインが出ている間は上げない。日数が足りない間も上げない。
 */
export function stepUpAdvice(
  currentId: string,
  daysOnPlan: number,
  advice: PauseAdvice,
): { canStepUp: boolean; next: Plan | null; reason: string } {
  const next = nextPlan(currentId);
  if (!next) return { canStepUp: false, next: null, reason: 'いまの段階を続けるところです。' };
  if (advice.shouldPause) {
    return { canStepUp: false, next, reason: '体からのサインが出ている間は、段階を上げません。' };
  }
  if (daysOnPlan < DAYS_BEFORE_STEP_UP) {
    return {
      canStepUp: false,
      next,
      reason: `いまの段階を${DAYS_BEFORE_STEP_UP}日続けてから上げます（あと${DAYS_BEFORE_STEP_UP - daysOnPlan}日）。`,
    };
  }
  return { canStepUp: true, next, reason: `${next.label}へ、1段階だけ上げられます。` };
}

// ── 集計 ────────────────────────────────────────────

/**
 * 期間の集計。**連続日数は数えない**（数えると「切らさないこと」が目的になってしまう）。
 * 出すのは、記録した日数・腹八分目で止められた日数・空腹時間の中央値だけ。
 */
export function summarizeMeals(records: (DayRecord | undefined)[], settings: Settings) {
  const hours: number[] = [];
  let recorded = 0;
  let eightDays = 0;
  let signDays = 0;
  const sorted = [...records];
  for (let i = 0; i < sorted.length; i += 1) {
    const r = sorted[i];
    const meal = r?.meal;
    if (!meal) continue;
    const filled = meal.firstMealAt || meal.lastMealAt || meal.fullness || (meal.signs?.length ?? 0) > 0;
    if (!filled) continue;
    recorded += 1;
    if (meal.fullness === 'eight') eightDays += 1;
    if ((meal.signs?.length ?? 0) > 0) signDays += 1;
    const prev = sorted[i - 1]?.meal;
    const h = fastingHours(prev?.lastMealAt, Boolean(prev?.lastMealCrossesMidnight), meal.firstMealAt);
    if (h !== null) hours.push(h);
  }
  hours.sort((a, b) => a - b);
  // 偶数件は2つの真ん中の平均（上側を取ると、実際より長く空けているように見えてしまう）
  const mid = Math.floor(hours.length / 2);
  const median = hours.length === 0
    ? null
    : hours.length % 2 === 1
      ? hours[mid]
      : Math.round(((hours[mid - 1] + hours[mid]) / 2) * 10) / 10;
  return {
    recorded,
    eightDays,
    signDays,
    medianFastingHours: median,
    /** 目標に届いた日数（届かなかった日を責めるためには使わない） */
    reachedTargetDays: hours.filter((h) => h >= settings.fastingTargetHours).length,
  };
}

/**
 * 出典に書かれていたが、このアプリが効果として断定しないもの。
 * 隠さずに出したうえで、必ず「裏が取れていない」と添える。
 */
export const UNVERIFIED_CLAIMS = [
  {
    id: 'detox',
    claim: '断食で脳から食品添加物・重金属・農薬などの毒を排泄でき、頭がクリアになる',
    note: '「毒を排泄する」という説明の裏は取れていません。空腹の時間で集中しやすいと感じる人はいますが、毒が抜けるからだとは言えません。',
  },
  {
    id: 'marathon',
    claim: '1食ぶんの消化に、フルマラソンを走った後に相当するエネルギーを使う',
    note: 'この比較の裏は取れていません。消化にエネルギーを使うこと自体は知られていますが、数字はそのまま受け取らないでください。',
  },
  {
    id: 'meat',
    claim: '肉は腸内で腐敗してアンモニアを発生させ、炎症やがんの原因になる',
    note: '争いのある主張です。食べる量を見直すのは構いませんが、この説明を理由に食品を断つ前に、確かな情報を確認してください。',
  },
  {
    id: 'milk',
    claim: '牛乳のカゼインに発がん性があり、飲むほど骨粗しょう症・骨折が増える',
    note: '争いのある主張です。持病がある場合や、栄養が偏る心配がある場合は、自己判断ではなく医師・管理栄養士に相談してください。',
  },
  {
    id: 'weight',
    claim: '1日1食にしても体は適応するので、痩せすぎることはない',
    note: '個人差があります。体重が減り続ける場合は「適応の途中」と考えず、いったん戻してください。',
  },
];

/** 出典が推していた食べ方（既存の腸内環境の記録と重なるので、そちらへ寄せる） */
export const FOOD_GUIDE = {
  title: '何を食べるか',
  body:
    '出典は、高カロリー・高たんぱく・高脂質・精白・高砂糖の「五高食」を避け、'
    + '日本の伝統的な和食（その逆の「五低食」）をすすめています。'
    + '発酵食品（味噌・納豆・醤油・甘酒）を積極的に取る、という点は、'
    + 'このアプリの「腸内環境」の記録とそのまま重なります。',
  linkNote: '食べたものの記録は「最高の体調」の🦠腸内環境で付けてください（同じことを2か所に書かないため）。',
};
