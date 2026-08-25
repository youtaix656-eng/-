// AI社員の画面。主要6役職を円環で、追加役職はサブメンバー一覧で見せる。

import { useState } from 'react';
import OrgMap from './OrgMap.jsx';
import { Card, Row, SectionTitle, Empty } from './ui.jsx';
import { ROLES, roleById, DEPARTMENTS } from '../data/roles.js';
import { relTime } from '../lib/format.js';

export default function Employees({ store, go }) {
  const { activeEmployees } = store;
  const [roleId, setRoleId] = useState('researcher');
  const [view, setView] = useState('map'); // 'map' | 'dept'

  const role = roleById(roleId);
  const seats = activeEmployees
    .filter((e) => e.roleId === roleId)
    .sort((a, b) => (a.seat || 1) - (b.seat || 1));

  const extraRoles = ROLES.filter((r) => !r.core);

  return (
    <div className="screen fade-in">
      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={`chip ${view === 'map' ? 'on' : ''}`}
          onClick={() => setView('map')}
        >
          円環図
        </button>
        <button
          type="button"
          className={`chip ${view === 'dept' ? 'on' : ''}`}
          onClick={() => setView('dept')}
        >
          部署別
        </button>
        <span style={{ flex: 1 }} />
        <button type="button" className="chip" onClick={() => go('hire')}>
          ＋ 雇う
        </button>
      </div>

      {view === 'map' ? (
        <>
          <OrgMap employees={activeEmployees} selectedRoleId={roleId} onPickRole={setRoleId} />

          <SectionTitle>
            {role?.name}（{seats.length}席）
          </SectionTitle>
          <p className="muted" style={{ marginTop: -4 }}>
            {role?.summary}／{role?.duties.slice(0, 4).join('・')}
          </p>

          {seats.map((e) => (
            <Row
              key={e.id}
              glyph={e.avatar}
              title={`${e.shortName}　${e.title}`}
              sub={`${e.strength || ''}・仕事${e.stats?.tasks || 0}件・${
                e.stats?.lastActiveAt ? relTime(e.stats.lastActiveAt) : '未稼働'
              }`}
              onClick={() => go('employee', e.id)}
            />
          ))}
          <button
            type="button"
            className="btn small block"
            onClick={() => {
              const emp = store.hireIntoRole(roleId);
              if (emp) go('employee', emp.id);
            }}
          >
            ＋ {role?.name}の席を増やす
          </button>

          <SectionTitle>会社の全体図</SectionTitle>
          <details className="card tight">
            <summary className="muted" style={{ cursor: 'pointer' }}>
              ▷ AI社員チームの全体図を開く（画像・少し重いので必要なときだけ）
            </summary>
            <p className="muted" style={{ marginTop: 10 }}>
              主要6人とサブメンバー、知識の流れをまとめた図です。
            </p>
            <img
              src="./ouro-team.png"
              alt="Ouro のAI社員チーム全体図"
              loading="lazy"
              style={{ width: '100%', borderRadius: 10, marginTop: 6 }}
            />
          </details>

          <SectionTitle>その他のAI社員（サブメンバー）</SectionTitle>
          {extraRoles.map((r) => {
            const count = activeEmployees.filter((e) => e.roleId === r.id).length;
            return (
              <Row
                key={r.id}
                glyph={r.glyph}
                title={`${r.name}　${r.summary}`}
                sub={count ? `${count}人が在籍` : '未雇用 — タップして雇う'}
                right={count ? '›' : '＋'}
                onClick={() => {
                  if (count) setRoleId(r.id);
                  else go('hire', r.id);
                }}
              />
            );
          })}
          {extraRoles.some((r) => activeEmployees.some((e) => e.roleId === r.id)) && (
            <p className="muted">在籍している追加役職を選ぶと、上の一覧が切り替わります。</p>
          )}
        </>
      ) : (
        DEPARTMENTS.map((d) => {
          const list = activeEmployees.filter((e) => e.departmentId === d.id);
          return (
            <Card key={d.id} title={`${d.name}（${list.length}人）`} glyph="▦">
              <p className="muted" style={{ marginTop: -6 }}>{d.desc}</p>
              {list.length ? (
                list.map((e) => (
                  <Row
                    key={e.id}
                    glyph={e.avatar}
                    title={`${e.shortName}　${e.title}`}
                    sub={`仕事${e.stats?.tasks || 0}件`}
                    onClick={() => go('employee', e.id)}
                  />
                ))
              ) : (
                <Empty>この部署にはまだ社員がいません。</Empty>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
