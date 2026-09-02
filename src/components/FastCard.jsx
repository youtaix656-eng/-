import { useEffect, useState } from 'react';

// 高速回転カード（3秒想起）。問題→3秒→答え→○△✕。選択肢は選ばず頭の中で想起。
//   Session.jsx（通常の高速回転モード）・Quiz.jsx（○の高速回転）の両方から使う
//   共有コンポーネント（単一の正）。
export default function FastCard({ question, onGraded, GRADES }) {
  const [revealed, setRevealed] = useState(false);
  const [count, setCount] = useState(3);
  useEffect(() => { setRevealed(false); setCount(3); }, [question.id]);
  useEffect(() => {
    if (revealed) return undefined;
    if (count <= 0) { setRevealed(true); return undefined; }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, revealed]);
  const answer = question.choices[question.answer];
  const pick = (kind) => onGraded(kind === 'maru', kind === 'maru' ? (GRADES ? GRADES.easy : 5) : (GRADES ? GRADES.again : 0), kind);
  return (
    <div className="card fast-card">
      <div className="q-meta">
        <span className={`badge ${question.type === 'ox' ? 'ox' : 'choice'}`}>{question.type === 'ox' ? '○×' : '四択'}</span>
        <span className="q-subject">{question.subject}</span>
        <span className="fast-tag">⚡ 高速</span>
      </div>
      {question.image && <img className="q-image" src={question.image} alt="問題の図" loading="lazy" />}
      {question.question && <div className="q-text">{question.question}</div>}
      {!revealed ? (
        <div className="fast-recall">
          <div className="fast-count">{count > 0 ? count : '…'}</div>
          <div className="fast-hint">答えを思い出そう</div>
          <button className="btn ghost sm" onClick={() => setRevealed(true)}>答えを見る →</button>
        </div>
      ) : (
        <>
          <div className="fast-answer">
            <strong>正解：{question.type === 'ox' ? answer : `${question.answer + 1}. ${answer}`}</strong>
            {question.explanation && <div style={{ marginTop: 6 }}>{question.explanation}</div>}
          </div>
          {question.explanation && (
            <div className="recheck-prompt">
              📖 解説を読んでから選びましょう。読まずに進めると、次に同じ問題が出た時も同じ所で間違えます。
            </div>
          )}
          <div className="selfgrade-row" style={{ marginTop: 14 }}>
            <button className="btn self-maru" onClick={() => pick('maru')}><span className="sg-mark">○</span>完璧</button>
            <button className="btn self-sankaku" onClick={() => pick('sankaku')}><span className="sg-mark">△</span>あいまい</button>
            <button className="btn self-batsu" onClick={() => pick('batsu')}><span className="sg-mark">✕</span>わからない</button>
          </div>
        </>
      )}
    </div>
  );
}
