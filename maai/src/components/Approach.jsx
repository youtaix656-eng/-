import React, { useLayoutEffect, useState } from 'react';
import { APPROACHES, PHASES, PHASE_MAP, EVIDENCE, approachesInPhase } from '../data/approach.js';
import { sourcesOf } from '../data/sources.js';
import { useFocusJump } from './useFocusJump.js';
import { GapSigil, Rule } from './Ornament.jsx';
import { GLYPHS } from '../data/glyphs.js';

/** 近づき方ひとつぶん。**「やってみた」印は付けられるが、効き目は記録しない。** */
function ApproachCard({ item, open, onToggle, tried, onToggleTried, id }) {
  const phase = PHASE_MAP[item.phase];
  const ev = EVIDENCE[item.evidence];
  return (
    <div className={`card ${open ? 'opened' : ''}`} id={id}>
      <div className="card-head">
        <div>
          {open && <span className="plate-glyph">{phase?.icon}</span>}
          <h3 className={open ? 'plate-title' : ''} style={{ marginBottom: 2 }}>
            {open ? item.name : `${phase?.icon} ${item.name}`}
          </h3>
          <span className="tiny">{phase?.label}</span>
        </div>
        <button className="ghost" onClick={onToggle} aria-expanded={!!open}>
          {open ? '閉じる' : 'くわしく'}
        </button>
      </div>

      <p className={open ? 'plate-summary' : ''}>{item.summary}</p>

      <div className="chips">
        <span className="chip">
          {ev.icon} {ev.label}
        </span>
        {tried && <span className="chip on">{GLYPHS.circle} やってみた</span>}
      </div>

      {open && (
        <>
          <h3>どういうことか</h3>
          <p>{item.why}</p>

          <h3>自分の側でできること</h3>
          <ul>
            {item.how.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>

          <h3>やりがちな取り違え</h3>
          <ul className="muted">
            {item.mistakes.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>

          <h3>確からしさ</h3>
          <p className="tiny">{item.evidenceNote}</p>

          <h3>出典</h3>
          <ul className="tiny">
            {sourcesOf(item.sourceIds).map((s) => (
              <li key={s.id}>
                {s.research === false ? `${s.tocTitle}（研究ではありません）` : s.title}
                {s.author ? `（${[s.author, s.year].filter(Boolean).join(', ')}）` : ''}
                {s.check && ' ※要確認'}
              </li>
            ))}
          </ul>

          <div className="row end">
            <button className={tried ? 'ghost' : ''} onClick={onToggleTried}>
              {tried ? 'やってみた印を外す' : 'やってみた印をつける'}
            </button>
          </div>
          <p className="tiny">
            印は「自分がやれたかどうか」だけです。<strong>効き目は記録しません</strong>——
            相手の変化は測れないので、記録すると当てにならない点数になります。
          </p>
        </>
      )}
    </div>
  );
}

export default function Approach({ focus, onFocusDone, tried = {}, onToggleTried, onGo }) {
  const [phase, setPhase] = useState('');
  const [openId, setOpenId] = useState('');

  const isPhase = PHASES.some((p) => p.id === focus);

  // useEffect ではなく useLayoutEffect（Tactics.jsx と同じ理由。
  // 開く処理が光らせる処理より後になると、flash が消える）。
  useLayoutEffect(() => {
    if (!focus) return;
    if (isPhase) setPhase(focus);
    else setOpenId(focus);
  }, [focus, isPhase]);

  useFocusJump(focus ? `toc-${isPhase ? 'phase' : 'approach'}-${focus}` : '', onFocusDone);

  const shown = phase ? approachesInPhase(phase) : APPROACHES;

  return (
    <>
      <div className="head">
        <GapSigil size={64} className="sigil" />
        <h1>近づき方</h1>
        <p>
          {APPROACHES.length}件。相手を動かす手ではなく、
          <strong>自分の側だけでできること</strong>を集めています。
        </p>
      </div>
      <Rule mark={GLYPHS.circlePlus} />

      <div className="note">
        効き目の大きさは書いていません（「◯％が落ちる」は実験の条件次第で変わります）。
        代わりに、その話が<strong>どのくらい確かめられているか</strong>を1件ずつ付けました。
        {EVIDENCE.thin.icon} が付いているものは、よく言われているだけで、
        <strong>支えになる研究をこちらで見つけられていない</strong>ものです。
      </div>

      <div className="chips">
        <button className={`chip ${phase === '' ? 'on' : ''}`} onClick={() => setPhase('')}>
          すべて（{APPROACHES.length}）
        </button>
        {PHASES.map((p) => (
          <button
            key={p.id}
            id={`toc-phase-${p.id}`}
            className={`chip ${phase === p.id ? 'on' : ''}`}
            onClick={() => setPhase(phase === p.id ? '' : p.id)}
          >
            {p.icon} {p.label}（{approachesInPhase(p.id).length}）
          </button>
        ))}
      </div>

      {phase && <div className="note">{PHASE_MAP[phase].summary}</div>}

      {shown.map((a) => (
        <ApproachCard
          key={a.id}
          id={`toc-approach-${a.id}`}
          item={a}
          open={openId === a.id}
          onToggle={() => setOpenId(openId === a.id ? '' : a.id)}
          tried={!!tried[a.id]}
          onToggleTried={() => onToggleTried(a.id)}
        />
      ))}

      <div className="card quiet">
        <h3>誘う前に、ひとつだけ</h3>
        <p className="muted">
          この一覧の中でいちばん効くのは、うまい誘い方ではなく
          <strong>「あいまいな返事は断り」</strong>のほうです。断りは、はっきり「いいえ」と
          言わない形をとるのが普通だと分かっています。ここを取り違えると、
          近づき方はそのまま「断りを押し返す型」に変わります。
        </p>
        <div className="row end">
          <button onClick={() => onGo('consent')}>同意のことを読む</button>
        </div>
      </div>
    </>
  );
}
