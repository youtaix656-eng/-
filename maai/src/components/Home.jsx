import React from 'react';
import { TACTICS, CATEGORIES, tacticsInCategory } from '../data/tactics.js';
import { APPROACHES, PHASES, approachesInPhase } from '../data/approach.js';
import { CONSENT_POINTS } from '../data/consent.js';
import { REPLIES } from '../data/replies.js';
import { MYTHS } from '../data/myths.js';
import { GLYPHS } from '../data/glyphs.js';
import { TwoCircles, CornerMark, Rule } from './Ornament.jsx';

export default function Home({ onGo, records }) {
  return (
    <>
      <div className="plate-mark">
        <div className="corners">
          <CornerMark />
          <TwoCircles size={180} />
          <CornerMark />
        </div>
      </div>

      <div className="head" style={{ paddingTop: 0 }}>
        <h1>間合い</h1>
        <p className="title-greek">M A A I</p>
        <p style={{ marginTop: 10 }}>
          恋愛の心理学を、
          <br />
          近づき方と、気づき方の両方から。
        </p>
      </div>
      <Rule mark={GLYPHS.star} />

      <div className="card">
        <p>
          このアプリは二つでできています。ひとつは<strong>近づき方</strong>——研究で言われている範囲で、
          自分の側だけでできることを{APPROACHES.length}件。もうひとつは<strong>思いどおりにする型</strong>
          ——人を依存させる・断らせない・その日の段取りで決めさせる形を{TACTICS.length}件。
        </p>
        <p className="muted">
          型のほうは<strong>やり方ではなく、気づくための一覧</strong>です。
          自分がされている側かもしれないとき、そして<strong>自分がやってしまっている側</strong>かもしれないときの、
          どちらからでも読めるようにしてあります。
        </p>
        <div className="row end">
          <button className="primary" onClick={() => onGo('approach')}>
            近づき方から見る
          </button>
        </div>
      </div>

      <div className="note warn">
        <strong>相手を思いどおりにする方法は、ここにはありません。</strong>
        断らせない言い方・その気にさせる段取りは、書いていません。書くと、
        <strong>それを使われる側</strong>がこのアプリを読んでも助けにならなくなるからです。
        代わりに、その形が<strong>どう見えるか</strong>と、なぜ効いてしまうのかを書いています。
      </div>

      <h2>近づき方の段</h2>
      <Rule mark={GLYPHS.circlePlus} />
      <ul className="list">
        {PHASES.map((p) => (
          <li key={p.id}>
            <button className="item" onClick={() => onGo('approach', p.id)}>
              <span className="t">
                {p.icon} {p.label}（{approachesInPhase(p.id).length}件）
              </span>
              <span className="s">{p.summary}</span>
            </button>
          </li>
        ))}
      </ul>

      <h2>思いどおりにする型</h2>
      <Rule mark={GLYPHS.moonWane} />
      <ul className="list">
        {CATEGORIES.map((c) => (
          <li key={c.id}>
            <button className="item" onClick={() => onGo('tactics', c.id)}>
              <span className="t">
                {c.icon} {c.label}（{tacticsInCategory(c.id).length}件）
              </span>
              <span className="s">{c.summary}</span>
            </button>
          </li>
        ))}
      </ul>

      <h2>できること</h2>
      <Rule mark={GLYPHS.circle} />
      <ul className="list">
        <li>
          <button className="item" onClick={() => onGo('consent')}>
            <span className="t">{GLYPHS.diamond} 同意（{CONSENT_POINTS.length}件）</span>
            <span className="s">
              「お持ち帰り」を調べに来たなら、まずここ。返事が返事として成り立つ条件。
            </span>
          </button>
        </li>
        <li>
          <button className="item" onClick={() => onGo('check')}>
            <span className="t">{GLYPHS.circleDouble} 届いた文面を貼って調べる</span>
            <span className="s">この端末の中だけで、型の言い回しに当たるかを見ます。</span>
          </button>
        </li>
        <li>
          <button className="item" onClick={() => onGo('check', 'draft')}>
            <span className="t">{GLYPHS.moonWax} 自分が送る文面を見る</span>
            <span className="s">
              使う癖は、そのまま人に向く癖になります。送る前に一度だけ。
            </span>
          </button>
        </li>
        <li>
          <button className="item" onClick={() => onGo('myths')}>
            <span className="t">{GLYPHS.cross} 当てにならないテクニック（{MYTHS.length}件）</span>
            <span className="s">
              吊り橋・ミラーリング・3日ルール・ネグ。信じると外れたことにも気づけません。
            </span>
          </button>
        </li>
        <li>
          <button className="item" onClick={() => onGo('replies')}>
            <span className="t">{GLYPHS.circle} 断り方・自分を守る形（{REPLIES.length}件）</span>
            <span className="s">言い負かす言葉は置いていません。相手の同意が要らないことだけ。</span>
          </button>
        </li>
        <li>
          <button className="item" onClick={() => onGo('habits')}>
            <span className="t">{GLYPHS.squareSmall} 自分の側で起きること</span>
            <span className="s">こじれやすい癖と、長く続いた時に自分の中で起きること。</span>
          </button>
        </li>
        <li>
          <button className="item" onClick={() => onGo('records')}>
            <span className="t">{GLYPHS.reference} 記録（{records.length}件）</span>
            <span className="s">争うためではなく、あとから自分が迷わないために。</span>
          </button>
        </li>
        <li>
          <button className="item" onClick={() => onGo('sources')}>
            <span className="t">{GLYPHS.dagger} 出典</span>
            <span className="s">どこから来ている話か、研究なのかどうかを辿れます。</span>
          </button>
        </li>
        <li>
          <button className="item" onClick={() => onGo('settings')}>
            <span className="t">{GLYPHS.circleCross} 設定</span>
            <span className="s">記録の残し方・データを消す。</span>
          </button>
        </li>
      </ul>

      <div className="note warn">
        身の危険を感じるとき、その場から離れられないときは、このアプリではなく人に頼ってください。
        緊急のときは110番。急を要しない警察への相談は #9110、性暴力の相談は #8891、
        家庭内の支配や暴力は DV相談＋、お金のことは消費者ホットライン 188。
        <span className="tiny">※番号・名称は変わることがあります。公式の案内で確かめてから使ってください。</span>
      </div>
    </>
  );
}
