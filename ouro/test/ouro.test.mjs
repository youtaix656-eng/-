// Ouro の中核ロジックのテスト（依存なし・node --test）。
// 設計上の約束（社員とエンジンの分離・出典必須・権限・上限のハードコード禁止）を
// 機械チェックして、将来の変更で壊れないようにする。

import test from 'node:test';
import assert from 'node:assert/strict';

import { ROLES, CORE_ROLES, roleById } from '../src/data/roles.js';
import { initialPresets, presetEmployee, SEAT_ARCHETYPES, archetypeFor } from '../src/data/employees.js';
import { PLANS, connectionLimit, employeeLimit, planById } from '../src/data/plans.js';
import { TOOLS, countableTools } from '../src/data/tools.js';
import { JOB_TEMPLATES, easiestFirst } from '../src/data/jobTemplates.js';
import { WORKFLOWS, flatSteps } from '../src/data/workflows.js';
import { pickRole, planSteps, scoreRoles, detectNeeds, titleFor } from '../src/lib/dispatcher.js';
import { route, weighTask, WEIGHTS } from '../src/lib/router.js';
import { PROVIDERS, providerById, availableProviders, estimateCost } from '../src/lib/providers/index.js';
import { createKnowledge, searchKnowledge, normalizeTags, markVerified, verifiedRate, tagCounts } from '../src/lib/knowledge.js';
import { canRead, relevantKnowledge, buildContext, SCOPES } from '../src/lib/memory.js';
import { checkAction, hasPermission, canAutoRun, DEFAULT_PERMISSIONS } from '../src/lib/permissions.js';
import { appendAudit, makeEntry, AUDIT_LIMIT, totalCost } from '../src/lib/audit.js';
import { createTask, applyStepResult, nextStep, assembleResult, taskProgress } from '../src/lib/workflow.js';
import { seedAll, nextSeat, makeEmployee } from '../src/lib/seed.js';
import { createDeal, revenueSummary, dealAiCost, upcomingDeals } from '../src/lib/revenue.js';
import { cycleStats, weakestStage, growthSeries } from '../src/lib/cycle.js';
import { ingestOne, detectKind, youtubeId } from '../src/lib/ingest.js';
import { createMeeting, addRound, meetingProgress, synthesisPrompt } from '../src/lib/meeting.js';
import { distill, extractUrls, buildSystemPrompt } from '../src/lib/runtime.js';
import { KEYS, EXPORT_EXCLUDE } from '../src/lib/storage.js';
import { toBlocks } from '../src/lib/format.js';

// ───────── 役職と席 ─────────

test('主要6役職は仕様どおり（調査・分析・制作・検証・戦略・学習）', () => {
  assert.equal(CORE_ROLES.length, 6);
  assert.deepEqual(
    CORE_ROLES.map((r) => r.id),
    ['researcher', 'analyzer', 'creator', 'reviewer', 'strategist', 'mentor']
  );
});

test('役職の id・order・glyph が重複しない', () => {
  const ids = ROLES.map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length, 'id が重複している');
  const orders = ROLES.map((r) => r.order);
  assert.equal(new Set(orders).size, orders.length, 'order が重複している');
  for (const r of ROLES) {
    assert.ok(r.triggers.length > 0, `${r.id} に triggers が無い`);
    assert.ok(r.duties.length > 0, `${r.id} に duties が無い`);
    assert.ok(r.systemHint, `${r.id} に systemHint が無い`);
  }
});

test('初期チームは 6役職 × 3席 = 18人', () => {
  const presets = initialPresets(3);
  assert.equal(presets.length, 18);
  for (const role of CORE_ROLES) {
    const seats = presets.filter((p) => p.roleId === role.id);
    assert.equal(seats.length, 3, `${role.name} が3席でない`);
    assert.deepEqual(seats.map((s) => s.seat), [1, 2, 3]);
    // 同じ役職の3人は持ち味が違う（同じ人を3人並べない）
    assert.equal(new Set(seats.map((s) => s.strength)).size, 3);
    assert.equal(new Set(seats.map((s) => s.name)).size, 3);
  }
});

