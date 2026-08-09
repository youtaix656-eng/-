import { useEffect, useMemo, useState } from 'react';
import { buildGraphFromSolved, todaysLinks } from '../lib/kgService.js';
import { graphStats, neighbors } from '../lib/knowledgeGraph.js';
import { nodeDegrees, isolatedConcepts } from '../lib/learnerModel.js';
import { recommendNext } from '../lib/kgRecommend.js';
import { effectiveStrength } from '../lib/assocStrength.js';
import { shortestPath, pathRelations, connectedComponents, crossSubjectBridges } from '../lib/graphAlgos.js';
import { recallPairs } from '../lib/kgRecall.js';
import { conceptsOf } from '../lib/concepts.js';
import AssocTrainer from './AssocTrainer.jsx';
import AssocQuiz from './AssocQuiz.jsx';
import { loadAssocReview, isAssocDue } from '../lib/assocReview.js';
import { assocKey } from '../lib/assocReview.js';

function firstSentence(text) {
  const s = String(text || '').trim();
  const m = s.match(/^[^。]*。/);
  return m ? m[0] : s.slice(0, 60);
}

// 強さ→ヒートレベル（#27）
function heatLevel(v, max) {
  if (max <= 0) return 'mild';
  const r = v / max;
  return r >= 0.66 ? 'hot' : r >= 0.33 ? 'warm' : 'mild';
}

// 連想リコール1件（A→タップでB）＝#17
function RecallCard({ pair }) {
  const [open, setOpen] = useState(false);
  return (
    <button className={`recall-card ${open ? 'open' : ''}`} onClick={() => setOpen((v) => !v)}>
      <span className="recall-a">{pair.a}</span>
      <span className="recall-arrow">→</span>
      <span className="recall-b">{open ? pair.b : 'タップで想起'}</span>
    </button>
  );
}

