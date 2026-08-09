import { useEffect, useState } from 'react';
import { getErrorLog, clearErrorLog } from '../lib/errorLog.js';

// 端末内エラーログの閲覧・消去（外部送信なし）。不具合報告の材料に使う。
function fmt(t) {
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function ErrorLogCard({ onToast }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState([]);

  const load = async () => setList(await getErrorLog());
  useEffect(() => { if (open) load(); }, [open]);

  const copyAll = async () => {
    const text = list.map((e) => `[${fmt(e.t)}] ${e.kind}: ${e.message}${e.detail ? ' @ ' + e.detail : ''}`).join('\n');
    try { await navigator.clipboard.writeText(text || '(ログなし)'); onToast?.('エラーログをコピーしました'); }
    catch (e) { onToast?.('コピーできませんでした'); }
  };
  const clear = async () => { await clearErrorLog(); await load(); onToast?.('エラーログを消去しました'); };

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <button
        className="btn ghost"
        style={{ width: '100%', textAlign: 'left' }}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '▼' : '▶'} エラーログ（端末内・外部送信なし）
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <p className="inline-note" style={{ marginBottom: 8 }}>
            アプリ内で起きた不具合（未処理エラー）を最新50件だけ端末内に記録します。外部には一切送信しません。
            不具合を報告するときにコピーして貼り付けてください。
          </p>
          {list.length === 0 ? (
            <p className="inline-note">記録されたエラーはありません。</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.7 }}>
              {list.map((e, i) => (
                <li key={i}>
                  <strong>[{fmt(e.t)}] {e.kind}</strong>：{e.message}
                  {e.detail ? <span className="inline-note"> @ {e.detail}</span> : null}
                </li>
              ))}
            </ul>
          )}
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={copyAll} disabled={list.length === 0}>コピー</button>
            <button className="btn" onClick={clear} disabled={list.length === 0}>消去</button>
            <button className="btn ghost" onClick={load}>更新</button>
          </div>
        </div>
      )}
    </div>
  );
}