test('席数は可変（増席できる設計）', () => {
  assert.equal(initialPresets(1).length, 6);
  assert.equal(initialPresets(5).length, 30);
  const emp = presetEmployee('researcher', 7);
  assert.equal(emp.seat, 7);
  assert.ok(emp.name, '7席目でも名前が付く');
});

test('4席目以降も名前が重ならず、役職名を繰り返さない', () => {
  const names = new Set();
  for (let seat = 1; seat <= 20; seat += 1) {
    const e = presetEmployee('strategist', seat);
    assert.ok(!names.has(e.name), `${seat}席目の名前が重複：${e.name}`);
    names.add(e.name);
    // 「ストラテジスト・ストラテジスト4」のような名前を作らない
    const [role, personal] = e.name.split('・');
    assert.notEqual(personal, undefined, `${seat}席目の名前が「役職・個人名」の形でない`);
    assert.ok(!personal.startsWith(role), `${seat}席目で役職名が重なっている：${e.name}`);
    assert.ok(archetypeFor(seat).strength, '持ち味が付いていない');
  }
});

test('nextSeat は空いている番号を返す', () => {
  const emps = [
    { roleId: 'researcher', seat: 1 },
    { roleId: 'researcher', seat: 3 },
    { roleId: 'analyzer', seat: 1 },
  ];
  assert.equal(nextSeat(emps, 'researcher'), 2);
  assert.equal(nextSeat(emps, 'creator'), 1);
});

test('seedAll は会社と18人の社員を作る', () => {
  const s = seedAll('テスト社');
  assert.equal(s.company.name, 'テスト社');
  assert.equal(s.employees.length, 18);
  assert.equal(new Set(s.employees.map((e) => e.id)).size, 18, 'id が重複している');
  for (const e of s.employees) {
    // 既定の権限は最小（送信・削除・支払いを最初から持たせない）
    assert.equal(e.permissions.send, false);
    assert.equal(e.permissions.delete, false);
    assert.equal(e.permissions.pay, false);
    assert.equal(e.autoRun, false);
  }
});

// ───────── 自動社員選択 ─────────

test('仕様書 §19 の例がすべて正しい役職へ振り分けられる', () => {
  assert.equal(pickRole('調べて'), 'researcher');
  assert.equal(pickRole('比較して'), 'analyzer');
  assert.equal(pickRole('間違いない？'), 'reviewer');
  assert.equal(pickRole('どうすればいい？'), 'strategist');
  assert.equal(pickRole('文章にして'), 'creator');
  assert.equal(pickRole('覚えたい'), 'mentor');
});

test('複数の動きを含む依頼は会社の標準の流れに並ぶ', () => {
  const steps = planSteps('YouTubeとWebから腰痛について調べて、信頼できる情報だけまとめて');
  const ids = steps.map((s) => s.roleId);
  assert.equal(ids[0], 'researcher', '最初は調査');
  assert.ok(ids.includes('analyzer'));
  assert.ok(ids.includes('reviewer'), '調査で始まる依頼には検証が挟まる');
  // 引き継ぎのため、各ステップに指示文が入る
  for (const s of steps) assert.ok(s.instruction.length > 10);
});

test('役職を指定すればその順で計画される', () => {
  const steps = planSteps('なんでもいい', { forceRoles: ['creator', 'reviewer'] });
  assert.deepEqual(steps.map((s) => s.roleId), ['creator', 'reviewer']);
});

test('該当語が無ければアナライザーが受ける（無反応にしない）', () => {
  const steps = planSteps('ふぁーいうぇ');
  assert.equal(steps.length, 1);
  assert.equal(steps[0].roleId, 'analyzer');
});

test('依頼文から必要な道具を見つける', () => {
  assert.deepEqual(detectNeeds('最新の相場を検索して'), ['web']);
  assert.ok(detectNeeds('https://example.com を読んで').includes('webfetch'));
  assert.deepEqual(detectNeeds('これを短くして'), []);
});

test('titleFor は短いタイトルにする', () => {
  assert.equal(titleFor(''), '無題の依頼');
  assert.ok(titleFor('あ'.repeat(100)).length <= 29);
});

// ───────── AI Router（社員とエンジンの分離） ─────────

