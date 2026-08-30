import { useEffect, useMemo, useState } from 'react';
import { dateKey } from '../lib/connect.js';
import { pickExplainQuestion, loadExplainNotes, saveExplainNote } from '../lib/explainNotes.js';

// 「人に説明するつもりで書く」ノート（ファインマン式）。
//   マスター済みの問題から日替わりで1問を出し、自分の言葉で説明を書いて蓄積する。
//   誤答時に促す自己説明（QuestionCard.jsxのwhyPrompt）とは対象が違う：
//   あちらは「間違えた直後」、こちらは「もう定着したはずの問題を人に教えられるか」の確認。
export default function ExplainNotes({ store, onNavigate }) {
  const { questions, srs } = store;
  const today = dateKey();
  const q = useMemo(() => pickExplainQuestion(questions, srs, today), [questions, srs, today]);

  const [notes, setNotes] = useState([]);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadExplainNotes().then(setNotes); }, []);

  const todaysNoteForQ = q && notes.find((n) => n.questionId === q.id && n.at >= Date.now() - 24 * 60 * 60 * 1000);

  const save = async () => {
    if (!q || !draft.trim()) return;
    const next = await saveExplainNote(q.id, draft);
    setNotes(next);
    setDraft('');
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  if (!q) {
    return (
      <div className="view">
        <h2 className="view-title">説明ノート</h2>
        <div className="empty">
          <div className="ico">🗣️</div>
          <p>マスター済みの問題がまだありません。</p>
          <p className="inline-note">○を5回連続で正解すると「マスター」になり、ここに出題対象として並びます。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <h2 className="view-title">説明ノート</h2>
      <p className="view-desc">
        マスター済みの問題から今日の1問を出します。答えを言えることと、人に説明できることは別物。
        自分の言葉で書いてみて、あいまいなところに気づくのが目的です。
      </p>

      <div className="section-label">🗣️ 今日の1問</div>
      <div className="card">
        <div className="q-meta">
          <span className={`badge ${q.type === 'ox' ? 'ox' : 'choice'}`}>{q.type === 'ox' ? '○×' : '四択'}</span>
          <span className="q-subject">{q.subject}</span>
        </div>
        <p style={{ fontSize: 16, fontWeight: 600, margin: '8px 0' }}>{q.question}</p>
        {todaysNoteForQ ? (
          <p className="inline-note">今日はすでに書きました。書き直す場合は下の欄に上書きで保存できます。</p>
        ) : null}
        <textarea
          className="explain-textarea"
          rows={4}
          placeholder="例：この問題は〜という理由で〜になる。まぎらわしい選択肢は〜だが、それは〜だから違う。"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box' }}
        />
        <div className="btn-row" style={{ marginTop: 8 }}>
          <button className="btn primary sm" onClick={save} disabled={!draft.trim()}>保存</button>
          {saved && <span className="inline-note">保存しました</span>}
        </div>
      </div>

      {notes.length > 0 && (
        <>
          <div className="section-label">📚 これまでの説明ノート（{notes.length}件）</div>
          {notes.slice(0, 20).map((n) => {
            const nq = questions.find((x) => x.id === n.questionId);
            return (
              <div className="card" key={n.id} style={{ marginBottom: 8 }}>
                <div className="inline-note">{new Date(n.at).toLocaleDateString('ja-JP')}{nq ? `・${nq.subject}` : ''}</div>
                {nq && <p style={{ margin: '4px 0', fontWeight: 600 }}>{nq.question}</p>}
                <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{n.text}</p>
              </div>
            );
          })}
        </>
      )}

      <div className="ana-jump">
        <button className="btn ghost sm" onClick={() => onNavigate && onNavigate('home')}>🏠 ホームへ戻る</button>
      </div>
    </div>
  );
}
