import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractYoutubeId } from '../src/lib/pomoYoutube.js';

test('extractYoutubeId: 動画IDそのものを渡した場合', () => {
  assert.equal(extractYoutubeId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

test('extractYoutubeId: 通常のwatch URL', () => {
  assert.equal(extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s'), 'dQw4w9WgXcQ');
  assert.equal(extractYoutubeId('https://m.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

test('extractYoutubeId: 短縮URL（youtu.be）', () => {
  assert.equal(extractYoutubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYoutubeId('https://youtu.be/dQw4w9WgXcQ?si=abc'), 'dQw4w9WgXcQ');
});

test('extractYoutubeId: embed / shorts URL', () => {
  assert.equal(extractYoutubeId('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYoutubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

test('extractYoutubeId: 読み取れない入力はnullを返す（当てずっぽうで何かを返さない）', () => {
  assert.equal(extractYoutubeId(''), null);
  assert.equal(extractYoutubeId(null), null);
  assert.equal(extractYoutubeId(undefined), null);
  assert.equal(extractYoutubeId('not a url'), null);
  assert.equal(extractYoutubeId('https://example.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(extractYoutubeId('https://www.youtube.com/'), null);
});
