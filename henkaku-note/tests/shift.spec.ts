import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shiftEndMinutes, bedtimeTarget, sleepMinutes, guessCrossesMidnight, judgeBedtime,
  bedtimeSummary, toSleepHandoff,
} from '../src/lib/shift.js';
import type { DayRecord, Settings } from '../src/types/index.js';

const settings: Settings = {
  shiftEndDefault: '00:00',
  bedWithinMinutes: 90,
  offDayBedtime: '23:00',
  audioLinkEnabled: false,
  audioLinkUrl: '',
  showStreakProminently: false,
};

function day(over: Partial<DayRecord> = {}): DayRecord {
  return {
    date: '2026-08-21', checked: [], declaration: '', note: '',
    shift: null, shiftEndsAt: null, sleep: null, updatedAt: 0, ...over,
  };
}

test('深夜0時前後の終業を「その日の続き」として分に直す', () => {
  assert.equal(shiftEndMinutes('23:30'), 1410);
  assert.equal(shiftEndMinutes('00:00'), 1440); // 日付は変わっているが、その日の勤務の終わり
  assert.equal(shiftEndMinutes('00:30'), 1470);
  assert.equal(shiftEndMinutes('01:00'), 1500);
  assert.equal(shiftEndMinutes('13:00'), 780); // 昼の終業はその日のまま
  assert.equal(shiftEndMinutes('こわれた'), null);
});

test('勤務日の就寝目標は「終業＋90分」で、日付をまたいでも計算できる', () => {
  const t = bedtimeTarget(day({ shift: 'work' }), settings)!;
  assert.equal(t.minutes, 1530); // 00:00 + 90分
  assert.equal(t.label, '翌01:30');
  assert.equal(t.basis, 'work');
  assert.match(t.reason, /終業 翌00:00 ＋ 90分/);
});

test('その日だけ終業時刻を変えられる', () => {
  const early = bedtimeTarget(day({ shift: 'work', shiftEndsAt: '21:00' }), settings)!;
  assert.equal(early.label, '22:30');
  const late = bedtimeTarget(day({ shift: 'work', shiftEndsAt: '01:00' }), settings)!;
  assert.equal(late.label, '翌02:30');
});

test('休日は固定の目標時刻', () => {
  const t = bedtimeTarget(day({ shift: 'off' }), settings)!;
  assert.equal(t.label, '23:00');
  assert.equal(t.basis, 'off');
});

test('シフト未設定の日は目標を作らない（守れない目標を並べない）', () => {
  assert.equal(bedtimeTarget(day(), settings), null);
  assert.equal(bedtimeTarget(undefined, settings), null);
});

test('設定の「終業から何分以内」を変えると目標も動く', () => {
  const strict = bedtimeTarget(day({ shift: 'work' }), { ...settings, bedWithinMinutes: 45 })!;
  assert.equal(strict.label, '翌00:45');
  const loose = bedtimeTarget(day({ shift: 'work' }), { ...settings, bedWithinMinutes: 180 })!;
  assert.equal(loose.label, '翌03:00');
});

test('日付をまたいだ就寝の推定', () => {
  const workTarget = bedtimeTarget(day({ shift: 'work' }), settings);
  assert.equal(guessCrossesMidnight('01:20', workTarget), true);
  assert.equal(guessCrossesMidnight('23:40', workTarget), false);
  const offTarget = bedtimeTarget(day({ shift: 'off' }), settings);
  assert.equal(guessCrossesMidnight('00:30', offTarget), true); // 休日でも0時台は翌日
  assert.equal(guessCrossesMidnight('22:00', offTarget), false);
});

test('就寝実績の判定（目標より前なら達成）', () => {
  const met = day({ shift: 'work', sleep: { actualAt: '01:10', crossesMidnight: true, recordedAt: 0 } });
  const r1 = judgeBedtime(met, settings);
  assert.equal(r1.verdict, 'met');
  assert.equal(r1.diffMinutes, -20);
  assert.match(r1.text, /20分早く/);

  const late = day({ shift: 'work', sleep: { actualAt: '02:15', crossesMidnight: true, recordedAt: 0 } });
  const r2 = judgeBedtime(late, settings);
  assert.equal(r2.verdict, 'late');
  assert.equal(r2.diffMinutes, 45);
  assert.match(r2.text, /45分あと/);
});

test('判定の文言は責めない（「遅い」「守れなかった」等を使わない）', () => {
  const late = day({ shift: 'work', sleep: { actualAt: '03:00', crossesMidnight: true, recordedAt: 0 } });
  const text = judgeBedtime(late, settings).text;
  for (const ng of ['ダメ', '守れませんでした', '失敗', 'できていません']) {
    assert.equal(text.includes(ng), false, `責める表現が入っている: ${text}`);
  }
});

test('記録が無い・シフト未設定なら判定しない', () => {
  assert.equal(judgeBedtime(day({ shift: 'work' }), settings).verdict, 'unknown');
  assert.equal(judgeBedtime(day({ sleep: { actualAt: '01:00', crossesMidnight: true, recordedAt: 0 } }), settings).verdict, 'unknown');
  assert.equal(judgeBedtime(undefined, settings).verdict, 'unknown');
});

test('就寝実績の分は「翌日」フラグで1440を足す', () => {
  assert.equal(sleepMinutes({ actualAt: '01:30', crossesMidnight: true, recordedAt: 0 }), 1530);
  assert.equal(sleepMinutes({ actualAt: '23:00', crossesMidnight: false, recordedAt: 0 }), 1380);
  assert.equal(sleepMinutes({ actualAt: 'ぐちゃぐちゃ', crossesMidnight: false, recordedAt: 0 }), null);
});

test('期間の集計は「シフトを設定した日」だけを分母にする', () => {
  const records = [
    day({ date: '2026-08-17', shift: 'work', sleep: { actualAt: '01:00', crossesMidnight: true, recordedAt: 0 } }), // met
    day({ date: '2026-08-18', shift: 'work', sleep: { actualAt: '02:30', crossesMidnight: true, recordedAt: 0 } }), // late 60分
    day({ date: '2026-08-19', shift: 'off', sleep: { actualAt: '23:30', crossesMidnight: false, recordedAt: 0 } }), // late 30分
    day({ date: '2026-08-20', shift: 'work' }), // 記録なし
    day({ date: '2026-08-21' }), // シフト未設定 → 数えない
  ];
  const s = bedtimeSummary(records, settings);
  assert.equal(s.planned, 4);
  assert.equal(s.recorded, 3);
  assert.equal(s.met, 1);
  assert.equal(s.late, 2);
  assert.equal(s.averageLateMinutes, 45);
});

test('睡眠トラッカーへ渡せる形（後で別機能とつなぐため）', () => {
  const record = day({ shift: 'work', sleep: { actualAt: '01:10', crossesMidnight: true, recordedAt: 0 } });
  const h = toSleepHandoff(record, settings)!;
  assert.equal(h.date, '2026-08-21');
  assert.equal(h.bedAt, '+1 01:10');
  assert.equal(h.targetAt, '+1 01:30');
  assert.equal(h.metTarget, true);
  assert.equal(h.source, 'henkaku-note');
  assert.equal(toSleepHandoff(day({ shift: 'work' }), settings), null);
});
