import React from 'react';
import { SOURCES } from '../data/sources.js';
import { TACTICS } from '../data/tactics.js';
import { useFocusJump } from './useFocusJump.js';
import { EyeSigil, Rule } from './Ornament.jsx';
import { GLYPHS } from '../data/glyphs.js';

export default function Sources({ focus, anchor, onFocusDone }) {
  useFocusJump(anchor || (focus ? `toc-source-${focus}` : ''), onFocusDone);

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

      {SOURCES.map((s) => {
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
              <p className="tiny">この出典を使う型：{used.map((t) => t.name).join('、')}</p>
            )}
          </div>
        );
      })}
    </>
  );
}
