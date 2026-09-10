import React from 'react';

// 受診の目安への導線。**どの画面からも行けるようにするための共通部品**（README 決まり19）。
//
// 決めていること
//  - **画面ごとに文言を書かない。** 書くと、片方だけ直したときに黙って食い違う
//    （このアプリの単一の正の考え方と同じ）。
//  - **色で危険度を出さない・当てはまった数を数えない**（決まり1）。
//    出すのは「読める場所がある」ということだけ。
//  - 受診の目安の画面そのものには置かない（自分自身へは飛ばさない）。

export const RED_FLAG_LINK_TEXT =
  '気になることがあるときは、このアプリの中で様子を見ずに、受診の目安を読んでください。';

export const RED_FLAG_LINK_LABEL = '受診の目安を見る';

export default function RedFlagLink({ onGo }) {
  if (typeof onGo !== 'function') return null;
  return (
    <section className="block" id="redflag-link">
      <p className="muted small">{RED_FLAG_LINK_TEXT}</p>
      <button type="button" className="ghost" onClick={() => onGo('redflags', 'flag-list')}>
        {RED_FLAG_LINK_LABEL}
      </button>
    </section>
  );
}
