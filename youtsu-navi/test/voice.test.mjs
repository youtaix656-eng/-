import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendTranscript, previewTranscript, describeVoiceError, isRetryableVoiceError,
  getSpeechRecognition, isVoiceInputAvailable, canUseVoiceInput, createRecognizer,
  VOICE_LANG, VOICE_PRIVACY_NOTE,
} from '../src/lib/voice.js';

test('日本語は余計な空白を入れずに連結する', () => {
  assert.equal(appendTranscript('前屈で痛み', 'あり'), '前屈で痛みあり');
  assert.equal(appendTranscript('', '腰部の張り'), '腰部の張り');
  assert.equal(appendTranscript('腰部の張り', ''), '腰部の張り');
  assert.equal(appendTranscript('腰部の張り', '   '), '腰部の張り');
});

test('英数字どうしの境目だけ半角スペースを入れる', () => {
  assert.equal(appendTranscript('SLR', 'test'), 'SLR test');
  assert.equal(appendTranscript('SLR', '陽性'), 'SLR陽性');
  assert.equal(appendTranscript('陽性', 'SLR'), '陽性SLR');
});

test('句読点・改行のあとはそのまま続ける', () => {
  assert.equal(appendTranscript('可動域は改善。', '次回は'), '可動域は改善。次回は');
  assert.equal(appendTranscript('1行目\n', '2行目'), '1行目\n2行目');
  assert.equal(appendTranscript('メモ ', '続き'), 'メモ 続き');
});

test('null/undefined でも落ちない', () => {
  assert.equal(appendTranscript(undefined, undefined), '');
  assert.equal(appendTranscript(null, '腰'), '腰');
  assert.equal(appendTranscript('腰', null), '腰');
});

test('途中経過の表示は確定分と同じ規則で連結する', () => {
  assert.equal(previewTranscript('前屈で', '痛み'), '前屈で痛み');
  assert.equal(previewTranscript('前屈で', ''), '前屈で');
});

test('エラーは施術中でも分かる日本語にする', () => {
  assert.match(describeVoiceError('not-allowed'), /マイク/);
  assert.match(describeVoiceError('network'), /接続/);
  assert.match(describeVoiceError('no-speech'), /聞き取れ/);
  // 未知のコードでも空文字にしない
  assert.ok(describeVoiceError('とつぜんの謎エラー').length > 0);
  assert.ok(describeVoiceError(undefined).length > 0);
});

test('やり直せるエラーかを区別する', () => {
  assert.equal(isRetryableVoiceError('no-speech'), true);
  assert.equal(isRetryableVoiceError('network'), true);
  assert.equal(isRetryableVoiceError('not-allowed'), false);
  assert.equal(isRetryableVoiceError('service-not-allowed'), false);
});

test('未対応環境では null を返し、ボタンを出さない', () => {
  assert.equal(getSpeechRecognition(undefined), null);
  assert.equal(getSpeechRecognition({}), null);
  assert.equal(isVoiceInputAvailable({}), false);
  assert.equal(createRecognizer({}, {}), null);
  assert.equal(canUseVoiceInput({}, { voiceInput: true }), false);
});

test('設定がオフなら対応端末でも使わない（既定オフの明示的なオプトイン）', () => {
  class FakeRecognition {}
  const win = { SpeechRecognition: FakeRecognition };
  assert.equal(isVoiceInputAvailable(win), true);
  assert.equal(canUseVoiceInput(win, {}), false);
  assert.equal(canUseVoiceInput(win, { voiceInput: false }), false);
  assert.equal(canUseVoiceInput(win, { voiceInput: true }), true);
});

test('webkit接頭辞のブラウザにも対応する', () => {
  class FakeRecognition {}
  assert.equal(getSpeechRecognition({ webkitSpeechRecognition: FakeRecognition }), FakeRecognition);
});

/** イベントの出方を再現する最小のダミー */
function fakeWindow() {
  const made = [];
  class FakeRecognition {
    constructor() {
      this.started = 0;
      this.stopped = 0;
      made.push(this);
    }
    start() { this.started += 1; }
    stop() { this.stopped += 1; }
    abort() { this.aborted = true; }
  }
  return { win: { SpeechRecognition: FakeRecognition }, made };
}

test('確定した文字と途中経過を分けて渡す', () => {
  const { win, made } = fakeWindow();
  const finals = [];
  const interims = [];
  const rec = createRecognizer(win, { onFinal: (t) => finals.push(t), onInterim: (t) => interims.push(t) });
  rec.start();
  const impl = made[0];
  assert.equal(impl.lang, VOICE_LANG);
  assert.equal(impl.continuous, true);
  assert.equal(impl.started, 1);

  impl.onresult({
    resultIndex: 0,
    results: [
      { isFinal: true, 0: { transcript: '右の腰が痛い' } },
      { isFinal: false, 0: { transcript: 'まえに' } },
    ],
  });
  assert.deepEqual(finals, ['右の腰が痛い']);
  assert.deepEqual(interims, ['まえに']);
});

test('終了時は途中経過を空にしてから onEnd を呼ぶ', () => {
  const { win, made } = fakeWindow();
  const order = [];
  const rec = createRecognizer(win, {
    onInterim: (t) => order.push(`interim:${t}`),
    onEnd: () => order.push('end'),
    onError: (c) => order.push(`error:${c}`),
  });
  rec.start();
  const impl = made[0];
  impl.onerror({ error: 'no-speech' });
  impl.onend();
  assert.deepEqual(order, ['error:no-speech', 'interim:', 'end']);
});

test('二重startやstop時の例外を外へ漏らさない', () => {
  class Throwing {
    start() { throw new Error('already started'); }
    stop() { throw new Error('not started'); }
    abort() { throw new Error('nope'); }
  }
  const rec = createRecognizer({ SpeechRecognition: Throwing }, {});
  assert.doesNotThrow(() => rec.start());
  assert.doesNotThrow(() => rec.stop());
  assert.doesNotThrow(() => rec.abort());
});

test('音声が端末の外に出る可能性を説明文で明示している', () => {
  assert.match(VOICE_PRIVACY_NOTE, /サーバ/);
  assert.match(VOICE_PRIVACY_NOTE, /お名前/);
});
