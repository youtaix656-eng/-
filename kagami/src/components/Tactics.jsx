import React, { useEffect, useMemo, useState } from 'react';
import { TACTICS, CATEGORIES, tacticsInCategory, akaNameOf } from '../data/tactics.js';
import { terms, matchesLoose, suggestTerms } from '../lib/personSearch.js';
import { useFocusJump } from './useFocusJump.js';
import TacticCard from './TacticCard.jsx';
import { EyeSigil, Rule } from './Ornament.jsx';
import { GLYPHS } from '../data/glyphs.js';

export default function Tactics({ focus, anchor, onFocusDone, ui = {} }) {
  // 画面を移っても、さがした語と絞り込み・開いたカードを捨てない
  const kept = ui.tactics || (ui.tactics = {});
  const [category, setCategory] = useState(() => kept.category || '');
  const [openId, setOpenId] = useState(() => kept.openId || '');
  const [query, setQuery] = useState(() => kept.query || '');
  useEffect(() => {
    kept.category = category;
    kept.openId = openId;
    kept.query = query;
  }, [kept, category, openId, query]);

  const isGroup = CATEGORIES.some((c) => c.id === focus);

  // 目次から飛んできたとき：まず開く／絞り込む（運ぶのは描き直しのあと＝useFocusJump）。
  // **絞り込みとさがした語は外す**——外さないと、飛び先のカードが画面に無くて着かない。
  useEffect(() => {
    if (!focus) return;
    setQuery('');
    if (isGroup) setCategory(focus);
    else {
      setCategory('');
      setOpenId(focus);
    }
  }, [focus, isGroup]);

  useFocusJump(anchor || (focus ? `toc-${isGroup ? 'group' : 'tactic'}-${focus}` : ''), onFocusDone);

  const words = useMemo(() => terms(query), [query]);
  const inCategory = category ? tacticsInCategory(category) : TACTICS;
  const hayOf = (t) =>
    [
      t.name, t.reading, t.summary, t.why, akaNameOf(t.id) || '',
      (t.aka || []).map((a) => `${a.name}${a.reading || ''}`).join(' '),
      (t.cues || []).join(' '),
      CATEGORIES.find((c) => c.id === t.category)?.label || '',
    ].join(' ');
  // ふだんの言い方でも引けるようにする（「せかす」で「急がせる」が出る）
  const matchHay = (t) => matchesLoose(hayOf(t), query);
  const shown = useMemo(() => {
    if (words.length === 0) return inCategory;
    return inCategory.filter(matchHay);
  }, [inCategory, words, query]);

  /** まとまりの件数も、さがしている間は**その結果の数**にする（全体のままだと食い違う） */
  const countIn = (catId) => {
    const list = tacticsInCategory(catId);
    if (words.length === 0) return list.length;
    return list.filter((t) => matchHay(t)).length;
  };

  // 0件のときに黙らない（近い語を出すだけ。勝手に検索し直さない）
  const nearby = useMemo(
    () =>
      words.length && shown.length === 0
        ? suggestTerms(query, TACTICS.map((t) => ({ label: t.name, hay: `${t.reading} ${t.name}` })))
        : [],
    [words, shown, query],
  );

  return (
    <>
      <div className="head">
        <EyeSigil size={64} className="sigil" />
        <h1>操作の型</h1>
        <p>
          {TACTICS.length}件。名前がつくと、その場で気づけるようになります。
        </p>
      </div>
      <Rule mark={GLYPHS.moonWane} />

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="型をさがす"
        onKeyDown={(e) => {
          if (e.key === 'Escape') setQuery('');
        }}
        placeholder="型をさがす（読み・別の呼び名・言い回しでも引けます。Escで消します）"
      />

      <div className="chips">
        <button className={`chip ${category === '' ? 'on' : ''}`} onClick={() => setCategory('')}>
          すべて（{TACTICS.length}）
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            id={`toc-group-${c.id}`}
            className={`chip ${category === c.id ? 'on' : ''}`}
            onClick={() => setCategory(category === c.id ? '' : c.id)}
          >
            {c.icon} {c.label}（{countIn(c.id)}）
          </button>
        ))}
      </div>

      {category && <div className="note">{CATEGORIES.find((c) => c.id === category).summary}</div>}

      {(words.length > 0 || category) && (
        <p className="tiny">
          {TACTICS.length}件のうち <strong>{shown.length}件</strong>を表示
          {(words.length > 0 || category) && (
            <button
              className="chip"
              style={{ marginLeft: 8 }}
              onClick={() => {
                setQuery('');
                setCategory('');
              }}
            >
              {GLYPHS.cross} しぼり込みを外す
            </button>
          )}
        </p>
      )}

      {shown.length === 0 && (
        <div className="card quiet">
          <p className="muted">「{query}」では見つかりませんでした。</p>
          {nearby.length > 0 && (
            <div className="chips">
              {nearby.map((n) => (
                <button key={n} className="chip" onClick={() => setQuery(n)}>
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {shown.map((t) => (
        <TacticCard
          key={t.id}
          id={`toc-tactic-${t.id}`}
          tactic={t}
          open={openId === t.id}
          onToggle={() => setOpenId(openId === t.id ? '' : t.id)}
        />
      ))}
    </>
  );
}
