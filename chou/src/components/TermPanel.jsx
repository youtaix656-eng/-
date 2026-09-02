import React from 'react';
import { panelDataFor, DESTINATION_LABELS, NEEDS_REVIEW_BADGE } from '../data/toc.js';

// 用語をタップした時に開く詳細パネル。
// **出すものは `panelDataFor` の1か所から受け取る**（画面ごとに条件を書くと必ず食い違う）。
//  - 説明が空なら「※説明未登録」を出す（黙って空欄にしない）。
//  - 飛び先が無ければボタンの area ごと出さず、「関連する飛び先はありません」と書く。
//  - 確かめきれていない説明には **必ず「※要確認」** を出す。

export default function TermPanel({ entry, onClose, onGo }) {
  const data = panelDataFor(entry);
  if (!data) return null;
  return (
    <div className="panel-back" role="dialog" aria-modal="true" aria-label={data.title} onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div>
            <h2>{data.title}</h2>
            <p className="muted small">{data.reading}</p>
          </div>
          <button type="button" className="ghost small" onClick={onClose}>
            閉じる
          </button>
        </div>

        {data.needsReview && <span className="badge-review">{NEEDS_REVIEW_BADGE}</span>}

        <p className={data.hasDescription ? '' : 'muted'}>{data.description}</p>

        {data.aliases.length > 0 && (
          <p className="muted small">
            別の呼び名：{data.aliases.map((a) => a.name).join('／')}
          </p>
        )}

        {data.hasDestinations ? (
          <div className="dest-list">
            {data.destinations.map((dest, i) => (
              <button
                key={`${dest.type}-${dest.targetId || i}`}
                type="button"
                className="dest"
                onClick={() => onGo(dest)}
              >
                <span className="dest-type">{DESTINATION_LABELS[dest.type]}</span>
                <span>{dest.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="muted small">{data.emptyDestinationsText}</p>
        )}
      </div>
    </div>
  );
}
