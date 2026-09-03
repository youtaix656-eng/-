import React, { useState } from 'react';
import {
  HARMFUL_HABITS,
  HELPFUL_HABITS,
  WEAK_STOMACH_AVOID,
  HABIT_CORRECTIONS,
  HABIT_UNVERIFIED,
  HABIT_PRECHECKS,
  HABIT_PRECHECK_WARNING,
  HABIT_PARTIAL_OK,
  HABIT_SOURCE,
} from '../data/gutHabits.js';
import { fiberViews, FIBER_NOTE, withinSourceFiberConflict } from '../lib/conflicts.js';
import {
  ALCOHOL_GUT,
  ALCOHOL_GUIDE,
  ALCOHOL_CORRECTIONS,
  ALCOHOL_UNVERIFIED,
  ALCOHOL_PRECHECKS,
  ALCOHOL_PRECHECK_WARNING,
  ALCOHOL_SOURCE,
} from '../data/alcohol.js';
import useFocusJump from './useFocusJump.js';

// 胃腸の習慣。
// **倍率を「自分がそうなる確率」と読ませない**のがこの画面でいちばん大事な所。
// 食物繊維の食い違いは `lib/conflicts.js` から毎回導く（手書きの一覧を持たない）。

export default function GutHabits({ onGo, focus, onFocusDone }) {
  useFocusJump(focus, onFocusDone);
  const [checked, setChecked] = useState([]);
  const [drink, setDrink] = useState([]);
  const toggleDrink = (id) =>
    setDrink((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleCheck = (id) =>
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const views = fiberViews();
  const within = withinSourceFiberConflict();

  return (
    <div className="page">
      <div className="page-head">
        <h1>胃腸の習慣</h1>
        <p className="muted">
          出典が「傷つける」「整える」として挙げているものを並べています。
          <strong>やれた数は数えません。</strong>1つ気になったものだけで十分です。
        </p>
      </div>

      {checked.length > 0 && (
        <div className="notice" id="habit-precheck-warning">
          <p>{HABIT_PRECHECK_WARNING.replace(/\*\*/g, '')}</p>
          <button type="button" className="ghost" onClick={() => onGo('redflags', 'flag-list')}>
            受診の目安を見る
          </button>
        </div>
      )}

      <div className="notice" id="habit-ratio-warning">
        <p>
          この出典には「◯倍」という数字がたくさん出てきます。
          <strong>これは集団どうしを比べた数字で、あなたがそうなる確率ではありません。</strong>
          このアプリは倍率を計算にも判定にも使いません。
        </p>
      </div>

      <div className="notice">
        <p>{HABIT_PARTIAL_OK.replace(/\*\*/g, '')}</p>
      </div>

      <section className="block" id="habit-harmful">
        <div className="block-head">
          <h2>傷つけるとされる習慣</h2>
          <span className="muted small">{HARMFUL_HABITS.length}件</span>
        </div>
        {HARMFUL_HABITS.map((item) => (
          <div key={item.id} className="cand" id={`harm-${item.id}`}>
            <div className="cand-head">
              <strong>{item.title}</strong>
            </div>
            <p className="muted small">{item.body}</p>
            <p className="muted small">{item.said.replace(/\*\*/g, '')}</p>
            <button type="button" className="ghost small" onClick={() => onGo(item.record.view, item.record.targetId)}>
              {item.record.label}
            </button>
          </div>
        ))}
      </section>

      <section className="block" id="habit-helpful">
        <div className="block-head">
          <h2>整えるとされる習慣</h2>
          <span className="muted small">{HELPFUL_HABITS.length}件</span>
        </div>
        {HELPFUL_HABITS.map((item) => (
          <div key={item.id} className="cand" id={`help-${item.id}`}>
            <div className="cand-head">
              <strong>{item.title}</strong>
            </div>
            <p className="muted small">{item.body}</p>
            <p className="muted small">{item.said.replace(/\*\*/g, '')}</p>
            <button type="button" className="ghost small" onClick={() => onGo(item.record.view, item.record.targetId)}>
              {item.record.label}
            </button>
          </div>
        ))}
      </section>

      <section className="block" id="habit-fiber">
        <div className="block-head">
          <h2>食物繊維：見ている場所で言うことが逆になる</h2>
        </div>
        <p className="muted small">{FIBER_NOTE}</p>
        <ul className="flags">
          {views.map((v) => (
            <li key={v.id} id={`fiber-${v.id}`}>
              <strong>{v.side}</strong>
              <span className="muted small">いつの話か：{v.applies}</span>
              <span className="muted small">言っていること：{v.says}</span>
              <span className="muted small">理屈：{v.why}</span>
            </li>
          ))}
        </ul>
        <div className="cand" id={`fconflict-${within.id}`}>
          <div className="cand-head">
            <strong>{within.title}</strong>
          </div>
          <p className="muted small">A：{within.a}</p>
          <p className="muted small">B：{within.b}</p>
          <p>{within.note.replace(/\*\*/g, '')}</p>
        </div>
        <button type="button" className="ghost" onClick={() => onGo('prebiotics', 'prebiotic-vs-fodmap')}>
          善玉菌の餌の側を読む
        </button>
      </section>

      <section className="block" id="habit-weak-stomach">
        <div className="block-head">
          <h2>{WEAK_STOMACH_AVOID.title}</h2>
        </div>
        <ul className="flags">
          {WEAK_STOMACH_AVOID.items.map((item) => (
            <li key={item}>
              <strong>{item}</strong>
            </li>
          ))}
        </ul>
        <p className="muted small">{WEAK_STOMACH_AVOID.body}</p>
        <p>{WEAK_STOMACH_AVOID.note.replace(/\*\*/g, '')}</p>
      </section>

      <section className="block" id="habit-alcohol">
        <div className="block-head">
          <h2>お酒と腸</h2>
        </div>
        <p className="muted small">
          別の出典（飲酒の科学）から、<strong>腸に関わるところだけ</strong>を並べています。
          酒の強さ・肝臓・筋トレの話は、腸のアプリでは扱いません。
        </p>
        <ul className="flags">
          {ALCOHOL_GUT.map((item) => (
            <li key={item.id} id={`alc-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">{item.body}</span>
            </li>
          ))}
        </ul>
        <div className="cand" id="alcohol-guide">
          <div className="cand-head">
            <strong>{ALCOHOL_GUIDE.title}</strong>
          </div>
          <p className="muted small">{ALCOHOL_GUIDE.said}</p>
          <p>{ALCOHOL_GUIDE.note.replace(/\*\*/g, '')}</p>
        </div>
        {ALCOHOL_CORRECTIONS.map((item) => (
          <div key={item.id} className="cand" id={`acorrection-${item.id}`}>
            <div className="cand-head">
              <strong>{item.title}</strong>
            </div>
            <p className="muted small">出典：{item.claim}</p>
            <p>{item.correction.replace(/\*\*/g, '')}</p>
          </div>
        ))}
        <ul className="flags">
          {ALCOHOL_UNVERIFIED.map((item) => (
            <li key={item.id} id={`aunv-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">出典：{item.claim}</span>
              <span className="muted small">{item.note.replace(/\*\*/g, '')}</span>
              <span className="badge-review">※要確認</span>
            </li>
          ))}
        </ul>
        <h3>当てはまるものはありますか</h3>
        {ALCOHOL_PRECHECKS.map((item) => (
          <label key={item.id} className="mark">
            <input type="checkbox" checked={drink.includes(item.id)} onChange={() => toggleDrink(item.id)} />
            <span>{item.label}</span>
          </label>
        ))}
        {drink.length > 0 && (
          <div className="notice" id="alcohol-precheck-warning">
            <p>{ALCOHOL_PRECHECK_WARNING.replace(/\*\*/g, '')}</p>
            <button type="button" className="ghost" onClick={() => onGo('redflags', 'flag-list')}>
              受診の目安を見る
            </button>
          </div>
        )}
        <p className="muted small" id="alcohol-source">
          出典：{ALCOHOL_SOURCE.text}
          {ALCOHOL_SOURCE.check && ' ※要確認'}
        </p>
      </section>

      <section className="block" id="habit-corrections">
        <div className="block-head">
          <h2>出典の説明のうち、そのままにできないところ</h2>
        </div>
        {HABIT_CORRECTIONS.map((item) => (
          <div key={item.id} className="cand" id={`hcorrection-${item.id}`}>
            <div className="cand-head">
              <strong>{item.title}</strong>
            </div>
            <p className="muted small">出典：{item.claim}</p>
            <p>{item.correction.replace(/\*\*/g, '')}</p>
          </div>
        ))}
      </section>

      <section className="block" id="habit-unverified">
        <div className="block-head">
          <h2>裏が取れていない主張</h2>
        </div>
        <p className="muted small">
          出典に出てくる数字です。<strong>隠さずに出しています</strong>——
          消すと、確からしさの分からない話がアプリの言っていることに見えてしまうためです。
        </p>
        <ul className="flags">
          {HABIT_UNVERIFIED.map((item) => (
            <li key={item.id} id={`hunv-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">出典：{item.claim}</span>
              <span className="muted small">{item.note.replace(/\*\*/g, '')}</span>
              <span className="badge-review">※要確認</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="habit-precheck">
        <div className="block-head">
          <h2>はじめる前に</h2>
        </div>
        <p className="muted small">当てはまるものがあれば、いっぺんに変えないでください。印は端末の中だけに残ります。</p>
        {HABIT_PRECHECKS.map((item) => (
          <label key={item.id} className="mark">
            <input type="checkbox" checked={checked.includes(item.id)} onChange={() => toggleCheck(item.id)} />
            <span>{item.label}</span>
          </label>
        ))}
      </section>

      <p className="muted small" id="habit-source">
        出典：{HABIT_SOURCE.text}
        {HABIT_SOURCE.check && ' ※要確認'}
        <br />
        最終確認日：{HABIT_SOURCE.checkedOn}
      </p>
    </div>
  );
}