test('キーが無いときはローカル社員が受ける（アプリが止まらない）', () => {
  const d = route({ employee: { roleId: 'researcher' }, secrets: {} });
  assert.equal(d.providerId, 'local');
  assert.equal(d.offline, true);
});

test('キーがあればキーの要るエンジンを選ぶ', () => {
  const d = route({ employee: { roleId: 'researcher' }, secrets: { anthropic: 'sk-test' } });
  assert.equal(d.providerId, 'anthropic');
  assert.equal(d.offline, false);
});

test('Web検索が必要なときは検索できるエンジンだけに絞る', () => {
  const d = route({
    employee: { roleId: 'researcher' },
    secrets: { openai: 'sk-a', anthropic: 'sk-b' },
    needs: ['web'],
  });
  assert.equal(d.providerId, 'anthropic', 'Web検索できるエンジンが選ばれる');
});

test('社員の希望は尊重されるが、使えないときは自動で落とす', () => {
  const chosen = route({
    employee: { providerPref: 'openai' },
    secrets: { openai: 'sk-a', anthropic: 'sk-b' },
  });
  assert.equal(chosen.providerId, 'openai');

  const fallback = route({
    employee: { providerPref: 'openai' },
    secrets: { anthropic: 'sk-b' },
    mode: 'manual',
  });
  assert.notEqual(fallback.providerId, 'openai', '未接続の希望は通らない');
});

test('重い仕事ほど上位モデルを選ぶ', () => {
  assert.equal(weighTask('要約して'), WEIGHTS.light);
  assert.equal(weighTask('戦略を設計して'), WEIGHTS.heavy);

  const light = route({ employee: {}, secrets: { anthropic: 'k' }, request: '要約して' });
  const heavy = route({ employee: {}, secrets: { anthropic: 'k' }, request: '徹底的に検証して戦略を立てて' });
  const models = providerById('anthropic').models.map((m) => m.id);
  assert.ok(models.indexOf(heavy.model) < models.indexOf(light.model), '重い仕事の方が上位モデル');
});

test('社員データにエンジンの実体を持たせない（分離の担保）', () => {
  const emp = makeEmployee(presetEmployee('researcher', 1));
  // 希望（providerPref）だけを持ち、provider オブジェクトや apiKey は持たない
  assert.equal(emp.providerPref, 'auto');
  assert.equal(emp.provider, undefined);
  assert.equal(emp.apiKey, undefined);
  assert.equal(emp.client, undefined);
});

test('エンジンは登録制で、増やしてもコードを直さない', () => {
  for (const p of PROVIDERS) {
    assert.ok(p.id && p.name, 'id と name が要る');
    assert.equal(typeof p.run, 'function', 'run() を実装していない');
    assert.ok(Array.isArray(p.models) && p.models.length, 'models が空');
  }
  assert.ok(providerById('local'), 'キー無しの受け皿が必ず要る');
  assert.equal(availableProviders({}).length, PROVIDERS.filter((p) => !p.needsKey).length);
});

test('費用の概算が出せる（使ったお金を隠さない）', () => {
  const cost = estimateCost('anthropic', 'claude-opus-5', { input: 1e6, output: 1e6 });
  assert.ok(cost > 0);
  assert.equal(estimateCost('local', 'frame', { input: 1e6, output: 1e6 }), 0);
});

test('ローカル社員はキー無しで動き、AI未接続だと明示する', async () => {
  const res = await providerById('local').run({
    messages: [{ role: 'user', content: '腰痛について調べて' }],
    meta: { roleId: 'researcher', employeeName: 'ルナ' },
  });
  assert.ok(res.text.includes('AIエンジン未接続'), 'AIが考えた結果だと誤解させない');
  assert.equal(res.offline, true);
});

// ───────── 知識と出典 ─────────

test('出典のない知識は作れない（自動で出典が立つ）', () => {
  const { knowledge, extraSources } = createKnowledge({ title: 'テスト', origin: 'ai' });
  assert.equal(knowledge.sourceIds.length, 1);
  assert.equal(extraSources.length, 1);
  assert.equal(extraSources[0].type, 'ai');
  assert.ok(extraSources[0].title.includes('未検証'));
});

