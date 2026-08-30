// 「会社のルール・改善ログ・完成条件の確認・収益導線」まわりのテスト。
//
// ここで守っているのは主に：
//   ・消せない決まりは、ユーザーのルールで外せない
//   ・社員に覚えさせたことが、次の仕事で必ず読まれる
//   ・完成条件は「決めただけ」で終わらない
//   ・持っていない基準（業界平均など）を作らない

import test from 'node:test';
import assert from 'node:assert/strict';

import { FIXED_RULES, makeRules, addRule, removeRule, rulesPrompt, rulesFilled, normalizeRules } from '../src/lib/rules.js';
import { addNote, removeNote, notesOf, MAX_NOTES } from '../src/lib/memory.js';
import { buildContext } from '../src/lib/memory.js';
import { buildSystemPrompt } from '../src/lib/runtime.js';
import { parseChecklist, checkInstruction, readCheckResult, checkSummary } from '../src/lib/checks.js';
import { createTask, assembleResult, finalOutput } from '../src/lib/workflow.js';
import {
  FUNNEL_STAGES,
  makeFunnel,
  normalizeFunnel,
  stageStats,
  bottleneck,
  labelOf,
  latestEntry,
  startOfWeek,
} from '../src/lib/funnel.js';
import { putEntry, removeEntry, analysisRequest } from '../src/lib/funnelInput.js';
import { openingOf, similarity, similarOpenings } from '../src/lib/opening.js';
import { starterProgress, STARTER_STEPS, inventoryDraft } from '../src/lib/onboarding.js';
import { WORKFLOWS } from '../src/data/workflows.js';

// ───────── ① 会社のルール ─────────

test('消せない決まりは、ユーザーのルールでは外せない', () => {
  let r = makeRules();
  // 「出典は書かなくていい」と足しても、元の決まりは残る
  r = addRule(r, '出典は書かなくてよい');
  const p = rulesPrompt(r);
  for (const fixed of FIXED_RULES) assert.ok(p.includes(fixed), fixed);
  // 消せない決まりは必ず先に来る（あとのルールで上書きさせない）
  assert.ok(p.indexOf(FIXED_RULES[0]) < p.indexOf('出典は書かなくてよい'));
});

test('ルールは足せる・消せる・同じものは重ならない', () => {
  let r = addRule(makeRules(), '実体験を捏造しない');
  r = addRule(r, '実体験を捏造しない');
  assert.equal(r.added.length, 1);
  r = addRule(r, '数字は出典つきで');
  assert.equal(r.added.length, 2);
  r = removeRule(r, '実体験を捏造しない');
  assert.deepEqual(r.added, ['数字は出典つきで']);
});

test('ルールが壊れた形で保存されていても落ちない', () => {
  assert.deepEqual(normalizeRules(null).added, []);
  assert.deepEqual(normalizeRules({ added: 'こわれている' }).added, []);
  assert.deepEqual(normalizeRules({ added: [1, '', 'ok'] }).added, ['ok']);
});

test('会社のルールが社員のプロンプトに入る', () => {
  const company = { name: 'X', rules: addRule(makeRules(), '1見出しは200字まで') };
  const emp = { name: 'ルナ', title: 'リサーチャー', roleId: 'researcher' };
  const p = buildSystemPrompt({ employee: emp, company, contextText: '' });
  assert.ok(p.includes('1見出しは200字まで'));
  assert.ok(p.includes(FIXED_RULES[0]));
});

test('ルールが空でも、消せない決まりだけは必ず入る', () => {
  const p = buildSystemPrompt({ employee: { name: 'A', title: 'B', roleId: 'researcher' }, company: {}, contextText: '' });
  for (const fixed of FIXED_RULES) assert.ok(p.includes(fixed));
});

test('書けている数を数えられる（道しるべで使う）', () => {
  assert.equal(rulesFilled(makeRules()), 0);
  assert.equal(rulesFilled({ ...makeRules(), purpose: 'x' }), 1);
});

// ───────── ② 改善ログ（社員を育てる） ─────────

test('覚えさせたことが、次の仕事で読まれる', () => {
  const emp = { id: 'e1', name: 'ルナ', roleId: 'researcher', memory: { notes: [] } };
  const notes = addNote(emp, '見出しは1つ200字まで');
  const withNotes = { ...emp, memory: { notes } };
  const ctx = buildContext({ employee: withNotes, task: { request: 'x' }, knowledgeList: [] });
  assert.ok(ctx.text.includes('見出しは1つ200字まで'));
  assert.ok(ctx.layers.some((l) => l.layer === 'self'));
});

