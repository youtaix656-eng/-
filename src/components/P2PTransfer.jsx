import { useEffect, useMemo, useRef, useState } from 'react';
import { exportAll } from '../lib/storage.js';
import { qrMatrix } from '../lib/qr.js';
import { splitIntoChunks, Reassembler } from '../lib/chunk.js';
import {
  createPeerConnection,
  createOfferWithChannel,
  createAnswer,
  acceptAnswer,
  encodeSdp,
  decodeSdp,
  sendOverChannel,
  receiveOverChannel,
} from '../lib/webrtcTransfer.js';
import QRImage from './QRImage.jsx';

// SDP（オファー/アンサー）は圧縮後もICE候補等でそれなりの長さになるため、
// 1個あたりの文字数を抑えてQRの版（モジュール数）を下げ、カメラでの読み取りやすさを
// 優先する（版が上がるほど1モジュールが小さくなり、画面越しの撮影では読み取りにくくなる）。
const CODE_CHUNK_LEN = 300;
const QR_SIZE = 280;

// 交換用コード（オファー／アンサー）をQR＋テキストで表示するだけの静止パネル
// （自動送りはしない。SDPの手動交換は1回きりの操作なので、SyncQR.jsxのような
// アニメーションQRは不要。ユーザーが自分のペースで枚数ぶんコピーすればよい）。
function CodeOutputPanel({ chunks, onToast, label }) {
  const [idx, setIdx] = useState(0);
  const multi = chunks.length > 1;
  const current = chunks[idx];
  const matrix = useMemo(() => qrMatrix(current), [current]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(current);
      onToast?.(multi ? `${label}（${idx + 1}/${chunks.length}）をコピーしました` : `${label}をコピーしました`);
    } catch (e) {
      onToast?.('コピーできませんでした');
    }
  };

  return (
    <div style={{ textAlign: 'center', marginTop: 10 }}>
      {matrix ? (
        <QRImage matrix={matrix} size={QR_SIZE} />
      ) : (
        <p className="inline-note">（このブロックはQRとしては大きすぎます。コピーで送ってください）</p>
      )}
      {multi && (
        <p className="inline-note" style={{ marginTop: 6 }}>
          <strong>{chunks.length}個に分割中</strong>（{idx + 1}/{chunks.length}個目）
        </p>
      )}
      <div className="btn-row" style={{ marginTop: 8, justifyContent: 'center' }}>
        {multi && <button className="btn ghost sm" onClick={() => setIdx((i) => (i - 1 + chunks.length) % chunks.length)}>◀ 前へ</button>}
        <button className="btn primary sm" onClick={copy}>📋 コピー</button>
        {multi && <button className="btn ghost sm" onClick={() => setIdx((i) => (i + 1) % chunks.length)}>次へ ▶</button>}
      </div>
    </div>
  );
}

