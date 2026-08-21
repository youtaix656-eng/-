import React, { useEffect, useState } from 'react';
import { actions } from '../lib/useStore.js';
import { triage, canTreat, stackedWarning, SEVERITY } from '../lib/triage.js';
import { inferPatterns, CONFIDENCE_LABEL } from '../lib/inference.js';
import { splitByScope } from '../lib/scope.js';
import { summarize } from '../lib/tags.js';
import { precautionsFor } from '../data/precautions.js';
import { chronicityRisk, riskSummaryText } from '../lib/yellowFlags.js';
import { sourcesFor, REVIEW_STATUS } from '../data/sources.js';
import { licenseById } from '../data/licenses.js';
import { RESULT_NOTICE } from '../lib/consent.js';
import { symptomById } from '../data/symptoms.js';
import { CLIENT_LABEL_MAX } from '../lib/records.js';
import { homecareText, recordText, formatDate } from '../lib/exporter.js';
import ShareBox from './ShareBox.jsx';
import VoiceMemo from './VoiceMemo.jsx';

function Approach({ a }) {
  const out = a.scope.status === 'out';
  return (
    <div className={`approach${out ? ' out' : ''}`}>
      <div className="modality">
        {a.scope.modalityLabel}
        {out && '（業務範囲外の可能性）'}
      </div>
      <div>{a.text}</div>
      {a.caution && <div className="scope-note">⚠ {a.caution}</div>}
      {a.scope.note && <div className="scope-note">⚠ {a.scope.note}</div>}
    </div>
  );
}

