// 瞑想（ユーザー提供の要約を実行できる形にしたもの）。
//
// 出典: 本人が動画から作った要約（2026-08-21 受領）。研究の一次資料には当たっていないため、
// 効果はすべて「そう報告されている」という書き方に統一する（断定しない）。
//
// 要約から、この実装が拾っている“行動に落ちる”点は次の4つ:
//   1. 10分が最小単位。「効果を感じる入り口」であって「脳が変わる」介入時間ではない。
//   2. 初心者が急に1時間やると、雑念との格闘で逆にストレスになることがある
//      → 長さは段階的にしか上げない。飛ばす時は注意を出す。
//   3. 効果は「量」より「継続の一貫性」に強く依存する
//      → 合計分数ではなく“実践した日数”を主役にする。
//   4. 期間ごとに報告されている変化が違う
//      → いま何段階目かを、期間の進み具合と一緒に見せる。

export interface MeditationSession {
  minutes: number;
  recordedAt: number;
}

/** 選べる長さ。10分を既定の入り口とする */
export const MINUTE_STEPS = [3, 10, 20, 30, 60] as const;
/** 段階的に上げる時の並び（3分は「今日はきつい日」の逃げ道なので段階には入れない） */
const LADDER = [10, 20, 30, 60];

export interface LengthOption {
  minutes: number;
  label: string;
  purpose: string;
  caution?: string;
}

export const LENGTH_OPTIONS: LengthOption[] = [
  {
    minutes: 3,
    label: '3分',
    purpose: 'しんどい日に「座る」だけを守るための最小限。ゼロにしないためのもの。',
  },
  {
    minutes: 10,
    label: '10分',
    purpose: '自律神経を整える最小単位とされる長さ。仕事や勉強の合間の切り替え、疲労時のマイクロ回復に。',
    caution: '10分は「効果を感じる」入り口で、脳の構造が変わるほどの時間ではないとされます。続けることが前提です。',
  },
  { minutes: 20, label: '20分', purpose: '10分に慣れてから。座っていられる時間を少しずつ伸ばす段階。' },
  { minutes: 30, label: '30分', purpose: '深いリラックスに入りやすくなる手前の段階。' },
  {
    minutes: 60,
    label: '60分',
    purpose: '深いリラックス（アルファ波・シータ波優位）に入りやすい／感情の観察力が高まりやすい、とされる長さ。',
    caution: '初心者が急に1時間行うと、雑念との格闘で逆にストレスになることがあります。段階を踏んでから。',
  },
];

export const LENGTH_MAP = Object.fromEntries(LENGTH_OPTIONS.map((o) => [o.minutes, o]));

/**
 * 次にすすめる長さ。
 * **1段階ずつしか上げない**（要約の「急に1時間はかえって逆効果」を実装に落としたもの）。
 * 同じ長さ以上を5回できていたら、次の段階を提案する。
 */
export function recommendMinutes(pastMinutes: number[]): { minutes: number; reason: string } {
  const done = pastMinutes.filter((m) => m > 0);
  if (done.length === 0) {
    return { minutes: 10, reason: '10分が最小単位とされています。まずはここから。' };
  }
  // いまの段階＝これまでに一番よくやっている長さ（ラダー上で一番高いもの）
  const reached = LADDER.filter((step) => done.filter((m) => m >= step).length >= 5);
  const current = reached.length > 0 ? reached[reached.length - 1] : 10;
  const atCurrent = done.filter((m) => m >= current).length;

  if (atCurrent >= 5) {
    const next = LADDER[Math.min(LADDER.indexOf(current) + 1, LADDER.length - 1)];
    if (next !== current) {
      return { minutes: next, reason: `${current}分を${atCurrent}回できています。${next}分へ1段階だけ上げられます。` };
    }
    return { minutes: current, reason: 'いまの長さを続けるのが、一番効果が出やすいとされています。' };
  }
  return { minutes: current, reason: `${current}分をあと${5 - atCurrent}回積むと、次の長さをすすめます。` };
}