// 相手から受け取ったコードを1ブロックずつ貼り付けて自動で組み立てる入力パネル。
// カメラ対応端末（BarcodeDetector）では、QRを直接かざして読み取ることもできる
// （端末のカメラアプリでの読み取り→コピペは、長い文字列だと"コピー"操作が出ない
// 端末があるため、アプリ内スキャンをSyncScan.jsxと同じ方式で用意する）。
function CodeInputPanel({ onComplete, onToast, label }) {
  const [text, setText] = useState('');
  const [progress, setProgress] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const reassemblerRef = useRef(new Reassembler());
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const activeRef = useRef(false);
  const busyRef = useRef(false);

  const hasDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  const stopCamera = () => {
    activeRef.current = false;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  };
  useEffect(() => () => stopCamera(), []);

  // 1ブロック分の文字列（QR1枚・貼り付け1回ぶん）を処理（貼り付け・カメラ共通）
  const addChunk = (raw) => {
    const res = reassemblerRef.current.add(raw.trim());
    if (!res.ok) {
      onToast?.(`これは${label}のコードとして読み取れませんでした`);
      return false;
    }
    setProgress({ received: res.receivedCount, total: res.total });
    if (res.complete) {
      stopCamera();
      onComplete(reassemblerRef.current.assemble());
      reassemblerRef.current.reset();
      setProgress(null);
    }
    return true;
  };

  const addFromTextarea = () => {
    if (!text.trim()) return;
    if (addChunk(text)) setText('');
  };

  const startCamera = async () => {
    setScanError('');
    if (!hasDetector) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      setScanning(true);
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
          setScanError('この端末ではQRの読み取りに対応していません。貼り付けをご利用ください。');
          stopCamera();
          return;
        }
        activeRef.current = true;
        const tick = async () => {
          if (!activeRef.current || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes && codes.length && !busyRef.current) {
              busyRef.current = true;
              addChunk(codes[0].rawValue);
              busyRef.current = false;
            }
          } catch (e) { /* 一時的な検出エラーは無視して継続 */ }
          if (activeRef.current) timerRef.current = setTimeout(tick, 250);
        };
        tick();
      });
    } catch (e) {
      setScanError('カメラを起動できませんでした。ブラウザのカメラ許可を確認するか、貼り付けをご利用ください。');
      stopCamera();
    }
  };

  return (
    <div style={{ marginTop: 10 }}>
      {progress && progress.total > 1 && (
        <p className="inline-note">{progress.received} / {progress.total} 個 取り込み済み</p>
      )}

      {hasDetector && !scanning && (
        <button className="btn" onClick={startCamera} style={{ marginBottom: 8 }}>📷 QRを読み取る（カメラ）</button>
      )}
      {scanError && <div className="auth-error" style={{ marginBottom: 8 }}>{scanError}</div>}

      {scanning && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ position: 'relative', textAlign: 'center' }}>
            <video ref={videoRef} muted playsInline style={{ width: '100%', maxWidth: 320, borderRadius: 12, background: '#000' }} />
            <div
              aria-hidden
              style={{
                position: 'absolute', top: '50%', left: '50%', width: 160, height: 160,
                transform: 'translate(-50%, -50%)', border: '3px solid rgba(255,255,255,0.9)',
                borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,0.25)', pointerEvents: 'none',
              }}
            />
          </div>
          <p className="inline-note" style={{ marginTop: 6 }}>
            相手の{label}コードを枠内に入れてください。複数枚に分かれている場合は、切り替わるQRをそのまま映し続けてください。
          </p>
          <div className="btn-row" style={{ marginTop: 6 }}>
            <button className="btn ghost sm" onClick={stopCamera}>カメラを閉じる</button>
          </div>
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`相手の${label}コードを貼り付け（複数個に分かれていたら1個ずつ）`}
        rows={3}
        style={{ width: '100%' }}
      />
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="btn primary" onClick={addFromTextarea} disabled={!text.trim()}>取り込む</button>
      </div>
    </div>
  );
}

