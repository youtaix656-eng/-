import React from 'react';
import {
  CLEANUP_STEPS,
  FERMENTED_FOODS,
  STRESS_RELIEF,
  POSTURE_TIPS,
  CLEANUP_CORRECTIONS,
  CLEANUP_UNVERIFIED,
  CLEANUP_PRECHECKS,
  CLEANUP_PRECHECK_WARNING,
  CLEANUP_PARTIAL_OK,
  CLEANUP_SOURCE,
} from '../data/cleanup.js';
import { fermentViews, FERMENT_NOTE } from '../lib/conflicts.js';
import { useFocusJump } from './useFocusJump.js';

// 腸のお掃除（5つ）。
//
// **この素材はほかより言い方が強い。** 「腸が汚い人は見た目も汚い」「腸の健康なくして
// 健康はない」といった言い切りは、体調の悪い人を貶め、受診を遅らせる。だから：
//  - その言い回しは採らない（`CLEANUP_CORRECTIONS` に理由を書いて残す）。
//  - 心の不調は腸で片づけない（医療機関へ、を必ず添える）。
//  - 食事を強く制限する話には、当てはまる人への注意を必ず付ける。
//  - 3つの考え方（腸活・低FODMAP・アダムスキー式）が食い違う所は、全部並べて決めない。

export default function Cleanup({ store, focus, onFocusDone, onGo }) {
  useFocusJump(focus, onFocusDone);
  const views = fermentViews();
  const checked = store.settings.cleanupChecks || [];
  const toggleCheck = (id) => {
    const next = checked.includes(id) ? checked.filter((c) => c !== id) : [...checked, id];
    store.setSettings({ cleanupChecks: next });
  };

  return (
    <div className="view">
      <header className="view-head">
        <h1>腸のお掃除（5つ）</h1>
        <p className="muted">出典が挙げている5つを、記録できるところへつなげてあります。</p>
      </header>

      {checked.length > 0 && (
        <div className="notice" id="cleanup-precheck-warning">
          <p>
            <strong>{CLEANUP_PRECHECK_WARNING}</strong>
          </p>
        </div>
      )}

      <div className="notice">
        <p>{CLEANUP_PARTIAL_OK}</p>
      </div>

      <section className="block" id="cleanup-steps">
        <div className="block-head">
          <h2>5つ</h2>
        </div>
        {CLEANUP_STEPS.map((step, i) => (
          <div key={step.id} className="cand" id={`cleanup-${step.id}`}>
            <div className="cand-head">
              <strong>
                {i + 1}. {step.title}
              </strong>
            </div>
            <p>{step.body}</p>
            {step.caution && (
              <div className="notice">
                <p>{step.caution.replace(/\*\*/g, '')}</p>
              </div>
            )}
            <button type="button" className="ghost small" onClick={() => onGo(step.record.view, step.record.targetId)}>
              {step.record.label}
            </button>
          </div>
        ))}
      </section>

      <section className="block" id="cleanup-ferment">
        <div className="block-head">
          <h2>発酵食品を、3つの考え方から見る</h2>
          <span className="muted small">{FERMENTED_FOODS.length}件</span>
        </div>
        <ul className="flags">
          {views.map((v) => (
            <li key={v.name} id={`ferment-${v.reading}`}>
              <strong>
                {v.name}
                {v.conflict && <span className="badge-review">　言うことが変わる</span>}
              </strong>
              {v.views.map((line) => (
                <span key={line} className="muted small">
                  {line}
                </span>
              ))}
            </li>
          ))}
        </ul>
        <div className="notice">
          <p>{FERMENT_NOTE}</p>
        </div>
        <div className="row">
          <button type="button" className="ghost" onClick={() => onGo('fodmap', 'fodmap-notes')}>
            低FODMAP の一覧
          </button>
          <button type="button" className="ghost" onClick={() => onGo('combine', 'combine-speeds')}>
            食べ合わせの一覧
          </button>
        </div>
      </section>

      <section className="block" id="cleanup-stress">
        <div className="block-head">
          <h2>ストレスを減らす（4つ）</h2>
        </div>
        <ul className="flags">
          {STRESS_RELIEF.map((item) => (
            <li key={item.id} id={`relief-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">{item.body}</span>
            </li>
          ))}
        </ul>
        <p className="muted small">
          どれがどれだけ効くかは書きません（人によって違うので、書けば嘘になります）。
        </p>
      </section>

      <section className="block" id="cleanup-posture">
        <div className="block-head">
          <h2>姿勢</h2>
        </div>
        <ul className="flags">
          {POSTURE_TIPS.map((item) => (
            <li key={item.id} id={`posture-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">{item.body}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="cleanup-corrections">
        <div className="block-head">
          <h2>出典の説明のうち、そのままにできないところ</h2>
        </div>
        {CLEANUP_CORRECTIONS.map((item) => (
          <div key={item.id} className="cand" id={`ccorrection-${item.id}`}>
            <div className="cand-head">
              <strong>{item.title}</strong>
            </div>
            <p className="muted small">出典：{item.claim}</p>
            <p>{item.correction.replace(/\*\*/g, '')}</p>
          </div>
        ))}
        <button type="button" className="ghost" onClick={() => onGo('redflags', 'flag-list')}>
          受診の目安を読む
        </button>
      </section>

      <section className="block" id="cleanup-unverified">
        <div className="block-head">
          <h2>裏が取れていない主張</h2>
        </div>
        <p className="muted small">
          出典に出てくる数字と言い切りです。<strong>隠さずに出しています</strong>——
          消すと、確からしさの分からない話がアプリの言っていることに見えてしまうためです。
        </p>
        <ul className="flags">
          {CLEANUP_UNVERIFIED.map((item) => (
            <li key={item.id} id={`cunverified-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">出典：{item.claim}</span>
              <span className="muted small">{item.note}</span>
              <span className="badge-review">※要確認</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="cleanup-precheck">
        <div className="block-head">
          <h2>はじめる前に</h2>
        </div>
        <p className="muted small">
          当てはまるものがあれば、先に相談してください。印は端末の中だけに残ります。
        </p>
        {CLEANUP_PRECHECKS.map((item) => (
          <label key={item.id} className="mark">
            <input type="checkbox" checked={checked.includes(item.id)} onChange={() => toggleCheck(item.id)} />
            <span>{item.label}</span>
          </label>
        ))}
      </section>

      <p className="muted small" id="cleanup-source">
        出典：{CLEANUP_SOURCE.text}
        {CLEANUP_SOURCE.check && ' ※要確認'}
        <br />
        最終確認：{CLEANUP_SOURCE.checkedOn}
      </p>
    </div>
  );
}
