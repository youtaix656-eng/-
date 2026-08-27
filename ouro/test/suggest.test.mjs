// 「①提案 → ②はい／いいえ → ③実行」の提案づくりのテスト。
//
// 提案は **AI を1回も呼ばない**（語の一致と、既にある計画から作る）。
// 当てずっぽうを断定で書かないこと、提案が承認を飛ばさないことが要点。

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  suggestPlan,
  guessGenre,
  guessWorkflow,
  suggestDoneWhen,
  guessDeal,
  planToTask,
  MIN_REQUEST,
  DEAL_NEAR,
} from '../src/lib/suggest.js';
import { WORKFLOWS, workflowById } from '../src/data/workflows.js';
import { allGenres, DEFAULT_GENRE_ID } from '../src/data/genres.js';
import { roleById } from '../src/data/roles.js';

const assignAll = (roleId) => ({ id: `e_${roleId}`, name: `担当:${roleId}`, shortName: '担当', roleId });
const assignNone = () => null;

// ───────── 分野を当てる ─────────

test('依頼文から分野を当てる', () => {
  assert.equal(guessGenre('腰痛のストレッチを調べて').id, 'health');
  assert.equal(guessGenre('副業の相場を調べて').id, 'money');
  assert.equal(guessGenre('ブログ記事を書いて').id, 'writing');
});

test('当たる言葉が無ければ汎用（無理に決めない）', () => {
  assert.equal(guessGenre('よろしくお願いします').id, DEFAULT_GENRE_ID);
  assert.equal(guessGenre('').id, DEFAULT_GENRE_ID);
});

test('自分で足したジャンルも当たる', () => {
  const custom = [{ id: 'g_x', name: '陶芸', desc: '器づくりの分野' }];
  assert.equal(guessGenre('陶芸の教室を開きたい', custom).id, 'g_x');
});

// ───────── 進め方を当てる ─────────

test('依頼文から進め方を当てる', () => {
  assert.equal(guessWorkflow('腰痛について調べて'), 'deep_research');
  assert.equal(guessWorkflow('ブログ記事を書いて'), 'make_content');
  assert.equal(guessWorkflow('今週の数字を分析して'), 'numbers');
  assert.equal(guessWorkflow('AとBどっちがいい？'), 'decide');
});

test('当たらなければ「おまかせ」（null）', () => {
  assert.equal(guessWorkflow('よろしく'), null);
});

test('当てる先は、実在する仕事の流れだけ', () => {
  const ids = WORKFLOWS.map((w) => w.id);
  for (const req of ['調べて', '記事を書いて', '数字を分析して', '棚卸しして', 'LINEの配信文', 'SNSへ横展開']) {
    const id = guessWorkflow(req);
    if (id) assert.ok(ids.includes(id), `${req} → ${id}`);
  }
});

// ───────── 完成条件の下書き ─────────

test('進め方と分野の両方から完成条件を作る', () => {
  const d = suggestDoneWhen('make_content', 'health');
  assert.match(d, /読み手/);
  assert.match(d, /受診の目安/);
});

test('当てはまるものが無ければ空（無理に付けない）', () => {
  assert.equal(suggestDoneWhen(null, DEFAULT_GENRE_ID), '');
});

// ───────── 案件の紐づけ ─────────

test('近い案件だけを拾う', () => {
  const deals = [
    { id: 'd1', title: '腰痛の記事作成', status: 'active' },
    { id: 'd2', title: '猫の写真販売', status: 'active' },
  ];
  assert.equal(guessDeal('腰痛の記事を書いて', deals).id, 'd1');
  assert.equal(guessDeal('確定申告の準備', deals), null);
});

test('終わった案件は拾わない', () => {
  const deals = [{ id: 'd1', title: '腰痛の記事作成', status: 'paid' }];
  assert.equal(guessDeal('腰痛の記事を書いて', deals), null);
});

// ───────── 提案ぜんぶ ─────────

test('短すぎる依頼には提案を出さない（当てずっぽうを出さない）', () => {
  const r = suggestPlan({ request: 'あ', assign: assignAll });
  assert.equal(r.ok, false);
  assert.match(r.reason, /もう少し/);
  assert.ok('あ'.length < MIN_REQUEST);
});

test('組み合わせが一式そろう', () => {
  const r = suggestPlan({
    request: '腰痛について調べて、信頼できる情報だけ記事にまとめて',
    assign: assignAll,
    deals: [{ id: 'd1', title: '腰痛の記事作成', status: 'active' }],
  });
  assert.equal(r.ok, true);
  assert.equal(r.genreId, 'health');
  assert.equal(r.workflowId, 'make_content');
  assert.ok(r.steps.length >= 2);
  assert.ok(r.steps.every((s) => s.roleName && roleById(s.roleId)));
  assert.equal(r.dealId, 'd1');
  assert.ok(r.doneWhen);
  assert.ok(r.calls >= r.staffedCount);
  assert.ok(r.reasons.length >= 2);
});

