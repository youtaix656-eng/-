import test from 'node:test';
import assert from 'node:assert/strict';
import { haripanReminder } from '../src/data/haripan.js';

test('haripanReminder: stalledDays省略時は従来どおり', () => {
  const body = haripanReminder(null, 5);
  assert.match(body, /復習が5問たまってるぞ/);
  assert.doesNotMatch(body, /ゼロに戻せてない/);
});

test('haripanReminder: 3日以上ゼロに戻せていない時は一言追加する（#6）', () => {
  const body = haripanReminder(null, 5, 3);
  assert.match(body, /復習が3日ゼロに戻せてないぞ/);
});

test('haripanReminder: stalledDaysが3未満なら追加しない', () => {
  const body = haripanReminder(null, 0, 2);
  assert.doesNotMatch(body, /ゼロに戻せてない/);
});
