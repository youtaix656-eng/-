import { useMemo, useState } from 'react';
import { generateFromNotes } from '../lib/notegen.js';
import { dedupeAgainst } from '../lib/importer.js';
import { buildTermDict, suggestKeywords } from '../lib/connectlab.js';

// 説明文・ノート（普通の文章）から穴埋め四択を自動生成し、
// 1問ずつプレビュー編集してから追加する。
// ※「自由文から自動作成(Parse)」は問題形式の文章を読み取る別機能。
export default function NoteGen({ store, onToast, onDone }) {
  const { questions, appendQuestions, userDict } = store;
  const [raw, setRaw] = useState('');
  const [max, setMax] = useState(15);
  const [choiceCount, setChoiceCount] = useState(4);
  const [gen, setGen] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [subject, setSubject] = useState('');
  const [round, setRound] = useState('');
  const [genre, setGenre] = useState('');
  const [deck, setDeck] = useState('');
  const [autoKw, setAutoKw] = useState(true);
  const dict = useMemo(() => buildTermDict(userDict), [userDict]);

  const doGenerate = () => {
    const { questions: qs, warnings: w } = generateFromNotes(raw, { max, choiceCount });
    setGen(qs);
    setWarnings(w);
    if (qs.length === 0) onToast('問題を生成できませんでした');
  };

  const update = (i, patch) =>
    setGen((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  const removeQ = (i) => setGen((prev) => prev.filter((_, idx) => idx !== i));
  const updateChoice = (i, ci, val) =>
    update(i, { choices: gen[i].choices.map((c, k) => (k === ci ? val : c)) });
  const addChoice = (i) => update(i, { choices: [...gen[i].choices, ''] });
  const removeChoice = (i, ci) => {
    const q = gen[i];
    const choices = q.choices.filter((_, k) => k !== ci);
    let answer = q.answer;
    if (ci === q.answer) answer = 0;
    else if (ci < q.answer) answer = q.answer - 1;
    update(i, { choices, answer });
  };

  const dup = useMemo(() => {
    if (!gen) return { unique: [], duplicates: [] };
    return dedupeAgainst(gen, questions);
  }, [gen, questions]);

  const finalize = (list) => {
    const tags = genre
      ? genre.split(/\s*[|｜,、]\s*/).map((t) => t.trim()).filter(Boolean)
      : [];
    return list.map((q) => {
      const { _generated, ...rest } = q;
      const out = { ...rest };
      if (!out.subject && subject) out.subject = subject;
      if (!out.subject) out.subject = 'その他';
      if (round) out.round = round;
      let finalTags = [...tags];
      if (autoKw) {
        const text = `${out.question || ''} ${(out.choices || []).join(' ')} ${out.explanation || ''}`;
        const auto = suggestKeywords(text, finalTags, dict).slice(0, 3);
        finalTags = Array.from(new Set([...finalTags, ...auto]));
      }
      if (finalTags.length) out.tags = finalTags;
      if (deck) out.deck = deck;
      return out;
    });
  };

  const addAll = (skipDup) => {
    const list = skipDup ? dup.unique : gen;
    if (!list || list.length === 0) return;
    appendQuestions(finalize(list));
    onToast(`${list.length}問を追加しました`);
    onDone?.();
  };

  return (
    <div className="view">
      <h2 className="view-title">文章から問題を作る</h2>
      <p className="view-desc">
        教科書のまとめ・自分のノート・解説文などを貼ると、重要語を空欄にした
        穴埋め四択を自動で作ります。選択肢のダミーは同じ文章内の似た語から選びます。
        追加する前に必ず内容を確認・修正してください。
      </p>

      {!gen ? (
        <div className="card">
          <label className="section-label" style={{ marginTop: 0 }}>説明文・ノートを貼り付け</label>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={'例）\n合谷は手の陽明大腸経の原穴で、第2中手骨の中点に取る。\n太衝は足の厥陰肝経の原穴である。\n肺は魄を蔵し、五行では金に属する。'}
            style={{ minHeight: 170 }}
          />
          <div className="parse-meta" style={{ marginTop: 10 }}>
            <label className="mini-field">
              <span>作る問題数（上限）</span>
              <input
                type="number" min="1" max="50" value={max}
                onChange={(e) => setMax(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              />
            </label>
            <label className="mini-field">
              <span>選択肢の数</span>
              <select value={choiceCount} onChange={(e) => setChoiceCount(Number(e.target.value))}>
                <option value={2}>2択</option>
                <option value={3}>3択</option>
                <option value={4}>4択</option>
                <option value={5}>5択</option>
              </select>
            </label>
          </div>
          <button className="btn primary block lg" style={{ marginTop: 10 }} onClick={doGenerate}>
            穴埋め問題を作る
          </button>
          <p className="inline-note" style={{ marginTop: 10 }}>
            用語（経穴名・カタカナ語・熟語・数値）が複数入った文章ほど、自然な選択肢を作れます。
          </p>
        </div>
      ) : (
        <>
          <div className="card">
            <label className="section-label" style={{ marginTop: 0 }}>この結果にまとめて付与（任意）</label>
            <div className="parse-meta">
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="科目" />
              <input value={round} onChange={(e) => setRound(e.target.value)} placeholder="回（第34回 等）" />
              <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="ジャンル（| 区切り）" />
              <input value={deck} onChange={(e) => setDeck(e.target.value)} placeholder="ファイル名" />
            </div>
            <label className="autokw-row">
              <input type="checkbox" checked={autoKw} onChange={(e) => setAutoKw(e.target.checked)} />
              <span>✨ キーワードを自動で拾って、目次・連結学習・マインドマップにつなげる</span>
            </label>
          </div>

          {warnings.map((w, i) => (
            <div className="finding warn" key={i} style={{ padding: '10px 12px', marginBottom: 8 }}>
              <div className="finding-msg">⚠️ {w}</div>
            </div>
          ))}

          <div className="builder-summary">
            生成 <strong>{gen.length}</strong> 問
            {dup.duplicates.length > 0 && <>（うち既存と重複 {dup.duplicates.length} 問）</>}
          </div>

          {gen.map((q, i) => {
            const isDup = dup.duplicates.includes(q);
            return (
              <div className="card parse-card" key={q.id}>
                <div className="parse-head">
                  <span className="parse-num">問 {i + 1}</span>
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
                  style={{ minHeight: 58, marginTop: 8 }}
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
                      {q.choices.length > 2 && (
                        <button className="parse-choice-x" onClick={() => removeChoice(i, ci)}>✕</button>
                      )}
                    </div>
                  ))}
                  <button className="btn ghost sm" onClick={() => addChoice(i)}>＋ 選択肢を追加</button>
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
            <button className="btn" onClick={() => setGen(null)}>やり直す</button>
            {dup.duplicates.length > 0 && (
              <button className="btn accent" onClick={() => addAll(true)}>
                重複を除いて{dup.unique.length}問追加
              </button>
            )}
            <button className="btn primary" onClick={() => addAll(false)}>
              {gen.length}問すべて追加
            </button>
          </div>
        </>
      )}
    </div>
  );
}
