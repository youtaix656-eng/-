import { useMemo, useRef, useState } from 'react';
import { figureFor } from '../data/figures.jsx';
import { KEIKETSU_CARDS } from '../data/keiketsuCards.js';
import { ACUPOINT_TAP_POINTS, isHit, toViewBoxCoords, buildChoices } from '../lib/acupointTap.js';

const ALL_NAMES = KEIKETSU_CARDS.map((c) => c.name);

function pickRandomPoint(excludeId) {
  const pool = ACUPOINT_TAP_POINTS.filter((p) => p.id !== excludeId);
  const src = pool.length > 0 ? pool : ACUPOINT_TAP_POINTS;
  return src[Math.floor(Math.random() * src.length)];
}

// 経穴の体表イラスト学習（④）— タップで位置⇄名前。
// 位置→名前（4択）と、名前→位置（タップ）の2方向で練習できる。
// 座標が確認できている経穴（lib/acupointTap.js）だけを対象にする（正確性優先）。
export default function AcupointTap({ onNavigate }) {
  const [mode, setMode] = useState('name'); // 'name'=位置→名前 / 'tap'=名前→位置
  const [point, setPoint] = useState(() => pickRandomPoint(null));
  const [result, setResult] = useState(null); // 'correct' | 'wrong' | null
  const [tapMark, setTapMark] = useState(null); // 名前→位置モードでのタップ座標（表示用）
  const containerRef = useRef(null);

  const choices = useMemo(
    () => buildChoices(point.name, ALL_NAMES, 4),
    [point.id] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const next = () => {
    setPoint((cur) => pickRandomPoint(cur.id));
    setResult(null);
    setTapMark(null);
  };

  const answerName = (name) => {
    if (result) return;
    setResult(name === point.name ? 'correct' : 'wrong');
  };

  const handleTap = (e) => {
    if (result || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const { x, y } = toViewBoxCoords(e.clientX, e.clientY, rect, point.viewBox);
    setTapMark({ x, y });
    setResult(isHit(x, y, point) ? 'correct' : 'wrong');
  };

  const Fig = figureFor(mode === 'name' ? point.figureKey : point.blankFigureKey);
  const [, , vbW, vbH] = point.viewBox.split(' ').map(Number);

  return (
    <div className="view">
      <h2 className="view-title">経穴の体表イラスト学習</h2>
      <p className="view-desc">
        位置→名前（4択）と、名前→位置（タップ）の2方向で練習できます。今は座標が確認できている
        経穴だけを対象にしたサンプルです（拡充予定）。
      </p>

      <div className="chip-row" style={{ marginBottom: 10 }}>
        <button
          className={`chip ${mode === 'name' ? 'active' : ''}`}
          onClick={() => { setMode('name'); setResult(null); setTapMark(null); }}
        >
          位置→名前（4択）
        </button>
        <button
          className={`chip ${mode === 'tap' ? 'active' : ''}`}
          onClick={() => { setMode('tap'); setResult(null); setTapMark(null); }}
        >
          名前→位置（タップ）
        </button>
      </div>

      <div className="card">
        {mode === 'tap' && (
          <p style={{ fontWeight: 700, fontSize: 16, margin: '0 0 8px' }}>「{point.name}」はどこ？図をタップ</p>
        )}
        <div
          ref={containerRef}
          onClick={mode === 'tap' ? handleTap : undefined}
          style={{ aspectRatio: `${vbW} / ${vbH}`, maxWidth: 300, margin: '0 auto', cursor: mode === 'tap' ? 'crosshair' : 'default', position: 'relative' }}
        >
          {Fig && <Fig />}
          {tapMark && (
            <div
              style={{
                position: 'absolute',
                left: `${(tapMark.x / vbW) * 100}%`,
                top: `${(tapMark.y / vbH) * 100}%`,
                width: 14,
                height: 14,
                marginLeft: -7,
                marginTop: -7,
                borderRadius: '50%',
                background: result === 'correct' ? 'rgba(46,125,50,.7)' : 'rgba(211,47,47,.7)',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>

        {mode === 'name' && (
          <div className="btn-row" style={{ flexWrap: 'wrap', marginTop: 10, justifyContent: 'center' }}>
            {choices.map((name) => (
              <button
                key={name}
                className={`chip ${result && name === point.name ? 'active' : ''}`}
                onClick={() => answerName(name)}
                disabled={!!result}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {result && (
          <div style={{ marginTop: 10, textAlign: 'center' }}>
            <p style={{ fontWeight: 700, color: result === 'correct' ? 'var(--correct, #2e7d32)' : 'var(--wrong, #c62828)' }}>
              {result === 'correct' ? '⭕ 正解！' : `❌ 正解は「${point.name}」`}
            </p>
            <p className="inline-note">{point.hint}</p>
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
