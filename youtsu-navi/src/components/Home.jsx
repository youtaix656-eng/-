import React from 'react';
import { actions } from '../lib/useStore.js';
import { RESULT_NOTICE } from '../lib/consent.js';
import { TOC_ENTRIES, TOC_CATEGORIES } from '../data/toc.js';
import { SYMPTOMS } from '../data/symptoms.js';
import { summarizeRecords } from '../lib/records.js';
import { summarizeKnowledge } from '../lib/knowledge.js';
import { formatDate } from '../lib/exporter.js';

/** ホーム — 施術中に迷わないよう、入口は「新しく評価する」1つに絞る */
export default function Home({ state, symptom, go }) {
  const hasDraft = Boolean(state.draft && state.draft.symptomId === symptom.id);
  const hasResult = Boolean(state.lastResult);
  const karte = summarizeRecords(state.records || []);
  const kb = summarizeKnowledge(state.knowledge || [], Date.now());

  return (
    <div className="page">
      <div className="card">
        <h2>{symptom.icon} {symptom.name}の評価</h2>
        <p className="muted">
          お客様の状態を選んでいくと、安全トリアージ（レッドフラグ）と、考えられる原因パターン・施術方針の候補を表示します。
        </p>
        <div>
          <p className="section-title">評価する症状</p>
          <div className="chips">
            {SYMPTOMS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`chip-btn${s.id === symptom.id ? ' on' : ''}`}
                aria-pressed={s.id === symptom.id}
                onClick={() => {
                  if (s.id === symptom.id) return;
                  actions.setSettings({ symptomId: s.id });
                  actions.clearDraft();
                }}
              >
                {s.icon} {s.name}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            actions.clearDraft();
            go('assess');
          }}
        >
          新しく評価する
        </button>
        {hasDraft && (
          <button type="button" className="btn secondary" onClick={() => go('assess')}>
            入力の続きから（{Object.keys(state.draft.answers || {}).length}項目 入力済み）
          </button>
        )}
        {hasResult && (
          <button type="button" className="btn secondary" onClick={() => go('result')}>
            前回の結果を見る
          </button>
        )}
      </div>

      <div className="card">
        <h3>施術前のかんたん確認</h3>
        <p className="muted small">迷ったらここだけでも。1つでも当てはまれば、施術より受診が優先されます。</p>
        <ul className="list">
          <li>排尿・排便の異常、会陰部のしびれ</li>
          <li>下肢の力が急に入らなくなってきた</li>
          <li>姿勢を変えても和らがない痛み・夜間痛</li>
          <li>発熱、原因不明の体重減少</li>
          <li>転倒・事故のあとの激痛</li>
          <li>お腹に拍動を触れる／激しい腹痛を伴う</li>
        </ul>
        <button type="button" className="btn secondary" onClick={() => go('ref')}>
          レッドフラグ一覧を見る
        </button>
      </div>

      <div className="card">
        <h3>🗂 カルテ（施術記録）</h3>
        {karte.total > 0 ? (
          <p className="muted small">
            {karte.total}件の記録／表示名 {karte.clients}人
            {karte.lastAt ? `／最終 ${formatDate(karte.lastAt)}` : ''}
          </p>
        ) : (
          <p className="muted small">
            評価の結果を端末内に保存し、次回の施術で前回との比較（ペインスケールの推移など）ができます。
            お名前・連絡先は入力しない設計です。
          </p>
        )}
        <button type="button" className="btn secondary" onClick={() => go('records')}>
          {karte.total > 0 ? 'カルテを開く' : 'カルテについて見る'}
        </button>
      </div>

      <div className="card">
        <h3>📚 知識ベース</h3>
        {kb.total > 0 ? (
          <p className="muted small">
            全{kb.total}件／✅運用中 {kb.active}件
            {kb.due > 0 ? `／🧪 第2チェック待ち ${kb.due}件` : ''}
          </p>
        ) : (
          <p className="muted small">
            動画・書籍・研修で学んだことを、自分の言葉の要約＋出典で貯めます。
            二段階チェックを通ったメモだけが、関係する結果画面に「参考」として出ます。
          </p>
        )}
        <button type="button" className="btn secondary" onClick={() => go('knowledge')}>
          {kb.due > 0 ? `見直しが ${kb.due}件あります` : kb.total > 0 ? '知識ベースを開く' : '知識ベースを作る'}
        </button>
      </div>

      <div className="card">
        <h3>📖 目次</h3>
        <p className="muted small">
          レッドフラグ・原因パターン・要配慮対象・資格・出典を、読み方の五十音（あ〜ん）と
          アルファベット（A〜Z）で引けます。項目をタップすると、その内容へ移動します。
        </p>
        <button type="button" className="btn secondary" onClick={() => go('toc')}>
          目次を開く（全{TOC_ENTRIES.length}項目）
        </button>
        <div className="toc-preview">
          {TOC_CATEGORIES.map((c) => (
            <button key={c.id} type="button" className="chip-btn" onClick={() => go('toc')}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

      <p className="notice-inline">{RESULT_NOTICE}</p>
    </div>
  );
}
