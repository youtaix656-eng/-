import React, { useState } from 'react';
import {
  NAMED_FOODS,
  SUPER_FOOD,
  SCARED_CORRECTIONS,
  SCARED_UNVERIFIED,
  SCARED_PRECHECKS,
  SCARED_PRECHECK_WARNING,
  SCARED_PARTIAL_OK,
  SCARED_SOURCE,
} from '../data/scaredFoods.js';
import { tsukemonoViews, TSUKEMONO_NOTE } from '../lib/conflicts.js';
import useFocusJump from './useFocusJump.js';

// 名指しされた食べもの。
// **薬を「猛毒」と呼ばないと決めたのと同じ線を、食べものにも引く**（README 決まり26）。
// 訂正を先に出し、食べものの一覧はそのあと——「食べるな」の一覧に見えないようにするため。

export default function ScaredFoods({ onGo, focus, onFocusDone }) {
  useFocusJump(focus, onFocusDone);
  const [checked, setChecked] = useState([]);
  const toggleCheck = (id) =>
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="page">
      <div className="page-head">
        <h1>名指しされた食べもの</h1>
        <p className="muted">
          「猛毒」「食べるな」と名指しされることの多い食べものです。
          <strong>このアプリは食べものに札を貼りません。</strong>
        </p>
      </div>

      <div className="notice" id="scared-warning">
        <p>
          <strong>この画面のせいで、食べられるものを減らさないでください。</strong>
          お腹の調子で困っている人の中には、食べるのがこわくなっている人がいます。
          食が細い人・体重が減っている人にとっては、食べないことのほうが危険です。
        </p>
      </div>

      {checked.length > 0 && (
        <div className="notice" id="scared-precheck-warning">
          <p>{SCARED_PRECHECK_WARNING.replace(/\*\*/g, '')}</p>
          <button type="button" className="ghost" onClick={() => onGo('redflags', 'flag-list')}>
            受診の目安を見る
          </button>
        </div>
      )}

      <div className="notice">
        <p>{SCARED_PARTIAL_OK.replace(/\*\*/g, '')}</p>
      </div>

      <section className="block" id="scared-corrections">
        <div className="block-head">
          <h2>そのままにできないところ</h2>
          <span className="muted small">{SCARED_CORRECTIONS.length}件</span>
        </div>
        <p className="muted small">
          <strong>食べものの一覧より先に、こちらを置いています</strong>——
          先に一覧を見ると、「食べるな」の一覧に見えてしまうためです。
        </p>
        {SCARED_CORRECTIONS.map((item) => (
          <div key={item.id} className="cand" id={`scorrection-${item.id}`}>
            <div className="cand-head">
              <strong>{item.title}</strong>
            </div>
            <p className="muted small">出典：{item.claim}</p>
            <p>{item.correction.replace(/\*\*/g, '')}</p>
          </div>
        ))}
      </section>

      <section className="block" id="scared-foods">
        <div className="block-head">
          <h2>名指しされているもの</h2>
          <span className="muted small">{NAMED_FOODS.length}件</span>
        </div>
        {NAMED_FOODS.map((food) => (
          <div key={food.id} className="cand" id={`named-${food.id}`}>
            <div className="cand-head">
              <strong>{food.name}</strong>
            </div>
            <p className="muted small">出典の言い分：{food.said}</p>
            <p className="muted small">選ぶときに見るところ：{food.look}</p>
            <p>{food.note.replace(/\*\*/g, '')}</p>
          </div>
        ))}
      </section>

      <section className="block" id="scared-tsukemono">
        <div className="block-head">
          <h2>漬物：同じ出典の中で言うことが変わる</h2>
        </div>
        <p className="muted small">{TSUKEMONO_NOTE.replace(/\*\*/g, '')}</p>
        <ul className="flags">
          {tsukemonoViews().map((v) => (
            <li key={v.id} id={`tsuke-${v.id}`}>
              <strong>{v.side}</strong>
              <span className="muted small">言っていること：{v.says}</span>
              {v.source && <span className="muted small">{v.source}</span>}
            </li>
          ))}
        </ul>
        <button type="button" className="ghost" onClick={() => onGo('cleanup', 'cleanup-steps')}>
          発酵食品の側を読む
        </button>
      </section>

      <section className="block" id="scared-super">
        <div className="block-head">
          <h2>「これひとつでよい」とされているもの</h2>
        </div>
        <div className="cand" id="super-food">
          <div className="cand-head">
            <strong>{SUPER_FOOD.name}</strong>
          </div>
          <p className="muted small">出典の言い分：{SUPER_FOOD.said}</p>
          <p>{SUPER_FOOD.note.replace(/\*\*/g, '')}</p>
        </div>
      </section>

      <section className="block" id="scared-unverified">
        <div className="block-head">
          <h2>裏が取れていない主張</h2>
        </div>
        <p className="muted small">
          出典に出てくる数字です。<strong>隠さずに出しています</strong>——
          消すと、確からしさの分からない話がアプリの言っていることに見えてしまうためです。
        </p>
        <ul className="flags">
          {SCARED_UNVERIFIED.map((item) => (
            <li key={item.id} id={`sunv-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">出典：{item.claim}</span>
              <span className="muted small">{item.note.replace(/\*\*/g, '')}</span>
              <span className="badge-review">※要確認</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="scared-precheck">
        <div className="block-head">
          <h2>当てはまるものはありますか</h2>
        </div>
        <p className="muted small">印は端末の中だけに残ります。数は数えません。</p>
        {SCARED_PRECHECKS.map((item) => (
          <label key={item.id} className="mark">
            <input type="checkbox" checked={checked.includes(item.id)} onChange={() => toggleCheck(item.id)} />
            <span>{item.label}</span>
          </label>
        ))}
      </section>

      <p className="muted small" id="scared-source">
        出典：{SCARED_SOURCE.text}
        {SCARED_SOURCE.check && ' ※要確認'}
        <br />
        最終確認日：{SCARED_SOURCE.checkedOn}
      </p>
    </div>
  );
}
