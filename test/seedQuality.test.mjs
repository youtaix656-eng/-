import test from 'node:test';
import assert from 'node:assert/strict';
import { extremeAccuracyAlerts } from '../src/lib/seedQuality.js';

test('extremeAccuracyAlerts: 十分な試行があり全問不正解ならアラートする', () => {
  const seedLog = [{ at: 100, bySubject: [{ subject: 'A', count: 2 }], ids: ['a', 'b'] }];
  const history = [
    { questionId: 'a', correct: false, at: 1 },
    { questionId: 'a', correct: false, at: 2 },
    { questionId: 'a', correct: false, at: 3 },
    { questionId: 'b', correct: false, at: 4 },
    { questionId: 'b', correct: false, at: 5 },
  ];
  const alerts = extremeAccuracyAlerts(seedLog, history, { minAttempts: 5 });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].accuracy, 0);
});

test('extremeAccuracyAlerts: 試行が少なければアラートしない', () => {
  const seedLog = [{ at: 100, bySubject: [{ subject: 'A', count: 1 }], ids: ['a'] }];
  const history = [{ questionId: 'a', correct: false, at: 1 }];
  const alerts = extremeAccuracyAlerts(seedLog, history, { minAttempts: 5 });
  assert.equal(alerts.length, 0);
});

test('extremeAccuracyAlerts: 正答率が中間ならアラートしない', () => {
  const seedLog = [{ at: 100, bySubject: [{ subject: 'A', count: 1 }], ids: ['a'] }];
  const history = [
    { questionId: 'a', correct: true, at: 1 },
    { questionId: 'a', correct: false, at: 2 },
    { questionId: 'a', correct: true, at: 3 },
    { questionId: 'a', correct: false, at: 4 },
    { questionId: 'a', correct: true, at: 5 },
  ];
  const alerts = extremeAccuracyAlerts(seedLog, history, { minAttempts: 5 });
  assert.equal(alerts.length, 0);
});

test('extremeAccuracyAlerts: sinceMsより前のログは対象外', () => {
  const seedLog = [{ at: 100, bySubject: [], ids: ['a'] }];
  const history = Array.from({ length: 5 }, (_, i) => ({ questionId: 'a', correct: true, at: i }));
  const alerts = extremeAccuracyAlerts(seedLog, history, { minAttempts: 5, sinceMs: 200 });
  assert.equal(alerts.length, 0);
});
