import React from 'react';
import { PLACE_MAP, countByTactic, countByPlace } from '../lib/records.js';
import { TACTIC_MAP } from '../data/tactics.js';
import { EyeSigil, Rule } from './Ornament.jsx';
import { GLYPHS } from '../data/glyphs.js';

function when(at) {
  const d = new Date(at);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Records({ records, onRemove, onGoCheck }) {
  const byTactic = countByTactic(records);
  const byPlace = countByPlace(records);

  return (
    <>
      <div className="head">
        <EyeSigil size={64} className="sigil" />
        <h1>記録</h1>
        <p>{records.length}件。すべてこの端末の中だけにあります。</p>
      </div>
      <Rule mark={GLYPHS.reference} />

      {records.length === 0 ? (
        <div className="card quiet">
          <p>まだ記録はありません。</p>
          <p className="muted">
            「貼って調べる」で調べたあと、記録に残せます。争うためではなく、
            あとから自分が「あれは気のせいだったか」と迷わないための控えです。
          </p>
          <div className="row end">
            <button className="primary" onClick={onGoCheck}>
              貼って調べる
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="note">
            残しているのは<strong>いつ・どこで・どの言い回しに当たったか</strong>だけです。
            相手の名前・連絡先は持ちません。回数は「その相手がどういう人か」の判定ではありません。
          </div>

          {byTactic.length > 0 && (
            <div className="card">
              <h3>よく当たっている型</h3>
              <ul className="tiny">
                {byTactic.slice(0, 5).map((c) => (
                  <li key={c.tacticId}>
                    {TACTIC_MAP[c.tacticId]?.name || c.tacticId} — {c.count}回
                  </li>
                ))}
              </ul>
              {byPlace.length > 0 && (
                <p className="tiny">
                  場面：{byPlace.map((p) => `${p.place.label} ${p.count}件`).join(' / ')}
                </p>
              )}
            </div>
          )}

          {records.map((r) => (
            <div className="card" key={r.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="tiny">
                  {when(r.at)}・{PLACE_MAP[r.placeId]?.icon} {PLACE_MAP[r.placeId]?.label}
                </span>
                {r.masked && <span className="badge">伏せて保存</span>}
              </div>
              <div className="excerpt" style={{ marginTop: 8 }}>
                {r.text}
              </div>
              {r.tacticIds.length > 0 && (
                <div className="chips">
                  {r.tacticIds.map((id) => (
                    <span className="chip" key={id}>
                      {TACTIC_MAP[id]?.name || id}
                    </span>
                  ))}
                </div>
              )}
              {r.note && <p className="muted">{r.note}</p>}
              <div className="row end">
                <button className="danger ghost" onClick={() => onRemove(r.id)}>
                  この記録を消す
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
