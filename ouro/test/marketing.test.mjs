// マーケティングチーム（5人体制）のテスト。
//
// このチームの価値は「攻めと守りを分けていること」なので、
// **その分離が壊れていないこと**を機械チェックする。

import test from 'node:test';
import assert from 'node:assert/strict';

import { ROLES, roleById, rolesOfGroup, ROLE_GROUPS, groupById, approverFor, departmentById } from '../src/data/roles.js';
import { CHARACTERS, charactersOf } from '../src/data/characters.js';
import { presetEmployee } from '../src/data/employees.js';
import { planSteps, withApprovers, pickRole } from '../src/lib/dispatcher.js';
import { createTask } from '../src/lib/workflow.js';
import { buildSystemPrompt } from '../src/lib/runtime.js';
import { WORKFLOWS } from '../src/data/workflows.js';
import { buildToc } from '../src/data/toc.js';
import { normalizePortrait } from '../src/data/portraits.js';
import { readingInfo, UNKNOWN_BUCKET } from '../src/lib/yomi.js';

const MKT = ['mkt_content', 'mkt_governance', 'mkt_ops', 'mkt_brand', 'mkt_forecast'];

// ───────── 5人体制 ─────────

test('マーケティングチームは5役職', () => {
  const list = rolesOfGroup('marketing');
  assert.equal(list.length, 5);
  assert.deepEqual(list.map((r) => r.id), MKT);
  for (const r of list) assert.equal(departmentById(r.departmentId)?.name, 'マーケティング部');
});

test('チームは3つになり、全役職がどれかに属する', () => {
  assert.deepEqual(ROLE_GROUPS.map((g) => g.id), ['knowledge', 'company', 'marketing']);
  const sum = ROLE_GROUPS.reduce((n, g) => n + rolesOfGroup(g.id).length, 0);
  assert.equal(sum, ROLES.length);
});

test('5人それぞれに担当領域・判断基準・立ち位置がある', () => {
  for (const id of MKT) {
    const r = roleById(id);
    assert.ok(r.stance, `${r.name} に攻め/守りの区別が無い`);
    assert.ok(r.duties.length >= 3, `${r.name} の担当領域が少ない`);
    assert.ok(r.systemHint.length > 60, `${r.name} の指示が薄い`);
  }
});

// ───────── 核心：攻めと守りを兼務させない ─────────

test('攻めと守りを同じ役職に兼務させない', () => {
  for (const id of MKT) {
    const r = roleById(id);
    // 承認できる（守り）役職が、承認される側でもある＝兼務、は禁止
    assert.ok(
      !(r.isApprover && r.requiresApprovalBy),
      `${r.name} が承認する側と承認される側を兼ねている`
    );
    // 攻めの役職に承認権限を持たせない
    if (r.stance === 'offense') {
      assert.ok(!r.isApprover, `${r.name} は攻めなのに承認権限を持っている`);
      assert.ok(r.requiresApprovalBy, `${r.name} は攻めなのに確認を通さない`);
    }
  }
});

test('守りの担当は成果目標（KPI）を持たない', () => {
  const gov = roleById('mkt_governance');
  assert.equal(gov.stance, 'defense');
  assert.equal(gov.noKpi, true, 'KPIを持つとブレーキが甘くなる');
  assert.ok(gov.systemHint.includes('KPI'), '指示文にKPIを持たない旨が無い');
  assert.ok(gov.systemHint.includes('最適化提案は行いません'), '最適化提案をしない旨が無い');
  // 攻めの担当にはこの制約をつけない
  assert.ok(!roleById('mkt_content').noKpi);
  assert.ok(!roleById('mkt_ops').noKpi);
});

test('予測・戦略分析は提案までで、実行しない', () => {
  const mia = roleById('mkt_forecast');
  assert.equal(mia.proposalOnly, true);
  assert.ok(mia.outOfScope.includes('予算の執行'));
  assert.ok(mia.outOfScope.includes('施策の実行'));
  assert.ok(mia.systemHint.includes('実行もしません'));
});

test('権限外が役職ごとに書かれている', () => {
  assert.ok(roleById('mkt_content').outOfScope.includes('広告予算の決定'));
  assert.ok(roleById('mkt_ops').outOfScope.includes('予算上限の設定変更'));
  assert.ok(roleById('mkt_brand').outOfScope.includes('広告予算・配信スケジュールの決定'));
});

test('承認するのはガバナンス担当だけ', () => {
  const approvers = ROLES.filter((r) => r.isApprover).map((r) => r.id);
  assert.deepEqual(approvers, ['mkt_governance']);
  for (const id of ['mkt_content', 'mkt_ops', 'mkt_brand']) {
    assert.equal(approverFor(id)?.id, 'mkt_governance', `${id} の承認者が違う`);
  }
  assert.equal(approverFor('mkt_governance'), null, '承認者自身に承認者を付けない');
  assert.equal(approverFor('mkt_forecast'), null, '提案のみの担当は承認対象ではない');
});

