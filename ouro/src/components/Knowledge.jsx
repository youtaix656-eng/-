// 知識ベース。会社の資産の一覧・検索。

import { useEffect, useMemo, useState } from 'react';
import { Card, Row, SectionTitle, Empty, Stat } from './ui.jsx';
import { searchKnowledge, CATEGORIES, tagCounts, verifiedRate, ORIGINS } from '../lib/knowledge.js';
import { relTime } from '../lib/format.js';

export default function KnowledgeView({ store, go }) {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState(null);
  const [tag, setTag] = useState(null);
  const [origin, setOrigin] = useState(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [limit, setLimit] = useState(80); // 項目19：頭打ちではなく段階的に増やす

  const list = useMemo(
    () => searchKnowledge(store.knowledge, q, { category, tag, origin, verifiedOnly }),
    [store.knowledge, q, category, tag, origin, verifiedOnly]
  );
  const tags = useMemo(() => tagCounts(store.knowledge).slice(0, 14), [store.knowledge]);

  // 絞り込みを変えたら表示件数を最初に戻す
  useEffect(() => {
    setLimit(80);
  }, [q, category, tag, origin, verifiedOnly]);

  return (
    <div className="screen fade-in">
      <div className="stats" style={{ marginBottom: 12 }}>
        <Stat value={store.knowledge.length} label="知識" />
        <Stat value={store.sources.length} label="出典" />
        <Stat value={`${verifiedRate(store.knowledge)}%`} label="検証済み" />
      </div>

      <input
        className="input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="⌕ 知識を検索（タイトル・本文・タグ）"
        style={{ marginBottom: 10 }}
      />

      <div className="chips" style={{ marginBottom: 8 }}>
        <button type="button" className={`chip ${!category ? 'on' : ''}`} onClick={() => setCategory(null)}>
          すべて
        </button>
        {CATEGORIES.map((c) => {
          const n = store.knowledge.filter((k) => k.category === c).length;
          if (!n) return null;
          return (
            <button
              key={c}
              type="button"
              className={`chip ${category === c ? 'on' : ''}`}
              onClick={() => setCategory(category === c ? null : c)}
            >
              {c} {n}
            </button>
          );
        })}
      </div>

      <div className="chips" style={{ marginBottom: 8 }}>
        {Object.entries(ORIGINS).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`chip ${origin === id ? 'on' : ''}`}
            onClick={() => setOrigin(origin === id ? null : id)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className={`chip ${verifiedOnly ? 'on' : ''}`}
          onClick={() => setVerifiedOnly(!verifiedOnly)}
        >
          ✓ 検証済みのみ
        </button>
      </div>

      {tags.length > 0 && (
        <div className="chips" style={{ marginBottom: 12 }}>
          {tags.map((t) => (
            <button
              key={t.tag}
              type="button"
              className={`chip ${tag === t.tag ? 'on' : ''}`}
              onClick={() => setTag(tag === t.tag ? null : t.tag)}
            >
              #{t.tag} {t.count}
            </button>
          ))}
        </div>
      )}

      <button type="button" className="btn block" onClick={() => go('ingest')} style={{ marginBottom: 14 }}>
        ⇩ 情報を追加する（Web・YouTube・PDF・メモ）
      </button>

      <SectionTitle>
        {list.length}件{list.length > limit ? `（うち${limit}件を表示中）` : ''}
      </SectionTitle>
      {list.length ? (
        list.slice(0, limit).map((k) => (
          <Row
            key={k.id}
            glyph={k.verifiedAt ? '✓' : originGlyph(k.origin)}
            title={k.title}
            sub={`${k.category}・${ORIGINS[k.origin]}・${relTime(k.createdAt)}${
              k.usedCount ? `・${k.usedCount}回使用` : ''
            }`}
            onClick={() => go('knowledgeDetail', k.id)}
          />
        ))
      ) : (
        <Empty>
          該当する知識がありません。
          <br />
          仕事を1つ終えるか、情報を取り込むと増えます。
        </Empty>
      )}

      {list.length > limit && (
        <button type="button" className="btn block" onClick={() => setLimit((n) => n + 120)}>
          もっと見る（残り{list.length - limit}件）
        </button>
      )}

      {store.knowledge.length === 0 && (
        <Card glyph="◉" title="知識ベースとは">
          <p className="muted" style={{ marginBottom: 0 }}>
            AI社員が仕事をするたびに、成果がここに残ります。
            AIのモデルは将来入れ替わりますが、ここに積んだ知識は残り続けます。
            これがOuroで一番価値のある部分です。
          </p>
        </Card>
      )}
    </div>
  );
}

function originGlyph(origin) {
  return { ai: '✳', external: '⌕', user: '✍' }[origin] || '◉';
}
