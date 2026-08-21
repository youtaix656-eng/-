// 結果の共有・書き出し — 端末内で完結し、施術者自身の操作でのみ動く。
//
// 2種類のテキストを作り分ける:
//   1. お客様向け（homecareText）… セルフケアと受診の目安だけ。
//      既定では推定パターン名・％を含めない（診断と受け取られるのを避けるため）。
//   2. 施術者の控え（recordText）… 入力内容・トリアージ・候補・メモまで含む。
//
// バックアップ（JSON）は カルテのみを対象とし、設定や同意履歴は含めない。

import { triage } from './triage.js';
import { inferPatterns } from './inference.js';
import { summarize } from './tags.js';
import { precautionsFor } from '../data/precautions.js';
import { symptomById } from '../data/symptoms.js';

export const BACKUP_VERSION = 1;

export function formatDateTime(at) {
  const d = new Date(at);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function formatDate(at) {
  const d = new Date(at);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

/** 記録から判定をやり直す（保存しているのは入力＝タグなので、いつでも再現できる） */
export function analyze(record) {
  const symptom = symptomById(record.symptomId);
  const tags = record.tags || [];
  return {
    symptom,
    triage: triage(tags, symptom.redFlags),
    inference: inferPatterns(tags, symptom.patterns),
    precautions: precautionsFor(tags),
    rows: summarize(symptom, record.answers || {}),
  };
}

const CLIENT_FOOTER = [
  '※ このメモは施術者が施術の参考として作成したものです。診断ではありません。',
  '※ 体調に変化があった時や、痛みが強くなる時は施術者にご連絡ください。',
];

/**
 * お客様にお渡しするホームケアのメモ
 * @param {object} record
 * @param {{ includePatterns?: boolean }} options
 */
export function homecareText(record, options = {}) {
  const { includePatterns = false } = options;
  const { triage: tri, inference } = analyze(record);
  const lines = [];
  lines.push('【セルフケアのメモ】');
  lines.push(`${formatDate(record.at)}${record.clientLabel ? `　${record.clientLabel}` : ''}`);
  lines.push('');

  if (tri.level !== 'clear') {
    lines.push('■ まずご確認ください');
    lines.push(tri.levelInfo.message);
    for (const f of tri.flags) lines.push(`・${f.label}`);
    lines.push('');
  }

  const top = inference.candidates[0];
  if (includePatterns && top) {
    lines.push('■ 今回考えられること（参考）');
    lines.push(`・${top.pattern.name}`);
    lines.push('');
  } else if (top && top.matched.length) {
    lines.push('■ 今回みられた特徴');
    for (const m of top.matched.slice(0, 4)) lines.push(`・${m.label}`);
    lines.push('');
  }

  if (top) {
    lines.push('■ おうちでできること');
    for (const h of top.pattern.homecare || []) lines.push(`・${h}`);
    lines.push('');
    if ((top.pattern.avoid || []).length) {
      lines.push('■ しばらく避けたいこと');
      for (const a of top.pattern.avoid) lines.push(`・${a}`);
      lines.push('');
    }
  }

  lines.push('■ こんな時はすぐに受診してください');
  lines.push('・排尿や排便がしにくい、もれる');
  lines.push('・足の力が入らなくなってきた');
  lines.push('・じっとしていても痛い、夜に目が覚める');
  lines.push('・発熱、原因のわからない体重減少');
  lines.push('');
  lines.push(...CLIENT_FOOTER);
  return lines.join('\n');
}

/** 施術者の控え（カルテの書き出し） */
export function recordText(record, options = {}) {
  const { licenseName = '' } = options;
  const { triage: tri, inference, precautions, rows } = analyze(record);
  const lines = [];
  lines.push('【腰痛ナビ 施術記録】');
  lines.push(`日時：${formatDateTime(record.at)}`);
  if (record.clientLabel) lines.push(`表示名：${record.clientLabel}`);
  if (licenseName) lines.push(`資格：${licenseName}`);
  lines.push('');

  lines.push(`■ 安全トリアージ：${tri.levelInfo.label}`);
  if (tri.flags.length) {
    for (const f of tri.flags) lines.push(`・[${f.severity}] ${f.tocTitle || f.category}：${f.label}`);
  } else {
    lines.push('・該当なし');
  }
  lines.push('');

  lines.push('■ 推定パターン（目安。診断ではありません）');
  if (inference.candidates.length) {
    for (const c of inference.candidates) lines.push(`・${c.percent}%　${c.pattern.name}`);
  } else {
    lines.push('・絞り込めませんでした');
  }
  lines.push('');

  if (precautions.length) {
    lines.push('■ 要配慮');
    for (const p of precautions) lines.push(`・${p.title}`);
    lines.push('');
  }

  lines.push('■ 入力内容');
  for (const r of rows) lines.push(`・${r.label}：${r.text}`);
  lines.push('');

  if (record.memo) {
    lines.push('■ 施術内容・所見');
    lines.push(record.memo);
    lines.push('');
  }
  if (record.followUp) {
    lines.push('■ 次回へ');
    lines.push(record.followUp);
    lines.push('');
  }
  lines.push('※ 本記録は施術者の判断の補助として作成したものであり、診断ではありません。');
  return lines.join('\n');
}

/** カルテのバックアップ（JSON文字列） */
export function recordsToJson(records = []) {
  return JSON.stringify({ app: 'youtsu-navi', kind: 'records', version: BACKUP_VERSION, exportedAt: Date.now(), records }, null, 2);
}

/**
 * バックアップの読み込み。壊れたファイル・別アプリのファイルは受け付けない。
 * @returns {{ ok: boolean, records?: object[], error?: string }}
 */
export function parseRecordsJson(text) {
  let data;
  try {
    data = JSON.parse(String(text));
  } catch {
    return { ok: false, error: 'ファイルの形式が読み取れません（JSONではありません）。' };
  }
  if (!data || data.app !== 'youtsu-navi' || data.kind !== 'records') {
    return { ok: false, error: '腰痛ナビのカルテのバックアップではありません。' };
  }
  if (!Array.isArray(data.records)) {
    return { ok: false, error: 'カルテのデータが見つかりません。' };
  }
  const records = data.records.filter((r) => r && typeof r.id === 'string' && typeof r.at === 'number');
  if (records.length !== data.records.length) {
    return { ok: true, records, error: `${data.records.length - records.length}件は形式が合わず読み飛ばしました。` };
  }
  return { ok: true, records };
}

/** ファイル名（日付入り） */
export function backupFileName(at) {
  const d = new Date(at);
  const p = (n) => String(n).padStart(2, '0');
  return `youtsu-navi-karte-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.json`;
}
