import React from 'react';
import { HABITS } from '../data/habits.js';
import { TACTIC_MAP } from '../data/tactics.js';
import { repliesOf } from '../data/replies.js';
import { GLYPHS } from '../data/glyphs.js';
import { EyeSigil, Rule } from './Ornament.jsx';
import { useFocusJump } from './useFocusJump.js';

export default function Habits({ focus, onFocusDone, onGoTactic }) {
  useFocusJump(focus ? `toc-habit-${focus}` : '', onFocusDone);

  return (
    <>
      <div className="head">
        <EyeSigil size={64} className="sigil" />
        <h1>つけこまれやすい形</h1>
        <p>相手の型ではなく、自分の側の癖。{HABITS.length}件。</p>
      </div>
      <Rule mark={GLYPHS.circlePlus} />

      <div className="note">
        <strong>つけこまれるのは、つけこむ側がいるからです。</strong>
        ここに並ぶのは落ち度ではなく、相手にとって<strong>使いやすい形</strong>というだけのこと。
        直す義務はありませんし、性格を変える話でもありません。
        変えられるのは<strong>その場での一手</strong>だけです。
      </div>

      {HABITS.map((h) => (
        <div className="card" key={h.id} id={`toc-habit-${h.id}`}>
          <h3>{h.title}</h3>
          <p>{h.summary}</p>

          <h3>何が起きているか</h3>
          <p>{h.why}</p>

          <h3>こうなっていたら</h3>
          <ul>
            {h.signs.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>

          <h3>その場でできる一手</h3>
          <ul>
            {h.moves.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>

          <h3>使える返し方</h3>
          <ul>
            {repliesOf(h.replyIds).map((r) => (
              <li key={r.id}>
                {r.icon} <strong>{r.tocTitle}</strong> — {r.summary}
              </li>
            ))}
          </ul>

          <h3>組み合わせて使われる型</h3>
          <div className="chips">
            {h.relatedTacticIds.map((id) => (
              <button key={id} className="chip" onClick={() => onGoTactic(id)}>
                {TACTIC_MAP[id]?.name || id}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
