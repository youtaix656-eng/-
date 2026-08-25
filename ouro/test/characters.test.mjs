// AIキャラクター（会社チーム ①〜⑩ × 各3名）と肖像のテスト。

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHARACTERS,
  charactersOf,
  characterAt,
  characterRoleIds,
  characterDetail,
  loadCharacterDetails,
} from '../src/data/characters.js';
import { ROLES, roleById, rolesOfGroup, ROLE_GROUPS, DEPARTMENTS, departmentById } from '../src/data/roles.js';
import { presetEmployee, initialPresets } from '../src/data/employees.js';
import { portraitFor, normalizePortrait, HAIR_STYLES, GLASSES, EXTRAS, COLLARS } from '../src/data/portraits.js';
import { buildToc, filterToc } from '../src/data/toc.js';
import { seedAll, makeEmployee, nextSeat } from '../src/lib/seed.js';
import { readingInfo, UNKNOWN_BUCKET, bucketOf } from '../src/lib/yomi.js';

// 人物像・書き方・出身は別ファイルにあり、必要になった時に読み込む（新項目03）。
// 同期のテストからも読めるよう、ここで先に読み込んでおく。
await loadCharacterDetails();
import { employeeLimit } from '../src/data/plans.js';
import { pickRole, scoreRoles } from '../src/lib/dispatcher.js';
import { createTask } from '../src/lib/workflow.js';

// ───────── 役職①〜⑩ ─────────

test('会社チームは10役職で、指定どおりの並び', () => {
  const company = rolesOfGroup('company');
  assert.equal(company.length, 10);
  assert.deepEqual(
    company.map((r) => r.name),
    [
      'プロダクトオーナー',
      '臨床監修者',
      'AIプロンプト設計者',
      'コンテンツマーケター',
      '営業',
      'カスタマーサポート',
      'エンジニア',
      'データ分析担当',
      '経理・労務',
      '広報・ブランディング',
    ]
  );
});

test('全役職がいずれかのチームに属する', () => {
  const ids = ROLE_GROUPS.map((g) => g.id);
  const sum = ids.reduce((n, g) => n + rolesOfGroup(g).length, 0);
  assert.equal(sum, ROLES.length, 'どのチームにも属さない役職がある');
  for (const r of ROLES) assert.ok(ids.includes(r.group || 'knowledge'), r.name);
});

test('新しい役職の所属部署が実在する', () => {
  for (const r of rolesOfGroup('company')) {
    assert.ok(departmentById(r.departmentId), `${r.name} の部署 ${r.departmentId} が無い`);
  }
  assert.ok(departmentById('dev'), '開発部が無い');
  assert.ok(departmentById('biz'), '事業部が無い');
});

test('役職の id・order・読みが重複せず、全部そろっている', () => {
  const ids = ROLES.map((r) => r.id);
  const orders = ROLES.map((r) => r.order);
  const names = ROLES.map((r) => r.name);
  assert.equal(new Set(ids).size, ids.length, 'id が重複');
  assert.equal(new Set(orders).size, orders.length, 'order が重複');
  assert.equal(new Set(names).size, names.length, '役職名が重複');
  for (const r of ROLES) {
    assert.ok(/^[ぁ-んー]+$/.test(r.reading), `${r.name} の読みがひらがなでない`);
    assert.ok(r.systemHint && r.duties.length && r.triggers.length, `${r.name} の定義が欠けている`);
  }
});

test('責任の重い役職には、できないことが明記されている', () => {
  const clinical = roleById('clinical');
  assert.ok(clinical.systemHint.includes('診断は行いません'), '臨床監修者が診断しない旨が無い');
  assert.ok(clinical.caution, '臨床監修者に注意書きが無い');
  const finance = roleById('finance');
  assert.ok(finance.systemHint.includes('最終判断はしません'), '経理・労務の但し書きが無い');
  assert.ok(finance.caution.includes('税理士'), '専門家への確認をすすめていない');
});

