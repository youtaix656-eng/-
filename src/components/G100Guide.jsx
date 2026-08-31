import { G100_INTRO, G100_PHASES, G100_NOTEBOOK_NOTE } from '../data/g100Guide.js';

// G-100 System（一問一答 1〜100周実行法）— このアプリの実際の画面に対応させたガイド。
// 新しい学習の仕組みは作らず、既存機能への導線を並べるだけの案内ページ。
export default function G100Guide({ onNavigate }) {
  const jump = (view) => onNavigate && onNavigate(view);

  return (
    <div className="view">
      <h2 className="view-title">G-100 1〜100周ガイド</h2>
      <p className="view-desc">{G100_INTRO}</p>

      {G100_PHASES.map((phase) => (
        <div className="card" key={phase.id}>
          <div className="section-label" style={{ marginTop: 0 }}>
            {phase.title}（{phase.range}）
          </div>
          <p className="inline-note" style={{ marginTop: 0 }}>目的：{phase.goal}</p>

          {phase.sections.map((sec) => (
            <div key={sec.id} style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{sec.range}｜{sec.title}</div>
              <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                {sec.items.map((item, i) => (
                  <li key={i} style={{ marginBottom: 8 }}>
                    <span>{item.text}</span>
                    {item.links && item.links.length > 0 && (
                      <div className="btn-row" style={{ marginTop: 4 }}>
                        {item.links.map((l) => (
                          <button key={l.view} className="btn ghost sm" onClick={() => jump(l.view)}>
                            {l.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {phase.goalMetrics && (
            <p className="inline-note"><strong>フェーズ終了の目安値：</strong>{phase.goalMetrics}</p>
          )}
          <p className="inline-note">
            <strong>📌 終了条件：</strong>{phase.doneWhen}
          </p>
          {phase.doneLinks && phase.doneLinks.length > 0 && (
            <div className="btn-row" style={{ marginTop: 4 }}>
              {phase.doneLinks.map((l) => (
                <button key={l.view} className="btn ghost sm" onClick={() => jump(l.view)}>
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="card">
        <div className="section-label" style={{ marginTop: 0 }}>手帳記入について</div>
        <p className="inline-note" style={{ marginTop: 0 }}>{G100_NOTEBOOK_NOTE.text}</p>
        <div className="btn-row">
          {G100_NOTEBOOK_NOTE.links.map((l) => (
            <button key={l.view} className="btn ghost sm" onClick={() => jump(l.view)}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