/** 普段より2段階以上長い時間を選んだら注意を出す（いきなり1時間を防ぐ） */
export function shouldWarnJump(chosen: number, pastMinutes: number[]): boolean {
  const done = pastMinutes.filter((m) => m > 0);
  if (chosen <= 10) return false;
  const usual = done.length ? Math.max(...done) : 0;
  const ci = LADDER.indexOf(chosen);
  const ui = LADDER.indexOf(LADDER.filter((s) => s <= usual).pop() ?? 0);
  if (ci < 0) return false;
  return ci - Math.max(ui, 0) >= 2 || (usual === 0 && chosen >= 20);
}

/**
 * 継続日数ごとに「報告されている変化」。
 * すべて出典の要約どおりで、断定はしない（保証ではなく報告）。
 */
export interface EffectStage {
  id: string;
  fromDays: number;
  title: string;
  reported: string[];
  note?: string;
}

export const EFFECT_STAGES: EffectStage[] = [
  {
    id: 'session',
    fromDays: 1,
    title: '1回のセッション',
    reported: [
      '副交感神経が優位になり、心拍数・血圧が下がってリラックスする',
      'ストレスホルモン（コルチゾール）の分泌が一時的に下がる',
      '集中力・注意力が短時間だが上がる',
    ],
  },
  {
    id: 'weeks',
    fromDays: 14,
    title: '数週間',
    reported: ['不安感の軽減', '睡眠の質の向上'],
  },
  {
    id: 'months',
    fromDays: 30,
    title: '1〜2ヶ月',
    reported: ['ストレス耐性の向上', '感情の起伏が穏やかになる'],
  },
  {
    id: 'mbsr8w',
    fromDays: 56,
    title: '8週間（MBSRの研究水準）',
    reported: ['8週間程度の継続的なマインドフルネス瞑想で、灰白質密度に変化が見られたというMRI研究の報告がある'],
    note: 'Harvard/MGH などの報告として紹介されているもの。一次資料は未確認（※要確認）。',
  },
  {
    id: 'long',
    fromDays: 90,
    title: '数ヶ月〜1年',
    reported: ['前頭前野の活動の変化', '扁桃体（恐怖・不安の中枢）の反応の低下'],
    note: '報告のある研究がある、という水準の話です。個人差があります。',
  },
];

/** いま何段階目か（実践した日数から）。0日なら null */
export function effectStageFor(practicedDays: number): EffectStage | null {
  if (practicedDays <= 0) return null;
  let found: EffectStage | null = null;
  for (const s of EFFECT_STAGES) {
    if (practicedDays >= s.fromDays) found = s;
  }
  return found;
}

/** 次の段階と、そこまでの残り日数 */
export function nextStage(practicedDays: number): { stage: EffectStage; remaining: number } | null {
  for (const s of EFFECT_STAGES) {
    if (practicedDays < s.fromDays) return { stage: s, remaining: s.fromDays - practicedDays };
  }
  return null;
}

/**
 * 集計。**主役は「実践した日数」**（要約の「量より継続の一貫性」に対応）。
 * 合計分数も出すが、あくまで補助。
 */
export function summarize(sessionsByDate: Record<string, MeditationSession[] | undefined>) {
  let days = 0;
  let sessions = 0;
  let totalMinutes = 0;
  const perDay: number[] = [];
  for (const list of Object.values(sessionsByDate)) {
    if (!list || list.length === 0) continue;
    const minutes = list.reduce((a, b) => a + b.minutes, 0);
    if (minutes <= 0) continue;
    days += 1;
    sessions += list.length;
    totalMinutes += minutes;
    perDay.push(minutes);
  }
  return {
    days,
    sessions,
    totalMinutes,
    averageMinutes: days > 0 ? Math.round(totalMinutes / days) : 0,
    longest: perDay.length ? Math.max(...perDay) : 0,
  };
}

/** これまでのセッションの長さ一覧（recommendMinutes に渡す） */
export function pastMinutesOf(sessionsByDate: Record<string, MeditationSession[] | undefined>): number[] {
  const out: number[] = [];
  for (const list of Object.values(sessionsByDate)) {
    for (const s of list ?? []) out.push(s.minutes);
  }
  return out;
}

/** 秒 → 'M:SS'（タイマー表示用） */
export function formatRemaining(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
