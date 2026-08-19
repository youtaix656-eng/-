import { useEffect, useState } from 'react';
import { exportAll } from '../lib/storage.js';
import { buildSyncPayload, encodeSync } from '../lib/sync.js';
import { recommendMigrationMethod, MIGRATION_METHODS } from '../lib/migrationAdvice.js';
import FileBackupCard from './FileBackupCard.jsx';
import SyncQR from './SyncQR.jsx';
import SyncScan from './SyncScan.jsx';
import CloudBackup from './CloudBackup.jsx';
import P2PTransfer from './P2PTransfer.jsx';

function fmtBytes(n) {
  if (n == null) return '計算中…';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// 機種変更ガイド：今のデータ量から最適な移行方法を自動でおすすめし、
// 実際にその方法をこの画面から一気通貫で操作できる（各方法はSettings画面と同じ
// コンポーネントを再利用しているため、ロジックの二重管理にはならない）。
export default function MigrationGuide({ store, onToast }) {
  const { srs, history, memos, links, examResults, settings, updateSettings, markBackedUp, importBackup } = store;
  const [sizes, setSizes] = useState({ syncPayloadBytes: null, fullBackupBytes: null });
  const hasShareApi = typeof navigator !== 'undefined' && !!navigator.share;

  useEffect(() => {
    let alive = true;
    (async () => {
      const data = { srs, history, memos, links, examResults, settings };
      const payload = buildSyncPayload(data, { includeHistory: true });
      const encoded = await encodeSync(payload);
      const full = await exportAll();
      const fullBytes = new Blob([JSON.stringify(full)]).size;
      if (!alive) return;
      setSizes({ syncPayloadBytes: encoded.length, fullBackupBytes: fullBytes });
    })();
    return () => { alive = false; };
    // srs/history等の変化のたびに再計算（サイズが変わるため）
  }, [srs, history, memos, links, examResults, settings]);

  const recommendation = recommendMigrationMethod({ ...sizes, hasShareApi });

  return (
    <div className="view">
      <h2 className="view-title">🧭 機種変更ガイド</h2>
      <p className="inline-note" style={{ marginBottom: 12 }}>
        新しい端末に学習の進捗・設定（必要なら問題データも）を引き継ぐための、移行方法の一覧です。
        今のデータ量から、あなたに合った方法を自動でおすすめします。もちろん他の方法を選んでも構いません。
      </p>

      <div className="card" style={{ borderColor: 'var(--accent, #4a7dff)' }}>
        <div className="section-label" style={{ marginTop: 0 }}>🎯 おすすめの方法</div>
        <p style={{ fontWeight: 800, fontSize: '1.05em', marginBottom: 4 }}>{recommendation.title}</p>
        <p className="inline-note" style={{ marginTop: 0 }}>{recommendation.reason}</p>
        <p className="inline-note" style={{ marginTop: 8, opacity: 0.8 }}>
          目安：進捗・設定 {fmtBytes(sizes.syncPayloadBytes)}／問題データ込みの全体 {fmtBytes(sizes.fullBackupBytes)}
        </p>
      </div>

      <div className="section-label">① QRコードで受け渡し{recommendation.id === 'qr' || recommendation.id === 'qr-multi' ? '（おすすめ）' : ''}</div>
      <p className="inline-note" style={{ marginTop: 0, marginBottom: 6 }}>
        進捗・設定だけを、その場でサッと渡す方法。データが大きい時は自動でQRを複数枚に分けて連続表示します。
      </p>
      <SyncQR store={store} onToast={onToast} />
      <SyncScan onToast={onToast} />

      <div className="section-label">
        ② バックアップファイル・共有{recommendation.id === 'share' || recommendation.id === 'file' ? '（おすすめ）' : ''}
      </div>
      <p className="inline-note" style={{ marginTop: 0, marginBottom: 6 }}>
        問題データも含めた全体を1つのファイルにして持ち運ぶ方法。対応端末では共有ボタンでAirDrop・LINE・Google
        Driveなどへ直接渡せます。
      </p>
      <FileBackupCard
        settings={settings}
        updateSettings={updateSettings}
        markBackedUp={markBackedUp}
        importBackup={importBackup}
        onToast={onToast}
      />

      <div className="section-label">③ Googleドライブ連携（任意）</div>
      <CloudBackup
        settings={settings}
        updateSettings={updateSettings}
        onToast={onToast}
        importBackup={importBackup}
        cloudSyncStatus={store.cloudSyncStatus}
      />

      <div className="section-label">④ WebRTCで直接転送{recommendation.id === 'webrtc' ? '（おすすめ）' : ''}</div>
      <p className="inline-note" style={{ marginTop: 0, marginBottom: 6 }}>
        共有ボタンやQRが使いにくい環境でも、容量の制限なく端末同士を直接つないで転送できます。
      </p>
      <P2PTransfer store={store} onToast={onToast} />
    </div>
  );
}
