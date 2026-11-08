import test from 'node:test';
import assert from 'node:assert/strict';
import { pickTopResumeCandidate } from '../src/lib/resumeHub.js';

const questions = [
  { id: 'q1', genre: '骨格系', tags: ['骨'] },
  { id: 'q2', genre: '循環器系', tags: ['血管'] },
];

test('戻り値null: 何も保存されていない時は候補が無い', () => {
  assert.equal(pickTopResumeCandidate({ questions }), null);
});

test('session: 完了済み（pos>=target）は対象外', () => {
  const session = { ids: ['q1', 'q2'], pos: 2, target: 2, startedAt: 100 };
  assert.equal(pickTopResumeCandidate({ session, questions }), null);
});

test('session: 残り問題数とジャンル・キーワードを次の問題から出す', () => {
  const session = { ids: ['q1', 'q2'], pos: 0, target: 2, startedAt: 100 };
  const c = pickTopResumeCandidate({ session, questions });
  assert.equal(c.key, 'session');
  assert.equal(c.remaining, 2);
  assert.equal(c.genre, '骨格系');
  assert.equal(c.keyword, '骨');
});

test('quiz: idxが進んだ分だけ残りが減る', () => {
  const quizProgress = { ids: ['q1', 'q2'], idx: 1, at: 200 };
  const c = pickTopResumeCandidate({ quizProgress, questions });
  assert.equal(c.key, 'quiz');
  assert.equal(c.remaining, 1);
  assert.equal(c.genre, '循環器系');
});

test('quiz: 全問解答済み（idx>=ids.length）は対象外', () => {
  const quizProgress = { ids: ['q1'], idx: 1, at: 200 };
  assert.equal(pickTopResumeCandidate({ quizProgress, questions }), null);
});

test('exam: 午前+午後 通しの午後フェーズは午前ぶんを残り計算に加える', () => {
  const examProgress = {
    ids: ['q1', 'q2'], idx: 0, at: 300,
    fullPhase: 'pm', amSnapshot: { order: [{ id: 'a' }, { id: 'b' }] },
  };
  const c = pickTopResumeCandidate({ examProgress, questions });
  assert.equal(c.key, 'exam');
  // len=2+2=4, idx=0+2=2, remaining=2
  assert.equal(c.remaining, 2);
});

test('review: 残り件数とジャンルを次の問題から出す', () => {
  const reviewProgress = { ids: ['q2'], idx: 0, at: 400 };
  const c = pickTopResumeCandidate({ reviewProgress, questions });
  assert.equal(c.key, 'review');
  assert.equal(c.remaining, 1);
  assert.equal(c.genre, '循環器系');
});

test('audio: totalが無ければ対象外（音声の進捗は読み込み直後に記録されるため古いデータへの備え）', () => {
  const audioProgress = { index: 2, at: 500 };
  assert.equal(pickTopResumeCandidate({ audioProgress }), null);
});

test('audio: 選んでいた科目・ジャンル・キーワードをそのまま返す', () => {
  const audioProgress = { index: 2, total: 10, at: 500, subject: '解剖学', genre: '骨格系', keyword: '骨' };
  const c = pickTopResumeCandidate({ audioProgress });
  assert.equal(c.key, 'audio');
  assert.equal(c.remaining, 8);
  assert.equal(c.genre, '骨格系');
  assert.equal(c.keyword, '骨');
});

test('複数候補がある時は最も新しい（atが大きい）ものだけを返す', () => {
  const session = { ids: ['q1'], pos: 0, target: 1, startedAt: 100 };
  const quizProgress = { ids: ['q2'], idx: 0, at: 999 };
  const c = pickTopResumeCandidate({ session, quizProgress, questions });
  assert.equal(c.key, 'quiz');
});

test('ジャンル・キーワードが無ければnullのまま返す（呼び出し側で「なし」表示）', () => {
  const quizProgress = { ids: ['unknown-id'], idx: 0, at: 200 };
  const c = pickTopResumeCandidate({ quizProgress, questions });
  assert.equal(c.genre, null);
  assert.equal(c.keyword, null);
});
