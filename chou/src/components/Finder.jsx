import React from 'react';

// どの画面にも置く「さがす」欄（提案22）。**ここが単一の正**——
// 画面ごとに作ると、片方だけ直したときに必ず食い違う（鏡の Finder と同じ形）。
//
// 決めていること
//  - **ラベルを必ず付ける**（placeholder は入力すると消えるので、ラベルの代わりにしない）。
//  - **0件でも黙らない。** 呼び出し側が `count` を渡すので、絞り込んだあとの件数を必ず出す。
//  - **さがした語を消せる**（押しにくい端末で全消しできないと詰む）。

export default function Finder({ id, label, value, onChange, count = null, total = null, hint = '' }) {
  return (
    <div className="finder" id={id}>
      <label className="search">
        <span className="sr-only">{label}</span>
        <input type="search" value={value} placeholder={label} onChange={(e) => onChange(e.target.value)} />
      </label>
      {value && (
        <button type="button" className="ghost small" onClick={() => onChange('')}>
          さがした語を消す
        </button>
      )}
      <p className="muted small">
        {value
          ? count === 0
            ? `「${value}」に当たるものはありませんでした。ひらがなでも引けます。`
            : `「${value}」に当たるもの ${count} 件${total !== null ? `（全 ${total} 件）` : ''}`
          : hint}
      </p>
    </div>
  );
}
