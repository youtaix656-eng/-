import { useEffect, useRef, useState } from 'react';
import { decodeSync, isSyncExpired, extractSyncCode as extractSync } from '../lib/sync.js';

// 受け渡しQRをカメラで読み取って取り込む（サーバー不要）。
//   ・端末が対応していれば BarcodeDetector（ブラウザ標準）でカメラから読み取り。
//   ・非対応端末（iPhoneのSafari等）は、URLを貼り付けて取り込む方式にフォールバック。
//   ・取り込みは既存の「#sync= を開いた時」と同じ経路（確認ダイアログ＋5分期限）に委譲する。
export default function SyncScan({ onToast }) {
  const [mode, setMode] = useState('idle'); // idle | camera | paste
  const [error, setError] = useState('');
  const [pasted, setPasted] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const activeRef = useRef(false);

  const hasDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  // カメラ停止・後片付け
  const stopCamera = () => {
    activeRef.current = false;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  // アンマウント時に必ずカメラを止める
  useEffect(() => () => stopCamera(), []);

  // 取り込みを実行（有効性を確認してから、既存のロード時ハンドラに委譲）
  const applyEncoded = (enc) => {
    let payload;
    try {
      payload = decodeSync(decodeURIComponent(enc));
    } catch (e) {
      onToast?.('このコードは受け渡しデータとして読み取れませんでした');
      return false;
    }
    if (isSyncExpired(payload)) {
      onToast?.('発行から5分以上経過しています（期限切れ）。元の端末で再発行してください');
      return false;
    }
    // 有効 → #sync= を付けて再読み込み。確認ダイアログと取り込みは共通処理が行う。
    stopCamera();
    window.location.hash = '#sync=' + enc;
    window.location.reload();
    return true;
  };

  // スキャン/貼り付けた文字列を処理
  const handleText = (text) => {
    const enc = extractSync(text);
    if (!enc) {
      onToast?.('これは受け渡し用のQR／URLではありません');
      return false;
    }
    return applyEncoded(enc);
  };

  // カメラ起動＋読み取りループ
  const startCamera = async () => {
    setError('');
    if (!hasDetector) {
      setMode('paste');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setMode('camera');
      // video 要素は camera モードで描画されるので次フレームで接続
      requestAnimationFrame(async () => {
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        v.setAttribute('playsinline', 'true');
        try { await v.play(); } catch (e) { /* 自動再生の制約は無視 */ }
        let detector;
        try {
          detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        } catch (e) {
          setError('この端末ではQRの読み取りに対応していません。URLの貼り付けをご利用ください。');
          stopCamera();
          setMode('paste');
          return;
        }
        activeRef.current = true;
        const tick = async () => {
          if (!activeRef.current || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes && codes.length) {
              const enc = extractSync(codes[0].rawValue);
              if (enc) { applyEncoded(enc); return; } // 成功時はここで再読み込み
              // 受け渡し用でないQRは無視して読み取りを続ける
            }
          } catch (e) { /* 一時的な検出エラーは無視して継続 */ }
          timerRef.current = setTimeout(tick, 250);
        };
        tick();
      });
    } catch (e) {
      setError('カメラを起動できませんでした。ブラウザのカメラ許可を確認するか、URLの貼り付けをご利用ください。');
      setMode('paste');
    }
  };

  const close = () => {
    stopCamera();
    setMode('idle');
    setError('');
  };

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <p className="inline-note" style={{ marginBottom: 10 }}>
        別の端末で発行した<strong>受け渡しQRコードをこの端末のカメラで読み取って</strong>、進捗・設定を取り込みます。
        <br />🔒 発行から5分以内のQRだけ取り込めます（取り込み前に確認します）。
      </p>

      {mode === 'idle' && (
        <div className="btn-row">
          <button className="btn primary" onClick={startCamera}>📷 QRコードを読み取る（カメラ）</button>
          <button className="btn" onClick={() => { setError(''); setMode('paste'); }}>🔗 URLを貼り付けて取り込む</button>
        </div>
      )}

      {error && <div className="auth-error" style={{ marginTop: 10 }}>{error}</div>}

      {mode === 'camera' && (
        <div style={{ marginTop: 10 }}>
          <div style={{ position: 'relative', textAlign: 'center' }}>
            <video
              ref={videoRef}
              muted
              playsInline
              style={{ width: '100%', maxWidth: 360, borderRadius: 12, background: '#000' }}
            />
            <div
              aria-hidden
              style={{
                position: 'absolute', top: '50%', left: '50%', width: 180, height: 180,
                transform: 'translate(-50%, -50%)', border: '3px solid rgba(255,255,255,0.9)',
                borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,0.25)', pointerEvents: 'none',
              }}
            />
          </div>
          <p className="inline-note" style={{ marginTop: 8 }}>
            相手の端末に表示されたQRコードを枠内に入れてください。自動で読み取ります。
          </p>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => { setError(''); stopCamera(); setMode('paste'); }}>URL貼り付けに切替</button>
            <button className="btn ghost" onClick={close}>閉じる</button>
          </div>
        </div>
      )}

      {mode === 'paste' && (
        <div style={{ marginTop: 10 }}>
          {!hasDetector && (
            <p className="inline-note" style={{ marginBottom: 8 }}>
              この端末はアプリ内カメラ読み取りに未対応です。端末の<strong>カメラアプリでQRを読み取り、開いたURL</strong>を下に貼り付けてください。
            </p>
          )}
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="受け渡しURL（…#sync=… を含む）を貼り付け"
            rows={3}
            style={{ width: '100%' }}
          />
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn primary" onClick={() => handleText(pasted)} disabled={!pasted.trim()}>取り込む</button>
            {hasDetector && <button className="btn" onClick={() => { setError(''); startCamera(); }}>📷 カメラに戻る</button>}
            <button className="btn ghost" onClick={close}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}
