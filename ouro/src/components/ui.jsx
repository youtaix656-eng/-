// 画面をまたいで使う小さな部品。

import { memo, useEffect, useRef, useState } from 'react';
import { preloadView } from '../lib/preload.js';
import { toBlocks } from '../lib/format.js';

/**
 * 目次から飛んできた項目を、固定ヘッダーの下に出して一時的に光らせる。
 * （共通ルール5「飛び先はスクロール位置を固定ヘッダーの下に出し、一時的にハイライトする」）
 */
export function Jump({ id, active, children }) {
  const ref = useRef(null);
  const hit = active && id === active;

  useEffect(() => {
    if (!hit || !ref.current) return undefined;
    const el = ref.current;
    const t = setTimeout(() => {
      const top = el.getBoundingClientRect().top + window.scrollY - 74;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }, 80);
    return () => clearTimeout(t);
  }, [hit]);

  return (
    <div ref={ref} className={hit ? 'jump-hit' : undefined}>
      {children}
    </div>
  );
}

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

// 項目18：中身が同じ行は描き直さない。件数が増えたときに効く。
export const Row = memo(function Row({ glyph, title, sub, onClick, right, avatar = null, preload = '' }) {
  // preload に画面名を渡すと、指が触れた時点でその画面を読み始める（新項目01）。
  const warm = preload ? () => preloadView(preload) : undefined;
  return (
    <button type="button" className="row" onClick={onClick} onPointerDown={warm} onPointerEnter={warm}>
      {avatar}
      {!avatar && glyph && <span className="g">{glyph}</span>}
      <span className="body">
        <span className="t">{title}</span>
        {sub && <span className="s">{sub}</span>}
      </span>
      <span className="arrow">{right ?? '›'}</span>
    </button>
  );
});

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

/**
 * 最小限の Markdown 表示（外部ライブラリを使わない方針のため自前）。
 *
 * 新項目18：長い成果物は最初から全部描かない。
 * 段落が multiline を超えたら先頭だけ描き、「続きを読む」で伸ばす。
 * 一度伸ばしたら畳まない（読んでいる途中で縮むと場所を見失うため）。
 */
export function Doc({ text, fold = 24 }) {
  const blocks = toBlocks(text || '');
  const [expanded, setExpanded] = useState(false);
  const folded = fold > 0 && blocks.length > fold && !expanded;
  const shown = folded ? blocks.slice(0, fold) : blocks;

  return (
    <div className="doc">
      {shown.map((b, i) => {
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
      {folded && (
        <button type="button" className="btn ghost small" onClick={() => setExpanded(true)}>
          続きを読む（残り {blocks.length - fold} 段落）
        </button>
      )}
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

/** 折れ線（知識の成長）。SVG を自前で描く。
// 新項目17：同じ数字なら描き直さない。
// 会社画面は数字が更新されるたびに全体が描き直されるが、折れ線は元データが
// 変わらない限り同じ絵なので、そのぶんの計算（点の座標30個ぶん）を省ける。 */
export const Spark = memo(function Spark({ series = [], field = 'total' }) {
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
});
