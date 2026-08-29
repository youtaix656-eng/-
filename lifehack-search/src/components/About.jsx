import React from 'react';
import { HACKS, countByCategory } from '../data/hacks.js';
import { CATEGORIES, BASIS_KINDS } from '../data/schema.js';
import { auditHacks } from '../lib/guard.js';

/** このアプリの方針と、いま入っているものの内訳。 */
export default function About({ store }) {
  const counts = countByCategory();
  const basisCounts = {};
  for (const hack of HACKS) basisCounts[hack.basis.kind] = (basisCounts[hack.basis.kind] || 0) + 1;
  const findings = auditHacks(HACKS);
  const size = store.storageSize();

  return (
    <div className="view">
      <h2>このアプリについて</h2>
      <p className="lead">
        困った時の言葉から、暮らしと仕事の工夫を引くための小さな辞典です。
        {HACKS.length}件を{CATEGORIES.length}のカテゴリに分けて持っています。
      </p>

      <section>
        <h3>決めていること</h3>
        <ul className="rules">
          <li><strong>効きめを断定しない。</strong>合う・合わないは人によって違うので、「必ず」「誰でも」という書き方をしません。</li>
          <li><strong>手元に無い数字を書かない。</strong>「◯%改善」のような数字は持ちません。</li>
          <li><strong>どこまで確かかを添える。</strong>名前のついた手法・書籍・昔から言われているやり方・研究があるとされるもの、を分けて書きます。</li>
          <li><strong>体の不調は工夫でしのがせない。</strong>いつもと違う時は受診をすすめる側に寄せています。</li>
          <li><strong>端末の外に出さない。</strong>気になる・やってみた記録・検索の履歴は、この端末の中だけに残ります。</li>
        </ul>
      </section>

      <section>
        <h3>どこまで確かか（内訳）</h3>
        <ul className="rules">
          {Object.entries(BASIS_KINDS).map(([kind, meta]) => (
            <li key={kind}>
              {meta.icon} <strong>{meta.label}</strong>：{basisCounts[kind] || 0}件 — {meta.note}
            </li>
          ))}
        </ul>
        <label className="switch">
          <input
            type="checkbox"
            checked={store.state.settings.showBasis}
            onChange={(e) => store.setSettings({ showBasis: e.target.checked })}
          />
          くわしい画面に「どこまで確かか」を出す
        </label>
      </section>

      <section>
        <h3>カテゴリ別の件数</h3>
        <ul className="counts">
          {CATEGORIES.map((c) => (
            <li key={c.id}>
              <span className="chip" style={{ background: c.color }}>{c.icon} {c.label}</span>
              <span>{counts[c.id]}件</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>言い方の見張り</h3>
        {findings.length === 0 ? (
          <p>言い切り（必ず・絶対・誰でも…）は見つかりませんでした。</p>
        ) : (
          <ul className="rules">
            {findings.map((row) => (
              <li key={row.hack.id}>{row.hack.title}：{row.findings.map((f) => f.word).join('、')}</li>
            ))}
          </ul>
        )}
        <p className="note small">止めるためではなく、書き足す時に一度目を通すための表示です。</p>
      </section>

      <section>
        <h3>保存されているもの</h3>
        <p>この端末に {size} バイト（気になる{store.state.favorites.length}件・記録{Object.keys(store.state.tried).length}件・履歴{store.state.history.length}件）。</p>
        <button
          type="button"
          className="danger"
          onClick={() => {
            if (window.confirm('この端末に保存した「気になる」「やってみた記録」「検索の履歴」をすべて消します。よろしいですか？')) store.reset();
          }}
        >
          保存したものを消す
        </button>
      </section>
    </div>
  );
}
