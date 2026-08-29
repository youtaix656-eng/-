import React from 'react';
import { CATEGORY_MAP } from '../data/tactics.js';
import { repliesOf } from '../data/replies.js';
import { sourcesOf } from '../data/sources.js';

/** 型ひとつぶんの中身。一覧・調べた結果・記録のどこからでも同じものを出す。 */
export default function TacticCard({ tactic, cues = [], open, onToggle, id }) {
  const cat = CATEGORY_MAP[tactic.category];
  return (
    <div className="card" id={id}>
      <div className="card-head">
        <div>
          <h3 style={{ marginBottom: 2 }}>
            {cat?.icon} {tactic.name}
          </h3>
          <span className="tiny">{cat?.label}</span>
        </div>
        <button className="ghost" onClick={onToggle} aria-expanded={!!open}>
          {open ? '閉じる' : 'くわしく'}
        </button>
      </div>

      <p>{tactic.summary}</p>

      {cues.length > 0 && (
        <>
          <p className="tiny" style={{ marginBottom: 2 }}>
            この文面で当たった言葉（言葉が一致しただけで、判断はあなたがします）
          </p>
          <div className="chips">
            {cues.map((c) => (
              <span className="chip cue" key={c}>
                {c}
              </span>
            ))}
          </div>
        </>
      )}

      {open && (
        <>
          <h3>なぜ効いてしまうのか</h3>
          <p>{tactic.why}</p>

          <h3>見分け方</h3>
          <ul>
            {tactic.signs.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>

          <h3>こういう形で言われる</h3>
          <ul className="muted">
            {tactic.lines.map((l) => (
              <li key={l}>「{l}」</li>
            ))}
          </ul>

          <h3>できること</h3>
          <ul>
            {repliesOf(tactic.replyIds).map((r) => (
              <li key={r.id}>
                {r.icon} <strong>{r.tocTitle}</strong> — {r.summary}
              </li>
            ))}
          </ul>

          <h3>出典</h3>
          <ul className="tiny">
            {sourcesOf(tactic.sourceIds).map((s) => (
              <li key={s.id}>
                {s.title}（{[s.author, s.year].filter(Boolean).join(', ')}）{s.check && ' ※要確認'}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
