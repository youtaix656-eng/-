import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan } from '../src/lib/plan.js';
import { specMarkdown, screensFor, skippedScreens, doneWhen, SCREEN_RULES, OUT_OF_SCOPE } from '../src/lib/spec.js';
import { COGNITIVE_QUESTIONS } from '../src/data/cognitiveQuestions.js';
import { makeQuestion } from '../src/lib/convert.js';

const stateWith = (patch = {}) => ({
  settings: { examId: 'takken', examDate: '2099-10-18', weekdayMin: 60, weekendMin: 180, chosenMethods: ['retrieval'], ...(patch.settings || {}) },
  cognitive: patch.cognitive || {},
  questions: patch.questions || [],
  myExams: [],
  notes: '',
});

test('必ず作る画面（ホーム・一問一答・設定）は、何も選んでいなくても入る', () => {
  const plan = buildPlan(stateWith({ settings: { chosenMethods: [] } }));
  const ids = screensFor(plan).map((s) => s.id);
  for (const id of ['home', 'quiz', 'settings']) assert.ok(ids.includes(id), `${id} が入っていません`);
});

// これがこのファイルの芯。全部入りの設計書を渡すと、どれも中途半端になる。
test('選んでいない勉強法の画面を設計書に書かない', () => {
  const plan = buildPlan(stateWith({ settings: { chosenMethods: ['retrieval'] } }));
  const ids = screensFor(plan).map((s) => s.id);
  assert.equal(ids.includes('audio'), false, '音声学習を選んでいないのに入っています');
  assert.equal(ids.includes('mixed'), false, '交互練習を選んでいないのに入っています');
  assert.equal(ids.includes('planner'), false);
  assert.equal(ids.includes('timer'), false);

  const md = specMarkdown(plan, stateWith({ settings: { chosenMethods: ['retrieval'] } }));
  assert.equal(md.includes('| **音声学習**'), false, '設計書の表に出ています');
});

test('勉強法を選ぶと、その画面が入る', () => {
  const plan = buildPlan(stateWith({ settings: { chosenMethods: ['retrieval', 'audio', 'interleave', 'pomodoro', 'buffer'] } }));
  const ids = screensFor(plan).map((s) => s.id);
  for (const id of ['audio', 'mixed', 'timer', 'planner']) assert.ok(ids.includes(id), `${id} が入っていません`);
});

test('認知特性の入り口からも画面が決まる', () => {
  const cognitive = Object.fromEntries(COGNITIVE_QUESTIONS.map((q) => [q.id, q.key === 'visual' ? 3 : 0]));
  const plan = buildPlan(stateWith({ settings: { chosenMethods: ['retrieval'] }, cognitive }));
  const cards = screensFor(plan).find((s) => s.id === 'cards');
  assert.ok(cards, '視覚寄りなのにカード・図の画面が入っていません');
  assert.match(cards.why, /入り口/);
});

test('試験の性格からも画面が決まる（宅建は法令・数値が動くので見直しの画面が入る）', () => {
  const plan = buildPlan(stateWith());
  const ids = screensFor(plan).map((s) => s.id);
  assert.ok(ids.includes('freshness'));
  assert.ok(ids.includes('mock'), '時間が足りなくなりやすい試験なので模試が入るはず');
});

test('作る画面と作らない画面で、全部の画面を言い切っている', () => {
  const plan = buildPlan(stateWith());
  const kept = screensFor(plan).map((s) => s.id);
  const skipped = skippedScreens(plan).map((s) => s.id);
  assert.equal(new Set([...kept, ...skipped]).size, SCREEN_RULES.length);
  assert.equal(kept.filter((id) => skipped.includes(id)).length, 0, '同じ画面が両方に出ています');
});

// 画面に出す文に id をそのまま出さない（「spacing」と書かれても意味が分からない）。
test('「なぜ要るか」に英語の id をそのまま出さない', () => {
  const plan = buildPlan(stateWith({ settings: { chosenMethods: ['retrieval', 'spacing', 'audio', 'timedmock', 'interleave'] } }));
  for (const s of screensFor(plan)) {
    assert.equal(/「[a-z]+」/.test(s.why), false, `id がそのまま出ています：${s.why}`);
  }
});

