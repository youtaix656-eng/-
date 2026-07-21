import { useMemo, useState } from 'react';
import { parseFreeText } from '../lib/freetext.js';
import { dedupeAgainst } from '../lib/importer.js';

// 自由文（本のOCR・PDF抽出・ネットからコピーした文章）を自動で問題化し、
// 1問ずつプレビュー編集してから追加する。
export default function Parse({ store, onToast, onDone }) {
  const { questions, appendQuestions } = store;
  const [raw, setRaw] = useState('');
  const [parsed, setParsed] = useState(null); // 編集可能な問題配列
  const [warnings, setWarnings] = useState([]);
  // 一括メタ（空欄の項目に付与）
  const [subject, setSubject] = useState('');
  const [round, setRound] = useState('');
  const [genre, setGenre] = useState('');
  const [deck, setDeck] = useState('');

  const doParse = () => {
    const { questions: qs, warnings: w } = parseFreeText(raw);
    setParsed(qs);
    setWarnings(w);
    if (qs.length === 0) onToast('問題を検出できませんでした');
  };

  const update = (i, patch) =>
    setParsed((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  const removeQ = (i) => setParsed((prev) => prev.filter((_, idx) => idx !== i));
  const updateChoice = (i, ci, val) =>
    update(i, { choices: parsed[i].choices.map((c, k) => (k === ci ? val : c)) });
  const addChoice = (i) => update(i, { choices: [...parsed[i].choices, ''] });
  const removeChoice = (i, ci) => {
    const q = parsed[i];
    const choices = q.choices.filter((_, k) => k !== ci);
    let answer = q.answer;
    if (ci === q.answer) answer = 0;
    else if (ci < q.answer) answer = q.answer - 1;
    update(i, { choices, answer });
  };

  // 既存との重複を計算
  const dup = useMemo(() => {
    if (!parsed) return { unique: [], duplicates: [] };
    return dedupeAgainst(parsed, questions);
  }, [parsed, questions]);

  const finalize = (list) => {
    const tags = genre
      ? genre.split(/\s*[|｜,、]\s*/).map((t) => t.trim()).filter(Boolean)
      : [];
    return list.map((q) => {
      const { _needsAnswer, _fewChoices, ...rest } = q;
      const out = { ...rest };
      if (!out.subject && subject) out.subject = subject;
      if (!out.subject) out.subject = 'その他';
      if (round) out.round = round;
      if (tags.length) out.tags = tags;
      if (deck) out.deck = deck;
      return out;
    });
  };

  const addAll = (skipDup) => {
    const list = skipDup ? dup.unique : parsed;
    if (!list || list.length === 0) return;
    appendQuestions(finalize(list));
    onToast(`${list.length}問を追加しました`);
    onDone?.();
  };

  return (
    <div className="view">
      <h2 className="view-title">自由文から自動作成</h2>
      <p className="view-desc">
        問題集の文章やネットからコピーした文を貼ると、選択肢・正解を自動で読み取ります。
        取り込む前に内容を確認・修正できます。
      </p>

      {!parsed ? (
        <div className="card">
          <label className="section-label" style={{ marginTop: 0 }}>文章を貼り付け</label>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={'例）\n問1 合谷が属する経絡はどれか。\n1. 手の陽明大腸経\n2. 手の太陰肺経\n3. 手の少陰心経\n4. 手の厥陰心包経\n正解 1\n解説 …'}
            style={{ minHeight: 180 }}
          />
          <button className="btn primary block lg" style={{ marginTop: 10 }} onClick={doParse}>
            自動解析する
          </button>
          <p className="inline-note" style={{ marginTop: 10 }}>
            対応書式：問1 / Q1 / 第1問、選択肢は 1. ・① ・ア. ・「1 火」など、正解は「正解 3」「答え：③」。
          </p>
        </div>
      ) : (
        <>
          <div className="card">
            <label className="section-label" style={{ marginTop: 0 }}>この解析結果にまとめて付与（任意）</label>
            <div className="parse-meta">
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="科目" />
              <input value={round} onChange={(e) => setRound(e.target.value)} placeholder="回（第34回 等）" />
              <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="ジャンル（| 区切り）" />
              <input value={deck} onChange={(e) => setDeck(e.target.value)} placeholder="ファイル名" />
            </div>
          </div>

          {warnings.map((w, i) => (
            <div className="finding warn" key={i} style={{ padding: '10px 12px', marginBottom: 8 }}>
              <div className="finding-msg">⚠️ {w}</div>
            </div>
          ))}

          <div className="builder-summary">
            検出 <strong>{parsed.length}</strong> 問
            {dup.duplicates.length > 0 && <>（うち既存と重複 {dup.duplicates.length} 問）</>}
          </div>

          {parsed.map((q, i) => {
            const isDup = dup.duplicates.includes(q);
            return (
              <div className={`card parse-card ${q._needsAnswer ? 'need' : ''}`} key={q.id}>
                <div className="parse-head">
                  <span className="parse-num">問 {i + 1}</span>
                  {q._needsAnswer && <span className="parse-flag">正解を選択</span>}
                  {isDup && <span className="parse-dup">既存と重複</span>}
                  <button className="parse-del" onClick={() => removeQ(i)} aria-label="削除">✕</button>
                </div>
                <input
                  className="parse-subject"
                  value={q.subject}
                  onChange={(e) => update(i, { subject: e.target.value })}
                  placeholder={subject ? `科目（未入力なら「${subject}」）` : '科目'}
                />
                <textarea
                  value={q.question}
                  onChange={(e) => update(i, { question: e.target.value })}
                  placeholder="問題文"
                  style={{ minHeight: 54, marginTop: 8 }}
                />
                <div className="parse-choices">
                  {q.choices.map((c, ci) => (
                    <div className="parse-choice" key={ci}>
                      <input
                        type="radio"
                        name={`ans-${q.id}`}
                        checked={q.answer === ci}
                        onChange={() => update(i, { answer: ci })}
                        aria-label="正解にする"
                      />
                      <input
                        className="parse-choice-text"
                        value={c}
                        onChange={(e) => updateChoice(i, ci, e.target.value)}
                        placeholder={`選択肢${ci + 1}`}
                      />
                      {q.type !== 'ox' && q.choices.length > 2 && (
                        <button className="parse-choice-x" onClick={() => removeChoice(i, ci)}>✕</button>
                      )}
                    </div>
                  ))}
                  {q.type !== 'ox' && (
                    <button className="btn ghost sm" onClick={() => addChoice(i)}>＋ 選択肢を追加</button>
                  )}
                </div>
                <textarea
                  value={q.explanation}
                  onChange={(e) => update(i, { explanation: e.target.value })}
                  placeholder="解説（任意）"
                  style={{ minHeight: 44, marginTop: 8 }}
                />
              </div>
            );
          })}

          <div className="btn-row" style={{ marginTop: 4 }}>
            <button className="btn" onClick={() => setParsed(null)}>やり直す</button>
            {dup.duplicates.length > 0 && (
              <button className="btn accent" onClick={() => addAll(true)}>
                重複を除いて{dup.unique.length}問追加
              </button>
            )}
            <button className="btn primary" onClick={() => addAll(false)}>
              {parsed.length}問すべて追加
            </button>
          </div>
        </>
      )}
    </div>
  );
}
