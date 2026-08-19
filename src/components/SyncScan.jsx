import { useEffect, useRef, useState } from 'react';
import { decodeSync, isSyncExpired, extractSyncCode as extractSync } from '../lib/sync.js';
import { Reassembler } from '../lib/chunk.js';
import * as storage from '../lib/storage.js';
import { syncToBackup } from '../lib/sync.js';

// 受け渡しQRをカメラで読み取って取り込む（サーバー不要）。
//   ・端末が対応していれば BarcodeDetector（ブラウザ標準）でカメラから読み取り。
//   ・非対応端末（iPhoneのSafari等）は、URLを貼り付けて取り込む方式にフォールバック。
//   ・大きなデータは複数枚のQR（アニメーションQR）に分割されて届くことがあるため、
//     Reassembler で読み取った断片を集め、揃ったら取り込む。カメラをかざし続けるだけでよい。
export default function SyncScan({ onToast }) {
  const [mode, setMode] = useState('idle'); // idle | camera | paste
  const [error, setError] = useState('');
  const [pasted, setPasted] = useState('');
  const [progress, setProgress] = useState(null); // { received, total } | null
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const activeRef = useRef(false);
  const reassemblerRef = useRef(new Reassembler());
  const busyRef = useRef(false); // 取り込み処理中の多重実行防止

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

  // 揃った符号化文字列を取り込む（確認ダイアログ→インポート→再読み込み）
  const importAssembled = async (encoded) => {
    let payload;
    try {
      payload = await decodeSync(encoded);
    } catch (e) {
      onToast?.('このコードは受け渡しデータとして読み取れませんでした');
      reassemblerRef.current.reset();
      setProgress(null);
      return false;
    }
    if (isSyncExpired(payload)) {
      onToast?.('発行から5分以上経過しています（期限切れ）。元の端末で再発行してください');
      reassemblerRef.current.reset();
      setProgress(null);
      return false;
    }
    const ok = window.confirm(
      '別端末の学習データ（進捗・設定）を取り込みます。この端末の進捗は上書きされます。よろしいですか？'
    );
    if (!ok) {
      reassemblerRef.current.reset();
      setProgress(null);
      return false;
    }
    stopCamera();
    await storage.importAll(syncToBackup(payload));
    window.location.reload();
    return true;
  };

  // 1つのチャンク（QR1枚ぶん／貼り付け1回ぶん）を処理
  const handleChunkCode = async (enc) => {
    if (busyRef.current) return false;
    const res = reassemblerRef.current.add(enc);
    if (!res.ok) {
      onToast?.('これは受け渡し用のQR／URLではありません');
      return false;
    }
    setProgress({ received: res.receivedCount, total: res.total });
    if (res.total > 1 && res.isNewTransfer && res.receivedCount === 1) {
      onToast?.(`複数枚のQRに分かれています（1/${res.total}枚を読み取りました）。かざし続けてください`);
    }
    if (res.complete) {
      busyRef.current = true;
      const encoded = reassemblerRef.current.assemble();
      const done = await importAssembled(encoded);
      busyRef.current = false;
      return done;
    }
    return true;
  };

  // スキャン/貼り付けた文字列（URL）からチャンクを取り出して処理
  const handleText = (text) => {
    const enc = extractSync(text);
    if (!enc) {
      onToast?.('これは受け渡し用のQR／URLではありません');
      return false;
    }
    return handleChunkCode(decodeURIComponent(enc));
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
            if (codes && codes.length && !busyRef.current) {
              const enc = extractSync(codes[0].rawValue);
              if (enc) { await handleChunkCode(decodeURIComponent(enc)); }
              // 受け渡し用でないQRや、取り込み完了直前は無視して読み取りを続ける
            }
          } catch (e) { /* 一時的な検出エラーは無視して継続 */ }
          if (activeRef.current) timerRef.current = setTimeout(tick, 250);
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
    reassemblerRef.current.reset();
    setProgress(null);
  };

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <p className="inline-note" style={{ marginBottom: 10 }}>
        別の端末で発行した<strong>受け渡しQRコードをこの端末のカメラで読み取って</strong>、進捗・設定を取り込みます。
        データが大きい時は複数枚のQRに分かれて表示されますが、<strong>そのままかざし続ければ</strong>自動で集めて取り込みます。
        <br />🔒 発行から5分以内のQRだけ取り込めます（取り込み前に確認します）。
      </p>

      {mode === 'idle' && (
        <div className="btn-row">
          <button className="btn primary" onClick={startCamera}>📷 QRコードを読み取る（カメラ）</button>
          <button className="btn" onClick={() => { setError(''); setMode('paste'); }}>🔗 URLを貼り付けて取り込む</button>
        </div>
      )}

      {error && <div className="auth-error" style={{ marginTop: 10 }}>{error}</div>}

      {progress && progress.total > 1 && (
        <div style={{ marginTop: 10 }}>
          <div className="progress"><span style={{ width: `${(progress.received / progress.total) * 100}%` }} /></div>
          <p className="inline-note" style={{ marginTop: 4 }}>{progress.received} / {progress.total} 枚 読み取り済み</p>
        </div>
      )}

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
            相手の端末に表示されたQRコードを枠内に入れてください。自動で読み取ります
            （複数枚に分かれている場合は、切り替わるQRをそのまま映し続けてください）。
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
              複数枚に分かれている場合は、1枚ずつ貼り付けて「取り込む」を押してください（自動で集まります）。
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
            <button
              className="btn primary"
              onClick={() => { handleText(pasted); setPasted(''); }}
              disabled={!pasted.trim()}
            >
              取り込む
            </button>
            {hasDetector && <button className="btn" onClick={() => { setError(''); startCamera(); }}>📷 カメラに戻る</button>}
            <button className="btn ghost" onClick={close}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}
