import React, { useState } from 'react';
import { TACTIC_MAP, akaNameOf } from '../data/tactics.js';
import {
  COUNTER_BEST_SCENES, COUNTER_SCENE_NOTES, COUNTER_NEXT, COUNTER_STEP, STEP_LABELS, SCENE_MAP,
} from '../data/people.js';
import { HABIT_MAP } from '../data/habits.js';
import { orderCounters, summarize, triesOf, RESULTS, RESULT_MAP, MIN_TRIES } from '../lib/tried.js';
import { GLYPHS } from '../data/glyphs.js';

/**
 * 「黒い心理学で返すなら」の一覧。**見立てと型の一覧で同じものを使う。**
 * 並べ替えは lib/tried.js に任せる（画面で順番を決めない）。
 */
export default function CounterList({
  type, scene = '', tries = [], hidden = [], onTry, onHide, onGoTactic, caseId = '',
  myHabits = [], practice = false,
}) {
  const [memo, setMemo] = useState('');
  const [explain, setExplain] = useState('');
  const [showNext, setShowNext] = useState('');
  const sum = summarize(tries);
  const ordered = orderCounters(type.counters, { tries, scene, bestScenes: COUNTER_BEST_SCENES });
  const shown = ordered.filter((c) => !hidden.includes(c.tacticId));
  const hiddenCount = ordered.length - shown.length;

  /** その癖がある人には使いにくい手（25）。**やるなとは言わない**——先に知らせるだけ */
  const hardFor = (tacticId) =>
    myHabits
      .map((h) => HABIT_MAP[h])
      .filter((h) => h && (h.hardCounters || []).includes(tacticId))
      .map((h) => h.title);

  return (
    <>
      <p className="tiny">こちらが呑まれないための型を挙げています。</p>

      {!practice && (
        <input
          type="text"
          value={memo}
          maxLength={200}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="ひとこと（任意。次に「やってみた」を押すと一緒に残ります）"
          style={{ marginBottom: 4 }}
        />
      )}

      {shown.map((c) => {
        const s = sum.get(c.tacticId);
        const mine = triesOf(tries, c.tacticId);
        const fits = scene && (COUNTER_BEST_SCENES[c.tacticId] || []).includes(scene);
        const sceneNote = scene && (COUNTER_SCENE_NOTES[c.tacticId] || {})[scene];
        const step = COUNTER_STEP[c.tacticId];
        const hard = hardFor(c.tacticId);

        // 声に出す前の下読み用（26）。言い方だけを大きく出す
        if (practice) {
          return (
            <div className="counter" key={c.tacticId}>
              <span className="tiny">
                {STEP_LABELS[step]}・{akaNameOf(c.tacticId) || TACTIC_MAP[c.tacticId]?.name}
              </span>
              <p className="script practice">「{c.script}」</p>
              {sceneNote && <p className="tiny">{SCENE_MAP[scene].label}では：{sceneNote}</p>}
            </div>
          );
        }

        return (
          <div className="counter" key={c.tacticId}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
              <span className="row" style={{ gap: 6 }}>
                <span className="badge">{STEP_LABELS[step]}</span>
                <button className="chip on" onClick={() => onGoTactic(c.tacticId)}>
                  {akaNameOf(c.tacticId) || TACTIC_MAP[c.tacticId]?.name || c.tacticId}
                </button>
                {akaNameOf(c.tacticId) && (
                  <span className="tiny">（{TACTIC_MAP[c.tacticId]?.name}）</span>
                )}
              </span>
              <span className="tiny">
                {fits && `${SCENE_MAP[scene].label}向き `}
                {s
                  ? `${s.total}回試した${s.total >= MIN_TRIES ? `（${GLYPHS.circle}${s.ok}／${GLYPHS.cross}${s.ng}）` : ''}`
                  : 'まだ試していない'}
              </span>
            </div>

            <p style={{ margin: '6px 0' }}>{c.how}</p>
            <p className="script">「{c.script}」</p>

            {sceneNote && (
              <p className="tiny">
                {SCENE_MAP[scene].label}では：{sceneNote}
              </p>
            )}

            {hard.length > 0 && (
              <p className="tiny">
                {GLYPHS.reference} 「{hard.join('・')}」に印を付けているので、この手は最初は使いにくいかもしれません。
                やるなという意味ではなく、うまくいかなくても自分のせいにしないための一言です。
              </p>
            )}

            <div className="row" style={{ gap: 6, marginTop: 6 }}>
              <span className="tiny">やってみた：</span>
              {RESULTS.map((r) => (
                <button
                  key={r.id}
                  className="chip"
                  onClick={() => {
                    onTry({ tacticId: c.tacticId, typeId: type.id, caseId, result: r.id, note: memo });
                    setMemo('');
                  }}
                >
                  {r.mark} {r.label}
                </button>
              ))}
              <button className="chip" onClick={() => setShowNext(showNext === c.tacticId ? '' : c.tacticId)}>
                効かなかったら
              </button>
              <button className="chip" onClick={() => setExplain(explain === c.tacticId ? '' : c.tacticId)}>
                {explain === c.tacticId ? '説明を閉じる' : 'この型の説明'}
              </button>
              <button className="chip" onClick={() => onHide(c.tacticId)}>
                {GLYPHS.cross} 隠す
              </button>
            </div>

            {showNext === c.tacticId && COUNTER_NEXT[c.tacticId] && (
              <div className="note" style={{ margin: '8px 0' }}>
                <strong>次の一手</strong>
                <br />
                {COUNTER_NEXT[c.tacticId]}
              </div>
            )}

            {explain === c.tacticId && TACTIC_MAP[c.tacticId] && (
              <div className="note" style={{ margin: '8px 0' }}>
                <strong>{TACTIC_MAP[c.tacticId].name}</strong>
                <br />
                {TACTIC_MAP[c.tacticId].summary}
                <br />
                <span className="tiny">{TACTIC_MAP[c.tacticId].why}</span>
              </div>
            )}

            {mine.length > 0 && (
              <p className="tiny" style={{ marginTop: 4 }}>
                {mine.slice(0, 3).map((t) => `${RESULT_MAP[t.result].mark}${t.note ? ` ${t.note}` : ''}`).join(' ／ ')}
                {mine.length > 3 && ` ほか${mine.length - 3}件`}
              </p>
            )}
          </div>
        );
      })}

      {hiddenCount > 0 && !practice && (
        <p className="tiny">
          合わないので隠している手が{hiddenCount}件あります。
          <button className="chip" style={{ marginLeft: 6 }} onClick={() => onHide(null)}>
            戻す
          </button>
        </p>
      )}
    </>
  );
}
