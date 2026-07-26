import { useMemo, useState } from 'react';
import { qrMatrix } from '../lib/qr.js';
import { buildSyncPayload, encodeSync, syncUrl } from '../lib/sync.js';

// QRのモジュール配列を SVG で描画
function QRImage({ matrix, size = 260 }) {
  if (!matrix) return null;
  const n = matrix.length;
  const quiet = 2;
  const total = n + quiet * 2;
  const cell = size / total;
  const rects = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        rects.push(
          <rect key={`${r}-${c}`} x={(c + quiet) * cell} y={(r + quiet) * cell} width={cell} height={cell} fill="#000" />
        );
      }
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ background: '#fff', borderRadius: 8 }}>
      {rects}
    </svg>
  );
}

// 進捗をQRで別端末へ受け渡し（サーバー不要）
export default function SyncQR({ store, onToast }) {
  const { srs, history, memos, links, examResults, settings } = store;
  const [open, setOpen] = useState(false);
  const [withHistory, setWithHistory] = useState(true);

  const { matrix, url, tooBig, size } = useMemo(() => {
    if (!open) return { matrix: null, url: '', tooBig: false, size: 0 };
    const data = { srs, history, memos, links, examResults, settings };
    const encoded = encodeSync(buildSyncPayload(data, { includeHistory: withHistory }));
    const u = syncUrl(encoded);
    const m = qrMatrix(u);
    return { matrix: m, url: u, tooBig: !m, size: u.length };
  }, [open, withHistory, srs, history, memos, links, examResults, settings]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      onToast?.('受け渡しURLをコピーしました');
    } catch (e) {
      onToast?.('コピーできませんでした');
    }
  };

  return (
    <div className="card">
      <p className="inline-note" style={{ marginBottom: 10 }}>
        いま端末にある学習の<strong>進捗・設定</strong>をQRコードにして、別の端末へ受け渡せます（サーバー不要）。
        別端末の<strong>カメラでこのQRを読み取る</strong>と、アプリが開いて取り込めます。
        <br />※ 問題データ本体や画像・音楽は含みません（容量のため）。多い場合はバックアップファイルをご利用ください。
      </p>
      {!open ? (
        <button className="btn primary" onClick={() => setOpen(true)}>📱 QRコードを表示</button>
      ) : (
        <div>
          {tooBig ? (
            <div className="auth-error" style={{ marginBottom: 10 }}>
              データが大きくQRに収まりません（{size.toLocaleString()}文字）。
              {withHistory
                ? '下の「解答履歴を含めない」をオフにするか、'
                : ''}
              バックアップファイルでの移行をご利用ください。
            </div>
          ) : (
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <QRImage matrix={matrix} />
              <div className="inline-note" style={{ marginTop: 6 }}>
                別端末のカメラで読み取ってください（{size.toLocaleString()}文字）
              </div>
            </div>
          )}
          <label className="switch-row" style={{ marginTop: 4 }}>
            <input type="checkbox" checked={withHistory} onChange={(e) => setWithHistory(e.target.checked)} />
            <span>
              解答履歴も含める
              <small>オフにすると容量が減り、QRに収まりやすくなります（弱点分析の履歴は移りません）。</small>
            </span>
          </label>
          <div className="btn-row" style={{ marginTop: 10 }}>
            {!tooBig && <button className="btn" onClick={copyUrl}>受け渡しURLをコピー</button>}
            <button className="btn ghost" onClick={() => setOpen(false)}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}
