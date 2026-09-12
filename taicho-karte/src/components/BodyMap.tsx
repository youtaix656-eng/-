// 体の図（前面／背面）。data/bodyRegions.ts の形をそのまま描き、タップで部位を選ぶ。
// ⚠ 線だけの絵に当たり判定を任せない——面（fill）を持たせて指でも押せるようにする。
//    キーボードでも選べるように tabIndex と aria-label を付ける。

import { useState } from 'react';
import { BODY_REGIONS, type BodyView, sideLabel } from '../data/bodyRegions.js';

interface Props {
  selectedId: string | null;
  onSelect: (regionId: string) => void;
}

export function BodyMap({ selectedId, onSelect }: Props) {
  const selectedView = BODY_REGIONS.find((r) => r.id === selectedId)?.view;
  const [view, setView] = useState<BodyView>(selectedView ?? 'front');
  const regions = BODY_REGIONS.filter((r) => r.view === view);
  return (
    <div className="bodymap">
      <div className="seg" role="tablist" aria-label="前面と背面の切り替え">
        <button type="button" role="tab" aria-selected={view === 'front'} className={view === 'front' ? 'on' : ''} onClick={() => setView('front')}>
          前面
        </button>
        <button type="button" role="tab" aria-selected={view === 'back'} className={view === 'back' ? 'on' : ''} onClick={() => setView('back')}>
          背面
        </button>
      </div>
      <svg viewBox="0 0 200 420" className="bodymap-svg" aria-label={view === 'front' ? '体の前面の図' : '体の背面の図'}>
        {/* 輪郭（薄い線）。当たり判定は持たない。部位の形を囲む単純な丸角の長方形で描く */}
        <g className="outline" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.6">
          <ellipse cx="100" cy="34" rx="24" ry="28" />
          <rect x="86" y="58" width="28" height="22" rx="6" />
          <rect x="66" y="78" width="68" height="132" rx="18" />
          <rect x="26" y="94" width="24" height="152" rx="12" />
          <rect x="150" y="94" width="24" height="152" rx="12" />
          <rect x="66" y="206" width="32" height="196" rx="14" />
          <rect x="102" y="206" width="32" height="196" rx="14" />
        </g>
        <text x={view === 'front' ? 8 : 178} y="230" className="side-mark">{view === 'front' ? '右' : '左'}</text>
        <text x={view === 'front' ? 178 : 8} y="230" className="side-mark">{view === 'front' ? '左' : '右'}</text>
        {regions.map((r) => {
          const on = r.id === selectedId;
          const label = `${sideLabel(r.side)} ${r.label}`.trim();
          const common = {
            className: `region${on ? ' on' : ''}`,
            tabIndex: 0,
            role: 'button' as const,
            'aria-label': label,
            'aria-pressed': on,
            onClick: () => onSelect(r.id),
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(r.id);
              }
            },
          };
          if (r.shape.kind === 'ellipse') {
            const s = r.shape;
            return <ellipse key={r.id} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...common}><title>{label}</title></ellipse>;
          }
          const s = r.shape;
          return <rect key={r.id} x={s.x} y={s.y} width={s.w} height={s.h} rx="4" {...common}><title>{label}</title></rect>;
        })}
      </svg>
      <p className="small">図の「左」「右」はあなた自身の左右です（前面図では左が画面の右側に来ます）。</p>
    </div>
  );
}
