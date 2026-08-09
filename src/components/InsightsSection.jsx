import { useMemo } from 'react';
import { weakTagClusters } from '../lib/weakClusters.js';
import { forgettingRisk } from '../lib/forgetting.js';
import { hardestItems } from '../lib/difficulty.js';

// 学習インサイト（#6 忘却予測 / #7 弱点クラスタリング / #8 難易度推定 の可視化）。
//   解答履歴と復習状態から「弱いテーマ・近く忘れそう・難しい問題」を自動抽出して表示する。
export default function InsightsSection({ store }) {
  const { history, questions, srs, links } = store;

  const weak = useMemo(() => weakTagClusters(history, questions, links, { limit: 8 }), [history, questions, links]);
  const risk = useMemo(() => forgettingRisk(questions, srs, { threshold: 0.4, limit: 5 }), [questions, srs]);
  const hard = useMemo(() => hardestItems(history, questions, { minAttempts: 2, limit: 5 }), [history, questions]);

  const nothing = weak.length === 0 && risk.length === 0 && hard.length === 0;

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
