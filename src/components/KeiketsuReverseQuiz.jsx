import { useMemo, useState } from 'react';
import { KEIKETSU_CARDS } from '../data/keiketsuCards.js';
import { buildChoices } from '../lib/acupointTap.js';

const ALL_NAMES = KEIKETSU_CARDS.map((c) => c.name);

function pickRandomCard(excludeId) {
  const pool = KEIKETSU_CARDS.filter((c) => c.id !== excludeId);
  const src = pool.length > 0 ? pool : KEIKETSU_CARDS;
  return src[Math.floor(Math.random() * src.length)];
}

// 経穴の逆引きクイズ（⑥）— 症状（主治）から経穴名を当てる。
// 名前→症状ではなく、症状→名前の逆方向。keiketsuCards.jsの既存データ（shuji）をそのまま使う。
export default function KeiketsuReverseQuiz({ onNavigate }) {
  const [card, setCard] = useState(() => pickRandomCard(null));
  const [result, setResult] = useState(null); // 'correct' | 'wrong' | null

  const choices = useMemo(
    () => buildChoices(card.name, ALL_NAMES, 4),
    [card.id] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const next = () => {
    setCard((cur) => pickRandomCard(cur.id));
    setResult(null);
  };

  const answer = (name) => {
    if (result) return;
    setResult(name === card.name ? 'correct' : 'wrong');
  };

  return (
    <div className="view">
      <h2 className="view-title">経穴の逆引きクイズ</h2>
      <p className="view-desc">
        症状・主治から経穴名を当てます。名前→説明ではなく、説明→名前の逆方向で理解を確認します。
      </p>

      <div className="card">
        <p style={{ fontWeight: 700, fontSize: 16, margin: '0 0 4px' }}>この症状・主治に対応する経穴は？</p>
        <p style={{ margin: '0 0 10px' }}>{card.shuji}</p>

        <div className="btn-row" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          {choices.map((name) => (
            <button
              key={name}
              className={`chip ${result && name === card.name ? 'active' : ''}`}
              onClick={() => answer(name)}
              disabled={!!result}
            >
              {name}
            </button>
          ))}
        </div>

        {result && (
          <div style={{ marginTop: 10, textAlign: 'center' }}>
            <p style={{ fontWeight: 700, color: result === 'correct' ? 'var(--correct, #2e7d32)' : 'var(--wrong, #c62828)' }}>
              {result === 'correct' ? '⭕ 正解！' : `❌ 正解は「${card.name}」`}
            </p>
            <p className="inline-note">{card.meridian}{card.ryaku ? `（${card.ryaku}）` : ''}・{card.location}</p>
            <button className="btn primary sm" onClick={next}>次の問題へ</button>
          </div>
        )}
      </div>

      <div className="ana-jump">
        <button className="btn ghost sm" onClick={() => onNavigate && onNavigate('flashcards')}>🃏 経穴フラッシュカードへ</button>
      </div>
    </div>
  );
}