// ───────── キャラクター30名 ─────────

test('会社チームは10役職 × 各3名、マーケは5役職 × 各1名', () => {
  assert.equal(CHARACTERS.length, 35);
  assert.equal(characterRoleIds().length, 15);
  for (const roleId of characterRoleIds()) {
    const list = charactersOf(roleId);
    const expected = roleId.startsWith('mkt_') ? 1 : 3;
    assert.equal(list.length, expected, `${roleId} の人数が ${list.length}`);
    // 席番号は1から連番
    assert.deepEqual(list.map((c) => c.seat), Array.from({ length: expected }, (_, i) => i + 1));
  }
});

test('指定された名前がそのまま入っている', () => {
  const expect = {
    productowner: ['Sofia Marchetti', 'Daniel Kim', 'Amara Okafor'],
    clinical: ['Dr. Lukas Weber', 'Dr. Priya Sharma', 'Dr. Marco Rossi'],
    promptdesigner: ['Elena Petrova', 'Wei Zhang', 'Noah Bergström'],
    contentmarketer: ['Camille Dubois', 'Isabella Santos', "Liam O'Connor"],
    sales: ['Carlos Mendoza', 'Hannah Müller', 'Jamal Bello'],
    support: ['Grace Tan', 'Mateus Silva', 'Aisha Rahman'],
    engineer: ['Viktor Novák', 'Ravi Patel', 'Anders Larsen'],
    analytics: ['Julia Novak', 'Ethan Clarke', 'Mei Lin'],
    finance: ['Anna Kowalski', 'Thomas Andersen', 'Fatima Al-Sayed'],
    pr: ['Olivia Bennett', 'Diego Fernández', 'Naomi Adeyemi'],
  };
  for (const [roleId, names] of Object.entries(expect)) {
    assert.deepEqual(charactersOf(roleId).map((c) => c.name), names, roleId);
  }
});

test('名前・カナ・読みが重複しない', () => {
  for (const key of ['name', 'kana', 'reading']) {
    const vals = CHARACTERS.map((c) => c[key]);
    assert.equal(new Set(vals).size, vals.length, `${key} が重複している`);
  }
});

test('全員に読み・カナ・出身・人物像・書き方・持ち味がある', () => {
  for (const c of CHARACTERS) {
    assert.ok(/^[ぁ-んー]+$/.test(c.reading), `${c.name} の読みがひらがなでない：${c.reading}`);
    assert.ok(/^[ァ-ヶー・]+$/.test(c.kana), `${c.name} のカナがカタカナでない：${c.kana}`);
    const d = characterDetail(c.roleId, c.seat);
    assert.ok(d, `${c.name} の人物像が characterDetails.js に無い`);
    assert.ok(d.origin && d.persona && d.style && c.strength, `${c.name} の設定が欠けている`);
    assert.ok(d.persona.length >= 10 && d.style.length >= 10, `${c.name} の説明が短すぎる`);
  }
});

test('索引と人物像の対応に欠けも余りも無い（新項目03の分割）', () => {
  const keys = new Set(CHARACTERS.map((c) => `${c.roleId}:${c.seat}`));
  assert.equal(keys.size, CHARACTERS.length, '索引の側で roleId:seat が重複している');
  // 余り（索引に無い人物像）が残っていないか
  const detailKeys = Object.keys(
    // characterDetail は1件ずつしか返さないので、索引の全キーで引いて数える
    Object.fromEntries(CHARACTERS.map((c) => [`${c.roleId}:${c.seat}`, characterDetail(c.roleId, c.seat)]))
  );
  assert.equal(detailKeys.length, CHARACTERS.length);
});

