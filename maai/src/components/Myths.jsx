import React from 'react';
import { MYTHS } from '../data/myths.js';
import { sourcesOf } from '../data/sources.js';
import { GLYPHS } from '../data/glyphs.js';
import { GapSigil, Rule } from './Ornament.jsx';
import { useFocusJump } from './useFocusJump.js';

export default function Myths({ focus, onFocusDone, onGo }) {
  useFocusJump(focus ? `toc-myth-${focus}` : '', onFocusDone);

  return (
    <>
      <div className="head">
        <GapSigil size={64} className="sigil" />
        <h1>当てにならないテクニック</h1>
        <p>恋愛の分野で広く出回っているもの。{MYTHS.length}件。</p>
      </div>
      <Rule mark={GLYPHS.cross} />

      <div className="note warn">
        恋愛は、根拠の弱い技法がいちばん多く出回っている分野です。
        <strong>当たらない技法を信じると、外れたことにも気づけません。</strong>
        断られたのに「サインが出ていた」と思い込んだり、うまくいかない理由を
        自分の努力不足にしたりする——どちらもここから始まります。
      </div>

      {MYTHS.map((m) => (
        <div className="card" key={m.id} id={`toc-myth-${m.id}`}>
          <h3>
            {m.title} {m.check && <span className="badge">※要確認</span>}
          </h3>

          <h3>よく言われていること</h3>
          <p className="muted">{m.claim}</p>

          <h3>分かっていること</h3>
          <p>{m.known}</p>

          <h3>信じるとどうなるか</h3>
          <p>{m.risk}</p>

          <h3>代わりにできること</h3>
          <p>{m.instead}</p>

          <h3>出典</h3>
          {m.noSource ? (
            <p className="tiny">
              元になった研究を見つけられていません。
              <strong>見つからないこと自体が、この項目の中身です。</strong>
            </p>
          ) : (
            <ul className="tiny">
              {sourcesOf(m.sourceIds).map((s) => (
                <li key={s.id}>
                  {s.research === false ? `${s.tocTitle}（研究ではありません）` : s.title}
                  {s.author ? `（${[s.author, s.year].filter(Boolean).join(', ')}）` : ''}
                  {s.check && ' ※要確認'}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <div className="card quiet">
        <p className="muted">
          技法を覚えるより、<strong>断りの形</strong>を覚えるほうが、はるかに役に立ちます。
        </p>
        <div className="row end">
          <button onClick={() => onGo('consent')}>同意のことを読む</button>
        </div>
      </div>
    </>
  );
}
