// AI社員の画面。主要6役職を円環で、追加役職はサブメンバー一覧で見せる。
// 役職を選ぶと、その役職の**ジャンルごとの3席**が並ぶ。

import { useState } from 'react';
import OrgMap from './OrgMap.jsx';
import { Card, Row, SectionTitle, Empty } from './ui.jsx';
import { ROLES, roleById, DEPARTMENTS, rolesOfGroup, ROLE_GROUPS } from '../data/roles.js';
import Portrait from './Portrait.jsx';
import { allGenres, DEFAULT_GENRE_ID } from '../data/genres.js';
import { seatsOf } from '../lib/seats.js';
import { relTime } from '../lib/format.js';

export default function Employees({ store, go, preset = {} }) {
  const { activeEmployees } = store;
  const [roleId, setRoleId] = useState(preset.roleId || 'researcher');
  const [genreId, setGenreId] = useState(preset.genreId || DEFAULT_GENRE_ID);
  const [view, setView] = useState('map'); // 'map' | 'dept'

  const role = roleById(roleId);
  const genres = allGenres(store.genres);
  const seatsPerGenre = store.company?.seatsPerRole || 3;
  const seats = seatsOf(store.employees, roleId, genreId);
  const extraRoles = ROLES.filter((r) => !r.core);

  // ジャンルを絞って一覧するとき、社員がいるジャンルを先に出す
  const genreOrder = [...genres].sort((a, b) => {
    const na = seatsOf(store.employees, roleId, a.id).length;
    const nb = seatsOf(store.employees, roleId, b.id).length;
    return nb - na || (a.order || 99) - (b.order || 99);
  });

  return (
    <div className="screen fade-in">
      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button type="button" className={`chip ${view === 'map' ? 'on' : ''}`} onClick={() => setView('map')}>
          円環図
        </button>
        <button type="button" className={`chip ${view === 'dept' ? 'on' : ''}`} onClick={() => setView('dept')}>
          部署別
        </button>
        <span style={{ flex: 1 }} />
        <button type="button" className="chip" onClick={() => go('toc')}>
          ▤ 目次
        </button>
        <button type="button" className="chip" onClick={() => go('hire')}>
          ＋ 雇う
        </button>
      </div>

      {view === 'map' ? (
        <>
          <OrgMap employees={activeEmployees} selectedRoleId={roleId} onPickRole={setRoleId} />

          <SectionTitle>{role?.name}のジャンル</SectionTitle>
          <p className="muted" style={{ marginTop: -4 }}>
            {role?.summary}／1つのジャンルにつき{seatsPerGenre}席まで登録できます。
          </p>
          <div className="chips" style={{ marginBottom: 12 }}>
            {genreOrder.map((g) => {
              const n = seatsOf(store.employees, roleId, g.id).length;
              return (
                <button
                  key={g.id}
                  type="button"
                  className={`chip ${genreId === g.id ? 'on' : ''}`}
                  onClick={() => setGenreId(g.id)}
                >
                  {g.glyph} {g.name} {n}/{seatsPerGenre}
                </button>
              );
            })}
          </div>

          {seats.length ? (
            seats.map((e) => (
              <Row
                key={e.id}
                avatar={<Portrait employee={e} size={44} frame={false} />}
                title={`${e.shortName}　${e.title}`}
                sub={`${e.strength || ''}・仕事${e.stats?.tasks || 0}件・${
                  e.stats?.lastActiveAt ? relTime(e.stats.lastActiveAt) : '未稼働'
                }`}
                onClick={() => go('employee', e.id)}
              />
            ))
          ) : (
            <Empty>
              この組（{role?.name} × {genres.find((g) => g.id === genreId)?.name}）にはまだ社員がいません。
            </Empty>
          )}

          <button
            type="button"
            className="btn small block"
            onClick={async () => {
              const emp = await store.hireIntoRole(roleId, genreId);
              if (emp) go('employee', emp.id);
            }}
          >
            ＋ {genres.find((g) => g.id === genreId)?.name}の席に雇う（
            {seats.length}/{seatsPerGenre}）
          </button>

          <SectionTitle>名前つきのAIキャラクター</SectionTitle>
          <p className="muted" style={{ marginTop: -4 }}>
            会社チーム10役割 × 3名と、マーケティングチーム5役割 × 1名。
            人物設定と肖像があります。
          </p>
          <button type="button" className="btn block" onClick={() => go('characters')} style={{ marginBottom: 12 }}>
            ◍ AIキャラクター名鑑をひらく（35名）
          </button>
          {[...rolesOfGroup('company'), ...rolesOfGroup('marketing')].map((r) => {
            const count = activeEmployees.filter((e) => e.roleId === r.id).length;
            return (
              <Row
                key={r.id}
                glyph={r.glyph}
                title={`${r.name}　${r.summary}`}
                sub={count ? `${count}名が在籍` : '未雇用 — タップして名鑑を見る'}
                right={count ? '›' : '＋'}
                onClick={() => {
                  if (count) setRoleId(r.id);
                  else go('characters', { roleId: r.id });
                }}
              />
            );
          })}

          <SectionTitle>知識チーム（サブメンバー）</SectionTitle>
          {extraRoles.filter((r) => (r.group || 'knowledge') === 'knowledge').map((r) => {
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
                  else go('hire', { roleId: r.id, genreId });
                }}
              />
            );
          })}

          <SectionTitle>会社の全体図</SectionTitle>
          <details className="card tight">
            <summary className="muted" style={{ cursor: 'pointer' }}>
              ▷ AI社員チームの全体図を開く（画像・少し重いので必要なときだけ）
            </summary>
            <p className="muted" style={{ marginTop: 10 }}>
              主要6人とサブメンバー、知識の流れをまとめた図です。
            </p>
            <img
              src="./ouro-team.jpg"
              alt="Ouro のAI社員チーム全体図"
              loading="lazy"
              decoding="async"
              width="1200"
              height="800"
              style={{ width: '100%', height: 'auto', borderRadius: 10, marginTop: 6 }}
            />
          </details>
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
                    avatar={<Portrait employee={e} size={44} frame={false} />}
                    title={`${e.shortName}　${e.title}`}
                    sub={`${genreLabel(genres, e.genreId)}・仕事${e.stats?.tasks || 0}件`}
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

function genreLabel(genres, genreId) {
  const g = genres.find((x) => x.id === (genreId || DEFAULT_GENRE_ID));
  return g ? g.name : '汎用';
}
