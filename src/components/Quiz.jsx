import { useEffect, useMemo, useState } from 'react';
import QuestionCard from './QuestionCard.jsx';
import ResetInline from './ResetInline.jsx';
import { getSubjects } from '../lib/stats.js';
import { subjectMatches } from '../data/examScope.js';
import * as storage from '../lib/storage.js';
import { GRADES } from '../lib/srs.js';

// 科目をシャッフルして出題順を作る
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// 原問と派生（同じ過去問由来）を離す（#2）：基幹idでバケット分割しラウンドロビン
const baseId = (id) => String(id).replace(/[a-z]+$/i, '');
function spaceByBase(items) {
  if (items.length < 3) return items;
  const buckets = new Map();
  for (const q of items) { const b = baseId(q.id); if (!buckets.has(b)) buckets.set(b, []); buckets.get(b).push(q); }
  if (buckets.size < 2) return items;
  const lists = shuffle([...buckets.values()]);
  const out = [];
  let more = true;
  while (more) { more = false; for (const l of lists) { if (l.length) { out.push(l.shift()); more = true; } } }
  return out;
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
export default function Quiz({ store, initialSubject, initialQuestions, autoResume, onConsumeAutoResume, onConsumed, onOpenKeyword }) {
  const { questions, memos, links, recordAnswer, setMemo, setLink, bookmarks, toggleBookmark } = store;
  const subjects = useMemo(() => getSubjects(questions), [questions]);

  const [subject, setSubject] = useState(initialSubject || 'all'); // 'all' or 科目名
  const [started, setStarted] = useState(false);
  const [order, setOrder] = useState([]);
  const [idx, setIdx] = useState(0);
  const [sessionStats, setSessionStats] = useState({ total: 0, correct: 0 });
  const [answerLog, setAnswerLog] = useState([]); // [{ q, correct }] 今回の解答（誤答一覧・ジャンル別集計用）
  // このセッションの母集団（「もう一度」で同じ条件を再現するため保持）
  const [sessionPool, setSessionPool] = useState(null);
  // 前回の途中経過（1問ごとに自動保存 → 続きから）
  const [resume, setResume] = useState(null);

  const beginWith = (pool, doShuffle = true) => {
    if (!pool || pool.length === 0) return;
    setSessionPool(pool);
    setOrder(doShuffle ? spaceByBase(shuffle(pool)) : pool);
    setIdx(0);
    setSessionStats({ total: 0, correct: 0 });
    setAnswerLog([]);
    setStarted(true);
  };

  // 出題ビルダー等から「この問題群を出す」指定、または科目指定で来たら自動開始
  useEffect(() => {
    if (initialQuestions && initialQuestions.length > 0) {
      setSubject('all');
      beginWith(initialQuestions, false); // 順序は呼び出し側で決定済み
      onConsumed?.();
    } else if (initialSubject) {
      const pool = poolForSubject(questions, initialSubject);
      if (pool.length > 0) {
        setSubject(initialSubject);
        beginWith(pool);
      }
      onConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 保存済みの途中経過を読み込む（明示指定で来た時は対象外）
  useEffect(() => {
    if ((initialQuestions && initialQuestions.length) || initialSubject) return;
    if (started || !questions.length) return;
    let alive = true;
    storage.loadQuizProgress().then((p) => {
      if (!alive || !p || !Array.isArray(p.ids) || !p.ids.length) return;
      const byId = new Map(questions.map((q) => [q.id, q]));
      const rebuilt = p.ids.map((id) => byId.get(id)).filter(Boolean);
      if (rebuilt.length === 0 || (p.idx || 0) >= rebuilt.length) return;
      const info = {
        subject: p.subject || 'all',
        order: rebuilt,
        idx: Math.min(p.idx || 0, rebuilt.length - 1),
        stats: p.stats || { total: 0, correct: 0 },
      };
      if (autoResume) {
        // ホームの「前回の続きから」からの遷移：そのまま続きを開始
        setSubject(info.subject);
        setSessionPool(info.order);
        setOrder(info.order);
        setSessionStats(info.stats);
        setIdx(info.idx);
        setStarted(true);
        onConsumeAutoResume?.();
      } else {
        setResume(info);
      }
    });
    return () => {
      alive = false;
    };
  }, [questions, started]); // eslint-disable-line react-hooks/exhaustive-deps

  // 1問ごとに途中経過を保存（終了したら消す）
  useEffect(() => {
    if (!started) return;
    if (idx >= order.length) {
      storage.clearQuizProgress();
      return;
    }
    storage.saveQuizProgress({
      subject,
      ids: order.map((q) => q.id),
      idx,
      stats: sessionStats,
      at: Date.now(),
    });
  }, [started, idx, order, subject, sessionStats]);

  const doResume = () => {
    if (!resume) return;
    setSubject(resume.subject);
    setSessionPool(resume.order);
    setOrder(resume.order);
    setSessionStats(resume.stats);
    setIdx(resume.idx);
    setStarted(true);
    setResume(null);
  };

  // 科目選択から開始
  const start = () => {
    beginWith(poolForSubject(questions, subject));
  };
  // 「もう一度」＝同じ母集団を再シャッフルして再演習
  const restart = () => {
    if (sessionPool) beginWith(sessionPool);
    else start();
  };

  const handleAnswered = (correct, grade) => {
    const q = order[idx];
    recordAnswer(q, correct, grade);
    setSessionStats((s) => ({ total: s.total + 1, correct: s.correct + (correct ? 1 : 0) }));
    setAnswerLog((prev) => [...prev, { q, correct }]);
  };

  const handleNext = () => {
    if (idx + 1 < order.length) setIdx(idx + 1);
    else setIdx(order.length); // 終了画面へ
  };

  // 一問一答をリセット（途中経過を破棄して科目選択へ戻す）
  const resetQuiz = () => {
    storage.clearQuizProgress();
    setStarted(false);
    setSessionPool(null);
    setOrder([]);
    setIdx(0);
    setResume(null);
  };

  // ---- 開始前 ----
  if (!started) {
    return (
      <div className="view">
        <h2 className="view-title">一問一答</h2>
        <p className="view-desc">科目を選んで演習を始めましょう。ランダムに出題されます。</p>

        {resume && (
          <button className="btn primary block lg" style={{ marginBottom: 12 }} onClick={doResume}>
            ▶ 前回の続きから（{resume.idx + 1}/{resume.order.length}問・
            {resume.subject === 'all' ? '全科目' : resume.subject}）
          </button>
        )}

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
    const wrongQs = answerLog.filter((a) => !a.correct).map((a) => a.q);
    // ジャンル別の正答率（#6）
    const byGenre = {};
    for (const a of answerLog) {
      const g = a.q.genre || a.q.subject || 'その他';
      if (!byGenre[g]) byGenre[g] = { total: 0, correct: 0 };
      byGenre[g].total += 1;
      if (a.correct) byGenre[g].correct += 1;
    }
    const genreRows = Object.entries(byGenre).sort((x, y) => (x[1].correct / x[1].total) - (y[1].correct / y[1].total));
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
            <button className="btn" onClick={() => { setStarted(false); setSessionPool(null); }}>科目を選び直す</button>
            <button className="btn primary" onClick={restart}>もう一度</button>
          </div>
        </div>

        {/* ジャンル別の正答率（#6・正答率の低い順） */}
        {genreRows.length > 1 && (
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>ジャンル別の正答率（苦手順）</div>
            <ul className="genre-stats">
              {genreRows.map(([g, s]) => {
                const p = Math.round((s.correct / s.total) * 100);
                return (
                  <li key={g}>
                    <span className="gs-name">{g}</span>
                    <span className="gs-bar"><i style={{ width: `${p}%`, background: p < 60 ? 'var(--wrong)' : p < 80 ? 'var(--warn)' : 'var(--correct)' }} /></span>
                    <span className="gs-num">{p}%（{s.correct}/{s.total}）</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* 今回の誤答一覧（#1） */}
        {wrongQs.length > 0 && (
          <div className="card">
            <div className="section-label" style={{ marginTop: 0 }}>今回の誤答（{wrongQs.length}問）</div>
            <ul className="wrong-list">
              {wrongQs.map((q) => (
                <li key={q.id}>
                  <span className="wl-ans">{q.type === 'ox' ? (q.answer === 0 ? '○' : '✕') : `正解 ${q.answer + 1}`}</span>
                  <span className="wl-q">{q.question}</span>
                </li>
              ))}
            </ul>
            <button className="btn accent block" style={{ marginTop: 10 }} onClick={() => beginWith(wrongQs)}>
              ✕ 間違えた{wrongQs.length}問だけ、もう一度
            </button>
          </div>
        )}
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
        selfGrade
        bookmarked={!!bookmarks[current.id]}
        onToggleBookmark={toggleBookmark}
        GRADES={GRADES}
        isLast={idx + 1 >= order.length}
      />
      <ResetInline label="一問一答をリセット" onReset={resetQuiz} />
    </div>
  );
}