test('同じことを二度覚えさせても重ならない', () => {
  let emp = { id: 'e1', memory: { notes: [] } };
  emp = { ...emp, memory: { notes: addNote(emp, 'あ') } };
  emp = { ...emp, memory: { notes: addNote(emp, 'あ') } };
  assert.equal(notesOf(emp).length, 1);
});

test('覚えさせすぎても古い方から落ちる', () => {
  let emp = { id: 'e1', memory: { notes: [] } };
  for (let i = 0; i < MAX_NOTES + 5; i += 1) {
    emp = { ...emp, memory: { notes: addNote(emp, `ルール${i}`) } };
  }
  assert.equal(notesOf(emp).length, MAX_NOTES);
  assert.ok(!notesOf(emp).some((n) => n.text === 'ルール0'));
});

test('忘れさせられる', () => {
  const notes = addNote({ id: 'e1', memory: { notes: [] } }, 'あ');
  const emp = { id: 'e1', memory: { notes } };
  assert.equal(removeNote(emp, notes[0].id).length, 0);
});

test('古い形（ただの文字列）で保存されていても読める', () => {
  const emp = { id: 'e1', memory: { notes: ['むかしの書き方'] } };
  assert.equal(notesOf(emp)[0].text, 'むかしの書き方');
});

// ───────── ③ 完成条件の確認 ─────────

test('完成条件を1行ずつに割る', () => {
  const items = parseChecklist('出典が3つ以上ある、実体験を捏造していない。注意点も書いてある');
  assert.deepEqual(items, ['出典が3つ以上ある', '実体験を捏造していない', '注意点も書いてある']);
  assert.deepEqual(parseChecklist(''), []);
});

test('確認の指示には、条件が全部入る', () => {
  const items = ['出典が3つ以上ある', '注意点も書いてある'];
  const inst = checkInstruction(items);
  for (const i of items) assert.ok(inst.includes(i));
  assert.ok(inst.includes('[YES]') && inst.includes('[NO]'));
});

test('○×を読み取れる', () => {
  const items = ['あ', 'い'];
  const r = readCheckResult('- [YES] あ\n- [NO] い — 足りません', items);
  assert.equal(r.parsed, true);
  assert.deepEqual(r.items.map((x) => x.ok), [true, false]);
  assert.equal(r.items[1].reason, '足りません');
});

test('読み取れない答えを「合格」にしない', () => {
  const r = readCheckResult('だいたい大丈夫だと思います。', ['あ', 'い']);
  assert.equal(r.parsed, false);
});

test('完成条件を書くと、確認の手順が最後に足される', () => {
  const t = createTask({
    request: '記事を書いて',
    assign: () => ({ id: 'e1', name: 'A' }),
    doneWhen: '出典が3つ以上ある、注意点も書いてある',
  });
  const check = t.steps.filter((s) => s.kind === 'check');
  assert.equal(check.length, 1);
  assert.equal(t.steps[t.steps.length - 1].kind, 'check');
  assert.equal(t.checkUnstaffed, false);
});

test('完成条件が無ければ、確認の手順は足さない', () => {
  const t = createTask({ request: '記事を書いて', assign: () => ({ id: 'e1', name: 'A' }) });
  assert.equal(t.steps.some((s) => s.kind === 'check'), false);
});

test('確認の担当がいなければ、黙って落とさず印を残す', () => {
  const t = createTask({ request: '記事を書いて', assign: () => null, doneWhen: '出典が3つ以上ある' });
  assert.equal(t.checkUnstaffed, true);
});

test('確認の手順は上限（maxSteps）で切り落とされない', () => {
  const t = createTask({
    request: '調べて、まとめて、書いて、確かめて',
    maxSteps: 1,
    assign: () => ({ id: 'e1', name: 'A' }),
    doneWhen: '出典が3つ以上ある',
  });
  assert.ok(t.steps.some((s) => s.kind === 'check'));
});

test('確認の結果は提出物に混ざらない', () => {
  const t = {
    steps: [
      { id: 'a', group: 0, status: 'done', employeeName: 'A', output: '本文です' },
      { id: 'b', group: 1, status: 'done', kind: 'check', employeeName: 'B', output: '- [YES] 条件' },
    ],
    spec: { doneWhen: '条件' },
  };
  assert.ok(!assembleResult(t).includes('[YES]'));
  assert.ok(!finalOutput(t).includes('[YES]'));
  assert.equal(checkSummary(t).state, 'passed');
});

test('満たしていない条件があれば failed として出る', () => {
  const t = {
    steps: [{ id: 'b', group: 1, status: 'done', kind: 'check', output: '- [YES] あ\n- [NO] い — 足りない' }],
    spec: { doneWhen: 'あ、い' },
  };
  assert.equal(checkSummary(t).state, 'failed');
});

// ───────── ④⑤ 収益導線 ─────────

