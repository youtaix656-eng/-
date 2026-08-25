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
const ACK_MARKER = 'ACK';
// 受信側からのACKを待つ上限（DONE送出後、確認が来ない不安定な回線に備える）
const ACK_TIMEOUT_MS = 15000;

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

// DataChannel経由でテキストを送る（大きい場合は内部で分割し、bufferedAmountで速度調整する）。
// dc.send()はキューへの投入に過ぎず、相手に届いた保証はしない。そのためDONE送信後もresolveしず、
// 受信側からのACK（全部受け取った確認）を待って初めて成功とする（実測で、送信側が「完了」
// と表示された後も受信側が94%で永久に止まる事例を確認したため）。
export function sendOverChannel(dc, text, onProgress, { ackTimeoutMs = ACK_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const total = text.length;
    let ackTimer = null;
    const cleanupAckWait = () => {
      if (ackTimer) { clearTimeout(ackTimer); ackTimer = null; }
      dc.onmessage = null;
    };
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
        // ACK待ち受けはDONE送信より先に登録する（同じイベントループ内でACKが
        // 返ってくる環境でも取りこぼさないため）。
        dc.onmessage = (ev) => {
          if (ev.data === ACK_MARKER) {
            cleanupAckWait();
            resolve();
          }
        };
        ackTimer = setTimeout(() => {
          cleanupAckWait();
          reject(new Error('受信側からの受信確認が取れませんでした。ネットワークが不安定な可能性があります。もう一度お試しいただくか、他の移行方法をご利用ください。'));
        }, ackTimeoutMs);
        dc.send(DONE_MARKER);
      } catch (e) {
        cleanupAckWait();
        reject(e);
      }
    };
    pump();
  });
}

// 受信側：DataChannelでの受信を組み立てる。完了したら onComplete(fullText) が呼ばれる。
// 途中でデータが止まったまま（ネットワーク不安定等）にならないよう、一定時間進捗がなければ
// onErrorで知らせる（以前は完了まで進捗があれば永久に待ち続けてしまっていた）。
const STALL_TIMEOUT_MS = 15000;
export function receiveOverChannel(dc, { onProgress, onComplete, onError, stallTimeoutMs = STALL_TIMEOUT_MS } = {}) {
  let total = 0;
  let received = '';
  let done = false;
  let stallTimer = null;
  const armStallTimer = () => {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      if (!done) {
        done = true;
        onError?.(new Error('受信が途中で止まりました。ネットワークが不安定な可能性があります。もう一度お試しいただくか、他の移行方法をご利用ください。'));
      }
    }, stallTimeoutMs);
  };
  dc.onmessage = (ev) => {
    if (done) return;
    try {
      const data = ev.data;
      if (typeof data !== 'string') return;
      if (data.startsWith(META_PREFIX)) {
        total = JSON.parse(data.slice(META_PREFIX.length)).total || 0;
        armStallTimer();
        return;
      }
      if (data === DONE_MARKER) {
        done = true;
        if (stallTimer) clearTimeout(stallTimer);
        try { dc.send(ACK_MARKER); } catch (e) { /* 送信側がすでに閉じていても受信自体は成功しているので無視 */ }
        onComplete?.(received);
        return;
      }
      received += data;
      armStallTimer();
      onProgress?.(received.length, total);
    } catch (e) {
      done = true;
      if (stallTimer) clearTimeout(stallTimer);
      onError?.(e);
    }
  };
}
