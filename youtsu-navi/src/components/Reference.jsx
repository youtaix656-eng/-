import React, { useState } from 'react';
import { SEVERITY } from '../data/redFlags.js';
import { PRECAUTIONS } from '../data/precautions.js';
import { LICENSES, MODALITIES } from '../data/licenses.js';
import { SOURCES, REVIEW_STATUS, reviewProgress } from '../data/sources.js';
import { PLANNED_SYMPTOMS } from '../data/symptoms.js';

const TABS = [
  { id: 'flags', label: 'レッドフラグ' },
  { id: 'care', label: '要配慮対象' },
  { id: 'scope', label: '資格の範囲' },
  { id: 'source', label: '根拠・出典' },
];

/** 資料 — 評価をしていない時でも、その場で引ける形で常備する */
export default function Reference({ symptom }) {
  const [tab, setTab] = useState('flags');
  const progress = reviewProgress();

  return (
    <div className="page">
      <div className="row" role="tablist" style={{ gap: 8 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`btn slim${tab === t.id ? '' : ' secondary'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'flags' && (
        <div className="stack">
          <div className="card">
            <h2>安全トリアージ｜レッドフラグ一覧</h2>
            <p className="muted small">
              施術者の安全な判断を補助するための一覧です。医療行為の代替ではありません。単独の項目だけで判断せず、重なりと経過で判断してください。
            </p>
          </div>
          {symptom.redFlags.map((f) => (
            <div key={f.id} className={`flag ${f.severity}`}>
              <h4>
                <span className={`sev-tag ${f.severity}`}>{SEVERITY[f.severity].label}</span>
                {f.category}
              </h4>
              <p style={{ margin: '2px 0' }}>{f.label}</p>
              <p className="small muted" style={{ margin: 0 }}>
                疑われる病態：{f.suspect}
              </p>
              <p className="small" style={{ margin: '4px 0 0' }}>{SEVERITY[f.severity].action}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'care' && (
        <div className="stack">
          <div className="card">
            <h2>要配慮対象への対応</h2>
            <p className="muted small">評価画面で該当を選ぶと、結果画面にも自動で表示されます。</p>
          </div>
          {PRECAUTIONS.map((c) => (
            <details className="acc" key={c.id}>
              <summary>{c.title}</summary>
              <div>
                <p className="section-title">禁忌・避けること</p>
                <ul className="list tight">
                  {c.contraindications.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="section-title">推奨アプローチ</p>
                <ul className="list tight">
                  {c.recommended.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="section-title">この症状が出たら中止・受診</p>
                <ul className="list tight">
                  {c.stopSigns.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            </details>
          ))}
        </div>
      )}

      {tab === 'scope' && (
        <div className="stack">
          <div className="card">
            <h2>資格別の業務範囲</h2>
            <p className="muted small">
              ※要確認：ここに書いた範囲は一般的な整理です。実務上の可否は関係法令・通知・自治体の解釈によって異なります。判断は施術者ご自身で行ってください。
            </p>
          </div>
          {LICENSES.map((l) => (
            <details className="acc" key={l.id}>
              <summary>{l.name}（{l.kind}）</summary>
              <p className="small">{l.summary}</p>
              <div>
                <p className="section-title">アプリ上で「範囲内」として扱う手段</p>
                <div className="chips">
                  {l.allowed.map((m) => (
                    <span className="chip" key={m}>{MODALITIES[m]}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="section-title">注意点</p>
                <ul className="list tight">
                  {l.cautions.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            </details>
          ))}
        </div>
      )}

      {tab === 'source' && (
        <div className="stack">
          <div className="card">
            <h2>提案ロジックの根拠</h2>
            <p className="muted small">
              監修レビュー（企画書 Phase 1.5）の進捗：{progress.reviewed} / {progress.total} 件（{progress.pct}%）。
              医師・専門家の確認が済んだ項目から「監修済み」に切り替えます。
            </p>
          </div>
          {SOURCES.map((s) => (
            <div className="card" key={s.id}>
              <h3>{s.title}</h3>
              <p className="small muted" style={{ margin: 0 }}>
                {s.author}／{s.publisher}
                {s.year ? `／${s.year}` : ''}／{s.kind}
              </p>
              <p className="small" style={{ margin: '6px 0 0' }}>{s.note}</p>
              <span className="chip">{REVIEW_STATUS[s.review].label}</span>
            </div>
          ))}
          <div className="card">
            <h3>今後の対象症状（Phase 4）</h3>
            <p className="muted small">症状タグは汎用スキーマで設計しているため、同じ構造のまま追加できます。</p>
            <div className="chips">
              {PLANNED_SYMPTOMS.map((p) => (
                <span className="chip" key={p.id}>{p.name}（準備中）</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
