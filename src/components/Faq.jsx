import { useMemo, useState } from 'react';
import faq from '../data/faq.js';
import { searchFaq } from '../lib/faqSearch.js';

// 鍼灸国試アプリ Q&A（Home「全機能一覧」の下）。
// キーワード1語でも、悩みをそのまま文章で貼り付けても検索できるようにする（faqSearch.js参照）。
export default function Faq() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');

  const categories = useMemo(() => Array.from(new Set(faq.map((f) => f.category))), []);

  const filtered = useMemo(() => {
    const byQuery = searchFaq(faq, query);
    if (!category) return byQuery;
    return byQuery.filter((f) => f.category === category);
  }, [query, category]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const f of filtered) {
      if (!map.has(f.category)) map.set(f.category, []);
      map.get(f.category).push(f);
    }
    return map;
  }, [filtered]);

  return (
    <div className="view">
      <h2 className="view-title">鍼灸国試アプリ Q&A</h2>
      <p className="view-desc">
        使い方・学習の悩み・不具合など、よくある質問をまとめました。キーワード1語でも、
        悩みをそのまま文章で貼り付けても検索できます。
      </p>

      <div className="card audio-search">
        <div className="section-label" style={{ marginTop: 0 }}>🔍 キーワード・文章から検索</div>
        <div className="field" style={{ marginBottom: 10 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例）ログインが毎回出る／復習の間隔／機種変更 など"
          />
        </div>
        <div className="chip-row">
          <button className={`chip ${category === '' ? 'active' : ''}`} onClick={() => setCategory('')}>
            すべて
          </button>
          {categories.map((c) => (
            <button
              key={c}
              className={`chip ${category === c ? 'active' : ''}`}
              onClick={() => setCategory(c === category ? '' : c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="ico">🔍</div>
          <p>該当する質問が見つかりませんでした。言葉を変えて試してみてください。</p>
        </div>
      ) : (
        <>
          <p className="inline-note">{filtered.length}件</p>
          {[...grouped.entries()].map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div className="section-label">{cat}</div>
              {items.map((f) => (
                <details key={f.id} className="card" style={{ marginBottom: 8 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{f.question}</summary>
                  <p style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{f.answer}</p>
                </details>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
