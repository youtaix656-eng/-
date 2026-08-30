// 目次（索引）。会社にあるものを読みで引けるようにする。
//
// **目次は各データから自動生成する**（書き写さない）。
// 役職・ジャンル・道具・仕事の流れ・案件の型は data/ の定義から、
// AI社員は保存されている社員から作る。
//
// 共通ルール（CLAUDE.md「目次・索引の共通ルール」）：
//   並びは あ〜ん → A〜Z ／ 数字は読みで振り分け ／ 読みは明示（推定しない）／
//   タイトルは重複させない（テストで機械チェック）。

import { ROLES, roleById } from './roles.js';
import { allGenres } from './genres.js';
import { TOOLS } from './tools.js';
import { WORKFLOWS } from './workflows.js';
import { JOB_TEMPLATES } from './jobTemplates.js';
import { readingInfo, groupByBucket } from '../lib/yomi.js';

// 目次の分類。view は飛び先の画面、anchor は画面内で光らせる目印。
export const TOC_KINDS = [
  { id: 'employee', name: 'AI社員', glyph: '◉', order: 1 },
  { id: 'role', name: '役職', glyph: '☉', order: 2 },
  { id: 'genre', name: 'ジャンル', glyph: '◈', order: 3 },
  { id: 'workflow', name: '仕事の流れ', glyph: '⟳', order: 4 },
  { id: 'job', name: '案件の型', glyph: '¥', order: 5 },
  { id: 'tool', name: '道具', glyph: '⚒', order: 6 },
];

function entry({ id, kind, title, reading, sub, view, arg, anchor, employee = null, alias = '' }) {
  const info = readingInfo(title, reading);
  return {
    id,
    kind,
    title,
    sub: sub || '',
    alias, // カタカナ表記など、検索でも当たってほしい別表記
    employee, // 社員のとき、肖像を描くために本体を持つ
    reading: info.reading,
    bucket: info.bucket,
    readingSource: info.source,
    view,
    arg: arg ?? null,
    anchor: anchor || null,
  };
}

/**
 * 目次の全項目を作る。
 * @param {object} o
 * @param {object[]} o.employees   在籍しているAI社員
 * @param {object[]} o.customGenres ユーザーが足したジャンル
 */
let lastBuild = null;

export function buildToc({ employees = [], customGenres = [] } = {}) {
  // 新項目15：同じ社員・同じジャンルなら作り直さない。
  // 目次は画面を離れるたびに捨てられるので、ここで覚えておかないと
  // 戻るたびに86件ぶんの読み解析をやり直すことになる。
  if (lastBuild && lastBuild.employees === employees && lastBuild.customGenres === customGenres) {
    return lastBuild.result;
  }
  const out = [];

  // AI社員（在籍中のみ）
  for (const e of employees) {
    if (e.archivedAt) continue;
    const role = roleById(e.roleId);
    out.push(
      entry({
        id: `emp:${e.id}`,
        kind: 'employee',
        title: e.name,
        reading: e.reading,
        sub: `${e.title}${e.strength ? `・${e.strength}` : ''}${e.origin ? `・${e.origin}` : ''}`,
        alias: e.kana || '',
        employee: e,
        view: 'employee',
        arg: e.id,
      })
    );
  }

  // 役職
  for (const r of ROLES) {
    out.push(
      entry({
        id: `role:${r.id}`,
        kind: 'role',
        title: r.name,
        reading: r.reading,
        sub: r.summary,
        view: 'employees',
        arg: { roleId: r.id },
      })
    );
  }

  // ジャンル
  for (const g of allGenres(customGenres)) {
    out.push(
      entry({
        id: `genre:${g.id}`,
        kind: 'genre',
        title: g.name,
        reading: g.reading,
        sub: g.desc,
        view: 'employees',
        arg: { genreId: g.id },
      })
    );
  }

  // 仕事の流れ
  for (const w of WORKFLOWS) {
    out.push(
      entry({
        id: `wf:${w.id}`,
        kind: 'workflow',
        title: w.name,
        reading: w.reading,
        sub: w.desc,
        view: 'compose',
        arg: { workflowId: w.id },
      })
    );
  }

  // 案件の型
  for (const j of JOB_TEMPLATES) {
    out.push(
      entry({
        id: `job:${j.id}`,
        kind: 'job',
        title: j.name,
        reading: j.reading,
        sub: j.desc,
        view: 'deals',
        arg: { templateId: j.id },
        anchor: `job-${j.id}`,
      })
    );
  }

  // 道具
  for (const t of TOOLS) {
    out.push(
      entry({
        id: `tool:${t.id}`,
        kind: 'tool',
        title: t.name,
        reading: t.reading,
        sub: t.desc,
        view: 'connect',
        arg: { toolId: t.id },
        anchor: `tool-${t.id}`,
      })
    );
  }

  lastBuild = { employees, customGenres, result: out };
  return out;
}

// 新項目15：直前の絞り込みを1組だけ覚えておく。
//
// 目次は画面を離れると作り直されるので、useMemo では戻ってきた時に効かない。
// 「同じ元データ・同じ条件なら、前の結果をそのまま返す」だけの1件キャッシュ。
// **1件だけ**にしてあるのは、増やすと使わない結果を抱え続けることになるため。
let lastFilter = null;

/** 検索と分類の絞り込み。 */
export function filterToc(entries, { query = '', kind = null } = {}) {
  const q = String(query).trim().toLowerCase();
  if (
    lastFilter &&
    lastFilter.entries === entries &&
    lastFilter.q === q &&
    lastFilter.kind === kind
  ) {
    return lastFilter.result;
  }
  const result = entries.filter((e) => {
    if (kind && e.kind !== kind) return false;
    if (!q) return true;
    const hay = `${e.title} ${e.reading} ${e.alias || ''} ${e.sub}`.toLowerCase();
    return hay.includes(q);
  });
  lastFilter = { entries, q, kind, result };
  return result;
}

/** 枠（あ行〜わ行 → A-Z）ごとにまとめる。 */
export function tocSections(entries) {
  return groupByBucket(entries);
}

/** 分類ごとの件数（絞り込みチップの表示に使う）。 */
export function kindCounts(entries) {
  const map = new Map();
  for (const e of entries) map.set(e.kind, (map.get(e.kind) || 0) + 1);
  return TOC_KINDS.map((k) => ({ ...k, count: map.get(k.id) || 0 }));
}
