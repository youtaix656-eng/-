// 『最高の体調』（鈴木祐）の解説を、記録できる行動に落としたもの。
//
// 出典: 解説動画の内容を本人がまとめた要約（2026-08-30 受領）。一次資料（書籍・原論文）は未確認。
// そのため効果はすべて「そう紹介されている／報告されている」という書き方に統一し、断定しない。
//
// ⚠ この実装がやらないこと:
//   **炎症スコアを作らない。** 本書は不眠・肥満・うつなどの不調を「体の炎症」で説明するが、
//   体内の炎症は血液検査などで測るもので、行動のチェックから数値化できるものではない。
//   点数を出すと「今日の炎症は72点」のような、根拠のない数字を信じさせてしまう。
//   ここで数えるのは **「炎症を下げるとされる行動を、何日置けたか」** だけにする。
//
// 本書の枠組み（文明病 → 炎症 → 6つの領域）はそのまま持つが、
// 枠組みは「説明」であって行動ではないので、記録の対象にはしない。

import type { ConditionRecord, DayRecord } from '../types/index.js';

/** 本書の説明の枠組み。画面では読み物として出す（チェック項目にはしない） */
export const FRAMING = {
  civilization: {
    title: '文明病',
    body:
      '社会の変化によって起きる、現代に特有の不調のこと。不眠・肥満・うつ・慢性疲労・集中力が続かないなど、'
      + 'バラバラに見える問題がここに含まれると紹介されている。'
      + '人類は600万年にわたって狩猟採集で暮らしてきたので、体と心の作りは当時のまま。'
      + '意思の力だけで抗おうとしても続かない、という前提に立つ。',
  },
  inflammation: {
    title: '炎症',
    body:
      '細胞レベルで起きる「火事」のようなもの。目の充血や鼻詰まり、風邪の症状も炎症にあたる。'
      + '分かりやすい症状ならまだしも、分かりにくい炎症は気づかないまま続く。'
      + '不眠や原因のはっきりしない不調が、体のどこかの炎症と連動していることがあるとされる。',
    caution:
      '体内の炎症は検査で測るものです。このアプリは行動を記録するだけで、炎症の有無や強さを判定しません。',
  },
} as const;

export interface Domain {
  id: string;
  title: string;
  reading: string;
  icon: string;
  /** なぜこれをやるのか（本書の説明） */
  why: string;
  /** 既存機能との関係。二重に記録させないための覚え書き */
  linkedTo?: string;
}

export const DOMAINS: Domain[] = [
  {
    id: 'gut',
    title: '腸内環境',
    reading: 'ちょうないかんきょう',
    icon: '🦠',
    why:
      '腸内細菌がないと免疫のしくみが働かず、慢性的な炎症の原因になるとされる。'
      + '菌は100兆〜1000兆いるが、大事なのは数より**種類**。食物繊維はその細菌の食事になる。',
  },
  {
    id: 'nature',
    title: '自然に触れる',
    reading: 'しぜんにふれる',
    icon: '🌿',
    why:
      '自然には日中にたまった疲れやダメージを回復させる働きがあり、'
      + 'マッサージより癒しの効果が高かったという研究が紹介されている。'
      + '観葉植物は幸福度や集中力を上げ、ストレスを下げる効果も確認されているという。'
      + '本物でなくても、写真・壁紙・音で効果を実感できるとされる。',
  },
  {
    id: 'sleep',
    title: '睡眠',
    reading: 'すいみん',
    icon: '🌙',
    why:
      '正しく眠れていないと体内の炎症が増えるとされる。睡眠時間は1日7〜9時間の範囲で、'
      + '寝なさすぎも寝過ぎもよくない。ベッドで眠る以外のことをすると'
      + '「ここは眠る場所」という脳の認識が薄れ、寝つきが悪くなる。',
    linkedTo: '就寝ルール（シフト対応）と同じカードにまとめてあります。',
  },
  {
    id: 'social',
    title: '人間関係',
    reading: 'にんげんかんけい',
    icon: '🤝',
    why:
      '孤独だった人に友達ができると最大で15年寿命が延びる、という研究が紹介されている。'
      + '健康への影響でいうと禁煙より大きい、とも。困った時に助けを求められる相手がいる人は、'
      + 'はっきりした記憶を長く保てるという報告もある。',
    linkedTo: 'ここに記録すると、ゴーストモード①「仲間」にも自動でチェックが入ります。',
  },
  {
    id: 'anxiety',
    title: 'ぼんやりとした不安',
    reading: 'ぼんやりとしたふあん',
    icon: '🌌',
    why:
      '狩猟採集の時代は「今」を生きるのに必死で、はっきりした不安しかなかった。'
      + '現代は未来についての、ずっと付きまとうぼんやりとした不安がある。'
      + '不安は記憶力や判断力を奪うとされる。宇宙や大自然と比べて自分の小ささを感じること、'
      + '今ここに集中すること（マインドフルネス）が対処として挙げられている。',
    linkedTo: '瞑想を記録した日は、不安への対処をしたものとして数えます。',
  },
  {
    id: 'rules',
    title: '仕事をルール化する',
    reading: 'しごとをるーるかする',
    icon: '📋',
    why:
      'やるべきことがぼんやりしたままだと不安やストレスを感じる。'
      + '今日・今週・今月にやり遂げたいことを3つずつ書き出す「3のルール」は、'
      + '幸福度が上がりやすくなると研究で分かっていると紹介されている。'
      + '未来を細かく刻むことで今との距離が近づき、不安が小さくなる。',
    linkedTo: '「今日の3つ」「今週の3つ」「今月の3つ」として実装しています。',
  },
];

