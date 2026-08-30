import React from 'react';
import { REPLIES } from '../data/replies.js';
import { useFocusJump } from './useFocusJump.js';
import { GapSigil, Rule } from './Ornament.jsx';
import { GLYPHS } from '../data/glyphs.js';

export default function Replies({ focus, onFocusDone }) {
  useFocusJump(focus ? `toc-reply-${focus}` : '', onFocusDone);

  return (
    <>
      <div className="head">
        <GapSigil size={64} className="sigil" />
        <h1>断り方・自分を守る形</h1>
        <p>相手を言い負かす言葉は置いていません。自分の側だけでできることを集めています。</p>
      </div>
      <Rule mark={GLYPHS.circle} />

      <div className="note">
        言い返して勝つ形は、たいてい強く出られる側が勝ちます。ここにあるのは
        <strong>間を置く・自分の足で帰る・自分の飲み物を持つ・場所を自分で決める・人に話す・記録する・離れる</strong>
        ——<strong>相手の同意が要らないこと</strong>だけです。
      </div>

      {REPLIES.map((r) => (
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
        うまく断れなかったことを、あとから自分の落ち度にしないでください。
        断らせない形を作った側がいて、それが働いただけです。
        身の危険を感じるときは110番、急を要しない相談は #9110、性暴力の相談は #8891、
        家庭内の支配や暴力は DV相談＋。
        <span className="tiny">※番号・名称は変わることがあります。公式の案内で確かめてから使ってください。</span>
      </div>
    </>
  );
}
