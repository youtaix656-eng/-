import React, { useMemo, useState } from 'react';
import { buildTocItems, TOC_CATEGORIES, TOC_CATEGORY_MAP } from '../data/toc.js';
import { buildKanaIndex, OTHER_GROUP } from '../lib/yomi.js';

// 目次（あ〜ん / A〜Z）。共通ルール:
//  ・並びは読み（ひらがな）で あ〜ん → A〜Z → その他
//  ・数字も読み方で振り分ける（yomi.js が面倒を見る）
//  ・**五十音バーは「絞り込んだ結果の全体」から作る**（表示を打ち切っても、
//    バーに出ている行へは必ず飛べるようにするため）
//  ・文字は大きめ・タップで飛べる

const CAP = 120; // 一度に描く件数の上限（長い一覧を無条件に全件描かない）

export default function TableOfContents({ go }) {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('all');
  const [limit, setLimit] = useState(CAP);

  const all = useMemo(() => buildTocItems(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((i) => {
      if (cat !== 'all' && i.category !== cat) return false;
      if (!q) return true;
      return `${i.title}${i.reading || ''}${i.sub || ''}`.toLowerCase().includes(q);
    });
  }, [all, query, cat]);

  // バーは絞り込み結果の全体から作る（表示の打ち切りとは別）
  const sections = useMemo(() => buildKanaIndex(filtered), [filtered]);

  const shown = useMemo(() => {
    let left = limit;
    const out = [];
    for (const s of sections) {
      if (left <= 0) break;
      const items = s.items.slice(0, left);
      left -= items.length;
      out.push({ ...s, items });
    }
    return out;
  }, [sections, limit]);

  const total = filtered.length;
  const drawn = shown.reduce((n, s) => n + s.items.length, 0);

  const jump = (group) => {
    // 枠外へ飛ぶ時は、先に枠を伸ばしてから飛ぶ（伸ばさないと飛び先が無い）
    const index = sections.findIndex((s) => s.group === group);
    const upto = sections.slice(0, index + 1).reduce((n, s) => n + s.items.length, 0);
    if (upto > limit) setLimit(upto);
    setTimeout(() => {
      const el = document.getElementById(`toc-${group}`);
      if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 0);
  };

  return (
    <div>
      <h2>📖 目次</h2>
      <p className="muted">
        資格試験・科目・勉強法・時期・変換の角度・認知特性を、読み（ひらがな）の順に並べています。
      </p>

      <label className="field">
        <span>さがす</span>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(CAP);
          }}
          placeholder="言葉の一部を入れる"
        />
      </label>

      <div className="chips">
        <button type="button" className={`chip ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>
          すべて
        </button>
        {TOC_CATEGORIES.map((c) => (
          <button key={c.id} type="button" className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      <div className="kana-bar">
        {sections.map((s) => (
          <button key={s.group} type="button" className="chip" onClick={() => jump(s.group)}>
            {s.group}
          </button>
        ))}
      </div>

      <p className="muted">
        {total}件中 {drawn}件を表示
        {sections.some((s) => s.group === OTHER_GROUP) && '　※「その他」は読みが入っていない項目です'}
      </p>

      {shown.map((s) => (
        <section key={s.group} className="toc-section" id={`toc-${s.group}`}>
          <h3>{s.group}</h3>
          {s.items.map((item) => (
            <button
              key={`${item.category}-${item.title}`}
              type="button"
              className="toc-item"
              onClick={() => go(item.view, { anchor: item.anchor, category: item.category })}
            >
              <span className="t">
                {TOC_CATEGORY_MAP[item.category]?.icon} {item.title}
              </span>
              {item.sub && <span className="s">{item.sub}</span>}
            </button>
          ))}
        </section>
      ))}

      {drawn < total && (
        <div className="btn-row">
          <button type="button" onClick={() => setLimit((n) => n + CAP)}>
            さらに {Math.min(CAP, total - drawn)}件を表示
          </button>
        </div>
      )}
    </div>
  );
}
