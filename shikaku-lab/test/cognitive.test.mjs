import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COGNITIVE_QUESTIONS, COGNITIVE_DISCLAIMER, CHANNELS, ORDERS, SCALE } from '../src/data/cognitiveQuestions.js';
import { profileOf, scoreAxis, profileLine, channelOf, orderOf, isUnanswered, TIE_MARGIN } from '../src/lib/cognitive.js';

const answerAll = (fn) => Object.fromEntries(COGNITIVE_QUESTIONS.map((q) => [q.id, fn(q)]));

test('入り口ごとの質問数がそろっている（数が偏ると点も偏る）', () => {
  for (const axis of ['channel', 'order']) {
    const counts = {};
    for (const q of COGNITIVE_QUESTIONS.filter((x) => x.axis === axis)) {
      counts[q.key] = (counts[q.key] || 0) + 1;
    }
    const values = Object.values(counts);
    assert.ok(values.length >= 2, `${axis} の選択肢が足りません`);
    assert.equal(new Set(values).size, 1, `${axis} の質問数が偏っています：${JSON.stringify(counts)}`);
  }
});

test('質問の key が語彙の中にある', () => {
  for (const q of COGNITIVE_QUESTIONS) {
    const vocab = q.axis === 'channel' ? CHANNELS : ORDERS;
    assert.ok(vocab[q.key], `${q.id} の key が未定義：${q.key}`);
  }
});

test('答えの段階に「どちらでもない」を置かない', () => {
  assert.equal(SCALE.length % 2, 0, '真ん中の選択肢ができています');
});

test('答えが偏っていれば、その入り口が出る', () => {
  const answers = answerAll((q) => (q.key === 'auditory' || q.key === 'step' ? 3 : 0));
  const p = profileOf(answers);
  assert.equal(channelOf(p), 'auditory');
  assert.equal(orderOf(p), 'step');
});

// ここがこのファイルの芯。同点で無理に1つに決めると、他の入り口を試さなくなる。
test('差が小さいときは「決まりません」と返す（無理に1つに決めない）', () => {
  const p = profileOf(answerAll(() => 2));
  assert.equal(p.channel.reason, 'tie');
  assert.equal(p.channel.top, null);
  assert.equal(channelOf(p), null);
  assert.equal(orderOf(p), null);
  assert.match(profileLine(p), /決まりません/);
});

test('境目のすぐ内側は「決まりません」、外側は決まる', () => {
  // visual だけ 3、他は 3 - (TIE_MARGIN より少し小さい差)
  const near = answerAll((q) => (q.key === 'visual' ? 3 : 3 - (TIE_MARGIN - 0.01)));
  assert.equal(scoreAxis(near, 'channel').reason, 'tie');
  const far = answerAll((q) => (q.key === 'visual' ? 3 : 3 - (TIE_MARGIN + 0.01)));
  assert.equal(scoreAxis(far, 'channel').top, 'visual');
});

test('回答が少ないときは断定しない', () => {
  const few = { [COGNITIVE_QUESTIONS[0].id]: 3 };
  const p = profileOf(few);
  assert.equal(p.channel.reason, 'not-enough');
  assert.equal(channelOf(p), null);
  assert.match(profileLine(p), /判断できません/);
});

test('未回答を0点として数えない（答えていない＝合わない、にしない）', () => {
  // visual は1問だけ 3 で回答、他の visual は未回答。verbal は3問とも 2。
  const answers = {};
  for (const q of COGNITIVE_QUESTIONS) {
    if (q.key === 'visual') answers[q.id] = q.id === 'v1' ? 3 : null;
    else if (q.axis === 'channel') answers[q.id] = 2;
    else answers[q.id] = 2;
  }
  const res = scoreAxis(answers, 'channel');
  assert.equal(res.scores.visual, 3, '未回答を0点にすると平均が下がってしまいます');
});

test('何も答えていないことを見分けられる', () => {
  assert.equal(isUnanswered({}), true);
  assert.equal(isUnanswered({ [COGNITIVE_QUESTIONS[0].id]: 0 }), false, '0 は「当てはまらない」という回答');
});

// 断定する言い方をどの画面にも出さないための見張り。
test('「あなたは◯◯型です」と言わない', () => {
  const lines = [profileLine(profileOf(answerAll(() => 3))), profileLine(profileOf(answerAll((q) => (q.key === 'visual' ? 3 : 0)))), profileLine(null)];
  for (const line of lines) {
    assert.equal(/あなたは/.test(line), false, `断定した言い方：${line}`);
    assert.equal(/型です/.test(line), false, `断定した言い方：${line}`);
  }
});

test('診断ではないと最初に書いてある', () => {
  assert.match(COGNITIVE_DISCLAIMER[0], /診断では(あり)?ません/);
});
