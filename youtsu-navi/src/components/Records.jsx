import React, { useMemo, useState } from 'react';
import { actions } from '../lib/useStore.js';
import {
  sortRecords, filterRecords, clientLabels, previousOf, compareWithPrevious, painTrend, summarizeRecords, CLIENT_LABEL_MAX,
} from '../lib/records.js';
import { homecareText, recordText, formatDateTime, formatDate, analyze, recordsToJson, backupFileName } from '../lib/exporter.js';
import { LEVELS } from '../lib/triage.js';
import { licenseById } from '../data/licenses.js';
import { downloadText } from '../lib/share.js';
import ShareBox from './ShareBox.jsx';
import VoiceMemo from './VoiceMemo.jsx';

const LEVEL_FILTERS = [
  { id: 'all', label: 'すべて' },
  { id: 'stop', label: '⛔ 中止' },
  { id: 'refer', label: '🚑 受診' },
  { id: 'caution', label: '⚠ 注意' },
  { id: 'clear', label: '✅ 該当なし' },
];

/** ペインスケールの推移（外部ライブラリを使わない簡易グラフ） */
function PainTrend({ points }) {
  if (points.length < 2) return null;
  const w = 280;
  const h = 70;
  const stepX = points.length > 1 ? w / (points.length - 1) : w;
  const y = (p) => h - (p / 10) * h;
  const path = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${y(pt.pain)}`).join(' ');
  return (
    <div>
      <p className="section-title">ペインスケールの推移（{points.length}回）</p>
      <svg className="trend" viewBox={`-4 -8 ${w + 8} ${h + 16}`} role="img" aria-label="ペインスケールの推移">
        <line x1="0" y1={y(0)} x2={w} y2={y(0)} className="trend-axis" />
        <path d={path} className="trend-line" fill="none" />
        {points.map((pt, i) => (
          <g key={pt.id}>
            <circle cx={i * stepX} cy={y(pt.pain)} r="4" className="trend-dot" />
            <text x={i * stepX} y={y(pt.pain) - 9} textAnchor="middle" className="trend-label">{pt.pain}</text>
          </g>
        ))}
      </svg>
      <p className="small muted" style={{ margin: 0 }}>
        {formatDate(points[0].at)} 〜 {formatDate(points[points.length - 1].at)}
      </p>
    </div>
  );
}

function RecordDetail({ record, records, licenseName, settings, onBack }) {
  const [label, setLabel] = useState(record.clientLabel || '');
  const [memo, setMemo] = useState(record.memo || '');
  const [followUp, setFollowUp] = useState(record.followUp || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [includePatterns, setIncludePatterns] = useState(false);
  const [sheet, setSheet] = useState(null); // 'client' | 'record'

  const { triage: tri, inference, precautions, rows } = useMemo(() => analyze(record), [record]);
  const previous = useMemo(() => previousOf(records, record), [records, record]);
  const diff = useMemo(() => compareWithPrevious(record, previous), [record, previous]);
  const trend = useMemo(() => painTrend(records, record.clientLabel), [records, record.clientLabel]);

  const dirty = label !== (record.clientLabel || '') || memo !== (record.memo || '') || followUp !== (record.followUp || '');

  return (
    <div className="stack">
      <button type="button" className="btn slim secondary" onClick={onBack}>← カルテ一覧へ</button>

      <div className="card">
        <h2>{formatDateTime(record.at)}</h2>
        <div className={`alert ${tri.levelInfo.tone}`}>
          <strong>{tri.levelInfo.label}</strong>
          {tri.flags.length > 0 && (
            <p className="alert-body small" style={{ margin: '4px 0 0' }}>
              {tri.flags.map((f) => f.tocTitle || f.category).join('／')}
            </p>
          )}
        </div>
        {inference.candidates.length > 0 && (
          <div>
            <p className="section-title">推定パターン（目安）</p>
            <ul className="list tight">
              {inference.candidates.map((c) => (
                <li key={c.pattern.id}>{c.percent}%　{c.pattern.name}</li>
              ))}
            </ul>
          </div>
        )}
        {precautions.length > 0 && (
          <div>
            <p className="section-title">要配慮</p>
            <div className="chips">
              {precautions.map((p) => <span className="chip" key={p.id}>{p.title}</span>)}
            </div>
          </div>
        )}
      </div>

      {diff && (
        <div className="card">
          <h3>前回（{formatDate(previous.at)}・{diff.days}日前）との比較</h3>
          {diff.painText ? <p style={{ margin: 0 }}>{diff.painText}</p> : <p className="muted small" style={{ margin: 0 }}>ペインスケールの記録がそろっていないため、痛みの変化は比較できません。</p>}
          {diff.triageChanged && <p className="notice-inline">安全トリアージの判定が前回（{LEVELS[previous.triageLevel]?.label || previous.triageLevel}）から変わっています。</p>}
        </div>
      )}

      {trend.length >= 2 && <div className="card"><PainTrend points={trend} /></div>}

      <div className="card">
        <h3>記録の編集</h3>
        <label className="field">
          <span className="field-label">表示名（{CLIENT_LABEL_MAX}文字まで）</span>
          <input
            className="search"
            value={label}
            maxLength={CLIENT_LABEL_MAX}
            placeholder="例：A様、田中T"
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <p className="small muted" style={{ margin: 0 }}>
          お名前そのものや連絡先は入力しないでください。同じ表示名の記録は経過としてまとまります。
        </p>
        <VoiceMemo
          label="施術内容・所見"
          value={memo}
          onChange={setMemo}
          rows={4}
          placeholder="どこに何をしたか、反応はどうだったか"
          settings={settings}
        />
        <VoiceMemo
          label="次回へ"
          value={followUp}
          onChange={setFollowUp}
          rows={3}
          placeholder="次回に確認したいこと、宿題"
          settings={settings}
        />
        <button
          type="button"
          className="btn"
          disabled={!dirty}
          onClick={() => actions.updateRecord(record.id, { clientLabel: label, memo, followUp })}
        >
          {dirty ? '保存する' : '保存済み'}
        </button>
      </div>

      <div className="card">
        <h3>書き出し・共有</h3>
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
              text={homecareText({ ...record, clientLabel: label, memo, followUp }, { includePatterns })}
              filename={`selfcare-${formatDate(record.at).replace(/\//g, '')}.txt`}
              note="お客様にお渡しする内容です。渡す前に必ず目を通してください。"
            />
          </div>
        )}

        {sheet === 'record' && (
          <ShareBox
            title="施術記録"
            text={recordText({ ...record, clientLabel: label, memo, followUp }, { licenseName })}
            filename={`karte-${formatDate(record.at).replace(/\//g, '')}.txt`}
            note="施術者用の控えです。入力内容・トリアージ・候補まで含みます。"
          />
        )}
      </div>

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

      <div className="card">
        {!confirmDelete ? (
          <button type="button" className="btn danger" onClick={() => setConfirmDelete(true)}>この記録を削除</button>
        ) : (
          <div className="stack">
            <p className="small">この記録を削除します。元に戻せません。</p>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <button type="button" className="btn secondary" onClick={() => setConfirmDelete(false)}>いいえ</button>
              <button type="button" className="btn danger" onClick={() => { actions.deleteRecord(record.id); onBack(); }}>はい、削除する</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** カルテ（施術記録）— 端末内にのみ保存される */
export default function Records({ state, go }) {
  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('all');
  const [label, setLabel] = useState('all');

  const records = useMemo(() => sortRecords(state.records || []), [state.records]);
  const labels = useMemo(() => clientLabels(records), [records]);
  const shown = useMemo(() => filterRecords(records, { query, level, label }), [records, query, level, label]);
  const stats = useMemo(() => summarizeRecords(records), [records]);
  const licenseName = licenseById(state.settings.licenseId)?.name || '';
  const current = openId ? records.find((r) => r.id === openId) : null;

  if (current) {
    return (
      <div className="page">
        <RecordDetail record={current} records={records} licenseName={licenseName} settings={state.settings} onBack={() => setOpenId(null)} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card">
        <h2>🗂 カルテ（施術記録）</h2>
        <p className="muted small">
          この端末の中にだけ保存されます。お名前・連絡先などの個人情報は入力しない設計です（表示名だけで管理します）。
        </p>
        {records.length > 0 && (
          <p className="small" style={{ margin: 0 }}>
            {stats.total}件／表示名 {stats.clients}人／受診をすすめた回 {stats.needsCare}件
            {stats.lastAt ? `／最終 ${formatDate(stats.lastAt)}` : ''}
          </p>
        )}
        {records.length === 0 && (
          <>
            <p className="muted">まだ記録がありません。評価の結果画面から「カルテに保存」で追加できます。</p>
            <button type="button" className="btn" onClick={() => go('assess')}>評価を始める</button>
          </>
        )}
      </div>

      {records.length > 0 && (
        <>
          <div className="card">
            <input className="search" type="search" value={query} placeholder="表示名・メモで探す" onChange={(e) => setQuery(e.target.value)} aria-label="カルテを検索" />
            <div className="chips">
              {LEVEL_FILTERS.map((f) => (
                <button key={f.id} type="button" className={`chip-btn${level === f.id ? ' on' : ''}`} aria-pressed={level === f.id} onClick={() => setLevel(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
            {labels.length > 0 && (
              <div className="chips">
                <button type="button" className={`chip-btn${label === 'all' ? ' on' : ''}`} onClick={() => setLabel('all')}>全員</button>
                {labels.map((l) => (
                  <button key={l.label} type="button" className={`chip-btn${label === l.label ? ' on' : ''}`} onClick={() => setLabel(l.label)}>
                    {l.label}（{l.count}）
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              className="btn slim secondary"
              onClick={() => downloadText(backupFileName(Date.now()), recordsToJson(records), 'application/json')}
            >
              💾 カルテ全体をバックアップ
            </button>
          </div>

          <div className="stack">
            {shown.map((r) => {
              const info = LEVELS[r.triageLevel] || LEVELS.clear;
              return (
                <button key={r.id} type="button" className="toc-item" onClick={() => setOpenId(r.id)}>
                  <span className="toc-icon" aria-hidden="true">
                    {r.triageLevel === 'stop' ? '⛔' : r.triageLevel === 'refer' ? '🚑' : r.triageLevel === 'caution' ? '⚠' : '✅'}
                  </span>
                  <span className="toc-text">
                    <span className="toc-title">
                      {r.clientLabel || '（表示名なし）'}
                      {typeof r.pain === 'number' && <span className="pain-badge">痛み {r.pain}</span>}
                    </span>
                    <span className="toc-sub">
                      {formatDateTime(r.at)}／{info.label}
                      {r.topPatternName ? `／${r.topPatternName}` : ''}
                    </span>
                  </span>
                  <span className="toc-arrow" aria-hidden="true">›</span>
                </button>
              );
            })}
            {shown.length === 0 && <p className="muted">条件に合う記録がありません。</p>}
          </div>
        </>
      )}
    </div>
  );
}
