import { useMemo, useState } from 'react';
import { coverageBySubject, coverageLevel, coverageSummary, EXAM_SESSIONS } from '../lib/coverage.js';
import { integratedCoverage } from '../lib/integratedCoverage.js';
import { EXAM_BLUEPRINTS } from '../data/examBlueprint.js';

const LEVEL_LABEL = { none: '未収録', thin: '手薄', ok: '収録あり', rich: '充実' };

// 網羅マップ・ダッシュボード（#1）
// 「出題基準の大項目 × 収録数」を全13科目で俯瞰し、手薄な所を色で可視化する。
export default function CoverageMap({ store, onStartSubject }) {
  const { questions, history } = store;
  const rows = useMemo(() => coverageBySubject(questions, history), [questions, history]);
  const summary = useMemo(() => coverageSummary(rows), [rows]);
  const integrated = useMemo(() => integratedCoverage(questions, EXAM_BLUEPRINTS), [questions]);
  const [openId, setOpenId] = useState(null);

  const bySession = (sid) => rows.filter((r) => r.session === sid);

  return (
    <div className="view">
      <h2 className="view-title">網羅マップ</h2>
      <p className="view-desc">
        全13科目の<strong>収録状況</strong>を一目で。色が薄い・赤いところが<strong>手薄／未収録</strong>です。
        抜け漏れなく作るための地図として使ってください。
      </p>

      <div className="tiles">
        <div className="tile">
          <div className="num">{summary.withData}<span style={{ fontSize: 14 }}>/13</span></div>
          <div className="lbl">収録済み科目</div>
        </div>
        <div className="tile">
          <div className="num">{summary.total}</div>
          <div className="lbl">総収録数</div>
        </div>
        <div className="tile">
          <div className="num" style={{ color: summary.none.length ? 'var(--wrong, #c62828)' : 'var(--correct)' }}>
            {summary.none.length}
          </div>
          <div className="lbl">未収録の科目</div>
        </div>
      </div>

      {(summary.none.length > 0 || summary.thin.length > 0) && (
        <div className="card cov-todo">
          <div className="section-label" style={{ marginTop: 0 }}>📌 次に手を入れたい科目</div>
          {summary.none.length > 0 && (
            <p className="inline-note" style={{ marginTop: 0 }}>
              <strong style={{ color: 'var(--wrong, #c62828)' }}>未収録</strong>：
              {summary.none.map((r) => r.name).join('・')}
            </p>
          )}
          {summary.thin.length > 0 && (
            <p className="inline-note" style={{ marginTop: 4 }}>
              <strong style={{ color: '#b45309' }}>手薄（20問未満）</strong>：
              {summary.thin.map((r) => `${r.name}(${r.total})`).join('・')}
            </p>
          )}
        </div>
      )}

      {/* ===== 総合問題（連問）専用のカバー状況（⑩） ===== */}
      <div className="section-label">🧩 総合問題（連問）のカバー状況</div>
      <div className="card">
        <div className="tiles">
          <div className="tile">
            <div className="num">{integrated.totalCollected}<span style={{ fontSize: 14 }}>/{integrated.totalTarget}</span></div>
            <div className="lbl">収録数（目安）</div>
          </div>
        </div>
        {integrated.bySession.map((b) => (
          <div className="stat-row" key={b.session}>
            <div className="stat-head">
              <span className="stat-subject">{b.label}・{b.note}</span>
              <span className="stat-pct">{b.collectedCount}/{b.targetCount}問（{b.caseCount}事例）</span>
            </div>
            <div className="bar ana-bar-mastery">
              <span style={{ width: `${b.targetCount > 0 ? Math.min(100, (b.collectedCount / b.targetCount) * 100) : 0}%` }} />
            </div>
          </div>
        ))}
        <p className="inline-note" style={{ marginTop: 8 }}>
          目安は本番形式の模試（午前/午後）で使う出題数です。過去問を投げていただき次第、実データへ追加します。
        </p>
      </div>

      <div className="cov-legend">
        {['rich', 'ok', 'thin', 'none'].map((lv) => (
          <span key={lv} className="cov-legend-item">
            <i className={`cov-swatch lv-${lv}`} />{LEVEL_LABEL[lv]}
          </span>
        ))}
      </div>

      {['am', 'pm'].map((sid) => (
        <div key={sid}>
          <div className="section-label">{EXAM_SESSIONS[sid].label}（{EXAM_SESSIONS[sid].note}）</div>
          {bySession(sid).map((r) => {
            const lv = coverageLevel(r.total);
            const open = openId === r.id;
            const maxG = r.groups.length ? Math.max(...r.groups.map((g) => g.count)) : 1;
            return (
              <div className={`cov-subject lv-${lv}`} key={r.id}>
                <button className="cov-subject-head" onClick={() => setOpenId(open ? null : r.id)}>
                  <span className={`cov-dot lv-${lv}`} />
                  <span className="cov-name">{r.name}</span>
                  <span className="cov-count">{r.total > 0 ? `${r.total}問` : '未収録'}</span>
                  <span className="cov-caret">{open ? '▾' : '▸'}</span>
                </button>
                {open && (
                  <div className="cov-detail">
                    {r.total === 0 ? (
                      <p className="inline-note" style={{ margin: 0 }}>
                        まだ問題がありません。過去問の教材化で追加していきましょう。
                      </p>
                    ) : (
                      <>
                        <div className="cov-groups">
                          {r.groups.map((g) => {
                            const ratio = g.count / maxG;
                            const glv = ratio >= 0.66 ? 'rich' : ratio >= 0.33 ? 'ok' : 'thin';
                            return (
                              <span className={`cov-chip lv-${glv}`} key={g.name} title={`${g.count}問`}>
                                {g.name}
                                <b>{g.count}</b>
                              </span>
                            );
                          })}
                        </div>
                        {r.answered > 0 && (
                          <div className="inline-note" style={{ marginTop: 8 }}>
                            解答 {r.answered}回・正答率 {r.accuracy == null ? '—' : Math.round(r.accuracy * 100) + '%'}
                          </div>
                        )}
                        {onStartSubject && (
                          <button
                            className="btn primary sm block"
                            style={{ marginTop: 10 }}
                            onClick={() => onStartSubject(r.name)}
                          >
                            この科目を演習する
                          </button>
                        )}
                      </>
                    )}
                    {r.outline && (
                      <div style={{ marginTop: 10 }}>
                        <div className="inline-note" style={{ fontWeight: 700, marginBottom: 4 }}>
                          出題基準の大項目
                        </div>
                        <ul className="cov-outline">
                          {r.outline.map((o) => (
                            <li key={o.no}>{o.no}. {o.title}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <p className="inline-note" style={{ marginTop: 14 }}>
        ※ 大項目は収録済み問題のジャンルから集計しています。全出題基準の細目マップは順次拡充します。
      </p>
    </div>
  );
}
