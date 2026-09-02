import React from 'react';
import { RED_FLAGS, RED_FLAG_INTRO, RED_FLAG_CLOSING, RED_FLAG_SOURCE } from '../data/redFlags.js';
import { useFocusJump } from './useFocusJump.js';

// 受診の目安。**読むだけの画面。**
// 当てはまった数を数えない・色を変えない・「緊急度」と呼ばない（README 決まり1）。

export default function RedFlags({ focus, onFocusDone }) {
  useFocusJump(focus, onFocusDone);
  return (
    <div className="view">
      <header className="view-head">
        <h1>受診の目安</h1>
      </header>

      <p>{RED_FLAG_INTRO}</p>

      <ul className="flags" id="flag-list">
        {RED_FLAGS.map((flag) => (
          <li key={flag.id} id={`flag-${flag.id}`}>
            <strong>{flag.title}</strong>
            {flag.note && <span className="muted small">{flag.note}</span>}
          </li>
        ))}
      </ul>

      <div className="notice">
        {RED_FLAG_CLOSING.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>

      <p className="muted small" id="flag-source">
        出典：{RED_FLAG_SOURCE.text}
        {RED_FLAG_SOURCE.check && ' ※要確認'}
        <br />
        最終確認：{RED_FLAG_SOURCE.checkedOn}
      </p>
    </div>
  );
}
