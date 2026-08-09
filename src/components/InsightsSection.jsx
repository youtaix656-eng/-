import { useEffect, useMemo, useState } from 'react';
import { weakTagClusters } from '../lib/weakClusters.js';
import { forgettingRisk } from '../lib/forgetting.js';
import { hardestItems } from '../lib/difficulty.js';
import { loadMissTypes, MISS_TYPES, missTypeLabel } from '../lib/missTypes.js';

// 学習インサイト（#6 忘却予測 / #7 弱点クラスタリング / #8 難易度推定 の可視化）。
//   解答履歴と復習状態から「弱いテーマ・近く忘れそう・難しい問題」を自動抽出して表示する。
export default function InsightsSection({ store }) {
  const { history, questions, srs, links } = store;

  const weak = useMemo(() => weakTagClusters(history, questions, links, { limit: 8 }), [history, questions, links]);
  const risk = useMemo(() => forgettingRisk(questions, srs, { threshold: 0.4, limit: 5 }), [questions, srs]);
  const hard = useMemo(() => hardestItems(history, questions, { minAttempts: 2, limit: 5 }), [history, questions]);

  // 間違いの型の内訳（改善3）
  const [missTypes, setMissTypes] = useState({});
  useEffect(() => { loadMissTypes().then(setMissTypes); }, []);
  const typeCounts = useMemo(() => {
    const c = {};
    for (const v of Object.values(missTypes)) if (v && v.type) c[v.type] = (c[v.type] || 0) + 1;
    return c;
  }, [missTypes]);
  const typeTotal = Object.values(typeCounts).reduce((a, b) => a + b, 0);

  const nothing = weak.length === 0 && risk.length === 0 && hard.length === 0 && typeTotal === 0;

  return (
    <>
      <div className="section-label">🧠 学習インサイト（自動抽出）</div>
      <div className="card">
        {nothing ? (
          <p className="inline-note">
            まだデータが少なめです。一問一答や学習を進めると、弱いテーマ・近く忘れそうな問題・難しい問題を自動でここに出します。
          </p>
        ) : (
          <div className="insights">
            {typeTotal > 0 && (
              <div className="insight-block">
                <div className="insight-head">間違いの型の内訳（記録{typeTotal}件）</div>
                <div className="misstype-bar">
                  {MISS_TYPES.map((t) => {
                    const n = typeCounts[t.id] || 0;
                    const pct = Math.round((n / typeTotal) * 100);
                    return (
                      <div className="misstype-seg" key={t.id} style={{ flex: Math.max(n, 0.02) }} title={`${t.label} ${n}件`}>
                        <span className="misstype-seg-lbl">{t.label} {pct}%</span>
                      </div>
                    );
                  })}
                </div>
                <div className="inline-note">対策：勘違い→対比で整理／知識不足→解説を精読／ケアレス→設問を最後まで確認。</div>
              </div>
            )}
            {weak.length > 0 && (
              <div className="insight-block">
                <div className="insight-head">弱点テーマ（誤答が多い順）</div>
                <div className="chip-row">
                  {weak.map((w) => (
                    <span key={w.tag} className="chip">
                      {w.tag} <b>{w.wrong}</b>/{w.attempts}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {risk.length > 0 && (
              <div className="insight-block">
                <div className="insight-head">近く忘れそうな問題</div>
                <ul className="insight-list">
                  {risk.map((r) => (
                    <li key={r.id}>
                      <span className="insight-risk">{Math.round(r.risk * 100)}%</span>
                      {String(r.question.question || '').slice(0, 34)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {hard.length > 0 && (
              <div className="insight-block">
                <div className="insight-head">あなたに難しい問題（誤答率が高い）</div>
                <ul className="insight-list">
                  {hard.map((h) => (
                    <li key={h.id}>
                      <span className="insight-risk">{Math.round(h.difficulty * 100)}%</span>
                      {String(h.question.question || '').slice(0, 34)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
