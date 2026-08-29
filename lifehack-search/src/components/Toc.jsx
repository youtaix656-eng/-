import React, { useMemo, useState } from 'react';
import { tocSections } from '../data/toc.js';
import { CATEGORY_MAP } from '../data/schema.js';
import { searchHacks, normalize } from '../lib/search.js';
import { HACKS } from '../data/hacks.js';

/**
 * 目次（あ〜ん / A〜Z）。
 * **五十音の行バーは、絞り込んだ結果の全体から作る**（先頭だけから作ると、
 * 絞り込みで消えた行のボタンが残って押しても飛べなくなる）。
 */
export default function Toc({ onOpen, onSearch }) {
  const [filter, setFilter] = useState('');

  const sections = useMemo(() => {
    const all = tocSections();
    const needle = normalize(filter).trim();
    if (!needle) return all;
    return all
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => normalize(`${item.title}${item.reading}${item.sub}`).includes(needle)),
      }))
      .filter((section) => section.items.length > 0);
  }, [filter]);

  const total = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="view">
      <h2>目次</h2>
      <p className="note">読み（ひらがな）の順に、あ〜ん → A〜Z で並べています。</p>
      <div className="searchbar">
        <input
          type="search"
          value={filter}
          placeholder="目次の中を絞り込む"
          onChange={(e) => setFilter(e.target.value)}
          aria-label="目次を絞り込む"
        />
        {filter ? <button type="button" className="clear" onClick={() => setFilter('')} aria-label="消す">×</button> : null}
      </div>

      <div className="kana-bar">
        {sections.map((section) => (
          <a key={section.group} href={`#toc-${section.group}`}>{section.group}</a>
        ))}
      </div>
      <p className="count">{total}件</p>

      {sections.map((section) => (
        <section key={section.group} id={`toc-${section.group}`} className="toc-section">
          <h3>{section.group}</h3>
          <ul className="toc-list">
            {section.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (item.kind === 'category') {
                      const category = CATEGORY_MAP[item.category];
                      onSearch(category.label.split('・')[0]);
                    } else onOpen(item.id);
                  }}
                >
                  <span className="toc-title">{item.title}</span>
                  <span className="toc-sub">{item.sub}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {total === 0 ? (
        <p className="empty">
          その言葉は目次にありません。<button type="button" className="link" onClick={() => onSearch(filter)}>本文もふくめて探す</button>
          （本文には{searchHacks(HACKS, filter).length}件）
        </p>
      ) : null}
    </div>
  );
}