export const DOMAIN_MAP = Object.fromEntries(DOMAINS.map((d) => [d.id, d]));

/** 発酵食品。**種類を増やす**ことが目的なので、選択肢を広く並べる */
export const FERMENTS = [
  'ヨーグルト', '納豆', '味噌', 'キムチ', 'ぬか漬け', 'チーズ', '甘酒', '酢', 'その他',
];

/** 食物繊維の取りやすい食品（本書で挙げられていたもの＋同系統） */
export const FIBERS = ['海藻', '寒天', 'ごぼう', 'きのこ', 'りんご', '豆類', '大麦・オートミール', 'その他'];

/** 室内に取り入れる自然 */
export const INDOOR_NATURE = ['観葉植物', '自然の写真', '壁紙を森や海に', '川や鳥の音'];

/** 睡眠まわりの習慣 */
export const SLEEP_HYGIENE = [
  { id: 'bed_only', label: 'ベッドでは寝る以外のことをしなかった' },
  { id: 'morning_light', label: '日中に太陽光を浴びた' },
  { id: 'dim_evening', label: '夜は室内の照明を暗くした' },
];

/** 不安への対処 */
export const ANXIETY_ACTIONS = [
  { id: 'cosmos', label: '宇宙について考えた' },
  { id: 'nature_video', label: '大自然の動画を見た' },
  { id: 'art', label: 'アートや大きな人工物を見た' },
  { id: 'mindfulness', label: '瞑想・今ここに集中した' },
];

export const SOCIAL_OPTIONS = [
  { id: 'deep', label: '深く関われる相手と話した' },
  { id: 'light', label: '軽い接点はあった' },
  { id: 'none', label: '誰とも話さなかった' },
] as const;

/** 外で自然に触れる目安（本書：2日に1回、最低10分） */
export const NATURE_MINUTES_TARGET = 10;
export const NATURE_EVERY_N_DAYS = 2;

export function emptyCondition(): ConditionRecord {
  return {
    ferments: [],
    fibers: [],
    natureMinutes: 0,
    indoorNature: [],
    social: null,
    anxietyFelt: null,
    anxietyActions: [],
    sleepHygiene: [],
  };
}

export function conditionOf(record: DayRecord | undefined): ConditionRecord {
  return { ...emptyCondition(), ...(record?.condition ?? {}) };
}

/**
 * その日、その領域の行動を置けたか。
 * **点数ではなく真偽**にする（点数にすると、体の状態を測っているように見えてしまう）。
 */
export function domainDone(record: DayRecord | undefined, domainId: string): boolean {
  const c = conditionOf(record);
  switch (domainId) {
    case 'gut':
      return c.ferments.length > 0 || c.fibers.length > 0;
    case 'nature':
      return c.natureMinutes >= NATURE_MINUTES_TARGET || c.indoorNature.length > 0;
    case 'sleep':
      return c.sleepHygiene.length > 0 || Boolean(record?.sleep);
    case 'social':
      return c.social === 'deep' || c.social === 'light';
    case 'anxiety':
      // 不安を感じなかった日も、対処した日も「置けた」とする（不安を感じた事実は責めない）
      return c.anxietyFelt === false || c.anxietyActions.length > 0 || (record?.meditations ?? []).length > 0;
    case 'rules':
      return false; // 3のルールは threeRules.ts が持つ（ここでは判定しない）
    default:
      return false;
  }
}

/** 発酵食品の「種類」の通算。数ではなく種類が大事、という本書の主張をそのまま数える */
export function fermentVariety(days: Record<string, DayRecord>, dateKeys: string[]): string[] {
  const set = new Set<string>();
  for (const key of dateKeys) {
    for (const f of conditionOf(days[key]).ferments) set.add(f);
  }
  return [...set];
}

export interface DomainWeek {
  domain: Domain;
  days: number;
  possible: number;
}

/**
 * 週の集計。**「炎症を下げるとされる行動を何日置けたか」だけ**を返す。
 * 合計点・スコア・判定は作らない。
 */
export function weeklyCondition(days: Record<string, DayRecord>, dateKeys: string[], threeDone: number): {
  perDomain: DomainWeek[];
  fermentKinds: string[];
  natureOutdoorDays: number;
  lonelyDays: number;
} {
  const perDomain = DOMAINS.map((domain) => ({
    domain,
    days: domain.id === 'rules' ? threeDone : dateKeys.filter((k) => domainDone(days[k], domain.id)).length,
    possible: dateKeys.length,
  }));
  return {
    perDomain,
    fermentKinds: fermentVariety(days, dateKeys),
    natureOutdoorDays: dateKeys.filter((k) => conditionOf(days[k]).natureMinutes >= NATURE_MINUTES_TARGET).length,
    lonelyDays: dateKeys.filter((k) => conditionOf(days[k]).social === 'none').length,
  };
}

/**
 * 今週いちばん置けていない領域を1つだけ返す（次に手を付けるところ）。
 * 全部できている・材料が足りない時は null（無理に指摘しない）。
 */
export function weakestDomain(weekly: ReturnType<typeof weeklyCondition>): Domain | null {
  const candidates = weekly.perDomain.filter((p) => p.possible >= 3);
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => a.days - b.days);
  if (sorted[0].days >= sorted[0].possible) return null; // 全部置けている
  return sorted[0].domain;
}
