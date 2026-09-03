import React, { useState } from 'react';
import {
  PROTEIN_FOODS,
  PROTEIN_KIND_LABELS,
  PROTEIN_GUIDES,
  ELIMINATION_TARGETS,
  VITAMIN_D,
  PROTEIN_CORRECTIONS,
  PROTEIN_UNVERIFIED,
  PROTEIN_PRECHECKS,
  PROTEIN_PRECHECK_WARNING,
  PROTEIN_PARTIAL_OK,
  PROTEIN_SOURCE,
} from '../data/protein.js';
import { proteinViews, PROTEIN_NOTE, dairyViews, DAIRY_NOTE } from '../lib/conflicts.js';
import { progressOf, progressLine, finished, TARGET_BY_ID, RESTORE_NOTE } from '../lib/elimination.js';
import { todayKey, formatShort } from '../lib/dates.js';
import useFocusJump from './useFocusJump.js';
import RedFlagLink from './RedFlagLink.jsx';

// タンパク質と腸。
// **グラム数を計算しない・割合を採点しない**のがこの画面でいちばん大事な所
// （出典は「理想的なバランス」と書くが、手元に無い基準をアプリが持たない）。
// 除去（やめてみる）は**試すためのもので、続けるためのものではない**と必ず出す。

export default function Protein({ store, onGo, focus, onFocusDone }) {
  useFocusJump(focus, onFocusDone);
  const [checked, setChecked] = useState([]);
  const [message, setMessage] = useState('');
  const toggleCheck = (id) =>
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const now = store.runningElimination;
  const progress = progressOf(now);
  const done = finished(store.eliminations);

  const start = (targetId) => {
    const result = store.startElimination(targetId, todayKey());
    setMessage(result.ok ? '' : result.reason);
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>タンパク質と腸</h1>
        <p className="muted">
          出典が挙げている食べものと目安を並べています。
          <strong>グラム数の計算も、割合の採点もしません。</strong>
        </p>
      </div>

      {checked.length > 0 && (
        <div className="notice" id="protein-precheck-warning">
          <p>{PROTEIN_PRECHECK_WARNING.replace(/\*\*/g, '')}</p>
          <button type="button" className="ghost" onClick={() => onGo('redflags', 'flag-list')}>
            受診の目安を見る
          </button>
        </div>
      )}

      <div className="notice">
        <p>{PROTEIN_PARTIAL_OK}</p>
      </div>

      <section className="block" id="protein-foods">
        <div className="block-head">
          <h2>出典が挙げているタンパク質源</h2>
          <span className="muted small">{PROTEIN_FOODS.length}件</span>
        </div>
        <ul className="flags">
          {PROTEIN_FOODS.map((food) => (
            <li key={food.id} id={`protein-${food.id}`}>
              <strong>
                {food.name}
                <span className="muted small">　{PROTEIN_KIND_LABELS[food.kind]}</span>
              </strong>
              <span className="muted small">出典の目安：{food.amount}</span>
              <span className="muted small">{food.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="protein-guides">
        <div className="block-head">
          <h2>出典が挙げている目安</h2>
        </div>
        {PROTEIN_GUIDES.map((guide) => (
          <div key={guide.id} className="cand" id={`guide-${guide.id}`}>
            <div className="cand-head">
              <strong>{guide.title}</strong>
            </div>
            <p className="muted small">{guide.said}</p>
            <p>{guide.note.replace(/\*\*/g, '')}</p>
          </div>
        ))}
      </section>

      <section className="block" id="protein-vs-stomach">
        <div className="block-head">
          <h2>肉と魚：増やすのか、避けるのか</h2>
        </div>
        <p className="muted small">{PROTEIN_NOTE}</p>
        <ul className="flags">
          {proteinViews().map((v) => (
            <li key={v.id} id={`pview-${v.id}`}>
              <strong>{v.side}</strong>
              <span className="muted small">いつの話か：{v.applies}</span>
              <span className="muted small">言っていること：{v.says}</span>
              <span className="muted small">理屈：{v.why}</span>
            </li>
          ))}
        </ul>
        <button type="button" className="ghost" onClick={() => onGo('habits', 'habit-weak-stomach')}>
          胃が弱っているときの側を読む
        </button>
      </section>

      <section className="block" id="protein-elimination">
        <div className="block-head">
          <h2>ためしにやめてみる</h2>
        </div>
        <div className="notice">
          <p>{RESTORE_NOTE.replace(/\*\*/g, '')}</p>
        </div>
        {message && (
          <div className="notice" id="elimination-message">
            <p>{message}</p>
          </div>
        )}
        {now ? (
          <div className="cand" id="elimination-running">
            <div className="cand-head">
              <strong>いま試しているもの</strong>
            </div>
            <p>{progressLine(progress).replace(/\*\*/g, '')}</p>
            <p className="muted small">始めた日：{formatShort(now.startedOn)}</p>
            <button type="button" className="ghost" onClick={() => store.endElimination(now.id)}>
              終える（もとに戻す）
            </button>
          </div>
        ) : (
          <p className="muted small">いま試しているものはありません。</p>
        )}
        <ul className="flags">
          {ELIMINATION_TARGETS.map((target) => (
            <li key={target.id} id={`elim-${target.id}`}>
              <strong>
                {target.name}
                <span className="muted small">　出典の目安 {target.days}日</span>
              </strong>
              <span className="muted small">{target.said}</span>
              <span className="muted small">{target.caution.replace(/\*\*/g, '')}</span>
              {!now && (
                <button type="button" className="ghost small" onClick={() => start(target.id)}>
                  きょうから試してみる
                </button>
              )}
            </li>
          ))}
        </ul>
        {done.length > 0 && (
          <div id="elimination-done">
            <h3>試した記録</h3>
            <p className="muted small">
              良かった・悪かったは記録しません。<strong>いつ試したかだけ</strong>を残します。
            </p>
            <ul className="flags">
              {done.map((entry) => (
                <li key={entry.id}>
                  <strong>{TARGET_BY_ID[entry.targetId] ? TARGET_BY_ID[entry.targetId].name : entry.targetId}</strong>
                  <span className="muted small">
                    {formatShort(entry.startedOn)} 〜 {formatShort(entry.endedOn)}
                  </span>
                  <button type="button" className="ghost small" onClick={() => store.removeElimination(entry.id)}>
                    消す
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="block" id="protein-dairy">
        <div className="block-head">
          <h2>乳製品：3つに割れる</h2>
        </div>
        <p className="muted small">{DAIRY_NOTE}</p>
        {dairyViews().map((item) => (
          <div key={item.name} className="cand" id={`dairy-${item.name}`}>
            <div className="cand-head">
              <strong>{item.name}</strong>
            </div>
            {item.views.map((line) => (
              <p key={line} className="muted small">
                {line}
              </p>
            ))}
          </div>
        ))}
      </section>

      <section className="block" id="protein-vitamind">
        <div className="block-head">
          <h2>{VITAMIN_D.title}</h2>
        </div>
        <p>{VITAMIN_D.body}</p>
        <div className="notice">
          <p>{VITAMIN_D.caution.replace(/\*\*/g, '')}</p>
        </div>
      </section>

      <section className="block" id="protein-corrections">
        <div className="block-head">
          <h2>出典の説明のうち、そのままにできないところ</h2>
        </div>
        {PROTEIN_CORRECTIONS.map((item) => (
          <div key={item.id} className="cand" id={`prcorrection-${item.id}`}>
            <div className="cand-head">
              <strong>{item.title}</strong>
            </div>
            <p className="muted small">出典：{item.claim}</p>
            <p>{item.correction.replace(/\*\*/g, '')}</p>
          </div>
        ))}
      </section>

      <section className="block" id="protein-unverified">
        <div className="block-head">
          <h2>裏が取れていない主張</h2>
        </div>
        <p className="muted small">
          出典に出てくる数字と言い切りです。<strong>隠さずに出しています</strong>——
          消すと、確からしさの分からない話がアプリの言っていることに見えてしまうためです。
        </p>
        <ul className="flags">
          {PROTEIN_UNVERIFIED.map((item) => (
            <li key={item.id} id={`prunv-${item.id}`}>
              <strong>{item.title}</strong>
              <span className="muted small">出典：{item.claim}</span>
              <span className="muted small">{item.note.replace(/\*\*/g, '')}</span>
              <span className="badge-review">※要確認</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block" id="protein-precheck">
        <div className="block-head">
          <h2>はじめる前に</h2>
        </div>
        <p className="muted small">当てはまるものがあれば、先に相談してください。印は端末の中だけに残ります。</p>
        {PROTEIN_PRECHECKS.map((item) => (
          <label key={item.id} className="mark">
            <input type="checkbox" checked={checked.includes(item.id)} onChange={() => toggleCheck(item.id)} />
            <span>{item.label}</span>
          </label>
        ))}
      </section>

      <p className="muted small" id="protein-source">
        出典：{PROTEIN_SOURCE.text}
        {PROTEIN_SOURCE.check && ' ※要確認'}
        <br />
        最終確認日：{PROTEIN_SOURCE.checkedOn}
      </p>
      <RedFlagLink onGo={onGo} />
    </div>
  );
}
