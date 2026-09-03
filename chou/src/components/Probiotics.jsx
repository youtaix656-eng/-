import React, { useMemo, useState } from 'react';
import {
  BACTERIA,
  BACTERIA_BY_ID,
  PRODUCTS,
  PROBIOTIC_CORRECTIONS,
  PROBIOTIC_UNVERIFIED,
  PROBIOTIC_PRECHECKS,
  PROBIOTIC_PRECHECK_WARNING,
  NO_INTERACTION_CHECK,
  SUPPLEMENT_SCOPE_NOTE,
  TRIAL_NOTE,
  PROBIOTIC_FAQ,
  PROBIOTIC_SOURCE,
} from '../data/probiotics.js';
import { trialProgress, trialLine, isRegistered, othersThan } from '../lib/probiotic.js';
import { todayKey, formatKey } from '../lib/dates.js';
import { useFocusJump } from './useFocusJump.js';

// 整腸剤。
//
// **この画面がいちばん危ないのは「効く」と書いてしまうこと。**
// 市販の薬・医薬部外品の話なので、効き目を言い切ると、受診したほうがよい人が
// 「まず整腸剤で様子を見よう」と考えてしまう。だから：
//  - 出すのは「出典ではこう紹介されている」まで。
//  - 商品を勧めない・順位を付けない（3つを並べるだけ）。
//  - 受診の目安への行き先を必ず置く。
//  - 飲み合わせは調べない（薬剤師へ、と書く）。

