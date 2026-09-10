// 目次・索引 — アプリ内のすべての項目を1つの一覧に集める。
//
// **各データファイルから毎回導出する。書き写さない**（二重管理＝食い違いの元）。
// このファイルが持ってよいのは「まとまりの名前（カテゴリ）と飛び先」だけで、
// 項目そのもの・説明文・読み・別名は **必ず元データ側**（src/lib/*.ts）にある。
//
// 約束（toc.spec.ts が機械チェックする）:
//   - 並びは あ〜ん → A〜Z → その他（yomi.ts）。数字は読みに変換してから行を決める。
//   - 漢字を含むなら reading を元データに必ず書く。**自動推定しない**。
//     読みが無ければ「その他」行に落ちて、入れ忘れが目に見えるようにする。
//   - タイトルは重複させない（統合後の目次全体で）。
//   - 飛び先（anchor）は data/anchors.ts の ANCHORS に在るものだけ。
//   - descriptionStatus の既定は 'needs_review'。**'verified' は明示した時だけ**
//     （出典由来の主張は、こちらで確かめようがないので既定で「※要確認」にする）。

import { DEFAULT_HABIT_SEEDS } from '../lib/habits.js';
import { LENGTH_OPTIONS, EFFECT_STAGES } from '../lib/meditation.js';
import { DOMAINS, FRAMING } from '../lib/condition.js';
import { PLANS, PRECHECKS, PRECHECK_NOTICE, STOP_SIGNS, UNVERIFIED_CLAIMS, FOOD_GUIDE } from '../lib/fasting.js';
import {
  MONK_AREAS, SNS_RULES, CONFLICTS, MONK_UNVERIFIED, MONK_PRECHECKS, MONK_PRECHECK_NOTICE, MONK_PERIOD_NOTE,
} from '../lib/monkMode.js';
import {
  ROUTINE_STEPS, PRESETS as ROUTINE_PRESETS, ROUTINE_UNVERIFIED,
  WAKE_FIRST_NOTE, WATER_ON_WAKING_NOTE, BEDTIME_MINDSET_NOTE,
} from '../lib/morningRoutine.js';
import { SLEEP_CRITERIA } from '../lib/sleepQuality.js';
import { SCOPES } from '../lib/threeRules.js';
import { MANAGER_ALLOCATION_OPTIONS } from '../lib/weekly.js';
import {
  HABIT_PRESETS, MEDITATION_SOURCE, CONDITION_SOURCE, MEAL_SOURCE, MONK_SOURCE, ROUTINE_SOURCE,
  type KnowledgeSource,
} from './presets.js';
import { ANCHORS, ALL_ANCHORS } from './anchors.js';
import { buildKanaIndex, readingInfo, foldKana, normalizeAlnum, OTHER_GROUP } from '../lib/yomi.js';

export type ViewId = 'today' | 'calendar' | 'weekly' | 'habits' | 'toc' | 'settings';

/** 飛び先の種類。page=画面 / question=答える項目 / function=記録する機能 / system=アプリ全体の決まり */
export type DestinationType = 'page' | 'question' | 'function' | 'system';

export interface Destination {
  type: DestinationType;
  label: string;
  view: ViewId;
  anchor: string;
}

export type DescriptionStatus = 'verified' | 'needs_review';

export interface TocEntry {
  id: string;
  category: string;
  title: string;
  reading: string;
  /** 一覧に出す短い添え書き */
  sub: string;
  /** 詳細パネルに出す説明。空なら画面が「※説明未登録」と出す */
  description: string;
  descriptionStatus: DescriptionStatus;
  aliases: string[];
  destinations: Destination[];
  /** 元データ側の id（削除・重複の突き合わせに使う） */
  targetId: string;
  /** ユーザーが端末内で足した項目か */
  userAdded?: boolean;
}

