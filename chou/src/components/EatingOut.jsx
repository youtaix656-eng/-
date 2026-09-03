import React, { useMemo, useState } from 'react';
import { EATING_OUT_INTRO, EATING_OUT_KINDS, EATING_OUT_NOTE, EATING_OUT_SOURCE } from '../data/eatingOut.js';
import { useFocusJump } from './useFocusJump.js';
import Finder from './Finder.jsx';
import RedFlagLink from './RedFlagLink.jsx';

// 外食・コンビニの選び方（提案20）。
// **特定のお店・商品の名前を持たない**・**値段の話をしない**（決まり21）。

const plain = (s) => String(s || '').replace(/\*\*/g, '');

export default function EatingOut({ onGo, focus, onFocusDone }) {
  useFocusJump(focus, onFocusDone);
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const needle = q.trim();
    if (!needle) return EATING_OUT_KINDS;
    return EATING_OUT_KINDS.filter((k) =>
      [k.title, k.reading, k.body, k.look].some((t) => String(t).includes(needle)),
    );
  }, [q]);

  return (
    <div className="page">
      <div className="page-head">
        <h1>外で食べるときの選び方</h1>
        {EATING_OUT_INTRO.map((line) => (
          <p key={line} className="muted">
            {line}
          </p>
        ))}
      </div>

      <Finder
        id="eatout-find"
        label="麺・パンなどでさがす"
        value={q}
        onChange={setQ}
        count={list.length}
        total={EATING_OUT_KINDS.length}
        hint={`${EATING_OUT_KINDS.length}件を並べています。`}
      />

      <section className="block" id="eatout-list">
        <div className="block-head">
          <h2>買うときに、表示のどこを見るか</h2>
        </div>
        <ul className="flags">
          {list.map((kind) => (
            <li key={kind.id} id={`eatout-${kind.id}`}>
              <strong>{kind.title}</strong>
              <span className="small">{plain(kind.body)}</span>
              <span className="muted small">見るところ：{plain(kind.look)}</span>
              <span className="muted small">自分の記録で：{plain(kind.mine)}</span>
              {kind.conflict && (
                <button type="button" className="ghost" onClick={() => onGo(kind.conflict.view, kind.conflict.targetId)}>
                  {kind.conflict.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="notice" id="eatout-note">
        <p>{EATING_OUT_NOTE}</p>
        <button type="button" className="ghost" onClick={() => onGo('fodmap')}>
          低FODMAP の一覧を見る
        </button>
      </div>

      <RedFlagLink onGo={onGo} />

      <p className="muted small" id="eatout-source">
        出典：{EATING_OUT_SOURCE.text}
        {EATING_OUT_SOURCE.check && ' ※要確認'}
        <br />
        最終確認日：{EATING_OUT_SOURCE.checkedOn}
      </p>
    </div>
  );
}
