import { useEffect, useState } from 'react';
import * as storage from '../lib/storage.js';
import { listSnapshots, takeSnapshot, restoreSnapshot, deleteSnapshot, MAX_SNAPSHOTS } from '../lib/backupSnapshots.js';

// 自動世代バックアップ（#3）の管理UI。端末内に最大8世代を保持し、ワンタップで巻き戻す。
function fmt(t) {
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function SnapshotsCard({ onToast }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = async () => { try { setList(await listSnapshots()); } catch (e) { setList([]); } };
  useEffect(() => { if (open) load(); }, [open]);

  const take = async () => {
    setBusy(true);
    try { await takeSnapshot(storage); await load(); onToast?.('現在の状態を1世代保存しました'); }
    catch (e) { onToast?.(`保存できませんでした（${(e && e.message) || '容量が足りない可能性があります'}）`); }
    finally { setBusy(false); }
  };
  const restore = async (id) => {
    if (!window.confirm('この世代に巻き戻します。今の進捗は「復元前」として1世代残してから上書きします。よろしいですか？')) return;
    setBusy(true);
    try { await restoreSnapshot(storage, id); await storage.flushNow(); onToast?.('復元しました。再読み込みします'); setTimeout(() => window.location.reload(), 900); }
    catch (e) { onToast?.(`復元できませんでした（${(e && e.message) || '不明なエラー'}）`); }
    finally { setBusy(false); }
  };
  const remove = async (id) => {
    if (!window.confirm('この世代を削除します。削除すると、この時点へは巻き戻せなくなります。よろしいですか？')) return;
    setBusy(true);
    try { await deleteSnapshot(id); await load(); onToast?.('世代を削除しました'); }
    catch (e) { onToast?.('削除できませんでした'); }
    finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <button className="btn ghost" style={{ width: '100%', textAlign: 'left' }} onClick={() => setOpen((v) => !v)}>
        {open ? '▼' : '▶'} 自動世代バックアップ（最大{MAX_SNAPSHOTS}世代・端末内）
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <p className="inline-note" style={{ marginBottom: 8 }}>
            学習の進捗・設定を世代ごとに端末内へ自動保存します（1日1回＋手動＋復元する直前）。問題データ本体は含めず軽量です。
            万一の破損時にワンタップで巻き戻せます。
          </p>
          {list.length === 0 ? (
            <p className="inline-note">まだ保存された世代はありません。</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {list.map((s) => (
                <li key={s.id} className="snap-row">
                  <span className="snap-when">
                    {fmt(s.at)} <span className="snap-tag">{s.reason === 'beforeRestore' ? '復元前' : s.auto ? '自動' : '手動'}</span>
                    <small>進捗{s.counts.srs}・履歴{s.counts.history}・模試{s.counts.examResults}</small>
                  </span>
                  <span className="snap-actions">
                    <button className="btn sm" onClick={() => restore(s.id)} disabled={busy}>復元</button>
                    <button className="btn ghost sm" onClick={() => remove(s.id)} disabled={busy}>削除</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={take} disabled={busy}>今すぐ1世代保存</button>
            <button className="btn ghost" onClick={load}>更新</button>
          </div>
        </div>
      )}
    </div>
  );
}
