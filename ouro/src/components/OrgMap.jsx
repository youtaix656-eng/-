// 社員のマインドマップ。中央に Ouro、周囲に主要6役職。
// 7人目以降（追加役職）は右側のサブメンバー一覧に回す（仕様書 §17）。

import { memo } from 'react';
import { ROLES } from '../data/roles.js';

// 新項目17：円環と六芒星は形が変わらない。社員数や選択が同じなら描き直さない。
function OrgMap({ employees, selectedRoleId, onPickRole }) {
  const core = ROLES.filter((r) => r.core).sort((a, b) => a.order - b.order);
  const n = core.length;
  const R = 36; // 中心からの距離（%）

  const nodes = core.map((role, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return {
      role,
      x: 50 + Math.cos(angle) * R,
      y: 50 + Math.sin(angle) * R,
      count: employees.filter((e) => e.roleId === role.id && !e.archivedAt).length,
    };
  });

  return (
    <div className="orgmap">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {/* 外周の円環（ウロボロス） */}
        <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="0.4" />
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.3" />
        {/* 中心の六芒星（幾何学） */}
        <polygon
          points="50,36 62,57 38,57"
          fill="none"
          stroke="rgba(255,255,255,0.13)"
          strokeWidth="0.35"
        />
        <polygon
          points="50,64 38,43 62,43"
          fill="none"
          stroke="rgba(255,255,255,0.13)"
          strokeWidth="0.35"
        />
        <circle cx="50" cy="50" r="16" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.35" />
        {/* 中心と各役職を結ぶ線 */}
        {nodes.map((nd) => (
          <line
            key={nd.role.id}
            x1="50"
            y1="50"
            x2={nd.x}
            y2={nd.y}
            stroke={nd.role.id === selectedRoleId ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.16)'}
            strokeWidth="0.35"
          />
        ))}
      </svg>

      <div className="center">
        <div className="name">Ouro</div>
        <div className="sub">KNOWLEDGE OS</div>
      </div>

      {nodes.map((nd) => (
        <button
          key={nd.role.id}
          type="button"
          className={`node ${nd.role.id === selectedRoleId ? 'on' : ''}`}
          style={{ left: `${nd.x}%`, top: `${nd.y}%` }}
          onClick={() => onPickRole(nd.role.id)}
        >
          <span className="g">{nd.role.glyph}</span>
          <span className="t">
            {nd.role.name}
            <br />
            {nd.count}人
          </span>
        </button>
      ))}
    </div>
  );
}

export default memo(OrgMap);
