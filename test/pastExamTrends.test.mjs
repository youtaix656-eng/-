import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pastExamQuestions,
  overview,
  subjectBreakdown,
  genreFrequency,
  tagFrequency,
  subjectPriority,
} from '../src/lib/pastExamTrends.js';

function q(over) {
  return { id: over.id, subject: '関係法規', genre: 'あはき法｜免許', tags: ['あはき法'], ...over };
}

test('pastExamQuestions: round が設定されている問題だけを対象にする', () => {
  const qs = [q({ id: 'a', round: '第34回' }), q({ id: 'b', round: 34 }), q({ id: 'c' })];
  assert.deepEqual(pastExamQuestions(qs).map((x) => x.id), ['a', 'b']);
});

test('overview: 総数・科目数・回の一覧', () => {
  const qs = [
    q({ id: 'a', round: '第34回', subject: '関係法規' }),
    q({ id: 'b', round: 33, subject: '解剖学', genre: '骨格系｜上肢' }),
    q({ id: 'c' }), // roundなしは除外
  ];
  const o = overview(qs);
  assert.equal(o.total, 2);
  assert.equal(o.subjectCount, 2);
  assert.deepEqual(o.rounds, ['34', '33']);
});

test('subjectBreakdown: 科目別の件数を多い順に返す', () => {
  const qs = [
    q({ id: 'a', round: 34, subject: '関係法規' }),
    q({ id: 'b', round: 33, subject: '関係法規' }),
    q({ id: 'c', round: 34, subject: '解剖学' }),
  ];
  const rows = subjectBreakdown(qs);
  assert.deepEqual(rows[0], { subject: '関係法規', count: 2 });
  assert.deepEqual(rows[1], { subject: '解剖学', count: 1 });
});

test('genreFrequency: 複数回にまたがるジャンルほど上位（roundCount優先）', () => {
  const qs = [
    q({ id: 'a', round: 34, genre: 'G1' }),
    q({ id: 'b', round: 33, genre: 'G1' }),
    q({ id: 'c', round: 34, genre: 'G2' }),
    q({ id: 'd', round: 34, genre: 'G2' }),
    q({ id: 'e', round: 34, genre: 'G2' }),
  ];
  const rows = genreFrequency(qs);
  // G1は2回にまたがる(roundCount=2)のでcountはG2(3件・1回)より少なくても上位
  assert.equal(rows[0].genre, 'G1');
  assert.equal(rows[0].roundCount, 2);
  assert.equal(rows[1].genre, 'G2');
  assert.equal(rows[1].roundCount, 1);
});

test('tagFrequency: タグの頻度を回数優先で集計する', () => {
  const qs = [
    q({ id: 'a', round: 34, tags: ['免許'] }),
    q({ id: 'b', round: 33, tags: ['免許'] }),
    q({ id: 'c', round: 34, tags: ['罰則'] }),
  ];
  const rows = tagFrequency(qs, {});
  assert.equal(rows[0].tag, '免許');
  assert.equal(rows[0].roundCount, 2);
});

test('subjectPriority: 複数回出ているジャンルが2件以上ある科目を優先度順で返す', () => {
  const qs = [
    q({ id: 'a', round: 34, subject: 'S1', genre: 'A' }),
    q({ id: 'b', round: 33, subject: 'S1', genre: 'A' }),
    q({ id: 'c', round: 34, subject: 'S1', genre: 'B' }),
    q({ id: 'd', round: 33, subject: 'S1', genre: 'B' }),
    q({ id: 'e', round: 34, subject: 'S2', genre: 'C' }),
  ];
  const rows = subjectPriority(qs);
  assert.equal(rows[0].subject, 'S1');
  assert.equal(rows[0].repeatedGenreCount, 2);
});
