import { useEffect, useMemo, useState } from 'react';
import {
  coverageBySubject, coverageLevel, coverageSummary, neededToExitThin, EXAM_SESSIONS,
} from '../lib/coverage.js';
import { integratedCoverage } from '../lib/integratedCoverage.js';
import { EXAM_BLUEPRINTS } from '../data/examBlueprint.js';
import { daikoumokuRank } from '../lib/pastExamTrends.js';
import { priorityTodo, thinSubjectsText, requestTemplate } from '../lib/coveragePriority.js';
import { roundGapsBySubject } from '../lib/roundGaps.js';
import { loadContentSeedLog, lastUpdateBySubject, latestSeedEntry } from '../lib/contentSeedLog.js';
import { extremeAccuracyAlerts } from '../lib/seedQuality.js';
import { loadUnreadablePages, addUnreadablePage, removeUnreadablePage } from '../lib/unreadablePages.js';
import { maruStatusList, maruSubjectBreakdown } from '../lib/maruPool.js';
import { CONTENT_PIPELINE_STEPS, NO_PDF_FALLBACK_NOTE } from '../data/contentPipelineChecklist.js';
import { phaseForDate } from '../data/roadmapPhases.js';

const LEVEL_LABEL = { none: '未収録', thin: '手薄', ok: '収録あり', rich: '充実' };
const RANK_BADGE = { A: '🔥A', B: '🔥B' };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function copyText(text, onToast, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    onToast?.(okMsg || 'コピーしました');
  } catch (e) {
    onToast?.('コピーできませんでした');
  }
}

