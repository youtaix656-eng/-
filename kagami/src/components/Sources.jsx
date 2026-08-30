import React, { useMemo, useState } from 'react';
import { SOURCES } from '../data/sources.js';
import { TACTICS } from '../data/tactics.js';
import { matchesLoose } from '../lib/personSearch.js';
import Finder from './Finder.jsx';
import { useFocusJump } from './useFocusJump.js';
import { EyeSigil, Rule } from './Ornament.jsx';
import { GLYPHS } from '../data/glyphs.js';

export default function Sources({ focus, anchor, onFocusDone, onGoTactic }) {
  const [query, setQuery] = useState('');
  useFocusJump(anchor || (focus ? `toc-source-${focus}` : ''), onFocusDone);

  const shown = useMemo(
    () =>
      query.trim()
        ? SOURCES.filter((x) =>
            matchesLoose(
              [x.tocTitle, x.title, x.author, x.year, x.kind, x.note].filter(Boolean).join(' '),
              query,
            ),
          )
        : SOURCES,
    [query],
  );

  return (
    <>
      <div className="head">
        <EyeSigil size={64} className="sigil" />
        <h1>出典</h1>
        <p>{SOURCES.length}件。どの型がどこから来ているかを辿れるようにしています。</p>
      </div>
      <Rule mark={GLYPHS.dagger} />

      <div className="note">
        <strong>URL を載せていません。</strong>その場で確かめられない状態でそれらしいリンクを書くと、
        「出典があるように見えて実は無い」という、いちばん質の悪い形になります。
        書名・発表者・年で辿れる形にしてあります。<strong>※要確認</strong>が付いているものは、こちらで確かめきれていないものです。
      </div>

      <Finder
        label="出典をさがす"
        value={query}
        onChange={setQuery}
        total={SOURCES.length}
        shown={shown.length}
        hint="書名・発表者・年で引けます。"
      />

      {shown.map((s) => {
        const used = TACTICS.filter((t) => t.sourceIds.includes(s.id));
        return (
          <div className="card" key={s.id} id={`toc-source-${s.id}`}>
            <h3>
              {s.tocTitle} {s.check && <span className="badge">※要確認</span>}
            </h3>
            <p className="muted">{s.title}</p>
            <p className="tiny">
              {[s.author, s.year, s.kind].filter(Boolean).join(' / ')}
            </p>
            <p>{s.note}</p>
            {used.length > 0 && (
              <div className="chips">
                <span className="tiny">この出典を使う型：</span>
                {used.map((t) => (
                  <button key={t.id} className="chip" onClick={() => onGoTactic && onGoTactic(t.id)}>
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
