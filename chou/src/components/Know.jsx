import React, { useMemo, useState } from 'react';
import { KNOW_ITEMS, groupItems, KNOW_NOTE } from '../data/knowMenu.js';
import { foldKana } from '../lib/yomi.js';
import { useFocusJump } from './useFocusJump.js';
import Finder from './Finder.jsx';

// しらべる。読み物と道具の入口をまとめた画面。
//
// **一覧は `data/knowMenu.js` から毎回導く**（画面に if を足さない）。
// 1件足せば、まとまりもさがす対象も自動で増える。
//
// 以前は見出しの無い24件の平らな一覧で、設定へ行くのに3画面ぶんスクロールしていた。
//
// **外のリンクの URL はここに置く**（`src/data` は URL を持たない決まりのため）。
// 地図アプリを開くだけで、**このアプリは現在地を受け取りも保存もしない**（決まり6）。

const LINKS = {
  toilet: 'https://www.google.com/maps/search/?api=1&query=公衆トイレ',
};

/** さがす。**ひらがなでも引ける**（読みを手で持っているのでそれと突き合わせる） */
function matches(item, query) {
  const q = String(query || '').trim();
  if (!q) return true;
  const kana = foldKana(q);
  const hay = [item.title, item.reading, item.desc, ...(item.keywords || [])];
  return hay.some((text) => {
    const s = String(text || '');
    return s.includes(q) || (kana && foldKana(s).includes(kana));
  });
}

export default function Know({ onGo, focus, onFocusDone }) {
  useFocusJump(focus, onFocusDone);
  const [q, setQ] = useState('');
  const hits = useMemo(() => KNOW_ITEMS.filter((item) => matches(item, q)), [q]);
  const groups = useMemo(() => groupItems(hits), [hits]);

  return (
    <div className="view">
      <header className="view-head">
        <h1>しらべる</h1>
      </header>

      <Finder
        id="know-find"
        label="読み物・道具をさがす（ひらがなでも引けます）"
        value={q}
        onChange={setQ}
        count={hits.length}
        total={KNOW_ITEMS.length}
        hint={`${KNOW_ITEMS.length}件を4つに分けて並べています。`}
      />

      {groups.length === 0 ? (
        <p className="muted">
          「{q}」に当たるものはありませんでした。目次からもさがせます。
        </p>
      ) : (
        groups.map((group) => (
          <section className="block" key={group.id} id={`know-${group.id}`}>
            <div className="block-head">
              <h2>{group.label}</h2>
            </div>
            {group.note && <p className="muted small">{group.note}</p>}
            <ul className="menu" id={`know-menu-${group.id}`}>
              {group.items.map((item) => (
                <li key={item.id}>
                  {item.link ? (
                    <a className="menu-link" href={LINKS[item.link]} target="_blank" rel="noreferrer noopener">
                      <strong>{item.title}</strong>
                      <span className="muted small">{item.desc}</span>
                    </a>
                  ) : (
                    <button type="button" onClick={() => onGo(item.view, item.targetId)}>
                      <strong>{item.title}</strong>
                      <span className="muted small">{item.desc}</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <div className="notice">
        <p>{KNOW_NOTE}</p>
      </div>
    </div>
  );
}
