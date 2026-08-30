import { useMemo } from 'react';
import { PROFILE, RECOMMENDATIONS, ENVIRONMENT_TIPS, SHORTEST_ROUTE, AVOID_METHODS, GROWTH_AREAS, DEPRIORITIZED_TYPES, TRAINING_GAMES } from '../lib/cognitiveProfile.js';

// 認知特性チェック（本田40式＋対話診断）の結果をもとに、
// このアプリのどの機能をどう使うと定着しやすいかを提案する画面。
// 名前などの個人情報は表示しない（公開リポジトリのため、内容のみ扱う）。
export default function CognitiveStyleGuide({ onNavigate, onOpenTraining }) {
  const trainingsBySection = useMemo(() => {
    const map = new Map();
    for (const g of TRAINING_GAMES) {
      if (!map.has(g.section)) map.set(g.section, []);
      map.get(g.section).push(g);
    }
    return map;
  }, []);
  return (
    <div className="view">
      <h2 className="view-title">あなたの学習スタイル</h2>
      <p className="view-desc">
        認知特性チェック（本田40式＋対話診断）の結果から、このアプリをどう使うと定着しやすいかをまとめました。
        参考プロファイルであり、医学的・心理学的な確定診断ではありません。
      </p>

      <div className="card">
        <div className="section-label" style={{ marginTop: 0 }}>総合プロファイル</div>
        <p style={{ fontWeight: 700, fontSize: '1.05em' }}>{PROFILE.headline}</p>
        <p className="inline-note" style={{ marginTop: 0 }}>{PROFILE.summary}</p>
        {PROFILE.insight && <p className="hint">{PROFILE.insight}</p>}

        <div className="section-label">得意なタイプ</div>
        {PROFILE.strengths.map((s) => (
          <p key={s.type} className="inline-note" style={{ marginTop: 0, marginBottom: 6 }}>
            <strong>★ {s.type}</strong>：{s.note}
          </p>
        ))}

        <div className="section-label">苦手なタイプ</div>
        {PROFILE.weaknesses.map((w) => (
          <p key={w.type} className="inline-note" style={{ marginTop: 0, marginBottom: 6, opacity: 0.85 }}>
            ☆ {w.type}：{w.note}
          </p>
        ))}
      </div>

      <div className="card">
        <div className="section-label" style={{ marginTop: 0 }}>🎮 認知特性トレーニング</div>
        <p className="inline-note" style={{ marginTop: 0 }}>
          鍼灸国家試験の問題演習とは切り離した、認知特性そのものを鍛える専用のミニトレーニングです。
          得意な特性をさらに伸ばすもの・苦手な特性を鍛えるものに分けています。
        </p>
        {[...trainingsBySection.entries()].map(([section, games]) => (
          <div key={section} style={{ marginTop: 10 }}>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>{section}</p>
            {games.map((g) => (
              <div key={g.id} className="btn-row" style={{ marginTop: 4, alignItems: 'center' }}>
                <button className="btn sm" onClick={() => onOpenTraining?.(g.mode)}>▶ {g.title}</button>
                <span className="hint" style={{ margin: 0 }}>{g.type}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {GROWTH_AREAS.map((g) => (
        <div className="card" key={g.id}>
          <div className="section-label" style={{ marginTop: 0 }}>{g.rank}：{g.type}を伸ばす</div>
          <p className="inline-note" style={{ marginTop: 0 }}>{g.reason}</p>
          {g.trainings.map((t, i) => (
            <div key={t.title} style={{ marginTop: i === 0 ? 12 : 14, paddingTop: i === 0 ? 0 : 10, borderTop: i === 0 ? 'none' : '1px solid var(--border, #333)' }}>
              <p style={{ fontWeight: 600, marginTop: 0, marginBottom: 2 }}>{t.title}</p>
              <p className="hint" style={{ marginTop: 0 }}>{t.desc}</p>
              <div className="btn-row" style={{ marginTop: 6 }}>
                {t.links.map((l) => (
                  <button key={l.view + l.label} className="btn sm" onClick={() => onNavigate?.(l.view)}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="hint" style={{ marginTop: 12 }}>⏱ {g.frequency}</p>
        </div>
      ))}

      <div className="card">
        <div className="section-label" style={{ marginTop: 0 }}>優先度を下げたタイプ（参考）</div>
        {DEPRIORITIZED_TYPES.map((d) => (
          <p key={d.type} className="inline-note" style={{ marginTop: 0, marginBottom: 6, opacity: 0.85 }}>
            {d.type}：{d.reason}
          </p>
        ))}
      </div>

      <div className="card">
        <div className="section-label" style={{ marginTop: 0 }}>最短ルート（この順で組み合わせる）</div>
        {SHORTEST_ROUTE.map((step, i) => (
          <p key={i} style={{ fontWeight: 600, marginTop: i === 0 ? 0 : 4, marginBottom: 0 }}>{step}</p>
        ))}
      </div>

      <div className="card">
        <div className="section-label" style={{ marginTop: 0, color: 'var(--warn, #e0a800)' }}>労力対効果が低い学習法（他を優先）</div>
        {AVOID_METHODS.map((m, i) => (
          <p key={i} className="inline-note" style={{ marginTop: i === 0 ? 0 : 4 }}>✕ {m}</p>
        ))}
      </div>

      {RECOMMENDATIONS.map((r) => (
        <div className="card" key={r.id}>
          <div className="section-label" style={{ marginTop: 0 }}>{r.category}</div>
          <p style={{ fontWeight: 600, marginTop: 0 }}>{r.title}</p>
          <p className="inline-note" style={{ marginTop: 0 }}>{r.reason}</p>
          {r.note && <p className="hint">{r.note}</p>}
          <div className="btn-row" style={{ marginTop: 8 }}>
            {r.links.map((l) => (
              <button key={l.view + l.label} className="btn primary sm" onClick={() => onNavigate?.(l.view)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="card">
        <div className="section-label" style={{ marginTop: 0 }}>学習環境について</div>
        {ENVIRONMENT_TIPS.map((tip, i) => (
          <p key={i} className="inline-note" style={{ marginTop: i === 0 ? 0 : 6 }}>{tip}</p>
        ))}
      </div>
    </div>
  );
}
