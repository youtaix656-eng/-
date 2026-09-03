import React, { useState } from 'react';
import {
  OTC_KINDS,
  OTC_CORRECTIONS,
  OTC_UNVERIFIED,
  OTC_PRECHECKS,
  OTC_PRECHECK_WARNING,
  OTC_PARTIAL_OK,
  OTC_SOURCE,
} from '../data/otcDrugs.js';
import {
  MAGNESIUM_FOODS,
  MAGNESIUM_CLAIMED_EFFECTS,
  MAGNESIUM_SCOPE_NOTE,
  MAGNESIUM_CORRECTIONS,
  MAGNESIUM_UNVERIFIED,
  MAGNESIUM_SOURCE,
} from '../data/magnesium.js';
import useFocusJump from './useFocusJump.js';
import RedFlagLink from './RedFlagLink.jsx';

// 市販薬とのつきあい方。
// **この画面はいちばん慎重に作ってある**——出典の「猛毒」「ヤブ医者」という言い方を持ち込むと、
// 必要があって飲んでいる人の手を止めてしまう。出すのは
// 「どういうときに向かないと説明されているか」と「誰に聞けばよいか」まで。

export default function OtcDrugs({ onGo, focus, onFocusDone }) {
  useFocusJump(focus, onFocusDone);
  const [checked, setChecked] = useState([]);
  const toggleCheck = (id) =>
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="page">
      <div className="page-head">
        <h1>市販薬とのつきあい方</h1>
        <p className="muted">
          お腹に関わる市販薬について、出典がどう説明しているかを並べています。
          <strong>このアプリは飲み合わせも用量も判定しません。</strong>
        </p>
      </div>

      <div className="notice" id="otc-stop-warning">
        <p>
          <strong>いま飲んでいる薬を、この画面を読んでやめないでください。</strong>
          出した医師・薬剤師には、ここからは分からない事情が見えています。
          気になることは、その人に聞くのがいちばん早く、確かです。
        </p>
      </div>

      {checked.length > 0 && (
        <div className="notice" id="otc-precheck-warning">
          <p>{OTC_PRECHECK_WARNING.replace(/\*\*/g, '')}</p>
          <button type="button" className="ghost" onClick={() => onGo('redflags', 'flag-list')}>
            受診の目安を見る
          </button>
        </div>
      )}

      <div className="notice">
        <p>{OTC_PARTIAL_OK}</p>
      </div>

      <section className="block" id="otc-kinds">
        <div className="block-head">
          <h2>お腹に関わる市販薬</h2>
          <span className="muted small">{OTC_KINDS.length}種類</span>
        </div>
        {OTC_KINDS.map((kind) => (
          <div key={kind.id} className="cand" id={`otc-${kind.id}`}>
            <div className="cand-head">
              <strong>{kind.name}</strong>
            </div>
            <p className="muted small">出典の説明：{kind.said}</p>
            <p className="muted small">理屈：{kind.why}</p>
            <p className="muted small">かわりにできること：{kind.instead.replace(/\*\*/g, '')}</p>
            <p>{kind.doctor.replace(/\*\*/g, '')}</p>
          </div>
        ))}
        <button type="button" className="ghost" onClick={() => onGo('home', 'rec-otc')}>
          きょう使った市販薬を記録する
        </button>
      </section>

      <section className="block" id="otc-magnesium">
        <div className="block-head">
          <h2>マグネシウム</h2>
        </div>
        <p className="muted small">{MAGNESIUM_SCOPE_NOTE.replace(/\*\*/g, '')}</p>
        <ul className="flags">
          {MAGNESIUM_CLAIMED_EFFECTS.map((item) => (
            <li key={item.id} id={`mg-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">
                {item.gut ? '腸の話：このアプリで扱います。' : '腸の話ではありません：このアプリでは扱いません。'}
              </span>
            </li>
          ))}
        </ul>
        <h3>食べものから取るなら</h3>
        <ul className="flags">
          {MAGNESIUM_FOODS.map((food) => (
            <li key={food.id} id={`mgfood-${food.id}`}>
              <strong>{food.name}</strong>
              <span className="muted small">{food.note}</span>
            </li>
          ))}
        </ul>
        {MAGNESIUM_CORRECTIONS.map((item) => (
          <div key={item.id} className="cand" id={`mgcorrection-${item.id}`}>
            <div className="cand-head">
              <strong>{item.title}</strong>
            </div>
            <p className="muted small">出典：{item.claim}</p>
            <p>{item.correction.replace(/\*\*/g, '')}</p>
          </div>
        ))}
        <ul className="flags">
          {MAGNESIUM_UNVERIFIED.map((item) => (
            <li key={item.id} id={`mgunv-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">出典：{item.claim}</span>
              <span className="muted small">{item.note.replace(/\*\*/g, '')}</span>
              <span className="badge-review">※要確認</span>
            </li>
          ))}
        </ul>
        <p className="muted small" id="magnesium-source">
          出典：{MAGNESIUM_SOURCE.text}
          {MAGNESIUM_SOURCE.check && ' ※要確認'}
        </p>
      </section>

      <section className="block" id="otc-corrections">
        <div className="block-head">
          <h2>出典の言い方のうち、そのままにできないところ</h2>
        </div>
        {OTC_CORRECTIONS.map((item) => (
          <div key={item.id} className="cand" id={`ocorrection-${item.id}`}>
            <div className="cand-head">
              <strong>{item.title}</strong>
            </div>
            <p className="muted small">出典：{item.claim}</p>
            <p>{item.correction.replace(/\*\*/g, '')}</p>
          </div>
        ))}
      </section>

      <section className="block" id="otc-unverified">
        <div className="block-head">
          <h2>裏が取れていない主張</h2>
        </div>
        <p className="muted small">
          出典に出てくる数字です。<strong>隠さずに出しています</strong>——
          消すと、確からしさの分からない話がアプリの言っていることに見えてしまうためです。
        </p>
        <ul className="flags">
          {OTC_UNVERIFIED.map((item) => (
            <li key={item.id} id={`ounv-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">出典：{item.claim}</span>
              <span className="muted small">{item.note.replace(/\*\*/g, '')}</span>
              <span className="badge-review">※要確認</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="otc-precheck">
        <div className="block-head">
          <h2>当てはまるものはありますか</h2>
        </div>
        <p className="muted small">印は端末の中だけに残ります。数は数えません。</p>
        {OTC_PRECHECKS.map((item) => (
          <label key={item.id} className="mark">
            <input type="checkbox" checked={checked.includes(item.id)} onChange={() => toggleCheck(item.id)} />
            <span>{item.label}</span>
          </label>
        ))}
      </section>

      <section className="block" id="otc-links">
        <div className="block-head">
          <h2>つながっているところ</h2>
        </div>
        <button type="button" className="ghost" onClick={() => onGo('redflags', 'flag-list')}>
          受診の目安を読む
        </button>
        <button type="button" className="ghost" onClick={() => onGo('probiotics', 'probiotic-mine')}>
          整腸剤の画面へ
        </button>
        <button type="button" className="ghost" onClick={() => onGo('visitnote', 'note-parts')}>
          受診メモに市販薬を入れる
        </button>
      </section>

      <p className="muted small" id="otc-source">
        出典：{OTC_SOURCE.text}
        {OTC_SOURCE.check && ' ※要確認'}
        <br />
        最終確認日：{OTC_SOURCE.checkedOn}
      </p>
      <RedFlagLink onGo={onGo} />
    </div>
  );
}
