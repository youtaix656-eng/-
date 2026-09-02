import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, planGaps, planMarkdown, weeklyShape } from '../src/lib/plan.js';
import { METHODS, suggestMethods, EFFECT_LEVELS } from '../src/data/methods.js';
import { COGNITIVE_QUESTIONS } from '../src/data/cognitiveQuestions.js';

const base = {
  settings: { examId: 'takken', examDate: '2099-10-18', weekdayMin: 60, weekendMin: 180, chosenMethods: [] },
  cognitive: {},
  questions: [],
  myExams: [],
  notes: '',
};

test('勉強法にはすべて出典がある（効果を言うなら根拠を出す）', () => {
  for (const m of METHODS) {
    assert.ok(m.source, `${m.title} に出典がありません`);
    assert.ok(EFFECT_LEVELS[m.effect], `${m.title} の効果の区分：${m.effect}`);
    assert.ok(m.reading, `${m.title} に読みがありません`);
    assert.ok(m.how.length > 0, `${m.title} にやり方がありません`);
  }
});

// 「効果が高い」と言い切れないものを、言い切ったまま置かないための見張り。
// 書き方は「※要確認（…）」でも「（※効果の比較研究は確認していません）」でもよい。
test('比較研究の裏づけが無いものは、確認していないと書いてある', () => {
  for (const m of METHODS.filter((x) => x.effect === 'unrated')) {
    assert.match(m.source, /※[^）]*確認/, `${m.title} の出典に「確認していない」と書かれていません：${m.source}`);
  }
});

test('効果が低いとされる方法も消さずに残してある', () => {
  const low = METHODS.filter((m) => m.effect === 'low');
  assert.ok(low.length >= 3, 'よく使われる方法（読み返す・マーカー・まとめノート）を残すこと');
  for (const m of low) assert.ok(m.how.length > 0, `${m.title} に置き換え先が書かれていません`);
});

test('提案に効果が低いものを混ぜない', () => {
  const ids = suggestMethods(['memory'], null, null).map((m) => m.id);
  for (const m of METHODS.filter((x) => x.effect === 'low')) {
    assert.equal(ids.includes(m.id), false, `${m.title} が提案に出ています`);
  }
});

test('試験の性格と認知特性で提案の順が変わる', () => {
  const withAudio = suggestMethods(['memory'], 'auditory', null).map((m) => m.id);
  const without = suggestMethods(['memory'], null, null).map((m) => m.id);
  assert.ok(withAudio.indexOf('audio') < without.indexOf('audio'), '入り口を答えても順が変わっていません');
});

test('未回答（null）を渡しても提案は出る', () => {
  assert.ok(suggestMethods([], null, null).length > 0);
});

test('選んでいないときは「仮置き」だと分かる形で返る', () => {
  const plan = buildPlan(base);
  assert.equal(plan.usingSuggested, true);
  assert.ok(plan.methods.length > 0);
  assert.match(planMarkdown(plan, base), /仮に置いています/);

  const chosen = buildPlan({ ...base, settings: { ...base.settings, chosenMethods: ['retrieval'] } });
  assert.equal(chosen.usingSuggested, false);
  assert.deepEqual(chosen.methods.map((m) => m.id), ['retrieval']);
});

test('足りないものを日本語で返す', () => {
  const ids = planGaps(buildPlan({ ...base, settings: { ...base.settings, examId: null, examDate: '' } })).map((g) => g.id);
  assert.ok(ids.includes('exam'));
  assert.ok(ids.includes('date'));
  // 認知特性と勉強法は「無くても進める」印が付く
  const optional = planGaps(buildPlan(base)).filter((g) => g.optional).map((g) => g.id);
  assert.deepEqual(optional.sort(), ['cognitive', 'methods']);
});

// 手元に無い基準を書かない、の見張り。
test('計画書に「合格に必要な時間」を書かない', () => {
  const md = planMarkdown(buildPlan(base), base);
  assert.match(md, /確保できる時間/);
  assert.match(md, /合格に必要な時間ではありません/);
  assert.equal(/合格に必要な時間は約/.test(md), false);
  assert.equal(/合格率/.test(md), false);
});

test('認知特性が未回答なら「未回答」と書く（埋めない）', () => {
  const md = planMarkdown(buildPlan(base), base);
  assert.match(md, /## 5\. 認知特性/);
  assert.match(md, /未回答/);
  assert.match(md, /診断ではありません/);
});

test('認知特性に答えると、その結果が計画書に出る', () => {
  const cognitive = Object.fromEntries(COGNITIVE_QUESTIONS.map((q) => [q.id, q.key === 'auditory' || q.key === 'step' ? 3 : 0]));
  const md = planMarkdown(buildPlan({ ...base, cognitive }), { ...base, cognitive });
  assert.match(md, /音・声で入る/);
  assert.equal(/未回答/.test(md.split('## 6.')[0]), false);
});

test('確かめることが未チェックの箱で出る', () => {
  const md = planMarkdown(buildPlan(base), base);
  assert.match(md, /- \[ \] 今年の試験日/);
  const checked = { ...base, settings: { ...base.settings, checkedPoints: { '今年の試験日・申込期間・申込方法': 1 } } };
  assert.match(planMarkdown(buildPlan(checked), checked), /- \[x\] 今年の試験日/);
});

test('試験が未選択でも計画書は落ちずに作れる', () => {
  const empty = { settings: {}, cognitive: {}, questions: [], myExams: [] };
  const md = planMarkdown(buildPlan(empty), empty);
  assert.ok(md.length > 100);
  assert.match(md, /まだ試験が選ばれていません/);
});

test('1週間の型は、選んだ勉強法によって変わる', () => {
  const withMix = weeklyShape(buildPlan({ ...base, settings: { ...base.settings, chosenMethods: ['interleave'] } }));
  assert.ok(withMix.some((r) => /混ぜて/.test(r.body)));
  const without = weeklyShape(buildPlan({ ...base, settings: { ...base.settings, chosenMethods: ['retrieval'] } }));
  assert.equal(without.some((r) => /混ぜて/.test(r.body)), false);
});

test('自分のメモが計画書の最後に付く', () => {
  const withNotes = { ...base, notes: 'この文が付くこと' };
  assert.match(planMarkdown(buildPlan(withNotes), withNotes), /この文が付くこと/);
});