// ── 画面（この表がナビの単一の正。App.tsx はここから作る）────────────────
export const SCREENS: { id: ViewId; icon: string; label: string; reading: string; anchor: string; desc: string }[] = [
  { id: 'today', icon: '🌅', label: '今日', reading: 'きょう', anchor: ANCHORS.routine, desc: 'その日の記録を上から順に置いた画面。起きて最初のルーティン、今日の3つ、習慣、体調、食事、モンクモード、瞑想、就寝、メモ。' },
  { id: 'calendar', icon: '🗓', label: 'カレンダー', reading: 'かれんだー', anchor: ANCHORS.cycle, desc: '月のマス目から日を選んで、その日の記録を開く。過去の日も同じ形で書ける。' },
  { id: 'weekly', icon: '📓', label: '週次', reading: 'しゅうじ', anchor: ANCHORS.weekly, desc: '管理者視点（計画は妥当だったか）→実行者視点（どう感じたか）の順で書く。責めるのは実行役ではなく計画のほう、という前提で作ってある。' },
  { id: 'habits', icon: '✳️', label: '習慣', reading: 'しゅうかん', anchor: ANCHORS.habitsList, desc: '習慣の追加・編集・休止。ゴーストモードの7ステップが初期値で、あとから足したり休ませたりできる。' },
  { id: 'toc', icon: '📇', label: '目次', reading: 'もくじ', anchor: ANCHORS.tocCandidates, desc: 'アプリに出てくる言葉をあ〜ん／A〜Zで引ける索引。用語をタップすると説明と飛び先が出る。' },
  { id: 'settings', icon: '⚙️', label: '設定', reading: 'せってい', anchor: ANCHORS.settings, desc: 'シフト・就寝目標・各機能の目安・書き出し／取り込み。' },
];

/** 画面の中の「まとまり」ごとの飛び先。カテゴリの既定の飛び先に使う */
const D = {
  routine: { type: 'function', label: '起きて最初のルーティン', view: 'today', anchor: ANCHORS.routine },
  threeDay: { type: 'function', label: '今日の3つ', view: 'today', anchor: ANCHORS.threeRulesDay },
  threeMonth: { type: 'function', label: '今月の3つ', view: 'today', anchor: ANCHORS.threeRulesMonth },
  habits: { type: 'function', label: '今日の習慣', view: 'today', anchor: ANCHORS.habits },
  condition: { type: 'function', label: '体調の6領域', view: 'today', anchor: ANCHORS.condition },
  meal: { type: 'function', label: '食事の時間と量', view: 'today', anchor: ANCHORS.meal },
  monk: { type: 'function', label: 'モンクモード', view: 'today', anchor: ANCHORS.monk },
  meditation: { type: 'function', label: '瞑想', view: 'today', anchor: ANCHORS.meditation },
  bedtime: { type: 'function', label: '就寝ルール', view: 'today', anchor: ANCHORS.bedtime },
  sleepQuality: { type: 'function', label: '眠りの質', view: 'today', anchor: ANCHORS.sleepQuality },
  cycle: { type: 'function', label: '実践期間', view: 'today', anchor: ANCHORS.cycle },
  weekly: { type: 'page', label: '週次振り返り', view: 'weekly', anchor: ANCHORS.weekly },
  habitsList: { type: 'page', label: '習慣の一覧', view: 'habits', anchor: ANCHORS.habitsList },
  presets: { type: 'page', label: '足せる習慣', view: 'habits', anchor: ANCHORS.habitPresets },
  settings: { type: 'page', label: '設定', view: 'settings', anchor: ANCHORS.settings },
  backup: { type: 'system', label: '書き出し・取り込み', view: 'settings', anchor: ANCHORS.backup },
  mealCheck: { type: 'question', label: '食事：始める前の確認', view: 'today', anchor: ANCHORS.meal },
  mealStop: { type: 'question', label: '食事：止めどきのサイン', view: 'today', anchor: ANCHORS.meal },
  monkCheck: { type: 'question', label: 'モンクモード：始める前の確認', view: 'today', anchor: ANCHORS.monk },
  weeklyQ: { type: 'question', label: '週次：管理者視点の問い', view: 'weekly', anchor: ANCHORS.weekly },
} as const satisfies Record<string, Destination>;

