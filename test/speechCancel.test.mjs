import test from 'node:test';
import assert from 'node:assert/strict';

// 長い文を区切って読んでいる途中で止められたら、残りの区切りを読まない（2026-11-22の修正）
test('speak: 区切りの途中で止められたら残りを読まない', async () => {
  const spoken = [];
  globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  globalThis.document = { hidden: false };
  globalThis.window = {
    speechSynthesis: {
      speaking: false, pending: false, paused: false,
      speak(u) {
        spoken.push(u.text);
        // 1つめの区切りを読んでいる最中に、別の場所から cancel された
        setTimeout(() => u.onerror?.({ error: 'interrupted' }), 0);
      },
      cancel() {}, resume() {},
    },
  };
  const { speak } = await import('../src/lib/speech.js');
  const long = 'あ'.repeat(100) + '。' + 'い'.repeat(100) + '。' + 'う'.repeat(100) + '。';
  await speak(long);
  assert.equal(spoken.length, 1);
});
