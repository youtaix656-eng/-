import React, { useEffect, useState } from 'react';
import { TACTICS, CATEGORIES, tacticsInCategory } from '../data/tactics.js';
import { useFocusJump } from './useFocusJump.js';
import TacticCard from './TacticCard.jsx';

export default function Tactics({ focus, onFocusDone }) {
  const [category, setCategory] = useState('');
  const [openId, setOpenId] = useState('');

  const isGroup = CATEGORIES.some((c) => c.id === focus);

  // 目次から飛んできたとき：まず開く／絞り込む（運ぶのは描き直しのあと＝useFocusJump）
  useEffect(() => {
    if (!focus) return;
    if (isGroup) setCategory(focus);
    else setOpenId(focus);
  }, [focus, isGroup]);

  useFocusJump(focus ? `toc-${isGroup ? 'group' : 'tactic'}-${focus}` : '', onFocusDone);

  const shown = category ? tacticsInCategory(category) : TACTICS;

  return (
    <>
      <div className="head">
        <h1>操作の型</h1>
        <p>{TACTICS.length}件。名前がつくと、その場で気づけるようになります。</p>
      </div>

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
            {c.icon} {c.label}（{tacticsInCategory(c.id).length}）
          </button>
        ))}
      </div>

      {category && <div className="note">{CATEGORIES.find((c) => c.id === category).summary}</div>}

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
