import { useMemo, useState } from 'react';

// 体験談ノート（端末内のみ・非公開）
//   4つのカテゴリで体験談を記録できる：
//     自分の体験談 / 他人の体験談 / 合格体験談 / 不合格体験談
//   store.selfNotes = [{ id, category, title, body, at }]
//   （体調・生活メモなども「自分の体験談」として保存できる）

export const CATS = [
  { id: 'self', label: '自分の体験談', ico: '🙋' },
  { id: 'others', label: '他人の体験談', ico: '👥' },
  { id: 'pass', label: '合格体験談', ico: '🌸' },
  { id: 'fail', label: '不合格体験談', ico: '📕' },
];
const catOf = (id) => CATS.find((c) => c.id === id) || { id, label: id || 'その他', ico: '📝' };

function newId() {
  return `sn-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
}

export default function Experiences({ store, onToast }) {
  const { selfNotes, setSelfNotes } = store;
  const [tab, setTab] = useState('all'); // 'all' | カテゴリID
  const [editing, setEditing] = useState(null); // {id?, category, title, body}

  const counts = useMemo(() => {
    const m = {};
    for (const n of selfNotes) m[n.category] = (m[n.category] || 0) + 1;
    return m;
  }, [selfNotes]);

  const shown = useMemo(() => {
    const list = tab === 'all' ? selfNotes : selfNotes.filter((n) => n.category === tab);
    return [...list].sort((a, b) => (b.at || 0) - (a.at || 0));
  }, [selfNotes, tab]);

  const startNew = () =>
    setEditing({ id: null, category: tab === 'all' ? 'self' : tab, title: '', body: '' });
  const startEdit = (n) => setEditing({ ...n });

  const save = () => {
    if (!editing.title.trim() && !editing.body.trim()) {
      onToast('タイトルか本文を入力してください');
      return;
    }
    if (editing.id) {
      setSelfNotes(
        selfNotes.map((n) =>
          n.id === editing.id
            ? { ...n, category: editing.category, title: editing.title, body: editing.body }
            : n
        )
      );
    } else {
      setSelfNotes([
        ...selfNotes,
        {
          id: newId(),
          category: editing.category,
          title: editing.title,
          body: editing.body,
          at: Date.now(),
        },
      ]);
    }
    setEditing(null);
    onToast('体験談を保存しました');
  };
  const remove = (id) => {
    setSelfNotes(selfNotes.filter((n) => n.id !== id));
    setEditing(null);
    onToast('削除しました');
  };

  return (
    <div className="view">
      <h2 className="view-title">体験談ノート</h2>
      <p className="view-desc">
        自分・他人の体験談や、合格・不合格の体験を記録して振り返れます。
        体調や生活の気づきも「自分の体験談」として残せます。
      </p>

      <div className="notice-card">
        🔒 ここに書いた内容は<strong>この端末の中だけ</strong>に保存されます（公開されません）。
      </div>

      {/* カテゴリ切替 */}
      <div className="chip-row">
        <button className={`chip ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
          すべて（{selfNotes.length}）
        </button>
        {CATS.map((c) => (
          <button
            key={c.id}
            className={`chip ${tab === c.id ? 'active' : ''}`}
            onClick={() => setTab(c.id)}
          >
            {c.ico} {c.label}（{counts[c.id] || 0}）
          </button>
        ))}
      </div>

      <button className="btn primary block" onClick={startNew}>
        ＋ 体験談を追加
      </button>

      {shown.length === 0 ? (
        <p className="inline-note" style={{ marginTop: 12 }}>
          まだ体験談がありません。「＋ 体験談を追加」から記録しましょう。
        </p>
      ) : (
        shown.map((n) => {
          const c = catOf(n.category);
          return (
            <div className="card exp-card" key={n.id}>
              <div className="exp-head">
                <span className={`exp-cat cat-${n.category}`}>
                  {c.ico} {c.label}
                </span>
                <button className="btn ghost sm" onClick={() => startEdit(n)}>編集</button>
              </div>
              {n.title && <div className="exp-title">{n.title}</div>}
              {n.body && <div className="exp-body">{n.body}</div>}
            </div>
          );
        })
      )}

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{editing.id ? '体験談を編集' : '体験談を追加'}</h3>
            <label className="field">
              <span>種類</span>
              <div className="kind-picker">
                {CATS.map((c) => (
                  <button
                    key={c.id}
                    className={`kind-chip ${editing.category === c.id ? 'on' : ''}`}
                    onClick={() => setEditing({ ...editing, category: c.id })}
                  >
                    {c.ico} {c.label}
                  </button>
                ))}
              </div>
            </label>
            <label className="field">
              <span>タイトル</span>
              <input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="例）試験前日の過ごし方 / 先輩から聞いた勉強法 など"
                autoFocus
              />
            </label>
            <label className="field">
              <span>本文</span>
              <textarea
                value={editing.body}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                placeholder="体験した内容・気づき・学びなどを自由に記録"
                style={{ minHeight: 120 }}
              />
            </label>
            <div className="btn-row">
              {editing.id && (
                <button className="btn danger" onClick={() => remove(editing.id)}>削除</button>
              )}
              <button className="btn" onClick={() => setEditing(null)}>キャンセル</button>
              <button className="btn primary" onClick={save}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