test('AI生成と外部由来を必ず区別する', () => {
  const ai = createKnowledge({ title: 'a', origin: 'ai' }).knowledge;
  const ext = createKnowledge({ title: 'b', origin: 'external', sourceIds: ['s1'] }).knowledge;
  assert.equal(ai.origin, 'ai');
  assert.equal(ext.origin, 'external');
  // 未知の origin は ai に倒す（区別できない状態を作らない）
  assert.equal(createKnowledge({ title: 'c', origin: 'なんとなく' }).knowledge.origin, 'ai');
});

test('タグは重複・空白・#を落として正規化する', () => {
  assert.deepEqual(normalizeTags(['腰痛', '#腰痛', ' 姿勢 ', '']), ['腰痛', '姿勢']);
  assert.deepEqual(normalizeTags('腰痛, 姿勢、筋肉'), ['腰痛', '姿勢', '筋肉']);
  assert.ok(normalizeTags(new Array(30).fill(0).map((_, i) => `t${i}`)).length <= 12);
});

test('検索はタイトル・本文・タグ・カテゴリを見る', () => {
  const list = [
    createKnowledge({ title: '腰痛の原因', body: '姿勢が関係する', tags: ['腰痛'], category: '調査' }).knowledge,
    createKnowledge({ title: '肩こり', body: 'デスクワーク', tags: ['肩こり'], category: '分析' }).knowledge,
  ];
  assert.equal(searchKnowledge(list, '腰痛').length, 1);
  assert.equal(searchKnowledge(list, 'デスクワーク').length, 1);
  assert.equal(searchKnowledge(list, '', { category: '分析' }).length, 1);
  assert.equal(searchKnowledge(list, '', { tag: '腰痛' }).length, 1);
  assert.equal(searchKnowledge(list, '', { verifiedOnly: true }).length, 0);
});

test('検証すると信頼性が上がる', () => {
  const k = createKnowledge({ title: 'x', trust: 30 }).knowledge;
  const v = markVerified(k, { by: 'emp_1' });
  assert.ok(v.verifiedAt);
  assert.equal(v.verifiedBy, 'emp_1');
  assert.ok(v.trust >= 70);
  assert.equal(verifiedRate([k, v]), 50);
});

test('タグの出現数を数えられる', () => {
  const list = [
    createKnowledge({ title: 'a', tags: ['腰痛', '姿勢'] }).knowledge,
    createKnowledge({ title: 'b', tags: ['腰痛'] }).knowledge,
  ];
  assert.deepEqual(tagCounts(list)[0], { tag: '腰痛', count: 2 });
});

// ───────── 記憶と権限（無制限アクセスをさせない） ─────────

test('社員は読める範囲の知識しか読めない', () => {
  const companyWide = { id: 'k1', title: '全社', summary: '', tags: [] };
  const deptOnly = { id: 'k2', title: '調査部のみ', departmentId: 'research', summary: '', tags: [] };
  const selfOnly = { id: 'k3', title: '本人のみ', employeeId: 'emp_1', summary: '', tags: [] };

  const narrow = { id: 'emp_2', knowledgeScopes: [SCOPES.dept('research')] };
  assert.equal(canRead(narrow, companyWide), false, '全社知識を勝手に読ませない');
  assert.equal(canRead(narrow, deptOnly), true);
  assert.equal(canRead(narrow, selfOnly), false);

  const wide = { id: 'emp_1', knowledgeScopes: [SCOPES.company, SCOPES.self] };
  assert.equal(canRead(wide, companyWide), true);
  assert.equal(canRead(wide, selfOnly), true);
});

test('関係のある知識だけを渡す（全部渡さない）', () => {
  const emp = { id: 'e', knowledgeScopes: [SCOPES.company] };
  const list = [
    { id: 'a', title: '腰痛の原因', summary: '姿勢', tags: ['腰痛'] },
    { id: 'b', title: '確定申告', summary: '税金', tags: ['税'] },
  ];
  const rel = relevantKnowledge(emp, list, '腰痛について教えて');
  assert.equal(rel.length, 1);
  assert.equal(rel[0].id, 'a');
});