export interface TocCategory {
  id: string;
  label: string;
  icon: string;
  /** そのまとまりの既定の飛び先 */
  destinations: Destination[];
  /**
   * 説明の確からしさの既定。
   * **アプリ自身の仕組み（画面・記録の形・安全の問い）だけを 'verified' にする。**
   * 出典から来た主張は、こちらで一次資料を確かめていないので必ず 'needs_review'。
   */
  status: DescriptionStatus;
}

export const TOC_CATEGORIES: TocCategory[] = [
  { id: 'screen', label: '画面', icon: '📱', destinations: [], status: 'verified' },
  { id: 'step', label: 'ゴーストモードの7ステップ', icon: '👻', destinations: [D.habits, D.habitsList], status: 'needs_review' },
  { id: 'preset', label: '足せる習慣', icon: '➕', destinations: [D.presets, D.habitsList], status: 'needs_review' },
  { id: 'routine', label: '起きて最初のルーティン', icon: '🌅', destinations: [D.routine], status: 'needs_review' },
  { id: 'routineLength', label: 'ルーティンの長さ', icon: '⏱', destinations: [D.routine], status: 'verified' },
  { id: 'domain', label: '最高の体調の6領域', icon: '🌿', destinations: [D.condition], status: 'needs_review' },
  { id: 'framing', label: '体調の考え方', icon: '🔥', destinations: [D.condition], status: 'needs_review' },
  { id: 'meditationLength', label: '瞑想の長さ', icon: '🧘', destinations: [D.meditation], status: 'needs_review' },
  { id: 'meditationStage', label: '瞑想の効果の段階', icon: '📈', destinations: [D.meditation], status: 'needs_review' },
  { id: 'mealPlan', label: '食事の段階', icon: '🍚', destinations: [D.meal, D.mealCheck], status: 'needs_review' },
  { id: 'monkArea', label: 'モンクモードの3領域', icon: '🧘‍♂️', destinations: [D.monk], status: 'needs_review' },
  { id: 'snsRule', label: 'SNSの制限の仕方', icon: '📵', destinations: [D.monk], status: 'verified' },
  { id: 'sleepCriterion', label: '眠りの質の4条件', icon: '🌙', destinations: [D.sleepQuality, D.bedtime], status: 'needs_review' },
  { id: 'threeScope', label: '3のルール', icon: '📋', destinations: [D.threeDay, D.threeMonth], status: 'verified' },
  { id: 'weeklyAnswer', label: '週次の配分の答え', icon: '📓', destinations: [D.weeklyQ], status: 'verified' },
  { id: 'precheck', label: '始める前の確認', icon: '🩺', destinations: [D.mealCheck, D.monkCheck], status: 'verified' },
  { id: 'stopSign', label: '止めどきのサイン', icon: '🛑', destinations: [D.mealStop], status: 'verified' },
  { id: 'unverified', label: '裏が取れていない主張', icon: '⚠️', destinations: [], status: 'needs_review' },
  { id: 'conflict', label: '出典どうしの食い違い', icon: '⚖️', destinations: [D.monk, D.condition], status: 'needs_review' },
  { id: 'note', label: 'アプリの決まり', icon: '📌', destinations: [D.backup], status: 'verified' },
  { id: 'source', label: '出典', icon: '📚', destinations: [D.settings, D.backup], status: 'needs_review' },
  { id: 'user', label: '自分で足した言葉', icon: '✏️', destinations: [], status: 'needs_review' },
];

export const TOC_CATEGORY_MAP = Object.fromEntries(TOC_CATEGORIES.map((c) => [c.id, c]));

/**
 * アプリの決まりを表す注記。**本文は元データの定数をそのまま参照する**
 * （ここで書き写すと、片方だけ直した時に静かに食い違う）。
 * このファイルが持っているのは名前と読みだけ。
 */