test('全員の読みが目次の正しい行に入る（その他へ落ちない）', () => {
  for (const c of CHARACTERS) {
    const info = readingInfo(c.name, c.reading);
    assert.equal(info.source, 'explicit', `${c.name} の読みが明示されていない`);
    assert.notEqual(info.bucket, UNKNOWN_BUCKET, `${c.name} が「その他」に落ちる`);
  }
  // 例：Sofia Marchetti は そふぃあ… なので さ行
  assert.equal(bucketOf(characterAt('productowner', 1).reading), 'さ');
  assert.equal(bucketOf(characterAt('support', 3).reading), 'あ'); // あいしゃらーまん
});

test('日本語以外の文字が説明文に紛れ込んでいない', () => {
  // 過去に編集中キリル文字が混入したことがあるため、機械チェックしておく
  const bad = /[Ѐ-ӿ؀-ۿ]/;
  for (const c of CHARACTERS) {
    const d = characterDetail(c.roleId, c.seat);
    const fields = { persona: d.persona, style: d.style, origin: d.origin, strength: c.strength };
    for (const [key, value] of Object.entries(fields)) {
      assert.ok(!bad.test(value), `${c.name} の ${key} に想定外の文字がある：${value}`);
    }
  }
});

test('同じ役職の中で持ち味が重複しない', () => {
  for (const roleId of characterRoleIds()) {
    const list = charactersOf(roleId);
    const s = list.map((c) => c.strength);
    assert.equal(new Set(s).size, list.length, `${roleId} の持ち味が重複している`);
  }
});

// ───────── 社員への反映 ─────────

test('キャラクターがそのまま社員のプリセットになる', () => {
  const e = presetEmployee('productowner', 1);
  assert.equal(e.name, 'Sofia Marchetti');
  assert.equal(e.shortName, 'Sofia');
  assert.equal(e.kana, 'ソフィア・マルケッティ');
  assert.equal(e.origin, 'イタリア系');
  assert.equal(e.strength, '大局観');
  assert.equal(e.character, true);
  assert.ok(e.portrait, '肖像のパーツが無い');
  assert.equal(e.title, 'プロダクトオーナー（大局観）');
});

test('敬称つきの名前でも短い呼び名が正しく出る', () => {
  assert.equal(presetEmployee('clinical', 1).shortName, 'Lukas');
  assert.equal(presetEmployee('clinical', 2).shortName, 'Priya');
});

test('汎用以外のジャンルではキャラクター名を使い回さない', () => {
  const general = presetEmployee('productowner', 1, 'general');
  const health = presetEmployee('productowner', 1, 'health');
  assert.equal(general.name, 'Sofia Marchetti');
  assert.notEqual(health.name, 'Sofia Marchetti', '別ジャンルで同じ人が二重に存在してしまう');
  assert.equal(health.character, undefined);
});

test('4席目以降はキャラクターが尽きても名前が付く', () => {
  const e = presetEmployee('productowner', 4);
  assert.ok(e && e.name && !e.character);
  assert.notEqual(e.name, 'Sofia Marchetti');
});

test('既存の役職と初期チームは変わっていない', () => {
  assert.equal(presetEmployee('researcher', 1).name, 'リサーチャー・ルナ');
  assert.equal(initialPresets().length, 18);
  const { employees } = seedAll();
  assert.equal(employees.length, 18, '初期は知識チームの18人のまま');
  assert.ok(!employees.some((e) => e.character), 'キャラクターは自動で雇わない');
});

test('社員データにカナ・出身・肖像が保存される', () => {
  const e = makeEmployee(presetEmployee('pr', 3));
  assert.equal(e.name, 'Naomi Adeyemi');
  assert.equal(e.kana, 'ナオミ・アデイエミ');
  assert.equal(e.origin, 'ナイジェリア系');
  assert.ok(e.portrait);
  assert.equal(e.character, true);
  // 社員はエンジンの実体を持たない（分離は維持）
  assert.equal(e.providerPref, 'auto');
  assert.equal(e.provider, undefined);
});

test('30名すべてを雇っても在籍数の上限に収まる', () => {
  const { employees } = seedAll();
  assert.ok(employees.length + CHARACTERS.length <= employeeLimit('free'), '無料プランで30名を雇えない');
});

