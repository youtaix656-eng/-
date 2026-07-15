import { useEffect, useState } from 'react';

// 1問を表示し、解答・正誤判定・解説・メモを扱う共通コンポーネント
// onAnswered(correct) は解答が確定した時に呼ばれる。
export default function QuestionCard({
  question,
  memo,
  onSetMemo,
  onAnswered,
  onNext,
  showMemo = true,
  autoFocusNext = true,
  nextLabel = '次の問題',
  isLast = false,
}) {
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);
  const [memoText, setMemoText] = useState(memo || '');

  // 問題が切り替わったら状態をリセット
  useEffect(() => {
    setSelected(null);
    setRevealed(false);
    setMemoOpen(false);
    setMemoText(memo || '');
  }, [question.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (idx) => {
    if (revealed) return;
    setSelected(idx);
    setRevealed(true);
    onAnswered?.(idx === question.answer);
  };

  const correct = selected === question.answer;

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

      <div className="q-text">{question.question}</div>

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

          <div style={{ marginTop: 16 }}>
            <button
              className="btn primary block lg"
              onClick={onNext}
              autoFocus={autoFocusNext}
            >
              {isLast ? '結果を見る' : nextLabel} →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
