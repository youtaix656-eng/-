import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasBadging, setAppBadgeMinutes, clearAppBadgeSafe,
  hasNotificationTrigger, scheduleTimestampNotification, cancelTimestampNotification,
  hasPeriodicSync, tryRegisterPeriodicSync, backgroundCapabilities,
} from '../src/lib/pomoBackground.js';

// node --test にはnavigator/window/Notification等が無いため、これらのAPIは
// 常に「未対応」として安全側に倒れることを固定化する（実ブラウザでの対応判定自体は
// 各ブラウザの実装に委ねるので、ここでは「無い時に落ちない」ことだけを保証する）。

test('hasBadging: navigatorが無い環境ではfalse', () => {
  assert.equal(hasBadging(), false);
});

test('setAppBadgeMinutes/clearAppBadgeSafe: 未対応環境でも例外を投げない', async () => {
  await assert.doesNotReject(() => setAppBadgeMinutes(10));
  await assert.doesNotReject(() => clearAppBadgeSafe());
});

test('hasNotificationTrigger: windowが無い環境ではfalse', () => {
  assert.equal(hasNotificationTrigger(), false);
});

test('scheduleTimestampNotification: 未対応環境ではfalseを返し、例外を投げない', async () => {
  const ok = await scheduleTimestampNotification({ showNotification: async () => {} }, Date.now() + 1000, { title: 't', body: 'b' });
  assert.equal(ok, false);
});

test('cancelTimestampNotification: regが無くても例外を投げない', async () => {
  await assert.doesNotReject(() => cancelTimestampNotification(null));
});

test('hasPeriodicSync: navigatorが無い環境ではfalse', () => {
  assert.equal(hasPeriodicSync(), false);
});

test('tryRegisterPeriodicSync: 未対応環境ではunsupportedを返す', async () => {
  const status = await tryRegisterPeriodicSync(null);
  assert.equal(status, 'unsupported');
});

test('backgroundCapabilities: すべてfalseのオブジェクトを返す（未対応環境）', () => {
  assert.deepEqual(backgroundCapabilities(), { badging: false, notificationTrigger: false, periodicSync: false });
});
