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
  link, // { keywords, note, related } 連結学習データ
  onSetLink, // (questionId, patch)
  onOpenKeyword, // (keyword) 連結マップへ飛ぶ
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

          {/* 連結学習：キーワード（タップで連結マップへ）＋ 連結メモ */}
          {onSetLink && (
            <ConnectEditor
              question={question}
              link={link}
              onSetLink={onSetLink}
              onOpenKeyword={onOpenKeyword}
            />
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

// 連結学習の編集（キーワード＋連結メモ）。キーワードはタップで連結マップへ飛べる。
function ConnectEditor({ question, link, onSetLink, onOpenKeyword }) {
  const cur = link || { keywords: [], note: '', related: [] };
  const [open, setOpen] = useState(false);
  const [kwInput, setKwInput] = useState('');
  const [note, setNote] = useState(cur.note || '');

  useEffect(() => {
    setNote((link && link.note) || '');
    setKwInput('');
    setOpen(false);
  }, [question.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const keywords = cur.keywords || [];

  const addKeyword = () => {
    const kw = kwInput.trim();
    if (!kw) return;
    if (!keywords.includes(kw)) onSetLink(question.id, { keywords: [...keywords, kw] });
    setKwInput('');
  };
  const removeKeyword = (kw) =>
    onSetLink(question.id, { keywords: keywords.filter((k) => k !== kw) });
  const saveNote = () => {
    onSetLink(question.id, { note });
    setOpen(false);
  };

  return (
    <div className="connect-box">
      {/* 既存キーワードは常に表示。タップで連結マップへ */}
      {keywords.length > 0 && (
        <div className="chip-row" style={{ marginTop: 12 }}>
          {keywords.map((kw) => (
            <span className="kw-chip" key={kw}>
              <button className="kw-chip-label" onClick={() => onOpenKeyword?.(kw)}>
                🔗 {kw}
              </button>
              <button className="kw-chip-x" onClick={() => removeKeyword(kw)} aria-label="削除">
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {!open ? (
        <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setOpen(true)}>
          🔗 {keywords.length || cur.note ? '連結を編集' : 'キーワード・連結メモを追加'}
        </button>
      ) : (
        <div style={{ marginTop: 10 }}>
          <label className="cb-label">キーワード（タップで連結マップへ）</label>
          <div className="kw-add">
            <input
              type="text"
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
              placeholder="例）四総穴、原穴、大腸経"
            />
            <button className="btn sm" onClick={addKeyword}>
              追加
            </button>
          </div>
          <label className="cb-label" style={{ marginTop: 10 }}>
            連結メモ（この知識のつながり・任意メモ）
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="関連する知識やつながり、覚え方を自由に記録"
          />
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn sm" onClick={() => setOpen(false)}>
              閉じる
            </button>
            <button className="btn primary sm" onClick={saveNote}>
              保存
            </button>
          </div>
        </div>
      )}

      {cur.note && !open && <div className="li-memo">🔗 {cur.note}</div>}
    </div>
  );
}