export default function Probiotics({ store, focus, onFocusDone, onGo }) {
  useFocusJump(focus, onFocusDone);
  const [name, setName] = useState(store.probiotic.name);
  const today = todayKey();
  const progress = useMemo(
    () => trialProgress(store.probiotic, store.days, today),
    [store.probiotic, store.days, today],
  );
  const checked = store.settings.probioticChecks || [];
  const toggleCheck = (id) => {
    const next = checked.includes(id) ? checked.filter((c) => c !== id) : [...checked, id];
    store.setSettings({ probioticChecks: next });
  };

  return (
    <div className="view">
      <header className="view-head">
        <h1>整腸剤</h1>
        <p className="muted">飲んでいるものを1つ登録して、試している期間を見ます。</p>
      </header>

      {checked.length > 0 && (
        <div className="notice" id="probiotic-precheck-warning">
          <p>
            <strong>{PROBIOTIC_PRECHECK_WARNING}</strong>
          </p>
        </div>
      )}

      <div className="notice">
        <p>
          <strong>整腸剤で様子を見ているあいだに、受診が遅れないようにしてください。</strong>
          血が混じる・体重が減る・夜中に目が覚めるほどの痛みなどがあるときは、
          お腹の調子に関わらず医療機関で相談してください。
        </p>
        <button type="button" className="ghost" onClick={() => onGo('redflags', 'flag-list')}>
          受診の目安を読む
        </button>
      </div>

      <section className="block" id="probiotic-mine">
        <div className="block-head">
          <h2>いま飲んでいるもの</h2>
        </div>
        <label className="search">
          <span className="sr-only">整腸剤の名前</span>
          <input
            type="text"
            value={name}
            placeholder="整腸剤の名前（自由に書けます）"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="row">
          <button
            type="button"
            className="solid"
            onClick={() => store.setProbiotic({ name: name.trim(), startedOn: store.probiotic.startedOn || today })}
          >
            登録する
          </button>
          {isRegistered(store.probiotic) && (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                if (window.confirm('登録を消しますか？（毎日の記録は消えません）')) {
                  store.setProbiotic({ name: '', productId: '', startedOn: '', note: '' });
                  setName('');
                }
              }}
            >
              登録を消す
            </button>
          )}
        </div>
        {isRegistered(store.probiotic) && (
          <>
            <p>
              {store.probiotic.name}／{formatKey(store.probiotic.startedOn)}から
            </p>
            <p>{trialLine(progress)}</p>
            {progress.reached && (
              <p className="muted small">
                別の菌のものを試すなら：
                {othersThan(store.probiotic.productId, PRODUCTS)
                  .map((p) => p.name)
                  .join('／')}
                （出典が挙げているもの。順番に意味はありません）
              </p>
            )}
            <p className="muted small">
              飲んだ日は「きょう」の画面で押します。<strong>連続日数は数えていません</strong>——
              飲めなかった日を責める作りにしないためです。
            </p>
          </>
        )}
        <p className="muted small">{TRIAL_NOTE}</p>
      </section>

      <section className="block" id="probiotic-products">
        <div className="block-head">
          <h2>出典が挙げている3つ</h2>
        </div>
        <p className="muted small">
          <strong>このアプリはどれかを勧めません。</strong>並びに意味はなく、値段や売れている順も持ちません。
        </p>
        <ul className="flags">
          {PRODUCTS.map((product) => (
            <li key={product.id} id={`product-${product.id}`}>
              <strong>{product.name}</strong>
              <span className="muted small">
                入っている菌：{product.bacteria.map((b) => BACTERIA_BY_ID[b].name).join('／')}
              </span>
              <span className="muted small">形：{product.forms.join('・')}</span>
              <span className="muted small">{product.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="probiotic-bacteria">
        <div className="block-head">
          <h2>菌と、住み着きやすいとされる場所</h2>
        </div>
        <ul className="speed-list">
          {BACTERIA.map((b) => (
            <li key={b.id} id={`bacteria-${b.id}`}>
              <span className="food-name">{b.name}</span>
              <span className="tag">{b.where}</span>
              <span className="muted small">{b.note}</span>
            </li>
          ))}
        </ul>
        <p className="muted small">
          どこに住み着くかは出典の言い方をそのまま置いています。※要確認
        </p>
      </section>

      <section className="block" id="probiotic-corrections">
        <div className="block-head">
          <h2>出典の説明のうち、そのままにできないところ</h2>
        </div>
        {PROBIOTIC_CORRECTIONS.map((item) => (
          <div key={item.id} id={`correction-${item.id}`} className="cand">
            <p className="muted small">出典：{item.claim}</p>
            <p>{item.correction.replace(/\*\*/g, '')}</p>
          </div>
        ))}
        <div className="notice">
          <p>{NO_INTERACTION_CHECK}</p>
        </div>
      </section>

      <section className="block" id="probiotic-scope">
        <div className="block-head">
          <h2>サプリの話で、このアプリが引き受けるところ</h2>
        </div>
        <p>{SUPPLEMENT_SCOPE_NOTE.replace(/\*\*/g, '')}</p>
      </section>

      <section className="block" id="probiotic-faq">
        <div className="block-head">
          <h2>よくある質問</h2>
        </div>
        {PROBIOTIC_FAQ.map((item) => (
          <div key={item.id} id={`faq-${item.id}`}>
            <p>
              <strong>{item.q}</strong>
            </p>
            <p className="muted small">{item.a.replace(/\*\*/g, '')}</p>
          </div>
        ))}
      </section>

      <section className="block" id="probiotic-unverified">
        <div className="block-head">
          <h2>裏が取れていない主張</h2>
        </div>
        <p className="muted small">
          出典が挙げている効果と数字です。<strong>隠さずに出しています</strong>——
          消すと、確からしさの分からない話がアプリの言っていることに見えてしまうためです。
        </p>
        <ul className="flags">
          {PROBIOTIC_UNVERIFIED.map((item) => (
            <li key={item.id} id={`punverified-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">出典：{item.claim}</span>
              <span className="muted small">{item.note.replace(/\*\*/g, '')}</span>
              <span className="badge-review">※要確認</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="probiotic-precheck">
        <div className="block-head">
          <h2>はじめる前に</h2>
        </div>
        <p className="muted small">
          当てはまるものがあれば、飲みはじめる前に医師・薬剤師へ。印は端末の中だけに残ります。
        </p>
        {PROBIOTIC_PRECHECKS.map((item) => (
          <label key={item.id} className="mark">
            <input type="checkbox" checked={checked.includes(item.id)} onChange={() => toggleCheck(item.id)} />
            <span>{item.label}</span>
          </label>
        ))}
      </section>

      <p className="muted small" id="probiotic-source">
        出典：{PROBIOTIC_SOURCE.text}
        {PROBIOTIC_SOURCE.check && ' ※要確認'}
        <br />
        最終確認：{PROBIOTIC_SOURCE.checkedOn}
      </p>
    </div>
  );
}
