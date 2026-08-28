import { PROFILE, RECOMMENDATIONS, ENVIRONMENT_TIPS } from '../lib/cognitiveProfile.js';

// 認知特性チェック（本田40式＋対話診断）の結果をもとに、
// このアプリのどの機能をどう使うと定着しやすいかを提案する画面。
// 名前などの個人情報は表示しない（公開リポジトリのため、内容のみ扱う）。
export default function CognitiveStyleGuide({ onNavigate }) {
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