test('段は4つで、順番は固定', () => {
  assert.equal(FUNNEL_STAGES.length, 4);
  assert.deepEqual(FUNNEL_STAGES.map((s) => s.id), ['reach', 'read', 'lead', 'sale']);
});

test('週の数字は月曜にそろえられ、同じ週は置き換わる', () => {
  const wed = new Date(2026, 7, 26).getTime(); // 水曜
  let f = putEntry(makeFunnel(), { weekStart: wed, values: { reach: 100 } });
  assert.equal(f.entries.length, 1);
  assert.equal(f.entries[0].weekStart, startOfWeek(wed));
  f = putEntry(f, { weekStart: wed + 864e5, values: { reach: 200 } }); // 同じ週の木曜
  assert.equal(f.entries.length, 1);
  assert.equal(f.entries[0].values.reach, 200);
});

test('数字でないものは0として扱う（NaN を残さない）', () => {
  const f = putEntry(makeFunnel(), { weekStart: Date.now(), values: { reach: 'あ', read: -5 } });
  assert.equal(f.entries[0].values.reach, 0);
  assert.equal(f.entries[0].values.read, 0);
});

test('通過率を出す（1段目は母数が無いので null）', () => {
  const f = putEntry(makeFunnel(), { weekStart: Date.now(), values: { reach: 1000, read: 100, lead: 10, sale: 1 } });
  const stats = stageStats(latestEntry(f));
  assert.equal(stats[0].rate, null);
  assert.equal(stats[1].rate, 0.1);
  assert.equal(stats[1].drop, 900);
});

test('詰まっている所は「自分の数字の中の相対」で決める（業界平均を持たない）', () => {
  const f = putEntry(makeFunnel(), { weekStart: Date.now(), values: { reach: 1000, read: 500, lead: 5, sale: 2 } });
  assert.equal(bottleneck(latestEntry(f)).stageId, 'lead');
});

test('途中で0になっていたら、そこが詰まっている所', () => {
  const f = putEntry(makeFunnel(), { weekStart: Date.now(), values: { reach: 1000, read: 500, lead: 0, sale: 0 } });
  const b = bottleneck(latestEntry(f));
  assert.equal(b.stageId, 'lead');
  assert.match(b.reason, /全員/);
});

test('まだ誰も来ていない時は、集めるところから', () => {
  const f = putEntry(makeFunnel(), { weekStart: Date.now(), values: {} });
  assert.equal(bottleneck(latestEntry(f)).stageId, 'reach');
});

test('分析の依頼文に、数字と「3つまで」が入る', () => {
  let f = putEntry(makeFunnel(), { weekStart: Date.now() - 7 * 864e5, values: { reach: 100, read: 50, lead: 5, sale: 1 } });
  f = putEntry(f, { weekStart: Date.now(), values: { reach: 200, read: 60, lead: 3, sale: 1 }, note: '毎日投稿にした' });
  const req = analysisRequest(f);
  assert.ok(req.includes('200'));
  assert.ok(req.includes('前の週との差'));
  assert.ok(req.includes('毎日投稿にした'));
  assert.ok(req.includes('最大3つ'));
  assert.ok(req.includes('推測で埋めない'));
});

test('数字が無ければ、分析の依頼文は作らない', () => {
  assert.equal(analysisRequest(makeFunnel()), '');
});

test('段の呼び名は変えられるが、段そのものは増えない', () => {
  const f = { ...makeFunnel(), labels: { lead: '予約' } };
  assert.equal(labelOf(f, 'lead'), '予約');
  assert.equal(labelOf(f, 'sale'), '買ってもらう');
});

test('週の数字は消せる／壊れた形でも落ちない', () => {
  const f = putEntry(makeFunnel(), { weekStart: Date.now(), values: { reach: 1 } });
  assert.equal(removeEntry(f, f.entries[0].id).entries.length, 0);
  assert.deepEqual(normalizeFunnel({ entries: 'こわれている' }).entries, []);
});

// ───────── ⑧ 書き出しの重なり ─────────

test('書き出しがそっくりなものを見つける', () => {
  const a = 'みなさん、腰痛で悩んでいませんか？今日は3つの方法を紹介します。';
  const b = 'みなさん、肩こりで悩んでいませんか？今日は3つの方法を紹介します。';
  const c = '鍼灸師として15年、いちばん多い相談は「朝の起き上がり」です。';
  assert.ok(similarity(openingOf(a), openingOf(b)) > 0.6);
  assert.ok(similarity(openingOf(a), openingOf(c)) < 0.3);
  const hits = similarOpenings(a, [{ id: '1', title: '前の投稿', text: b }, { id: '2', title: '別', text: c }]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, '1');
});

