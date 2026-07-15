import { useMemo, useState } from 'react';

// メモ・付箋の一覧画面
// 間違えた問題に残したメモをまとめて確認・編集できる。
export default function Memos({ store }) {
  const { questions, memos, setMemo } = store;
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState('');

  const items = useMemo(() => {
    const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
    return Object.keys(memos)
      .filter((id) => byId[id])
      .map((id) => ({ q: byId[id], memo: memos[id] }));
  }, [questions, memos]);

  const startEdit = (id, text) => {
    setEditId(id);
    setDraft(text);
  };
  const save = (id) => {
    setMemo(id, draft);
    setEditId(null);
  };

  if (items.length === 0) {
    return (
      <div className="view">
        <h2 className="view-title">メモ一覧</h2>
        <div className="empty">
          <div className="ico">📌</div>
          <p>まだメモはありません。</p>
          <p className="inline-note">
            問題を解いて解説を見たあと、「メモ・付箋を追加」から覚え方を書き残せます。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <h2 className="view-title">メモ一覧</h2>
      <p className="view-desc">{items.length}件のメモがあります。</p>

      {items.map(({ q, memo }) => (
        <div className="list-item" key={q.id}>
          <div className="li-subject">{q.subject}</div>
          <div className="li-q">{q.question}</div>
          <div className="inline-note" style={{ marginBottom: 6 }}>
            正解：
            {q.type === 'ox' ? q.choices[q.answer] : `${q.answer + 1}. ${q.choices[q.answer]}`}
          </div>

          {editId === q.id ? (
            <>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
              <div className="btn-row" style={{ marginTop: 8 }}>
                <button className="btn sm" onClick={() => setEditId(null)}>
                  キャンセル
                </button>
                <button
                  className="btn danger sm"
                  onClick={() => {
                    setMemo(q.id, '');
                    setEditId(null);
                  }}
                >
                  削除
                </button>
                <button className="btn primary sm" onClick={() => save(q.id)}>
                  保存
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="li-memo">📝 {memo}</div>
              <button
                className="btn ghost sm"
                style={{ marginTop: 8 }}
                onClick={() => startEdit(q.id, memo)}
              >
                編集
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
