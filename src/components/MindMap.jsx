import { useMemo, useState } from 'react';
import { mindmapFor, centerCandidates, branchesOf, radialLayout } from '../lib/mindmap.js';
import { MINDMAP_REFERENCES } from '../data/mindmapData.js';

// マインドマップ：センターのキーワードから
//   🔗 つながる語（連結学習）/ ⚖️ 比較されやすいもの / 🔢 数値を変えられやすいもの
// を放射状に表示し、正しく答えられるように違い・数値を確認できる。
const TYPE_COLOR = { linked: '#3f9db0', compare: '#e6b64f', number: '#8f7fe0' };

export default function MindMap({ store, onOpenKeyword }) {
  const { questions, links } = store;
  const cands = useMemo(() => centerCandidates(questions, links), [questions, links]);
  const firstCenter = cands.user[0] || cands.suggested[0] || '原穴';
  const [center, setCenter] = useState(firstCenter);

  const mm = useMemo(() => mindmapFor(center, questions, links), [center, questions, links]);
  const branches = useMemo(() => branchesOf(mm), [mm]);
  const laid = useMemo(() => radialLayout(branches), [branches]);

  const userSet = new Set(cands.user);
  const clickBranch = (b) => {
    if (b.type === 'linked') setCenter(b.id); // つながる語は再センター
    else {
      const el = document.getElementById(`mm-${b.type}-${b.id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="view">
      <h2 className="view-title">マインドマップ</h2>
      <p className="view-desc">
        キーワードを中心に、<strong>つながる語</strong>・<strong>比較されやすいもの</strong>・
        <strong>数値を変えられやすいもの</strong>を1枚に。違いと数字を確かめて、引っかけに強くなりましょう。
      </p>

      {/* センター選択 */}
      <div className="section-label" style={{ marginTop: 0 }}>中心にする言葉</div>
      {cands.user.length > 0 && (
        <div className="chip-row">
          {cands.user.map((k) => (
            <button key={k} className={`chip ${center === k ? 'active' : ''}`} onClick={() => setCenter(k)}>{k}</button>
          ))}
        </div>
      )}
      {cands.suggested.length > 0 && (
        <>
          <div className="suggest-label" style={{ display: 'block', marginBottom: 6 }}>おすすめのテーマ：</div>
          <div className="chip-row">
            {cands.suggested.map((k) => (
              <button key={k} className={`chip suggest ${center === k ? 'active' : ''}`} onClick={() => setCenter(k)}>{k}</button>
            ))}
          </div>
        </>
      )}

      {/* マップ */}
      <div className="graph-wrap">
        <svg viewBox="0 0 100 100" className="graph-svg" preserveAspectRatio="xMidYMid meet">
          {laid.map((b, i) => (
            <line key={`l${i}`} x1="50" y1="50" x2={b.x} y2={b.y} className="graph-edge" strokeWidth="0.5" />
          ))}
          {laid.map((b, i) => (
            <g key={`n${i}`} className="graph-node" onClick={() => clickBranch(b)}>
              <circle cx={b.x} cy={b.y} r="3.2" fill={TYPE_COLOR[b.type]} />
              <text x={b.x} y={b.y - 4} className="graph-label">{b.label.length > 8 ? b.label.slice(0, 8) + '…' : b.label}</text>
            </g>
          ))}
          {/* center */}
          <circle cx="50" cy="50" r="6.5" fill="var(--navy-light)" stroke="#fff" strokeWidth="0.6" />
          <text x="50" y="50.9" className="mm-center-label">{center.length > 6 ? center.slice(0, 6) + '…' : center}</text>
        </svg>
      </div>
      <div className="mm-legend">
        <span><span className="mm-dot" style={{ background: TYPE_COLOR.linked }} /> つながる語</span>
        <span><span className="mm-dot" style={{ background: TYPE_COLOR.compare }} /> 比較</span>
        <span><span className="mm-dot" style={{ background: TYPE_COLOR.number }} /> 数値注意</span>
      </div>

      {/* 比較されやすいもの */}
      {mm.comparisons.length > 0 && (
        <>
          <div className="section-label">⚖️ 比較されやすいもの（違いに注意）</div>
          {mm.comparisons.map((c) => (
            <div className="card mm-card compare" id={`mm-compare-${c.id}`} key={c.id}>
              <div className="mm-card-title">{c.title}</div>
              <ul className="mm-members">
                {c.members.map((m, k) => <li key={k}>{m}</li>)}
              </ul>
              <div className="mm-note">💡 {c.note}</div>
            </div>
          ))}
        </>
      )}

      {/* 数値を変えられやすいもの */}
      {mm.numbers.length > 0 && (
        <>
          <div className="section-label">🔢 数値を変えられやすいもの（正しい数）</div>
          {mm.numbers.map((n) => (
            <div className="card mm-card number" id={`mm-number-${n.id}`} key={n.id}>
              <div className="mm-num-line"><span className="mm-num-topic">{n.topic}</span><span className="mm-num-value">{n.value}</span></div>
              <div className="mm-note">💡 {n.note}</div>
            </div>
          ))}
        </>
      )}

      {/* つながる語（連結学習へ） */}
      {mm.linked.length > 0 && (
        <>
          <div className="section-label">🔗 つながる語（タップで深掘り）</div>
          <div className="chip-row">
            {mm.linked.map((l) => (
              <button key={l.keyword} className="chip" onClick={() => onOpenKeyword?.(l.keyword)}>{l.keyword}（{l.weight}）</button>
            ))}
          </div>
        </>
      )}

      {mm.comparisons.length === 0 && mm.numbers.length === 0 && mm.linked.length === 0 && (
        <p className="inline-note">
          この言葉のデータがまだありません。問題にキーワードを付けたり、上の「おすすめのテーマ」を選ぶと、
          比較や数値のポイントが表示されます。
        </p>
      )}

      <div className="notice-card" style={{ marginTop: 14 }}>
        ⚠️ 比較・数値は学習補助です。最終的な正誤は必ず最新の教科書・出題基準でご確認ください。
      </div>
      <details className="ref-details">
        <summary>参考文献</summary>
        <ul>{MINDMAP_REFERENCES.map((r, i) => <li key={i}>{r}</li>)}</ul>
      </details>
    </div>
  );
}
