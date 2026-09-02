import test from 'node:test';
import assert from 'node:assert/strict';
import { toJson, parseJson, backupFileName } from '../src/lib/backup.js';
import { suggestionsFor, hasAudioLink, DEFAULT_AUDIO_URL } from '../src/lib/audioLink.js';
import { buildDefaultHabits } from '../src/lib/habits.js';
import { testSettings } from './fixtures.js';
import type { AppState } from '../src/types/index.js';

const AT = new Date(2026, 7, 21, 9, 5).getTime();
const settings = testSettings();
const state: AppState = { version: 1, habits: buildDefaultHabits(AT), days: {}, weeks: {}, cycles: [], settings };

test('書き出し→取り込みで中身が戻る', () => {
  const parsed = parseJson(toJson(state, AT), state);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.state!.habits.length, 7);
  assert.equal(parsed.state!.settings.bedWithinMinutes, 90);
});

test('他アプリ・壊れたファイルは弾く', () => {
  assert.equal(parseJson('こわれています', state).ok, false);
  assert.equal(parseJson(JSON.stringify({ app: 'other', kind: 'henkaku-note-backup', state }), state).ok, false);
  assert.equal(parseJson(JSON.stringify({ app: 'henkaku-note', kind: 'records', state }), state).ok, false);
  assert.equal(parseJson(JSON.stringify({ app: 'henkaku-note', kind: 'henkaku-note-backup' }), state).ok, false);
});

test('欠けた項目は既定値で補う（古いバックアップでも開ける）', () => {
  const partial = JSON.stringify({
    app: 'henkaku-note', kind: 'henkaku-note-backup', version: 1,
    state: { version: 1, days: { '2026-08-01': { date: '2026-08-01', checked: [] } } },
  });
  const parsed = parseJson(partial, state);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.state!.habits.length, 7);
  assert.deepEqual(parsed.state!.cycles, []);
  assert.equal(parsed.state!.settings.offDayBedtime, '23:00');
});

test('ファイル名に日付が入る', () => {
  assert.equal(backupFileName(AT), 'henkaku-note-20260821.json');
});

test('音声学習の導線は、設定がオンで、達成した習慣にだけ出す', () => {
  const habits = buildDefaultHabits(AT);
  assert.deepEqual(suggestionsFor(['step1-peers'], habits, settings), []); // 既定オフ
  const on = { ...settings, audioLinkEnabled: true, audioLinkUrl: '' };
  const s = suggestionsFor(['step1-peers', 'step2-onegoal'], habits, on);
  assert.equal(s.length, 1); // ②は導線を持たない
  assert.equal(s[0].habitId, 'step1-peers');
  assert.equal(s[0].url, DEFAULT_AUDIO_URL);
  assert.ok(s[0].reason.length > 0);
});

test('導線を持つのはステップ①③④だけ', () => {
  assert.equal(hasAudioLink('step1-peers'), true);
  assert.equal(hasAudioLink('step3-noise'), true);
  assert.equal(hasAudioLink('step4-zero-morning'), true);
  assert.equal(hasAudioLink('step5-bedtime'), false);
  assert.equal(hasAudioLink('step2-onegoal'), false);
});

test('知らない習慣idは無視する', () => {
  const on = { ...settings, audioLinkEnabled: true };
  assert.deepEqual(suggestionsFor(['なりすまし'], buildDefaultHabits(AT), on), []);
});
