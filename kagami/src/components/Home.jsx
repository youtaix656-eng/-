import React from 'react';
import { TACTICS, CATEGORIES, tacticsInCategory } from '../data/tactics.js';
import { REPLIES } from '../data/replies.js';

export default function Home({ onGo, records }) {
  return (
    <>
      <div className="head">
        <h1>鏡（かがみ）</h1>
        <p>「そう言われると断りにくい」の正体に、名前をつける。</p>
      </div>

      <div className="card">
        <p>
          人を動かす言い回しには、昔から名前と研究があります。名前を知らないうちは
          「自分が弱いからだ」と感じますが、名前がつくと<strong>その場で気づける</strong>ようになります。
        </p>
        <p className="muted">
          これは<strong>操るための道具ではなく、気づくための道具</strong>です。
          言われた言葉を貼ると、{TACTICS.length}件の型のどれに当たるかを、この端末の中だけで調べます。
        </p>
        <div className="row end">
          <button className="primary" onClick={() => onGo('check')}>
            言われた言葉を貼ってみる
          </button>
        </div>
      </div>

      <div className="note">
        <strong>当たった＝相手が悪い、ではありません。</strong>
        同じ言葉はふつうの会話でも使います。出るのは「言葉が一致した」という事実だけで、決めるのはあなたです。
        逆に、<strong>当たらなくても、読んで嫌な感じがしたことのほうが確かです。</strong>
      </div>

      <h2>型のまとまり</h2>
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
      <ul className="list">
        <li>
          <button className="item" onClick={() => onGo('replies')}>
            <span className="t">🛡 返し方（{REPLIES.length}件）</span>
            <span className="s">言い負かす言葉は置いていません。相手の同意が要らないことだけ。</span>
          </button>
        </li>
        <li>
          <button className="item" onClick={() => onGo('check', 'draft')}>
            <span className="t">🪞 自分の言い方を見る</span>
            <span className="s">
              これから送る文章を貼る。使う癖は、そのまま人に向く癖になります。
            </span>
          </button>
        </li>
        <li>
          <button className="item" onClick={() => onGo('records')}>
            <span className="t">📝 記録（{records.length}件）</span>
            <span className="s">争うためではなく、あとから自分が迷わないために。</span>
          </button>
        </li>
        <li>
          <button className="item" onClick={() => onGo('sources')}>
            <span className="t">📚 出典</span>
            <span className="s">どの型がどこから来ているかを辿れます。</span>
          </button>
        </li>
        <li>
          <button className="item" onClick={() => onGo('settings')}>
            <span className="t">⚙️ 設定</span>
            <span className="s">記録の残し方・データを消す。</span>
          </button>
        </li>
      </ul>

      <div className="note warn">
        身の危険を感じるとき、その場から離れられないときは、このアプリではなく人に頼ってください。
        緊急のときは110番。急を要しない警察への相談は #9110、契約・勧誘のことは消費者ホットライン 188、
        家庭内の支配や暴力は DV相談＋。
        <span className="tiny">※番号・名称は変わることがあります。公式の案内で確かめてから使ってください。</span>
      </div>
    </>
  );
}
