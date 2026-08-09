import { useEffect, useState } from 'react';
import { RELATION_TYPES } from '../lib/relations.js';
import { loadUserRelations, addUserRelation, removeUserRelation } from '../lib/userRelations.js';

// 関係オーサリング（#29）— 概念どうしを型付きで自分で結ぶ。保存すると知識グラフに反映。
export default function RelationAuthor({ concepts = [], onChanged }) {
  const [list, setList] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState('contrast');

  useEffect(() => { loadUserRelations().then(setList); }, []);

  const add = async () => {
    if (!from.trim() || !to.trim() || from === to) return;
    const next = await addUserRelation({ from: from.trim(), to: to.trim(), type });
    if (next) { setList(next); setFrom(''); setTo(''); onChanged?.(); }
  };
  const del = async (i) => { const next = await removeUserRelation(i); setList(next); onChanged?.(); };

  return (
    <>
      <div className="section-label">✍️ 自分でつなぐ（関係を追加）</div>
      <div className="card">
        <div className="author-form">
          <input list="kg-concepts" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="概念A" />
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(RELATION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input list="kg-concepts" value={to} onChange={(e) => setTo(e.target.value)} placeholder="概念B" />
          <button className="btn primary sm" onClick={add} disabled={!from.trim() || !to.trim()}>追加</button>
        </div>
        <datalist id="kg-concepts">
          {concepts.map((c) => <option key={c} value={c} />)}
        </datalist>
        {list.length > 0 && (
          <ul className="kg-edge-list" style={{ marginTop: 10 }}>
            {list.map((r, i) => (
              <li key={i}>
                <span className="kg-tag">{r.from}</span>
                <span className="kg-rel">→({RELATION_TYPES[r.type] || r.type})</span>
                <span className="kg-tag">{r.to}</span>
                <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => del(i)}>削除</button>
              </li>
            ))}
          </ul>
        )}
        <p className="inline-note" style={{ marginTop: 8 }}>自作の関係は知識グラフに“強いつながり”として反映されます。</p>
      </div>
    </>
  );
}
