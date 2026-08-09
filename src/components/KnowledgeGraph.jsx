import { useMemo, useState } from 'react';
import { buildGraphFromSolved, todaysLinks } from '../lib/kgService.js';
import { graphStats, neighbors } from '../lib/knowledgeGraph.js';
import { nodeDegrees, isolatedConcepts } from '../lib/learnerModel.js';
import { recommendNext } from '../lib/kgRecommend.js';
import { effectiveStrength } from '../lib/assocStrength.js';
import { shortestPath, pathRelations } from '../lib/graphAlgos.js';
import { recallPairs } from '../lib/kgRecall.js';

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
    </div>
  );
}
