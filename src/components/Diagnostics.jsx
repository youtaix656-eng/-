import { useEffect, useState } from 'react';
import { estimateStorage, isPersisted, requestPersistent, formatBytes } from '../lib/storageHealth.js';
import { repairData } from '../lib/repair.js';
import * as storage from '../lib/storage.js';
import { isIdbSupported } from '../lib/db.js';

// セルフ診断（#20）＋容量監視（#1）＋整合性の自己修復（#2）を1画面に。
//   不具合の切り分け・データ保全のための裏方をユーザーが自分で確認・実行できる。
export default function Diagnostics({ store, onToast }) {
  const { questions, srs, history } = store;
  const [open, setOpen] = useState(false);
  const [est, setEst] = useState(null);
  const [persisted, setPersisted] = useState(false);
  const [sw, setSw] = useState('確認中…');
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setEst(await estimateStorage());
    setPersisted(await isPersisted());
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      setSw(reg ? '登録済み（オフライン対応）' : '未登録');
    } else setSw('非対応ブラウザ');
    setOnline(navigator.onLine);
  };
  useEffect(() => { if (open) refresh(); }, [open]);

  const doPersist = async () => {
    const ok = await requestPersistent();
    setPersisted(await isPersisted());
    onToast?.(ok ? '永続ストレージが有効になりました' : '永続化は許可されませんでした（後で再試行できます）');
  };

  const doRepair = async () => {
    setBusy(true);
    try {
      const r = await repairData(storage);
      if (r.skipped) onToast?.('問題データが読めないため修復を見送りました');
      else if (r.removed === 0) onToast?.('孤立データはありませんでした（正常）');
      else { onToast?.(`孤立データ ${r.removed} 件を掃除しました。再読み込みします`); setTimeout(() => window.location.reload(), 900); }
    } finally { setBusy(false); }
  };

  const Row = ({ label, value, ok }) => (
    <div className="diag-row">
      <span className="diag-label">{label}</span>
      <span className={ok === false ? 'diag-val bad' : ok === true ? 'diag-val good' : 'diag-val'}>{value}</span>
    </div>
  );

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <button className="btn ghost" style={{ width: '100%', textAlign: 'left' }} onClick={() => setOpen((v) => !v)}>
        {open ? '▼' : '▶'} セルフ診断・容量・データ保全
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <Row label="Service Worker（オフライン）" value={sw} ok={sw.startsWith('登録済み')} />
          <Row label="IndexedDB" value={isIdbSupported() ? '利用可' : '非対応（localStorage代替）'} ok={isIdbSupported()} />
          <Row label="通信状態" value={online ? 'オンライン' : 'オフライン'} />
          <Row
            label="ストレージ使用量"
            value={est ? `${formatBytes(est.usage)} / ${formatBytes(est.quota)}${est.percent != null ? `（${est.percent}%）` : ''}` : '取得不可'}
            ok={est && est.percent != null ? est.percent < 80 : undefined}
          />
          <Row label="永続ストレージ（消えにくさ）" value={persisted ? '有効' : '未設定'} ok={persisted} />
          <Row label="収録問題数" value={`${questions.length} 問`} />
          <Row label="学習記録" value={`SRS ${Object.keys(srs).length}件・履歴 ${history.length}件`} />

          <div className="btn-row" style={{ marginTop: 10 }}>
            {!persisted && <button className="btn" onClick={doPersist}>消えにくくする（永続化）</button>}
            <button className="btn" onClick={doRepair} disabled={busy}>整合性チェック＆修復</button>
            <button className="btn ghost" onClick={refresh}>更新</button>
          </div>
          <p className="inline-note" style={{ marginTop: 8 }}>
            「整合性チェック＆修復」は、削除済みの問題を指す学習記録（孤立データ）だけを安全に掃除します。
            通常の学習データは消えません。
          </p>
        </div>
      )}
    </div>
  );
}
