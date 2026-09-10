import React, { useState } from 'react';
import {
  SHORT_CHAIN,
  SPORE,
  BUTYRATE_ROLES,
  WITHDRAWN,
  BUTYRATE_RUMORS,
  BUTYRATE_RUMORS_NOTE,
  BUTYRATE_CORRECTIONS,
  BUTYRATE_UNVERIFIED,
  BUTYRATE_PRECHECKS,
  BUTYRATE_PRECHECK_WARNING,
  BUTYRATE_PARTIAL_OK,
  BUTYRATE_SOURCE,
} from '../data/butyrate.js';
import useFocusJump from './useFocusJump.js';
import RedFlagLink from './RedFlagLink.jsx';

// 酪酸菌と短鎖脂肪酸。
// **はたらきは「そう説明されている」までで止める**——ここを断定に寄せると、
// 受診したほうがよい人が「まず整腸剤で様子を見よう」と考えてしまう（README 決まり19）。

export default function Butyrate({ onGo, focus, onFocusDone }) {
  useFocusJump(focus, onFocusDone);
  const [checked, setChecked] = useState([]);
  const toggleCheck = (id) =>
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="page">
      <div className="page-head">
        <h1>酪酸菌と短鎖脂肪酸</h1>
        <p className="muted">
          出典が「体にいい」と説明しているはたらきを並べています。
          <strong>どれも確かめきれていないので、断定はしません。</strong>
        </p>
      </div>

      {checked.length > 0 && (
        <div className="notice" id="butyrate-precheck-warning">
          <p>{BUTYRATE_PRECHECK_WARNING.replace(/\*\*/g, '')}</p>
          <button type="button" className="ghost" onClick={() => onGo('redflags', 'flag-list')}>
            受診の目安を見る
          </button>
        </div>
      )}

      <div className="notice">
        <p>{BUTYRATE_PARTIAL_OK}</p>
      </div>

      <section className="block" id="butyrate-short-chain">
        <div className="block-head">
          <h2>短鎖脂肪酸（出典が名前を挙げているもの）</h2>
        </div>
        <ul className="flags">
          {SHORT_CHAIN.map((item) => (
            <li key={item.id} id={`scfa-${item.id}`}>
              <strong>{item.name}</strong>
              <span className="muted small">{item.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="butyrate-spore">
        <div className="block-head">
          <h2>{SPORE.title}</h2>
        </div>
        <p>{SPORE.body}</p>
        <div className="notice">
          <p>{SPORE.caution}</p>
        </div>
      </section>

      <section className="block" id="butyrate-roles">
        <div className="block-head">
          <h2>出典が挙げているはたらき</h2>
          <span className="muted small">{BUTYRATE_ROLES.length}件</span>
        </div>
        <ul className="flags">
          {BUTYRATE_ROLES.map((role) => (
            <li key={role.id} id={`brole-${role.id}`}>
              <strong>{role.title}</strong>
              <span className="muted small">{role.body}</span>
              {role.note && <span className="badge-review">{role.note}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="butyrate-withdrawn">
        <div className="block-head">
          <h2>出典自身が取り下げている説</h2>
        </div>
        <p className="muted small">
          アプリが直したのではなく、<strong>出典が自分で「もう言わない」と話しているもの</strong>です。
          本や記事にはまだ残っているので、見かけたときのために置いています。
        </p>
        {WITHDRAWN.map((item) => (
          <div key={item.id} className="cand" id={`withdrawn-${item.id}`}>
            <div className="cand-head">
              <strong>{item.title}</strong>
            </div>
            <p className="muted small">広まった説：{item.claim}</p>
            <p>{item.withdrawn}</p>
            <p className="muted small">{item.note}</p>
          </div>
        ))}
      </section>

      <section className="block" id="butyrate-rumors">
        <div className="block-head">
          <h2>出回っているうわさと、出典の説明</h2>
        </div>
        <p className="muted small">{BUTYRATE_RUMORS_NOTE.replace(/\*\*/g, '')}</p>
        {BUTYRATE_RUMORS.map((item) => (
          <div key={item.id} className="cand" id={`brumor-${item.id}`}>
            <div className="cand-head">
              <strong>{item.title}</strong>
            </div>
            <p className="muted small">うわさ：{item.rumor}</p>
            <p className="muted small">出典の説明：{item.said}</p>
            <p>{item.note.replace(/\*\*/g, '')}</p>
          </div>
        ))}
      </section>

      <section className="block" id="butyrate-corrections">
        <div className="block-head">
          <h2>出典の説明のうち、そのままにできないところ</h2>
        </div>
        {BUTYRATE_CORRECTIONS.map((item) => (
          <div key={item.id} className="cand" id={`bcorrection-${item.id}`}>
            <div className="cand-head">
              <strong>{item.title}</strong>
            </div>
            <p className="muted small">出典：{item.claim}</p>
            <p>{item.correction.replace(/\*\*/g, '')}</p>
          </div>
        ))}
      </section>

      <section className="block" id="butyrate-unverified">
        <div className="block-head">
          <h2>裏が取れていない主張</h2>
        </div>
        <p className="muted small">
          出典に出てくる数字と言い切りです。<strong>隠さずに出しています</strong>——
          消すと、確からしさの分からない話がアプリの言っていることに見えてしまうためです。
        </p>
        <ul className="flags">
          {BUTYRATE_UNVERIFIED.map((item) => (
            <li key={item.id} id={`bunv-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">出典：{item.claim}</span>
              <span className="muted small">{item.note.replace(/\*\*/g, '')}</span>
              <span className="badge-review">※要確認</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="butyrate-precheck">
        <div className="block-head">
          <h2>はじめる前に</h2>
        </div>
        <p className="muted small">当てはまるものがあれば、飲む前に相談してください。印は端末の中だけに残ります。</p>
        {BUTYRATE_PRECHECKS.map((item) => (
          <label key={item.id} className="mark">
            <input type="checkbox" checked={checked.includes(item.id)} onChange={() => toggleCheck(item.id)} />
            <span>{item.label}</span>
          </label>
        ))}
      </section>

      <section className="block" id="butyrate-links">
        <div className="block-head">
          <h2>つながっているところ</h2>
        </div>
        <button type="button" className="ghost" onClick={() => onGo('probiotics', 'probiotic-mine')}>
          整腸剤の画面で、飲んでいるものを登録する
        </button>
        <button type="button" className="ghost" onClick={() => onGo('prebiotics', 'prebiotic-conflicts')}>
          「飲んだ菌は住み着くのか」の食い違いを読む
        </button>
        <button type="button" className="ghost" onClick={() => onGo('otc', 'otc-kinds')}>
          市販薬とのつきあい方を読む
        </button>
      </section>

      <p className="muted small" id="butyrate-source">
        出典：{BUTYRATE_SOURCE.text}
        {BUTYRATE_SOURCE.check && ' ※要確認'}
        <br />
        最終確認日：{BUTYRATE_SOURCE.checkedOn}
      </p>
      <RedFlagLink onGo={onGo} />
    </div>
  );
}