test('助詞や語尾の一致で無関係な知識を拾わない', () => {
  const emp = { id: 'e', knowledgeScopes: [SCOPES.company] };
  const list = [
    { id: 'a', title: '腰痛の原因', summary: '姿勢', tags: ['腰痛'] },
    // 「〜について」が共通するだけの無関係な知識
    { id: 'b', title: '確定申告について', summary: 'これについて詳しく', tags: [] },
  ];
  const rel = relevantKnowledge(emp, list, '腰痛について教えて');
  assert.deepEqual(rel.map((k) => k.id), ['a'], '助詞の一致で無関係な知識が混ざっている');
});

test('buildContext は4層を分けて記録する', () => {
  const emp = {
    id: 'e',
    knowledgeScopes: [SCOPES.company],
    memory: { notes: [{ text: '前回は失敗した' }] },
  };
  const ctx = buildContext({
    employee: emp,
    task: { request: '腰痛', title: '腰痛', context: '初心者向け' },
    knowledgeList: [{ id: 'a', title: '腰痛の原因', summary: '姿勢', tags: [] }],
    inherited: '前の担当のまとめ',
  });
  const layers = ctx.layers.map((l) => l.layer);
  assert.deepEqual(layers, ['knowledge', 'self', 'handoff', 'task']);
  assert.ok(ctx.text.includes('腰痛の原因'));
});

test('危険な操作は黙って実行されない（承認を通るか、そもそも拒否される）', () => {
  const emp = { name: 'テスト', permissions: { ...DEFAULT_PERMISSIONS, send: true, delete: true, pay: true } };
  for (const action of ['send', 'delete', 'pay', 'publish', 'externalWrite']) {
    const r = checkAction({ employee: emp, action });
    assert.ok(
      r.needsApproval || !r.allowed,
      `${action} が承認も拒否もされずに通ってしまう`
    );
  }
  // 権限を与えたうえでも、実行前に必ず承認を挟む
  const full = { name: 'テスト', permissions: { read: true, create: true, edit: true, send: true, delete: true, pay: true } };
  for (const action of ['send', 'delete', 'pay', 'publish', 'externalWrite']) {
    assert.equal(checkAction({ employee: full, action }).needsApproval, true, `${action} が承認なしで通ってしまう`);
  }
});

test('権限が無ければ承認以前に実行できない', () => {
  const emp = { name: 'テスト', permissions: { ...DEFAULT_PERMISSIONS } };
  const r = checkAction({ employee: emp, action: 'send' });
  assert.equal(r.allowed, false);
  assert.equal(r.needsApproval, false);
});

test('費用の発生する実行だけ自動承認にできる', () => {
  const emp = { name: 'テスト', permissions: { ...DEFAULT_PERMISSIONS } };
  assert.equal(checkAction({ employee: emp, action: 'costly' }).needsApproval, true);
  assert.equal(
    checkAction({ employee: emp, action: 'costly', settings: { autoApproveCost: true } }).needsApproval,
    false
  );
  // 自動承認の設定があっても、送信は通らない
  assert.equal(
    checkAction({ employee: { ...emp, permissions: { ...emp.permissions, send: true } }, action: 'send', settings: { autoApproveCost: true } })
      .needsApproval,
    true
  );
});

test('危険な権限を持つ社員は自動実行できない', () => {
  const safe = { autoRun: true, permissions: { ...DEFAULT_PERMISSIONS } };
  const risky = { autoRun: true, permissions: { ...DEFAULT_PERMISSIONS, delete: true } };
  assert.equal(canAutoRun(safe), true);
  assert.equal(canAutoRun(risky), false);
  assert.equal(canAutoRun({ autoRun: false, permissions: {} }), false);
});

// ───────── 監査ログ ─────────

test('監査ログは追記のみで、上限を超えたら古いものから落ちる', () => {
  let list = [];
  for (let i = 0; i < AUDIT_LIMIT + 10; i += 1) {
    list = appendAudit(list, makeEntry({ actor: 'user', action: 'stepRun', target: `t${i}` }));
  }
  assert.equal(list.length, AUDIT_LIMIT);
  assert.equal(list[list.length - 1].target, `t${AUDIT_LIMIT + 9}`, '最新が残る');
  assert.equal(list[0].target, 't10', '古いものから落ちる');
});

test('費用の合計が出せる', () => {
  const list = [makeEntry({ action: 'stepRun', cost: 0.5 }), makeEntry({ action: 'stepRun', cost: 0.25 })];
  assert.equal(totalCost(list), 0.75);
});

