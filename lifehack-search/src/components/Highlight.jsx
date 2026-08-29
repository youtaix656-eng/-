import React from 'react';
import { highlightParts } from '../lib/search.js';

/**
 * 当たった語に色を付けて出す。
 * 切り分けは search.js の highlightParts が単一の正（画面側で正規表現を書かない）。
 */
export default function Highlight({ text, query }) {
  const parts = highlightParts(text, query);
  return (
    <>
      {parts.map((part, i) => (part.hit ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>))}
    </>
  );
}
