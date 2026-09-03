import React from 'react';
import {
  PREBIOTIC_KINDS,
  OMEGA3,
  APPLE_VINEGAR,
  SOURCE_CONFLICTS,
  PREBIOTIC_CORRECTIONS,
  PREBIOTIC_UNVERIFIED,
  PREBIOTIC_PRECHECKS,
  PREBIOTIC_PRECHECK_WARNING,
  PREBIOTIC_PARTIAL_OK,
  PREBIOTIC_SOURCE,
} from '../data/prebiotics.js';
import { prebioticViews, prebioticConflicts, PREBIOTIC_VS_FODMAP_NOTE } from '../lib/conflicts.js';
import { useFocusJump } from './useFocusJump.js';

// 善玉菌の餌（プレバイオティクス）。
//
// **この画面の芯は「目的が反対を向いている2つを、そのまま並べる」こと。**
// 餌を増やす考え方（プレバイオティクス）と、発酵しやすい糖を減らす考え方（低FODMAP）は
// ぶつかる。お腹の張りで困っている人ほど、片方が合って片方が合わない。
// **どちらが正しいかを決めない。**
//
// もうひとつ、**出典どうしの食い違い**（リンゴ酢・試す期間・菌が住み着くか）も並べる。

export default function Prebiotics({ store, focus, onFocusDone, onGo }) {
  useFocusJump(focus, onFocusDone);
  const views = prebioticViews();
  const clashes = prebioticConflicts();
  const checked = store.settings.prebioticChecks || [];
  const toggleCheck = (id) => {
    const next = checked.includes(id) ? checked.filter((c) => c !== id) : [...checked, id];
    store.setSettings({ prebioticChecks: next });
  };

  return (
    <div className="view">
      <header className="view-head">
        <h1>善玉菌の餌</h1>
        <p className="muted">
          整腸剤が「菌」なら、こちらは「その菌の餌」。水溶性食物繊維・オリゴ糖・レジスタントスターチ。
        </p>
      </header>

      {checked.length > 0 && (
        <div className="notice" id="prebiotic-precheck-warning">
          <p>
            <strong>{PREBIOTIC_PRECHECK_WARNING.replace(/\*\*/g, '')}</strong>
          </p>
        </div>
      )}

      <div className="notice" id="prebiotic-vs-fodmap">
        <p>
          <strong>{PREBIOTIC_VS_FODMAP_NOTE}</strong>
        </p>
        <button type="button" className="ghost" onClick={() => onGo('fodmap', 'fodmap-notes')}>
          低FODMAP の一覧を見る
        </button>
      </div>

      <div className="notice">
        <p>{PREBIOTIC_PARTIAL_OK}</p>
      </div>

      <section className="block" id="prebiotic-kinds">
        <div className="block-head">
          <h2>餌になるとされるもの（3つ）</h2>
        </div>
        <ul className="flags">
          {PREBIOTIC_KINDS.map((kind) => (
            <li key={kind.id} id={`kind-${kind.id}`}>
              <strong>{kind.label}</strong>
              <span className="muted small">{kind.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="prebiotic-foods">
        <div className="block-head">
          <h2>出典が挙げている食べもの</h2>
          <span className="muted small">
            {views.length}件／ぶつかる {clashes.length}件
          </span>
        </div>
        <ul className="flags">
          {views.map((v) => (
            <li key={v.name} id={`prebiotic-${v.reading}`}>
              <strong>
                {v.name}
                {v.conflict && <span className="badge-review">　低FODMAP とぶつかる</span>}
              </strong>
              {v.views.map((line) => (
                <span key={line} className="muted small">
                  {line}
                </span>
              ))}
              <span className="muted small">{v.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="prebiotic-conflicts">
        <div className="block-head">
          <h2>出典どうしが食い違っているところ</h2>
        </div>
        <p className="muted small">
          同じことについて、出典によって言うことが違います。
          <strong>このアプリはどちらが正しいかを決めません。</strong>
        </p>
        {SOURCE_CONFLICTS.map((item) => (
          <div key={item.id} className="cand" id={`sconflict-${item.id}`}>
            <div className="cand-head">
              <strong>{item.title}</strong>
            </div>
            <p className="muted small">A：{item.a}</p>
            <p className="muted small">B：{item.b}</p>
            {item.c && <p className="muted small">C：{item.c}</p>}
          </div>
        ))}
      </section>

      <section className="block" id="prebiotic-omega3">
        <div className="block-head">
          <h2>{OMEGA3.title}</h2>
        </div>
        <p>{OMEGA3.body}</p>
        <div className="notice">
          <p>{OMEGA3.caution}</p>
        </div>
      </section>

      <section className="block" id="prebiotic-vinegar">
        <div className="block-head">
          <h2>{APPLE_VINEGAR.title}</h2>
        </div>
        <p>{APPLE_VINEGAR.body}</p>
        <div className="notice">
          <p>{APPLE_VINEGAR.caution}</p>
        </div>
      </section>

      <section className="block" id="prebiotic-corrections">
        <div className="block-head">
          <h2>出典の説明のうち、そのままにできないところ</h2>
        </div>
        {PREBIOTIC_CORRECTIONS.map((item) => (
          <div key={item.id} className="cand" id={`pcorrection-${item.id}`}>
            <div className="cand-head">
              <strong>{item.title}</strong>
            </div>
            <p className="muted small">出典：{item.claim}</p>
            <p>{item.correction.replace(/\*\*/g, '')}</p>
          </div>
        ))}
        <button type="button" className="ghost" onClick={() => onGo('probiotics', 'probiotic-corrections')}>
          整腸剤の訂正も見る
        </button>
      </section>

      <section className="block" id="prebiotic-unverified">
        <div className="block-head">
          <h2>裏が取れていない主張</h2>
        </div>
        <p className="muted small">
          出典に出てくる数字と言い切りです。<strong>隠さずに出しています</strong>——
          消すと、確からしさの分からない話がアプリの言っていることに見えてしまうためです。
        </p>
        <ul className="flags">
          {PREBIOTIC_UNVERIFIED.map((item) => (
            <li key={item.id} id={`punv2-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">出典：{item.claim}</span>
              <span className="muted small">{item.note.replace(/\*\*/g, '')}</span>
              <span className="badge-review">※要確認</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="prebiotic-precheck">
        <div className="block-head">
          <h2>はじめる前に</h2>
        </div>
        <p className="muted small">
          当てはまるものがあれば、増やすのは少しずつに。印は端末の中だけに残ります。
        </p>
        {PREBIOTIC_PRECHECKS.map((item) => (
          <label key={item.id} className="mark">
            <input type="checkbox" checked={checked.includes(item.id)} onChange={() => toggleCheck(item.id)} />
            <span>{item.label}</span>
          </label>
        ))}
      </section>

      <p className="muted small" id="prebiotic-source">
        出典：{PREBIOTIC_SOURCE.text}
        {PREBIOTIC_SOURCE.check && ' ※要確認'}
        <br />
        最終確認：{PREBIOTIC_SOURCE.checkedOn}
      </p>
    </div>
  );
}
