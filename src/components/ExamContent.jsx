import { useState } from 'react';

// 「鍼灸国家試験の内容」を貼り付けて管理するための枠。
// 見出し（セクション）ごとに本文を保存できる。中身は後から貼り付けて使う。
// store.examContent = [{ id, title, body }]

function newId() {
  return `ec-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
}

export default function ExamContent({ store, onToast }) {
  const { examContent, setExamContent } = store;
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState({ title: '', body: '' });

  const startEdit = (sec) => {
    setOpenId(sec.id);
    setDraft({ title: sec.title, body: sec.body });
  };
  const cancel = () => setOpenId(null);

  const save = () => {
    if (!draft.title.trim()) {
      onToast('見出しを入力してください');
      return;
    }
    setExamContent(examContent.map((s) => (s.id === openId ? { ...s, title: draft.title, body: draft.body } : s)));
    setOpenId(null);
    onToast('保存しました');
  };

  const addSection = () => {
    const s = { id: newId(), title: '新しい見出し', body: '' };
    setExamContent([...examContent, s]);
    startEdit(s);
  };

  const removeSection = (id) => {
    setExamContent(examContent.filter((s) => s.id !== id));
    if (openId === id) setOpenId(null);
    onToast('セクションを削除しました');
  };

  return (
    <div className="view">
      <h2 className="view-title">鍼灸国家試験の内容</h2>
      <p className="view-desc">
        試験の概要・出題基準・持ち物などを貼り付けておける枠です。見出しをタップして内容を編集できます。
      </p>

      <div className="notice-card">
        ⚠️ 受験資格・日程・出題基準などの正式な情報は、必ず
        <strong>（公財）東洋療法研修試験財団</strong>の公式発表で最新のものを確認してください。
        ここは自分用のメモ・貼り付け欄です。
      </div>

      {examContent.map((sec) => (
        <div className="card content-sec" key={sec.id}>
          {openId === sec.id ? (
            <>
              <label className="field">
                <span>見出し</span>
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </label>
              <label className="field">
                <span>内容（ここに貼り付け）</span>
                <textarea
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  placeholder="ここに試験の内容を貼り付けてください。"
                  style={{ minHeight: 160 }}
                />
              </label>
              <div className="btn-row">
                <button className="btn danger" onClick={() => removeSection(sec.id)}>削除</button>
                <button className="btn" onClick={cancel}>キャンセル</button>
                <button className="btn primary" onClick={save}>保存</button>
              </div>
            </>
          ) : (
            <>
              <div className="content-head">
                <div className="content-title">{sec.title}</div>
                <button className="btn ghost sm" onClick={() => startEdit(sec)}>編集</button>
              </div>
              {sec.body.trim() ? (
                <div className="content-body">{sec.body}</div>
              ) : (
                <div className="content-empty">（未入力）あとで内容を貼り付けてください。</div>
              )}
            </>
          )}
        </div>
      ))}

      <button className="btn ghost block" style={{ marginTop: 4 }} onClick={addSection}>
        ＋ 見出しを追加
      </button>
    </div>
  );
}
