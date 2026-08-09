import { useMemo, useRef, useState } from 'react';
import { nodeDegrees } from '../lib/learnerModel.js';
import { effectiveStrength } from '../lib/assocStrength.js';

// インタラクティブ知識グラフ（#9）— パン・ズームできるSVG可視化。
//   同心リング配置（つながりの多い概念を中心に）。指でドラッグ移動、＋/−で拡大縮小。
export default function GraphCanvas({ graph, onOpenKeyword, max = 36 }) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const drag = useRef(null);

  // 配置：次数の多い順に同心リングへ
  const layout = useMemo(() => {
    const deg = nodeDegrees(graph);
    const ids = Object.keys(graph.nodes)
      .sort((a, b) => (deg.get(b) || 0) - (deg.get(a) || 0))
      .slice(0, max);
    const pos = {};
    const cx = 160, cy = 160;
    if (ids.length) pos[ids[0]] = { x: cx, y: cy };
    let idx = 1;
    let ring = 1;
    while (idx < ids.length) {
      const count = Math.min(ids.length - idx, ring * 6);
      const R = 42 * ring;
      for (let k = 0; k < count; k++) {
        const ang = (k / count) * Math.PI * 2 - Math.PI / 2;
        pos[ids[idx]] = { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) };
        idx += 1;
      }
      ring += 1;
    }
    const idset = new Set(ids);
    const edges = Object.values(graph.edges).filter((e) => idset.has(e.a) && idset.has(e.b));
    const maxEff = Math.max(1, ...edges.map((e) => effectiveStrength(e) || e.weight || 1));
    return { ids, pos, edges, maxEff };
  }, [graph, max]);

  const onDown = (e) => {
    const pt = e.touches ? e.touches[0] : e;
    drag.current = { x: pt.clientX, y: pt.clientY, tx, ty };
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const pt = e.touches ? e.touches[0] : e;
    setTx(drag.current.tx + (pt.clientX - drag.current.x));
    setTy(drag.current.ty + (pt.clientY - drag.current.y));
  };
  const onUp = () => { drag.current = null; };
  const zoom = (f) => setScale((s) => Math.max(0.5, Math.min(3, s * f)));
  const reset = () => { setScale(1); setTx(0); setTy(0); };

  if (layout.ids.length === 0) return null;

  return (
    <div className="card" style={{ padding: 8 }}>
      <div
        className="graph-canvas"
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
        onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
      >
        <svg width="100%" height="320" viewBox="0 0 320 320" style={{ touchAction: 'none' }}>
          <g transform={`translate(${tx} ${ty}) scale(${scale})`} style={{ transformOrigin: 'center' }}>
            {layout.edges.map((e) => {
              const a = layout.pos[e.a], b = layout.pos[e.b];
              const w = effectiveStrength(e) || e.weight || 1;
              return (
                <line key={`${e.a}-${e.b}-${e.type}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="var(--accent)" strokeWidth={0.5 + (w / layout.maxEff) * 1.8} opacity="0.4" />
              );
            })}
            {layout.ids.map((id, i) => {
              const p = layout.pos[id];
              return (
                <g key={id} onClick={() => onOpenKeyword?.(id)} style={{ cursor: 'pointer' }}>
                  <circle cx={p.x} cy={p.y} r={i === 0 ? 6 : 4} fill="var(--accent)" />
                  <text x={p.x + 6} y={p.y + 3} fontSize="7" fill="var(--text)">{id.length > 8 ? id.slice(0, 8) + '…' : id}</text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <div className="btn-row" style={{ marginTop: 6 }}>
        <button className="btn sm" onClick={() => zoom(1.25)}>＋ 拡大</button>
        <button className="btn sm" onClick={() => zoom(0.8)}>－ 縮小</button>
        <button className="btn ghost sm" onClick={reset}>リセット</button>
        <span className="inline-note" style={{ alignSelf: 'center' }}>ドラッグで移動・タップで詳細</span>
      </div>
    </div>
  );
}