test('画面ごとに「なぜ要るか」が付く', () => {
  for (const s of screensFor(buildPlan(stateWith()))) {
    assert.ok(s.why && s.why.length > 0, `${s.title} に理由がありません`);
    assert.ok(s.desc && s.desc.length > 0, `${s.title} に中身がありません`);
  }
});

test('完成条件は必ず入り、読み取れる形（数えられる・押せる）で書く', () => {
  const list = doneWhen(buildPlan(stateWith()));
  assert.ok(list.length >= 5);
  assert.ok(list.some((d) => /npm run build/.test(d)));
  assert.ok(list.some((d) => /node --test/.test(d)));
  // 「よくできている」のような読み取れない条件を置かない
  for (const d of list) assert.equal(/よく|きれい|使いやすい/.test(d), false, `読み取れない完成条件：${d}`);
});

test('問題を入れていれば、その件数が完成条件に入る', () => {
  const questions = [makeQuestion({ type: 'choice', question: 'a', choices: ['1', '2'], answer: 0, explanation: 'x' })];
  const list = doneWhen(buildPlan(stateWith({ questions })));
  assert.ok(list.some((d) => /1 問がすべて/.test(d)));
});

test('設計書に「作らないもの」と「完成条件」が入る', () => {
  const md = specMarkdown(buildPlan(stateWith()), stateWith());
  assert.match(md, /## 6\. 作らないもの/);
  assert.match(md, /## 9\. これで完成（完成条件）/);
  for (const o of OUT_OF_SCOPE) assert.ok(md.includes(o), `作らないものが抜けています：${o.slice(0, 15)}`);
});

// 設計書に何百問も貼ると、読ませる量が跳ね上がって肝心の設計が薄まる。
test('問題データを設計書の本文に貼らない', () => {
  const questions = Array.from({ length: 30 }, (_, i) =>
    makeQuestion({ type: 'choice', question: `これは${i}問目の問題文です`, choices: ['1', '2'], answer: 0, explanation: 'x' }),
  );
  const st = stateWith({ questions });
  const md = specMarkdown(buildPlan(st), st);
  assert.equal(md.includes('これは5問目の問題文です'), false, '設計書に問題文が貼られています');
  assert.match(md, /questions\.json/);
  assert.match(md, /設計書には貼りません/);
});

test('設計書の付録に計画書が丸ごと入る（設計の根拠を一緒に渡す）', () => {
  const md = specMarkdown(buildPlan(stateWith()), stateWith());
  assert.match(md, /## 付録：もとになった学習計画書/);
  assert.match(md, /# 学習計画書：宅地建物取引士/);
});

test('技術の決まりに、踏みやすい落とし穴が書いてある', () => {
  const md = specMarkdown(buildPlan(stateWith()), stateWith());
  assert.match(md, /toISOString/); // UTCに直って前日になる
  assert.match(md, /lookbehind/); // 古い Safari で画面が丸ごと出なくなる
  assert.match(md, /0から数える/); // answer の取り違え
  assert.match(md, /ネットワークに触れない/);
});

test('認知特性が未回答なら、設計書にも「未回答」と書く', () => {
  const md = specMarkdown(buildPlan(stateWith()), stateWith());
  assert.match(md, /認知特性（自己申告・診断ではありません）：未回答/);
});

test('試験が未選択でも設計書は落ちずに作れる', () => {
  const empty = { settings: {}, cognitive: {}, questions: [], myExams: [] };
  const md = specMarkdown(buildPlan(empty), empty);
  assert.ok(md.length > 500);
});

test('合否の予測を出させない指示が入る', () => {
  const md = specMarkdown(buildPlan(stateWith()), stateWith());
  assert.match(md, /合否の予測/);
});
