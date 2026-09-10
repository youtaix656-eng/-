import React from 'react';
import {
  MORNING_TRAITS,
  MORNING_TRAITS_NOTE,
  MORNING_HABITS,
  MORNING_CORRECTIONS,
  MORNING_UNVERIFIED,
  MORNING_PARTIAL_OK,
  MORNING_SOURCE,
} from '../data/morning.js';
import { breakfastViews, BREAKFAST_NOTE } from '../lib/conflicts.js';
import useFocusJump from './useFocusJump.js';
import RedFlagLink from './RedFlagLink.jsx';

// 朝のリズムと排便。
// **出典の4つめ「出なくても自分を責めない」を、いちばん上に出す**——
// このアプリが最初から守っていることと同じ向きだから。
// 逆に「朝一番の便がいちばん健康」は、夜勤・交代勤務の人を追い詰めるので訂正を併記する。

export default function Morning({ onGo, focus, onFocusDone }) {
  useFocusJump(focus, onFocusDone);
  const dontBlame = MORNING_HABITS.find((h) => h.id === 'dont_blame');

  return (
    <div className="page">
      <div className="page-head">
        <h1>朝のリズムと排便</h1>
        <p className="muted">
          出典が挙げている特徴とやってみることを並べています。
          <strong>当てはまった数は数えません。</strong>
        </p>
      </div>

      {dontBlame && (
        <div className="notice" id="morning-dont-blame">
          <p>
            <strong>{dontBlame.title}</strong>
          </p>
          <p className="muted small">{dontBlame.body}</p>
          <p>{dontBlame.caution.replace(/\*\*/g, '')}</p>
        </div>
      )}

      <div className="notice">
        <p>{MORNING_PARTIAL_OK.replace(/\*\*/g, '')}</p>
      </div>

      <section className="block" id="morning-traits">
        <div className="block-head">
          <h2>出典が挙げている「朝に出る人の特徴」</h2>
          <span className="muted small">{MORNING_TRAITS.length}件</span>
        </div>
        <p className="muted small">{MORNING_TRAITS_NOTE.replace(/\*\*/g, '')}</p>
        {MORNING_TRAITS.map((trait) => (
          <div key={trait.id} className="cand" id={`trait-${trait.id}`}>
            <div className="cand-head">
              <strong>{trait.title}</strong>
            </div>
            <p className="muted small">{trait.body}</p>
            <button
              type="button"
              className="ghost small"
              onClick={() => onGo(trait.link.view, trait.link.targetId)}
            >
              {trait.link.label}
            </button>
          </div>
        ))}
      </section>

      <section className="block" id="morning-habits">
        <div className="block-head">
          <h2>出典が挙げている「やってみること」</h2>
          <span className="muted small">{MORNING_HABITS.length}件</span>
        </div>
        {MORNING_HABITS.map((habit) => (
          <div key={habit.id} className="cand" id={`mhabit-${habit.id}`}>
            <div className="cand-head">
              <strong>{habit.title}</strong>
            </div>
            <p className="muted small">{habit.body}</p>
            <p>{habit.caution.replace(/\*\*/g, '')}</p>
          </div>
        ))}
        <button type="button" className="ghost" onClick={() => onGo('home', 'rec-stool')}>
          きょうのお通じを記録する
        </button>
      </section>

      <section className="block" id="morning-breakfast">
        <div className="block-head">
          <h2>朝食を抜くか、朝に食べるか</h2>
        </div>
        <p className="muted small">{BREAKFAST_NOTE.replace(/\*\*/g, '')}</p>
        <ul className="flags">
          {breakfastViews().map((v) => (
            <li key={v.id} id={`mbview-${v.id}`}>
              <strong>{v.side}</strong>
              <span className="muted small">いつの話か：{v.applies}</span>
              <span className="muted small">言っていること：{v.says}</span>
            </li>
          ))}
        </ul>
        <button type="button" className="ghost" onClick={() => onGo('fasting', 'fasting-breakfast')}>
          断食の側を読む
        </button>
      </section>

      <section className="block" id="morning-corrections">
        <div className="block-head">
          <h2>出典の説明のうち、そのままにできないところ</h2>
        </div>
        {MORNING_CORRECTIONS.map((item) => (
          <div key={item.id} className="cand" id={`mcorrection-${item.id}`}>
            <div className="cand-head">
              <strong>{item.title}</strong>
            </div>
            <p className="muted small">出典：{item.claim}</p>
            <p>{item.correction.replace(/\*\*/g, '')}</p>
          </div>
        ))}
      </section>

      <section className="block" id="morning-unverified">
        <div className="block-head">
          <h2>裏が取れていない主張</h2>
        </div>
        <p className="muted small">
          出典に出てくる数字です。<strong>隠さずに出しています</strong>——
          消すと、確からしさの分からない話がアプリの言っていることに見えてしまうためです。
        </p>
        <ul className="flags">
          {MORNING_UNVERIFIED.map((item) => (
            <li key={item.id} id={`munv-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">出典：{item.claim}</span>
              <span className="muted small">{item.note.replace(/\*\*/g, '')}</span>
              <span className="badge-review">※要確認</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="muted small" id="morning-source">
        出典：{MORNING_SOURCE.text}
        {MORNING_SOURCE.check && ' ※要確認'}
        <br />
        最終確認日：{MORNING_SOURCE.checkedOn}
      </p>
      <RedFlagLink onGo={onGo} />
    </div>
  );
}
