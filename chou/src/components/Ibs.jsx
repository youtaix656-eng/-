import React, { useState } from 'react';
import {
  IBS_TYPES,
  IBS_TYPE_NOTE,
  IBS_EXCLUSION,
  IBS_PITFALLS,
  IBS_PITFALLS_NOTE,
  IBS_APPROACHES,
  SIBO_POINTS,
  SIBO_NOTE,
  SELF_CARE,
  SELF_CARE_NOTE,
  IBS_CORRECTIONS,
  IBS_UNVERIFIED,
  IBS_PRECHECKS,
  IBS_PRECHECK_WARNING,
  IBS_PARTIAL_OK,
  IBS_SOURCE,
} from '../data/ibs.js';
import {
  ibsFermentViews,
  IBS_FERMENT_NOTE,
  mealGapViews,
  MEAL_GAP_CONFLICT_NOTE,
} from '../lib/conflicts.js';
import useFocusJump from './useFocusJump.js';

// 過敏性腸症候群そのものの画面。
//
// **並び順に意味がある。** 「検査で異常が出ない＝気のせいではない」を、
// 型の一覧より前に置く——先に型を見せると、そこへ自分を当てはめて終わってしまう。
// このアプリは記録から型を当てない。

export default function Ibs({ onGo, focus, onFocusDone }) {
  useFocusJump(focus, onFocusDone);
  const [checked, setChecked] = useState([]);
  const toggleCheck = (id) =>
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="page">
      <div className="page-head">
        <h1>過敏性腸症候群のこと</h1>
        <p className="muted">
          出典が言っていることを並べています。
          <strong>このアプリは記録から型を当てません。</strong>
          分けるのは診察の場でやることです。
        </p>
      </div>

      {checked.length > 0 && (
        <div className="notice" id="ibs-precheck-warning">
          <p>{IBS_PRECHECK_WARNING.replace(/\*\*/g, '')}</p>
          <button type="button" className="ghost" onClick={() => onGo('redflags', 'flag-list')}>
            受診の目安を見る
          </button>
        </div>
      )}

      <section className="block" id="ibs-exclusion">
        <div className="block-head">
          <h2>{IBS_EXCLUSION.title}</h2>
        </div>
        <p className="muted small">
          <strong>型の一覧より先に、ここを置いています。</strong>
        </p>
        <p className="muted small">{IBS_EXCLUSION.body}</p>
        <p className="muted small">出典：{IBS_EXCLUSION.said}</p>
        <p>{IBS_EXCLUSION.note.replace(/\*\*/g, '')}</p>
        <button type="button" className="ghost" onClick={() => onGo('visitnote')}>
          受診メモをつくる
        </button>
      </section>

      <div className="notice">
        <p>{IBS_PARTIAL_OK.replace(/\*\*/g, '')}</p>
      </div>

      <section className="block" id="ibs-types">
        <div className="block-head">
          <h2>出典が挙げている分け方</h2>
          <span className="muted small">{IBS_TYPES.length}件</span>
        </div>
        {IBS_TYPES.map((item) => (
          <div key={item.id} className="cand" id={`itype-${item.id}`}>
            <div className="cand-head">
              <strong>{item.title}</strong>
            </div>
            <p className="muted small">{item.body}</p>
            <p className="muted small">出典：{item.said}</p>
            <button
              type="button"
              className="ghost small"
              onClick={() => onGo(item.record.view, item.record.targetId)}
            >
              {item.record.label}
            </button>
          </div>
        ))}
        <p>{IBS_TYPE_NOTE.replace(/\*\*/g, '')}</p>
      </section>

      <section className="block" id="ibs-pitfalls">
        <div className="block-head">
          <h2>出典が「見落としやすい」と挙げているところ</h2>
        </div>
        <ul className="flags">
          {IBS_PITFALLS.map((item) => (
            <li key={item.id} id={`ipit-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">{item.body}</span>
              <button
                type="button"
                className="ghost small"
                onClick={() => onGo(item.link.view, item.link.targetId)}
              >
                {item.link.label}
              </button>
            </li>
          ))}
        </ul>
        <p>{IBS_PITFALLS_NOTE.replace(/\*\*/g, '')}</p>
      </section>

      <section className="block" id="ibs-approaches">
        <div className="block-head">
          <h2>出典が挙げている手当て</h2>
          <span className="muted small">{IBS_APPROACHES.length}件</span>
        </div>
        {IBS_APPROACHES.map((item) => (
          <div key={item.id} className="cand" id={`iapp-${item.id}`}>
            <div className="cand-head">
              <strong>{item.title}</strong>
            </div>
            <p className="muted small">{item.body}</p>
            <p>{item.caution.replace(/\*\*/g, '')}</p>
            {item.link && (
              <button
                type="button"
                className="ghost small"
                onClick={() => onGo(item.link.view, item.link.targetId)}
              >
                {item.link.label}
              </button>
            )}
          </div>
        ))}
      </section>

      <section className="block" id="ibs-sibo">
        <div className="block-head">
          <h2>SIBO（小腸で細菌が増えるとされる状態）</h2>
        </div>
        <ul className="flags">
          {SIBO_POINTS.map((item) => (
            <li key={item.id} id={`sibo-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">{item.body}</span>
            </li>
          ))}
        </ul>
        <p>{SIBO_NOTE.replace(/\*\*/g, '')}</p>
      </section>

      <section className="block" id="ibs-mealgap">
        <div className="block-head">
          <h2>同じ「4時間」が、別々の理由から出てくる</h2>
        </div>
        <ul className="flags">
          {mealGapViews().map((v) => (
            <li key={v.id} id={`gap-${v.id}`}>
              <strong>{v.side}</strong>
              <span className="muted small">言っていること：{v.says}</span>
              <span className="muted small">理屈：{v.why}</span>
            </li>
          ))}
        </ul>
        <p>{MEAL_GAP_CONFLICT_NOTE.replace(/\*\*/g, '')}</p>
        <button type="button" className="ghost" onClick={() => onGo('combine', 'combine-gap')}>
          食事の間隔を見る
        </button>
      </section>

      <section className="block" id="ibs-selfcare">
        <div className="block-head">
          <h2>体験談として挙げられている、自分でやったこと</h2>
          <span className="muted small">{SELF_CARE.length}件</span>
        </div>
        {SELF_CARE.map((item) => (
          <div key={item.id} className="cand" id={`iself-${item.id}`}>
            <div className="cand-head">
              <strong>
                {item.title}
                {item.clash && <span className="badge-review">　ほかの出典とぶつかる</span>}
              </strong>
            </div>
            <p className="muted small">出典：{item.said}</p>
            <p>{item.note.replace(/\*\*/g, '')}</p>
          </div>
        ))}
        <p>{SELF_CARE_NOTE.replace(/\*\*/g, '')}</p>
      </section>

      <section className="block" id="ibs-ferment">
        <div className="block-head">
          <h2>ヨーグルトと納豆：4つに割れる言い分</h2>
        </div>
        <ul className="flags">
          {ibsFermentViews().map((item) => (
            <li key={item.name} id={`iferment-${item.name}`}>
              <strong>{item.name}</strong>
              {item.views.map((line) => (
                <span key={line} className="muted small">
                  {line}
                </span>
              ))}
            </li>
          ))}
        </ul>
        <p>{IBS_FERMENT_NOTE.replace(/\*\*/g, '')}</p>
        <button type="button" className="ghost" onClick={() => onGo('fasting', 'fasting-breakfast')}>
          朝食を抜くか、朝に食べるかを読む
        </button>
      </section>

      <section className="block" id="ibs-corrections">
        <div className="block-head">
          <h2>出典の説明のうち、そのままにできないところ</h2>
          <span className="muted small">{IBS_CORRECTIONS.length}件</span>
        </div>
        {IBS_CORRECTIONS.map((item) => (
          <div key={item.id} className="cand" id={`icorrection-${item.id}`}>
            <div className="cand-head">
              <strong>{item.title}</strong>
            </div>
            <p className="muted small">出典：{item.claim}</p>
            <p>{item.correction.replace(/\*\*/g, '')}</p>
          </div>
        ))}
      </section>

      <section className="block" id="ibs-unverified">
        <div className="block-head">
          <h2>裏が取れていない主張</h2>
          <span className="muted small">{IBS_UNVERIFIED.length}件</span>
        </div>
        <p className="muted small">
          出典に出てくる数字です。<strong>隠さずに出しています</strong>——
          消すと、確からしさの分からない話がアプリの言っていることに見えてしまうためです。
        </p>
        <ul className="flags">
          {IBS_UNVERIFIED.map((item) => (
            <li key={item.id} id={`iunv-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">出典：{item.claim}</span>
              <span className="muted small">{item.note.replace(/\*\*/g, '')}</span>
              <span className="badge-review">※要確認</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="ibs-precheck">
        <div className="block-head">
          <h2>はじめる前に</h2>
        </div>
        <p className="muted small">
          当てはまるものがあれば、先に相談してください。印は端末の中だけに残ります。
        </p>
        {IBS_PRECHECKS.map((item) => (
          <label key={item.id} className="mark">
            <input
              type="checkbox"
              checked={checked.includes(item.id)}
              onChange={() => toggleCheck(item.id)}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </section>

      <p className="muted small" id="ibs-source">
        出典：{IBS_SOURCE.text}
        {IBS_SOURCE.check && ' ※要確認'}
        <br />
        最終確認日：{IBS_SOURCE.checkedOn}
      </p>
    </div>
  );
}
