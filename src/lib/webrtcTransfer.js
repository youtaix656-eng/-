// WebRTCで端末間を直接接続し、バックアップデータを転送する（サーバー不要・容量制限なし）。
// シグナリング（offer/answer交換）は自前のサーバーを持たないため、QR/テキストで手動交換する
// （transferCodec.js・chunk.jsを再利用）。公開STUNサーバーのみ使用し、TURNサーバーは
// 用意していないため、双方が対称NAT配下など一部のネットワーク環境では接続できないことがある
// （その場合はQR分割・共有・Googleドライブ連携など他の方法を使う）。

import { encodeTransferString, decodeTransferString } from './transferCodec.js';

export const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const SEND_CHUNK_LEN = 16 * 1024;
const BUFFERED_AMOUNT_LOW = 256 * 1024;
// 制御メッセージの目印。生データ（JSONバックアップのスライス）には現れない制御文字なので、
// データ本体と混同しない（JSON.stringifyの出力に生の制御文字は含まれない）。
const META_PREFIX = 'META:';
const DONE_MARKER = 'DONE';

export function createPeerConnection() {
  return new RTCPeerConnection({ iceServers: STUN_SERVERS });
}

function waitIceComplete(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', check);
    // 候補収集が長引く場合の保険（部分的な候補でも接続できることが多い）
    setTimeout(resolve, 4000);
  });
}

// 送信側：DataChannelを作り、オファーのSDPを完成させる（ICE候補を含んだ状態）
export async function createOfferWithChannel(pc) {
  const dc = pc.createDataChannel('shinkyu-backup');
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitIceComplete(pc);
  return { dc, description: pc.localDescription };
}

// 受信側：受け取ったオファーからアンサーのSDPを完成させる
export async function createAnswer(pc, offerDescription) {
  await pc.setRemoteDescription(offerDescription);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await waitIceComplete(pc);
  return pc.localDescription;
}

// 送信側：受け取ったアンサーを反映して接続を完了させる
export async function acceptAnswer(pc, answerDescription) {
  await pc.setRemoteDescription(answerDescription);
}

// SDP（RTCSessionDescription相当）⇄ 受け渡し用テキストの符号化・復号
export async function encodeSdp(description) {
  return encodeTransferString(JSON.stringify({ type: description.type, sdp: description.sdp }));
}
export async function decodeSdp(str) {
  const obj = JSON.parse(await decodeTransferString(str));
  if (!obj || !obj.type || !obj.sdp) throw new Error('SDPの形式として読み取れませんでした');
  return obj;
}

// DataChannel経由でテキストを送る（大きい場合は内部で分割し、bufferedAmountで速度調整する）
export function sendOverChannel(dc, text, onProgress) {
  return new Promise((resolve, reject) => {
    const total = text.length;
    try {
      dc.send(META_PREFIX + JSON.stringify({ total }));
    } catch (e) {
      reject(e);
      return;
    }
    let offset = 0;
    const pump = () => {
      try {
        while (offset < total) {
          if (dc.bufferedAmount > BUFFERED_AMOUNT_LOW) {
            dc.bufferedAmountLowThreshold = Math.floor(BUFFERED_AMOUNT_LOW / 2);
            dc.onbufferedamountlow = () => {
              dc.onbufferedamountlow = null;
              pump();
            };
            return;
          }
          const piece = text.slice(offset, offset + SEND_CHUNK_LEN);
          dc.send(piece);
          offset += piece.length;
          onProgress?.(offset, total);
        }
        dc.send(DONE_MARKER);
        resolve();
      } catch (e) {
        reject(e);
      }
    };
    pump();
  });
}

// 受信側：DataChannelでの受信を組み立てる。完了したら onComplete(fullText) が呼ばれる
export function receiveOverChannel(dc, { onProgress, onComplete, onError } = {}) {
  let total = 0;
  let received = '';
  dc.onmessage = (ev) => {
    try {
      const data = ev.data;
      if (typeof data !== 'string') return;
      if (data.startsWith(META_PREFIX)) {
        total = JSON.parse(data.slice(META_PREFIX.length)).total || 0;
        return;
      }
      if (data === DONE_MARKER) {
        onComplete?.(received);
        return;
      }
      received += data;
      onProgress?.(received.length, total);
    } catch (e) {
      onError?.(e);
    }
  };
}
