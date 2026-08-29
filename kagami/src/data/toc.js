// 目次（あ〜ん / A〜Z 索引）— アプリ内のすべての項目を1つの一覧に集める。
//
// **各データファイルから自動生成する。書き写さない**（二重管理＝食い違いの元）。
//
// 追加する時の約束（toc.test.mjs が機械チェックする）:
//   - タイトルは重複させない。
//   - 漢字を含むなら reading（ひらがな）をデータ側に必ず書く。**自動推定しない**。
//     読みが無ければ「その他」行に落ちて、入れ忘れが目に見えるようにする。
//   - 数字は読みで五十音へ振り分ける（yomi.js の autoReading）。
//   - 飛び先（view / anchor）は実在すること。

import { TACTICS, CATEGORIES } from './tactics.js';
import { REPLIES } from './replies.js';
import { HABITS } from './habits.js';
import { SOURCES } from './sources.js';
import { GLYPHS } from './glyphs.js';
import { buildKanaIndex } from '../lib/yomi.js';

/** 目次のカテゴリ（表示順・色分けに使う） */
export const TOC_CATEGORIES = [
  { id: 'tactic', label: '操作の型', icon: GLYPHS.moonWane, view: 'tactics' },
  { id: 'alias', label: '別の呼び名', icon: GLYPHS.pointer, view: 'tactics' },
  { id: 'group', label: '型のまとまり', icon: GLYPHS.star, view: 'tactics' },
  { id: 'reply', label: '返し方', icon: GLYPHS.circle, view: 'replies' },
  { id: 'habit', label: 'つけこまれやすい形', icon: GLYPHS.circlePlus, view: 'habits' },
  { id: 'source', label: '出典', icon: GLYPHS.dagger, view: 'sources' },
];

export const TOC_CATEGORY_MAP = Object.fromEntries(TOC_CATEGORIES.map((c) => [c.id, c]));

/** 目次に載せる全項目（各データから導く） */
export function buildTocEntries() {
  const entries = [];

  for (const t of TACTICS) {
    entries.push({
      id: `tactic-${t.id}`,
      category: 'tactic',
      title: t.name,
      reading: t.reading || '',
      sub: [CATEGORIES.find((c) => c.id === t.category)?.label, ...(t.aka || []).map((a) => a.name)]
        .filter(Boolean)
        .join('・'),
      view: 'tactics',
      anchor: `toc-tactic-${t.id}`,
      targetId: t.id,
    });
  }

  // 世に出回っている呼び名からも引けるようにする（索引の「→ 見よ」項目）。
  // **読みは aka に持たせる**（ここで推定しない）。
  for (const t of TACTICS) {
    for (const a of t.aka || []) {
      entries.push({
        id: `alias-${t.id}-${a.name}`,
        category: 'alias',
        title: a.name,
        reading: a.reading || '',
        sub: `→ ${t.name}`,
        view: 'tactics',
        anchor: `toc-tactic-${t.id}`,
        targetId: t.id,
      });
    }
  }

  for (const c of CATEGORIES) {
    entries.push({
      id: `group-${c.id}`,
      category: 'group',
      title: c.label,
      reading: c.reading || '',
      sub: `${TACTICS.filter((t) => t.category === c.id).length}件の型`,
      view: 'tactics',
      anchor: `toc-group-${c.id}`,
      targetId: c.id,
    });
  }

  for (const r of REPLIES) {
    entries.push({
      id: `reply-${r.id}`,
      category: 'reply',
      title: r.tocTitle,
      reading: r.reading || '',
      sub: r.summary,
      view: 'replies',
      anchor: `toc-reply-${r.id}`,
      targetId: r.id,
    });
  }

  for (const h of HABITS) {
    entries.push({
      id: `habit-${h.id}`,
      category: 'habit',
      title: h.title,
      reading: h.reading || '',
      sub: h.summary,
      view: 'habits',
      anchor: `toc-habit-${h.id}`,
      targetId: h.id,
    });
  }

  for (const s of SOURCES) {
    entries.push({
      id: `source-${s.id}`,
      category: 'source',
      title: s.tocTitle,
      reading: s.reading || '',
      sub: [s.author, s.year].filter(Boolean).join(' / '),
      view: 'sources',
      anchor: `toc-source-${s.id}`,
      targetId: s.id,
    });
  }

  return entries;
}

export const TOC_ENTRIES = buildTocEntries();

/** 読み順のセクション（あ〜ん → A〜Z → その他） */
export function tocSections(entries = TOC_ENTRIES) {
  return buildKanaIndex(entries);
}

/** 検索・カテゴリ絞り込み */
export function filterToc(entries, { query = '', category = '' } = {}) {
  const q = String(query).trim().toLowerCase();
  return entries.filter((e) => {
    if (category && e.category !== category) return false;
    if (!q) return true;
    return (
      e.title.toLowerCase().includes(q) ||
      String(e.reading || '').includes(q) ||
      String(e.sub || '').toLowerCase().includes(q)
    );
  });
}

/** 重複したタイトル（テストが空であることを確かめる） */
export function duplicateTitles(entries = TOC_ENTRIES) {
  const seen = new Map();
  for (const e of entries) seen.set(e.title, (seen.get(e.title) || 0) + 1);
  return [...seen.entries()].filter(([, n]) => n > 1).map(([title]) => title);
}
