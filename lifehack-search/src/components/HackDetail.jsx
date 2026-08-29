import React from 'react';
import Highlight from './Highlight.jsx';
import { CATEGORY_MAP, EFFORT_LABELS, BASIS_KINDS } from '../data/schema.js';
import { hackById } from '../data/hacks.js';
import { TRIED_STATUS } from '../lib/useStore.js';

/** 1件を詳しく見る画面。手順・なぜ効くか・気をつけること・根拠を分けて出す。 */
export default function HackDetail({ id, query = '', store, onBack, onOpen, onSearch }) {
  const hack = hackById(id);
  if (!hack) {
    return (
      <div className="view">
        <p className="empty">この項目は見つかりませんでした。</p>
        <button type="button" className="wide" onClick={onBack}>← 戻る</button>
      </div>
    );
  }
  const category = CATEGORY_MAP[hack.category];
  const effort = EFFORT_LABELS[hack.effort] || EFFORT_LABELS[1];
  const basis = BASIS_KINDS[hack.basis.kind];
  const record = store.state.tried[hack.id];
  const favorite = store.favoriteSet.has(hack.id);

  return (
    <div className="view detail">
      <button type="button" className="back" onClick={onBack}>← 一覧に戻る</button>

      <div className="card-head">
        <span className="chip" style={{ background: category.color }}>{category.icon} {category.label}</span>
        <span className="chip ghost">{effort.icon} {effort.label}</span>
        {hack.time ? <span className="chip ghost">⏳ {hack.time}</span> : null}
      </div>

      <h2><Highlight text={hack.title} query={query} /></h2>
      <p className="lead"><Highlight text={hack.summary} query={query} /></p>

      <button
        type="button"
        className={`wide ${favorite ? 'on' : ''}`}
        onClick={() => store.toggleFavorite(hack.id)}
      >
        {favorite ? '★ 気になるに入れています（押すと外す）' : '☆ 気になるに入れる'}
      </button>

      <section>
        <h3>やり方</h3>
        <ol className="steps">
          {hack.steps.map((step, i) => (
            <li key={i}><Highlight text={step} query={query} /></li>
          ))}
        </ol>
      </section>

      <section>
        <h3>なぜ効くと言われているか</h3>
        <p><Highlight text={hack.why} query={query} /></p>
      </section>

      {hack.caution ? (
        <section className="caution">
          <h3>⚠ 気をつけること</h3>
          <p><Highlight text={hack.caution} query={query} /></p>
        </section>
      ) : null}

      {store.state.settings.showBasis ? (
        <section className="basis">
          <h3>{basis.icon} どこまで確かか</h3>
          <p className="basis-label">{basis.label}</p>
          <p>{hack.basis.label}</p>
          <p className="note small">{basis.note}</p>
        </section>
      ) : null}

      <section>
        <h3>やってみた記録（この端末だけに残ります）</h3>
        <div className="row">
          {TRIED_STATUS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`pill ${record && record.status === s.id ? 'on' : ''}`}
              onClick={() => store.setTried(hack.id, s.id)}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>
        <textarea
          className="memo"
          placeholder="やってみて気づいたこと（自分用のメモ）"
          value={(record && record.memo) || ''}
          onChange={(e) => store.setMemo(hack.id, e.target.value)}
        />
      </section>

      <section>
        <h3>こういう時に</h3>
        <div className="tags">
          {(hack.situations || []).map((s) => (
            <button key={s} type="button" className="tag button" onClick={() => onSearch(s)}>{s}</button>
          ))}
        </div>
        <h3>キーワード</h3>
        <div className="tags">
          {(hack.tags || []).map((tag) => (
            <button key={tag} type="button" className="tag button" onClick={() => onSearch(tag)}>{tag}</button>
          ))}
        </div>
      </section>

      {(hack.related || []).length > 0 ? (
        <section>
          <h3>いっしょに使えるもの</h3>
          <ul className="related">
            {hack.related.map((rid) => {
              const other = hackById(rid);
              if (!other) return null;
              return (
                <li key={rid}>
                  <button type="button" onClick={() => onOpen(rid)}>{other.title} →</button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