const NOTE_ENTRIES: { id: string; title: string; reading: string; body: string; destinations: Destination[] }[] = [
  { id: 'wake-first', title: '起きて最初にやる', reading: 'おきてさいしょにやる', body: WAKE_FIRST_NOTE, destinations: [D.routine] },
  { id: 'water-on-waking', title: '起きたら水を飲む', reading: 'おきたらみずをのむ', body: WATER_ON_WAKING_NOTE, destinations: [D.routine] },
  { id: 'bedtime-mindset', title: '寝る前の言い換え', reading: 'ねるまえのいいかえ', body: BEDTIME_MINDSET_NOTE, destinations: [D.bedtime] },
  { id: 'monk-period', title: '66日は累計でよい', reading: 'ろくじゅうろくにちはるいけいでよい', body: MONK_PERIOD_NOTE, destinations: [D.cycle, D.monk] },
  { id: 'meal-precheck-notice', title: '食事：医師に相談すること', reading: 'しょくじいしにそうだんすること', body: PRECHECK_NOTICE, destinations: [D.mealCheck] },
  { id: 'monk-precheck-notice', title: '塩と運動：医師に相談すること', reading: 'しおとうんどういしにそうだんすること', body: MONK_PRECHECK_NOTICE, destinations: [D.monkCheck] },
  { id: 'inflammation-caution', title: '炎症は判定しない', reading: 'えんしょうははんていしない', body: FRAMING.inflammation.caution, destinations: [D.condition] },
  { id: 'food-guide', title: FOOD_GUIDE.title, reading: 'なにをたべるか', body: FOOD_GUIDE.body, destinations: [D.condition, D.meal] },
];

const SOURCES: KnowledgeSource[] = [MEDITATION_SOURCE, CONDITION_SOURCE, MEAL_SOURCE, MONK_SOURCE, ROUTINE_SOURCE];

/** 言い切っていない書き方が入っていたら、確かめようがないので needs_review に落とす */
const HEDGE = /※要確認|裏は取れて|争いのある|報告されている|紹介されている|とされる|とされます|言われて|個人差/;

function statusFor(category: string, text: string): DescriptionStatus {
  const base = TOC_CATEGORY_MAP[category]?.status ?? 'needs_review';
  if (base === 'verified' && HEDGE.test(text)) return 'needs_review';
  return base;
}

