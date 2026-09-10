import React from 'react';
import {
  FLORA_INTRO,
  FLORA_BASICS,
  FLORA_CORRECTIONS,
  FLORA_UNVERIFIED,
  FLORA_NOTE,
  FLORA_SOURCE,
} from '../data/flora.js';
import { useFocusJump } from './useFocusJump.js';
import RedFlagLink from './RedFlagLink.jsx';

// 腸内フローラの基礎（提案21）。**数値と断定を外す**——
// 「◯％が善玉菌」の類は書かない（決まり4）。

const plain = (s) => String(s || '').replace(/\*\*/g, '');

export default function Flora({ onGo, focus, onFocusDone }) {
  useFocusJump(focus, onFocusDone);
  return (
    <div className="page">
      <div className="page-head">
        <h1>腸内フローラの言葉</h1>
        {FLORA_INTRO.map((line) => (
          <p key={line} className="muted">
            {line}
          </p>
        ))}
      </div>

      <section className="block" id="flora-basics">
        <div className="block-head">
          <h2>よく出てくる言葉</h2>
        </div>
        <ul className="flags">
          {FLORA_BASICS.map((item) => (
            <li key={item.id} id={`flora-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="small">{plain(item.body)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="flora-corrections">
        <div className="block-head">
          <h2>そのままにできないところ</h2>
        </div>
        <ul className="flags">
          {FLORA_CORRECTIONS.map((item) => (
            <li key={item.id} id={`fcorrection-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">よく言われていること：{item.claim}</span>
              <span className="small">{plain(item.correction)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="flora-unverified">
        <div className="block-head">
          <h2>裏が取れていない主張</h2>
        </div>
        <p className="muted small">隠さずに並べたうえで、1件ずつ「確かめていない」を添えています。</p>
        <ul className="flags">
          {FLORA_UNVERIFIED.map((item) => (
            <li key={item.id} id={`funv-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">出典の主張：{item.claim}</span>
              <span className="small">{plain(item.note)}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="notice" id="flora-note">
        <p>{FLORA_NOTE}</p>
        <button type="button" className="ghost" onClick={() => onGo('probiotics', 'probiotic-scope')}>
          サプリで扱わないことを読む
        </button>
      </div>

      <RedFlagLink onGo={onGo} />

      <p className="muted small" id="flora-source">
        出典：{FLORA_SOURCE.text}
        {FLORA_SOURCE.check && ' ※要確認'}
        <br />
        最終確認日：{FLORA_SOURCE.checkedOn}
      </p>
    </div>
  );
}
