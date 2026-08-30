import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeExam, validateExam, missingReadings, upsertExam, removeExam, allExams, resolveExam } from '../src/lib/myExam.js';
import { EXAMS } from '../src/data/exams.js';
import { buildPlan } from '../src/lib/plan.js';
import { screensFor } from '../src/lib/spec.js';

const input = {
  name: '第三種電気主任技術者',
  reading: 'だいさんしゅでんきしゅにんぎじゅつしゃ',
  category: 'technical',
  formats: ['choice'],
  traits: ['calc', 'wide'],
  subjects: [{ name: '理論', reading: 'りろん' }, '機械'],
};

test('自作の試験を作れる', () => {
  const e = makeExam(input);
  assert.equal(e.custom, true);
  assert.deepEqual(validateExam(e), []);
  assert.equal(e.subjects.length, 2);
  assert.deepEqual(e.subjects[1], { name: '機械', reading: '' }); // 文字列だけでも受ける
});

test('語彙に無い trait / format は落とす', () => {
  const e = makeExam({ ...input, traits: ['calc', 'でたらめ'], formats: ['choice', 'なにか'] });
  assert.deepEqual(e.traits, ['calc']);
  assert.deepEqual(e.formats, ['choice']);
});

test('空のまま作らせない', () => {
  assert.ok(validateExam(makeExam({})).includes('試験名を入れてください'));
  assert.ok(validateExam(makeExam({ name: 'a' })).includes('科目を1つ以上入れてください'));
});

// 読みは止める理由にはしないが、入れ忘れは見せる（目次の「その他」に落ちるため）。
test('読みの入れ忘れを見つけるが、保存は止めない', () => {
  const e = makeExam({ ...input, reading: '', subjects: [{ name: '理論' }] });
  assert.deepEqual(missingReadings(e), ['第三種電気主任技術者', '理論']);
  assert.deepEqual(validateExam(e), [], '読みが無いだけで保存を止めていません');
});

test('id が毎回ちがう', () => {
  const ids = new Set(Array.from({ length: 20 }, () => makeExam(input).id));
  assert.equal(ids.size, 20);
});

test('足す・差し替える・消す', () => {
  const a = makeExam(input);
  let list = upsertExam([], a);
  assert.equal(list.length, 1);
  list = upsertExam(list, { ...a, name: '名前を変えた' });
  assert.equal(list.length, 1, '同じ id は差し替える');
  assert.equal(list[0].name, '名前を変えた');
  assert.equal(removeExam(list, a.id).length, 0);
});

test('自作を先に、同梱をあとに並べる', () => {
  const a = makeExam(input);
  const list = allExams([a]);
  assert.equal(list[0].id, a.id);
  assert.equal(list.length, EXAMS.length + 1);
});

// 「同梱の試験と自作の試験を、後ろの仕組みから見て区別しない」の確認。
test('自作の試験でも、計画書と設計書が同じように動く', () => {
  const a = makeExam({ ...input, traits: ['calc', 'speed'] });
  const state = {
    settings: { examId: a.id, examDate: '2099-09-01', weekdayMin: 60, weekendMin: 120, chosenMethods: ['retrieval', 'timedmock'] },
    cognitive: {},
    questions: [],
    myExams: [a],
    notes: '',
  };
  const plan = buildPlan(state);
  assert.equal(plan.exam.name, '第三種電気主任技術者');
  assert.ok(plan.allocation.length === 2, '科目の割り振りが出ていません');
  assert.ok(screensFor(plan).some((s) => s.id === 'mock'), '性格から画面が決まっていません');
});

test('id から引くと、同梱でも自作でも同じ形で返る', () => {
  const a = makeExam(input);
  assert.equal(resolveExam(a.id, [a]).name, a.name);
  assert.equal(resolveExam('takken', [a]).name, '宅地建物取引士');
  assert.equal(resolveExam('ないid', []), null);
  assert.equal(resolveExam(null, []), null);
});