// ───────── Task / Workflow（ハンドオフ） ─────────

test('単発の仕事も steps 配列に入る', () => {
  const task = createTask({ request: '短くして', assign: () => null });
  assert.ok(Array.isArray(task.steps));
  assert.ok(task.steps.length >= 1);
  assert.equal(task.status, 'queued');
});

test('ステップの出力が次のステップの入力になる（社員間の引き継ぎ）', () => {
  const employees = { researcher: { id: 'e1', name: 'ルナ' }, analyzer: { id: 'e2', name: 'カイ' } };
  let task = createTask({
    request: 'テーマを調べて分析して',
    forceRoles: ['researcher', 'analyzer'],
    assign: (roleId) => employees[roleId],
  });
  assert.equal(task.steps.length, 2);
  assert.equal(task.steps[0].employeeName, 'ルナ');

  task = applyStepResult(task, task.steps[0].id, { text: '調査の結果です', providerId: 'local', cost: 0.1 });
  assert.equal(task.steps[0].status, 'done');
  assert.equal(task.steps[1].input, '調査の結果です', '次の担当へ引き継がれていない');
  assert.equal(task.status, 'running');
  assert.equal(taskProgress(task), 50);

  task = applyStepResult(task, task.steps[1].id, { text: '分析の結果です', providerId: 'local', cost: 0.2 });
  assert.equal(task.status, 'done');
  assert.equal(task.totalCost.toFixed(2), '0.30');
  assert.equal(nextStep(task), null);

  const assembled = assembleResult(task);
  assert.ok(assembled.includes('ルナ') && assembled.includes('カイ'), '全員の成果がまとまる');
});

test('失敗したステップは引き継がず、仕事全体が failed になる', () => {
  let task = createTask({ request: '調べて分析して', forceRoles: ['researcher', 'analyzer'], assign: () => null });
  task = applyStepResult(task, task.steps[0].id, { error: 'キーがありません' });
  assert.equal(task.status, 'failed');
  assert.equal(task.steps[1].input, '', '失敗した内容を次へ渡さない');
});

test('最初のステップだけが道具を使う（毎回検索してコストを増やさない）', () => {
  const task = createTask({ request: '最新の相場を検索して分析して', assign: () => null });
  assert.ok(task.steps[0].needs.includes('web'));
  for (const s of task.steps.slice(1)) assert.deepEqual(s.needs, []);
});

test('ワークフローの定義はすべて実在する役職を指す', () => {
  for (const wf of WORKFLOWS) {
    // steps には「同時に走らせてよい手順」の入れ子が混ざる（新項目22）
    for (const roleId of flatSteps(wf)) {
      assert.ok(roleById(roleId), `${wf.name} が知らない役職 ${roleId} を指している`);
    }
  }
});

// ───────── 実行時の組み立て ─────────

test('システムプロンプトに人格と会社の決まりが入る', () => {
  const emp = makeEmployee(presetEmployee('reviewer', 3));
  const sys = buildSystemPrompt({ employee: emp, company: { name: 'テスト社' }, contextText: '材料' });
  assert.ok(sys.includes('テスト社'));
  assert.ok(sys.includes(emp.name));
  assert.ok(sys.includes('未確認'), '分からないことを未確認と書く決まりが入っていない');
  assert.ok(sys.includes('意思決定'), '最終決定が人間である決まりが入っていない');
  assert.ok(sys.includes('材料'));
});

test('知識のタイトルはユーザーの依頼文を優先する（担当者名にしない）', () => {
  const body = '## リサーチャー・ルナ\n\n⚠ AIエンジン未接続です\n　（設定から登録できます）\n\n腰痛の主な原因は姿勢である。';
  const d = distill(body, '腰痛について調べて');
  assert.equal(d.title, '腰痛について調べて', '担当者名が知識のタイトルになっている');
  assert.ok(d.summary.includes('腰痛'));
  assert.ok(!d.summary.includes('⚠'), '注意書きが要約に混ざっている');
  assert.ok(!d.summary.startsWith('（'), '括弧の補足が要約になっている');

  // 依頼文のタイトルが無いときだけ見出しを使う
  assert.equal(distill('## 調査の結果\n\n本文です本文です', '').title, '調査の結果');
  assert.equal(distill('本文だけ', '').title, '成果');
});

