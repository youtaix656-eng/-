import React from 'react';
import {
  SEASONINGS,
  SEASONING_AVOID,
  SEASONING_CHOICES,
  SEASONING_PARTIAL_OK,
  SEASONING_SOURCE,
} from '../data/seasonings.js';
import { useFocusJump } from './useFocusJump.js';

// 調味料の選び方。
//
// **「腸によい／悪い」を言い切らない。** 出せるのは「買うときに表示のどこを見るか」まで。
// 値段の話をしない（本物＝高い、と読ませない）。替えた数を採点しない。

export default function Seasonings({ store, focus, onFocusDone }) {
  useFocusJump(focus, onFocusDone);
  const done = SEASONINGS.filter((s) => store.seasonings[s.id] === 'changed').length;

  return (
    <div className="view">
      <header className="view-head">
        <h1>調味料の選び方</h1>
        <p className="muted">さしすせそ＋みりん・甘酒の7つ。見るのは「表示のどこか」です。</p>
      </header>

      <div className="notice">
        <p>{SEASONING_PARTIAL_OK}</p>
      </div>

      <section className="block" id="seasoning-list">
        <div className="block-head">
          <h2>7つの見分け方</h2>
          <span className="muted small">見直した {done} / {SEASONINGS.length}</span>
        </div>
        {SEASONINGS.map((item) => (
          <div key={item.id} className="cand" id={`seasoning-${item.id}`}>
            <div className="cand-head">
              <strong>
                {item.title}
                <span className="muted small">　{item.aka}</span>
              </strong>
            </div>
            <p>
              <strong>選ぶなら：</strong>
              {item.choose}
            </p>
            <p className="muted small">
              <strong>見るところ：</strong>
              {item.look}
            </p>
            {item.note && <p className="muted small">{item.note}</p>}
            {item.caution && <p className="muted small">注意：{item.caution}</p>}
            <div className="food-results">
              <span className="muted small">いまの自分は：</span>
              {SEASONING_CHOICES.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  className={`chip small${store.seasonings[item.id] === choice.id ? ' on' : ''}`}
                  aria-pressed={store.seasonings[item.id] === choice.id}
                  onClick={() => store.setSeasoning(item.id, choice.id)}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="block" id="seasoning-avoid">
        <div className="block-head">
          <h2>{SEASONING_AVOID.title}</h2>
        </div>
        <p>{SEASONING_AVOID.body}</p>
        <div className="notice">
          <p>{SEASONING_AVOID.note.replace(/\*\*/g, '')}</p>
        </div>
      </section>

      <p className="muted small" id="seasoning-source">
        出典：{SEASONING_SOURCE.text}
        {SEASONING_SOURCE.check && ' ※要確認'}
        <br />
        最終確認：{SEASONING_SOURCE.checkedOn}
      </p>
    </div>
  );
}
