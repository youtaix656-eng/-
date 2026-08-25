import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sendOverChannel,
  receiveOverChannel,
  encodeSdp,
  decodeSdp,
} from '../src/lib/webrtcTransfer.js';

// 双方向のフェイクDataChannelペア（実際のRTCPeerConnectionは使わない、フレーミング＋
// ACK/ストール検知のロジックだけを検証する）。send()は相手のonmessageへ即座に届く。
function makeChannelPair() {
  const sender = { bufferedAmount: 0, onmessage: null };
  const receiver = { bufferedAmount: 0, onmessage: null };
  sender.send = (data) => { receiver.onmessage?.({ data }); };
  receiver.send = (data) => { sender.onmessage?.({ data }); };
  return { sender, receiver };
}

test('sendOverChannel/receiveOverChannel: 小さいデータの往復（ACKまで含めて完了する）', async () => {
  const { sender, receiver } = makeChannelPair();
  const text = 'こんにちは、これはテストデータです。';
  let completed = null;
  receiveOverChannel(receiver, { onComplete: (t) => { completed = t; } });
  await sendOverChannel(sender, text);
  assert.equal(completed, text);
});

test('sendOverChannel/receiveOverChannel: 分割送信されるサイズでも往復できる', async () => {
  const { sender, receiver } = makeChannelPair();
  const text = 'A'.repeat(50_000); // SEND_CHUNK_LEN(16KB)を跨ぐサイズ
  let completed = null;
  const progressCalls = [];
  receiveOverChannel(receiver, {
    onComplete: (t) => { completed = t; },
    onProgress: (received, total) => progressCalls.push([received, total]),
  });
  await sendOverChannel(sender, text);
  assert.equal(completed, text);
  assert.ok(progressCalls.length >= 3, '16KBずつ複数回に分けて送られる');
  assert.equal(progressCalls[progressCalls.length - 1][0], 50_000);
});

test('receiveOverChannel: メタ情報より前にonProgressは呼ばれない（総量不明の0除算を避ける）', async () => {
  const { sender, receiver } = makeChannelPair();
  const progressCalls = [];
  receiveOverChannel(receiver, { onProgress: (r, t) => progressCalls.push([r, t]) });
  await sendOverChannel(sender, 'short');
  assert.ok(progressCalls.every(([, t]) => t === 5));
});

test('sendOverChannel: 受信側からACKが来なければタイムアウトで失敗する（送信側の"完了"誤表示を防ぐ）', async () => {
  const sender = { bufferedAmount: 0, onmessage: null, send() { /* ブラックホール：相手に届かない */ } };
  await assert.rejects(
    () => sendOverChannel(sender, 'short', undefined, { ackTimeoutMs: 30 }),
    /受信確認/
  );
});

test('receiveOverChannel: DONEを受け取ったら受信側はACKを送り返す', async () => {
  const { sender, receiver } = makeChannelPair();
  const acked = [];
  const realSend = receiver.send;
  receiver.send = (data) => { acked.push(data); realSend(data); };
  let completed = null;
  receiveOverChannel(receiver, { onComplete: (t) => { completed = t; } });
  await sendOverChannel(sender, 'hello');
  assert.equal(completed, 'hello');
  assert.ok(acked.length >= 1, 'ACKを送信している');
});

test('receiveOverChannel: 途中でデータが止まるとonErrorで知らせる（無限に待たされない）', async () => {
  const receiver = { onmessage: null };
  let errorSeen = null;
  receiveOverChannel(receiver, { onError: (e) => { errorSeen = e; }, stallTimeoutMs: 30 });
  // METAだけ届いて、その後データが一切来ないケース（回線切断等を想定）
  receiver.onmessage({ data: 'META:' + JSON.stringify({ total: 100 }) });
  await new Promise((r) => setTimeout(r, 80));
  assert.ok(errorSeen instanceof Error);
  assert.match(errorSeen.message, /止ま/);
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
