import { useEffect, useRef, useState } from 'react';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// 模擬試験モード
// 本番想定の問題数・制限時間で通し演習し、終了後に正答率・合格判定を表示する。
// 鍼灸国家試験（はり師・きゅう師）は各分野の設定に合わせて調整可能。
export default function Exam({ store }) {
  const { questions, recordAnswer } = store;

  // 既定は全問だが、問題数と制限時間を選べる
  const presets = [
    { label: 'ミニ模試', count: 10, minutes: 10 },
    { label: 'ハーフ模試', count: 50, minutes: 60 },
    { label: 'フル模試', count: 100, minutes: 120 },
  ];
  // 合格基準は総得点の60%（鍼灸国試の目安）
  const PASS_RATE = 0.6;

  const [stage, setStage] = useState('setup'); // setup | running | result
  const [preset, setPreset] = useState(presets[0]);
  const [order, setOrder] = useState([]);
  const [answers, setAnswers] = useState([]); // index による解答（null=未解答）
  const [idx, setIdx] = useState(0);
  const [remain, setRemain] = useState(0);
  const timerRef = useRef(null);

  const maxCount = Math.min(preset.count, questions.length);

  const startExam = () => {
    const n = Math.min(preset.count, questions.length);
    const picked = shuffle(questions).slice(0, n);
    setOrder(picked);
    setAnswers(new Array(n).fill(null));
    setIdx(0);
    setRemain(preset.minutes * 60);
    setStage('running');
  };

  // タイマー
  useEffect(() => {
    if (stage !== 'running') return;
    timerRef.current = setInterval(() => {
      setRemain((r) => {
        if (r <= 1) {
          clearInterval(timerRef.current);
          finish();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const selectAnswer = (choiceIdx) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = choiceIdx;
      return next;
    });
  };

  const finish = () => {
    clearInterval(timerRef.current);
    // 解答を履歴・SRSに反映（採点時に一括記録）
    setStage('result');
  };

  // 結果ステージに入ったら履歴へ記録（1回だけ）
  // 未解答（skip）はSRS・復習リストを汚さないよう記録しない（採点上は別途、不正解として集計）。
  const recordedRef = useRef(false);
  useEffect(() => {
    if (stage === 'result' && !recordedRef.current) {
      recordedRef.current = true;
      order.forEach((q, i) => {
        if (answers[i] == null) return; // 未解答は記録しない
        const correct = answers[i] === q.answer;
        recordAnswer(q, correct);
      });
    }
    if (stage !== 'result') recordedRef.current = false;
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- セットアップ ----
  if (stage === 'setup') {
    return (
      <div className="view">
        <h2 className="view-title">模擬試験</h2>
        <p className="view-desc">
          本番を想定した問題数・制限時間で通し演習します。終了後に正答率と合格ライン判定を表示します。
        </p>

        <div className="card">
          <label className="section-label" style={{ marginTop: 0 }}>
            形式を選択
          </label>
          <div className="chip-row">
            {presets.map((p) => (
              <button
                key={p.label}
                className={`chip ${preset.label === p.label ? 'active' : ''}`}
                onClick={() => setPreset(p)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="tiles" style={{ marginTop: 6 }}>
            <div className="tile">
              <div className="num">{maxCount}</div>
              <div className="lbl">問題数</div>
            </div>
            <div className="tile">
              <div className="num">{preset.minutes}</div>
              <div className="lbl">制限時間（分）</div>
            </div>
            <div className="tile">
              <div className="num">60%</div>
              <div className="lbl">合格ライン</div>
            </div>
          </div>

          {questions.length < preset.count && (
            <p className="inline-note">
              ※ 収録問題が {questions.length}問のため、この形式では{maxCount}問で実施します。
              本番相当で行うには設定画面から問題をインポートしてください。
            </p>
          )}

          <button className="btn primary block lg" onClick={startExam} style={{ marginTop: 10 }}>
            試験を開始する
          </button>
        </div>
      </div>
    );
  }

  // ---- 結果 ----
  if (stage === 'result') {
    const correctCount = order.reduce(
      (acc, q, i) => acc + (answers[i] === q.answer ? 1 : 0),
      0
    );
    const rate = order.length > 0 ? correctCount / order.length : 0;
    const passed = rate >= PASS_RATE;
    // 科目別の内訳
    const perSubject = {};
    order.forEach((q, i) => {
      if (!perSubject[q.subject]) perSubject[q.subject] = { total: 0, correct: 0 };
      perSubject[q.subject].total += 1;
      if (answers[i] === q.answer) perSubject[q.subject].correct += 1;
    });

    return (
      <div className="view">
        <h2 className="view-title">模擬試験の結果</h2>

        <div className={`result-hero ${passed ? 'pass' : 'fail'}`}>
          <div className="verdict">{passed ? '合格ライン到達' : '合格ライン未満'}</div>
          <div className="score">
            {Math.round(rate * 100)}
            <small>%</small>
          </div>
          <div className="sub">
            {order.length}問中 {correctCount}問 正解 ／ 合格ライン {Math.round(PASS_RATE * 100)}%
          </div>
        </div>

        <div className="section-label" style={{ marginTop: 0 }}>
          科目別の内訳
        </div>
        {Object.entries(perSubject).map(([s, v]) => {
          const acc = v.correct / v.total;
          const cls = acc >= 0.7 ? 'bar-good' : acc >= 0.5 ? 'bar-mid' : 'bar-bad';
          return (
            <div className="stat-row" key={s}>
              <div className="stat-head">
                <span className="stat-subject">{s}</span>
                <span className="stat-pct">
                  {Math.round(acc * 100)}%
                  <span className="stat-sub"> （{v.correct}/{v.total}）</span>
                </span>
              </div>
              <div className={`bar ${cls}`}>
                <span style={{ width: `${acc * 100}%` }} />
              </div>
            </div>
          );
        })}

        <button
          className="btn primary block lg"
          style={{ marginTop: 16 }}
          onClick={() => setStage('setup')}
        >
          もう一度挑戦する
        </button>
      </div>
    );
  }

  // ---- 試験中 ----
  const current = order[idx];
  const answered = answers.filter((a) => a !== null).length;
  const timeWarn = remain <= 60;

  return (
    <div className="view">
      <div className="exam-timer">
        <span className={`time ${timeWarn ? 'warn' : ''}`}>⏱ {fmtTime(remain)}</span>
        <span className="count">
          解答済み {answered} / {order.length}
        </span>
      </div>
      <div className="progress">
        <span style={{ width: `${((idx + 1) / order.length) * 100}%` }} />
      </div>

      <div className="card">
        <div className="q-meta">
          <span className={`badge ${current.type === 'ox' ? 'ox' : 'choice'}`}>
            {current.type === 'ox' ? '○×' : '四択'}
          </span>
          <span className="q-subject">
            第{idx + 1}問 ・ {current.subject}
          </span>
        </div>
        <div className="q-text">{current.question}</div>
        <div className="choices">
          {current.choices.map((choice, i) => {
            const mark =
              current.type === 'ox'
                ? i === 0
                  ? '○'
                  : '×'
                : String.fromCharCode(0x2460 + i);
            return (
              <button
                key={i}
                className={`choice-btn ${answers[idx] === i ? 'selected' : ''}`}
                onClick={() => selectAnswer(i)}
              >
                <span className="mark">{mark}</span>
                <span>{choice}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="btn-row">
        <button className="btn" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>
          ← 前へ
        </button>
        {idx < order.length - 1 ? (
          <button className="btn primary" onClick={() => setIdx(idx + 1)}>
            次へ →
          </button>
        ) : (
          <button className="btn accent" onClick={finish}>
            採点する
          </button>
        )}
      </div>

      <button
        className="btn ghost block sm"
        style={{ marginTop: 10 }}
        onClick={() => {
          if (confirm('試験を終了して採点しますか？（未解答は誤答扱い）')) finish();
        }}
      >
        途中で終了して採点
      </button>
    </div>
  );
}
