import React, { useMemo, useState } from 'react';
import HackCard from './HackCard.jsx';
import { HACKS, popularTags, allSituations, hackOfTheDay, countByCategory } from '../data/hacks.js';
import { CATEGORIES, EFFORT_LABELS } from '../data/schema.js';
import { searchHacks, explainNoHits, suggestTerms, parseQuery } from '../lib/search.js';

const SHOW_STEP = 20; // 一度に出す件数（長い一覧を一気に描かない）

export default function Search({ query, setQuery, store, onOpen }) {
  const [categories, setCategories] = useState([]);
  const [effortMax, setEffortMax] = useState(3);
  const [shown, setShown] = useState(SHOW_STEP);

  const filters = useMemo(() => ({ categories, effortMax }), [categories, effortMax]);
  const results = useMemo(() => searchHacks(HACKS, query, filters), [query, filters]);
  const suggestions = useMemo(() => (query.trim() ? suggestTerms(HACKS, parseQuery(query).terms.slice(-1)[0] || '', 6) : []), [query]);
  const hint = useMemo(() => (query.trim() && results.length === 0 ? explainNoHits(HACKS, query, filters) : null), [query, results.length, filters]);
  const counts = useMemo(() => countByCategory(), []);
  const today = useMemo(() => hackOfTheDay(), []);
  const tags = useMemo(() => popularTags(HACKS, 18), []);
  const situations = useMemo(() => allSituations(HACKS).slice(0, 10), []);

  const run = (text) => {
    setQuery(text);
    setShown(SHOW_STEP);
    store.remember(text);
  };

  const toggleCategory = (id) => {
    setShown(SHOW_STEP);
    setCategories((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  };

  const visible = results.slice(0, shown);

  return (
    <div className="view">
      <div className="searchbar">
        <input
          type="search"
          value={query}
          placeholder="困りごとの言葉で（例：ねむれない／片づけ／先延ばし）"
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(SHOW_STEP);
          }}
          onBlur={() => store.remember(query)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
              store.remember(query);
            }
          }}
          aria-label="キーワードで探す"
        />
        {query ? (
          <button type="button" className="clear" onClick={() => setQuery('')} aria-label="消す">×</button>
        ) : null}
      </div>
      <p className="note small">
        空白で区切ると「両方を含むもの」／頭に <code>-</code> を付けるとその語を外します（例：<code>習慣 -スマホ</code>）。
      </p>

      {suggestions.length > 0 ? (
        <div className="tags">
          {suggestions.map((word) => (
            <button key={word} type="button" className="tag button" onClick={() => run(word)}>{word}</button>
          ))}
        </div>
      ) : null}

      <details className="filters">
        <summary>絞り込み{categories.length > 0 || effortMax < 3 ? '（使用中）' : ''}</summary>
        <div className="tags">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`tag button ${categories.includes(c.id) ? 'on' : ''}`}
              style={categories.includes(c.id) ? { background: c.color, color: '#fff', borderColor: c.color } : null}
              onClick={() => toggleCategory(c.id)}
            >
              {c.icon} {c.label}（{counts[c.id]}）
            </button>
          ))}
        </div>
        <div className="row">
          {[1, 2, 3].map((level) => (
            <button
              key={level}
              type="button"
              className={`pill ${effortMax === level ? 'on' : ''}`}
              onClick={() => {
                setEffortMax(level);
                setShown(SHOW_STEP);
              }}
            >
              {EFFORT_LABELS[level].icon} {level === 3 ? 'ぜんぶ' : `${EFFORT_LABELS[level].label}まで`}
            </button>
          ))}
        </div>
      </details>

      {!query.trim() ? (
        <>
          {today ? (
            <section className="today">
              <h3>🎲 今日の1つ</h3>
              <button type="button" className="today-card" onClick={() => onOpen(today.id)}>
                <strong>{today.title}</strong>
                <span>{today.summary}</span>
              </button>
              <p className="note small">日付から選んでいるので、同じ日なら何度開いても同じものが出ます。</p>
            </section>
          ) : null}

          {store.state.history.length > 0 ? (
            <section>
              <h3>さっき探した言葉</h3>
              <div className="tags">
                {store.state.history.map((h) => (
                  <button key={h.q} type="button" className="tag button" onClick={() => run(h.q)}>{h.q}</button>
                ))}
              </div>
              <button type="button" className="link" onClick={store.forgetHistory}>履歴を消す</button>
            </section>
          ) : null}

          <section>
            <h3>こういう時に</h3>
            <div className="tags">
              {situations.map((s) => (
                <button key={s.text} type="button" className="tag button" onClick={() => run(s.text)}>{s.text}</button>
              ))}
            </div>
          </section>

          <section>
            <h3>よく使われている言葉</h3>
            <div className="tags">
              {tags.map((t) => (
                <button key={t.tag} type="button" className="tag button" onClick={() => run(t.tag)}>
                  {t.tag}（{t.count}）
                </button>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <p className="count">
        {query.trim() ? `${results.length}件` : `ぜんぶで${results.length}件`}
        {categories.length > 0 || effortMax < 3 ? '（絞り込み中）' : ''}
      </p>

      {hint ? (
        <section className="hint">
          <h3>見つかりませんでした</h3>
          {hint.dropOne.length > 0 ? (
            <>
              <p>この語を外すと見つかります：</p>
              <div className="tags">
                {hint.dropOne.map((d) => (
                  <button
                    key={d.term}
                    type="button"
                    className="tag button"
                    onClick={() => run(parseQuery(query).terms.filter((t) => t !== d.term).join(' '))}
                  >
                    「{d.term}」を外す（{d.count}件）
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p>言葉を短くするか、別の言い方（例：「不眠」→「ねむれない」）で試してみてください。</p>
          )}
          <p className="note small">
            見つからないのは、まだ書いていないだけかもしれません。ここは「言い換え」で引ける形にしていますが、
            すべての言い方を持っているわけではありません。
          </p>
        </section>
      ) : null}

      <div className="list">
        {visible.map((row) => (
          <HackCard
            key={row.hack.id}
            hack={row.hack}
            query={query}
            usedSynonym={row.usedSynonym}
            onOpen={onOpen}
            favorite={store.favoriteSet.has(row.hack.id)}
            onToggleFavorite={store.toggleFavorite}
          />
        ))}
      </div>

      {results.length > visible.length ? (
        <button type="button" className="wide" onClick={() => setShown((n) => n + SHOW_STEP)}>
          もっと見る（残り{results.length - visible.length}件）
        </button>
      ) : null}
    </div>
  );
}
