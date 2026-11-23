import test from 'node:test';
import assert from 'node:assert/strict';
import { keepDeviceSettings, DEVICE_SETTING_KEYS } from '../src/lib/storage.js';

test('復元では端末ごとの設定を今の端末の値のまま残す', () => {
  const incoming = { dailyGoal: 100, authSkipped: false, googleDriveAutoSync: true, googleDriveClientId: 'browser',
    voiceClone: { enabled: true }, answersSinceBackup: 40, pomodoro: { enabled: true, activeSongId: 'x1' } };
  const current = { dailyGoal: 300, authSkipped: true, googleDriveAutoSync: false, googleDriveClientId: '',
    voiceClone: { enabled: false }, answersSinceBackup: 0, pomodoro: { enabled: false, activeSongId: 'mine' } };
  const out = keepDeviceSettings(incoming, current);
  assert.equal(out.dailyGoal, 100); // 学習の設定は持ち込む
  assert.equal(out.authSkipped, true);
  assert.equal(out.googleDriveAutoSync, false);
  assert.equal(out.googleDriveClientId, '');
  assert.deepEqual(out.voiceClone, { enabled: false });
  assert.equal(out.answersSinceBackup, 0);
  assert.equal(out.pomodoro.enabled, true);
  assert.equal(out.pomodoro.activeSongId, 'mine');
});

test('今の端末に無い端末ごとの設定は持ち込まない', () => {
  const out = keepDeviceSettings({ googleDriveClientId: 'browser', dailyGoal: 60 }, {});
  assert.ok(!('googleDriveClientId' in out));
  assert.equal(out.dailyGoal, 60);
  assert.ok(DEVICE_SETTING_KEYS.includes('authSkipped'));
});