function firstLine(text: string, max = 64): string {
  const t = String(text || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function make(
  category: string,
  targetId: string,
  title: string,
  reading: string,
  description: string,
  extra: { aliases?: string[]; destinations?: Destination[]; sub?: string } = {},
): TocEntry {
  const cat = TOC_CATEGORY_MAP[category];
  return {
    id: `${category}-${targetId}`,
    category,
    title,
    reading,
    sub: extra.sub ?? firstLine(description),
    description: String(description || ''),
    descriptionStatus: statusFor(category, description),
    aliases: extra.aliases ? [...extra.aliases] : [],
    destinations: [...(extra.destinations ?? []), ...(cat?.destinations ?? [])],
    targetId,
  };
}

/**
 * 目次に載せる全項目を元データから導く。
 *
 * @param added   ユーザーが端末内で足した項目（候補から「追加する」を選んだもの）
 * @param removed 端末内で消した項目の id（候補から「削除する」を選んだもの）
 */
export function buildTocEntries(added: TocEntry[] = [], removed: string[] = []): TocEntry[] {
  const entries: TocEntry[] = [];

  for (const s of SCREENS) {
    entries.push(make('screen', s.id, s.label, s.reading, s.desc, {
      destinations: [{ type: 'page', label: `${s.label}をひらく`, view: s.id, anchor: s.anchor }],
    }));
  }

  for (const h of DEFAULT_HABIT_SEEDS) {
    entries.push(make('step', h.id, h.title, h.reading, [h.criterion, h.note].filter(Boolean).join('\n\n'), {
      aliases: h.aliases,
      sub: `ステップ${h.step}／${firstLine(h.criterion, 44)}`,
    }));
  }

  for (const p of HABIT_PRESETS) {
    entries.push(make('preset', p.id, p.title, p.reading, [p.criterion, p.note].filter(Boolean).join('\n\n'), {}));
  }

  for (const s of ROUTINE_STEPS) {
    const writes: Record<string, Destination> = {
      meditation: D.meditation, workout: D.monk, reading: D.monk, threeRules: D.threeDay,
    };
    entries.push(make('routine', s.id, s.title, s.reading, s.how, {
      aliases: s.aliases,
      destinations: s.writesTo ? [writes[s.writesTo]] : [],
      sub: `${s.icon} 60分版で${s.fullMinutes}分`,
    }));
  }

  for (const p of ROUTINE_PRESETS) {
    entries.push(make('routineLength', p.id, p.label, p.reading, p.note, {}));
  }

  for (const d of DOMAINS) {
    entries.push(make('domain', d.id, d.title, d.reading, [d.why, d.linkedTo].filter(Boolean).join('\n\n'), {
      aliases: d.aliases,
      sub: `${d.icon} ${firstLine(d.why, 44)}`,
    }));
  }

  entries.push(make('framing', 'civilization', FRAMING.civilization.title, 'ぶんめいびょう', FRAMING.civilization.body));
  entries.push(make('framing', 'inflammation', FRAMING.inflammation.title, 'えんしょう',
    `${FRAMING.inflammation.body}\n\n${FRAMING.inflammation.caution}`));

  for (const o of LENGTH_OPTIONS) {
    entries.push(make('meditationLength', String(o.minutes), o.label, '',
      [o.purpose, o.caution].filter(Boolean).join('\n\n'), {}));
  }

  for (const s of EFFECT_STAGES) {
    entries.push(make('meditationStage', s.id, s.title, s.reading,
      [`${s.fromDays}日目から：`, ...s.reported.map((r) => `・${r}`), s.note ?? ''].filter(Boolean).join('\n'), {}));
  }

  for (const p of PLANS) {
    entries.push(make('mealPlan', p.id, p.label, p.reading ?? '', [p.summary, p.caution].filter(Boolean).join('\n\n'), {
      aliases: p.aliases,
    }));
  }

  for (const a of MONK_AREAS) {
    entries.push(make('monkArea', a.id, a.title, a.reading, a.why, { aliases: a.aliases, sub: `${a.icon} ${firstLine(a.why, 44)}` }));
  }

  for (const r of SNS_RULES) {
    entries.push(make('snsRule', r.id, r.label, r.reading, r.detail, {}));
  }

  for (const c of SLEEP_CRITERIA) {
    entries.push(make('sleepCriterion', c.id, c.label, c.reading, c.hint, {}));
  }

  for (const s of SCOPES) {
    entries.push(make('threeScope', s.id, `${s.label}の3つ`, s.reading, s.lead, {
      destinations: s.id === 'month' ? [D.threeMonth] : [D.threeDay],
    }));
  }

  for (const o of MANAGER_ALLOCATION_OPTIONS) {
    entries.push(make('weeklyAnswer', o.id, o.label, o.reading, o.advice, {}));
  }

  for (const c of PRECHECKS) {
    entries.push(make('precheck', `meal-${c.id}`, c.label, c.reading, PRECHECK_NOTICE, { destinations: [D.mealCheck] }));
  }
  for (const c of MONK_PRECHECKS) {
    entries.push(make('precheck', `monk-${c.id}`, c.label, c.reading, MONK_PRECHECK_NOTICE, { destinations: [D.monkCheck] }));
  }

  for (const s of STOP_SIGNS) {
    entries.push(make('stopSign', s.id, s.label, s.reading,
      'このサインが出ている間は、段階を上げません。合計3回、または「食べ物のことばかり考えてしまう」「体重が減り続けている」は1回でも、いったん普通に食べることをすすめます。', {}));
  }

  const unverified = [
    ...UNVERIFIED_CLAIMS.map((c) => ({ ...c, group: 'meal', dest: D.meal })),
    ...MONK_UNVERIFIED.map((c) => ({ ...c, group: 'monk', dest: D.monk })),
    ...ROUTINE_UNVERIFIED.map((c) => ({ ...c, group: 'routine', dest: D.routine })),
  ];
  for (const c of unverified) {
    entries.push(make('unverified', `${c.group}-${c.id}`, c.short, c.reading, `${c.claim}\n\n${c.note}`, {
      destinations: [c.dest],
      sub: firstLine(c.claim, 52),
    }));
  }

  for (const c of CONFLICTS) {
    entries.push(make('conflict', c.id, c.topic, c.reading,
      `${c.a.source}：${c.a.says}\n\n${c.b.source}：${c.b.says}\n\nこのアプリの扱い：${c.handling}`, {}));
  }

  for (const n of NOTE_ENTRIES) {
    entries.push(make('note', n.id, n.title, n.reading, n.body, { destinations: n.destinations }));
  }

  for (const s of SOURCES) {
    entries.push(make('source', s.id, s.label, s.reading,
      [`どこから：${s.origin}`, `受け取った日：${s.receivedAt}`, s.caution ?? ''].filter(Boolean).join('\n\n'), {}));
  }

  const gone = new Set(removed);
  const merged = [...entries, ...added.map((e) => ({ ...e, userAdded: true }))].filter((e) => !gone.has(e.id));
  return disambiguate(merged);
}

/**
 * タイトルがぶつかった項目に、まとまりの名前を添えて見分けられるようにする。
 * 「瞑想」は習慣にも起きて最初のルーティンにもあるので、目次では別の項目として並ぶ。
 * **番号ではなくまとまりの名前を足す**（番号だとどちらが何か分からない）。
 */
function disambiguate(entries: TocEntry[]): TocEntry[] {
  const count = new Map<string, number>();
  for (const e of entries) count.set(e.title, (count.get(e.title) || 0) + 1);
  return entries.map((e) => {
    if ((count.get(e.title) || 0) < 2) return e;
    const label = TOC_CATEGORY_MAP[e.category]?.label || e.category;
    return { ...e, title: `${e.title}（${label}）`, aliases: [...e.aliases, e.title] };
  });
}

// ── 索引・検索 ────────────────────────────────────────

export { buildKanaIndex };

/** 「その他」行がこれを超えたら、読みの入れ忘れを疑う（開発モードで知らせる） */
export const OTHER_ROW_LIMIT = 24;

/** 読みの入れ忘れが増えていないか。開発モードでだけ知らせる（本番では黙る） */
export function warnOtherRow(entries: TocEntry[], limit = OTHER_ROW_LIMIT): string | null {
  const other = entries.filter((e) => readingInfo(e.title, e.reading).group === OTHER_GROUP);
  if (other.length <= limit) return null;
  return `目次の「その他」行が ${other.length} 件あります（目安 ${limit} 件）。`
    + `読み（reading）の入れ忘れかもしれません：${other.slice(0, 5).map((e) => e.title).join('・')} ほか`;
}

/** 別名・タイトル・読みのどれからでも引く。**別名で引いても正式なタイトルの項目を返す** */
export function resolveAlias(entries: TocEntry[], text: string): TocEntry | null {
  const q = foldKana(normalizeAlnum(text)).toLowerCase();
  if (!q) return null;
  for (const e of entries) if (foldKana(normalizeAlnum(e.title)).toLowerCase() === q) return e;
  for (const e of entries) {
    for (const a of e.aliases) if (foldKana(normalizeAlnum(a)).toLowerCase() === q) return e;
  }
  return null;
}

/** 目次の絞り込み（タイトル・読み・別名・説明のどれかに当たれば残す） */
export function searchEntries(entries: TocEntry[], query: string): TocEntry[] {
  const q = foldKana(normalizeAlnum(query)).toLowerCase();
  if (!q) return entries;
  return entries.filter((e) => {
    const hay = [e.title, e.reading, e.sub, e.description, ...e.aliases].join(' ');
    return foldKana(normalizeAlnum(hay)).toLowerCase().includes(q);
  });
}

/** すべての飛び先が anchors.ts に登録されているか（試験と開発モードのチェック用） */
export function unknownAnchors(entries: TocEntry[]): string[] {
  const known = new Set(ALL_ANCHORS);
  const bad = new Set<string>();
  for (const e of entries) for (const d of e.destinations) if (!known.has(d.anchor)) bad.add(d.anchor);
  return [...bad];
}

/** タイトルの重複（統合後の目次全体で禁止） */
export function duplicateTitles(entries: TocEntry[]): string[] {
  const seen = new Map<string, number>();
  for (const e of entries) seen.set(e.title, (seen.get(e.title) || 0) + 1);
  return [...seen.entries()].filter(([, n]) => n > 1).map(([t]) => t);
}
