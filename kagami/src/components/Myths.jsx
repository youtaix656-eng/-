import React, { useMemo, useState } from 'react';
import { MYTHS } from '../data/myths.js';
import { matchesLoose } from '../lib/personSearch.js';
import Finder from './Finder.jsx';
import { sourcesOf } from '../data/sources.js';
import { GLYPHS } from '../data/glyphs.js';
import { EyeSigil, Rule } from './Ornament.jsx';
import { useFocusJump } from './useFocusJump.js';

export default function Myths({ focus, anchor, onFocusDone }) {
  const [query, setQuery] = useState('');
  useFocusJump(anchor || (focus ? `toc-myth-${focus}` : ''), onFocusDone);

  const shown = useMemo(
    () =>
      query.trim()
        ? MYTHS.filter((m) =>
            matchesLoose([m.title, m.reading, m.claim, m.known, m.risk, m.instead].join(' '), query),
          )
        : MYTHS,
    [query],
  );

  return (
    <>
      <div className="head">
        <EyeSigil size={64} className="sigil" />
        <h1>当てにならない見抜き方</h1>
        <p>「相手の本音が読める」とされているもの。{MYTHS.length}件。</p>
      </div>
      <Rule mark={GLYPHS.cross} />

      <div className="note warn">
        このアプリでいちばん置いておきたいのがここです。
        <strong>見抜き方を信じると、何もしていない人を嘘つきだと決めつけてしまう。</strong>
        外れても外れたことに気づけないので、疑われた側には晴らす手立てがありません。
        相手を疑う道具を配らないために並べています。
      </div>

      <Finder
        label="見抜き方をさがす"
        value={query}
        onChange={setQuery}
        total={MYTHS.length}
        shown={shown.length}
        hint="「嘘」「目線」「表情」などで引けます。"
      />

      {shown.map((m) => (
        <div className="card" key={m.id} id={`toc-myth-${m.id}`}>
          <h3>
            {m.title} {m.check && <span className="badge">※要確認</span>}
          </h3>

          <h3>よく言われていること</h3>
          <p className="muted">{m.claim}</p>

          <h3>分かっていること</h3>
          <p>{m.known}</p>

          <h3>信じるとどうなるか</h3>
          <p>{m.risk}</p>

          <h3>代わりにできること</h3>
          <p>{m.instead}</p>

          <h3>出典</h3>
          {m.noSource ? (
            <p className="tiny">
              元になった研究を見つけられていません。<strong>見つからないこと自体が、この項目の中身です。</strong>
            </p>
          ) : (
            <ul className="tiny">
              {sourcesOf(m.sourceIds).map((s) => (
                <li key={s.id}>
                  {s.title}（{[s.author, s.year].filter(Boolean).join(', ')}）{s.check && ' ※要確認'}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </>
  );
}
