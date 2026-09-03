// CSV で書き出す（提案28）。
//
// 決めていること
//  - **セルを数式にさせない**——先頭が `= + - @` の値には `'` を足す
//    （表計算ソフトが数式として実行してしまうため。このリポジトリの他アプリと同じ線）。
//  - **BOM を付ける**（付けないと Excel で文字化けする）。
//  - **判定を書き出さない。** 出すのは入力（段の名前・回数・書いた文）だけ
//    （決まり7。保存するのも入力だけ）。
//  - **平均も点数も列に作らない**（決まり2）。

import { BELLY_BY_ID, LEVEL_BY_ID, EXERCISE_BY_ID, SLEEP_BY_ID, POSTURE_BY_ID, WATER_BY_ID, STOOL_MARKS } from '../data/scales.js';
import { OTC_KINDS } from '../data/otcDrugs.js';
import { hasRecord } from './days.js';

const MARK_BY_ID = Object.fromEntries(STOOL_MARKS.map((m) => [m.id, m.label]));
const OTC_BY_ID = Object.fromEntries(OTC_KINDS.map((k) => [k.id, k.name]));

/** 数式にさせない・引用符を閉じる */
export function cell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const HEADERS = [
  '日付',
  'お腹の調子',
  '痛み',
  '張り・ガス',
  'ストレス',
  '眠れたか',
  '体を動かした',
  '姿勢',
  '水分',
  '整腸剤',
  '使った市販薬',
  'お通じの回数',
  'ブリストル',
  '気になったこと',
  'たべたもの',
  'ひとこと',
];

const labelOf = (map, id) => (id && map[id] ? map[id].label : '');

function rowOf(key, day) {
  return [
    key,
    labelOf(BELLY_BY_ID, day.belly),
    labelOf(LEVEL_BY_ID, day.pain),
    labelOf(LEVEL_BY_ID, day.bloat),
    labelOf(LEVEL_BY_ID, day.stress),
    labelOf(SLEEP_BY_ID, day.sleep),
    labelOf(EXERCISE_BY_ID, day.exercise),
    labelOf(POSTURE_BY_ID, day.posture),
    labelOf(WATER_BY_ID, day.water),
    day.probiotic ? '飲んだ' : '',
    day.otc.map((id) => OTC_BY_ID[id] || id).join(' / '),
    day.stools.length ? String(day.stools.length) : '',
    day.stools.map((s) => (s.bristol ? String(s.bristol) : '-')).join(' / '),
    [...new Set(day.stools.flatMap((s) => s.marks))].map((m) => MARK_BY_ID[m] || m).join(' / '),
    day.meals.map((m) => m.text).join(' / '),
    day.note,
  ];
}

/** 記録した日だけを古い順に。**空の日を行にしない**（表が読めなくなる） */
export function daysToCsv(days, keys) {
  const lines = [HEADERS.map(cell).join(',')];
  for (const key of keys) {
    const day = (days || {})[key];
    if (!hasRecord(day)) continue;
    lines.push(rowOf(key, day).map(cell).join(','));
  }
  return `﻿${lines.join('\r\n')}\r\n`;
}

export function csvFilename(keys) {
  const from = keys.length > 0 ? keys[0] : '';
  const to = keys.length > 0 ? keys[keys.length - 1] : '';
  return `chou-${from}_${to}.csv`;
}

export const CSV_NOTE =
  '表計算ソフトで開ける形です。入っているのは書いたものだけで、'
  + 'アプリの判定や平均は入りません（そもそも持っていません）。'
  + '記録がそのまま入るので、置き場所に気をつけてください。';
