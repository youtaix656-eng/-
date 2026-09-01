import { useEffect, useMemo, useState } from 'react';
import { G100_INTRO, G100_PHASES, G100_NOTEBOOK_NOTE } from '../data/g100Guide.js';
import { phaseChecks } from '../lib/g100Progress.js';
import { loadSelfKindCounts } from '../lib/starWeak.js';
import { loadRoundLog } from '../lib/roundLog.js';

const PHASE_LABELS = { phase1: 'Phase1', phase2: 'Phase2', phase3: 'Phase3', complete: '卒業（100周完了相当）' };

function formatCheckValue(c) {
  if (c.unmeasurable) return 'このアプリでは測定不可';
  if (c.value == null) return 'データ不足';
  if (c.unit === 'pct') return `${Math.round(c.value * 100)}%`;
  return `${c.value}件`;
}
function formatCheckTarget(c) {
  if (c.unmeasurable || c.target == null) return '';
  return c.unit === 'pct' ? `目標 ${Math.round(c.target * 100)}%` : `目標 ${c.target}件`;
}

// 現在の実績から、いま到達していそうなフェーズを推測するカード。
// 「周目」は正確に数えられないので断定せず、doneWhenに書かれた基準を実データで測れる範囲だけ判定し、
// 測れないものは正直に「測定不可／データ不足」と表示する。
function ProgressSummary({ store, onNavigate }) {
  const { questions, history, srs, examResults } = store;
  const [selfKindCounts, setSelfKindCounts] = useState(null);
  const [roundLog, setRoundLog] = useState(null);
  useEffect(() => { loadSelfKindCounts().then(setSelfKindCounts); }, []);
  useEffect(() => { loadRoundLog().then(setRoundLog); }, []);

  const result = useMemo(() => {
    if (selfKindCounts == null || roundLog == null) return null;
    return phaseChecks({ questions, history, srs, selfKindCounts, examResults, roundLog });
  }, [questions, history, srs, examResults, selfKindCounts, roundLog]);

  if (!result) return null;
  const phases = [result.phase1, result.phase2, result.phase3];
  return (
    <div className="card">
      <div className="section-label" style={{ marginTop: 0 }}>📍 今の実績から見た推定フェーズ</div>
      <p className="inline-note" style={{ marginTop: 0 }}>
        <strong>{PHASE_LABELS[result.currentPhaseId]}</strong> 相当です（通算900問1周の完了回数：参考値{result.lapCount}回）。
      </p>
      <p className="inline-note" style={{ marginTop: 0 }}>
        ※「周目」の正確な計測はできないため、各フェーズの終了条件を実データで測れる範囲だけ判定した目安です。断定はできません。
      </p>
      {phases.map((p, i) => (
        <div key={p.id} style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>
            {PHASE_LABELS[p.id]}：
            {p.status === 'done' && <span style={{ color: 'var(--correct)' }}> 達成済み</span>}
            {p.status === 'blocked' && <span style={{ color: 'var(--wrong)' }}> 未達</span>}
            {p.status === 'unknown' && <span style={{ color: 'var(--warn)' }}> 判定不可（データ不足）</span>}
          </div>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {p.checks.map((c) => (
              <li key={c.label} style={{ fontSize: 13 }}>
                {c.label}：{formatCheckValue(c)} {formatCheckTarget(c) && `（${formatCheckTarget(c)}）`}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button className="btn ghost sm" onClick={() => onNavigate?.('review')}>間違えた問題を開く</button>
        <button className="btn ghost sm" onClick={() => onNavigate?.('pasttrends')}>傾向と対策を開く</button>
        <button className="btn ghost sm" onClick={() => onNavigate?.('exam')}>模試を開く</button>
      </div>
    </div>
  );
}

// G-100 System（一問一答 1〜100周実行法）— このアプリの実際の画面に対応させたガイド。
// 新しい学習の仕組みは作らず、既存機能への導線を並べるだけの案内ページ。
export default function G100Guide({ store, onNavigate }) {
  const jump = (view) => onNavigate && onNavigate(view);

  return (
    <div className="view">
      <h2 className="view-title">G-100 1〜100周ガイド</h2>
      <p className="view-desc">{G100_INTRO}</p>

      {store && <ProgressSummary store={store} onNavigate={onNavigate} />}

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
