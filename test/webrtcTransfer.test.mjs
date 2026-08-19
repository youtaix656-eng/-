import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sendOverChannel,
  receiveOverChannel,
  encodeSdp,
  decodeSdp,
} from '../src/lib/webrtcTransfer.js';

// 送信側の dc.send() 呼び出しを配列にため、受信側の dc.onmessage へそのまま流し込む
// フェイクのDataChannelペア（実際のRTCPeerConnectionは使わない、フレーミングだけを検証）
function makeChannelPair() {
  const sent = [];
  const sender = {
    bufferedAmount: 0,
    send(data) { sent.push(data); },
  };
  const receiver = { onmessage: null };
  const deliver = () => {
    for (const data of sent) receiver.onmessage({ data });
  };
  return { sender, receiver, deliver };
}

test('sendOverChannel/receiveOverChannel: 小さいデータの往復', async () => {
  const { sender, receiver, deliver } = makeChannelPair();
  const text = 'こんにちは、これはテストデータです。';
  let completed = null;
  receiveOverChannel(receiver, { onComplete: (t) => { completed = t; } });
  await sendOverChannel(sender, text);
  deliver();
  assert.equal(completed, text);
});

test('sendOverChannel/receiveOverChannel: 分割送信されるサイズでも往復できる', async () => {
  const { sender, receiver, deliver } = makeChannelPair();
  const text = 'A'.repeat(50_000); // SEND_CHUNK_LEN(16KB)を跨ぐサイズ
  let completed = null;
  const progressCalls = [];
  receiveOverChannel(receiver, {
    onComplete: (t) => { completed = t; },
    onProgress: (received, total) => progressCalls.push([received, total]),
  });
  await sendOverChannel(sender, text);
  deliver();
  assert.equal(completed, text);
  assert.ok(progressCalls.length >= 3, '16KBずつ複数回に分けて送られる');
  assert.equal(progressCalls[progressCalls.length - 1][0], 50_000);
});

test('receiveOverChannel: メタ情報より前にonProgressは呼ばれない（総量不明の0除算を避ける）', async () => {
  const { sender, receiver, deliver } = makeChannelPair();
  const progressCalls = [];
  receiveOverChannel(receiver, { onProgress: (r, t) => progressCalls.push([r, t]) });
  await sendOverChannel(sender, 'short');
  deliver();
  assert.ok(progressCalls.every(([, t]) => t === 5));
});

test('encodeSdp/decodeSdp: RTCSessionDescription相当のtype/sdpが往復できる', async () => {
  const desc = { type: 'offer', sdp: 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\n' };
  const enc = await encodeSdp(desc);
  const back = await decodeSdp(enc);
  assert.equal(back.type, desc.type);
  assert.equal(back.sdp, desc.sdp);
});

test('decodeSdp: type/sdpを欠く不正な入力はエラーになる', async () => {
  const { encodeTransferString } = await import('../src/lib/transferCodec.js');
  const badEnc = await encodeTransferString(JSON.stringify({ foo: 'bar' }));
  await assert.rejects(() => decodeSdp(badEnc));
});
