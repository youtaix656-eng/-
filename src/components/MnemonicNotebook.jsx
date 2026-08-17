import { useMemo, useState } from 'react';
import { clustersMap } from '../lib/audioplan.js';

// 語呂合わせノート：連結学習・音声学習から登録した語呂合わせ（kwMeta）を一覧で見返し、
// その場で追加・編集・削除できる。
export default function MnemonicNotebook({ store, onToast }) {
  const { kwMeta, setKeywordMeta, questions, links } = store;
  const clusters = useMemo(() => clustersMap(questions, links), [questions, links]);

  const entries = useMemo(() => {
    return Object.entries(kwMeta || {})
      .filter(([, v]) => v && v.mnemonic && v.mnemonic.trim())
      .map(([keyword, v]) => ({
        keyword,
        mnemonic: v.mnemonic,
        count: (clusters.get(keyword) || []).length,
      }))
      .sort((a, b) => a.keyword.localeCompare(b.keyword, 'ja'));
  }, [kwMeta, clusters]);

  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const [newKw, setNewKw] = useState('');
  const [newMnemonic, setNewMnemonic] = useState('');

  const startEdit = (keyword, mnemonic) => {
    setEditing(keyword);
    setDraft(mnemonic);
  };
  const saveEdit = () => {
    if (!editing) return;
    setKeywordMeta(editing, { mnemonic: draft });
    onToast?.('語呂合わせを更新しました');
    setEditing(null);
  };
  const removeMnemonic = (keyword) => {
    setKeywordMeta(keyword, { mnemonic: '' });
    onToast?.('語呂合わせを削除しました');
  };
  const addNew = () => {
    const kw = newKw.trim();
    const mn = newMnemonic.trim();
    if (!kw || !mn) return;
    setKeywordMeta(kw, { mnemonic: mn });
    setNewKw('');
    setNewMnemonic('');
    onToast?.('語呂合わせを追加しました');
  };

  return (
    <div className="view">
      <h2 className="view-title">語呂合わせノート</h2>
      <p className="view-desc">
        登録した語呂合わせを一覧で見返せます。連結学習・音声学習の画面からも登録できます。
      </p>

      <div className="card">
        <div className="section-label" style={{ marginTop: 0 }}>＋ 新しく追加</div>
        <div className="field">
          <label>キーワード</label>
          <input
            type="text"
            value={newKw}
            onChange={(e) => setNewKw(e.target.value)}
            placeholder="例）合谷"
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>語呂合わせ</label>
          <textarea
            value={newMnemonic}
            onChange={(e) => setNewMnemonic(e.target.value)}
            placeholder="例）ゴウコクは面口（顔・口）のツボ"
          />
        </div>
        <button
          className="btn primary block"
          style={{ marginTop: 10 }}
          onClick={addNew}
          disabled={!newKw.trim() || !newMnemonic.trim()}
        >
          ＋ 追加
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="empty">
          <div className="ico">💡</div>
          <p>登録された語呂合わせはまだありません。</p>
          <p className="inline-note">上のフォームか、連結学習・音声学習の画面から登録できます。</p>
        </div>
      ) : (
        <>
          <div className="section-label">登録済み（{entries.length}件）</div>
          {entries.map((e) => (
            <div className="card" key={e.keyword}>
              <div className="stat-head">
                <span className="stat-subject">{e.keyword}</span>
                <span className="stat-pct">
                  <span className="stat-sub">{e.count}問に関連</span>
                </span>
              </div>
              {editing === e.keyword ? (
                <>
                  <textarea
                    value={draft}
                    onChange={(ev) => setDraft(ev.target.value)}
                    style={{ marginTop: 8 }}
                  />
                  <div className="btn-row" style={{ marginTop: 8 }}>
                    <button className="btn" onClick={() => setEditing(null)}>キャンセル</button>
                    <button className="btn primary" onClick={saveEdit}>保存</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="li-q" style={{ marginTop: 8 }}>{e.mnemonic}</p>
                  <div className="btn-row" style={{ marginTop: 8 }}>
                    <button className="btn sm" onClick={() => startEdit(e.keyword, e.mnemonic)}>編集</button>
                    <button className="btn sm ghost" onClick={() => removeMnemonic(e.keyword)}>削除</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
