import React, { useState } from 'react';
import {
  BREATHING_INTRO,
  BREATHING_PRECHECKS,
  BREATHING_PRECHECK_WARNING,
  BREATH_STEPS,
  BREATH_NOTE,
  MASSAGE_STEPS,
  MASSAGE_NOTE,
  STOP_SIGNS,
  STOP_NOTE,
  BREATHING_SOURCE,
} from '../data/breathing.js';
import { useFocusJump } from './useFocusJump.js';
import RedFlagLink from './RedFlagLink.jsx';

// 腹式呼吸・お腹のマッサージ（提案18）。
// **止めどきを、やり方より画面の前に置く**（断食の画面と同じ線）。
// 図は**その場に SVG で描く**（画像ファイルを持たない。決まり9）。

const plain = (s) => String(s || '').replace(/\*\*/g, '');

/** お腹の上を時計まわりになでる向きを、線だけで描く */
function BellyFigure() {
  return (
    <svg viewBox="0 0 120 120" width="140" height="140" role="img" aria-label="お腹の上を時計まわりになでる向きの図">
      <ellipse cx="60" cy="62" rx="42" ry="46" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <circle cx="60" cy="62" r="3" fill="currentColor" />
      <path
        d="M40 88 L40 42 L80 42 L80 88"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M36 84 L40 90 L44 84" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M76 82 L80 88 L84 82" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <text x="34" y="100" fontSize="8" fill="currentColor">
        右下から
      </text>
      <text x="66" y="100" fontSize="8" fill="currentColor">
        左下へ
      </text>
    </svg>
  );
}

export default function Breathing({ onGo, focus, onFocusDone }) {
  useFocusJump(focus, onFocusDone);
  const [checked, setChecked] = useState([]);
  const toggle = (id) =>
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="page">
      <div className="page-head">
        <h1>お腹の力を抜く</h1>
        {BREATHING_INTRO.map((line) => (
          <p key={line} className="muted">
            {line}
          </p>
        ))}
      </div>

      <section className="block" id="breath-stop">
        <div className="block-head">
          <h2>やめどき（先に読んでください）</h2>
        </div>
        <ul className="flags">
          {STOP_SIGNS.map((sign) => (
            <li key={sign}>
              <strong>{sign}</strong>
            </li>
          ))}
        </ul>
        <p>{STOP_NOTE}</p>
        <button type="button" className="ghost" onClick={() => onGo('redflags', 'flag-list')}>
          受診の目安を見る
        </button>
      </section>

      <section className="block" id="breath-precheck">
        <div className="block-head">
          <h2>はじめる前の確認</h2>
        </div>
        {BREATHING_PRECHECKS.map((item) => (
          <label key={item.id} className="mark">
            <input type="checkbox" checked={checked.includes(item.id)} onChange={() => toggle(item.id)} />
            <span>{item.label}</span>
          </label>
        ))}
        {checked.length > 0 && (
          <div className="notice" id="breath-precheck-warning">
            <p>{plain(BREATHING_PRECHECK_WARNING)}</p>
          </div>
        )}
      </section>

      <section className="block" id="breath-steps">
        <div className="block-head">
          <h2>お腹で息をする</h2>
        </div>
        <ul className="flags">
          {BREATH_STEPS.map((step) => (
            <li key={step.id} id={`breath-${step.id}`}>
              <strong>{step.title}</strong>
              <span className="small">{plain(step.body)}</span>
            </li>
          ))}
        </ul>
        <p className="muted small">{BREATH_NOTE}</p>
      </section>

      <section className="block" id="breath-massage">
        <div className="block-head">
          <h2>お腹をなでる</h2>
        </div>
        <div className="figure-row">
          <BellyFigure />
        </div>
        <ul className="flags">
          {MASSAGE_STEPS.map((step) => (
            <li key={step.id} id={`massage-${step.id}`}>
              <strong>{step.title}</strong>
              <span className="small">{plain(step.body)}</span>
            </li>
          ))}
        </ul>
        <p className="muted small">{MASSAGE_NOTE}</p>
        <button type="button" className="ghost" onClick={() => onGo('cleanup', 'cleanup-corrections')}>
          「たまった汚れを出す」を採らない理由を読む
        </button>
      </section>

      <RedFlagLink onGo={onGo} />

      <p className="muted small" id="breath-source">
        出典：{BREATHING_SOURCE.text}
        {BREATHING_SOURCE.check && ' ※要確認'}
        <br />
        最終確認日：{BREATHING_SOURCE.checkedOn}
      </p>
    </div>
  );
}
