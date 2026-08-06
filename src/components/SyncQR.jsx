import { useEffect, useMemo, useState } from 'react';
import { qrMatrix } from '../lib/qr.js';
import { buildSyncPayload, encodeSync, syncUrl, SYNC_TTL_MS } from '../lib/sync.js';

// QRのモジュール配列を SVG で描画
function QRImage({ matrix, size = 260, dim = false }) {
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
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ background: '#fff', borderRadius: 8, opacity: dim ? 0.18 : 1, transition: 'opacity .2s' }}
    >
      {rects}
    </svg>
  );
}

function fmtRemain(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  return `${m}:${ss}`;
}

// 進捗をQRで別端末へ受け渡し（サーバー不要・発行から5分間だけ有効）
export default function SyncQR({ store, onToast }) {
  const { srs, history, memos, links, examResults, settings } = store;
  const [open, setOpen] = useState(false);
  const [withHistory, setWithHistory] = useState(true);
  const [issuedAt, setIssuedAt] = useState(0); // 発行時刻（再発行で更新）
  const [now, setNow] = useState(Date.now());

  // 発行（＝いまの進捗でQR/URLを作り直し、5分の有効期限を張り直す）
  const issue = () => {
    setIssuedAt(Date.now());
    setNow(Date.now());
    setOpen(true);
  };

  // 有効期限のカウントダウン（1秒ごと）
  useEffect(() => {
    if (!open) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [open]);

  const remainMs = issuedAt ? SYNC_TTL_MS - (now - issuedAt) : 0;
  const expired = open && remainMs <= 0;

  const { matrix, url, tooBig, size } = useMemo(() => {
    if (!open || !issuedAt) return { matrix: null, url: '', tooBig: false, size: 0 };
    const data = { srs, history, memos, links, examResults, settings };
    const encoded = encodeSync(buildSyncPayload(data, { includeHistory: withHistory }));
    const u = syncUrl(encoded);
    const m = qrMatrix(u);
    return { matrix: m, url: u, tooBig: !m, size: u.length };
    // issuedAt を依存に含めることで「再発行」時に時刻を焼き直す
  }, [open, issuedAt, withHistory, srs, history, memos, links, examResults, settings]);

  const copyUrl = async () => {
    if (expired) {
      onToast?.('有効期限切れです。再発行してください');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      onToast?.('受け渡しURLをコピーしました（5分間だけ有効）');
    } catch (e) {
      onToast?.('コピーできませんでした');
    }
  };

  return (
    <div className="card">
      <p className="inline-note" style={{ marginBottom: 10 }}>
        いま端末にある学習の<strong>進捗・設定</strong>をQRコードにして、別の端末へ受け渡せます（サーバー不要）。
        別端末の<strong>カメラでこのQRを読み取る</strong>か、URLを開くと取り込めます。
        <br />
        🔒 <strong>安全のため、発行から5分を過ぎると使えなくなります</strong>（過ぎたら再発行してください）。
        <br />※ 問題データ本体や画像・音楽は含みません（容量のため）。多い場合はバックアップファイルをご利用ください。
      </p>
      {!open ? (
        <button className="btn primary" onClick={issue}>📱 QRコード／URLを発行（5分間有効）</button>
      ) : (
        <div>
          {tooBig ? (
            <div className="auth-error" style={{ marginBottom: 10 }}>
              データが大きくQRに収まりません（{size.toLocaleString()}文字）。
              {withHistory ? '下の「解答履歴を含めない」をオフにするか、' : ''}
              バックアップファイルでの移行をご利用ください。
            </div>
          ) : (
            <div style={{ textAlign: 'center', marginBottom: 10, position: 'relative' }}>
              <QRImage matrix={matrix} dim={expired} />
              {expired && (
                <div
                  style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 10,
                  }}
                >
                  <div style={{ fontWeight: 800, color: 'var(--wrong, #c62828)' }}>⏱ 有効期限切れ</div>
                  <button className="btn primary sm" onClick={issue}>🔄 再発行する</button>
                </div>
              )}
              <div className="inline-note" style={{ marginTop: 6 }}>
                {expired ? (
                  <>発行から5分を過ぎました。再発行してください。</>
                ) : (
                  <>
                    別端末のカメラで読み取ってください（{size.toLocaleString()}文字）
                    <br />
                    <strong style={{ color: remainMs < 60 * 1000 ? 'var(--wrong, #c62828)' : 'inherit' }}>
                      残り有効時間 {fmtRemain(remainMs)}
                    </strong>
                  </>
                )}
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
            {!tooBig && !expired && <button className="btn" onClick={copyUrl}>受け渡しURLをコピー</button>}
            <button className="btn" onClick={issue}>🔄 再発行</button>
            <button className="btn ghost" onClick={() => setOpen(false)}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}
