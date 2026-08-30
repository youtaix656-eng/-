import React, { useEffect, useMemo, useState } from 'react';
import { TOC_ENTRIES, TOC_CATEGORIES, TOC_CATEGORY_MAP, tocSections, filterToc } from '../data/toc.js';
import { EyeSigil, Rule } from './Ornament.jsx';
import { GLYPHS } from '../data/glyphs.js';

export default function TableOfContents({ onGo, ui = {} }) {
  // 画面を移っても、さがした語と絞り込みを捨てない
  const kept = ui.toc || (ui.toc = {});
  const [query, setQuery] = useState(() => kept.query || '');
  const [category, setCategory] = useState(() => kept.category || '');
  useEffect(() => {
    kept.query = query;
    kept.category = category;
  }, [kept, query, category]);

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
        <EyeSigil size={64} className="sigil" />
        <h1>目次</h1>
        <p>
          {entries.length === TOC_ENTRIES.length
            ? `${TOC_ENTRIES.length}項目`
            : `${TOC_ENTRIES.length}項目のうち ${entries.length}件`}
          。あ〜ん → A〜Z の読み順。
        </p>
      </div>
      <Rule mark={GLYPHS.lines} />

      <input
        type="text"
        value={query}
        aria-label="目次をさがす"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setQuery('');
        }}
        placeholder="さがす（型・返し方・出典。Escで消します）"
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
