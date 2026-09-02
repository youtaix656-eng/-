import { useMemo, useState } from 'react';
import { SUBJECT_TAG_NAMES } from '../data/examScope.js';
import { buildMnemonicEntries } from '../lib/mnemonicEntries.js';

// 語呂合わせノート：連結学習・音声学習から登録した語呂合わせ（kwMeta）を一覧で見返し、
// その場で追加・編集・削除できる。
//   ふりがな：kwMetaのreading（手入力で確定した読みのみ表示。自動推定は誤読の恐れがあるため行わない）に、
//   lib/yomi.js の TERM_READINGS（既知の専門用語の読み）をフォールバックとして使う。
//   一覧の組み立ては lib/mnemonicEntries.js（MnemonicQuiz.jsxと共用）。
export default function MnemonicNotebook({ store, onToast, onNavigate, onOpenFlashcard }) {
  const { kwMeta, setKeywordMeta, questions, links } = store;

  const entries = useMemo(() => buildMnemonicEntries(kwMeta, questions, links), [kwMeta, questions, links]);

  // 科目選択（出題基準の1〜14の順）。「全科目」＋実際に問題が収録されている科目のみ。
  const [subjectFilter, setSubjectFilter] = useState('all');
  const subjectOptions = useMemo(() => {
    const present = new Set(questions.map((q) => q.subject).filter(Boolean));
    const ordered = SUBJECT_TAG_NAMES.filter((s) => present.has(s));
    const extra = [...present].filter((s) => !SUBJECT_TAG_NAMES.includes(s)).sort((a, b) => a.localeCompare(b, 'ja'));
    return [...ordered, ...extra];
  }, [questions]);
  const filteredEntries = useMemo(
    () => (subjectFilter === 'all' ? entries : entries.filter((e) => e.subjects.includes(subjectFilter))),
    [entries, subjectFilter]
  );

  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const [draftReading, setDraftReading] = useState('');
  const [newKw, setNewKw] = useState('');
  const [newMnemonic, setNewMnemonic] = useState('');
  const [newReading, setNewReading] = useState('');

  const startEdit = (keyword, mnemonic, reading) => {
    setEditing(keyword);
    setDraft(mnemonic);
    setDraftReading(reading || '');
  };
  const saveEdit = () => {
    if (!editing) return;
    setKeywordMeta(editing, { mnemonic: draft, reading: draftReading.trim() });
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
    setKeywordMeta(kw, { mnemonic: mn, reading: newReading.trim() });
    setNewKw('');
    setNewMnemonic('');
    setNewReading('');
    onToast?.('語呂合わせを追加しました');
  };

  return (
    <div className="view">
      <h2 className="view-title">語呂合わせノート</h2>
      <p className="view-desc">
        登録した語呂合わせを一覧で見返せます。連結学習・音声学習の画面からも登録できます。
      </p>

      {entries.length > 0 && (
        <button className="btn ghost block" onClick={() => onNavigate && onNavigate('mnemonicquiz')} style={{ marginBottom: 10 }}>
          🧠 想起テストで確認する
        </button>
      )}

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
        <div className="field">
          <label>読み（ふりがな・任意）</label>
          <input
            type="text"
            value={newReading}
            onChange={(e) => setNewReading(e.target.value)}
            placeholder="例）ごうこく"
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
          <div className="card">
            <label className="mini-field">
              <span>科目でしぼる</span>
              <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
                <option value="all">全科目</option>
                {subjectOptions.map((s, i) => (<option key={s} value={s}>{i + 1}. {s}</option>))}
              </select>
            </label>
          </div>

          <div className="section-label">
            登録済み（{filteredEntries.length}件{subjectFilter !== 'all' ? ` / 全${entries.length}件` : ''}）
          </div>
          {filteredEntries.length === 0 ? (
            <div className="empty">
              <div className="ico">🔍</div>
              <p>この科目に関連する語呂合わせはまだありません。</p>
            </div>
          ) : (
            filteredEntries.map((e) => (
              <div className="card" key={e.keyword}>
                <div className="stat-head">
                  <span className="stat-subject">
                    {e.reading && e.reading !== e.keyword ? (
                      <ruby>{e.keyword}<rt>{e.reading}</rt></ruby>
                    ) : (
                      e.keyword
                    )}
                  </span>
                  <span className="stat-pct">
                    <span className="stat-sub">{e.count}問に関連</span>
                  </span>
                </div>
                {editing === e.keyword ? (
                  <>
                    <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
                      <label>読み（ふりがな・任意）</label>
                      <input
                        type="text"
                        value={draftReading}
                        onChange={(ev) => setDraftReading(ev.target.value)}
                        placeholder="例）ごうこく"
                      />
                    </div>
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
                      <button className="btn sm" onClick={() => startEdit(e.keyword, e.mnemonic, e.reading)}>編集</button>
                      <button className="btn sm ghost" onClick={() => removeMnemonic(e.keyword)}>削除</button>
                      {e.count > 0 && onOpenFlashcard && (
                        <button className="btn sm ghost" onClick={() => onOpenFlashcard(e.keyword)}>🃏 カードで見る</button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