// WebRTCで2端末を直接接続し、容量制限なくバックアップデータを転送する。
// シグナリング（offer/answer交換）はサーバーを使わず、QR/テキストで手動交換する。
// 公開STUNサーバーのみでTURNサーバーは無いため、一部のネットワーク環境（対称NAT等）
// では接続に失敗することがある（その場合は他の移行方法を使う）。
export default function P2PTransfer({ store, onToast }) {
  const { importBackup } = store;
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(null); // null | 'send' | 'receive'
  const [phase, setPhase] = useState('idle');
  const [progress, setProgress] = useState(null); // { sent/received, total }
  const [errorMsg, setErrorMsg] = useState('');
  const [offerChunks, setOfferChunks] = useState(null);
  const [answerChunks, setAnswerChunks] = useState(null);
  const pcRef = useRef(null);
  const dcRef = useRef(null);

  const cleanup = () => {
    try { dcRef.current?.close(); } catch (e) { /* noop */ }
    try { pcRef.current?.close(); } catch (e) { /* noop */ }
    pcRef.current = null;
    dcRef.current = null;
  };

  useEffect(() => cleanup, []);

  const reset = () => {
    cleanup();
    setRole(null);
    setPhase('idle');
    setProgress(null);
    setErrorMsg('');
    setOfferChunks(null);
    setAnswerChunks(null);
  };

  const watchConnectionFailure = (pc) => {
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setErrorMsg('接続できませんでした。同じWi-Fiに接続してから試すか、他の移行方法（QR分割・共有・Googleドライブ）をご利用ください。');
        setPhase('error');
      }
    };
  };

  // ===== 送る側 =====
  const startSend = async () => {
    setRole('send');
    setPhase('offering');
    setErrorMsg('');
    try {
      const pc = createPeerConnection();
      pcRef.current = pc;
      watchConnectionFailure(pc);
      const { dc, description } = await createOfferWithChannel(pc);
      dcRef.current = dc;
      const encoded = await encodeSdp(description);
      const { parts } = splitIntoChunks(encoded, CODE_CHUNK_LEN);
      setOfferChunks(parts);
      setPhase('waiting-answer');

      dc.onopen = async () => {
        setPhase('sending');
        try {
          const data = await exportAll();
          const text = JSON.stringify(data);
          await sendOverChannel(dc, text, (sent, total) => setProgress({ sent, total }));
          setPhase('done');
          onToast?.('送信が完了しました');
        } catch (e) {
          setErrorMsg(e.message || '送信に失敗しました');
          setPhase('error');
        }
      };
    } catch (e) {
      setErrorMsg(e.message || 'オファーの作成に失敗しました');
      setPhase('error');
    }
  };

  const acceptAnswerCode = async (encoded) => {
    try {
      const sdp = await decodeSdp(encoded);
      await acceptAnswer(pcRef.current, sdp);
      setPhase('connecting');
      onToast?.('応答コードを取り込みました。接続を待っています…');
    } catch (e) {
      onToast?.(e.message || '応答コードの取り込みに失敗しました');
    }
  };

  // ===== 受け取る側 =====
  const acceptOfferCode = async (encoded) => {
    setRole('receive');
    setPhase('answering');
    setErrorMsg('');
    try {
      const offerSdp = await decodeSdp(encoded);
      const pc = createPeerConnection();
      pcRef.current = pc;
      watchConnectionFailure(pc);
      pc.ondatachannel = (ev) => {
        dcRef.current = ev.channel;
        receiveOverChannel(ev.channel, {
          onProgress: (received, total) => setProgress({ received, total }),
          onComplete: async (text) => {
            try {
              const data = JSON.parse(text);
              if (!confirm('別端末の学習データ（問題・進捗・設定など）を取り込みます。この端末のデータは上書きされます。よろしいですか？')) {
                setPhase('idle-received');
                return;
              }
              await importBackup(data);
              setPhase('done');
              onToast?.('受信・取り込みが完了しました');
            } catch (e) {
              setErrorMsg('受信データの取り込みに失敗しました（形式が正しくない可能性があります）');
              setPhase('error');
            }
          },
          onError: () => {
            setErrorMsg('受信中にエラーが発生しました');
            setPhase('error');
          },
        });
      };
      const answerDesc = await createAnswer(pc, offerSdp);
      const encodedAnswer = await encodeSdp(answerDesc);
      const { parts } = splitIntoChunks(encodedAnswer, CODE_CHUNK_LEN);
      setAnswerChunks(parts);
      setPhase('waiting-connection');
    } catch (e) {
      setErrorMsg(e.message || 'アンサーの作成に失敗しました');
      setPhase('error');
    }
  };

  return (
    <div className="card">
      <p className="inline-note" style={{ marginBottom: 10 }}>
        WebRTCで別端末と<strong>直接</strong>つなぎ、容量の制限なくバックアップ（問題・進捗・設定）を
        転送します（サーバーを経由しません）。接続の合図（オファー／アンサー）だけをQR・テキストで
        手動交換する必要があります（1往復のみ）。
        <br />※ 公開STUNサーバーのみを使うため、双方が同じWi-Fiに繋がっていない場合や、
        一部のネットワーク環境（対称NAT等）では接続できないことがあります。その場合は
        QR分割・共有・Googleドライブ連携など他の方法をご利用ください。
      </p>

      {!open ? (
        <button className="btn" onClick={() => setOpen(true)}>📶 WebRTCで直接転送する</button>
      ) : (
        <div>
          {!role && (
            <div className="btn-row">
              <button className="btn primary" onClick={startSend}>📤 送る側になる</button>
              <button className="btn primary" onClick={() => setRole('receive-waiting-offer')}>📥 受け取る側になる</button>
              <button className="btn ghost" onClick={() => setOpen(false)}>閉じる</button>
            </div>
          )}

          {role === 'receive-waiting-offer' && (
            <div>
              <p className="inline-note">「送る側」の端末に表示されたコードを貼り付けてください。</p>
              <CodeInputPanel label="オファー" onToast={onToast} onComplete={acceptOfferCode} />
              <div className="btn-row" style={{ marginTop: 8 }}>
                <button className="btn ghost" onClick={reset}>やめる</button>
              </div>
            </div>
          )}

          {role === 'send' && phase === 'offering' && <p className="inline-note">接続コードを作成中…</p>}

          {role === 'send' && (phase === 'waiting-answer' || phase === 'connecting') && offerChunks && (
            <div>
              <p className="inline-note">
                このコードを「受け取る側」の端末に伝えてください（QRを読み取るか、コピーして貼り付け）。
              </p>
              <CodeOutputPanel chunks={offerChunks} onToast={onToast} label="オファー" />
              <p className="inline-note" style={{ marginTop: 12 }}>
                相手から届いた「応答コード」をここに貼り付けてください。
              </p>
              <CodeInputPanel label="応答" onToast={onToast} onComplete={acceptAnswerCode} />
              {phase === 'connecting' && <p className="inline-note">接続を待っています…</p>}
            </div>
          )}

          {role === 'send' && phase === 'sending' && (
            <div style={{ marginTop: 10 }}>
              <p className="inline-note">送信中… {progress ? `${Math.round((progress.sent / Math.max(1, progress.total)) * 100)}%` : ''}</p>
              {progress && <div className="progress"><span style={{ width: `${Math.min(100, (progress.sent / Math.max(1, progress.total)) * 100)}%` }} /></div>}
            </div>
          )}

          {role === 'receive' && phase === 'answering' && <p className="inline-note">応答コードを作成中…</p>}

          {role === 'receive' && phase === 'waiting-connection' && answerChunks && (
            <div>
              <p className="inline-note">このコードを「送る側」の端末に伝え、貼り付けてもらってください。</p>
              <CodeOutputPanel chunks={answerChunks} onToast={onToast} label="応答" />
              <p className="inline-note" style={{ marginTop: 8 }}>接続・受信を待っています…</p>
            </div>
          )}

          {role === 'receive' && progress && phase === 'waiting-connection' && (
            <div className="progress" style={{ marginTop: 8 }}>
              <span style={{ width: `${Math.min(100, (progress.received / Math.max(1, progress.total)) * 100)}%` }} />
            </div>
          )}

          {phase === 'idle-received' && <p className="inline-note">取り込みをキャンセルしました。</p>}
          {phase === 'done' && <p className="inline-note">✅ 完了しました。</p>}
          {phase === 'error' && <div className="auth-error" style={{ marginTop: 10 }}>{errorMsg}</div>}

          {role && (
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button className="btn ghost" onClick={reset}>{phase === 'done' ? '閉じる' : 'やめる'}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
