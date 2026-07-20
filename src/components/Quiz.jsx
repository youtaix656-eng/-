import { useEffect, useMemo, useState } from 'react';
import QuestionCard from './QuestionCard.jsx';
import { getSubjects } from '../lib/stats.js';
import { subjectMatches } from '../data/examScope.js';

// 科目をシャッフルして出題順を作る
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 指定科目に一致する問題を集める（表記の揺れ・別名も許容）
function poolForSubject(questions, subject) {
  if (subject === 'all') return questions;
  const exact = questions.filter((q) => q.subject === subject);
  if (exact.length > 0) return exact;
  // 完全一致が無ければ別名照合（試験範囲の正式名などから来た場合）
  return questions.filter((q) => subjectMatches(q.subject, { name: subject }));
}

// 一問一答モード
export default function Quiz({ store, initialSubject, initialQuestions, onConsumed, onOpenKeyword }) {
  const { questions, memos, links, recordAnswer, setMemo, setLink } = store;
  const subjects = useMemo(() => getSubjects(questions), [questions]);

  const [subject, setSubject] = useState(initialSubject || 'all'); // 'all' or 科目名
  const [started, setStarted] = useState(false);
  const [order, setOrder] = useState([]);
  const [idx, setIdx] = useState(0);
  const [sessionStats, setSessionStats] = useState({ total: 0, correct: 0 });

  // 出題ビルダー等から「この問題群を出す」指定、または科目指定で来たら自動開始
  useEffect(() => {
    if (initialQuestions && initialQuestions.length > 0) {
      setSubject('all');
      setOrder(initialQuestions); // 順序は呼び出し側で決定済み
      setIdx(0);
      setSessionStats({ total: 0, correct: 0 });
      setStarted(true);
      onConsumed?.();
    } else if (initialSubject) {
      const pool = poolForSubject(questions, initialSubject);
      if (pool.length > 0) {
        setSubject(initialSubject);
        setOrder(shuffle(pool));
        setIdx(0);
        setSessionStats({ total: 0, correct: 0 });
        setStarted(true);
      }
      onConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    const pool = poolForSubject(questions, subject);
    if (pool.length === 0) return;
    setOrder(shuffle(pool));
    setIdx(0);
    setSessionStats({ total: 0, correct: 0 });
    setStarted(true);
  };

  const handleAnswered = (correct) => {
    recordAnswer(order[idx], correct);
    setSessionStats((s) => ({ total: s.total + 1, correct: s.correct + (correct ? 1 : 0) }));
  };

  const handleNext = () => {
    if (idx + 1 < order.length) setIdx(idx + 1);
    else setIdx(order.length); // 終了画面へ
  };

  // ---- 開始前 ----
  if (!started) {
    return (
      <div className="view">
        <h2 className="view-title">一問一答</h2>
        <p className="view-desc">科目を選んで演習を始めましょう。ランダムに出題されます。</p>

        <div className="card">
          <label className="section-label" style={{ marginTop: 0 }}>
            科目を選択
          </label>
          <div className="chip-row">
            <button
              className={`chip ${subject === 'all' ? 'active' : ''}`}
              onClick={() => setSubject('all')}
            >
              すべて（{questions.length}）
            </button>
            {subjects.map((s) => {
              const n = questions.filter((q) => q.subject === s).length;
              return (
                <button
                  key={s}
                  className={`chip ${subject === s ? 'active' : ''}`}
                  onClick={() => setSubject(s)}
                >
                  {s}（{n}）
                </button>
              );
            })}
          </div>
          <button
            className="btn primary block lg"
            style={{ marginTop: 14 }}
            onClick={start}
            disabled={questions.length === 0}
          >
            演習を始める
          </button>
        </div>
      </div>
    );
  }

  // ---- 終了画面 ----
  if (idx >= order.length) {
    const rate =
      sessionStats.total > 0
        ? Math.round((sessionStats.correct / sessionStats.total) * 100)
        : 0;
    return (
      <div className="view">
        <h2 className="view-title">お疲れさまでした</h2>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="tile" style={{ boxShadow: 'none', border: 'none' }}>
            <div className="num">{rate}%</div>
            <div className="lbl">今回の正答率</div>
          </div>
          <p className="view-desc" style={{ marginTop: 8 }}>
            {sessionStats.total}問中 {sessionStats.correct}問 正解
          </p>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => setStarted(false)}>
              科目を選び直す
            </button>
            <button className="btn primary" onClick={start}>
              もう一度
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- 出題中 ----
  const current = order[idx];
  return (
    <div className="view">
      <div className="exam-timer">
        <span className="count">
          {subject === 'all' ? 'すべての科目' : subject}
        </span>
        <span className="count">
          {idx + 1} / {order.length}
        </span>
      </div>
      <div className="progress">
        <span style={{ width: `${((idx + 1) / order.length) * 100}%` }} />
      </div>

      <QuestionCard
        key={current.id}
        question={current}
        memo={memos[current.id]}
        onSetMemo={setMemo}
        link={links[current.id]}
        onSetLink={setLink}
        onOpenKeyword={onOpenKeyword}
        onAnswered={handleAnswered}
        onNext={handleNext}
        isLast={idx + 1 >= order.length}
      />
    </div>
  );
}
