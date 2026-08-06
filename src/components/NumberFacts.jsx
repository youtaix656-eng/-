import { useMemo, useState } from 'react';
import { effectiveNumberFacts } from '../data/mindmapData.js';

// 数値の棚卸し・一括更新（#5）
// 毎年・数年ごとに変わる数値（国民医療費・平均寿命・出生率など）を、
// 全科目まとめてこの1画面で機械的に更新できる。上書きは端末内に保存され、
// マインドマップ等の数値表示にも反映される。
export default function NumberFacts({ store, onToast }) {
  const { numberOverrides, setNumberOverride, clearNumberOverride, clearAllNumberOverrides } = store;
  const [onlyVolatile, setOnlyVolatile] = useState(true);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null); // 編集中の id
  const [draft, setDraft] = useState({ value: '', asOf: '', note: '' });

  const all = useMemo(() => effectiveNumberFacts(numberOverrides), [numberOverrides]);

  const filtered = useMemo(() => {
    const kw = q.trim();
    return all.filter((n) => {
      if (onlyVolatile && !n.volatile) return false;
      if (!kw) return true;
      const hay = `${n.topic} ${n.value} ${n.subject} ${(n.terms || []).join(' ')} ${n.note || ''}`;
      return hay.includes(kw);
    });
  }, [all, onlyVolatile, q]);

  // 科目ごとにまとめる
  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach((n) => {
      const key = n.subject || 'その他';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(n);
    });
    return [...map.entries()];
  }, [filtered]);

  const volatileCount = all.filter((n) => n.volatile).length;
  const updatedCount = Object.keys(numberOverrides || {}).length;

  const startEdit = (n) => {
    setEditing(n.id);
    setDraft({ value: n.value || '', asOf: n.asOf || '', note: n.note || '' });
  };
  const cancelEdit = () => {
    setEditing(null);
    setDraft({ value: '', asOf: '', note: '' });
  };
  const saveEdit = (n) => {
    setNumberOverride(n.id, { value: draft.value, asOf: draft.asOf, note: draft.note });
    cancelEdit();
    onToast?.(`「${n.topic}」を更新しました`);
  };
  const resetItem = (n) => {
    clearNumberOverride(n.id);
    onToast?.(`「${n.topic}」を初期値に戻しました`);
  };

  const nowYear = new Date().getFullYear();

  return (
    <div className="view">
      <h2 className="view-title">数値の棚卸し・一括更新</h2>
      <p className="view-desc">
        毎年・数年ごとに変わる数値（国民医療費・平均寿命・出生率・高齢化率など）を、
        <strong>全科目まとめてこの1画面で更新</strong>できます。年1回の見直しにどうぞ。
        更新した値はこの端末に保存され、マインドマップの数値表示にも反映されます。
      </p>

      <div className="tiles">
        <div className="tile">
          <div className="num">{volatileCount}</div>
          <div className="lbl">要更新の数値</div>
        </div>
        <div className="tile">
          <div className="num" style={{ color: updatedCount > 0 ? 'var(--correct)' : 'var(--navy)' }}>{updatedCount}</div>
          <div className="lbl">更新済み</div>
        </div>
        <div className="tile">
          <div className="num">{all.length}</div>
          <div className="lbl">数値ファクト総数</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <input
          className="input"
          type="search"
          placeholder="キーワードで探す（例：国民医療費・平均寿命）"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="switch-row" style={{ marginTop: 10 }}>
          <input type="checkbox" checked={onlyVolatile} onChange={(e) => setOnlyVolatile(e.target.checked)} />
          <span>
            毎年変わる数値だけ表示
            <small>オフにすると、固定的な数値（経穴数・椎骨数など）も一覧に含めます。</small>
          </span>
        </label>
        {updatedCount > 0 && (
          <button
            className="btn ghost sm block"
            style={{ marginTop: 10 }}
            onClick={() => {
              if (window.confirm('すべての上書きを初期値に戻します。よろしいですか？')) {
                clearAllNumberOverrides();
                onToast?.('すべて初期値に戻しました');
              }
            }}
          >
            すべての上書きを初期値に戻す
          </button>
        )}
        <p className="inline-note" style={{ marginTop: 8 }}>
          ※ 数値は公式統計（人口動態統計・国民医療費・簡易生命表 など）の最新値でご確認のうえ更新してください。
          最新年度が不明なものは「※要確認」を残しています（{nowYear}年時点）。
        </p>
      </div>

      {groups.length === 0 && (
        <div className="empty">
          <div className="ico">🔢</div>
          <p>該当する数値がありません。</p>
        </div>
      )}

      {groups.map(([subject, list]) => (
        <div key={subject}>
          <div className="section-label">{subject}（{list.length}）</div>
          {list.map((n) => (
            <div className={`nf-item${n.edited ? ' edited' : ''}`} key={n.id}>
              {editing === n.id ? (
                <div className="nf-edit">
                  <div className="nf-topic">{n.topic}</div>
                  <label className="nf-label">数値・答え</label>
                  <input
                    className="input"
                    value={draft.value}
                    onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
                    placeholder="例：約47兆円"
                  />
                  <label className="nf-label">年度・出典（いつ時点の値か）</label>
                  <input
                    className="input"
                    value={draft.asOf}
                    onChange={(e) => setDraft((d) => ({ ...d, asOf: e.target.value }))}
                    placeholder="例：令和4年度 / 人口動態統計"
                  />
                  <label className="nf-label">補足メモ</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={draft.note}
                    onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                  />
                  <div className="btn-row" style={{ marginTop: 8 }}>
                    <button className="btn primary sm" onClick={() => saveEdit(n)}>保存</button>
                    <button className="btn ghost sm" onClick={cancelEdit}>やめる</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="nf-head">
                    <span className="nf-topic">{n.topic}</span>
                    {n.volatile && <span className="nf-badge">要更新</span>}
                    {n.edited && <span className="nf-badge edited">更新済み</span>}
                  </div>
                  <div className="nf-value">{n.value}</div>
                  {n.asOf && <div className="nf-asof">📅 {n.asOf}</div>}
                  {n.note && <div className="nf-note">{n.note}</div>}
                  <div className="nf-actions">
                    <button className="btn sm" onClick={() => startEdit(n)}>✏️ 更新する</button>
                    {n.edited && (
                      <button className="btn ghost sm" onClick={() => resetItem(n)}>初期値に戻す</button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
