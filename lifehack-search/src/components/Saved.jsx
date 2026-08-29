import React from 'react';
import HackCard from './HackCard.jsx';
import { hackById } from '../data/hacks.js';
import { TRIED_STATUS } from '../lib/useStore.js';

const STATUS_MAP = Object.fromEntries(TRIED_STATUS.map((s) => [s.id, s]));

/** 気になる（★）と、やってみた記録。どちらもこの端末だけに残る。 */
export default function Saved({ store, onOpen, onGoSearch }) {
  const favorites = store.state.favorites.map(hackById).filter(Boolean);
  const tried = Object.entries(store.state.tried)
    .map(([id, record]) => ({ hack: hackById(id), record }))
    .filter((row) => row.hack)
    .sort((a, b) => (b.record.at || 0) - (a.record.at || 0));

  return (
    <div className="view">
      <h2>気になる・やってみた</h2>
      <p className="note">この端末の中だけに残ります（送信していません）。</p>

      <section>
        <h3>★ 気になる（{favorites.length}）</h3>
        {favorites.length === 0 ? (
          <p className="empty">
            まだありません。一覧の ☆ を押すとここに入ります。
            <button type="button" className="link" onClick={onGoSearch}>さがしに行く</button>
          </p>
        ) : (
          <div className="list">
            {favorites.map((hack) => (
              <HackCard
                key={hack.id}
                hack={hack}
                onOpen={onOpen}
                favorite
                onToggleFavorite={store.toggleFavorite}
                tried={store.state.tried[hack.id] && STATUS_MAP[store.state.tried[hack.id].status]
                  ? STATUS_MAP[store.state.tried[hack.id].status].label
                  : null}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3>やってみた記録（{tried.length}）</h3>
        {tried.length === 0 ? (
          <p className="empty">まだありません。項目を開いて「試した」「続けている」「合わなかった」を押すと残ります。</p>
        ) : (
          <ul className="tried-list">
            {tried.map(({ hack, record }) => {
              const status = STATUS_MAP[record.status];
              return (
                <li key={hack.id}>
                  <button type="button" onClick={() => onOpen(hack.id)}>
                    <span className="tried-status">{status ? `${status.icon} ${status.label}` : '記録'}</span>
                    <span className="tried-title">{hack.title}</span>
                    {record.memo ? <span className="tried-memo">{record.memo}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="note small">
          「合わなかった」も残します。合わなかったことが分かるのも結果なので、消さずに置いておけるようにしています。
        </p>
      </section>
    </div>
  );
}
