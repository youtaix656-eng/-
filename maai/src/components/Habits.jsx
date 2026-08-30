import React from 'react';
import { HABITS } from '../data/habits.js';
import { STATES } from '../data/states.js';
import { useFocusJump } from './useFocusJump.js';
import { GapSigil, Rule } from './Ornament.jsx';
import { GLYPHS } from '../data/glyphs.js';

/**
 * 自分の側で起きること。
 * **1画面に2種類の飛び先があるので、両方に分岐を書く**
 * （癖と状態。片方の anchor しか見ないと目次から飛べない。鏡で実際に踏んだ）。
 */
export default function Habits({ focus, onFocusDone }) {
  const isState = STATES.some((s) => s.id === focus);
  useFocusJump(focus ? `toc-${isState ? 'state' : 'habit'}-${focus}` : '', onFocusDone);

  return (
    <>
      <div className="head">
        <GapSigil size={64} className="sigil" />
        <h1>自分の側で起きること</h1>
        <p>こじれやすい癖（{HABITS.length}件）と、長く続いたときに自分の中で起きること（{STATES.length}件）。</p>
      </div>
      <Rule mark={GLYPHS.squareSmall} />

      <div className="note">
        <strong>ここは落ち度の話ではありません。</strong>
        つけこまれるのは、つけこむ側がいるからで、癖はその原因ではありません。
        性格を変える話も書いていません——書いてあるのは、
        <strong>その場でできる一手</strong>だけです。
      </div>

      <h2>こじれやすい癖</h2>
      <Rule mark={GLYPHS.circlePlus} />
      {HABITS.map((h) => (
        <div className="card" key={h.id} id={`toc-habit-${h.id}`}>
          <h3>
            {h.icon} {h.title}
          </h3>
          <p>{h.summary}</p>
          <p className="muted">{h.detail}</p>
          <h3>その場でできる一手</h3>
          <p>{h.step}</p>
        </div>
      ))}

      <h2>自分の中で起きること</h2>
      <Rule mark={GLYPHS.moonWax} />
      <div className="note warn">
        <strong>ここで病名は当てません。</strong>当てはめて点数を出す仕掛けも作っていません。
        どれも、その状況では普通に起きることです。続くようなら、
        アプリではなく人（信頼できる相手・専門の窓口・医療機関）に話してください。
      </div>
      {STATES.map((s) => (
        <div className="card" key={s.id} id={`toc-state-${s.id}`}>
          <h3>
            {s.icon} {s.title}
          </h3>
          <p>{s.summary}</p>
          <h3>起きていること</h3>
          <p className="muted">{s.happening}</p>
          <h3>できること</h3>
          <p>{s.care}</p>
        </div>
      ))}
    </>
  );
}
