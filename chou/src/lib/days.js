// 1日の記録の作り方・直し方。
//
// 決めていること
//  1. **保存するのは入力だけ**。集計や判定の結果は保存しない
//     （あとでロジックを直しても、過去の記録を読み直せるため）。
//  2. お腹の段は id（文字列）で持つ。数値にすると、いつか平均を出したくなり、
//     平均を出した時点で点数になる（README 決まり2）。
//  3. 外から来たもの（取り込んだファイル）は必ず `normalizeDay` を通してから画面へ渡す。
//     項目が1つ欠けているだけで画面が落ちるのを防ぐ。

import {
  BELLY_BY_ID,
  LEVEL_BY_ID,
  EXERCISE_BY_ID,
  SLEEP_BY_ID,
  POSTURE_BY_ID,
  WATER_BY_ID,
  STOOL_MARKS,
  FLAG_MARK_IDS,
} from '../data/scales.js';
import { OTC_KINDS } from '../data/otcDrugs.js';
import { parseKey, timeOrder } from './dates.js';

const MARK_IDS = STOOL_MARKS.map((m) => m.id);
const OTC_IDS = OTC_KINDS.map((k) => k.id);
const NOTE_MAX = 2000; // 1日のひとことの上限（切ったことは画面に出す）
const FOOD_MAX = 500;

let seq = 0;
/** 端末内だけで使う id。乱数の重なりで記録が消えないよう連番も混ぜる */
export function newId(prefix = 'x') {
  seq += 1;
  return `${prefix}${Date.now().toString(36)}${seq.toString(36)}`;
}

export function emptyDay(date) {
  return {
    date,
    belly: null,
    pain: null,
    bloat: null,
    stress: null,
    exercise: null,
    sleep: null,
    posture: null,
    water: null,
    probiotic: false,
    otc: [],
    stools: [],
    meals: [],
    note: '',
    updatedAt: 0,
  };
}

function clampText(text, max) {
  const s = typeof text === 'string' ? text : '';
  return s.length > max ? s.slice(0, max) : s;
}

function normalizeStool(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const n = Number(raw.bristol);
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId('s'),
    at: typeof raw.at === 'string' ? raw.at : '',
    bristol: Number.isInteger(n) && n >= 1 && n <= 7 ? n : null,
    marks: Array.isArray(raw.marks) ? raw.marks.filter((m) => MARK_IDS.includes(m)) : [],
  };
}

function normalizeMeal(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const text = clampText(raw.text, FOOD_MAX).trim();
  if (!text) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId('m'),
    at: typeof raw.at === 'string' ? raw.at : '',
    text,
  };
}

/** 外から来た1日の記録を、画面が壊れない形にそろえる */
export function normalizeDay(raw) {
  if (!raw || typeof raw !== 'object' || !parseKey(raw.date)) return null;
  const day = emptyDay(raw.date);
  day.belly = BELLY_BY_ID[raw.belly] ? raw.belly : null;
  day.pain = LEVEL_BY_ID[raw.pain] ? raw.pain : null;
  day.bloat = LEVEL_BY_ID[raw.bloat] ? raw.bloat : null;
  day.stress = LEVEL_BY_ID[raw.stress] ? raw.stress : null;
  day.exercise = EXERCISE_BY_ID[raw.exercise] ? raw.exercise : null;
  day.sleep = SLEEP_BY_ID[raw.sleep] ? raw.sleep : null;
  day.posture = POSTURE_BY_ID[raw.posture] ? raw.posture : null;
  day.water = WATER_BY_ID[raw.water] ? raw.water : null;
  day.probiotic = raw.probiotic === true;
  day.otc = Array.isArray(raw.otc) ? raw.otc.filter((id) => OTC_IDS.includes(id)) : [];
  day.stools = (Array.isArray(raw.stools) ? raw.stools : [])
    .map(normalizeStool)
    .filter(Boolean)
    .sort((a, b) => timeOrder(a.at) - timeOrder(b.at));
  day.meals = (Array.isArray(raw.meals) ? raw.meals : [])
    .map(normalizeMeal)
    .filter(Boolean)
    .sort((a, b) => timeOrder(a.at) - timeOrder(b.at));
  day.note = clampText(raw.note, NOTE_MAX);
  day.updatedAt = Number(raw.updatedAt) || 0;
  return day;
}

export function normalizeDays(rawDays) {
  const out = {};
  if (!rawDays || typeof rawDays !== 'object') return out;
  for (const key of Object.keys(rawDays)) {
    const day = normalizeDay(rawDays[key]);
    if (day) out[day.date] = day;
  }
  return out;
}

/** 何か1つでも記録されているか（ここが「記録した日」の単一の定義） */
export function hasRecord(day) {
  if (!day) return false;
  return Boolean(
    day.belly ||
      (day.pain && day.pain !== 'none') ||
      (day.bloat && day.bloat !== 'none') ||
      (day.stress && day.stress !== 'none') ||
      (day.exercise && day.exercise !== 'none') ||
      day.sleep ||
      day.posture ||
      day.water ||
      day.probiotic ||
      day.otc.length ||
      day.stools.length ||
      day.meals.length ||
      (day.note && day.note.trim()),
  );
}

/** 記録した日のキーを古い順に */
export function recordedKeys(days) {
  return Object.keys(days)
    .filter((k) => hasRecord(days[k]))
    .sort();
}

/** 「受診の目安」に載っている印が付いているか（**判定ではない**。読める場所を出すためだけ） */
export function flagMarksOf(day) {
  if (!day) return [];
  const found = new Set();
  for (const stool of day.stools) {
    for (const mark of stool.marks) {
      if (FLAG_MARK_IDS.includes(mark)) found.add(mark);
    }
  }
  return [...found];
}

/**
 * 食べたもののメモを、数えられる形にざっくり割る。
 * **形態素解析は持たない**（外部依存を増やさない）ので、区切りは記号と空白だけ。
 * 拾えない書き方があることは画面にも書く（黙って0件を出さない）。
 */
export function splitFoods(text) {
  if (typeof text !== 'string') return [];
  const parts = text
    .split(/[、,，・/／\n\r\t 　]+/)
    .map((s) => s.trim().replace(/^[.。･]+|[.。･]+$/g, ''))
    .filter((s) => s.length >= 2 && s.length <= 20);
  return [...new Set(parts)];
}

/** その日に出てきた食べもの（1日の中で同じものが何度出ても1回と数える） */
export function foodsOfDay(day) {
  if (!day) return [];
  const found = new Set();
  for (const meal of day.meals) {
    for (const food of splitFoods(meal.text)) found.add(food);
  }
  return [...found];
}