// 知識グラフ（#1〜#10 の可視化）— 解くたびに育つ知識のつながりを見せる。
export default function KnowledgeGraph({ store, onOpenKeyword }) {
  const { questions, srs, history, links } = store;
  const [pathA, setPathA] = useState('');
  const [pathB, setPathB] = useState('');
  const [fcIdx, setFcIdx] = useState(0);
  const [fcOpen, setFcOpen] = useState(false);
  const [assocMap, setAssocMap] = useState({});
  useEffect(() => { loadAssocReview().then(setAssocMap); }, []);

  const solved = useMemo(
    () => questions.filter((q) => srs[q.id] && (srs[q.id].seen || 0) > 0),
    [questions, srs]
  );
  const solvedIds = useMemo(() => new Set(solved.map((q) => q.id)), [solved]);
  const graph = useMemo(() => buildGraphFromSolved(solved, links), [solved, links]);
  const stats = graphStats(graph);

  const hubs = useMemo(() => {
    const deg = nodeDegrees(graph);
    return [...deg.entries()]
      .map(([id, d]) => ({ id, degree: d, count: graph.nodes[id]?.count || 0 }))
      .sort((a, b) => b.degree - a.degree || b.count - a.count)
      .slice(0, 8);
  }, [graph]);

  const strongEdges = useMemo(() => {
    return Object.values(graph.edges)
      .map((e) => ({ ...e, eff: effectiveStrength(e) || e.strength || e.weight || 0 }))
      .sort((a, b) => b.eff - a.eff)
      .slice(0, 10);
  }, [graph]);

  const isolated = useMemo(() => isolatedConcepts(graph, { maxDegree: 1, limit: 10 }), [graph]);
  const rec = useMemo(() => recommendNext(graph, questions, solvedIds, links, { limit: 6 }), [graph, questions, solvedIds, links]);

  const todayLinks = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const t0 = d.getTime();
    const ids = new Set(history.filter((h) => h.at >= t0).map((h) => h.questionId));
    const todayQs = questions.filter((q) => ids.has(q.id));
    return todaysLinks(todayQs, links, { limit: 10 });
  }, [history, questions, links]);

  const topHub = hubs[0];
  const hubNeighbors = useMemo(() => (topHub ? neighbors(graph, topHub.id).slice(0, 6) : []), [graph, topHub]);

  // 連想リコール（#17）と最短経路（#10）
  const recall = useMemo(() => recallPairs(graph, { limit: 8 }), [graph]);
  // 忘れかけの連想（#26）：復習期限が来ている連想（トレーニング済みのもの）
  const fadingLinks = useMemo(() => {
    const now = Date.now();
    return recallPairs(graph, { limit: 60 })
      .filter((p) => {
        const k = assocKey(p.a, p.b);
        return assocMap[k] && isAssocDue(assocMap, k, now);
      })
      .slice(0, 8);
  }, [graph, assocMap]);
  const conceptList = useMemo(
    () => Object.keys(graph.nodes).sort((a, b) => a.localeCompare(b, 'ja')),
    [graph]
  );
  const path = useMemo(
    () => (pathA && pathB ? shortestPath(graph, pathA, pathB) : null),
    [graph, pathA, pathB]
  );
  const pathRels = useMemo(() => (path && path.length > 1 ? pathRelations(graph, path) : []), [graph, path]);
  const heatMax = strongEdges.length ? strongEdges[0].eff : 0;

  // 概念フラッシュカード（#16＋#20）：つながりの多い順に概念をめくる
  const fcConcepts = useMemo(() => {
    const deg = nodeDegrees(graph);
    return Object.keys(graph.nodes).sort((a, b) => (deg.get(b) || 0) - (deg.get(a) || 0));
  }, [graph]);
  const fcConcept = fcConcepts[fcIdx % (fcConcepts.length || 1)];
  const fcCard = useMemo(() => {
    if (!fcConcept) return null;
    return {
      neighbors: neighbors(graph, fcConcept).slice(0, 8),
      questions: questions.filter((q) => conceptsOf(q, links).includes(fcConcept)).slice(0, 3),
      def: firstSentence((questions.find((q) => (q.explanation || '').includes(fcConcept)) || {}).explanation),
    };
  }, [graph, fcConcept, questions, links]);
  const fcNext = () => { setFcOpen(false); setFcIdx((i) => (i + 1) % (fcConcepts.length || 1)); };
  const fcPrev = () => { setFcOpen(false); setFcIdx((i) => (i - 1 + (fcConcepts.length || 1)) % (fcConcepts.length || 1)); };

  // 週次つながりレポート（#28）：日ごとに“つないだ概念ペア”の数
  const weekly = useMemo(() => {
    const base = new Date(); base.setHours(0, 0, 0, 0);
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d0 = base.getTime() - i * 86400000;
      const d1 = d0 + 86400000;
      const ids = new Set(history.filter((h) => h.at >= d0 && h.at < d1).map((h) => h.questionId));
      const qs = questions.filter((q) => ids.has(q.id));
      days.push(todaysLinks(qs, links, { limit: 9999 }).length);
    }
    return days;
  }, [history, questions, links]);
  const weekMax = Math.max(1, ...weekly);
  const weekTotal = weekly.reduce((a, b) => a + b, 0);

  // クラスタ（#13）と 科目横断ブリッジ（#12）
  const clusters = useMemo(() => connectedComponents(graph).slice(0, 5), [graph]);
  const bridges = useMemo(() => crossSubjectBridges(graph, { limit: 8 }), [graph]);

  // グラフのエクスポート（#30）：JSON と 簡易SVG をダウンロード
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'knowledge-graph.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const exportSvg = () => {
    const ids = hubs.map((h) => h.id);
    const N = ids.length || 1;
    const R = 120, cx = 150, cy = 150;
    const pos = {};
    ids.forEach((id, i) => {
      const ang = (i / N) * Math.PI * 2 - Math.PI / 2;
      pos[id] = { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) };
    });
    const lines = [];
    for (const e of Object.values(graph.edges)) {
      if (pos[e.a] && pos[e.b]) lines.push(`<line x1="${pos[e.a].x.toFixed(1)}" y1="${pos[e.a].y.toFixed(1)}" x2="${pos[e.b].x.toFixed(1)}" y2="${pos[e.b].y.toFixed(1)}" stroke="#37b6cc" stroke-width="1" opacity="0.5"/>`);
    }
    const dots = ids.map((id) => `<circle cx="${pos[id].x.toFixed(1)}" cy="${pos[id].y.toFixed(1)}" r="5" fill="#37b6cc"/><text x="${(pos[id].x + 6).toFixed(1)}" y="${pos[id].y.toFixed(1)}" font-size="9" fill="#fff">${id}</text>`);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="#000"/>${lines.join('')}${dots.join('')}</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'knowledge-graph.svg';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (solved.length === 0) {
    return (
      <div className="view">
        <h2 className="view-title">知識グラフ</h2>
        <div className="empty">
          <div className="ico">🕸️</div>
          <p>まだつながりがありません。</p>
          <p className="inline-note">問題を解くほど、概念どうしが自動でつながり、知識のネットワークが育ちます。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <h2 className="view-title">知識グラフ</h2>
      <p className="view-desc">解いた問題から概念どうしのつながりを自動で作り、連想で思い出せる知識マップを育てます。</p>

      <div className="tiles">
        <div className="tile"><div className="num">{stats.nodes}</div><div className="lbl">概念（ノード）</div></div>
        <div className="tile"><div className="num">{stats.edges}</div><div className="lbl">つながり（辺）</div></div>
        <div className="tile"><div className="num">{todayLinks.length}</div><div className="lbl">今日つないだ</div></div>
      </div>

      {topHub && hubNeighbors.length > 0 && (
        <>
          <div className="section-label">🕸️ 中心概念とつながり</div>
          <div className="card kg-hub">
            <button className="kg-center" onClick={() => onOpenKeyword?.(topHub.id)}>{topHub.id}</button>
            <div className="kg-spokes">
              {hubNeighbors.map((n) => (
                <button key={n.other} className="kg-spoke" onClick={() => onOpenKeyword?.(n.other)}>
                  {n.other}<small>{n.type === 'coOccurs' ? '共起' : n.type}</small>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="section-label">🔗 強いつながり（連想で出やすい・色は強さ）</div>
      <div className="card">
        {strongEdges.length === 0 ? <p className="inline-note">まだありません。</p> : (
          <ul className="kg-edge-list">
            {strongEdges.map((e) => (
              <li key={`${e.a}-${e.b}-${e.type}`}>
                <i className={`kg-heat lv-${heatLevel(e.eff, heatMax)}`} title={`強さ ${e.eff.toFixed(2)}`} />
                <button className="kg-tag" onClick={() => onOpenKeyword?.(e.a)}>{e.a}</button>
                <span className="kg-rel">{e.type === 'coOccurs' ? '―' : `→(${e.type})`}</span>
                <button className="kg-tag" onClick={() => onOpenKeyword?.(e.b)}>{e.b}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 連想リコール（#17）：Aを見てBを想起→タップで確認 */}
      {recall.length > 0 && (
        <>
          <div className="section-label">🧠 連想リコール（Aから何がつながる？）</div>
          <div className="card">
            <div className="recall-grid">
              {recall.map((p, i) => <RecallCard key={i} pair={p} />)}
            </div>
            <p className="inline-note" style={{ marginTop: 8 }}>左の概念から連想し、タップで答え合わせ。連想の想起練習です。</p>
          </div>
        </>
      )}

      {/* 忘れかけの連想（#26） */}
      {fadingLinks.length > 0 && (
        <>
          <div className="section-label">⚠️ 忘れかけの連想（そろそろ復習を）</div>
          <div className="card">
            <ul className="kg-edge-list">
              {fadingLinks.map((e, i) => (
                <li key={i}>
                  <i className="kg-heat lv-warm" />
                  <span className="kg-tag">{e.a}</span><span className="kg-rel">―</span><span className="kg-tag">{e.b}</span>
                </li>
              ))}
            </ul>
            <p className="inline-note" style={{ marginTop: 6 }}>下の連想トレーニングで思い出しておきましょう。</p>
          </div>
        </>
      )}

      {/* 連想トレーニング（#25 連結の間隔反復 ＋ #22 対比識別ドリル） */}
      <AssocTrainer graph={graph} />

      {/* 連想クイズ（#23 経路クイズ ＋ #24 束グルーピング） */}
      <AssocQuiz graph={graph} />

      {/* 最短経路（#10）：AとBはどうつながる？ */}
      {conceptList.length >= 2 && (
        <>
          <div className="section-label">🧭 つながりを探す（AとBの経路）</div>
          <div className="card">
            <div className="kg-path-controls">
              <select value={pathA} onChange={(e) => setPathA(e.target.value)}>
                <option value="">概念A</option>
                {conceptList.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <span>→</span>
              <select value={pathB} onChange={(e) => setPathB(e.target.value)}>
                <option value="">概念B</option>
                {conceptList.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {pathA && pathB && (
              path && path.length > 1 ? (
                <div className="kg-path">
                  {path.map((n, i) => (
                    <span key={n} className="kg-path-node">
                      {i > 0 && <span className="kg-rel">{pathRels[i - 1]?.type === 'coOccurs' ? '―' : `→(${pathRels[i - 1]?.type})`}</span>}
                      <button className="kg-tag" onClick={() => onOpenKeyword?.(n)}>{n}</button>
                    </span>
                  ))}
                </div>
              ) : path && path.length === 1 ? (
                <p className="inline-note">同じ概念です。</p>
              ) : (
                <p className="inline-note">この2つはまだ（この端末の学習では）つながっていません。関連問題を解くとつながります。</p>
              )
            )}
          </div>
        </>
      )}

      {rec.length > 0 && (
        <>
          <div className="section-label">✨ 次に解くと広がる問題</div>
          <div className="card">
            <ul className="kg-rec-list">
              {rec.map((r) => (
                <li key={r.id}>
                  <div className="kg-rec-q">{String(r.question.question || '（図の問題）').slice(0, 40)}</div>
                  <div className="kg-rec-meta">既知 {r.bridges.slice(0, 2).join('・')} ＋ 新 {r.adds.slice(0, 2).join('・')}</div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {isolated.length > 0 && (
        <>
          <div className="section-label">🧩 孤立した知識（つなげると効く）</div>
          <div className="chip-row">
            {isolated.map((n) => (
              <button key={n.id} className="chip" onClick={() => onOpenKeyword?.(n.id)}>{n.id}</button>
            ))}
          </div>
        </>
      )}

      {/* 概念カード＝連結フラッシュカード（#16＋#20） */}
      {fcConcept && (
        <>
          <div className="section-label">🃏 概念カード（つながりをめくる）</div>
          <div className="card">
            <button className={`fc-concept ${fcOpen ? 'open' : ''}`} onClick={() => setFcOpen((v) => !v)}>
              <span className="fc-concept-name">{fcConcept}</span>
              <span className="fc-concept-hint">{fcOpen ? '' : 'タップでつながりを表示'}</span>
            </button>
            {fcOpen && fcCard && (
              <div className="fc-concept-body">
                {fcCard.def && <div className="li-def"><b>意味</b>：{fcCard.def}</div>}
                {fcCard.neighbors.length > 0 && (
                  <div className="chip-row" style={{ marginTop: 6 }}>
                    {fcCard.neighbors.map((n) => (
                      <button key={n.other} className="chip" onClick={() => onOpenKeyword?.(n.other)}>{n.other}</button>
                    ))}
                  </div>
                )}
                {fcCard.questions.length > 0 && (
                  <ul className="kg-rec-list" style={{ marginTop: 8 }}>
                    {fcCard.questions.map((q) => (
                      <li key={q.id}><div className="kg-rec-q">{String(q.question || '（図の問題）').slice(0, 38)}</div></li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button className="btn" onClick={fcPrev}>← 前</button>
              <button className="btn" onClick={fcNext}>次 →</button>
              <span className="inline-note" style={{ alignSelf: 'center' }}>{(fcIdx % fcConcepts.length) + 1}/{fcConcepts.length}</span>
            </div>
          </div>
        </>
      )}

      {/* 週次つながりレポート（#28） */}
      {weekTotal > 0 && (
        <>
          <div className="section-label">📅 今週つないだ知識（7日）</div>
          <div className="card">
            <div className="ana-trend">
              {weekly.map((c, i) => (
                <div className="ana-trend-col" key={i} title={`${c}ペア`}>
                  <div className="ana-trend-bar" style={{ height: `${Math.max(4, (c / weekMax) * 100)}%` }} />
                  <span className="ana-trend-lbl">{c}</span>
                </div>
              ))}
            </div>
            <div className="inline-note" style={{ textAlign: 'center' }}>1日ごとの“つないだ概念ペア”数。今週計 {weekTotal} ペア。</div>
          </div>
        </>
      )}

      {bridges.length > 0 && (
        <>
          <div className="section-label">🌉 科目をまたぐつながり（横断ブリッジ）</div>
          <div className="card">
            <ul className="kg-edge-list">
              {bridges.map((e) => (
                <li key={`${e.a}-${e.b}`}>
                  <button className="kg-tag" onClick={() => onOpenKeyword?.(e.a)}>{e.a}</button>
                  <span className="kg-rel">―</span>
                  <button className="kg-tag" onClick={() => onOpenKeyword?.(e.b)}>{e.b}</button>
                  <span className="inline-note">（{(e.subjectsA[0] || '')}×{(e.subjectsB[0] || '')}）</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {clusters.length > 1 && (
        <>
          <div className="section-label">🧷 知識のかたまり（クラスタ）</div>
          <div className="card">
            {clusters.map((c, i) => (
              <div key={i} className="cluster-row">
                <span className="cluster-size">{c.length}概念</span>
                <span className="cluster-members">{c.slice(0, 6).join('・')}{c.length > 6 ? ' …' : ''}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {todayLinks.length > 0 && (
        <>
          <div className="section-label">🌱 今日つないだ知識</div>
          <div className="card">
            <ul className="kg-edge-list">
              {todayLinks.map((e, i) => (
                <li key={i}>
                  <span className="kg-tag">{e.a}</span>
                  <span className="kg-rel">―</span>
                  <span className="kg-tag">{e.b}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <div className="section-label">📤 グラフを書き出す</div>
      <div className="card">
        <div className="btn-row">
          <button className="btn" onClick={exportSvg}>🖼️ 画像(SVG)で保存</button>
          <button className="btn" onClick={exportJson}>🗂️ データ(JSON)で保存</button>
        </div>
        <p className="inline-note" style={{ marginTop: 8 }}>知識グラフを画像やデータとして書き出せます（バックアップ・共有用）。</p>
      </div>
    </div>
  );
}
