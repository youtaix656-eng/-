import React, { useMemo, useState } from 'react';
import { DISEASE_INTRO, DISEASES, DISEASE_NOTE, DISEASE_SOURCE } from '../data/diseases.js';
import { useFocusJump } from './useFocusJump.js';
import Finder from './Finder.jsx';
import RedFlagLink from './RedFlagLink.jsx';

// お腹の病気の読み物（提案17）。**当てはめる仕掛けを作らない**——
// チェックリストも「あなたはこれかもしれません」も置かない（README 決まり1）。

const plain = (s) => String(s || '').replace(/\*\*/g, '');

export default function Diseases({ onGo, focus, onFocusDone }) {
  useFocusJump(focus, onFocusDone);
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const needle = q.trim();
    if (!needle) return DISEASES;
    return DISEASES.filter((d) =>
      [d.title, d.reading, d.what, d.signs].some((t) => String(t).includes(needle)),
    );
  }, [q]);

  return (
    <div className="page">
      <div className="page-head">
        <h1>お腹の病気の読み物</h1>
        {DISEASE_INTRO.map((line) => (
          <p key={line} className="muted">
            {line}
          </p>
        ))}
      </div>

      <div className="notice" id="disease-warning">
        <p>
          <strong>この一覧から自分の病名を決めることはできません。</strong>
          同じ症状でも別の病気のことがあり、見分けるには検査が要ります。
        </p>
        <button type="button" className="ghost" onClick={() => onGo('redflags', 'flag-list')}>
          受診の目安を見る
        </button>
      </div>

      <Finder
        id="disease-find"
        label="病気の名前・症状の言葉でさがす"
        value={q}
        onChange={setQ}
        count={list.length}
        total={DISEASES.length}
        hint={`${DISEASES.length}件を並べています。`}
      />

      <section className="block" id="disease-list">
        <div className="block-head">
          <h2>名前が挙がることのある病気</h2>
        </div>
        <ul className="flags">
          {list.map((d) => (
            <li key={d.id} id={`disease-${d.id}`}>
              <strong>{d.title}</strong>
              <span className="small">{plain(d.what)}</span>
              <span className="muted small">よく挙げられる症状：{plain(d.signs)}</span>
              <span className="muted small">どう調べるか：{plain(d.check)}</span>
              <span className="small">{plain(d.note)}</span>
              {d.screen && (
                <button type="button" className="ghost" onClick={() => onGo(d.screen.view, d.screen.targetId)}>
                  {d.screen.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="notice" id="disease-note">
        <p>{DISEASE_NOTE}</p>
        <button type="button" className="ghost" onClick={() => onGo('visitnote')}>
          受診メモをつくる
        </button>
      </div>

      <RedFlagLink onGo={onGo} />

      <p className="muted small" id="disease-source">
        出典：{DISEASE_SOURCE.text}
        {DISEASE_SOURCE.check && ' ※要確認'}
        <br />
        最終確認日：{DISEASE_SOURCE.checkedOn}
      </p>
    </div>
  );
}
