import { useEffect, useMemo, useState } from 'react';
import { weakTagClusters } from '../lib/weakClusters.js';
import { forgettingRisk } from '../lib/forgetting.js';
import { hardestItems } from '../lib/difficulty.js';
import { loadMissTypes, MISS_TYPES, missTypeLabel, latestMissType, missTypeTrend, missTypeAnomaly } from '../lib/missTypes.js';
import { tagFrequency } from '../lib/pastExamTrends.js';
import { leechBySubject, reviewDwellBySubject } from '../lib/reviewDwell.js';
import { LEECH_THRESHOLD } from '../lib/srs.js';

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
    for (const v of Object.values(missTypes)) {
      const latest = latestMissType(v);
      if (latest) c[latest.type] = (c[latest.type] || 0) + 1;
    }
    return c;
  }, [missTypes]);
  const typeTotal = Object.values(typeCounts).reduce((a, b) => a + b, 0);
  // 誤答理由の傾向（最近増えている型）・急増検知（今日だけ明らかに多い）。Review.jsxと同じ判定を共有する。
  const typeTrend = useMemo(() => missTypeTrend(missTypes), [missTypes]);
  const typeAnomaly = useMemo(() => missTypeAnomaly(missTypes), [missTypes]);

  // 弱点テーマが、過去問で複数回出題されている頻出テーマでもあるか添える（pastExamTrends.jsのtagFrequency）。
  // 「弱いだけ」と「弱くてよく出る」を区別できるように。
  const freqByTag = useMemo(
    () => new Map(tagFrequency(questions, links, { limit: 9999 }).map((f) => [f.tag, f.roundCount])),
    [questions, links]
  );

  // #11：要注意（リーチ）の科目別内訳。#23：まだ解消していない復習対象の科目別平均滞留日数。
  const leechSubjects = useMemo(() => leechBySubject(questions, srs), [questions, srs]);
  const dwellSubjects = useMemo(() => reviewDwellBySubject(questions, srs, history), [questions, srs, history]);

  const nothing = weak.length === 0 && risk.length === 0 && hard.length === 0 && typeTotal === 0
    && leechSubjects.length === 0 && dwellSubjects.length === 0;

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
                {(typeTrend || typeAnomaly?.isAnomaly) && (
                  <div className="inline-note" style={{ marginTop: 4 }}>
                    {typeAnomaly?.isAnomaly && <>今日は誤答が{typeAnomaly.todayTotal}件と、直近の1日平均（約{typeAnomaly.avgPerDay}件）よりかなり多めです。<br /></>}
                    {typeTrend && <>最近は「{missTypeLabel(typeTrend.type)}」が増えています（直近7日で{typeTrend.count}件）。</>}
                  </div>
                )}
              </div>
            )}
            {weak.length > 0 && (
              <div className="insight-block">
                <div className="insight-head">弱点テーマ（誤答が多い順）<span className="section-hint">（🔥＝過去問で複数回出題の頻出テーマ）</span></div>
                <div className="chip-row">
                  {weak.map((w) => (
                    <span key={w.tag} className="chip">
                      {(freqByTag.get(w.tag) || 0) >= 2 && '🔥 '}{w.tag} <b>{w.wrong}</b>/{w.attempts}
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
            {leechSubjects.length > 0 && (
              <div className="insight-block">
                <div className="insight-head">要注意（{LEECH_THRESHOLD}回以上の誤答）の科目別内訳</div>
                <div className="chip-row">
                  {leechSubjects.map((s) => (
                    <span key={s.subject} className="chip">⚠️ {s.subject} <b>{s.count}</b></span>
                  ))}
                </div>
              </div>
            )}
            {dwellSubjects.length > 0 && (
              <div className="insight-block">
                <div className="insight-head">復習の滞留（未解消の平均日数・科目別）</div>
                <ul className="insight-list">
                  {dwellSubjects.slice(0, 6).map((s) => (
                    <li key={s.subject}>
                      <span className="insight-risk">{s.avgDays}日</span>
                      {s.subject}（{s.count}問）
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
