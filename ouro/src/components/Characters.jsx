// AIキャラクター名鑑（会社チーム ①〜⑩ × 各3名）。
//
// 雇う前でも全員の設定を読める名簿。ここから1人ずつ、または役職ごとに雇える。
// 肖像は線画のSVG（components/Portrait.jsx）。**顔立ちで出身を描き分けてはいない。**

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Card, Empty, Jump, Action } from './ui.jsx';
import Portrait from './Portrait.jsx';
import { rolesOfGroup, departmentById, groupById, approverFor } from '../data/roles.js';
import { charactersOf, characterDetail, loadCharacterDetails } from '../data/characters.js';
import { DEFAULT_GENRE_ID } from '../data/genres.js';
import { employeeLimit } from '../data/plans.js';

const TEAMS = ['company', 'marketing'];

export default function Characters({ store, go, toast, highlight = null }) {
  const [openRole, setOpenRole] = useState(null);
  // 新項目13：役職を開く／チームを切り替える時の作り直しは急がない更新にする
  const [pending, startTransition] = useTransition();
  // 人物像・書き方は別ファイル（新項目03）。この画面を開いた時に読み込む。
  const [detailsReady, setDetailsReady] = useState(false);
  useEffect(() => {
    let alive = true;
    loadCharacterDetails()
      .then(() => alive && setDetailsReady(true))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const [team, setTeam] = useState(() => {
    // 目次などから役職を指定して来たときは、その役職のチームを開く
    const r = highlight ? rolesOfGroup('marketing').find((x) => x.id === highlight) : null;
    return r ? 'marketing' : 'company';
  });
  const roles = useMemo(() => rolesOfGroup(team), [team]);
  const group = groupById(team);

  const hiredOf = (roleId, seat) =>
    store.activeEmployees.find(
      (e) => e.roleId === roleId && e.seat === seat && (e.genreId || DEFAULT_GENRE_ID) === DEFAULT_GENRE_ID
    );

  const limit = employeeLimit(store.company?.planId, store.company?.limitOverrides);
  const room = limit - store.activeEmployees.length;

  const hireOne = async (roleId, seat) => {
    if (room <= 0) {
      toast(`在籍数の上限（${limit}人）です。設定でプランを上げてください`);
      return;
    }
    const emp = await store.hireCharacter(roleId, seat);
    if (emp) go('employee', emp.id);
  };

  const hireRole = async (roleId) => {
    const seats = charactersOf(roleId).filter((c) => !hiredOf(roleId, c.seat));
    if (!seats.length) {
      toast('この役職の3名はすでに全員在籍しています');
      return;
    }
    if (room < seats.length) {
      toast(`在籍数の上限（${limit}人）です。設定でプランを上げてください`);
      return;
    }
    // 1人ずつ順に雇う（席番号が「その組の中の通し番号」なので、
    // 同時に走らせると同じ番号を2人に割り当ててしまう）
    for (const c of seats) {
      // eslint-disable-next-line no-await-in-loop
      await store.hireCharacter(roleId, c.seat);
    }
    toast(`${seats.length}名を雇いました`);
  };

  const totalHired = roles.reduce(
    (n, r) => n + charactersOf(r.id).filter((c) => hiredOf(r.id, c.seat)).length,
    0
  );
  const totalChars = roles.reduce((n, r) => n + charactersOf(r.id).length, 0);

  return (
    <div className="screen fade-in" style={pending ? { opacity: 0.62 } : undefined}>
      <div className="btn-row" style={{ marginBottom: 12 }}>
        {TEAMS.map((t) => (
          <button
            key={t}
            type="button"
            className={`chip ${team === t ? 'on' : ''}`}
            onClick={() => startTransition(() => { setTeam(t); setOpenRole(null); })}
          >
            {groupById(t)?.name}
          </button>
        ))}
      </div>

      <Card glyph="◍" title={group?.name || 'AIキャラクター名鑑'}>
        <p className="muted" style={{ marginTop: -6 }}>
          {group?.desc}。{roles.length}の役割・全{totalChars}名。
          在籍 <strong style={{ color: '#fff' }}>{totalHired} / {totalChars}</strong>。
          雇うと「社員」に加わり、依頼を受けられるようになります。
        </p>
        {group?.commonPrompt && (
          <div className="card tight" style={{ margin: '10px 0' }}>
            <div className="muted" style={{ marginBottom: 4 }}>全員に共通で読ませているルール</div>
            <div style={{ fontSize: 13.5, whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
              {group.commonPrompt}
            </div>
          </div>
        )}
        {group?.notes?.map((n) => (
          <p key={n} className="muted" style={{ margin: '4px 0' }}>・{n}</p>
        ))}
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
                onClick={() => startTransition(() => setOpenRole(open ? null : role.id))}
              >
                <span className="num">{numberMark(i + 1)}</span>
                <span className="rune">{role.glyph}</span>
                <span className="body">
                  <span className="n">{role.teamLabel || role.name}</span>
                  <span className="s">{role.summary}</span>
                </span>
                {role.stance && <span className="badge">{STANCE_SHORT[role.stance]}</span>}
                <span className="badge">{hired} / {chars.length}</span>
                <span className="arrow">{open ? '▲' : '▼'}</span>
              </button>

              {open && (
                <>
                  <div className="muted" style={{ margin: '8px 0' }}>
                    {departmentById(role.departmentId)?.name}
                    {role.stance && `／${STANCE_LABEL[role.stance]}`}
                  </div>
                  <ul style={{ margin: '0 0 8px', paddingLeft: 20 }}>
                    {role.duties.map((d) => (
                      <li key={d} style={{ fontSize: 13, color: 'var(--ink-2)' }}>{d}</li>
                    ))}
                  </ul>
                  {role.outOfScope?.length > 0 && (
                    <div className="muted" style={{ marginBottom: 6 }}>
                      権限外：{role.outOfScope.join('／')}
                    </div>
                  )}
                  {role.requiresApprovalBy && (
                    <div className="muted" style={{ marginBottom: 6 }}>
                      ⚖ 成果物は必ず<strong style={{ color: '#fff' }}>
                        {approverFor(role.id)?.name}
                      </strong>の確認を通します（依頼すると自動で最後に入ります）
                    </div>
                  )}
                  {role.isApprover && (
                    <div className="muted" style={{ marginBottom: 6 }}>
                      ⚖ 他の担当の成果物を<strong style={{ color: '#fff' }}>承認／差し戻し</strong>します。
                      {role.noKpi && ' 成果目標（KPI）は持ちません。'}
                    </div>
                  )}
                  {role.proposalOnly && (
                    <div className="muted" style={{ marginBottom: 6 }}>
                      ⊿ 提案までが仕事です。予算の執行も施策の実行もしません。
                    </div>
                  )}
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
                            {detailsReady && (
                              <span className="char-origin">{characterDetail(c.roleId, c.seat)?.origin}</span>
                            )}
                            <span className="char-origin" style={{ marginLeft: 5 }}>{c.strength}</span>
                          </div>
                          <p className="muted" style={{ margin: '6px 0 4px', color: 'var(--ink-2)' }}>
                            {detailsReady ? characterDetail(c.roleId, c.seat)?.persona : '　'}
                          </p>
                          {detailsReady && (
                            <p className="muted" style={{ margin: 0 }}>
                              書き方：{characterDetail(c.roleId, c.seat)?.style}
                            </p>
                          )}
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
                              // 二度押しで同じ席に2人できるのを防ぐ。
                              // hireCharacter の重複チェックは読み込みを待ったあとに
                              // 走るので、それだけでは速い2連打を止められない。
                              <Action
                                className="btn small primary"
                                onClick={() => hireOne(role.id, c.seat)}
                                busyLabel="雇っています…"
                              >
                                この人を雇う
                              </Action>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {hired < chars.length && (
                    <Action className="btn block" onClick={() => hireRole(role.id)} busyLabel="雇っています…">
                      ＋ {role.name}の3名をまとめて雇う
                    </Action>
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
          マーケティングの分析・ガバナンス担当は
          <strong style={{ color: '#fff' }}>法令の最終判断をしません</strong>。
          いずれも「確認すべき点」を挙げるところまでが仕事で、
          最終判断は医師・税理士・社労士・弁護士などの専門家とあなたが行います。
        </p>
      </Card>
    </div>
  );
}

const STANCE_LABEL = {
  offense: '攻め（成果を最大化する側）',
  defense: '守り（リスクを止める側）',
  external: '対外専門（外に出る言葉を扱う）',
  advisory: '助言（数値の裏づけを出す）',
};

const STANCE_SHORT = { offense: '攻め', defense: '守り', external: '対外', advisory: '助言' };

function numberMark(n) {
  return '①②③④⑤⑥⑦⑧⑨⑩'[n - 1] || `${n}`;
}