function Candidate({ item, rank, licenseId, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const p = item.pattern;
  const { inScope, outOfScope } = splitByScope(p.approaches || [], licenseId);
  const sources = sourcesFor(p.sourceIds || []);

  return (
    <div className={`candidate${rank === 1 ? ' top' : ''}`}>
      <button type="button" className="candidate-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="candidate-rank">
          {item.percent}%<span>目安</span>
        </span>
        <span className="candidate-name">
          {p.name}
          <em>{p.short}</em>
        </span>
        <span aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>
      <div className="bar" aria-hidden="true">
        <span style={{ width: `${item.percent}%` }} />
      </div>
      {open && (
        <div className="candidate-body">
          <p>{p.description}</p>

          {p.referral && (
            <div className="alert warn">
              <strong>受診をすすめてください</strong>
              <p className="alert-body small">このパターンが上位に来た場合、施術で経過を見るより医療機関での評価が優先されます。</p>
            </div>
          )}

          <div>
            <p className="section-title">この候補になった理由</p>
            <div className="chips">
              {item.matched.map((m) => (
                <span className="chip plus" key={`p-${m.label}`}>＋ {m.label}</span>
              ))}
              {item.counter.map((m) => (
                <span className="chip minus" key={`m-${m.label}`}>− {m.label}</span>
              ))}
              {item.matched.length === 0 && <span className="chip">特徴的な所見の入力はありません</span>}
            </div>
          </div>

          {p.checks && p.checks.length > 0 && (
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
            {inScope.map((a, i) => (
              <Approach key={i} a={a} />
            ))}
            {outOfScope.length > 0 && (
              <details className="acc" style={{ marginTop: 10 }}>
                <summary>業務範囲外の可能性がある提案（{outOfScope.length}件）を表示</summary>
                {outOfScope.map((a, i) => (
                  <Approach key={i} a={a} />
                ))}
              </details>
            )}
          </div>

          <div>
            <p className="section-title">ホームケア提案</p>
            <ul className="list tight">
              {(p.homecare || []).map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>

          {p.avoid && p.avoid.length > 0 && (
            <div>
              <p className="section-title">避けたいこと</p>
              <ul className="list tight">
                {p.avoid.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          )}

          {sources.length > 0 && (
            <div>
              <p className="section-title">この提案の根拠</p>
              <ul className="list tight small muted">
                {sources.map((s) => (
                  <li key={s.id}>
                    {s.title}（{s.author}{s.year ? `, ${s.year}` : ''}）
                    <span className="chip" style={{ marginLeft: 6 }}>{REVIEW_STATUS[s.review].label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


/** 結果をカルテに保存する（Phase 2）。個人情報は入れない前提の表示名だけを持つ */
function SaveToKarte({ result, tri, candidates, savedId, onSaved, settings, go }) {
  const [label, setLabel] = useState('');
  const [memo, setMemo] = useState('');
  const top = candidates[0];

  if (savedId) {
    return (
      <div className="card">
        <h3>🗂 カルテに保存しました</h3>
        <p className="muted small">施術内容のメモや次回への申し送りは、カルテ画面で追記できます。</p>
        <button type="button" className="btn secondary" onClick={() => go('records')}>カルテを開く</button>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>🗂 カルテに保存</h3>
      <p className="muted small">
        この端末の中にだけ保存されます。<strong>お名前・連絡先は入力しないでください</strong>（表示名だけで管理します）。
      </p>
      <label className="field">
        <span className="field-label">表示名（任意・{CLIENT_LABEL_MAX}文字まで）</span>
        <input
          className="search"
          value={label}
          maxLength={CLIENT_LABEL_MAX}
          placeholder="例：A様、田中T"
          onChange={(e) => setLabel(e.target.value)}
        />
      </label>
      <VoiceMemo
        label="施術内容・所見（任意）"
        value={memo}
        onChange={setMemo}
        rows={3}
        placeholder="どこに何をしたか、反応はどうだったか"
        settings={settings}
        hint="手が離せない時は、設定から音声メモ入力をオンにできます。"
      />
      <button
        type="button"
        className="btn"
        onClick={() => {
          const rec = actions.saveRecord(result, {
            clientLabel: label,
            triageLevel: tri.level,
            topPatternId: top ? top.pattern.id : null,
            topPatternName: top ? top.pattern.name : '',
            topPercent: top ? top.percent : null,
            pain: typeof result.answers?.pain === 'number' ? result.answers.pain : null,
            seed: Math.floor(performance.now()),
          });
          if (memo.trim()) actions.updateRecord(rec.id, { memo });
          onSaved(rec.id);
        }}
      >
        カルテに保存する
      </button>
    </div>
  );
}

/** 結果画面 — 安全トリアージ → 推定パターン → 施術方針／ホームケア の順に出す */
export default function Result({ state, go }) {
  const result = state.lastResult;
  // 結果は保存時の症状で判定する（あとで別の症状に切り替えても過去の結果が崩れない）
  const symptom = symptomById(result ? result.symptomId : null);
  const [savedId, setSavedId] = useState(null);
  const [sheet, setSheet] = useState(null); // 'client' | 'record'
  const [includePatterns, setIncludePatterns] = useState(false);
  const licenseId = state.settings.licenseId;
  const license = licenseById(licenseId);

  // 提案結果を表示するたびに確認ログを残す（企画書 改善策 #7）
  useEffect(() => {
    if (result) actions.logResultConsent(licenseId);
    // 結果1件につき1回だけ記録する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result && result.at]);

  if (!result) {
    return (
      <div className="page">
        <div className="card">
          <h2>結果がありません</h2>
          <p className="muted">まず評価を行ってください。</p>
          <button type="button" className="btn" onClick={() => go('assess')}>
            評価を始める
          </button>
        </div>
      </div>
    );
  }

  const tags = result.tags || [];
  const tri = triage(tags, symptom.redFlags);
  const stacked = stackedWarning(tri);
  const treatable = canTreat(tri.level);
  const { candidates, others, confidence, confidenceNote } = inferPatterns(tags, symptom.patterns);
  const cares = precautionsFor(tags);
  const risk = chronicityRisk(tags);
  const rows = summarize(symptom, result.answers || {});

  return (
    <div className="page">
      {/* 1. 安全トリアージ（必ず最上部） */}
      <div className={`alert ${tri.levelInfo.tone}`} role={tri.level === 'clear' ? undefined : 'alert'}>
        <h2>
          {tri.level === 'stop' && '⛔ '}
          {tri.level === 'refer' && '🚑 '}
          {tri.level === 'caution' && '⚠ '}
          {tri.level === 'clear' && '✅ '}
          {tri.levelInfo.label}
        </h2>
        <p className="alert-body">{tri.levelInfo.message}</p>
        {stacked && <p className="alert-body small">{stacked}</p>}
      </div>

      {tri.flags.length > 0 && (
        <div className="card">
          <h3>該当したレッドフラグ（{tri.flags.length}件）</h3>
          <div className="stack">
            {tri.flags.map((f) => (
              <div key={f.id} className={`flag ${f.severity}`}>
                <h4>
                  <span className={`sev-tag ${f.severity}`}>{SEVERITY[f.severity].label}</span>
                  {f.label}
                </h4>
                <p className="small muted" style={{ margin: 0 }}>
                  疑われる病態：{f.suspect}
                </p>
                {f.detail && <p className="small" style={{ margin: '4px 0 0' }}>{f.detail}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. 要配慮対象のチェックリスト（企画書 改善策 #10） */}
      {cares.length > 0 && (
        <div className="card">
          <h3>要配慮対象のチェックリスト</h3>
          <p className="muted small">該当する方が含まれています。施術前にご確認ください。</p>
          {cares.map((c) => (
            <details className="acc" key={c.id} open={c.tone === 'high'}>
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

      {/* 3. 慢性化リスク（イエローフラッグ）— 該当がある時だけ出す */}
      {risk.hits.length > 0 && (
        <div className="card">
          <h3>🟡 慢性化のリスク：{risk.info.label}</h3>
          <p className="muted small" style={{ margin: 0 }}>
            レッドフラグ（受診の判断）とは別に、施術だけでは改善しにくいことを示す手がかりです。
            お客様を責めるためではなく、伝え方と生活の組み立てを選ぶために使ってください。
          </p>
          <p className="notice-inline">{riskSummaryText(risk)}</p>
          <div className="stack">
            {risk.hits.map((h) => (
              <details className="acc" key={h.id}>
                <summary>{h.title}</summary>
                <p className="small" style={{ margin: 0 }}>{h.detail}</p>
                <div>
                  <p className="section-title">関わり方</p>
                  <p className="small" style={{ margin: 0 }}>{h.advice}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* 4. 推定パターン */}
      <div className="card">
        <h3>推定される原因パターン</h3>
        <p className="muted small">
          ％は診断確率ではなく、入力内容が各パターンの典型像にどれだけ近いかの目安です。／絞り込み状況：
          <strong>{CONFIDENCE_LABEL[confidence]}</strong>
        </p>
        <p className="notice-inline">{confidenceNote}</p>
        {!treatable && (
          <p className="notice-inline">
            レッドフラグに該当しているため、施術方針は参考表示です。まず受診の判断を優先してください。
          </p>
        )}
        <div className="stack">
          {candidates.map((c, i) => (
            <Candidate key={c.pattern.id} item={c} rank={i + 1} licenseId={licenseId} defaultOpen={i === 0 && treatable} />
          ))}
          {candidates.length === 0 && <p className="muted">典型的なパターンに絞り込めませんでした。徒手検査・問診を追加してください。</p>}
        </div>
        {others.length > 0 && (
          <details className="acc">
            <summary>他に考えられるもの（{others.length}件）</summary>
            <ul className="list tight muted small">
              {others.map((p) => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* 5. 入力内容の確認 */}
      <details className="acc">
        <summary>入力内容を確認する</summary>
        <dl className="kv">
          {rows.map((r) => (
            <React.Fragment key={r.label}>
              <dt>{r.label}</dt>
              <dd>{r.text}</dd>
            </React.Fragment>
          ))}
        </dl>
      </details>

      <SaveToKarte
        result={result}
        tri={tri}
        candidates={candidates}
        savedId={savedId}
        onSaved={setSavedId}
        settings={state.settings}
        go={go}
      />

      <div className="card">
        <h3>📤 書き出し・共有</h3>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className={`btn slim${sheet === 'client' ? '' : ' secondary'}`} onClick={() => setSheet(sheet === 'client' ? null : 'client')}>
            🧑 お客様へ渡す
          </button>
          <button type="button" className={`btn slim${sheet === 'record' ? '' : ' secondary'}`} onClick={() => setSheet(sheet === 'record' ? null : 'record')}>
            📝 施術者の控え
          </button>
        </div>
        {sheet === 'client' && (
          <div className="stack">
            <button type="button" className="option" aria-pressed={includePatterns} onClick={() => setIncludePatterns((v) => !v)}>
              <span className="mark" aria-hidden="true">{includePatterns ? '✓' : ''}</span>
              <span>
                推定パターン名も含める
                <span className="muted small" style={{ display: 'block' }}>
                  既定では含めません（お客様に診断と受け取られるのを避けるため）
                </span>
              </span>
            </button>
            <ShareBox
              title="セルフケアのメモ"
              text={homecareText({ ...result, clientLabel: '', memo: '', followUp: '' }, { includePatterns })}
              filename={`selfcare-${formatDate(result.at).replace(/\//g, '')}.txt`}
              note="お客様にお渡しする内容です。渡す前に必ず目を通してください。"
            />
          </div>
        )}
        {sheet === 'record' && (
          <ShareBox
            title="施術記録"
            text={recordText({ ...result, clientLabel: '', memo: '', followUp: '' }, { licenseName: license ? license.name : '' })}
            filename={`karte-${formatDate(result.at).replace(/\//g, '')}.txt`}
            note="施術者用の控えです。入力内容・トリアージ・候補まで含みます。"
          />
        )}
      </div>

      <div className="card">
        <p className="small muted" style={{ margin: 0 }}>
          {RESULT_NOTICE}
          {license && `（選択中の資格：${license.name}）`}
        </p>
      </div>

      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <button type="button" className="btn secondary" onClick={() => go('assess')}>
          入力をやり直す
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            actions.clearResult();
            actions.clearDraft();
            go('assess');
          }}
        >
          新しく評価する
        </button>
      </div>
    </div>
  );
}
