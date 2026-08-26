// CSV の書き出し・取り込み（新規）。会社の Excel との橋渡し。
//
// **数式にさせないこと。** 表計算ソフトは、セルの先頭が = + - @ タブ 改行 だと
// 中身を数式として解釈する。依頼文や案件名は人が自由に書くので、
// そのまま出すと開いた人の端末で意図しない計算・外部参照が走り得る
// （CSV injection）。先頭に ' を足して、ただの文字として開かせる。
//
// **BOM を付ける。** 付けないと Excel が Shift_JIS として開き、日本語が化ける。
//
// 外部ライブラリは使わない（Ouro は外部ランタイム依存なし）。

const RISKY = /^[=+\-@\t\r]/;

/** 1セルぶんを安全な形にする。 */
export function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  s = s.replace(/\r\n/g, '\n');
  if (RISKY.test(s)) s = `'${s}`; // 数式として解釈させない
  if (/[",\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * 表を CSV にする。
 * @param {{key:string, name:string}[]} columns
 * @param {object[]} rows
 */
export function toCsv(columns, rows = []) {
  const head = columns.map((c) => csvCell(c.name)).join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(','));
  return [head, ...body].join('\r\n');
}

/** Excel でそのまま開ける形（BOM 付き）。 */
export function csvFile(columns, rows) {
  return `﻿${toCsv(columns, rows)}`;
}

/** CSV を行 × セルに分解する（引用符・改行つきセルに対応）。 */
export function parseCsv(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
}

/** 1行目を見出しとして、オブジェクトの配列にする。 */
export function csvToObjects(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => String(h).replace(/^'/, '').trim());
  return rows.slice(1).map((r) => {
    const o = {};
    head.forEach((h, i) => {
      o[h] = String(r[i] === undefined ? '' : r[i]).replace(/^'/, '');
    });
    return o;
  });
}
