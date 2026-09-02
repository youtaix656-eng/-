import test from 'node:test';
import assert from 'node:assert/strict';
import { priorityTodo, thinSubjectsText, requestTemplate, suggestThinSubjectReminder } from '../src/lib/coveragePriority.js';

function row(name, total, thinThreshold, groups) {
  return { name, total, thinThreshold, groups: groups || [] };
}

test('priorityTodo: 未収録科目は最優先候補に含まれる', () => {
  const rows = [row('未収録科目', 0, 20, [])];
  const items = priorityTodo(rows, []);
  assert.equal(items[0].subject, '未収録科目');
  assert.equal(items[0].reason, '未収録');
});

test('priorityTodo: しきい値以上の大項目は対象外', () => {
  const rows = [row('科目A', 50, 20, [{ name: '大項目1', count: 25 }])];
  const items = priorityTodo(rows, []);
  assert.equal(items.length, 0);
});

test('priorityTodo: 手薄な大項目はスコア付きで返る', () => {
  const rows = [row('科目A', 5, 20, [{ name: '大項目1', count: 5 }])];
  const items = priorityTodo(rows, []);
  assert.equal(items.length, 1);
  assert.equal(items[0].daikoumoku, '大項目1');
  assert.ok(items[0].score > 0);
});

test('thinSubjectsText: 手薄科目の内訳をテキスト化する', () => {
  const rows = [
    row('科目A', 5, 20, [{ name: '大項目1', count: 5 }]),
    row('科目B', 50, 20, [{ name: '大項目2', count: 50 }]),
  ];
  const text = thinSubjectsText(rows);
  assert.match(text, /科目A/);
  assert.match(text, /大項目1：5問/);
  assert.ok(!text.includes('科目B'));
});

test('requestTemplate: 科目名を差し込んだ定型文を返す', () => {
  assert.match(requestTemplate('関係法規'), /関係法規/);
});

test('suggestThinSubjectReminder: 手薄科目から日替わりで1件選ぶ', () => {
  const rows = [row('科目A', 5, 20), row('科目B', 50, 20)];
  const d = new Date('2026-09-02T00:00:00Z');
  const s = suggestThinSubjectReminder(rows, d);
  assert.equal(s.name, '科目A'); // 手薄なのは科目Aだけ
});

test('suggestThinSubjectReminder: 手薄科目が無ければnull', () => {
  const rows = [row('科目A', 50, 20)];
  assert.equal(suggestThinSubjectReminder(rows), null);
});
