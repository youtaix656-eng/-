// 画面をまたいで使う小さな部品。

import { useEffect, useState } from 'react';
import { toBlocks } from '../lib/format.js';

export function Card({ title, glyph, action, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-h">
          {glyph && <span className="rune">{glyph}</span>}
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function SectionTitle({ children }) {
  return <div className="section-title">{children}</div>;
}

export function Row({ glyph, title, sub, onClick, right }) {
  return (
    <button type="button" className="row" onClick={onClick}>
      {glyph && <span className="g">{glyph}</span>}
      <span className="body">
        <span className="t">{title}</span>
        {sub && <span className="s">{sub}</span>}
      </span>
      <span className="arrow">{right ?? '›'}</span>
    </button>
  );
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

export function Field({ label, children, hint }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <div className="muted" style={{ marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function Divider({ glyph = '✦' }) {
  return <div className="divider-glyph">{glyph}</div>;
}

export function Stat({ value, label }) {
  return (
    <div className="stat">
      <div className="v">{value}</div>
      <div className="k">{label}</div>
    </div>
  );
}

export function Bar({ pct }) {
  return (
    <div className="bar">
      <i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

/** 最小限の Markdown 表示（外部ライブラリを使わない方針のため自前）。 */
export function Doc({ text }) {
  const blocks = toBlocks(text || '');
  return (
    <div className="doc">
      {blocks.map((b, i) => {
        if (b.type === 'heading') {
          const Tag = `h${Math.min(4, b.level + 1)}`;
          return <Tag key={i}>{b.text}</Tag>;
        }
        if (b.type === 'list') {
          return (
            <ul key={i}>
              {b.items.map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{b.text}</p>;
      })}
    </div>
  );
}

export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-bg" onClick={onClose} role="presentation">
      <div className="sheet fade-in" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2>{title}</h2>
        {children}
        <button type="button" className="btn block" onClick={onClose} style={{ marginTop: 12 }}>
          閉じる
        </button>
      </div>
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    if (!msg) return undefined;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  const node = msg ? <div className="toast fade-in">{msg}</div> : null;
  return [node, setMsg];
}

/** 折れ線（知識の成長）。SVG を自前で描く。 */
export function Spark({ series = [], field = 'total' }) {
  if (series.length < 2) return null;
  const values = series.map((s) => s[field] || 0);
  const max = Math.max(...values, 1);
  const w = 100;
  const h = 30;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - (v / max) * (h - 3) - 1.5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke="#fff" strokeWidth="0.8" opacity="0.85" />
      <polyline
        points={`0,${h} ${pts.join(' ')} ${w},${h}`}
        fill="rgba(255,255,255,0.07)"
        stroke="none"
      />
    </svg>
  );
}
