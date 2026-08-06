import { useState } from 'react';
import { KEIKETSU_CARDS, YOUKETSU_TABLE } from '../data/keiketsuCards.js';
import { figureFor } from '../data/figures.jsx';

// 経穴フラッシュカード（#7）
// 表＝経穴名／裏＝経絡・部位（取穴）・主治。タップで裏返し、前後で移動。
// 今は「項目（枠）＋サンプル5枚」。今後361穴へ拡充予定。
export default function Flashcards() {
  const cards = KEIKETSU_CARDS;
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const card = cards[idx];
  const Fig = card.figure ? figureFor(card.figure) : null;

  const go = (d) => {
    setFlipped(false);
    setIdx((i) => (i + d + cards.length) % cards.length);
  };

  return (
    <div className="view">
      <h2 className="view-title">経穴フラッシュカード</h2>
      <p className="view-desc">
        経穴の<strong>名前 → 経絡・部位・主治</strong>を反復。カードをタップで裏返し。
        <br />
        <span className="inline-note">※ 現在はサンプル5枚。今後361穴へ拡充していきます。</span>
      </p>

      <div className="fc-counter">{idx + 1} / {cards.length}</div>

      <button className={`fc-card${flipped ? ' flipped' : ''}`} onClick={() => setFlipped((f) => !f)}>
        {!flipped ? (
          <div className="fc-front">
            <div className="fc-name">{card.name}</div>
            <div className="fc-yomi">{card.yomi}</div>
            <div className="fc-tap">タップで答えを見る</div>
          </div>
        ) : (
          <div className="fc-back">
            <div className="fc-back-name">{card.name}（{card.yomi}）</div>
            {Fig && <Fig />}
            <table className="fc-table">
              <tbody>
                <tr><th>経絡</th><td>{card.meridian}{card.ryaku ? `（${card.ryaku}）` : ''}</td></tr>
                {card.type && <tr><th>分類</th><td>{card.type}</td></tr>}
                <tr><th>部位・取穴</th><td>{card.location}</td></tr>
                <tr><th>主治</th><td>{card.shuji}</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </button>

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn block" onClick={() => go(-1)}>← 前へ</button>
        <button className="btn block" onClick={() => setFlipped((f) => !f)}>🔄 裏返す</button>
        <button className="btn primary block" onClick={() => go(1)}>次へ →</button>
      </div>

      {/* 早見表（図や表も追加） */}
      <div className="section-label">📋 {YOUKETSU_TABLE.title}</div>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="fc-youketsu">
          <thead>
            <tr>{YOUKETSU_TABLE.columns.map((c) => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {YOUKETSU_TABLE.rows.map((r, i) => (
              <tr key={i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="inline-note">
        四総穴の語呂：「肚腹（おなか）は三里、腰背は委中、頭項は列缺、面口は合谷」。
      </p>
    </div>
  );
}
