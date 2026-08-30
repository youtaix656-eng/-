// 流して受け取る仕組み（readSse / throttleDelta）の単体テスト。
//
// ブラウザでの見た目は模擬サーバーの速さに左右されて当てにならないので、
// 「途中で切れた行を落とさないか」「最初の1文字がすぐ出るか」はここで機械チェックする。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readSse, throttleDelta } from '../src/lib/providers/stream.js';

function sseResponse(chunks) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(c) {
      for (const s of chunks) c.enqueue(enc.encode(s));
      c.close();
    },
  });
  return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
}

async function collect(chunks) {
  const got = [];
  await readSse(sseResponse(chunks), (d) => got.push(d));
  return got;
}

test('readSse は data: の中身だけを渡す', async () => {
  assert.deepEqual(await collect(['data: one\ndata: two\n']), ['one', 'two']);
});

test('readSse は行が塊の途中で切れても落とさない', async () => {
  // 「data: こんに」で切れて、次の塊で「ちは」が来る場合
  assert.deepEqual(await collect(['data: こんに', 'ちは\n']), ['こんにちは']);
});

test('readSse は改行で終わらない最後の行も渡す', async () => {
  assert.deepEqual(await collect(['data: last']), ['last']);
});

test('readSse は空行と : で始まる注釈を無視する', async () => {
  assert.deepEqual(await collect([': ping\n\ndata: a\n\n']), ['a']);
});

test('readSse は event: 行を渡さない（data だけ見る）', async () => {
  assert.deepEqual(await collect(['event: message_start\ndata: {"x":1}\n']), ['{"x":1}']);
});

test('throttleDelta は最初の1回をすぐ出す（書き出しを待たせない）', () => {
  const got = [];
  const t = throttleDelta((s) => got.push(s), 90);
  t.push('あ');
  assert.deepEqual(got, ['あ'], '1文字目は間引かずに出す');
});

test('throttleDelta は続けて来た分をまとめ、flush で残りを出す', () => {
  const got = [];
  const t = throttleDelta((s) => got.push(s), 5000); // 間隔を長くして間引きを確実にする
  t.push('あ'); // これはすぐ出る
  t.push('い');
  t.push('う');
  assert.deepEqual(got, ['あ'], '間引いている間は出さない');
  t.flush();
  assert.deepEqual(got, ['あ', 'いう'], 'flush で残りがまとめて出る');
});

test('throttleDelta の flush は残りが無ければ空文字を出さない', () => {
  const got = [];
  const t = throttleDelta((s) => got.push(s), 5000);
  t.push('あ');
  t.flush();
  t.flush();
  assert.deepEqual(got, ['あ']);
});

test('throttleDelta は受け手が無くても壊れない', () => {
  const t = throttleDelta(undefined);
  t.push('あ');
  t.flush();
  assert.ok(true);
});
