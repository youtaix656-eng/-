import { useEffect, useMemo, useState } from 'react';
import { recallPairs } from '../lib/kgRecall.js';
import { COMPARISONS } from '../data/mindmapData.js';
import {
  assocKey, comparisonKey, loadAssocReview, saveAssocReview, gradeAssoc, orderByDue,
} from '../lib/assocReview.js';

// 連想トレーニング：連結リコール（#25 辺のSRS）＋ 対比識別ドリル（#22）。
//   つながり／対比を間隔反復で復習し、想起の成否で次回間隔を調整する。
export default function AssocTrainer({ graph }) {
  const [mode, setMode] = useState('recall'); // recall | compare
  const [map, setMap] = useState({});
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => { loadAssocReview().then(setMap); }, []);
  useEffect(() => { setIdx(0); setRevealed(false); }, [mode]);

  const recallItems = useMemo(() => {
    const items = recallPairs(graph, { limit: 40 }).map((p) => ({ key: assocKey(p.a, p.b), a: p.a, b: p.b }));
    return orderByDue(map, items);
  }, [graph, map]);

  const compareItems = useMemo(() => {
    const items = COMPARISONS.map((c) => ({ key: comparisonKey(c.id), c }));
    return orderByDue(map, items);
  }, [map]);

  const items = mode === 'recall' ? recallItems : compareItems;
  const cur = items[idx];

  const grade = async (correct) => {
    if (!cur) return;
    const next = gradeAssoc(map, cur.key, correct);
    setMap(next);
    await saveAssocReview(next);
    setRevealed(false);
    setIdx((i) => i + 1);
  };

  const dueCount = items.filter((it) => it.due).length;

  return (
    <>
      <div className="section-label">🎯 連想トレーニング（間隔反復）</div>
      <div className="card">
        <div className="chip-row" style={{ marginBottom: 10 }}>
          <button className={`chip ${mode === 'recall' ? 'active' : ''}`} onClick={() => setMode('recall')}>連結リコール</button>
          <button className={`chip ${mode === 'compare' ? 'active' : ''}`} onClick={() => setMode('compare')}>対比ドリル</button>
          <span className="inline-note" style={{ alignSelf: 'center' }}>要復習 {dueCount}</span>
        </div>

        {!cur ? (
          <p className="inline-note">
            {items.length === 0
              ? (mode === 'recall' ? 'まだつながりがありません。問題を解くと連想が育ちます。' : '対比データがありません。')
              : '今回の分は完了！お疲れさまでした。'}
          </p>
        ) : mode === 'recall' ? (
          <div className="assoc-card">
            <div className="assoc-a">{cur.a}</div>
            <div className="assoc-arrow">→ ?</div>
            {revealed ? (
              <>
                <div className="assoc-b">{cur.b}</div>
                <div className="btn-row" style={{ marginTop: 10 }}>
                  <button className="btn self-maru" onClick={() => grade(true)}>覚えてた</button>
                  <button className="btn self-batsu" onClick={() => grade(false)}>あやふや</button>
                </div>
              </>
            ) : (
              <button className="btn primary block" style={{ marginTop: 10 }} onClick={() => setRevealed(true)}>思い出す→答え</button>
            )}
          </div>
        ) : (
          <div className="assoc-card">
            <div className="compare-title">{cur.c.title}</div>
            {revealed ? (
              <>
                <ul className="compare-members">
                  {(cur.c.members || []).map((m, i) => (<li key={i}>{m}</li>))}
                </ul>
                {cur.c.note && <div className="compare-note">💡 {cur.c.note}</div>}
                <div className="btn-row" style={{ marginTop: 10 }}>
                  <button className="btn self-maru" onClick={() => grade(true)}>区別できた</button>
                  <button className="btn self-batsu" onClick={() => grade(false)}>混同した</button>
                </div>
              </>
            ) : (
              <button className="btn primary block" style={{ marginTop: 10 }} onClick={() => setRevealed(true)}>違いを思い出す→確認</button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
