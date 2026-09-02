import React from 'react';
import { SOURCES } from '../data/sources.js';
import { TACTICS } from '../data/tactics.js';
import { APPROACHES } from '../data/approach.js';
import { MYTHS } from '../data/myths.js';
import { CONSENT_POINTS } from '../data/consent.js';
import { useFocusJump } from './useFocusJump.js';
import { GapSigil, Rule } from './Ornament.jsx';
import { GLYPHS } from '../data/glyphs.js';

/** その出典を使っている項目（型・近づき方・当てにならないテクニック・同意） */
function usedBy(sourceId) {
  const names = [];
  for (const t of TACTICS) if (t.sourceIds.includes(sourceId)) names.push(t.name);
  for (const a of APPROACHES) if (a.sourceIds.includes(sourceId)) names.push(a.name);
  for (const m of MYTHS) if ((m.sourceIds || []).includes(sourceId)) names.push(m.title);
  for (const c of CONSENT_POINTS) if (c.sourceIds.includes(sourceId)) names.push(c.title);
  return names;
}

export default function Sources({ focus, onFocusDone }) {
  useFocusJump(focus ? `toc-source-${focus}` : '', onFocusDone);

  const research = SOURCES.filter((s) => s.research !== false);
  const notResearch = SOURCES.filter((s) => s.research === false);

  const card = (s) => {
    const used = usedBy(s.id);
    return (
      <div className="card" key={s.id} id={`toc-source-${s.id}`}>
        <h3>
          {s.tocTitle} {s.check && <span className="badge">※要確認</span>}
        </h3>
        <p className="muted">{s.title}</p>
        <p className="tiny">{[s.author, s.year, s.kind].filter(Boolean).join(' / ')}</p>
        <p>{s.note}</p>
        {used.length > 0 && <p className="tiny">この出典を使う項目：{used.join('、')}</p>}
      </div>
    );
  };

  return (
    <>
      <div className="head">
        <GapSigil size={64} className="sigil" />
        <h1>出典</h1>
        <p>{SOURCES.length}件。どこから来ている話かを辿れるようにしています。</p>
      </div>
      <Rule mark={GLYPHS.dagger} />

      <div className="note">
        <strong>URL を載せていません。</strong>その場で確かめられない状態でそれらしいリンクを書くと、
        「出典があるように見えて実は無い」という、いちばん質の悪い形になります。
        書名・発表者・年で辿れる形にしてあります。<strong>※要確認</strong>が付いているものは、
        こちらで確かめきれていないものです。
      </div>

      <h2>研究として確かめられたもの</h2>
      <Rule mark={GLYPHS.dagger} />
      {research.map(card)}

      <h2>研究ではないもの</h2>
      <Rule mark={GLYPHS.triangle} />
      <div className="note">
        経験として言われているだけのこと・このアプリが置いている決めごと・窓口の案内は、
        <strong>研究と分けています</strong>。混ぜて「研究によると」と書かないためです。
      </div>
      {notResearch.map(card)}
    </>
  );
}