test('本文中の URL を出典候補として拾う', () => {
  const urls = extractUrls('参考：https://example.com/a と https://example.com/a と https://example.jp/b）');
  assert.deepEqual(urls, ['https://example.com/a', 'https://example.jp/b']);
});

// ───────── 取り込み ─────────

test('URL の種類を見分ける', () => {
  assert.equal(detectKind('https://www.youtube.com/watch?v=abc12345'), 'youtube');
  assert.equal(detectKind('https://youtu.be/abc12345'), 'youtube');
  assert.equal(detectKind('https://example.com/a.pdf'), 'pdf');
  assert.equal(detectKind('https://example.com'), 'web');
  assert.equal(detectKind('ただのメモ'), 'note');
  assert.equal(youtubeId('https://youtu.be/abc12345'), 'abc12345');
});

test('取り込みは外部由来として記録される（AI生成にしない）', () => {
  const web = ingestOne({ kind: 'web', url: 'https://example.com', text: '本文' });
  assert.equal(web.knowledge.origin, 'external');
  assert.equal(web.knowledge.sourceIds[0], web.source.id);
  const note = ingestOne({ kind: 'note', text: '自分のメモ' });
  assert.equal(note.knowledge.origin, 'user');
});

// ───────── 会議 ─────────

test('会議は 参加人数×2＋1 回の発言で完了する', () => {
  const emps = [{ id: 'a' }, { id: 'b' }, { id: 'c', roleId: 'strategist' }];
  let m = createMeeting({ topic: 'やるべきか', employees: emps });
  assert.equal(m.chairId, 'c', '議長はストラテジスト');
  assert.equal(meetingProgress(m), 0);
  for (let i = 0; i < 7; i += 1) m = addRound(m, { phase: 'opinion', text: 'x', cost: 0.1 });
  assert.equal(meetingProgress(m), 100);
  assert.equal(m.totalCost.toFixed(1), '0.7');
});

test('議長への指示は「決めるのはオーナー」と伝える', () => {
  const p = synthesisPrompt('テーマ', [], []);
  assert.ok(p.includes('決めるのはオーナー'));
  assert.ok(p.includes('今日やる1つ'));
});

// ───────── 収益 ─────────

test('入金済みだけを売上として数える', () => {
  const deals = [
    createDeal({ title: 'A', fee: 30000, status: 'paid', hoursSpent: 3 }),
    createDeal({ title: 'B', fee: 20000, status: 'active' }),
    createDeal({ title: 'C', fee: 50000, status: 'lost' }),
  ];
  const s = revenueSummary(deals, []);
  assert.equal(s.earned, 30000);
  assert.equal(s.expected, 20000, '見送りは見込みに数えない');
  assert.equal(s.paidCount, 1);
  assert.equal(s.hourlyRate, 10000);
});

test('案件にかかった AI 費用を差し引いて手残りを出す', () => {
  const deal = createDeal({ title: 'A', fee: 10000, status: 'paid', hoursSpent: 2 });
  deal.taskIds = ['t1'];
  const tasks = [{ id: 't1', totalCost: 2 }]; // $2
  assert.equal(Math.round(dealAiCost(deal, tasks, 150)), 300);
  const s = revenueSummary([deal], tasks, { usdJpy: 150 });
  assert.equal(s.profit, 9700);
  assert.equal(s.returnRatio, 33.3);
});

test('締切が近い順に並び、残り日数が付く', () => {
  const now = Date.now();
  const deals = [
    { ...createDeal({ title: '遠い', status: 'active' }), dueAt: now + 5 * 86400000 },
    { ...createDeal({ title: '近い', status: 'active' }), dueAt: now + 1 * 86400000 },
    { ...createDeal({ title: '済み', status: 'paid' }), dueAt: now + 2 * 86400000 },
  ];
  const up = upcomingDeals(deals, now);
  assert.equal(up.length, 2, '入金済みは締切一覧に出さない');
  assert.equal(up[0].title, '近い');
  assert.equal(up[0].daysLeft, 1);
});