// 網羅マップ・ダッシュボード（#1）
// 「出題基準の大項目 × 収録数」を全13科目で俯瞰し、手薄な所を色で可視化する。
export default function CoverageMap({ store, onStartSubject, onNavigate, onToast }) {
  const { questions, history, srs, settings, updateSettings } = store;
  const thresholdOpts = useMemo(
    () => ({ thin: settings.coverageThinThreshold ?? undefined, rich: settings.coverageRichThreshold ?? undefined }),
    [settings.coverageThinThreshold, settings.coverageRichThreshold]
  );
  const rows = useMemo(() => coverageBySubject(questions, history, thresholdOpts), [questions, history, thresholdOpts]);
  const summary = useMemo(() => coverageSummary(rows), [rows]);
  const integrated = useMemo(() => integratedCoverage(questions, EXAM_BLUEPRINTS), [questions]);
  // 大項目ごとに「過去問での頻出度（A/B/C）」を重ねる（pastExamTrends.jsのAランク集計と同じ基準）。
  // これまで網羅マップは収録数だけを見ており、「手薄なのに頻出」を見分けられなかった。
  const daiRank = useMemo(() => daikoumokuRank(questions), [questions]);
  const [openId, setOpenId] = useState(null);

  // #16：埋めるべき優先度（頻出度×手薄さ）
  const todo = useMemo(() => priorityTodo(rows, questions, { limit: 8 }), [rows, questions]);
  // #13：回の抜け漏れ
  const roundGaps = useMemo(() => roundGapsBySubject(questions), [questions]);
  // #29：○にした問題の定着率を科目別に重ねる（得意度。maruPool.jsを共用）
  const maruBySubject = useMemo(() => {
    const list = maruSubjectBreakdown(maruStatusList(questions, history, srs));
    return new Map(list.map((s) => [s.subject, s]));
  }, [questions, history, srs]);
  // #25：現在のロードマップフェーズ（フェーズ1中に埋めたい、等のメッセージに使う）
  const phase = useMemo(() => phaseForDate(todayStr()), []);

  // #6・#7・#15・#24：コンテンツ拡充ログ（useStore.jsが版上げの度に記録する）
  const [seedLog, setSeedLog] = useState([]);
  useEffect(() => { loadContentSeedLog().then(setSeedLog); }, []);
  const lastUpdateMap = useMemo(() => lastUpdateBySubject(seedLog), [seedLog]);
  const latestEntry = useMemo(() => latestSeedEntry(seedLog), [seedLog]);
  // #21：新規追加ぶんの正答率が極端に振れていないか
  const qualityAlerts = useMemo(() => extremeAccuracyAlerts(seedLog, history), [seedLog, history]);

  // #11：読み取れないリスト
  const [unreadable, setUnreadable] = useState([]);
  useEffect(() => { loadUnreadablePages().then(setUnreadable); }, []);
  const [upSubject, setUpSubject] = useState('');
  const [upNote, setUpNote] = useState('');
  const addUnreadable = () => {
    if (!upNote.trim()) return;
    addUnreadablePage({ subject: upSubject.trim(), note: upNote.trim() }).then(setUnreadable);
    setUpNote('');
  };
  const removeUnreadable = (id) => removeUnreadablePage(id).then(setUnreadable);

  // #12：標準変換プロンプトの手順の参照カード（折りたたみ）
  const [showPipeline, setShowPipeline] = useState(false);

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
        <div className="tile">
          <div className="num">{Math.round(summary.fillRatio * 100)}%</div>
          <div className="lbl">充足率（#8）</div>
        </div>
      </div>

      {latestEntry && (
        <p className="inline-note">
          🕐 最近の追加：+{latestEntry.totalAdded}問（{(latestEntry.bySubject || []).map((s) => `${s.subject}+${s.count}`).join('・')}）
        </p>
      )}

      {qualityAlerts.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--warn, #e0a800)' }}>
          <div className="section-label" style={{ marginTop: 0 }}>⚠️ 追加した問題の正答率が極端です（#21）</div>
          <p className="inline-note" style={{ marginTop: 0 }}>
            新しく追加したバッチのうち、十分に解かれているのに正答率が0%または100%のものがあります。
            問題や正解の設定に誤りがないか確認してください。
          </p>
          {qualityAlerts.map((a, i) => (
            <p className="inline-note" key={i} style={{ marginTop: 4 }}>
              {new Date(a.at).toLocaleDateString('ja-JP')}追加分：{a.questionCount}問中 正答率{Math.round(a.accuracy * 100)}%（{a.attempts}回試行）
            </p>
          ))}
        </div>
      )}

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
              <strong style={{ color: '#b45309' }}>手薄（科目ごとのしきい値未満）</strong>：
              {summary.thin.map((r) => `${r.name}(${r.total}/${r.thinThreshold})`).join('・')}
            </p>
          )}
          {phase && (phase.id === 'p1' || phase.id === 'p2') && (summary.none.length > 0 || summary.thin.length > 0) && (
            <p className="inline-note" style={{ marginTop: 4 }}>
              🗺️ 今は「{phase.label}」の期間です（#25）。この期間のうちに上の科目を埋めておきましょう。
            </p>
          )}

          {/* #16：頻出度×手薄さで埋めるべき順に並べたToDo */}
          {todo.length > 0 && (
            <>
              <div className="inline-note" style={{ marginTop: 8, fontWeight: 700 }}>埋めるべき順（頻出度×手薄さ）</div>
              <ol style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                {todo.map((t, i) => (
                  <li key={i} className="inline-note">
                    {t.subject}{t.daikoumoku ? `｜${t.daikoumoku}` : ''}：{t.reason}
                  </li>
                ))}
              </ol>
            </>
          )}

          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn ghost sm" onClick={() => copyText(thinSubjectsText(rows), onToast, '手薄科目の内訳をコピーしました')}>
              📋 手薄科目の内訳をコピー（#9）
            </button>
            {todo[0] && (
              <button className="btn ghost sm" onClick={() => copyText(requestTemplate(todo[0].subject), onToast, '依頼文をコピーしました')}>
                📝 「{todo[0].subject}」の依頼文をコピー（#10）
              </button>
            )}
          </div>
        </div>
      )}

      {/* #2・#28：しきい値の設定 */}
      <div className="section-label">⚙️ 手薄／充実のしきい値</div>
      <div className="card">
        <p className="inline-note" style={{ marginTop: 0 }}>
          既定では、出題基準の大項目数が分かる科目（今は医療概論のみ）だけ目安を自動計算し、
          他の科目は既定値（手薄20問未満・充実60問以上）を使います。ここで数を入れると全科目共通で上書きできます。
        </p>
        <div className="search-grid">
          <label className="mini-field">
            <span>手薄のしきい値（未満）</span>
            <input
              type="number"
              min="1"
              placeholder="自動/既定"
              value={settings.coverageThinThreshold ?? ''}
              onChange={(e) => updateSettings({ coverageThinThreshold: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </label>
          <label className="mini-field">
            <span>充実のしきい値（以上）</span>
            <input
              type="number"
              min="1"
              placeholder="自動/既定"
              value={settings.coverageRichThreshold ?? ''}
              onChange={(e) => updateSettings({ coverageRichThreshold: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </label>
        </div>
        {(settings.coverageThinThreshold != null || settings.coverageRichThreshold != null) && (
          <button
            className="btn ghost sm"
            style={{ marginTop: 8 }}
            onClick={() => updateSettings({ coverageThinThreshold: null, coverageRichThreshold: null })}
          >
            既定に戻す
          </button>
        )}
      </div>

      {/* #13：回の抜け漏れ */}
      {roundGaps.length > 0 && (
        <div className="card">
          <div className="section-label" style={{ marginTop: 0 }}>🔍 回（第◯回）の収録抜け漏れ</div>
          <p className="inline-note" style={{ marginTop: 0 }}>
            他の科目には複数収録されている回が、その科目だけ無い場合に表示します
            （その回のPDFがまだ処理されていない可能性）。
          </p>
          {roundGaps.slice(0, 8).map((g) => (
            <p className="inline-note" key={g.subject} style={{ marginTop: 4 }}>
              <strong>{g.subject}</strong>：第{g.missing.join('・第')}回が未収録
            </p>
          ))}
        </div>
      )}

      {/* #11：読み取れないリスト */}
      <div className="section-label">📝 読み取れないリスト</div>
      <div className="card">
        <p className="inline-note" style={{ marginTop: 0 }}>
          過去問PDFで読み取れなかったページを控えておくメモです。後で読み取れたら削除してください
          （削除した旨は必ず連絡する運用です）。
        </p>
        {unreadable.length > 0 && (
          <ul style={{ margin: '0 0 8px', paddingLeft: 0, listStyle: 'none' }}>
            {unreadable.map((e) => (
              <li key={e.id} className="stat-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="inline-note" style={{ flex: 1 }}>
                  {new Date(e.at).toLocaleDateString('ja-JP')}　{e.subject ? `【${e.subject}】` : ''}{e.note}
                </span>
                <button className="btn ghost sm" onClick={() => removeUnreadable(e.id)}>削除</button>
              </li>
            ))}
          </ul>
        )}
        <div className="search-grid">
          <label className="mini-field">
            <span>科目（任意）</span>
            <input type="text" value={upSubject} onChange={(e) => setUpSubject(e.target.value)} placeholder="例：関係法規" />
          </label>
          <label className="mini-field">
            <span>ページ・内容</span>
            <input type="text" value={upNote} onChange={(e) => setUpNote(e.target.value)} placeholder="例：p.12 図が不鮮明" />
          </label>
        </div>
        <button className="btn sm" style={{ marginTop: 8 }} onClick={addUnreadable} disabled={!upNote.trim()}>追加</button>
      </div>

      {/* #12・#14：標準変換プロンプトの手順（参照用） */}
      <div className="card">
        <button className="btn ghost" style={{ width: '100%', textAlign: 'left' }} onClick={() => setShowPipeline((v) => !v)}>
          {showPipeline ? '▼' : '▶'} 標準変換プロンプトの手順（参照）
        </button>
        {showPipeline && (
          <div style={{ marginTop: 10 }}>
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              {CONTENT_PIPELINE_STEPS.map((s) => (
                <li key={s.no} className="inline-note" style={{ marginBottom: 4 }}>{s.text}</li>
              ))}
            </ol>
            <p className="inline-note" style={{ marginTop: 8 }}>{NO_PDF_FALLBACK_NOTE}</p>
          </div>
        )}
      </div>

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
            const lv = coverageLevel(r.total, { thin: r.thinThreshold, rich: r.richThreshold });
            const open = openId === r.id;
            const maxG = r.groups.length ? Math.max(...r.groups.map((g) => g.count)) : 1;
            const lastUpdate = lastUpdateMap.get(r.name);
            const maruInfo = maruBySubject.get(r.name);
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
                            const rank = daiRank.get(`${r.name}|${g.name}`);
                            const badge = RANK_BADGE[rank];
                            return (
                              <span
                                className={`cov-chip lv-${glv}`}
                                key={g.name}
                                title={badge ? `${g.count}問・過去問${rank}ランク（頻出）` : `${g.count}問`}
                              >
                                {badge && <span style={{ marginRight: 2 }}>{badge}</span>}
                                {g.name}
                                <b>{g.count}</b>
                                {/* #1：中項目までの内訳 */}
                                {g.subgroups.length > 0 && (
                                  <span style={{ display: 'block', fontSize: 11, opacity: 0.8, marginTop: 2 }}>
                                    {g.subgroups.map((s) => `${s.name}${s.count}`).join('・')}
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                        {/* #4：出題形式別の内訳 */}
                        <div className="inline-note" style={{ marginTop: 8 }}>
                          原問{r.format.original}問・一問一答等{r.format.derived}問・画像/図つき{r.format.withImage}問
                        </div>
                        {/* #5：手薄脱出まであと何問か */}
                        {r.total < r.thinThreshold && (
                          <div className="inline-note" style={{ marginTop: 4, color: '#b45309' }}>
                            手薄脱出まであと{neededToExitThin(r)}問（しきい値{r.thinThreshold}問）
                          </div>
                        )}
                        {/* #6・#7：最終更新 */}
                        {lastUpdate && (
                          <div className="inline-note" style={{ marginTop: 4 }}>
                            最終更新：{new Date(lastUpdate.at).toLocaleDateString('ja-JP')}（累計+{lastUpdate.totalAdded}問）
                          </div>
                        )}
                        {/* #29：○の定着率（得意度）を量の情報と並べて見せる */}
                        {maruInfo && (
                          <div className="inline-note" style={{ marginTop: 4 }}>
                            ○の定着率：{Math.round(maruInfo.masteredPct * 100)}%（{maruInfo.mastered}/{maruInfo.total}）
                            {onNavigate && (
                              <button className="btn ghost sm" style={{ marginLeft: 6 }} onClick={() => onNavigate('analytics')}>
                                得意科目分析へ
                              </button>
                            )}
                          </div>
                        )}
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
