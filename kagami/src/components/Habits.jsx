import React from 'react';
import { HABITS } from '../data/habits.js';
import { STATES, STATES_NOTE } from '../data/states.js';
import { sourcesOf } from '../data/sources.js';
import { TACTIC_MAP } from '../data/tactics.js';
import { repliesOf } from '../data/replies.js';
import { GLYPHS } from '../data/glyphs.js';
import { EyeSigil, Rule } from './Ornament.jsx';
import { useFocusJump } from './useFocusJump.js';

export default function Habits({ focus, anchor: tocAnchor, onFocusDone, onGoTactic, myHabits = [], onSetMyHabits }) {
  // 癖と状態が同じ画面にあるので、どちらの飛び先かを id から決める
  const anchor = focus
    ? STATES.some((st) => st.id === focus)
      ? `toc-state-${focus}`
      : `toc-habit-${focus}`
    : '';
  useFocusJump(tocAnchor || anchor, onFocusDone);

  return (
    <>
      <div className="head">
        <EyeSigil size={64} className="sigil" />
        <h1>自分の側で起きること</h1>
        <p>
          相手の型ではなく、自分の側のこと。つけこまれやすい形が{HABITS.length}件、
          長く続いた時に起きることが{STATES.length}件。
        </p>
      </div>
      <Rule mark={GLYPHS.circlePlus} />

      <div className="note">
        <strong>つけこまれるのは、つけこむ側がいるからです。</strong>
        ここに並ぶのは落ち度ではなく、相手にとって<strong>使いやすい形</strong>というだけのこと。
        直す義務はありませんし、性格を変える話でもありません。
        変えられるのは<strong>その場での一手</strong>だけです。
      </div>

      <h2>つけこまれやすい形</h2>
      <Rule mark={GLYPHS.circlePlus} />

      {HABITS.map((h) => (
        <div className="card" key={h.id} id={`toc-habit-${h.id}`}>
          <h3>{h.title}</h3>
          <p>{h.summary}</p>

          <label className="check">
            <input
              type="checkbox"
              checked={myHabits.includes(h.id)}
              onChange={() =>
                onSetMyHabits?.(
                  myHabits.includes(h.id)
                    ? myHabits.filter((x) => x !== h.id)
                    : [...myHabits, h.id],
                )
              }
            />
            <span>
              これは自分に当てはまる
              <br />
              <span className="tiny">
                印を付けると、人間分析で「この癖の人には最初は使いにくい手」を先に知らせます。
                当てはまることは落ち度ではありません。
              </span>
            </span>
          </label>

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
      <h2>長く続いた時に起きること</h2>
      <Rule mark={GLYPHS.moonWane} />

      <div className="note warn">{STATES_NOTE}</div>

      {STATES.map((st) => (
        <div className="card" key={st.id} id={`toc-state-${st.id}`}>
          <h3>
            {st.title} {st.check && <span className="badge">※要確認</span>}
          </h3>
          <p>{st.summary}</p>
          <p className="muted">{st.detail}</p>
          <ul className="tiny">
            {sourcesOf(st.sourceIds).map((s) => (
              <li key={s.id}>
                {s.title}（{[s.author, s.year].filter(Boolean).join(', ')}）
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="note warn">
        身の危険を感じるとき、その場から離れられないとき、つらさが続くときは、
        このアプリではなく人に頼ってください。緊急のときは110番。急を要しない警察への相談は #9110、
        家庭内の支配や暴力は DV相談＋。
        <span className="tiny">※番号・名称は変わることがあります。公式の案内で確かめてから使ってください。</span>
      </div>
    </>
  );
}
