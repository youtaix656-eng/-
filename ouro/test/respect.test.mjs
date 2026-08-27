// 「職場で加害を起こさない」ための6件のテスト。
//
// 守っているのは3つだけ：
//   ・外へ出る文章が実在の人を傷つけないこと
//   ・オーナーが加害の型を身につけないこと
//   ・実在の人が巻き込まれないこと
// AI社員は傷つかないので、そこを守る仕組みは作らない。

import test from 'node:test';
import assert from 'node:assert/strict';

import { checkPromises, checkRespect, personalAttack, rephraseHint, RESPECT_PATTERNS } from '../src/lib/guard.js';
import { checkPersonal, mask, hasPersonal, CLIENT_HINT } from '../src/lib/privacy.js';
import { FIXED_RULES, rulesPrompt, makeRules, addRule } from '../src/lib/rules.js';
import {
  redoFrom,
  overRedoLimit,
  redoCountOf,
  resetRedoCount,
  flagTask,
  unflagTask,
  isFlagged,
  REDO_LIMIT,
} from '../src/lib/workflow.js';
import { STEP_INSTRUCTIONS } from '../src/lib/dispatcher.js';

const task = (over = {}) => ({
  id: 't1',
  title: '仕事A',
  status: 'done',
  steps: [{ id: 'a', group: 0, status: 'done', output: '本文', cost: 1 }],
  decisions: [],
  ...over,
});

// ───────── ① 外へ出る文章の見張り ─────────

test('容姿・年齢・性別の決めつけを拾う', () => {
  const hits = checkRespect('ぽっちゃりの方でも安心。おばさんでも通えます。');
  assert.ok(hits.length >= 2);
  assert.ok(hits.some((h) => h.label.includes('体型')));
  assert.ok(hits.some((h) => h.label.includes('年齢')));
});

test('急かして決めさせる書き方を拾う', () => {
  const hits = checkRespect('今だけの価格です。決めないと損します。');
  assert.ok(hits.some((h) => h.label.includes('急かし')));
});

test('相手を下に見る言い方を拾う', () => {
  assert.ok(checkRespect('分かりやすく教えてあげます').some((h) => h.label.includes('下に見る')));
});

test('ふつうの文では鳴らない（誤検知で書けなくしない）', () => {
  assert.deepEqual(checkRespect('40〜60代の方に向けた記事です。腰痛の原因を3つに分けて説明します。'), []);
  assert.deepEqual(checkRespect('女性向けの記事を書きます'), []);
});

test('同じ表現は1回だけ出す', () => {
  const hits = checkRespect('今だけ。今だけ。今だけ。');
  assert.equal(hits.filter((h) => h.phrase === '今だけ').length, 1);
});

test('見張りは止めない（判定を返すだけ）', () => {
  // 返り値は配列で、書き換えた本文は返さない
  const hits = checkRespect('ぽっちゃり');
  assert.ok(Array.isArray(hits));
  assert.ok(hits.every((h) => h.why && h.label && h.phrase));
});

test('確約の見張りは今までどおり動く', () => {
  assert.ok(checkPromises('効果を保証します').length > 0);
});

test('直し方まで書いてある（言い換えの手がかり）', () => {
  for (const p of RESPECT_PATTERNS) assert.ok(p.why && p.why.length > 5, p.label);
});

// ───────── ⑬ 指示に人格否定を書かせない ─────────

test('人格を否定する指示を見つける', () => {
  assert.ok(personalAttack('この社員は使えない'));
  assert.ok(personalAttack('センスがない'));
  assert.equal(personalAttack('見出しは1つ200字まで'), null);
  assert.equal(personalAttack(''), null);
});

test('言い換えの案内に、行動で書けと出る', () => {
  const hint = rephraseHint('使えない');
  assert.ok(hint.includes('使えない'));
  assert.match(hint, /何を・どう変え/);
});

// ───────── ⑦ 差し戻しは人ではなく成果物を指す ─────────

test('消せない決まりに「人ではなく成果物」が入っている', () => {
  assert.ok(FIXED_RULES.some((r) => r.includes('人ではなく成果物')));
  // 足したルールで上書きできない（必ず先に読ませる）
  const r = addRule(makeRules(), '厳しく指摘すること');
  const p = rulesPrompt(r);
  assert.ok(p.indexOf('人ではなく成果物') < p.indexOf('厳しく指摘すること'));
});

test('レビュー役と確認役の指示に、直し方の型が入っている', () => {
  assert.match(STEP_INSTRUCTIONS.reviewer, /どの箇所を・どう直すか/);
  assert.match(STEP_INSTRUCTIONS.reviewer, /人格には触れない/);
  assert.match(STEP_INSTRUCTIONS.mkt_governance, /人格には触れない/);
});

// ───────── ⑫ やり直しの上限 ─────────

test('やり直すたびに数える', () => {
  let t = task();
  assert.equal(redoCountOf(t), 0);
  t = redoFrom(t, 'a');
  assert.equal(redoCountOf(t), 1);
  assert.equal(overRedoLimit(t), false);
});

