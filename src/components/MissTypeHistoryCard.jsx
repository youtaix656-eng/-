import { useEffect, useState } from 'react';
import { loadMissTypes, clearAllMissTypes, totalMissTypeCount, MISS_TYPES } from '../lib/missTypes.js';

// 誤答理由（勘違い・知識不足・ケアレス）の記録は自動では間引かない仕様（#23）。
//   消したい時だけ、ここから手動で消す。
export default function MissTypeHistoryCard({ onToast }) {
  const [open, setOpen] = useState(false);
  const [missTypes, setMissTypes] = useState({});

  const load = async () => setMissTypes(await loadMissTypes());
  useEffect(() => { if (open) load(); }, [open]);

  const total = totalMissTypeCount(missTypes);
  const byType = {};
  for (const t of MISS_TYPES) byType[t.id] = 0;
  for (const entry of Object.values(missTypes || {})) {
    const list = Array.isArray(entry) ? entry : entry ? [entry] : [];
    for (const rec of list) if (byType[rec.type] != null) byType[rec.type] += 1;
  }

  const clearAll = async () => {
    if (!confirm(`誤答理由の記録（${total}件）をすべて消します。よろしいですか？`)) return;
    await clearAllMissTypes();
    await load();
    onToast?.('誤答理由の記録を消去しました');
  };

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <button
        className="btn ghost"
        style={{ width: '100%', textAlign: 'left' }}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '▼' : '▶'} 誤答理由の記録（端末内）
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <p className="inline-note" style={{ marginBottom: 8 }}>
            復習で選んだ「勘違い・知識不足・ケアレス」の記録は自動では消しません（間違いの傾向を長期で見るため）。
            消したい時はここから手動で消してください。
          </p>
          <p className="inline-note" style={{ marginBottom: 8 }}>
            合計{total}件（{MISS_TYPES.map((t) => `${t.label}${byType[t.id]}件`).join('・')}）
          </p>
          <div className="btn-row">
            <button className="btn danger" onClick={clearAll} disabled={total === 0}>すべて消す</button>
            <button className="btn ghost" onClick={load}>更新</button>
          </div>
        </div>
      )}
    </div>
  );
}
