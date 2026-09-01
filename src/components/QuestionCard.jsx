import { useEffect, useMemo, useRef, useState } from 'react';
import { figureFor } from '../data/figures.jsx';
import { MISS_TYPES } from '../lib/missTypes.js';
import { variantsOf } from '../lib/synonyms.js';
import { comparisonsForKeyword } from '../data/mindmapData.js';
import { speak, cancelSpeech, isSpeechSupported } from '../lib/speech.js';

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
  elaborate = [], // 精緻化候補（これと何がつながる？）＝#2。タップで連結キーワードに追加
  whyPrompt = false, // なぜ？チェーン（自己説明）＝#4
  compact = false, // 1画面に収める省スペース表示（学習セッション向け）
  bookmarked = false, // ブックマーク済みか
  onToggleBookmark, // (questionId) ブックマーク切替（右上のしおり）
}) {
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [why, setWhy] = useState(''); // なぜ？の一言（#4）
  const [memoOpen, setMemoOpen] = useState(false);
  const [memoText, setMemoText] = useState(memo || '');
  const [askType, setAskType] = useState(false); // 間違いの型を尋ねている最中
  const [moreOpen, setMoreOpen] = useState(false); // 「もっと」（メモ・連結）の開閉
  const [addedKw, setAddedKw] = useState([]); // この問題で精緻化として追加した語（✓表示用）
  const [zoom, setZoom] = useState(false); // 図の拡大表示（#17）
  const cardRef = useRef(null);
  const touchX = useRef(null);

  // 選択肢は原問どおりの並びで表示（シャッフルなし）。
  // ※解説文の「選択肢1・4が正しい」等の番号参照と①②③④を一致させるため固定。
  const displayOrder = useMemo(
    () => Array.from({ length: question.choices?.length || 0 }, (_, i) => i),
    [question.id]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  // 毎年変わる数値の注意（#3）：解説に「※要確認」があれば鮮度バッジを出す
  const volatile = /※要確認/.test(question.explanation || '');

  // 正解語の別名（#4）：回答後に「別名」を表示（正式名称⇔略称の取り違え対策）
  const aliases = useMemo(() => {
    if (question.type === 'ox') return [];
    const ans = question.choices?.[question.answer] || '';
    const v = variantsOf(ans).filter((x) => x && x !== ans);
    return [...new Set(v)].slice(0, 4);
  }, [question.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 対比カード（#15）：propが無ければタグから補完し、正解時も控えめに提示
  const effComparisons = useMemo(() => {
    if (comparisons && comparisons.length) return comparisons;
    const out = [], seen = new Set();
    for (const t of (question.tags || [])) {
      for (const c of comparisonsForKeyword(t)) if (!seen.has(c.id)) { seen.add(c.id); out.push(c); }
    }
    return out.slice(0, 2);
  }, [question.id, comparisons]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSelected(null);
    setRevealed(false);
    setRecorded(false);
    setMemoOpen(false);
    setMemoText(memo || '');
    setAskType(false);
    setMoreOpen(false);
    setAddedKw([]);
    setWhy('');
    setZoom(false);
    try { cancelSpeech(); } catch { /* noop */ }
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
  //   kind（'maru'|'sankaku'|'batsu'）はonAnsweredの第3引数でそのまま渡し、
  //   あとで△（あいまい）と✕（わからない）を区別できるようにする。
  const pickSelf = (kind) => {
    if (kind === 'maru') {
      onAnswered?.(true, GRADES ? GRADES.easy : 5, kind);
      setRecorded(true);
      onNext?.();
      return;
    }
    // △・✕：復習対象に。型記録が有効なら型を尋ねてから次へ。
    onAnswered?.(false, GRADES ? GRADES.again : 0, kind);
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

  // 読み上げ（#18）：問題文（＋回答後は解説）をTTSで音読する
  const readAloud = () => {
    if (!isSpeechSupported()) return;
    cancelSpeech();
    const parts = [question.question || ''];
    if (revealed && question.explanation) parts.push('解説。' + question.explanation);
    speak(parts.filter(Boolean).join('。 '), { rate: 1 }).catch(() => {});
  };

  // キーボード操作（#9）：1〜4/O・Xで解答、Enter/→で次へ
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return; // 入力中は無効
      if (!revealed) {
        if (question.type === 'ox') {
          if (e.key === 'o' || e.key === 'O') { handleSelect(0); return; }
          if (e.key === 'x' || e.key === 'X') { handleSelect(1); return; }
        }
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= displayOrder.length) { handleSelect(displayOrder[num - 1]); return; }
        if (e.key === 'Enter' || e.key === ' ') { if (selfGrade || gradeMode) { e.preventDefault(); flipToAnswer(); } }
        return;
      }
      // 回答後
      if (selfGrade && !askType) {
        if (e.key === '1') { pickSelf('maru'); return; }
        if (e.key === '2') { pickSelf('sankaku'); return; }
        if (e.key === '3') { pickSelf('batsu'); return; }
      } else if (!selfGrade && !gradeMode) {
        if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); onNext?.(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // 依存なし＝最新のstateを常に参照（毎レンダー貼り替え）

  // スワイプ（#9）：左スワイプで次へ（通常モードの回答後のみ）
  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (dx < -60 && revealed && !selfGrade && !gradeMode) onNext?.();
  };

  return (
    <div className={`card qcard${compact ? ' qcard-compact' : ''}`} ref={cardRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* スクリーンリーダー向けの正誤読み上げ（#20） */}
      <div aria-live="polite" className="sr-only">
        {revealed && !flippedNoSelect ? (correct ? '正解です' : '不正解です') : ''}
      </div>
      <div className="q-meta">
        <span className={`badge ${question.type === 'ox' ? 'ox' : 'choice'}`}>
          {question.type === 'ox' ? '○×' : '四択'}
        </span>
        <span className="q-subject">{question.subject}</span>
        {volatile && <span className="freshness-badge" title="毎年更新される数値。最新値を確認してください">🔄 数値要確認</span>}
        {fast && !revealed && <span className="fast-flag">⚡3秒</span>}
        <span className="q-meta-actions">
          {isSpeechSupported() && (
            <button className="q-tts" onClick={readAloud} aria-label="読み上げ" title="問題（回答後は解説も）を読み上げ">🔊</button>
          )}
          {onToggleBookmark && (
            <button
              className={`q-bookmark${bookmarked ? ' on' : ''}`}
              onClick={() => onToggleBookmark(question.id)}
              aria-label={bookmarked ? 'ブックマーク解除' : '後で見直す（ブックマーク）'}
              aria-pressed={bookmarked}
              title={bookmarked ? 'ブックマーク中（タップで解除）' : '後で見直す'}
            >
              {bookmarked ? '★' : '☆'}
            </button>
          )}
        </span>
      </div>

      {/* なぜ今この問題か（#10）＋ 自力想起の合図 */}
      {reason && <div className="q-reason">🧠 {reason}</div>}

      {question.image && (
        <button className="q-figbtn" onClick={() => setZoom(true)} aria-label="図を拡大">
          <img className="q-image" src={question.image} alt="問題の図" loading="lazy" />
          <span className="q-zoom-hint">🔍 タップで拡大</span>
        </button>
      )}

      {/* 図問題：インライン模式図（オフライン対応） */}
      {question.figure && (() => {
        const Fig = figureFor(question.figure);
        return Fig ? (
          <button className="q-figbtn" onClick={() => setZoom(true)} aria-label="図を拡大">
            <Fig />
            <span className="q-zoom-hint">🔍 タップで拡大</span>
          </button>
        ) : null;
      })()}

      {/* 図の拡大表示（#17） */}
      {zoom && (question.image || question.figure) && (
        <div className="fig-lightbox" onClick={() => setZoom(false)} role="dialog" aria-label="図の拡大">
          <div className="fig-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            {question.image
              ? <img src={question.image} alt="問題の図（拡大）" />
              : (() => { const Fig = figureFor(question.figure); return Fig ? <Fig /> : null; })()}
            <button className="btn primary block" onClick={() => setZoom(false)}>閉じる</button>
          </div>
        </div>
      )}

      {!revealed && (selfGrade || gradeMode) && (
        <div className="card-side-label">表（問題）</div>
      )}

      {question.question && <div className="q-text">{question.question}</div>}

      <div className="choices">
        {displayOrder.map((idx, pos) => {
          const choice = question.choices[idx];
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
              : String.fromCharCode(0x2460 + pos); // 表示順で①②③④
          return (
            <button
              key={idx}
              className={cls}
              onClick={() => handleSelect(idx)}
              disabled={revealed}
            >
              <span className="mark">{markLabel}</span>
              <span>{choice}</span>
              {revealed && idx === question.answer && <span className="choice-tag">正解</span>}
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

          {/* 対比カード（#8・#15）：勘違い型/誤答は先頭で強調、正解時も控えめに提示して予防 */}
          {effComparisons.length > 0 && (
            <div className={`compare-card ${missType === 'kanchigai' ? 'top' : ''}${correct && missType !== 'kanchigai' ? ' subtle' : ''}`}>
              <div className="compare-head">⚖️ まぎらわしい対比（混同注意）</div>
              {effComparisons.slice(0, 2).map((c) => (
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

          {/* 正解語の別名（#4）：正式名称⇔略称の取り違え対策 */}
          {aliases.length > 0 && (
            <div className="alias-line">
              <span className="alias-label">別名</span>
              {aliases.map((a) => (
                onOpenKeyword
                  ? <button key={a} className="chip sm" onClick={() => onOpenKeyword(a)}>{a}</button>
                  : <span key={a} className="chip sm static">{a}</span>
              ))}
            </div>
          )}

          {/* なぜ？チェーン（#4/#7）：自己説明。誤答（△✕）時は自動で促す */}
          {(whyPrompt || (selfGrade && revealed && selected !== null && !correct)) && onSetMemo && (
            <div className="why-box">
              <div className="elaborate-head">🤔 なぜこの答え？（自分の言葉で一言）</div>
              <div className="goro-edit">
                <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="理由・つながりを一言" />
                <button className="btn primary sm" disabled={!why.trim()} onClick={() => { onSetMemo(question.id, (memo ? memo + ' / ' : '') + 'なぜ:' + why.trim()); setWhy(''); }}>記録</button>
              </div>
            </div>
          )}

          {/* 全選択肢の◯✕を一覧で確認（#14）：正解に○、他は✕。短い語はタップで学べる */}
          {selfGrade && question.type === 'choice' && (
            <div className="wrongchoice-box">
              <div className="elaborate-head">🔎 選択肢の正誤を確認（短い語はタップで学習）</div>
              <ul className="choice-review">
                {question.choices.map((ch, i) => {
                  const ok = i === question.answer;
                  const tappable = onOpenKeyword && !ok && ch.length <= 14;
                  return (
                    <li key={i} className={ok ? 'ok' : 'ng'}>
                      <span className="cr-mark">{ok ? '○' : '✕'}</span>
                      {tappable
                        ? <button className="cr-text link" onClick={() => onOpenKeyword(ch)}>{ch}</button>
                        : <span className="cr-text">{ch}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* 精緻化プロンプト（#2）：これと何がつながる？ タップで連結に追加 */}
          {(elaborate.length > 0 || addedKw.length > 0) && onSetLink && (
            <div className="elaborate-box">
              <div className="elaborate-head">🔗 これと何がつながる？（タップで連結に追加）</div>
              <div className="chip-row">
                {[...new Set([...addedKw, ...elaborate])].map((c) => {
                  const has = addedKw.includes(c) || (link?.keywords || []).includes(c);
                  return (
                    <button
                      key={c}
                      className={`chip ${has ? 'active' : ''}`}
                      onClick={() => {
                        if (has) return;
                        onSetLink(question.id, { keywords: [...(link?.keywords || []), c] });
                        setAddedKw((prev) => [...prev, c]);
                      }}
                    >
                      {has ? '✓ ' : '＋ '}{c}
                    </button>
                  );
                })}
              </div>
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
              <div className="grade-section">
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
              <div className="grade-section">
                {question.explanation && (
                  <div className="recheck-prompt">
                    📖 解説を読んでから選びましょう。読まずに進めると、次に同じ問題が出た時も同じ所で間違えます。
                  </div>
                )}
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