test('上限に達したら知らせる', () => {
  let t = task();
  for (let i = 0; i < REDO_LIMIT; i += 1) t = redoFrom(t, 'a');
  assert.equal(overRedoLimit(t), true);
});

test('行き止まりにしない（数え直して続けられる）', () => {
  let t = task();
  for (let i = 0; i < REDO_LIMIT; i += 1) t = redoFrom(t, 'a');
  assert.equal(overRedoLimit(resetRedoCount(t)), false);
});

test('やり直しても、払った費用は消さない', () => {
  const t = redoFrom(task(), 'a');
  assert.equal(t.totalCost, 1);
});

// ───────── ㉓㉔ 外へ出せない印 ─────────

test('印を付けると保留になり、理由が残る', () => {
  const t = flagTask(task(), '容姿への言及があった');
  assert.equal(isFlagged(t), true);
  assert.equal(t.status, 'on_hold');
  assert.match(t.holdReason, /外へ出せない/);
  assert.equal(t.flagged.reason, '容姿への言及があった');
});

test('印は外せる', () => {
  const t = unflagTask(flagTask(task(), 'x'));
  assert.equal(isFlagged(t), false);
});

test('印を付けても、元の状態に戻せるよう覚えておく', () => {
  const t = flagTask(task({ status: 'done' }), 'x');
  assert.equal(t.heldFrom, 'done');
});

test('中止した仕事の状態は変えない', () => {
  const t = flagTask(task({ status: 'cancelled' }), 'x');
  assert.equal(t.status, 'cancelled');
});

// ───────── ㉙ お客さんの情報を持たない ─────────

test('連絡先・住所を見つける', () => {
  const hits = checkPersonal('090-1234-5678 / tanaka@example.com / 〒150-0001');
  assert.ok(hits.length >= 3);
  assert.ok(hits.some((h) => h.label.includes('電話')));
  assert.ok(hits.some((h) => h.label.includes('メール')));
});

test('メールを二重に数えない', () => {
  assert.equal(checkPersonal('tanaka@example.com').length, 1);
});

test('見つけたものは画面でも伏せる（隠す意味を失わせない）', () => {
  const hits = checkPersonal('090-1234-5678');
  assert.ok(!hits[0].phrase.includes('1234'));
  assert.equal(mask('090-1234-5678').length, '090-1234-5678'.length);
  assert.equal(mask('ab'), '●●');
});

test('ふつうの依頼文では鳴らない', () => {
  assert.equal(hasPersonal('腰痛の記事を書いて。読み手は40〜60代。'), false);
  assert.equal(hasPersonal('〇〇整体院'), false);
});

test('呼び名だけにする案内がある', () => {
  assert.match(CLIENT_HINT, /呼び名/);
  assert.ok(FIXED_RULES.some((r) => r.includes('個人を特定できるもの')));
});

test('印を外すと、印のせいで付いた保留も一緒に解ける', () => {
  // 印だけ外すと「外へ出せない内容として止めました」だけが残った保留になり、
  // 提出物の画面も出ないまま行き止まりになる（実際に踏んだ）。
  const t = unflagTask(flagTask(task({ status: 'done' }), 'x'));
  assert.equal(t.status, 'done');
  assert.equal(t.holdReason, '');
  assert.equal(isFlagged(t), false);
});

test('自分で付けた保留は、印を外しても触らない', () => {
  const held = { ...task(), status: 'on_hold', holdReason: '材料待ち', heldFrom: 'queued' };
  const t = unflagTask({ ...held, flagged: { reason: 'x', at: 1 } });
  assert.equal(t.status, 'on_hold');
  assert.equal(t.holdReason, '材料待ち');
});

// ───────── 検査で見つかった不具合の再発防止 ─────────

test('件数の上限で、後ろの分類が調べられなくなることがない', () => {
  // 分類ごとに途中で return していたため、先の分類でいっぱいになると
  // 人格否定（最後の分類）が一度も当てられないことがあった。
  const many = `${'今だけ。'.repeat(20)}この社員は使えない`;
  assert.ok(personalAttack(many), '人格否定が埋もれている');
});

test('伏せた文字ではなく元の文字で数える（別の番号を同じものにしない）', () => {
  const hits = checkPersonal('090-1111-2222 と 090-3333-4444');
  assert.equal(hits.length, 2);
  assert.notEqual(hits[0].id, hits[1].id);
});

test('後読み（lookbehind）を使わない（古い端末で読み込めなくなるため）', async () => {
  const fs = await import('node:fs');
  for (const f of ['../src/lib/privacy.js', '../src/lib/guard.js']) {
    const src = fs.readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.ok(!/\(\?<[=!]/.test(src), `${f} に後読みがある`);
  }
});

test('空に当たる型でも止まらない', () => {
  // 進まない正規表現があると無限ループになる
  assert.ok(Array.isArray(checkPersonal('@ab')));
  assert.ok(Array.isArray(checkRespect('')));
});