// ───────── 承認は必ず計画に入る ─────────

test('攻めの担当が入ると、承認役が自動で最後に足される', () => {
  assert.deepEqual(withApprovers(['mkt_content']), ['mkt_content', 'mkt_governance']);
  assert.deepEqual(withApprovers(['mkt_ops']), ['mkt_ops', 'mkt_governance']);
  assert.deepEqual(withApprovers(['mkt_brand']), ['mkt_brand', 'mkt_governance']);
  // 二重に足さない
  assert.deepEqual(withApprovers(['mkt_content', 'mkt_governance']), ['mkt_content', 'mkt_governance']);
  // 関係ない役職には足さない
  assert.deepEqual(withApprovers(['researcher']), ['researcher']);
});

test('承認は上限で切り落とされない（安全のための手順だから）', () => {
  // maxSteps=1 でも確認は残る
  const steps = planSteps('SNS投稿の広告コピーを作って', { forceRoles: ['mkt_content'], maxSteps: 1 });
  assert.deepEqual(steps.map((s) => s.roleId), ['mkt_content', 'mkt_governance']);
});

test('社員を1人だけ指名しても確認は入る', () => {
  const steps = planSteps('これを投稿して', { forceRoles: ['mkt_ops'] });
  assert.ok(steps.some((s) => s.roleId === 'mkt_governance'), '指名依頼で確認が飛ばされている');
});

test('依頼文からもマーケの担当に届き、確認がつく', () => {
  const ids = planSteps('ステップ配信を設計して').map((s) => s.roleId);
  assert.ok(ids.includes('mkt_ops'));
  assert.equal(ids[ids.length - 1], 'mkt_governance', '確認が最後に来ていない');
});

test('確認役への指示は「承認か差し戻し」を求める', () => {
  const step = planSteps('広告コピーを作って', { forceRoles: ['mkt_content'] }).find(
    (s) => s.roleId === 'mkt_governance'
  );
  assert.ok(step.instruction.includes('承認'));
  assert.ok(step.instruction.includes('差し戻し'));
  assert.ok(step.instruction.includes('最適化提案はしないで'), 'ブレーキ役に徹する指示が無い');
});

test('確認役が未雇用なら、黙って落とさず印を残す', () => {
  const content = { id: 'e1', name: 'Olivia', roleId: 'mkt_content' };
  const task = createTask({
    request: '広告コピーを作って',
    forceRoles: ['mkt_content'],
    assign: (roleId) => (roleId === 'mkt_content' ? content : null),
  });
  assert.ok(task.missingApprovers.includes('mkt_governance'), '確認を通せていないことが分からない');
  assert.ok(task.unstaffedRoles.includes('mkt_governance'));
});

test('確認役が在籍していれば印は立たない', () => {
  const emp = (roleId) => ({ id: `e_${roleId}`, name: roleId, roleId });
  const task = createTask({ request: '広告コピーを作って', forceRoles: ['mkt_content'], assign: emp });
  assert.deepEqual(task.missingApprovers, []);
  assert.equal(task.steps.length, 2);
});

// ───────── 共通ルールがプロンプトに入る ─────────

test('チームの共通ルールが個別の役割より先に入る', () => {
  const group = groupById('marketing');
  assert.ok(group.commonPrompt.includes('5人体制'));
  assert.ok(group.commonPrompt.includes('攻め'));
  assert.ok(group.commonPrompt.includes('守り'));

  const sys = buildSystemPrompt({
    employee: presetEmployee('mkt_content', 1),
    company: { name: 'テスト社' },
  });
  assert.ok(sys.includes('チームの共通ルール'), '共通ルールが入っていない');
  // 「## チームの共通ルール」の見出しが、役職固有の指示より前にあること
  assert.ok(
    sys.indexOf('## チームの共通ルール') < sys.indexOf('あなたは企画・コンテンツ担当'),
    '共通ルールが個別の役割より後ろ'
  );
  assert.ok(sys.includes('権限外'), '権限外が入っていない');
  assert.ok(sys.includes('広告予算の決定'));
});

test('他のチームには共通ルールを混ぜない', () => {
  const sys = buildSystemPrompt({ employee: presetEmployee('researcher', 1), company: { name: 'x' } });
  assert.ok(!sys.includes('5人体制'), '関係のないチームのルールが混ざっている');
});

