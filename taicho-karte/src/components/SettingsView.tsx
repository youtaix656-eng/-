import { useRef, useState } from 'react';
import type { AppState } from '../types/index.js';
import { approximateSize } from '../lib/storage.js';
import { backupFilename, parseBackup, serializeBackup } from '../lib/backup.js';
import { todayKey } from '../lib/date.js';
import { DEFAULT_QUICK_CARE } from '../data/quickCare.js';

interface Props {
  state: AppState;
  onSetQuickItems: (items: string[]) => void;
  onImport: (state: AppState) => void;
  onWipe: () => void;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function SettingsView({ state, onSetQuickItems, onImport, onWipe }: Props) {
  const [newItem, setNewItem] = useState('');
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const items = state.settings.quickCareItems;

  const exportJson = () => {
    const text = serializeBackup(state);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFilename(todayKey());
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMsg('書き出しました（ファイルには体の記録が入っています。置き場所に気をつけてください）');
  };

  const importJson = async (file: File) => {
    const text = await file.text();
    const r = parseBackup(text);
    if (!r.ok) return setMsg(`取り込めませんでした：${r.reason}`);
    const n = r.state.symptoms.length + r.state.cares.length;
    if (!window.confirm(`このファイル（症状 ${r.state.symptoms.length} 件・対応策 ${r.state.cares.length} 件）で、今のデータをすべて置き換えます。よろしいですか？`)) return;
    onImport(r.state);
    setMsg(`取り込みました（${n} 件）`);
  };

  const addItem = () => {
    const v = newItem.trim();
    if (!v) return;
    if (items.includes(v)) return setMsg('同じ項目がすでにあります');
    onSetQuickItems([...items, v]);
    setNewItem('');
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onSetQuickItems(next);
  };

  return (
    <div>
      <h2 className="view-title">設定</h2>

      <div className="card">
        <h3>クイック選択のケア項目</h3>
        <p className="small">対応策の入力画面に並ぶボタンです。よく使う順に並べ替えられます。</p>
        <ul className="edit-list">
          {items.map((q, i) => (
            <li key={q}>
              <span>{q}</span>
              <span className="btn-row tight">
                <button type="button" className="btn small-btn" onClick={() => move(i, -1)} aria-label={`${q} を上へ`}>↑</button>
                <button type="button" className="btn small-btn" onClick={() => move(i, 1)} aria-label={`${q} を下へ`}>↓</button>
                <button type="button" className="btn small-btn danger" onClick={() => onSetQuickItems(items.filter((x) => x !== q))} aria-label={`${q} を削除`}>削除</button>
              </span>
            </li>
          ))}
        </ul>
        <div className="btn-row">
          <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="新しい項目" aria-label="新しいクイック項目" />
          <button type="button" className="btn" onClick={addItem}>追加</button>
        </div>
        <button type="button" className="btn small-btn" onClick={() => onSetQuickItems([...DEFAULT_QUICK_CARE])}>初期値に戻す</button>
      </div>

      <div className="card">
        <h3>データの書き出し・取り込み</h3>
        <p className="small">保存されているデータ量（目安）：{formatBytes(approximateSize(state))}。記録は端末の中にだけあり、どこにも送りません。機種変更のときは書き出して、新しい端末で取り込んでください。</p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={exportJson}>JSON で書き出す</button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>JSON を取り込む</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importJson(f); e.target.value = ''; }} />
        </div>
      </div>

      <div className="card">
        <h3>すべて消す</h3>
        <p className="small">症状・対応策・クイック項目の設定がすべて消えます。元に戻せません。</p>
        <button type="button" className="btn danger" onClick={() => { if (window.confirm('本当にすべての記録を消しますか？ 元に戻せません。')) { onWipe(); setMsg('すべて消しました'); } }}>すべて消す</button>
      </div>

      {msg && <p className="note" role="status">{msg}</p>}

      <div className="card flat">
        <h3>このアプリについて</h3>
        <p className="small">体調カルテは、自分の体の不調と、試した対応策とその効果を蓄積するための個人用の記録アプリです。診断・治療の判断をするものではありません。腰痛ナビ（施術者向けの知識ベース）とは役割が違い、こちらは主観的な自己記録に特化しています。</p>
      </div>
    </div>
  );
}
