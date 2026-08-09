import { useMemo, useState } from 'react';
import { pathQuizzes, groupQuizzes, fillBlankQuizzes, buildOptions } from '../lib/kgQuiz.js';

// 連想クイズ：経路クイズ（#23 A―?―B の中間を当てる）＋ 束グルーピング（#24 仲間はどれ？）
export default function AssocQuiz({ graph }) {
  const [mode, setMode] = useState('path'); // path | group
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState({ ok: 0, total: 0 });

  const pathItems = useMemo(() => pathQuizzes(graph, { limit: 20 }), [graph]);
  const groupItems = useMemo(() => groupQuizzes(graph, { limit: 20 }), [graph]);
  const fillItems = useMemo(() => fillBlankQuizzes(graph, { limit: 20 }), [graph]);
  const items = mode === 'path' ? pathItems : mode === 'group' ? groupItems : fillItems;
  const cur = items[idx];

  // 選択肢は問題ごとに一度だけシャッフル
  const options = useMemo(() => (cur ? buildOptions(cur.answer, cur.distractors) : []), [cur]);

  const switchMode = (m) => { setMode(m); setIdx(0); setPicked(null); setScore({ ok: 0, total: 0 }); };
  const pick = (opt) => {
    if (picked) return;
    setPicked(opt);
    setScore((s) => ({ ok: s.ok + (opt === cur.answer ? 1 : 0), total: s.total + 1 }));
  };
  const next = () => { setPicked(null); setIdx((i) => i + 1); };

  return (
    <>
      <div className="section-label">🧩 連想クイズ</div>
      <div className="card">
        <div className="chip-row" style={{ marginBottom: 10 }}>
          <button className={`chip ${mode === 'path' ? 'active' : ''}`} onClick={() => switchMode('path')}>経路クイズ</button>
          <button className={`chip ${mode === 'group' ? 'active' : ''}`} onClick={() => switchMode('group')}>仲間さがし</button>
          <button className={`chip ${mode === 'fill' ? 'active' : ''}`} onClick={() => switchMode('fill')}>穴埋め</button>
          {score.total > 0 && <span className="inline-note" style={{ alignSelf: 'center' }}>{score.ok}/{score.total} 正解</span>}
        </div>

        {!cur ? (
          <p className="inline-note">
            {items.length === 0 ? 'クイズを作るにはもう少しつながりが必要です。問題を解いて知識をつなげましょう。' : '今回の分は終了！お疲れさまでした。'}
          </p>
        ) : (
          <div className="quiz-block">
            <div className="quiz-q">
              {mode === 'path'
                ? <><b>{cur.a}</b> ―（？）― <b>{cur.b}</b>　をつなぐのは？</>
                : mode === 'group'
                ? <><b>{cur.concept}</b> と同じかたまり（仲間）はどれ？</>
                : <><b>{cur.center}</b> の仲間（{cur.shown.join('・')} …）に、あと1つ入るのは？</>}
            </div>
            <div className="quiz-options">
              {options.map((opt) => {
                let cls = 'quiz-opt';
                if (picked) {
                  if (opt === cur.answer) cls += ' correct';
                  else if (opt === picked) cls += ' wrong';
                }
                return (
                  <button key={opt} className={cls} onClick={() => pick(opt)} disabled={!!picked}>{opt}</button>
                );
              })}
            </div>
            {picked && (
              <div style={{ marginTop: 10 }}>
                <div className={`result-banner ${picked === cur.answer ? 'correct' : 'wrong'}`}>
                  {picked === cur.answer ? '正解！' : `残念。正解は ${cur.answer}`}
                </div>
                <button className="btn primary block" style={{ marginTop: 8 }} onClick={next}>次の問題 →</button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
