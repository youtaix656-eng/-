import React, { useLayoutEffect, useState } from 'react';
import { TACTICS, CATEGORIES, tacticsInCategory } from '../data/tactics.js';
import { useFocusJump } from './useFocusJump.js';
import TacticCard from './TacticCard.jsx';
import { GapSigil, Rule } from './Ornament.jsx';
import { GLYPHS } from '../data/glyphs.js';

export default function Tactics({ focus, onFocusDone }) {
  const [category, setCategory] = useState('');
  const [openId, setOpenId] = useState('');

  const isGroup = CATEGORIES.some((c) => c.id === focus);

  // 目次から飛んできたとき：まず開く／絞り込む（運ぶのは描き直しのあと＝useFocusJump）。
  // **useLayoutEffect でなければならない。** ここを useEffect にすると、
  // 「開く」の描き直しが、光らせる処理（次のフレーム）より後になることがあり、
  // React が className を書き直した拍子に flash が消える（実際に踏んだ）。
  useLayoutEffect(() => {
    if (!focus) return;
    if (isGroup) setCategory(focus);
    else setOpenId(focus);
  }, [focus, isGroup]);

  useFocusJump(focus ? `toc-${isGroup ? 'group' : 'tactic'}-${focus}` : '', onFocusDone);

  const shown = category ? tacticsInCategory(category) : TACTICS;

  return (
    <>
      <div className="head">
        <GapSigil size={64} className="sigil" />
        <h1>思いどおりにする型</h1>
        <p>{TACTICS.length}件。名前がつくと、その場で気づけるようになります。</p>
      </div>
      <Rule mark={GLYPHS.moonWane} />

      <div className="note warn">
        <strong>ここに書いてあるのは、やり方ではありません。</strong>
        どう見えるか（見分け方）と、なぜ効いてしまうかだけです。
        自分がやっている側かもしれないと思ったら、そのまま読んでください——
        <strong>効いてしまう形ほど、あとの関係を壊します。</strong>
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
