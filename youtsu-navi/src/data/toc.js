// 目次（あ〜ん / A〜Z 索引）— アプリ内のすべての項目を1つの一覧に集める。
//
// 目次の項目は各データファイル（redFlags / patterns / precautions / licenses / sources）
// から自動生成する。**別に一覧を書き写さない**（二重管理＝食い違いの元）。
//
// 追加する時の約束:
//   - タイトル（tocTitle）は重複させない。重複は toc.test.mjs が検出して落とす。
//   - 漢字を含むなら reading（ひらがな）を必ずデータ側に書く。数字は自動で読みに変換される。
//   - 飛び先（view / tab / anchor）は実在すること。これもテストで検査する。

import { LOW_BACK_RED_FLAGS } from './redFlags.js';
import { LOW_BACK_PATTERNS } from './patterns.js';
import { PRECAUTIONS } from './precautions.js';
import { LICENSES, MODALITY_META, licensesForModality } from './licenses.js';
import { SOURCES } from './sources.js';
import { buildKanaIndex } from '../lib/yomi.js';

/** 目次のカテゴリ（表示順・色分けに使う） */
export const TOC_CATEGORIES = [
  { id: 'flag', label: 'レッドフラグ', icon: '🚩', tab: 'flags' },
  { id: 'pattern', label: '原因パターン', icon: '🧭', tab: 'patterns' },
  { id: 'care', label: '要配慮対象', icon: '🤲', tab: 'care' },
  { id: 'license', label: '資格', icon: '📜', tab: 'scope' },
  { id: 'modality', label: '施術手段', icon: '🖐', tab: 'scope' },
  { id: 'source', label: '根拠・出典', icon: '📚', tab: 'source' },
];

export const TOC_CATEGORY_MAP = Object.fromEntries(TOC_CATEGORIES.map((c) => [c.id, c]));

/** 目次に載せる全項目 */
export function buildTocEntries() {
  const entries = [];

  for (const f of LOW_BACK_RED_FLAGS) {
    entries.push({
      id: `flag-${f.id}`,
      category: 'flag',
      title: f.tocTitle || f.category,
      reading: f.reading || '',
      sub: f.suspect,
      severity: f.severity,
      anchor: `toc-flag-${f.id}`,
    });
  }

  for (const p of LOW_BACK_PATTERNS) {
    entries.push({
      id: `pattern-${p.id}`,
      category: 'pattern',
      title: p.tocTitle || p.name,
      reading: p.reading || '',
      sub: p.short,
      anchor: `toc-pattern-${p.id}`,
    });
  }

  for (const c of PRECAUTIONS) {
    entries.push({
      id: `care-${c.id}`,
      category: 'care',
      title: c.title,
      reading: c.reading || '',
      sub: `禁忌${c.contraindications.length}件・推奨${c.recommended.length}件`,
      anchor: `toc-care-${c.id}`,
    });
  }

  for (const l of LICENSES) {
    entries.push({
      id: `license-${l.id}`,
      category: 'license',
      title: l.name,
      reading: l.reading || '',
      sub: l.kind,
      anchor: `toc-license-${l.id}`,
    });
  }

  for (const [id, m] of Object.entries(MODALITY_META)) {
    const owners = licensesForModality(id);
    entries.push({
      id: `modality-${id}`,
      category: 'modality',
      title: m.tocTitle,
      reading: m.reading || '',
      sub: owners.length ? `${owners.length}資格の範囲内` : '該当資格なし',
      anchor: `toc-modality-${id}`,
    });
  }

  for (const s of SOURCES) {
    entries.push({
      id: `source-${s.id}`,
      category: 'source',
      title: s.tocTitle || s.title,
      reading: s.reading || '',
      sub: s.kind,
      anchor: `toc-source-${s.id}`,
    });
  }

  return entries;
}

export const TOC_ENTRIES = buildTocEntries();

/** 目次を あ〜ん / A〜Z のセクションに分ける（絞り込み後にも使う） */
export function tocSections(entries = TOC_ENTRIES) {
  return buildKanaIndex(entries);
}

/** 検索文字列での絞り込み（タイトル・読み・説明・カテゴリ名を対象） */
export function filterToc(entries, query = '', category = 'all') {
  const q = String(query).trim().toLowerCase();
  return entries.filter((e) => {
    if (category !== 'all' && e.category !== category) return false;
    if (!q) return true;
    const label = TOC_CATEGORY_MAP[e.category]?.label || '';
    return [e.title, e.reading, e.sub, label].filter(Boolean).some((t) => String(t).toLowerCase().includes(q));
  });
}

/** タイトルの重複（テスト・開発用。空配列なら健全） */
export function duplicateTitles(entries = TOC_ENTRIES) {
  const seen = new Map();
  for (const e of entries) seen.set(e.title, (seen.get(e.title) || 0) + 1);
  return [...seen.entries()].filter(([, n]) => n > 1).map(([title]) => title);
}
