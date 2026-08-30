import React from 'react';
import { CONSENT_POINTS } from '../data/consent.js';
import { sourcesOf } from '../data/sources.js';
import { useFocusJump } from './useFocusJump.js';
import { GapSigil, Rule } from './Ornament.jsx';
import { GLYPHS } from '../data/glyphs.js';

export default function Consent({ focus, onFocusDone }) {
  useFocusJump(focus ? `toc-consent-${focus}` : '', onFocusDone);

  return (
    <>
      <div className="head">
        <GapSigil size={64} className="sigil" />
        <h1>同意</h1>
        <p>返事が、返事として成り立つ条件。{CONSENT_POINTS.length}件。</p>
      </div>
      <Rule mark={GLYPHS.diamond} />

      <div className="note warn">
        <strong>「お持ち帰り」を調べに来たなら、ここがその答えです。</strong>
        条件を外れたところで得た「いいよ」は、うまくいったのではなく、
        <strong>確かめられていないだけ</strong>です。あとから取り消しがきかない場面で、
        いちばん代償が大きいのがここなので、方法ではなく条件だけを書いています。
      </div>

      {CONSENT_POINTS.map((c) => (
        <div className="card" key={c.id} id={`toc-consent-${c.id}`}>
          <h3>
            {c.icon} {c.title} {c.check && <span className="badge">※要確認</span>}
          </h3>
          <p>{c.summary}</p>
          <p className="muted">{c.detail}</p>

          <h3>代わりにできること</h3>
          <p>{c.instead}</p>

          <h3>出典</h3>
          <ul className="tiny">
            {sourcesOf(c.sourceIds).map((s) => (
              <li key={s.id}>
                {s.research === false ? `${s.tocTitle}（研究ではありません）` : s.title}
                {s.author ? `（${[s.author, s.year].filter(Boolean).join(', ')}）` : ''}
                {s.check && ' ※要確認'}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="note">
        年齢・立場・状態についての線は<strong>法律で定められていて、改正で変わります</strong>。
        このアプリに数字を書くと、古い数字が根拠として使われてしまうので書いていません。
        関わりそうなときは、必ず公式（法務省・警察・自治体）の案内で確かめてください。
      </div>

      <div className="note warn">
        すでに起きてしまったことで困っているときは、一人で抱えないでください。
        性暴力の相談は #8891（最寄りのワンストップ支援センター）、緊急のときは110番。
        <span className="tiny">※番号・名称は変わることがあります。公式の案内で確かめてから使ってください。</span>
      </div>
    </>
  );
}