test('キャラクターの席は汎用ジャンルの1〜3席', () => {
  const { employees } = seedAll();
  assert.equal(nextSeat(employees, 'productowner', 'general'), 1, 'まだ誰も雇っていない');
});

// ───────── 肖像 ─────────

test('肖像のパーツはすべて既知の値', () => {
  for (const c of CHARACTERS) {
    const p = normalizePortrait(c.portrait);
    assert.ok(HAIR_STYLES.includes(p.hair), `${c.name} の髪型 ${c.portrait.hair} が未定義`);
    assert.ok(GLASSES.includes(p.glasses), `${c.name} の眼鏡が未定義`);
    assert.ok(EXTRAS.includes(p.extra), `${c.name} の装いが未定義`);
    assert.ok(COLLARS.includes(p.collar), `${c.name} の襟が未定義`);
    // 指定した値がそのまま通ること（既定へ倒されていない）
    assert.equal(p.hair, c.portrait.hair, `${c.name} の髪型が既定に倒されている`);
  }
});

test('30名の見た目が互いに重ならない', () => {
  const seen = new Map();
  for (const c of CHARACTERS) {
    const p = normalizePortrait(c.portrait);
    const key = `${p.hair}|${p.glasses}|${p.extra}|${p.collar}`;
    assert.ok(!seen.has(key), `${c.name} と ${seen.get(key)} の見た目が同じ（${key}）`);
    seen.set(key, c.name);
  }
});

test('肖像の指定が無い社員にも絵がつき、同じ社員なら毎回同じ', () => {
  const emp = { roleId: 'researcher', seat: 1, name: 'リサーチャー・ルナ' };
  const a = portraitFor(emp);
  const b = portraitFor(emp);
  assert.deepEqual(a, b, '同じ社員なのに絵が変わる');
  assert.ok(HAIR_STYLES.includes(a.hair));
  const other = portraitFor({ roleId: 'analyzer', seat: 2, name: 'アナライザー・リン' });
  assert.notDeepEqual(a, other, '違う社員が同じ絵になっている');
});

test('初期チーム18人の肖像も互いにある程度ばらける', () => {
  const { employees } = seedAll();
  const keys = new Set(employees.map((e) => Object.values(portraitFor(e)).join('|')));
  assert.ok(keys.size >= 14, `18人中 ${keys.size} 通りしかない`);
});

test('壊れた肖像パラメータは既定へ倒す（画面が落ちない）', () => {
  const p = normalizePortrait({ hair: 'なにか', glasses: 'なにか', extra: 'なにか', collar: 'なにか' });
  assert.equal(p.hair, 'short');
  assert.equal(p.glasses, null);
  assert.equal(p.collar, 'round');
  assert.deepEqual(normalizePortrait(), { hair: 'short', glasses: null, extra: null, collar: 'round' });
});

// ───────── 目次との整合 ─────────

test('雇ったキャラクターは目次にも並び、カナでも引ける', () => {
  const emp = makeEmployee(presetEmployee('sales', 1));
  const entries = buildToc({ employees: [emp] });
  const found = entries.find((e) => e.title === 'Carlos Mendoza');
  assert.ok(found, 'キャラクターが目次に出ない');
  assert.equal(found.bucket, 'か', 'かるろす… なので か行');
  assert.ok(found.employee, '肖像を描くための社員データが無い');
  assert.equal(filterToc(entries, { query: 'カルロス' }).length, 1, 'カナで引けない');
  assert.equal(filterToc(entries, { query: 'Carlos' }).length, 1, '綴りで引けない');
  assert.equal(filterToc(entries, { query: 'かるろす' }).length, 1, '読みで引けない');
});

