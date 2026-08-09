import { useEffect, useState } from 'react';
import { figureFor } from '../data/figures.jsx';
import { MISS_TYPES } from '../lib/missTypes.js';

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
  selfGrade = false, // ○△✕ の自己評価（△✕は復習サイクルへ）
  GRADES,
  isLast = false,
  comparisons = [], // まぎらわしい対比（誤答時に自動提示）＝#8
  reason = '', // なぜ今この問題か（期限切れ／忘却リスク）＝#10
  fast = false, // 高速回転モード：一定秒で自動的に答えを表示＝#6
  onMissType, // (questionId, type) 間違いの型を記録＝#9（あれば△✕後に型を聞く）
  simple = false, // 段階表示：メモ・連結を「もっと」に畳む＝改善1
  missType = '', // この問題の記録済みの間違いの型（型別の出し分け）＝改善3
}) {
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);
  const [memoText, setMemoText] = useState(memo || '');
  const [askType, setAskType] = useState(false); // 間違いの型を尋ねている最中
  const [moreOpen, setMoreOpen] = useState(false); // 「もっと」（メモ・連結）の開閉

  useEffect(() => {
    setSelected(null);
    setRevealed(false);
    setRecorded(false);
    setMemoOpen(false);
    setMemoText(memo || '');
    setAskType(false);
    setMoreOpen(false);
  }, [question.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 高速回転モード（#6）：3秒たったら自動で答え（裏）を表示。自力想起の合図。
  useEffect(() => {
    if (!fast || revealed) return;
    const t = setTimeout(() => setRevealed(true), 3000);
    return () => clearTimeout(t);
  }, [fast, revealed, question.id]);

  const correct = selected === question.answer;

  const handleSelect = (idx) => {
    if (revealed) return;
    setSelected(idx);
    setRevealed(true);
    if (!gradeMode && !selfGrade) {
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

  // ○△✕ の自己評価（毎問）。△✕は「間違えた問題」として復習サイクルへ。
  const pickSelf = (kind) => {
    if (kind === 'maru') {
      onAnswered?.(true, GRADES ? GRADES.easy : 5);
      setRecorded(true);
      onNext?.();
      return;
    }
    // △・✕：復習対象に。型記録が有効なら型を尋ねてから次へ。
    onAnswered?.(false, GRADES ? GRADES.again : 0);
    setRecorded(true);
    if (onMissType) setAskType(true);
    else onNext?.();
  };

  // 間違いの型を記録して次へ（#9）
  const pickType = (type) => {
    if (type) onMissType?.(question.id, type);
    setAskType(false);
    onNext?.();
  };

  // 暗記カード：選択せずに「裏（答え）」をめくる
  const flipToAnswer = () => setRevealed(true);
  const flippedNoSelect = revealed && selected === null;

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
        {fast && !revealed && <span className="fast-flag">⚡3秒</span>}
      </div>

      {/* なぜ今この問題か（#10）＋ 自力想起の合図 */}
      {reason && <div className="q-reason">🧠 {reason}</div>}

      {question.image && (
        <img
          className="q-image"
          src={question.image}
          alt="問題の図"
          loading="lazy"
        />
      )}

      {/* 図問題：インライン模式図（オフライン対応） */}
      {question.figure && (() => {
        const Fig = figureFor(question.figure);
        return Fig ? <Fig /> : null;
      })()}

      {!revealed && (selfGrade || gradeMode) && (
        <div className="card-side-label">表（問題）</div>
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

      {/* 暗記カード：選択せずに答え（裏）をめくる */}
      {!revealed && (selfGrade || gradeMode) && (
        <button className="btn block flip-btn" onClick={flipToAnswer}>
          🔄 答えを見る（裏へ）
        </button>
      )}

      {revealed && (
        <>
          {flippedNoSelect ? (
            <div className="card-side-label back">裏（答え）</div>
          ) : (
            <div className={`result-banner ${correct ? 'correct' : 'wrong'}`}>
              {correct ? '正解' : '不正解'}
              <span style={{ fontWeight: 500, fontSize: 13, opacity: 0.85 }}>
                {correct ? '　この調子です' : '　復習リストに追加しました'}
              </span>
            </div>
          )}

          {/* ケアレス型：まず落ち着いて再確認プロンプト（改善3） */}
          {missType === 'careless' && (
            <div className="recheck-prompt">🧯 ケアレスに注意。選択肢を最後まで読み、引っかけ（「誤っているのはどれか」等）を確認しましょう。</div>
          )}

          {/* 対比カード（#8・改善3）：勘違い型は常時先頭で提示、それ以外は誤答時に下部で提示 */}
          {comparisons.length > 0 && (missType === 'kanchigai' || !correct) && (
            <div className={`compare-card ${missType === 'kanchigai' ? 'top' : ''}`}>
              <div className="compare-head">⚖️ まぎらわしい対比（混同注意）</div>
              {comparisons.slice(0, 2).map((c) => (
                <div className="compare-item" key={c.id}>
                  <div className="compare-title">{c.title}</div>
                  <ul className="compare-members">
                    {(c.members || []).map((m, i) => (<li key={i}>{m}</li>))}
                  </ul>
                  {c.note && <div className="compare-note">💡 {c.note}</div>}
                </div>
              ))}
            </div>
          )}

          {/* 解説（知識不足型は強調） */}
          {question.explanation && (
            <div className={`explanation ${missType === 'chishiki' ? 'emphasis' : ''}`}>
              <span className="label">解説{missType === 'chishiki' ? '（知識を補強）' : ''}</span>
              {question.explanation}
            </div>
          )}

          {/* もっと（メモ・連結）：シンプルモードでは畳む＝改善1 */}
          {(showMemo || onSetLink) && simple && !moreOpen ? (
            <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setMoreOpen(true)}>
              ▸ もっと（メモ・連結キーワード）
            </button>
          ) : (
            <>
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
            </>
          )}

          {/* ○△✕ の自己評価（毎問）。△✕は自動で復習に入ります。 */}
          {selfGrade ? (
            askType ? (
              <div style={{ marginTop: 16 }}>
                <div className="grade-label">どんな間違いでしたか？（型を記録して復習に活かします）</div>
                <div className="misstype-row">
                  {MISS_TYPES.map((t) => (
                    <button key={t.id} className="btn misstype-btn" onClick={() => pickType(t.id)}>
                      {t.label}<small>{t.hint}</small>
                    </button>
                  ))}
                </div>
                <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => pickType(null)}>
                  記録せず次へ →
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 16 }}>
                <div className="grade-label">この問題の理解度は？（△・✕は自動で復習リストに入ります）</div>
                <div className="selfgrade-row">
                  <button className="btn self-maru" onClick={() => pickSelf('maru')}>
                    <span className="sg-mark">○</span>完璧！自信あり
                  </button>
                  <button className="btn self-sankaku" onClick={() => pickSelf('sankaku')}>
                    <span className="sg-mark">△</span>解説がわからない
                  </button>
                  <button className="btn self-batsu" onClick={() => pickSelf('batsu')}>
                    <span className="sg-mark">✕</span>答えも解説もわからない
                  </button>
                </div>
              </div>
            )
          ) : gradeMode && GRADES ? (
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
