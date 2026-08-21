import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_HABIT_SEEDS, buildDefaultHabits, makeCustomHabit, validateHabit, activeHabits,
  sortHabits, completionRate, habitsForDate, toneFor, WEEKLY_REVIEW_HABIT_ID,
} from '../src/lib/habits.js';
import type { DayRecord, Habit } from '../src/types/index.js';

const AT = new Date(2026, 7, 1).getTime();

function day(over: Partial<DayRecord> = {}): DayRecord {
  return { date: '2026-08-21', checked: [], declaration: '', note: '', shift: null, shiftEndsAt: null, sleep: null, updatedAt: 0, ...over };
}

test('ゴーストモードの7ステップが初期値として入っている', () => {
  const habits = buildDefaultHabits(AT);
  assert.equal(habits.length, 7);
  assert.deepEqual(habits.map((h) => h.step), [1, 2, 3, 4, 5, 6, 7]);
  for (const h of habits) {
    assert.ok(h.title, 'タイトルが必要');
    assert.ok(h.reading, '読みが必要');
    assert.ok(h.criterion, '達成の判断基準が必要');
    assert.equal(h.archivedAt, null);
  }
});

test('ステップ⑤は原典の「夜11時就寝」ではなくシフト対応版になっている', () => {
  const step5 = DEFAULT_HABIT_SEEDS.find((h) => h.step === 5)!;
  assert.equal(step5.title.includes('11時'), false);
  assert.match(step5.title, /シフト/);
  assert.match(step5.criterion, /就寝目標時刻/);
  assert.match(String(step5.note), /終業から/);
});

test('週次振り返りの習慣idが weekly 側と一致している', () => {
  assert.ok(DEFAULT_HABIT_SEEDS.some((h) => h.id === WEEKLY_REVIEW_HABIT_ID));
});

test('見出しは重複させない・漢字には読みが要る', () => {
  const habits = buildDefaultHabits(AT);
  assert.equal(validateHabit({ id: 'new', title: '', reading: '' }).ok, false);
  assert.ok(validateHabit({ id: 'new', title: '報酬', reading: '' }).errors.some((e) => e.includes('読み')));
  assert.ok(validateHabit({ id: 'new', title: '報酬', reading: 'ほうしゅう' }, habits).errors.some((e) => e.includes('同じ名前')));
  assert.ok(validateHabit({ id: 'new', title: '散歩', reading: 'サンポ' }).errors.some((e) => e.includes('ひらがな')));
  assert.equal(validateHabit({ id: 'new', title: 'ストレッチ', reading: '' }).ok, true); // 漢字なしなら読みは任意
  // 自分自身とは重複しない
  assert.equal(validateHabit({ id: 'step6-reward', title: '報酬', reading: 'ほうしゅう' }, habits).ok, true);
});

test('寝かせた習慣は名前の重複チェックから外れる', () => {
  const habits = buildDefaultHabits(AT).map((h) => (h.id === 'step6-reward' ? { ...h, archivedAt: AT } : h));
  assert.equal(validateHabit({ id: 'new', title: '報酬', reading: 'ほうしゅう' }, habits).ok, true);
  assert.equal(activeHabits(habits).length, 6);
});

test('並び順は①〜⑦が先、カスタムは読みの五十音', () => {
  const habits = [
    makeCustomHabit({ title: 'さんぽ' }, AT, 1),
    ...buildDefaultHabits(AT),
    makeCustomHabit({ title: 'あさひ' }, AT, 2),
  ];
  const sorted = sortHabits(habits);
  assert.deepEqual(sorted.slice(0, 7).map((h) => h.step), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(sorted.slice(7).map((h) => h.title), ['あさひ', 'さんぽ']);
});

test('カスタム習慣は上限で切り詰める', () => {
  const h = makeCustomHabit({ title: 'あ'.repeat(50), criterion: 'い'.repeat(300) }, AT, 3);
  assert.equal(h.step, null);
  assert.equal(h.title.length, 24);
  assert.equal(h.criterion.length, 120);
});

test('達成率は「その日に有効だった習慣」を分母にする', () => {
  const habits = buildDefaultHabits(AT);
  assert.equal(completionRate(day({ checked: [] }), habits), 0);
  assert.equal(completionRate(day({ checked: habits.map((h) => h.id) }), habits), 1);
  assert.equal(Math.round(completionRate(day({ checked: [habits[0].id] }), habits) * 100), 14);
});

test('あとから習慣を足しても、過去の達成率は下がらない', () => {
  const habits = buildDefaultHabits(AT);
  const record = day({ date: '2026-08-10', checked: habits.map((h) => h.id) });
  assert.equal(completionRate(record, habits), 1);
  // 8/20 に作った新しい習慣は、8/10 の分母に入らない
  const later: Habit = makeCustomHabit({ title: 'あたらしい' }, new Date(2026, 7, 20).getTime(), 9);
  assert.equal(completionRate(record, [...habits, later]), 1);
  // 逆に、新しい習慣ができた後の日には入る
  const after = day({ date: '2026-08-25', checked: habits.map((h) => h.id) });
  assert.ok(completionRate(after, [...habits, later]) < 1);
});

test('寝かせた日より後の記録では、その習慣は分母から外れる', () => {
  const habits = buildDefaultHabits(AT);
  const archived = habits.map((h) => (h.step === 1 ? { ...h, archivedAt: new Date(2026, 7, 15).getTime() } : h));
  assert.equal(habitsForDate(archived, '2026-08-10').length, 7);
  assert.equal(habitsForDate(archived, '2026-08-20').length, 6);
});

test('カレンダーの色は「記録があるか」で最低限の明るさを持つ', () => {
  assert.equal(toneFor(0, false), 0);       // 記録なし＝夜のまま
  assert.ok(toneFor(0, true) > 0);          // 記録はした（0達成でも変化は見える）
  assert.ok(toneFor(1, true) > toneFor(0.5, true));
  assert.ok(toneFor(1, true) <= 1);
  assert.equal(toneFor(5, true), toneFor(1, true)); // 範囲外は丸める
});