test('KPIを持たない旨は1か所にまとめる（同じ指示を重ねない）', () => {
  const sys = buildSystemPrompt({ employee: presetEmployee('mkt_governance', 1), company: { name: 'x' } });
  const lines = sys.split('\n').filter((l) => l.includes('KPI'));
  assert.equal(lines.length, 1, `KPIの記述が ${lines.length} 行に散っている`);
});

test('キャラクターの人物像をプロンプトに二重に載せない', () => {
  // persona / style は「性格」「書き方」として1回だけ出す。
  // seatHint で同じ文を重ねると、毎回のリクエストで無駄に課金される。
  const emp = presetEmployee('mkt_content', 1);
  assert.equal(emp.seatHint, '');
  const sys = buildSystemPrompt({ employee: emp, company: { name: 'x' } });
  const persona = 'ターゲットに響くか、ブランドトーンに沿っているかで判断する。';
  assert.equal(sys.split(persona).length - 1, 1, '人物像が2回入っている');
});

// ───────── キャラクター5名 ─────────

test('5名がそろっていて、指定どおりの名前', () => {
  const mkt = CHARACTERS.filter((c) => c.roleId.startsWith('mkt_'));
  assert.equal(mkt.length, 5);
  assert.deepEqual(mkt.map((c) => c.name), ['Olivia', 'Ethan', 'Sofia', 'Lucas', 'Mia']);
  for (const id of MKT) assert.equal(charactersOf(id).length, 1, `${id} の人数が違う`);
});

test('5名にも読み・カナ・肖像がある', () => {
  for (const c of CHARACTERS.filter((x) => x.roleId.startsWith('mkt_'))) {
    assert.ok(/^[ぁ-んー]+$/.test(c.reading), `${c.name} の読み`);
    assert.ok(/^[ァ-ヶー・]+$/.test(c.kana), `${c.name} のカナ`);
    assert.equal(readingInfo(c.name, c.reading).bucket !== UNKNOWN_BUCKET, true);
    assert.ok(c.portrait);
  }
});

test('35名の見た目が1つも重ならない', () => {
  const seen = new Map();
  for (const c of CHARACTERS) {
    const p = normalizePortrait(c.portrait);
    const key = `${p.hair}|${p.glasses}|${p.extra}|${p.collar}`;
    assert.ok(!seen.has(key), `${c.name} と ${seen.get(key)} の見た目が同じ`);
    seen.set(key, c.name);
  }
  assert.equal(CHARACTERS.length, 35);
});

test('名前・カナ・読みは35名すべてで一意', () => {
  for (const key of ['name', 'kana', 'reading']) {
    const vals = CHARACTERS.map((c) => c[key]);
    assert.equal(new Set(vals).size, vals.length, `${key} が重複`);
  }
});

test('社員にしたとき、立ち位置が持ち味として見える', () => {
  assert.equal(presetEmployee('mkt_governance', 1).name, 'Ethan');
  assert.equal(presetEmployee('mkt_governance', 1).strength, '守り・ブレーキ役');
  assert.equal(presetEmployee('mkt_content', 1).strength, '攻め・企画');
});

// ───────── 目次・ワークフローとの整合 ─────────

test('マーケの5役職も目次に出て、タイトルが重複しない', () => {
  const entries = buildToc({ employees: [] });
  for (const id of MKT) {
    const r = roleById(id);
    assert.ok(entries.some((e) => e.kind === 'role' && e.title === r.name), `${r.name} が目次に無い`);
  }
  const titles = entries.map((e) => e.title);
  assert.equal(new Set(titles).size, titles.length);
  assert.equal(entries.filter((e) => e.bucket === UNKNOWN_BUCKET).length, 0);
});

test('マーケのワークフローは確認を含む', () => {
  const publish = WORKFLOWS.find((w) => w.id === 'mkt_publish');
  assert.ok(publish, 'mkt_publish が無い');
  assert.ok(publish.steps.includes('mkt_governance'), '確認が入っていない');
  assert.ok(
    publish.steps.indexOf('mkt_governance') < publish.steps.indexOf('mkt_ops'),
    '配信より前に確認を通すこと'
  );
  const invest = WORKFLOWS.find((w) => w.id === 'mkt_invest');
  assert.equal(invest.steps[0], 'mkt_forecast', '数値の裏づけから始める');
  for (const w of WORKFLOWS) {
    for (const s of w.steps) assert.ok(roleById(s), `${w.name} が知らない役職 ${s} を指す`);
  }
});

test('仕様書 §19 の振り分けは変わらない', () => {
  assert.equal(pickRole('調べて'), 'researcher');
  assert.equal(pickRole('比較して'), 'analyzer');
  assert.equal(pickRole('間違いない？'), 'reviewer');
  assert.equal(pickRole('どうすればいい？'), 'strategist');
  assert.equal(pickRole('文章にして'), 'creator');
  assert.equal(pickRole('覚えたい'), 'mentor');
});
