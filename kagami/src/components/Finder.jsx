import React from 'react';
import { GLYPHS } from '../data/glyphs.js';

/**
 * どの画面でも同じ形のさがす欄。
 *
 * **0件のときに黙らない**——見つからなかったことを必ず言う（画面ごとに書くと、
 * 片方だけ直したときに食い違う）。**件数は絞り込み後の数を出す**。
 */
export default function Finder({ label, value, onChange, total, shown, hint }) {
  return (
    <>
      <input
        type="text"
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onChange('');
        }}
        placeholder={`${label}（読みでも引けます。Escで消します）`}
      />
      {value.trim() && (
        <p className="tiny">
          {total}件のうち <strong>{shown}件</strong>
          <button className="chip" style={{ marginLeft: 8 }} onClick={() => onChange('')}>
            {GLYPHS.cross} さがすのをやめる
          </button>
        </p>
      )}
      {value.trim() && shown === 0 && (
        <div className="card quiet">
          <p className="muted">「{value}」では見つかりませんでした。{hint}</p>
        </div>
      )}
    </>
  );
}
