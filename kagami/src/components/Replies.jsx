import React, { useMemo, useState } from 'react';
import { REPLIES } from '../data/replies.js';
import { matchesLoose } from '../lib/personSearch.js';
import Finder from './Finder.jsx';
import { useFocusJump } from './useFocusJump.js';
import { EyeSigil, Rule } from './Ornament.jsx';
import { GLYPHS } from '../data/glyphs.js';

export default function Replies({ focus, anchor, onFocusDone }) {
  const [query, setQuery] = useState('');
  // 目次が持っている飛び先をそのまま使う（画面側で組み立て直さない）
  useFocusJump(anchor || (focus ? `toc-reply-${focus}` : ''), onFocusDone);

  const shown = useMemo(
    () =>
      query.trim()
        ? REPLIES.filter((r) =>
            matchesLoose([r.tocTitle, r.reading, r.summary, r.detail, ...(r.lines || [])].join(' '), query),
          )
        : REPLIES,
    [query],
  );

  return (
    <>
      <div className="head">
        <EyeSigil size={64} className="sigil" />
        <h1>返し方</h1>
        <p>相手を言い負かす言葉は置いていません。自分の側だけでできることを集めています。</p>
      </div>
      <Rule mark={GLYPHS.circle} />

      <div className="note">
        言い返して勝つ形は、立場が弱い側ほど不利になります（言い返せる関係なら、そもそも困っていません）。
        ここにあるのは<strong>時間を置く・持ち帰る・記録する・人に話す・その場を離れる</strong>——相手の同意が要らないことだけです。
      </div>

      <Finder
        label="返し方をさがす"
        value={query}
        onChange={setQuery}
        total={REPLIES.length}
        shown={shown.length}
        hint="「時間」「持ち帰る」「記録」などで引けます。"
      />

      {shown.map((r) => (
        <div className="card" key={r.id} id={`toc-reply-${r.id}`}>
          <h3>
            {r.icon} {r.tocTitle}
          </h3>
          <p>{r.summary}</p>
          <p className="muted">{r.detail}</p>
          {r.lines.length > 0 && (
            <ul className="tiny">
              {r.lines.map((l) => (
                <li key={l}>「{l}」</li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <div className="note warn">
        身の危険を感じるとき、その場から離れられないときは、このアプリではなく人に頼ってください。
        緊急のときは110番。急を要しない警察への相談は #9110、契約・勧誘のことは消費者ホットライン 188、
        家庭内の支配や暴力は DV相談＋。<span className="tiny">※番号・名称は変わることがあります。公式の案内で確かめてから使ってください。</span>
      </div>
    </>
  );
}