test('案件テンプレートの金額は「目安」として範囲で持つ', () => {
  for (const t of JOB_TEMPLATES) {
    assert.ok(Array.isArray(t.feeHint) && t.feeHint.length === 2, `${t.name} の目安が範囲でない`);
    assert.ok(t.feeHint[0] <= t.feeHint[1]);
    assert.ok(t.firstStep, `${t.name} に最初の一歩が無い`);
    assert.ok(t.caution, `${t.name} に注意点が無い`);
    assert.ok(WORKFLOWS.some((w) => w.id === t.workflowId), `${t.name} が知らないワークフローを指している`);
  }
  assert.equal(easiestFirst().length, JOB_TEMPLATES.length);
});

// ───────── 知識の循環 ─────────

test('循環の各段階が数えられる', () => {
  const tasks = [
    {
      steps: [
        { roleId: 'researcher', status: 'done' },
        { roleId: 'analyzer', status: 'done' },
        { roleId: 'reviewer', status: 'pending' },
      ],
    },
  ];
  const knowledge = [{ createdAt: Date.now(), usedCount: 2 }, { createdAt: Date.now(), usedCount: 0 }];
  const stats = cycleStats({ tasks, knowledge });
  const byId = Object.fromEntries(stats.map((s) => [s.id, s.count]));
  assert.equal(byId.collect, 1);
  assert.equal(byId.organize, 1);
  assert.equal(byId.verify, 0);
  assert.equal(byId.store, 2);
  assert.equal(byId.apply, 1, '使われた知識だけを活用に数える');
  assert.equal(weakestStage(stats).id, 'verify');
});

test('知識の増え方が日ごとに出る', () => {
  const now = Date.now();
  const series = growthSeries([{ createdAt: now }, { createdAt: now - 3 * 86400000 }], 7, now);
  assert.equal(series.length, 7);
  assert.equal(series[series.length - 1].total, 2, '累計が増えていく');
});

// ───────── プラン（ハードコード禁止） ─────────

test('接続上限はプラン定義から読む', () => {
  assert.equal(connectionLimit('standard'), 3);
  assert.equal(connectionLimit('pro'), 6);
  assert.equal(connectionLimit('知らないプラン'), PLANS.find((p) => p.id === 'free').maxConnections);
});

test('上限は会社ごとに上書きできる（将来プランを変えても壊れない）', () => {
  assert.equal(connectionLimit('standard', { maxConnections: 99 }), 99);
  assert.equal(employeeLimit('free', { maxEmployees: 500 }), 500);
  assert.equal(connectionLimit('standard', {}), 3, '上書きが無ければプランどおり');
});

test('社内の道具は接続数に数えない', () => {
  const countable = countableTools();
  assert.ok(countable.length < TOOLS.length);
  assert.ok(!countable.some((t) => t.id === 'knowledge'));
});

test('危険な操作を持つ道具はそれを宣言している', () => {
  const gmail = TOOLS.find((t) => t.id === 'gmail');
  assert.ok(gmail.capabilities.includes('send'), '送信できる道具が send を宣言していない');
  for (const t of TOOLS) {
    assert.ok(Array.isArray(t.capabilities) && t.capabilities.length, `${t.name} が capabilities を宣言していない`);
  }
});

// ───────── 保存 ─────────

test('APIキーは書き出しに含めない', () => {
  assert.ok(EXPORT_EXCLUDE.includes(KEYS.secrets), 'キーがバックアップに混ざる');
  assert.equal(new Set(Object.values(KEYS)).size, Object.keys(KEYS).length, '保存キーが重複している');
  for (const key of Object.values(KEYS)) {
    assert.ok(key.startsWith('ouro:'), `${key} に接頭辞が無い（他アプリと衝突する）`);
  }
});

// ───────── 表示 ─────────

test('最小限の Markdown を表示用に分解できる', () => {
  const blocks = toBlocks('# 見出し\n本文です\n- 項目1\n- 項目2\n\n次の段落');
  assert.equal(blocks[0].type, 'heading');
  assert.equal(blocks[1].type, 'p');
  assert.equal(blocks[2].type, 'list');
  assert.deepEqual(blocks[2].items, ['項目1', '項目2']);
  assert.equal(blocks[3].type, 'p');
});
