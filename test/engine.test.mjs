import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retrievability, forgettingRisk } from '../src/lib/forgetting.js';
import { itemDifficulty, hardestItems, attemptsByQuestion } from '../src/lib/difficulty.js';
import { weakTagClusters, questionsForWeakTags } from '../src/lib/weakClusters.js';
import { relatedQuestions } from '../src/lib/related.js';
import { buildGlossary, lookupGlossary } from '../src/lib/glossary.js';
import { canonical, variantsOf, expandQuery } from '../src/lib/synonyms.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_000_000_000_000;

// ---- #6 忘却予測 ----
test('retrievability: 復習直後は高く、間隔経過で下がる', () => {
  const fresh = { seen: 3, interval: 10, due: NOW + 10 * DAY }; // 直後（lastReviewed=NOW）
  const stale = { seen: 3, interval: 10, due: NOW - 5 * DAY };  // 期限を大きく超過
  const rF = retrievability(fresh, NOW);
  const rS = retrievability(stale, NOW);
  assert.ok(rF > 0.9, `直後は高保持 (${rF})`);
  assert.ok(rS < rF, '経過が長い方が保持率が低い');
});

test('retrievability: 未学習・間隔0は対象外(null)', () => {
  assert.equal(retrievability({ seen: 0, interval: 0 }, NOW), null);
  assert.equal(retrievability(undefined, NOW), null);
});

test('forgettingRisk: 期限超過の問題を高リスクで返す', () => {
  const qs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const srs = {
    a: { seen: 2, interval: 10, due: NOW + 9 * DAY }, // 低リスク
    b: { seen: 2, interval: 10, due: NOW - 10 * DAY }, // 高リスク
    c: { seen: 0, interval: 0 }, // 対象外
  };
  const risk = forgettingRisk(qs, srs, { now: NOW, threshold: 0.3 });
  assert.equal(risk[0].id, 'b', '最もリスクが高いのは b');
  assert.ok(!risk.find((r) => r.id === 'c'), 'c は対象外');
});

// ---- #8 難易度推定 ----
test('itemDifficulty: 誤答率が高いほど難易度が高い', () => {
  const hist = [
    { questionId: 'x', correct: false }, { questionId: 'x', correct: false }, { questionId: 'x', correct: true },
    { questionId: 'y', correct: true }, { questionId: 'y', correct: true },
  ];
  const d = itemDifficulty(hist);
  assert.ok(d.get('x').difficulty > d.get('y').difficulty);
  assert.equal(attemptsByQuestion(hist).get('x').attempts, 3);
});

test('hardestItems: minAttempts でフィルタし難しい順', () => {
  const hist = [
    { questionId: 'x', correct: false }, { questionId: 'x', correct: false },
    { questionId: 'z', correct: false }, // 1回だけ→除外
  ];
  const qs = [{ id: 'x', question: 'X' }, { id: 'z', question: 'Z' }];
  const hard = hardestItems(hist, qs, { minAttempts: 2 });
  assert.equal(hard.length, 1);
  assert.equal(hard[0].id, 'x');
});

// ---- #7 弱点クラスタリング ----
test('weakTagClusters: 誤答の多いタグを上位に', () => {
  const qs = [
    { id: 'a', tags: ['経穴', '肺経'] },
    { id: 'b', tags: ['経穴', '大腸経'] },
    { id: 'c', tags: ['解剖'] },
  ];
  const hist = [
    { questionId: 'a', correct: false }, { questionId: 'b', correct: false }, { questionId: 'c', correct: true },
  ];
  const rows = weakTagClusters(hist, qs, {});
  assert.equal(rows[0].tag, '経穴');
  assert.equal(rows[0].wrong, 2);
  const pool = questionsForWeakTags(rows, qs, {});
  assert.ok(pool.find((q) => q.id === 'a'));
});

// ---- #13 関連問題 ----
test('relatedQuestions: 共有タグが多い順', () => {
  const target = { id: 't', subject: 'S', tags: ['心不全', '利尿薬', '浮腫'] };
  const qs = [
    target,
    { id: 'p', subject: 'S', tags: ['心不全', '利尿薬'] }, // 共有2
    { id: 'q', subject: 'S', tags: ['浮腫'] },             // 共有1
    { id: 'r', subject: 'S', tags: ['骨折'] },             // 共有0
  ];
  const rel = relatedQuestions(target, qs, {});
  assert.equal(rel[0].id, 'p');
  assert.equal(rel[0].shared, 2);
  assert.ok(!rel.find((x) => x.id === 'r'));
  assert.ok(!rel.find((x) => x.id === 't'), '自分自身は除外');
});

// ---- #14 用語集 ----
test('buildGlossary: タグごとに定義サンプルと件数', () => {
  const qs = [
    { id: 'a', subject: 'S', tags: ['偽痛風'], explanation: '偽痛風はピロリン酸カルシウムが原因。膝に好発。' },
    { id: 'b', subject: 'S', tags: ['偽痛風'], explanation: '別解説。' },
  ];
  const g = buildGlossary(qs, {});
  const e = g.find((x) => x.term === '偽痛風');
  assert.equal(e.count, 2);
  assert.ok(e.sample.startsWith('偽痛風はピロリン酸カルシウムが原因。'));
  assert.equal(lookupGlossary(g, '偽痛').length, 1);
});

// ---- #12 同義語辞書 ----
test('synonyms: 変種→正式名称、展開', () => {
  assert.equal(canonical('頚部'), '頸部');
  assert.equal(canonical('ACL'), '前十字靱帯');
  assert.equal(canonical('未知語'), '未知語');
  assert.ok(variantsOf('前十字靱帯').includes('ACL'));
  assert.deepEqual([...new Set(expandQuery('頸部'))].sort(), ['けい部', '頚部', '頸部'].sort());
});
