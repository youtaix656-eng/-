import { useEffect, useMemo, useState } from 'react';
import { qrMatrix } from '../lib/qr.js';
import { buildSyncPayload, encodeSync, syncUrl, SYNC_TTL_MS, HISTORY_SUMMARY_CUTOFF_MS } from '../lib/sync.js';
import { splitIntoChunks } from '../lib/chunk.js';

// 1枚のQRに載せるチャンクデータの目安文字数（URLのprefix・チャンクヘッダぶんの余裕を見た値）。
// QR誤り訂正レベルLの実用上限（約2,953バイト）に対して十分小さく、スキャンもしやすい。
const CHUNK_DATA_LEN = 900;

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

// 進捗をQRで別端末へ受け渡し（サーバー不要・発行から5分間だけ有効）。
//   ・圧縮＋効率的な符号化（transferCodec）でまず縮める。
//   ・それでも1枚のQRに収まらない場合は自動でチャンク分割し、複数のQRを
//     一定間隔で自動的に切り替え表示する「アニメーションQR」にする
//     （手動での送り／一時停止も可能）。相手はSyncScanでカメラをかざし続けるだけでよい。
export default function SyncQR({ store, onToast }) {
  const { srs, history, memos, links, examResults, settings } = store;
  const [open, setOpen] = useState(false);
  const [withHistory, setWithHistory] = useState(true);
  const [summarizeHistory, setSummarizeHistory] = useState(false);
  const [issuedAt, setIssuedAt] = useState(0); // 発行時刻（再発行で更新）
  const [now, setNow] = useState(Date.now());
  const [building, setBuilding] = useState(false);
  const [chunks, setChunks] = useState(null); // string[] | null
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [intervalMs, setIntervalMs] = useState(1200);

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

  // 圧縮・符号化・（必要なら）チャンク分割は非同期なので useEffect で組み立てる
  useEffect(() => {
    if (!open || !issuedAt) { setChunks(null); return; }
    let alive = true;
    setBuilding(true);
    setFrameIdx(0);
    (async () => {
      const data = { srs, history, memos, links, examResults, settings };
      const payload = buildSyncPayload(data, { includeHistory: withHistory, summarizeHistory });
      const encoded = await encodeSync(payload);
      if (!alive) return;
      // 常にチャンク形式（1枚で収まる場合は of=1 の1枚だけ）にして、読み取り側の処理を1本化する。
      const { parts } = splitIntoChunks(encoded, CHUNK_DATA_LEN);
      setChunks(parts.map((p) => syncUrl(p)));
      setBuilding(false);
    })();
    return () => { alive = false; };
    // issuedAt を依存に含めることで「再発行」時に焼き直す
  }, [open, issuedAt, withHistory, summarizeHistory, srs, history, memos, links, examResults, settings]);

  const multi = chunks && chunks.length > 1;
  const currentUrl = chunks ? chunks[frameIdx] : '';
  const matrix = useMemo(() => (currentUrl ? qrMatrix(currentUrl) : null), [currentUrl]);
  const tooBig = chunks && !matrix; // チャンクしても1枚のQRにすら収まらない極端なケース（通常は起こらない）

  // アニメーション（自動送り）
  useEffect(() => {
    if (!multi || !playing || expired || building) return undefined;
    const iv = setInterval(() => {
      setFrameIdx((i) => (i + 1) % chunks.length);
    }, intervalMs);
    return () => clearInterval(iv);
  }, [multi, playing, expired, building, chunks, intervalMs]);

  const copyUrl = async () => {
    if (expired) {
      onToast?.('有効期限切れです。再発行してください');
      return;
    }
    if (multi) {
      onToast?.('複数QRに分割されているためコピーはできません。カメラでの読み取りをご利用ください');
      return;
    }
    try {
      await navigator.clipboard.writeText(currentUrl);
      onToast?.('受け渡しURLをコピーしました（5分間だけ有効）');
    } catch (e) {
      onToast?.('コピーできませんでした');
    }
  };

  return (
    <div className="card">
      <p className="inline-note" style={{ marginBottom: 10 }}>
        いま端末にある学習の<strong>進捗・設定</strong>をQRコードにして、別の端末へ受け渡せます（サーバー不要）。
        別端末の<strong>カメラでこのQRを読み取る</strong>か、URLを開くと取り込めます。データが大きい時は自動で
        圧縮し、それでも収まらなければ<strong>QRを複数枚に分けて自動で連続表示</strong>します（読み取り側はかざし続けるだけでOK）。
        <br />
        🔒 <strong>安全のため、発行から5分を過ぎると使えなくなります</strong>（過ぎたら再発行してください）。
        <br />※ 問題データ本体や画像・音楽は含みません（容量のため）。
      </p>
      {!open ? (
        <button className="btn primary" onClick={issue}>📱 QRコード／URLを発行（5分間有効）</button>
      ) : (
        <div>
          {building ? (
            <p className="inline-note">圧縮・準備中…</p>
          ) : tooBig ? (
            <div className="auth-error" style={{ marginBottom: 10 }}>
              データが大きすぎてQRでの受け渡しができませんでした。
              {withHistory ? '下の「解答履歴を含めない」をオフにするか、' : ''}
              「共有」ボタンやバックアップファイルでの移行をご利用ください。
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
                    {multi ? (
                      <>
                        <strong>{chunks.length}枚のQRに分割中</strong>（{frameIdx + 1}/{chunks.length}枚目）
                        <br />相手のカメラをかざし続けると自動で読み取ります
                      </>
                    ) : (
                      <>別端末のカメラで読み取ってください</>
                    )}
                    <br />
                    <strong style={{ color: remainMs < 60 * 1000 ? 'var(--wrong, #c62828)' : 'inherit' }}>
                      残り有効時間 {fmtRemain(remainMs)}
                    </strong>
                  </>
                )}
              </div>
              {multi && !expired && (
                <div style={{ marginTop: 8 }}>
                  <div className="progress"><span style={{ width: `${((frameIdx + 1) / chunks.length) * 100}%` }} /></div>
                  <div className="btn-row" style={{ marginTop: 8, justifyContent: 'center' }}>
                    <button className="btn ghost sm" onClick={() => setFrameIdx((i) => (i - 1 + chunks.length) % chunks.length)}>◀ 前へ</button>
                    <button className="btn ghost sm" onClick={() => setPlaying((v) => !v)}>{playing ? '⏸ 一時停止' : '▶ 自動送りを再開'}</button>
                    <button className="btn ghost sm" onClick={() => setFrameIdx((i) => (i + 1) % chunks.length)}>次へ ▶</button>
                  </div>
                  <div className="btn-row" style={{ marginTop: 4, justifyContent: 'center' }}>
                    {[800, 1200, 2000].map((ms) => (
                      <button key={ms} className={`chip ${intervalMs === ms ? 'active' : ''}`} onClick={() => setIntervalMs(ms)}>
                        {(ms / 1000).toFixed(1)}秒間隔
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <label className="switch-row" style={{ marginTop: 4 }}>
            <input type="checkbox" checked={withHistory} onChange={(e) => setWithHistory(e.target.checked)} />
            <span>
              解答履歴も含める
              <small>オフにすると容量が減り、QRの枚数を減らせます（弱点分析の履歴は移りません）。</small>
            </span>
          </label>
          {withHistory && (
            <label className="switch-row" style={{ marginTop: 4 }}>
              <input type="checkbox" checked={summarizeHistory} onChange={(e) => setSummarizeHistory(e.target.checked)} />
              <span>
                古い履歴を要約して軽量化する
                <small>
                  直近{Math.round(HISTORY_SUMMARY_CUTOFF_MS / (24 * 60 * 60 * 1000))}日分はそのまま、それより前は
                  「日付・科目・正誤ごとの件数」に要約してQRの枚数を減らします（要約後は問題ごとの詳細は失われます）。
                </small>
              </span>
            </label>
          )}
          <div className="btn-row" style={{ marginTop: 10 }}>
            {!multi && !tooBig && !expired && <button className="btn" onClick={copyUrl}>受け渡しURLをコピー</button>}
            <button className="btn" onClick={issue}>🔄 再発行</button>
            <button className="btn ghost" onClick={() => setOpen(false)}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}