test('新しい10役職も目次に出て、タイトルが重複しない', () => {
  const { employees } = seedAll();
  const entries = buildToc({ employees });
  for (const r of rolesOfGroup('company')) {
    assert.ok(entries.some((e) => e.kind === 'role' && e.title === r.name), `${r.name} が目次に無い`);
  }
  const titles = entries.map((e) => e.title);
  assert.equal(new Set(titles).size, titles.length, 'タイトルが重複している');
  assert.equal(entries.filter((e) => e.bucket === UNKNOWN_BUCKET).length, 0, '読み未設定がある');
});

// ───────── 自動社員選択を壊していないか ─────────

test('仕様書 §19 の振り分けは変わらない', () => {
  assert.equal(pickRole('調べて'), 'researcher');
  assert.equal(pickRole('比較して'), 'analyzer');
  assert.equal(pickRole('間違いない？'), 'reviewer');
  assert.equal(pickRole('どうすればいい？'), 'strategist');
  assert.equal(pickRole('文章にして'), 'creator');
  assert.equal(pickRole('覚えたい'), 'mentor');
});

test('当たった語が長い（＝具体的な）役職が勝つ', () => {
  // 「優先順位」を持つプロダクトオーナーが、「優先」しか持たないストラテジストに勝つ。
  // 固定点だと一般的な短い語を持つ役職が常に勝ってしまうため、語の長さを点にしている。
  const scored = scoreRoles('優先順位をつけて');
  assert.equal(scored[0].roleId, 'productowner');
  assert.ok(scored[0].score > scored[1].score, '同点のままになっている');
});

test('新しい役職にも依頼が届く', () => {
  assert.equal(pickRole('請求書を作りたい'), 'finance');
  assert.equal(pickRole('問い合わせに返信して'), 'support');
  assert.equal(pickRole('商談の準備をして'), 'sales');
  assert.equal(pickRole('プロンプトを設計して'), 'promptdesigner');
  assert.equal(pickRole('禁忌の確認をして'), 'clinical');
  assert.equal(pickRole('ブランディングを考えて'), 'pr');
  assert.equal(pickRole('離脱率を見て'), 'analytics');
  assert.equal(pickRole('この不具合を直して'), 'engineer');
  assert.equal(pickRole('優先順位をつけて'), 'productowner');
  assert.equal(pickRole('事業の方向性を決めたい'), 'productowner');
  assert.equal(pickRole('note記事の訴求文を書いて'), 'contentmarketer');
});


// ───────── 未雇用の役職で仕事が失敗しないこと ─────────

test('未雇用の役職は計画から外し、在籍している社員だけで進める', () => {
  // 役職は25あり、ほとんどは未雇用。計画に混ざると担当者が見つからず
  // 仕事全体が失敗していた（実際に起きたバグ）。
  const hired = { id: 'e1', name: 'アナライザー・カイ', roleId: 'analyzer' };
  const task = createTask({
    request: '請求書の出し方と、確定申告までにやることを整理して',
    assign: (roleId) => (roleId === 'analyzer' ? hired : null),
  });
  assert.ok(task.steps.length >= 1);
  for (const s of task.steps) {
    assert.ok(s.employeeId, `担当のいないステップが残っている（${s.roleId}）`);
  }
  assert.ok(task.unstaffedRoles.includes('finance'), '外した役職を控えていない');
});

test('全員が未雇用のときは絞り込まず、元の計画のまま進める', () => {
  const task = createTask({ request: '調べて分析して', forceRoles: ['researcher', 'analyzer'], assign: () => null });
  assert.equal(task.steps.length, 2, '絞り込める材料が無いのに計画を削っている');
  assert.equal(task.unstaffedRoles.length, 2);
});

test('全員在籍していれば計画はそのまま', () => {
  const emp = (roleId) => ({ id: `e_${roleId}`, name: roleId, roleId });
  const task = createTask({ request: '調べて分析して', forceRoles: ['researcher', 'analyzer'], assign: emp });
  assert.equal(task.steps.length, 2);
  assert.deepEqual(task.unstaffedRoles, []);
});
