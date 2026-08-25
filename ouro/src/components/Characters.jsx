// AIキャラクター名鑑（会社チーム ①〜⑩ × 各3名）。
//
// 雇う前でも全員の設定を読める名簿。ここから1人ずつ、または役職ごとに雇える。
// 肖像は線画のSVG（components/Portrait.jsx）。**顔立ちで出身を描き分けてはいない。**

import { useMemo, useState } from 'react';
import { Card, Empty, Jump } from './ui.jsx';
import Portrait from './Portrait.jsx';
import { rolesOfGroup, departmentById } from '../data/roles.js';
import { charactersOf } from '../data/characters.js';
import { DEFAULT_GENRE_ID } from '../data/genres.js';
import { employeeLimit } from '../data/plans.js';

export default function Characters({ store, go, toast, highlight = null }) {
  const [openRole, setOpenRole] = useState(null);
  const roles = useMemo(() => rolesOfGroup('company'), []);

  const hiredOf = (roleId, seat) =>
    store.activeEmployees.find(
      (e) => e.roleId === roleId && e.seat === seat && (e.genreId || DEFAULT_GENRE_ID) === DEFAULT_GENRE_ID
    );

  const limit = employeeLimit(store.company?.planId, store.company?.limitOverrides);
  const room = limit - store.activeEmployees.length;

  const hireOne = (roleId, seat) => {
    if (room <= 0) {
      toast(`在籍数の上限（${limit}人）です。設定でプランを上げてください`);
      return;
    }
    const emp = store.hireCharacter(roleId, seat);
    if (emp) go('employee', emp.id);
  };

  const hireRole = (roleId) => {
    const seats = charactersOf(roleId).filter((c) => !hiredOf(roleId, c.seat));
    if (!seats.length) {
      toast('この役職の3名はすでに全員在籍しています');
      return;
    }
    if (room < seats.length) {
      toast(`在籍数の上限（${limit}人）です。設定でプランを上げてください`);
      return;
    }
    for (const c of seats) store.hireCharacter(roleId, c.seat);
    toast(`${seats.length}名を雇いました`);
  };

  const totalHired = roles.reduce(
    (n, r) => n + charactersOf(r.id).filter((c) => hiredOf(r.id, c.seat)).length,
    0
  );

  return (
    <div className="screen fade-in">
      <Card glyph="◍" title="AIキャラクター名鑑">
        <p className="muted" style={{ marginTop: -6 }}>
          事業を回す10の役割に、それぞれ3名ずつの人物設定があります（全30名）。
          在籍 <strong style={{ color: '#fff' }}>{totalHired} / 30</strong>。
          雇うと「社員」に加わり、依頼を受けられるようになります。
        </p>
        <p className="muted" style={{ marginBottom: 0 }}>
          肖像は線画で描いています。<strong style={{ color: '#fff' }}>顔立ちで出身を描き分けてはいません</strong>——
          少ない線でそれをやると戯画になるため、見分けは髪型・装い・紋章でつけ、
          出身は人物像の文章として持たせています。
        </p>
      </Card>

      {roles.map((role, i) => {
        const chars = charactersOf(role.id);
        const hired = chars.filter((c) => hiredOf(role.id, c.seat)).length;
        const open = openRole === role.id;
        return (
          <Jump key={role.id} id={role.id} active={highlight}>
            <div className="genre-block">
              <button
                type="button"
                className="role-head"
                onClick={() => setOpenRole(open ? null : role.id)}
              >
                <span className="num">{numberMark(i + 1)}</span>
                <span className="rune">{role.glyph}</span>
                <span className="body">
                  <span className="n">{role.name}</span>
                  <span className="s">{role.summary}</span>
                </span>
                <span className="badge">{hired} / {chars.length}</span>
                <span className="arrow">{open ? '▲' : '▼'}</span>
              </button>

              {open && (
                <>
                  <div className="muted" style={{ margin: '8px 0' }}>
                    {departmentById(role.departmentId)?.name}／{role.duties.join('・')}
                  </div>
                  {role.caution && (
                    <div className="muted" style={{ marginBottom: 8 }}>⚠ {role.caution}</div>
                  )}

                  {chars.map((c) => {
                    const emp = hiredOf(role.id, c.seat);
                    return (
                      <div key={c.name} className="card tight char-card">
                        <Portrait employee={{ ...c, roleId: role.id }} size={78} />
                        <div className="meta">
                          <div className="char-name">{c.name}</div>
                          <div className="char-kana">{c.kana}／{c.reading}</div>
                          <div>
                            <span className="char-origin">{c.origin}</span>
                            <span className="char-origin" style={{ marginLeft: 5 }}>{c.strength}</span>
                          </div>
                          <p className="muted" style={{ margin: '6px 0 4px', color: 'var(--ink-2)' }}>
                            {c.persona}
                          </p>
                          <p className="muted" style={{ margin: 0 }}>書き方：{c.style}</p>
                          <div className="btn-row" style={{ marginTop: 8 }}>
                            {emp ? (
                              <>
                                <span className="badge solid">在籍中</span>
                                <button type="button" className="btn small" onClick={() => go('employee', emp.id)}>
                                  詳細
                                </button>
                                <button
                                  type="button"
                                  className="btn small"
                                  onClick={() => go('compose', { employeeId: emp.id })}
                                >
                                  依頼する
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="btn small primary"
                                onClick={() => hireOne(role.id, c.seat)}
                              >
                                この人を雇う
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {hired < chars.length && (
                    <button type="button" className="btn block" onClick={() => hireRole(role.id)}>
                      ＋ {role.name}の3名をまとめて雇う
                    </button>
                  )}
                </>
              )}
            </div>
          </Jump>
        );
      })}

      {!roles.length && <Empty>キャラクターがいません。</Empty>}

      <Card glyph="⚠" title="この人たちにできないこと">
        <p className="muted" style={{ marginTop: -6, marginBottom: 0 }}>
          臨床監修者は<strong style={{ color: '#fff' }}>診断をしません</strong>。
          経理・労務は<strong style={{ color: '#fff' }}>税務・労務の最終判断をしません</strong>。
          どちらも「確認すべき点」を挙げるところまでが仕事で、
          最終判断は医師・税理士・社労士などの専門家とあなたが行います。
        </p>
      </Card>
    </div>
  );
}

function numberMark(n) {
  return '①②③④⑤⑥⑦⑧⑨⑩'[n - 1] || `${n}`;
}
