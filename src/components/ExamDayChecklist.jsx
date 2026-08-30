import { useEffect, useMemo, useState } from 'react';
import { daysUntil, formatExamDate } from '../lib/gamify.js';
import {
  STAGES,
  loadChecked,
  setChecked as saveChecked,
  loadCustomItems,
  addCustomItem,
  removeCustomItem,
  buildChecklist,
} from '../lib/examDayChecklist.js';

// 試験当日チェックリスト・タイムライン（⑧）。
// 持ち物・当日の流れを「前日までに／当日の朝／会場に着いたら」の時系列でまとめて確認できる。
export default function ExamDayChecklist({ store, onNavigate }) {
  const { settings } = store;
  const examLeft = daysUntil(settings.examDate);

  const [checked, setCheckedState] = useState({});
  const [customItems, setCustomItems] = useState([]);
  const [draftStage, setDraftStage] = useState('before');
  const [draftText, setDraftText] = useState('');

  useEffect(() => {
    loadChecked().then(setCheckedState);
    loadCustomItems().then(setCustomItems);
  }, []);

  const checklist = useMemo(() => buildChecklist(customItems, checked), [customItems, checked]);

  const toggle = async (itemId, done) => {
    const next = await saveChecked(itemId, done);
    setCheckedState(next);
  };
  const addItem = async () => {
    if (!draftText.trim()) return;
    const next = await addCustomItem(draftStage, draftText);
    setCustomItems(next);
    setDraftText('');
  };
  const removeItem = async (itemId) => {
    const next = await removeCustomItem(itemId);
    setCustomItems(next);
  };

  return (
    <div className="view">
      <h2 className="view-title">試験当日チェックリスト</h2>
      <p className="view-desc">
        持ち物・当日の流れを時系列でまとめました。ここに挙げた項目は一般的な例です。正式な持ち物・
        注意事項は必ず<strong>受験票・公式の受験案内</strong>で最終確認してください。
      </p>

      {settings.examDate && (
        <div className="tiles">
          <div className="tile">
            <div className="num">{examLeft != null ? examLeft : '—'}</div>
            <div className="lbl">試験まであと（日）</div>
          </div>
          <div className="tile">
            <div className="num" style={{ fontSize: 15 }}>{formatExamDate(settings.examDate)}</div>
            <div className="lbl">試験日</div>
          </div>
          <div className="tile">
            <div className="num">{checklist.done}/{checklist.total}</div>
            <div className="lbl">チェック済み</div>
          </div>
        </div>
      )}

      {checklist.byStage.map((s) => (
        <div key={s.id}>
          <div className="section-label">{s.label}</div>
          <div className="card">
            {s.items.map((item) => (
              <label className="switch-row" key={item.id} style={{ alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(e) => toggle(item.id, e.target.checked)}
                />
                <span style={{ textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</span>
                {customItems.some((c) => c.id === item.id) && (
                  <button className="btn ghost sm" onClick={() => removeItem(item.id)} style={{ marginLeft: 'auto' }}>
                    削除
                  </button>
                )}
              </label>
            ))}
          </div>
        </div>
      ))}

      <div className="section-label">＋ 自分の項目を追加</div>
      <div className="card">
        <div className="field">
          <label>タイミング</label>
          <select value={draftStage} onChange={(e) => setDraftStage(e.target.value)}>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="btn-row" style={{ marginTop: 8 }}>
          <input
            type="text"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="例：常備薬を持った"
            style={{ flex: 1 }}
          />
          <button className="btn primary sm" onClick={addItem}>追加</button>
        </div>
      </div>

      <div className="ana-jump">
        <button className="btn ghost sm" onClick={() => onNavigate && onNavigate('venues')}>🏛️ 試験会場・ホテルへ</button>
        <button className="btn ghost sm" onClick={() => onNavigate && onNavigate('examcontent')}>📋 試験の内容メモへ</button>
      </div>
    </div>
  );
}
