import React from 'react';
import { actions } from '../lib/useStore.js';
import { RESULT_NOTICE } from '../lib/consent.js';

/** ホーム — 施術中に迷わないよう、入口は「新しく評価する」1つに絞る */
export default function Home({ state, symptom, go }) {
  const hasDraft = Boolean(state.draft && state.draft.symptomId === symptom.id);
  const hasResult = Boolean(state.lastResult);

  return (
    <div className="page">
      <div className="card">
        <h2>{symptom.name}の評価</h2>
        <p className="muted">
          お客様の状態を選んでいくと、安全トリアージ（レッドフラグ）と、考えられる原因パターン・施術方針の候補を表示します。
        </p>
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

      <p className="notice-inline">{RESULT_NOTICE}</p>
    </div>
  );
}
