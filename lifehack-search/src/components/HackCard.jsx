import React from 'react';
import Highlight from './Highlight.jsx';
import { CATEGORY_MAP, EFFORT_LABELS, RISK_LABEL } from '../data/schema.js';

/** 一覧に出す1件。押すと詳しく見る画面へ。 */
export default function HackCard({ hack, query = '', onOpen, favorite, onToggleFavorite, tried, usedSynonym }) {
  const category = CATEGORY_MAP[hack.category];
  const effort = EFFORT_LABELS[hack.effort] || EFFORT_LABELS[1];
  return (
    <article className="card">
      <button type="button" className="card-main" onClick={() => onOpen(hack.id)}>
        <div className="card-head">
          <span className="chip" style={{ background: category.color }}>
            {category.icon} {category.label}
          </span>
          <span className="chip ghost">{effort.icon} {effort.label}</span>
          {hack.time ? <span className="chip ghost">⏳ {hack.time}</span> : null}
          {hack.risk ? <span className="chip risk">{RISK_LABEL.icon} {RISK_LABEL.label}</span> : null}
        </div>
        <h3>
          <Highlight text={hack.title} query={query} />
        </h3>
        <p className="summary">
          <Highlight text={hack.summary} query={query} />
        </p>
        <div className="tags">
          {(hack.tags || []).map((tag) => (
            <span key={tag} className="tag">
              <Highlight text={tag} query={query} />
            </span>
          ))}
        </div>
        {usedSynonym ? <p className="note small">🔎 言い換え（似た言い方）で見つかりました</p> : null}
        {tried ? <p className="note small">記録：{tried}</p> : null}
      </button>
      <button
        type="button"
        className={`fav ${favorite ? 'on' : ''}`}
        onClick={() => onToggleFavorite(hack.id)}
        aria-label={favorite ? '気になるから外す' : '気になるに入れる'}
        title={favorite ? '気になるから外す' : '気になるに入れる'}
      >
        {favorite ? '★' : '☆'}
      </button>
    </article>
  );
}
