import { useEffect, useState } from 'react';

// 1問を表示し、解答・正誤判定・解説・メモを扱う共通コンポーネント
//
// gradeMode=false: 選択と同時に記録し「次へ」ボタンを表示（一問一答向け）
// gradeMode=true : 正解時に むずかしい/ふつう/かんたん の自己評価ボタンを表示し、
//                  その評価で SM-2 の間隔を調整する（復習モード向け）
export default function QuestionCard({
  question,
  memo,
  onSetMemo,
  onAnswered, // (correct, grade?) 解答確定時
  onNext,
  showMemo = true,
  gradeMode = false,
  GRADES,
  isLast = false,
}) {
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);
  const [memoText, setMemoText] = useState(memo || '');

  useEffect(() => {
    setSelected(null);
    setRevealed(false);
    setRecorded(false);
    setMemoOpen(false);
    setMemoText(memo || '');
  }, [question.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const correct = selected === question.answer;

  const handleSelect = (idx) => {
    if (revealed) return;
    setSelected(idx);
    setRevealed(true);
    if (!gradeMode) {
      // 通常モードは即記録
      onAnswered?.(idx === question.answer);
      setRecorded(true);
    }
  };

  // 評価ボタン（復習モード）
  const grade = (g) => {
    onAnswered?.(correct, g);
    setRecorded(true);
    onNext?.();
  };

  const saveMemo = () => {
    onSetMemo?.(question.id, memoText);
    setMemoOpen(false);
  };

  return (
    <div className="card">
      <div className="q-meta">
        <span className={`badge ${question.type === 'ox' ? 'ox' : 'choice'}`}>
          {question.type === 'ox' ? '○×' : '四択'}
        </span>
        <span className="q-subject">{question.subject}</span>
      </div>

      {question.image && (
        <img
          className="q-image"
          src={question.image}
          alt="問題の図"
          loading="lazy"
        />
      )}

      {question.question && <div className="q-text">{question.question}</div>}

      <div className="choices">
        {question.choices.map((choice, idx) => {
          let cls = 'choice-btn';
          if (revealed) {
            if (idx === question.answer) cls += ' correct';
            else if (idx === selected) cls += ' wrong';
          } else if (idx === selected) {
            cls += ' selected';
          }
          const markLabel =
            question.type === 'ox'
              ? idx === 0
                ? '○'
                : '×'
              : String.fromCharCode(0x2460 + idx); // ①②③④
          return (
            <button
              key={idx}
              className={cls}
              onClick={() => handleSelect(idx)}
              disabled={revealed}
            >
              <span className="mark">{markLabel}</span>
              <span>{choice}</span>
            </button>
          );
        })}
      </div>

      {revealed && (
        <>
          <div className={`result-banner ${correct ? 'correct' : 'wrong'}`}>
            {correct ? '正解' : '不正解'}
            <span style={{ fontWeight: 500, fontSize: 13, opacity: 0.85 }}>
              {correct ? '　この調子です' : '　復習リストに追加しました'}
            </span>
          </div>

          {question.explanation && (
            <div className="explanation">
              <span className="label">解説</span>
              {question.explanation}
            </div>
          )}

          {showMemo && (
            <div className="memo-box">
              {!memoOpen ? (
                <button className="btn ghost sm" onClick={() => setMemoOpen(true)}>
                  📝 {memo ? 'メモを編集' : 'メモ・付箋を追加'}
                </button>
              ) : (
                <>
                  <label>覚え方・自分メモ</label>
                  <textarea
                    value={memoText}
                    onChange={(e) => setMemoText(e.target.value)}
                    placeholder="語呂合わせ、間違えた理由、関連知識などを自由に記録"
                    autoFocus
                  />
                  <div className="btn-row" style={{ marginTop: 8 }}>
                    <button className="btn sm" onClick={() => setMemoOpen(false)}>
                      キャンセル
                    </button>
                    <button className="btn primary sm" onClick={saveMemo}>
                      保存
                    </button>
                  </div>
                </>
              )}
              {memo && !memoOpen && <div className="li-memo">{memo}</div>}
            </div>
          )}

          {/* 復習モードの自己評価。正解なら難易度、不正解は「もう一度」。 */}
          {gradeMode && GRADES ? (
            <div style={{ marginTop: 16 }}>
              <div className="grade-label">記憶度は？（次回の出題間隔が変わります）</div>
              {correct ? (
                <div className="btn-row grade-row">
                  <button className="btn grade-hard" onClick={() => grade(GRADES.hard)}>
                    むずかしい
                  </button>
                  <button className="btn grade-good" onClick={() => grade(GRADES.good)}>
                    ふつう
                  </button>
                  <button className="btn grade-easy" onClick={() => grade(GRADES.easy)}>
                    かんたん
                  </button>
                </div>
              ) : (
                <button
                  className="btn primary block lg"
                  onClick={() => grade(GRADES.again)}
                  autoFocus
                >
                  もう一度（近いうちに再出題）→
                </button>
              )}
            </div>
          ) : (
            <div style={{ marginTop: 16 }}>
              <button className="btn primary block lg" onClick={onNext} autoFocus>
                {isLast ? '結果を見る' : '次の問題'} →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
