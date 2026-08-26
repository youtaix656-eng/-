import { useEffect, useMemo, useState } from 'react';
import { exportAll, loadResumeState } from '../lib/storage.js';
import { buildSyncPayload, encodeSync } from '../lib/sync.js';
import { recommendMigrationMethod, MIGRATION_METHODS } from '../lib/migrationAdvice.js';
import { checkDeviceCapabilities } from '../lib/deviceCapabilities.js';
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
  const { srs, history, memos, links, examResults, settings, bookmarks, session, updateSettings, markBackedUp, importBackup } = store;
  const [sizes, setSizes] = useState({ syncPayloadBytes: null, fullBackupBytes: null });
  const hasShareApi = typeof navigator !== 'undefined' && !!navigator.share;
  const capabilities = useMemo(() => checkDeviceCapabilities(), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const resumeState = await loadResumeState();
      const data = { srs, history, memos, links, examResults, settings, bookmarks, session, ...resumeState };
      const payload = buildSyncPayload(data, { includeHistory: true });
      const encoded = await encodeSync(payload);
      const full = await exportAll();
      const fullBytes = new Blob([JSON.stringify(full)]).size;
      if (!alive) return;
      setSizes({ syncPayloadBytes: encoded.length, fullBackupBytes: fullBytes });
    })();
    return () => { alive = false; };
    // srs/history等の変化のたびに再計算（サイズが変わるため）
  }, [srs, history, memos, links, examResults, settings, bookmarks, session]);

  const recommendation = recommendMigrationMethod({ ...sizes, hasShareApi, capabilities });

  const CAP_ROWS = [
    { key: 'camera', label: 'カメラでQRを直接読み取り', used: '①QRコード・④WebRTC' },
    { key: 'shareApi', label: '共有ボタン（AirDrop・LINE等）', used: '②バックアップファイル' },
    { key: 'webrtc', label: 'WebRTCで端末同士を直接接続', used: '④WebRTCで直接転送' },
    { key: 'clipboard', label: 'コピー＆ペースト', used: '①・④の貼り付け方式' },
  ];

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

      <div className="section-label">📶 この端末の対応状況</div>
      <div className="card">
        <p className="inline-note" style={{ marginTop: 0, marginBottom: 8 }}>
          下の各方法を試す前に、この端末（ブラウザ）が対応しているかを確認できます。
          ✕の方法は、この端末では別の方法に自動で切り替わります。
        </p>
        {CAP_ROWS.map((r) => (
          <div className="stat-row" key={r.key}>
            <div className="stat-head">
              <span className="stat-subject">{capabilities[r.key] ? '✅' : '❌'} {r.label}</span>
              <span className="stat-sub">{r.used}</span>
            </div>
          </div>
        ))}
        <p className="inline-note" style={{ marginTop: 8 }}>
          ※「バックアップファイル」の保存・復元は、これらに対応していない端末でも常に使えます。
        </p>
      </div>

      {/* おすすめ以外は折りたたみ、迷わず本命の方法から試せるようにする（開閉はブラウザ標準のdetails/summaryで実装、
          押しやすさ・キーボード操作・スクリーンリーダーでの読み上げも標準機能でまかなえる）。 */}
      <details open={recommendation.id === 'qr' || recommendation.id === 'qr-multi'}>
        <summary className="section-label migration-summary">
          ① QRコードで受け渡し{recommendation.id === 'qr' || recommendation.id === 'qr-multi' ? '（おすすめ）' : ''}
        </summary>
        <p className="inline-note" style={{ marginTop: 0, marginBottom: 6 }}>
          進捗・設定だけを、その場でサッと渡す方法。データが大きい時は自動でQRを複数枚に分けて連続表示します。
        </p>
        <SyncQR store={store} onToast={onToast} />
        <SyncScan onToast={onToast} />
      </details>

      <details open={recommendation.id === 'share' || recommendation.id === 'file'}>
        <summary className="section-label migration-summary">
          ② バックアップファイル・共有{recommendation.id === 'share' || recommendation.id === 'file' ? '（おすすめ）' : ''}
        </summary>
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
      </details>

      <details open={!!settings.googleDriveAutoSync}>
        <summary className="section-label migration-summary">③ Googleドライブ連携（任意）</summary>
        <CloudBackup
          settings={settings}
          updateSettings={updateSettings}
          onToast={onToast}
          importBackup={importBackup}
          cloudSyncStatus={store.cloudSyncStatus}
          syncCloudNow={store.syncCloudNow}
        />
      </details>

      <details open={recommendation.id === 'webrtc'}>
        <summary className="section-label migration-summary">
          ④ WebRTCで直接転送{recommendation.id === 'webrtc' ? '（おすすめ）' : ''}
        </summary>
        <p className="inline-note" style={{ marginTop: 0, marginBottom: 6 }}>
          共有ボタンやQRが使いにくい環境でも、容量の制限なく端末同士を直接つないで転送できます。
        </p>
        <P2PTransfer store={store} onToast={onToast} />
      </details>
    </div>
  );
}
