import React, { useMemo, useRef, useState } from 'react';
import { TOC_ENTRIES, TOC_CATEGORIES, TOC_CATEGORY_MAP, filterToc, tocSections } from '../data/toc.js';
import { GROUP_ORDER } from '../lib/yomi.js';

/**
 * 目次 — アプリ内の全項目を あ〜ん / A〜Z で引ける一覧。
 * 数字を含む項目は読み方で振り分ける（例「20歳未満の方」→ にじゅう… → な行）。
 * 項目をタップすると資料画面の該当箇所へ飛ぶ。
 */
export default function TableOfContents({ go }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const sectionRefs = useRef({});

  const entries = useMemo(() => filterToc(TOC_ENTRIES, query, category), [query, category]);
  const sections = useMemo(() => tocSections(entries), [entries]);
  const available = useMemo(() => new Set(sections.map((s) => s.group)), [sections]);

  const jumpTo = (group) => {
    const el = sectionRefs.current[group];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const open = (entry) => {
    const tab = TOC_CATEGORY_MAP[entry.category].tab;
    go('ref', { tab, anchor: entry.anchor });
  };

  return (
    <div className="page">
      <div className="card">
        <h2>📖 目次</h2>
        <p className="muted small">
          読み方の五十音（あ〜ん）とアルファベット（A〜Z）で並べています。項目をタップすると、その内容へ移動します。
        </p>
        <input
          type="search"
          className="search"
          value={query}
          placeholder="キーワードで探す（例：しびれ、妊娠、はり）"
          onChange={(e) => setQuery(e.target.value)}
          aria-label="目次を検索"
        />
        <div className="chips">
          <button
            type="button"
            className={`chip-btn${category === 'all' ? ' on' : ''}`}
            aria-pressed={category === 'all'}
            onClick={() => setCategory('all')}
          >
            すべて（{TOC_ENTRIES.length}）
          </button>
          {TOC_CATEGORIES.map((c) => {
            const n = TOC_ENTRIES.filter((e) => e.category === c.id).length;
            return (
              <button
                key={c.id}
                type="button"
                className={`chip-btn${category === c.id ? ' on' : ''}`}
                aria-pressed={category === c.id}
                onClick={() => setCategory(c.id)}
              >
                {c.icon} {c.label}（{n}）
              </button>
            );
          })}
        </div>
      </div>

      {/* あ〜ん / A〜Z のジャンプバー */}
      <div className="jumpbar" aria-label="五十音・アルファベットで移動">
        {GROUP_ORDER.map((g) => (
          <button
            key={g}
            type="button"
            className="jump"
            disabled={!available.has(g)}
            onClick={() => jumpTo(g)}
          >
            {g}
          </button>
        ))}
      </div>

      {sections.length === 0 && (
        <div className="card">
          <p className="muted">該当する項目がありません。検索語を短くするか、カテゴリを「すべて」に戻してください。</p>
        </div>
      )}

      {sections.map((section) => (
        <section
          key={section.group}
          className="toc-section"
          ref={(el) => {
            sectionRefs.current[section.group] = el;
          }}
        >
          <h3 className="toc-head">
            {section.group}
            <span>{section.items.length}件</span>
          </h3>
          <div className="toc-list">
            {section.items.map((entry) => (
              <button key={entry.id} type="button" className="toc-item" onClick={() => open(entry)}>
                <span className="toc-icon" aria-hidden="true">
                  {TOC_CATEGORY_MAP[entry.category].icon}
                </span>
                <span className="toc-text">
                  <span className="toc-title">{entry.title}</span>
                  <span className="toc-sub">
                    {TOC_CATEGORY_MAP[entry.category].label}
                    {entry.sub ? `／${entry.sub}` : ''}
                  </span>
                </span>
                <span aria-hidden="true" className="toc-arrow">›</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
