import React, { useEffect, useRef, useState } from 'react';
import { SEVERITY } from '../data/redFlags.js';
import { PRECAUTIONS } from '../data/precautions.js';
import { LICENSES, MODALITY_META, MODALITIES, licensesForModality } from '../data/licenses.js';
import { SOURCES, REVIEW_STATUS, reviewProgress } from '../data/sources.js';
import { PLANNED_SYMPTOMS } from '../data/symptoms.js';
import { splitByScope } from '../lib/scope.js';

const TABS = [
  { id: 'flags', label: 'レッドフラグ' },
  { id: 'patterns', label: '原因パターン' },
  { id: 'care', label: '要配慮対象' },
  { id: 'scope', label: '資格の範囲' },
  { id: 'source', label: '根拠・出典' },
];

/**
 * 資料 — 評価をしていない時でも、その場で引ける形で常備する。
 * 目次（TableOfContents）からは focus={{tab, anchor}} で該当項目へ直接飛んでくる。
 */
export default function Reference({ state, symptom, focus }) {
  const [tab, setTab] = useState(focus?.tab || 'flags');
  const pending = useRef(null);
  const progress = reviewProgress();

  // 目次から来た時：タブを切り替えて、描画後に該当項目までスクロール＋強調する
  useEffect(() => {
    if (!focus) return;
    setTab(focus.tab);
    pending.current = focus.anchor;
  }, [focus]);

  useEffect(() => {
    const anchor = pending.current;
    if (!anchor) return;
    pending.current = null;
    const timer = setTimeout(() => {
      const el = document.getElementById(anchor);
      if (!el) return;
      if (el.tagName === 'DETAILS') el.open = true;
      const top = el.getBoundingClientRect().top + window.scrollY - 76;
      window.scrollTo({ top: top < 0 ? 0 : top, behavior: 'smooth' });
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 2200);
    }, 60);
    return () => clearTimeout(timer);
  }, [tab, focus]);

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
            <div key={f.id} id={`toc-flag-${f.id}`} className={`flag ${f.severity}`}>
              <h4>
                <span className={`sev-tag ${f.severity}`}>{SEVERITY[f.severity].label}</span>
                {f.tocTitle || f.category}
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

      {tab === 'patterns' && (
        <div className="stack">
          <div className="card">
            <h2>推定される原因パターン</h2>
            <p className="muted small">
              評価の結果として提示される候補の一覧です。どの所見で加点・減点されるかもここで確認できます（％は診断確率ではありません）。
            </p>
          </div>
          {symptom.patterns.map((p) => {
            const { inScope, outOfScope } = splitByScope(p.approaches || [], state.settings.licenseId);
            return (
              <details className="acc" key={p.id} id={`toc-pattern-${p.id}`}>
                <summary>{p.tocTitle || p.name}</summary>
                {/* 目次用の短縮タイトルと正式名が違う時だけ、正式名を添える（同じなら二重表示しない） */}
                {p.tocTitle && p.tocTitle !== p.name && (
                  <p className="small muted" style={{ margin: 0 }}>{p.name}</p>
                )}
                <p>{p.description}</p>
                {p.referral && <p className="notice-inline">このパターンが上位に来た時は、施術より医療機関での評価が優先されます。</p>}
                <div>
                  <p className="section-title">この候補になりやすい所見</p>
                  <div className="chips">
                    {(p.evidence || []).map((r) => (
                      <span className="chip plus" key={`e-${r.label}`}>＋ {r.label}</span>
                    ))}
                    {(p.against || []).map((r) => (
                      <span className="chip minus" key={`a-${r.label}`}>− {r.label}</span>
                    ))}
                  </div>
                </div>
                {p.checks?.length > 0 && (
                  <div>
                    <p className="section-title">確認したい所見（参考・診断ではありません）</p>
                    <ul className="list tight">
                      {p.checks.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <p className="section-title">推奨される施術アプローチ</p>
                  <ul className="list tight">
                    {inScope.map((a, i) => (
                      <li key={i}>
                        <strong className="small">{a.scope.modalityLabel}</strong>／{a.text}
                      </li>
                    ))}
                  </ul>
                  {outOfScope.length > 0 && (
                    <p className="small muted">
                      ※ 選択中の資格では業務範囲外の可能性がある提案が{outOfScope.length}件あります（評価結果の画面で確認できます）。
                    </p>
                  )}
                </div>
                <div>
                  <p className="section-title">ホームケア</p>
                  <ul className="list tight">
                    {(p.homecare || []).map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </div>
                {p.avoid?.length > 0 && (
                  <div>
                    <p className="section-title">避けたいこと</p>
                    <ul className="list tight">
                      {p.avoid.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </details>
            );
          })}
        </div>
      )}

      {tab === 'care' && (
        <div className="stack">
          <div className="card">
            <h2>要配慮対象への対応</h2>
            <p className="muted small">評価画面で該当を選ぶと、結果画面にも自動で表示されます。</p>
          </div>
          {PRECAUTIONS.map((c) => (
            <details className="acc" key={c.id} id={`toc-care-${c.id}`}>
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
            <details className="acc" key={l.id} id={`toc-license-${l.id}`}>
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

          <div className="card">
            <h2>施術手段と資格の対応</h2>
            <p className="muted small">施術方針カードは、この手段の単位で資格による出し分けを行っています。</p>
          </div>
          {Object.entries(MODALITY_META).map(([id, m]) => (
            <details className="acc" key={id} id={`toc-modality-${id}`}>
              <summary>{m.tocTitle}</summary>
              <div>
                <p className="section-title">この手段を業務範囲に含む資格</p>
                <div className="chips">
                  {licensesForModality(id).map((l) => (
                    <span className="chip" key={l.id}>{l.name}</span>
                  ))}
                  {licensesForModality(id).length === 0 && <span className="chip">該当なし</span>}
                </div>
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
            <div className="card" key={s.id} id={`toc-source-${s.id}`}>
              <h3>{s.tocTitle || s.title}</h3>
              {s.tocTitle && s.tocTitle !== s.title && (
                <p className="small muted" style={{ margin: 0 }}>{s.title}</p>
              )}
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