test('完成条件を付けるぶん、AIを呼ぶ回数が1増える', () => {
  const withDone = suggestPlan({ request: '腰痛の記事を書いて', assign: assignAll });
  assert.ok(withDone.doneWhen);
  assert.equal(withDone.calls, withDone.staffedCount + 1);
});

test('誰も雇っていなければ、AIを呼ぶ回数は0', () => {
  const r = suggestPlan({ request: '腰痛の記事を書いて', assign: assignNone });
  assert.equal(r.staffedCount, 0);
  assert.equal(r.calls, 0);
  assert.ok(r.unstaffedRoles.length > 0);
});

test('未雇用の役職は黙って隠さない', () => {
  const r = suggestPlan({
    request: '腰痛について調べて記事にまとめて',
    assign: (roleId) => (roleId === 'researcher' ? assignAll(roleId) : null),
  });
  assert.ok(r.unstaffedRoles.length > 0);
  assert.equal(r.staffedCount, 1);
});

test('当てずっぽうを断定で書かない', () => {
  const r = suggestPlan({ request: 'なんとなくお願いします', assign: assignAll });
  assert.equal(r.genreId, DEFAULT_GENRE_ID);
  assert.ok(r.reasons.some((x) => x.includes('汎用')));
  assert.ok(r.reasons.some((x) => x.includes('おまかせ')));
});

test('提案は、そのまま依頼の形にできる', () => {
  const r = suggestPlan({ request: '腰痛の記事を書いて', assign: assignAll });
  const t = planToTask(r, { request: '腰痛の記事を書いて' });
  assert.equal(t.genreId, r.genreId);
  assert.equal(t.workflowId, r.workflowId);
  assert.equal(t.doneWhen, r.doneWhen);
  assert.equal(t.request, '腰痛の記事を書いて');
});

test('提案する進め方は、必ず実在する', () => {
  for (const req of ['腰痛について調べて', '記事を書いてほしい', '今週の数字を見て', '作業の棚卸しをして']) {
    const r = suggestPlan({ request: req, assign: assignAll });
    assert.equal(r.ok, true, req);
    if (r.workflowId) assert.ok(workflowById(r.workflowId), r.workflowId);
  }
});

test('提案する分野は、必ず実在する', () => {
  const ids = allGenres().map((g) => g.id);
  for (const req of ['腰痛について調べて', '副業の相場を調べて', 'アプリを作ってほしい', '睡眠を整えたい']) {
    const r = suggestPlan({ request: req, assign: assignAll });
    assert.equal(r.ok, true, req);
    assert.ok(ids.includes(r.genreId), r.genreId);
  }
});

test('提案できない時は、中身を持たせない（使えてしまわないように）', () => {
  const r = suggestPlan({ request: '副業', assign: assignAll });
  assert.equal(r.ok, false);
  assert.equal(r.genreId, undefined);
  assert.equal(r.steps, undefined);
});

test('近さのしきい値を持っている（何にでも紐づけない）', () => {
  assert.ok(DEAL_NEAR > 0 && DEAL_NEAR < 1);
});

// ───────── 検査で見つかった不具合の再発防止 ─────────

test('呼び出し元が決めた案件を、推測で外さない', () => {
  // 案件から依頼したのに紐づけが外れると、その案件の仕事は0件・AI費用¥0のまま。
  // 結びつきは task.dealId の一方向しか無いので、ここで外すと二度と戻らない。
  const deals = [
    { id: 'd9', title: 'まったく別の案件', status: 'active' },
    { id: 'd1', title: '腰痛の記事作成', status: 'active' },
  ];
  const r = suggestPlan({ request: '腰痛の記事を書いて', assign: assignAll, deals, fixed: { dealId: 'd9' } });
  assert.equal(r.dealId, 'd9');
  assert.ok(r.reasons.some((x) => x.includes('の仕事として登録します')));
});

test('呼び出し元が決めた進め方・分野を、推測で置き換えない', () => {
  const r = suggestPlan({
    request: '腰痛の記事を書いて', // ふつうなら make_content / health を選ぶ
    assign: assignAll,
    fixed: { workflowId: 'quick', genreId: 'money' },
  });
  assert.equal(r.workflowId, 'quick');
  assert.equal(r.genreId, 'money');
  assert.ok(r.reasons.some((x) => x.includes('決まっていました')));
});

test('存在しない進め方を指定されたら、推測に戻す', () => {
  const r = suggestPlan({ request: '腰痛の記事を書いて', assign: assignAll, fixed: { workflowId: 'no_such' } });
  assert.equal(r.workflowId, 'make_content');
});

test('担当が1人もいない提案は、そうと分かる', () => {
  // このまま実行すると最初の手順で必ず失敗するので、画面は「はい」を出さない。
  const r = suggestPlan({ request: '腰痛について調べて記事にまとめて', assign: assignNone });
  assert.equal(r.ok, true);
  assert.equal(r.staffedCount, 0);
  assert.equal(r.calls, 0);
});
