import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/lib/convert.js';

const good = {
  subject: '宅建業法',
  type: 'choice',
  question: '宅地建物取引業者の免許について正しいものはどれか。',
  choices: ['ア', 'イ', 'ウ', 'エ'],
  answer: 1,
  explanation: '免許の有効期間と更新の手続きについての基本的な内容。',
};

test('プロンプトに「守ること」がすべて入る', () => {
  const p = C.buildConvertPrompt({ examId: 'takken', subject: '宅建業法', format: 'choice' });
  for (const rule of C.FIXED_PROMPT_RULES) {
    assert.ok(p.includes(rule), `決まりが抜けています：${rule.slice(0, 20)}`);
  }
});

// このプロンプトで一番危ない事故（もっともらしいURLの捏造）を必ず止める。
test('URLを推測で書かせない指示が必ず入る', () => {
  const p = C.buildConvertPrompt({ subject: 'x' });
  assert.match(p, /URLや出典を推測で書かない/);
  assert.match(p, /未確認（要出典）/);
  assert.match(p, /※要確認/);
});

test('答えは0から数えると必ず書く（取り違えがいちばん多い）', () => {
  const p = C.buildConvertPrompt({ subject: 'x' });
  assert.match(p, /0から数える/);
});

test('選んだ角度だけがプロンプトに出る', () => {
  const p = C.buildConvertPrompt({ subject: 'x', angles: ['core', 'check'] });
  assert.ok(p.includes('A 核心'));
  assert.ok(p.includes('D 確認'));
  assert.equal(p.includes('C 鑑別'), false, '選んでいない角度が出ています');
});

test('出題形式ごとに既定の角度がある', () => {
  for (const format of Object.keys(C.DEFAULT_ANGLES_BY_FORMAT)) {
    const ids = C.DEFAULT_ANGLES_BY_FORMAT[format];
    assert.ok(ids.length > 0, `${format} の既定が空です`);
    for (const id of ids) assert.ok(C.ANGLE_MAP[id], `${format} の既定に未定義の角度：${id}`);
  }
});

test('角度に読み（ひらがな）がある（目次に出るため）', () => {
  for (const a of C.ANGLES) assert.match(a.reading, /^[ぁ-んー・]+$/, `${a.label} の読み：${a.reading}`);
});

test('選択肢の数を変えると見本も変わる', () => {
  const p5 = C.buildConvertPrompt({ subject: 'x', choiceCount: 5 });
  assert.ok(p5.includes('"選択肢5"'));
  assert.ok(p5.includes('choice なら5個'));
});

test('1始まりで書かれた answer を見つけて理由を出す', () => {
  const errs = C.validateQuestion({ ...good, answer: 4 });
  assert.equal(errs.length, 1);
  assert.match(errs[0], /1から数えていませんか/);
});

test('形の検査（○×は2択・空の項目を通さない）', () => {
  assert.deepEqual(C.validateQuestion(good), []);
  assert.ok(C.validateQuestion({ ...good, type: 'ox' }).some((e) => /○×なのに選択肢が4個/.test(e)));
  assert.ok(C.validateQuestion({ ...good, explanation: '' }).some((e) => /explanation が空/.test(e)));
  assert.ok(C.validateQuestion({ ...good, question: '  ' }).some((e) => /question が空/.test(e)));
  assert.ok(C.validateQuestion({ ...good, choices: ['ア', ''] }).some((e) => /空の選択肢/.test(e)));
  assert.ok(C.validateQuestion({ ...good, type: 'なにか' }).some((e) => /type が/.test(e)));
  assert.ok(C.validateQuestion(null).length > 0);
});

test('コードブロックごと貼っても読める', () => {
  const text = '説明の文\n```json\n' + JSON.stringify([good]) + '\n```\nおしまい';
  const r = C.parseImported(text);
  assert.equal(r.ok, true);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].subject, '宅建業法');
});

test('1件だけのオブジェクトでも読める', () => {
  assert.equal(C.parseImported(JSON.stringify(good)).items.length, 1);
});

// 全部を捨てると、どこが悪かったのか分からないまま終わる。
test('形が合わないものがあっても、通った問題は取り込む', () => {
  const r = C.parseImported(JSON.stringify([good, { ...good, answer: 9 }, { ...good, question: 'ほかの問題' }]));
  assert.equal(r.items.length, 2);
  assert.equal(r.skipped, 1);
  assert.equal(r.errors.length, 1);
});

test('JSON として読めない時は理由を出す', () => {
  const r = C.parseImported('これはJSONではありません');
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /JSON として読めません/);
  assert.equal(C.parseImported('').errors[0], '何も貼られていません');
});

test('長すぎる貼り付けは断る', () => {
  const r = C.parseImported('x'.repeat(C.MAX_IMPORT_CHARS + 1));
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /長すぎます/);
});

test('重複は問題文の揺れを吸収して見つける', () => {
  assert.equal(C.normalizeText('ＡＢＣ　１２３'), 'abc123');
  const a = C.makeQuestion(good);
  const b = C.makeQuestion({ ...good, question: '宅地建物取引業者の免許について、正しいものはどれか。 ' });
  const { fresh, duplicates } = C.dedupeAgainst([a], [b]);
  assert.equal(fresh.length, 0);
  assert.equal(duplicates.length, 1);
});

test('取り込む中に同じ問題文が2つあれば、後の方を落とす', () => {
  const a = C.makeQuestion(good);
  const b = C.makeQuestion(good);
  const { fresh, duplicates } = C.dedupeAgainst([], [a, b]);
  assert.equal(fresh.length, 1);
  assert.equal(duplicates.length, 1);
});

test('id は毎回ちがう', () => {
  const ids = new Set(Array.from({ length: 50 }, () => C.makeQuestion(good).id));
  assert.equal(ids.size, 50);
});

test('取り込みの文脈（試験・科目）が引き継がれる', () => {
  const q = C.makeQuestion({ ...good, subject: undefined }, { examId: 'takken', subject: '権利関係', round: '第30回' });
  assert.equal(q.examId, 'takken');
  assert.equal(q.subject, '権利関係');
  assert.equal(q.round, '第30回');
});

// 合否を出す道具にしない（見る場所を指すだけ）。
test('取り込み後のチェックは件数を出すだけで、合否を出さない', () => {
  const items = [C.makeQuestion({ ...good, needsCheck: true, tags: [] })];
  const rows = C.reviewChecklist(items);
  assert.equal(rows.find((r) => r.id === 'needsCheck').count, 1);
  assert.equal(rows.find((r) => r.id === 'noTags').count, 1);
  for (const r of rows) {
    assert.equal(typeof r.count, 'number');
    assert.equal(/合格|不合格/.test(r.label + r.note), false);
  }
});

test('著作権の注意が用意されている', () => {
  assert.ok(C.COPYRIGHT_NOTE.length >= 2);
  assert.ok(C.COPYRIGHT_NOTE.join('').includes('公開'));
});