test('短すぎるものは比べない（当てずっぽうを出さない）', () => {
  assert.deepEqual(similarOpenings('はい。', [{ id: '1', title: 'x', text: 'はい。' }]), []);
});

test('見出しは書き出しに数えない', () => {
  assert.equal(openingOf('# 見出し\n本文がここから'), '本文がここから');
});

// ───────── ⑥⑦⑨ 棚卸し・仕事の流れ・道しるべ ─────────

test('仕事の流れに、横展開・配信文・数字・棚卸しがある', () => {
  const ids = WORKFLOWS.map((w) => w.id);
  for (const id of ['spread', 'letter', 'numbers', 'sort_work']) assert.ok(ids.includes(id), id);
});

test('仕事の流れには読みが必ずある（目次の並びに使う）', () => {
  for (const w of WORKFLOWS) {
    assert.ok(w.reading && /^[ぁ-んー]+$/.test(w.reading), `${w.id} の読み`);
  }
});

test('棚卸しの下書きに、A/B/C の基準が入っている', () => {
  const d = inventoryDraft();
  for (const x of ['A：', 'B：', 'C：', '1つ']) assert.ok(d.includes(x), x);
});

test('道しるべは、実際の状態から済んだかを決める', () => {
  const empty = starterProgress({ company: null, tasks: [], employees: [], funnel: {}, settings: {} });
  assert.equal(empty.doneCount, 0);
  assert.equal(empty.next.id, STARTER_STEPS[0].id);

  const some = starterProgress({
    company: { rules: { ...makeRules(), purpose: '稼ぐ' } },
    tasks: [{ status: 'done', spec: { doneWhen: 'x' }, decisions: [{ state: 'approved' }] }],
    employees: [{ memory: { notes: [{ id: 'n', text: 'x' }] } }],
    funnel: { entries: [{ id: 'w' }] },
    settings: { didInventory: true },
  });
  assert.equal(some.doneCount, some.total);
  assert.equal(some.next, null);
});

test('道しるべの飛び先は、実在する画面だけ', () => {
  const views = ['compose', 'rules', 'ledger', 'approvals', 'funnel'];
  for (const s of STARTER_STEPS) assert.ok(views.includes(s.view), `${s.id} → ${s.view}`);
});

// ───────── 検査で見つかった不具合の再発防止 ─────────

test('収益導線は配列ではなくオブジェクト（空配列で上書きしない）', () => {
  // 起動時の読み込みは REST_KEYS を asArray に通していた。
  // 導線をそこへ通すと毎回 [] になり、次に1件入れた時点で過去の週が全部消える。
  const f = putEntry(makeFunnel(), { weekStart: Date.now(), values: { reach: 10 } });
  assert.ok(!Array.isArray(f));
  assert.equal(normalizeFunnel([]).entries.length, 0);
  assert.equal(normalizeFunnel(f).entries.length, 1);
});

test('確認の手順は必ず単独で最後（同時に走らせない）', () => {
  // 番号を並び順にすると、前の手順と同じ番号になって同時に走り、
  // まだ出来ていない成果物を確認してしまう。
  const t = createTask({
    request: '書いて',
    forceRoles: ['analyzer', ['creator', 'reviewer']],
    assign: () => ({ id: 'e1', name: 'A' }),
    doneWhen: '出典が3つ以上ある',
  });
  const check = t.steps.find((s) => s.kind === 'check');
  const work = t.steps.filter((s) => s.kind !== 'check');
  assert.ok(check.group > Math.max(...work.map((s) => s.group)), '確認が最後でない');
  assert.equal(t.steps.filter((s) => s.group === check.group).length, 1, '確認が単独でない');
});

test('手順が1つの仕事でも、確認は後ろに来る', () => {
  const t = createTask({ request: 'まとめて', assign: () => ({ id: 'e1', name: 'A' }), doneWhen: '条件A' });
  const check = t.steps.find((s) => s.kind === 'check');
  const work = t.steps.filter((s) => s.kind !== 'check');
  assert.ok(check.group > Math.max(...work.map((s) => s.group)));
});

test('古い形の記憶でも id が変わらない（忘れさせるが効く）', () => {
  const emp = { memory: { notes: ['むかしの書き方'] } };
  assert.equal(notesOf(emp)[0].id, notesOf(emp)[0].id);
  assert.equal(removeNote(emp, notesOf(emp)[0].id).length, 0);
});

test('日付の入力欄を UTC として読まない', () => {
  // new Date('2026-09-01') は UTC の午前0時。東の時間帯では前日になる。
  const local = new Date(2026, 8, 1).getTime();
  assert.equal(startOfWeek(local), startOfWeek(new Date(2026, 8, 1).getTime()));
  if (new Date().getTimezoneOffset() < 0) {
    assert.notEqual(new Date('2026-09-01').getTime(), local);
  }
});
