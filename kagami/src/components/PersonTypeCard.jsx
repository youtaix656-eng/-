import React from 'react';
import { CORE_MAP, SCENE_MAP } from '../data/people.js';
import { TACTIC_MAP } from '../data/tactics.js';
import CounterList from './CounterList.jsx';
import { repliesOf } from '../data/replies.js';
import { GLYPHS } from '../data/glyphs.js';

/**
 * 型ひとつぶんの中身。**見立てと型の一覧で同じものを使う**
 * （画面ごとに書くと、片方だけ直したときに必ず食い違う）。
 * matched を渡すと「あなたが選んだふるまい」を、渡さなければ全ふるまいを出す。
 */
export default function PersonTypeCard({
  type, matched, open, onToggle, onGoTactic, id,
  scene = '', tries = [], hidden = [], onTry, onHide, caseId = '', showCounters = false,
  myHabits = [], practice = false, memos,
}) {
  return (
    <div className={`card ${open ? 'opened' : ''}`} id={id}>
      <div className="card-head">
        <div>
          {open && <span className="plate-glyph">{GLYPHS.piece}</span>}
          <h3 className={open ? 'plate-title' : ''} style={{ marginBottom: 2 }}>
            {open ? type.name : `${GLYPHS.piece} ${type.name}`}
          </h3>
          <span className="tiny">
            {(type.cores || []).map((c) => CORE_MAP[c].label).join('・') || '共通する芯には収まらない型'}
            {' ／ '}
            {(type.scenes || []).map((x) => SCENE_MAP[x].label).join('・')}
          </span>
        </div>
        <button className="ghost" onClick={onToggle} aria-expanded={!!open}>
          {open ? '閉じる' : 'くわしく'}
        </button>
      </div>

      <p className={open ? 'plate-summary' : ''}>{type.summary}</p>

      {matched && (
        <>
          <p className="tiny" style={{ marginBottom: 2 }}>
            あなたが選んだふるまい
          </p>
          <ul className="tiny">
            {matched.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </>
      )}

      <h3>取れる距離</h3>
      <p>{type.distance}</p>

      {(showCounters || open) && (
        <>
          <h3>このタイプには、これがおすすめ（黒い心理学で返すなら）</h3>
          <CounterList
            type={type}
            scene={scene}
            tries={tries}
            hidden={hidden}
            onTry={onTry}
            onHide={onHide}
            onGoTactic={onGoTactic}
            caseId={caseId}
            myHabits={myHabits}
            practice={practice}
            memos={memos}
          />
        </>
      )}

      {open && (
        <>
          <h3>なぜ消耗するのか</h3>
          <p>{type.why}</p>

          {!matched && (
            <>
              <h3>こういうふるまい</h3>
              <ul className="tiny">
                {type.behaviors.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </>
          )}

          <h3>使える返し方</h3>
          <ul>
            {repliesOf(type.replyIds).map((r) => (
              <li key={r.id}>
                {r.icon} <strong>{r.tocTitle}</strong> — {r.summary}
              </li>
            ))}
          </ul>

          <h3>組み合わせて出てくる型</h3>
          <div className="chips">
            {type.relatedTacticIds.map((tid) => (
              <button key={tid} className="chip" onClick={() => onGoTactic(tid)}>
                {TACTIC_MAP[tid]?.name || tid}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
