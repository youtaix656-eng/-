import React, { useMemo, useState } from 'react';
import {
  TOC_ENTRIES,
  TOC_CATEGORIES,
  TOC_CATEGORY_MAP,
  tocSections,
  filterToc,
} from '../data/toc.js';
import { GapSigil, Rule } from './Ornament.jsx';
import { GLYPHS } from '../data/glyphs.js';

export default function TableOfContents({ onGo }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');

  const entries = useMemo(() => filterToc(TOC_ENTRIES, { query, category }), [query, category]);
  // 五十音バーは**絞り込み結果の全体**から作る（枠外の行へ飛ばさないため）
  const sections = useMemo(() => tocSections(entries), [entries]);

  function jump(group) {
    const el = document.getElementById(`kana-${group}`);
    if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  return (
    <>
      <div className="head">
        <GapSigil size={64} className="sigil" />
        <h1>目次</h1>
        <p>{TOC_ENTRIES.length}項目。あ〜ん → A〜Z の読み順。</p>
      </div>
      <Rule mark={GLYPHS.lines} />

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="さがす（近づき方・型・同意・出典）"
      />

      <div className="chips">
        <button className={`chip ${category === '' ? 'on' : ''}`} onClick={() => setCategory('')}>
          すべて
        </button>
        {TOC_CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`chip ${category === c.id ? 'on' : ''}`}
            onClick={() => setCategory(category === c.id ? '' : c.id)}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      <div className="kana-bar">
        {sections.map((s) => (
          <button key={s.group} onClick={() => jump(s.group)}>
            {s.group}
          </button>
        ))}
      </div>

      {sections.length === 0 && <p className="muted">見つかりませんでした。</p>}

      {sections.map((s) => (
        <section key={s.group}>
          <div className="section-label" id={`kana-${s.group}`}>
            {s.group}
          </div>
          <ul className="list">
            {s.items.map((e) => (
              <li key={e.id}>
                <button className="item" onClick={() => onGo(e)}>
                  <span className="t">
                    {TOC_CATEGORY_MAP[e.category]?.icon} {e.title}
                  </span>
                  <span className="s">{e.sub}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
