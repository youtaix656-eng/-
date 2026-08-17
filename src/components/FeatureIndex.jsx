import { useMemo, useState } from 'react';
import featureRegistry from '../data/featureRegistry.js';

// 全機能一覧：featureRegistry.js を検索・カテゴリ絞り込みつきで一覧表示する。
// 「機能が多すぎて自分でも把握しきれない」を防ぐための、単一の正となる機能台帳。
export default function FeatureIndex({ onNavigate }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');

  const categories = useMemo(
    () => Array.from(new Set(featureRegistry.map((f) => f.category))),
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return featureRegistry.filter((f) => {
      if (category && f.category !== category) return false;
      if (!q) return true;
      const hay = [f.title, f.desc, ...(f.tags || [])].join(' ').toLowerCase();
      return hay.includes(q);
    });
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
      <h2 className="view-title">全機能一覧</h2>
      <p className="view-desc">
        このアプリの機能をすべて一覧できます。機能は都度更新されるので、迷ったらここで検索してください。
      </p>

      <div className="card audio-search">
        <div className="section-label" style={{ marginTop: 0 }}>🔍 検索・絞り込み</div>
        <div className="field" style={{ marginBottom: 10 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例）忘却、語呂合わせ、模試 など"
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

      <div className="inline-note" style={{ marginBottom: 10 }}>
        {filtered.length}件 / 全{featureRegistry.length}件
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="ico">🔍</div>
          <p>一致する機能が見つかりません。</p>
        </div>
      ) : (
        [...grouped.entries()].map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 16 }}>
            <div className="section-label" style={{ marginTop: 0 }}>{cat}</div>
            {items.map((f) => (
              <button
                key={f.id}
                className="list-item"
                style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 10 }}
                onClick={() => onNavigate?.(f.view)}
              >
                <span style={{ fontSize: 20 }}>{f.icon}</span>
                <span style={{ flex: 1 }}>
                  <span className="li-q">
                    {f.title}
                    {f.sub && <span className="inline-note"> （画面内の機能）</span>}
                  </span>
                  <div className="li-stat">{f.desc}</div>
                </span>
              </button>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
