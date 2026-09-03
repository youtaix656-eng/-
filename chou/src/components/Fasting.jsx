import React, { useState } from 'react';
import {
  FASTING_SHAPES,
  FASTING_CLAIMS,
  FASTING_CORRECTIONS,
  FASTING_UNVERIFIED,
  FASTING_STOP_SIGNS,
  FASTING_STOP_NOTE,
  FASTING_PRECHECKS,
  FASTING_PRECHECK_WARNING,
  FASTING_PARTIAL_OK,
  FASTING_SOURCE,
} from '../data/fasting.js';
import { breakfastViews, BREAKFAST_NOTE } from '../lib/conflicts.js';
import useFocusJump from './useFocusJump.js';

// 断食・空腹の時間。
// **このアプリで扱っている題材の中でいちばん危ない。**
//  - やめどき（STOP_SIGNS）を、始め方より先に出す
//  - 日数も時間も数えない（数えると「食べない日を伸ばすほど良い」に見える）
//  - 朝食を抜く話は、便が出にくい人に実害が出るので食い違いとして必ず並べる

export default function Fasting({ onGo, focus, onFocusDone }) {
  useFocusJump(focus, onFocusDone);
  const [checked, setChecked] = useState([]);
  const toggleCheck = (id) =>
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="page">
      <div className="page-head">
        <h1>断食・空腹の時間</h1>
        <p className="muted">
          <strong>このアプリは断食を勧めていません。</strong>
          出典がそう言っている、というところまでを並べています。
        </p>
      </div>

      <div className="notice" id="fasting-warning">
        <p>
          <strong>空腹の時間を長くするのが向かない人がいます。</strong>
          血糖を下げる薬を使っている人、食後に飲む薬がある人、成長期・妊娠中・授乳中の人、
          食事を制限することがつらかった経験のある人は、始める前に医師・薬剤師へ相談してください。
        </p>
      </div>

      {checked.length > 0 && (
        <div className="notice" id="fasting-precheck-warning">
          <p>{FASTING_PRECHECK_WARNING.replace(/\*\*/g, '')}</p>
          <button type="button" className="ghost" onClick={() => onGo('redflags', 'flag-list')}>
            受診の目安を見る
          </button>
        </div>
      )}

      <section className="block" id="fasting-stop">
        <div className="block-head">
          <h2>やめどき</h2>
        </div>
        <p className="muted small">
          <strong>始め方より先に、やめどきを置いています。</strong>
          続けられたかどうかより、こちらのほうが大事だからです。
        </p>
        <ul className="flags">
          {FASTING_STOP_SIGNS.map((sign) => (
            <li key={sign}>
              <strong>{sign}</strong>
            </li>
          ))}
        </ul>
        <p>{FASTING_STOP_NOTE.replace(/\*\*/g, '')}</p>
      </section>

      <div className="notice">
        <p>{FASTING_PARTIAL_OK.replace(/\*\*/g, '')}</p>
      </div>

      <section className="block" id="fasting-shapes">
        <div className="block-head">
          <h2>出典が挙げているやり方</h2>
          <span className="muted small">{FASTING_SHAPES.length}件</span>
        </div>
        {FASTING_SHAPES.map((shape) => (
          <div key={shape.id} className="cand" id={`shape-${shape.id}`}>
            <div className="cand-head">
              <strong>{shape.title}</strong>
            </div>
            <p className="muted small">{shape.said}</p>
            <p>{shape.note.replace(/\*\*/g, '')}</p>
          </div>
        ))}
      </section>

      <section className="block" id="fasting-breakfast">
        <div className="block-head">
          <h2>朝食を抜くか、朝に食べるか</h2>
        </div>
        <p className="muted small">{BREAKFAST_NOTE.replace(/\*\*/g, '')}</p>
        <ul className="flags">
          {breakfastViews().map((v) => (
            <li key={v.id} id={`bview-${v.id}`}>
              <strong>{v.side}</strong>
              <span className="muted small">いつの話か：{v.applies}</span>
              <span className="muted small">言っていること：{v.says}</span>
              <span className="muted small">理屈：{v.why}</span>
            </li>
          ))}
        </ul>
        <button type="button" className="ghost" onClick={() => onGo('home', 'rec-stool')}>
          きょうのお通じを記録する
        </button>
      </section>

      <section className="block" id="fasting-claims">
        <div className="block-head">
          <h2>出典が挙げている仕組み</h2>
        </div>
        <ul className="flags">
          {FASTING_CLAIMS.map((item) => (
            <li key={item.id} id={`fclaim-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">{item.body}</span>
              {item.note && <span className="badge-review">{item.note}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="fasting-corrections">
        <div className="block-head">
          <h2>出典の説明のうち、そのままにできないところ</h2>
          <span className="muted small">{FASTING_CORRECTIONS.length}件</span>
        </div>
        <p className="muted small">
          この出典は<strong>そのままにできないところが特に多い</strong>ので、1件ずつ理由を書いています。
        </p>
        {FASTING_CORRECTIONS.map((item) => (
          <div key={item.id} className="cand" id={`fcorrection-${item.id}`}>
            <div className="cand-head">
              <strong>{item.title}</strong>
            </div>
            <p className="muted small">出典：{item.claim}</p>
            <p>{item.correction.replace(/\*\*/g, '')}</p>
          </div>
        ))}
      </section>

      <section className="block" id="fasting-unverified">
        <div className="block-head">
          <h2>裏が取れていない主張</h2>
        </div>
        <p className="muted small">
          出典に出てくる数字と言い切りです。<strong>隠さずに出しています</strong>——
          消すと、確からしさの分からない話がアプリの言っていることに見えてしまうためです。
        </p>
        <ul className="flags">
          {FASTING_UNVERIFIED.map((item) => (
            <li key={item.id} id={`funv-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">出典：{item.claim}</span>
              <span className="muted small">{item.note.replace(/\*\*/g, '')}</span>
              <span className="badge-review">※要確認</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="fasting-precheck">
        <div className="block-head">
          <h2>はじめる前に</h2>
        </div>
        <p className="muted small">当てはまるものがあれば、先に相談してください。印は端末の中だけに残ります。</p>
        {FASTING_PRECHECKS.map((item) => (
          <label key={item.id} className="mark">
            <input type="checkbox" checked={checked.includes(item.id)} onChange={() => toggleCheck(item.id)} />
            <span>{item.label}</span>
          </label>
        ))}
      </section>

      <p className="muted small" id="fasting-source">
        出典：{FASTING_SOURCE.text}
        {FASTING_SOURCE.check && ' ※要確認'}
        <br />
        最終確認日：{FASTING_SOURCE.checkedOn}
      </p>
    </div>
  );
}
