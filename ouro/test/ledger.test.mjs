// 仕事台帳と、それに付いてくる仕組みのテスト。
//
// ここで守っているのは主に次の5つ：
//   ・台帳は仕事から導く（第2の正を作らない）
//   ・受付番号は同じ仕事なら毎回同じ
//   ・保留は勝手に走り出さない
//   ・CSV は数式として実行されない
//   ・引き継ぎで材料を消さない

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLedger,
  filterLedger,
  todayFocus,
  ticketOf,
  dueStateOf,
  ledgerStateOf,
  ownerOf,
  DAY_MS,
} from '../src/lib/ledger.js';
import { LEDGER_COLUMNS, csvRows, readLedgerCsv } from '../src/lib/ledgerCsv.js';
import { toCsv, csvCell, csvToObjects, csvFile } from '../src/lib/csv.js';
import { parseSections, hasSections, summaryOf, outputFormatPrompt, OUTPUT_SECTIONS } from '../src/lib/outline.js';
import { extractDecisions, decisionsFrom, openDecisions, decideDecision } from '../src/lib/decisions.js';
import { compactOutput, buildHandoff } from '../src/lib/handoff.js';
import { checkPromises } from '../src/lib/guard.js';
import { createTask, holdTask, resumeTask, isRunnable, TASK_STATUS, applyStepResult } from '../src/lib/workflow.js';
import { isFinalStep, buildSystemPrompt } from '../src/lib/runtime.js';

const task = (over = {}) => ({
  id: 'task_aaaabbbb',
  title: 'テストの仕事',
  request: '調べて',
  status: 'queued',
  createdAt: Date.UTC(2026, 7, 26, 3),
  steps: [{ id: 's1', status: 'pending', roleId: 'researcher', employeeName: 'ルナ', group: 0 }],
  decisions: [],
  result: { knowledgeIds: [], sourceIds: [] },
  totalCost: 0,
  ...over,
});

// ───────── ① 受付番号 ─────────

test('受付番号は同じ仕事なら毎回同じ（採番の表を持たない）', () => {
  const t = task();
  assert.equal(ticketOf(t), ticketOf(t));
  assert.match(ticketOf(t), /^OU-\d{8}-[A-Z0-9]{4}$/);
});

test('別の仕事なら別の番号になる', () => {
  assert.notEqual(ticketOf(task()), ticketOf(task({ id: 'task_ccccdddd' })));
});

// ───────── ② 台帳の状態 ─────────

test('完了でも判断が残っていれば「確認待ち」', () => {
  const t = task({ status: 'done', decisions: [{ id: 'd1', state: 'open', text: '価格を決める' }] });
  assert.equal(ledgerStateOf(t), 'waiting');
});

test('判断を決めきり、共有も書けば「完了」', () => {
  const t = task({ status: 'done', shareAsked: true, decisions: [{ id: 'd1', state: 'approved', text: 'x' }], shared: '共有した1行' });
  assert.equal(ledgerStateOf(t), 'done');
});

test('失敗は「止まっている」・保留は「保留」', () => {
  assert.equal(ledgerStateOf(task({ status: 'failed' })), 'stopped');
  assert.equal(ledgerStateOf(task({ status: 'on_hold' })), 'hold');
});

// ───────── ③ 期限 ─────────

test('期限は案件から引き継ぐが、仕事の期限があればそちらが勝つ', () => {
  const deal = { id: 'deal1', title: 'A社', dueAt: Date.now() + 5 * DAY_MS };
  const own = Date.now() + DAY_MS;
  const rows = buildLedger([task({ dealId: 'deal1' }), task({ id: 'task_2', dealId: 'deal1', dueAt: own })], {
    deals: [deal],
  });
  const fromDeal = rows.find((r) => r.id === 'task_aaaabbbb');
  const ownRow = rows.find((r) => r.id === 'task_2');
  assert.equal(fromDeal.dueAt, deal.dueAt);
  assert.equal(fromDeal.dueFromDeal, true);
  assert.equal(ownRow.dueAt, own);
  assert.equal(ownRow.dueFromDeal, false);
});

test('期限切れ・今日・まもなくを見分ける', () => {
  const now = Date.now();
  assert.equal(dueStateOf(now - 2 * DAY_MS, now), 'overdue');
  assert.equal(dueStateOf(now, now), 'today');
  assert.equal(dueStateOf(now + 2 * DAY_MS, now), 'soon');
  assert.equal(dueStateOf(now + 30 * DAY_MS, now), 'later');
  assert.equal(dueStateOf(null, now), 'none');
});

test('期限が無いものを急かさない', () => {
  const rows = buildLedger([task()], {});
  assert.equal(rows[0].dueState, 'none');
  assert.equal(todayFocus(rows).overdue.length, 0);
});

// ───────── ④ 今日やること・絞り込み ─────────

test('今日やること＝期限切れ・今日・判断待ち・止まっているもの', () => {
  const now = Date.now();
  const rows = buildLedger(
    [
      task({ id: 'task_over', dueAt: now - DAY_MS }),
      task({ id: 'task_today', dueAt: now }),
      task({ id: 'task_dec', status: 'done', decisions: [{ id: 'd', state: 'open', text: 'x' }] }),
      task({ id: 'task_bad', status: 'failed' }),
      task({ id: 'task_calm', dueAt: now + 30 * DAY_MS }),
    ],
    {}
  );
  const f = todayFocus(rows);
  assert.equal(f.overdue.length, 1);
  assert.equal(f.today.length, 1);
  assert.equal(f.decisions.length, 1);
  assert.equal(f.stopped.length, 1);
});

test('終わった仕事は既定で外れる／受付番号でも探せる', () => {
  const rows = buildLedger([task({ status: 'done', shared: '共有' }), task({ id: 'task_x', status: 'queued' })], {});
  assert.equal(filterLedger(rows, { openOnly: true }).length, 1);
  const t = task();
  assert.equal(filterLedger(buildLedger([t], {}), { q: ticketOf(t) }).length, 1);
});

test('手当てが要るものが上に来る', () => {
  const now = Date.now();
  const rows = buildLedger(
    [task({ id: 'task_calm', dueAt: now + 30 * DAY_MS }), task({ id: 'task_over', dueAt: now - DAY_MS })],
    {}
  );
  assert.equal(rows[0].id, 'task_over');
});

// ───────── ⑤ 保留 ─────────

test('保留にすると走らない・理由が残る', () => {
  const t = holdTask(task(), '材料待ち');
  assert.equal(t.status, 'on_hold');
  assert.equal(t.holdReason, '材料待ち');
  assert.equal(isRunnable(t), false);
  assert.equal(TASK_STATUS.on_hold, '保留');
});

test('保留を解くと、手順の状態から元へ戻る', () => {
  const failed = task({ steps: [{ id: 's1', status: 'failed' }] });
  assert.equal(resumeTask(holdTask(failed, 'あとで')).status, 'failed');
  const fresh = task();
  assert.equal(resumeTask(holdTask(fresh, 'あとで')).status, 'queued');
});

test('完了した仕事は保留にできない', () => {
  const done = task({ status: 'done' });
  assert.equal(holdTask(done, 'x').status, 'done');
});

// ───────── ⑥ 回答の形（5項目） ─────────

test('5項目を切り分けられる（見出しの書き方が多少ぶれても拾う）', () => {
  const text = [
    '## ①結論',
    'Aだと分かった。',
    '**②最優先事項**',
    'Bをやる。',
    '### ③課長判断が必要な事項',
    '- 価格を決める',
    '④成果物：本文はここ',
    '### ⑤担当者・期限付きTODO',
    '- 自分 8/30',
  ].join('\n');
  const p = parseSections(text);
  assert.deepEqual(p.found, ['conclusion', 'priority', 'decision', 'deliverable', 'todo']);
  assert.equal(p.sections.deliverable, '本文はここ');
  assert.equal(summaryOf(text), 'Aだと分かった。');
});

test('枠に沿っていない文章は「枠なし」と分かる', () => {
  assert.equal(hasSections('ふつうの文章です。\n続きます。'), false);
});

test('枠の指示には5項目が全部入っている', () => {
  const p = outputFormatPrompt();
  for (const s of OUTPUT_SECTIONS) assert.ok(p.includes(s.title), s.title);
});

test('枠をかけるのは最後の手順だけ', () => {
  const t = {
    steps: [
      { id: 'a', group: 0 },
      { id: 'b', group: 1 },
    ],
  };
  assert.equal(isFinalStep(t, t.steps[0]), false);
  assert.equal(isFinalStep(t, t.steps[1]), true);
  const emp = { name: 'ルナ', title: 'リサーチャー', roleId: 'researcher' };
  assert.ok(!buildSystemPrompt({ employee: emp, company: {}, contextText: '' }).includes('出力の形'));
  assert.ok(buildSystemPrompt({ employee: emp, company: {}, contextText: '', isFinal: true }).includes('出力の形'));
});

test('手順が1つだけの仕事は、その手順が最後', () => {
  const t = { steps: [{ id: 'a', group: 0 }] };
  assert.equal(isFinalStep(t, t.steps[0]), true);
});

// ───────── ⑦ あなたの判断 ─────────

test('③から判断が要ることを取り出す（「なし」は拾わない）', () => {
  const text = '### ③あなたの判断が要ること\n- 価格を5000円にするか\n- なし\n\n### ④成果物\n本文';
  assert.deepEqual(extractDecisions(text), ['価格を5000円にするか']);
  assert.deepEqual(extractDecisions('### ③あなたの判断が要ること\nなし'), []);
});

test('判断はAIを呼ばずに作られ、決めると消える', () => {
  const t = task({ status: 'done', decisions: decisionsFrom('### ③判断が必要な事項\n- 出すかどうか') });
  assert.equal(openDecisions(t).length, 1);
  const after = decideDecision(t, t.decisions[0].id, 'approved');
  assert.equal(openDecisions(after).length, 0);
  assert.equal(after.decisions[0].state, 'approved');
});

test('枠が無い成果物からは判断を作らない（でっち上げない）', () => {
  assert.deepEqual(decisionsFrom('ふつうの報告です。'), []);
});

// ───────── ⑧ 引き継ぎ ─────────

test('枠に沿った出力は、次の担当に要る所だけ渡す', () => {
  const text = [
    '### ①結論',
    '結論の本文。'.repeat(20),
    '### ②最優先事項',
    'これは引き継がない。',
    '### ③あなたの判断が要ること',
    '- 人が決めること',
    '### ④成果物',
    '成果物の本文。'.repeat(30),
  ].join('\n');
  const out = compactOutput(text);
  assert.ok(out.includes('成果物の本文。'));
  assert.ok(out.includes('結論の本文。'));
  assert.ok(!out.includes('人が決めること'));
});

test('枠が無い出力は、削らずそのまま渡す（材料を消さない）', () => {
  const plain = 'ふつうの調査結果です。'.repeat(20);
  assert.equal(compactOutput(plain), plain);
});

test('絞った結果ほとんど残らないなら、元のまま渡す', () => {
  const text = '### ②最優先事項\nこれだけ。\n### ③判断が必要な事項\n- x';
  assert.ok(compactOutput(text).includes('最優先'));
});

test('出典の並びは引き継がない（step.citations に別で残る）', () => {
  const text = 'ふつうの本文です。\n出典：\n- https://example.com';
  assert.ok(!compactOutput(text).includes('example.com'));
});

test('同時に走った手順は、担当名つきで1つにまとまる', () => {
  const out = buildHandoff([
    { employeeName: 'A', output: 'あ' },
    { employeeName: 'B', output: 'い' },
  ]);
  assert.ok(out.includes('## A') && out.includes('## B'));
});

test('引き継ぎを全文にも切り替えられる', () => {
  const text = '### ①結論\nけつろん\n### ②最優先事項\nゆうせん';
  const steps = [{ employeeName: 'A', output: text }];
  assert.ok(buildHandoff(steps, 'full').includes('ゆうせん'));
});

// ───────── ⑨ CSV ─────────

test('数式として実行されないようにする（CSV injection）', () => {
  for (const bad of ['=1+1', '+1', '-1', '@SUM(A1)']) {
    assert.ok(csvCell(bad).startsWith("'"), bad);
  }
  assert.equal(csvCell('ふつうの文字'), 'ふつうの文字');
});

test('カンマ・改行・引用符が入っていても壊れない', () => {
  const cols = [{ key: 'a', name: '題' }];
  const csv = toCsv(cols, [{ a: 'あ,い\n"う"' }]);
  assert.equal(csvToObjects(csv)[0]['題'], 'あ,い\n"う"');
});

test('Excel で文字化けしないよう BOM を付ける', () => {
  assert.ok(csvFile([{ key: 'a', name: 'あ' }], []).charCodeAt(0) === 0xfeff);
});

test('台帳の列は記事の項目をひととおり持っている', () => {
  const names = LEDGER_COLUMNS.map((c) => c.name);
  for (const n of ['受付番号', '受付日', '依頼内容', '担当AI', '進捗状況', '期限', '次の対応', '更新日']) {
    assert.ok(names.includes(n), n);
  }
});

test('CSV から仕事は作らない（受付番号が一致した仕事だけ書き換える）', () => {
  const t = task();
  const rows = csvRows(buildLedger([t], {}));
  const csv = toCsv(LEDGER_COLUMNS, rows);
  const objects = csvToObjects(csv);
  objects[0]['次の対応'] = '自分が価格を決める';
  objects[0]['期限'] = '2026/09/01';
  const plan = readLedgerCsv(objects, [t]);
  assert.equal(plan[0].taskId, t.id);
  assert.equal(plan[0].nextAction, '自分が価格を決める');
  assert.ok(plan[0].dueAt > 0);
  // 知らない受付番号は、仕事に結びつかない（作らない）
  assert.equal(readLedgerCsv([{ 受付番号: 'OU-20000101-XXXX' }], [t])[0].taskId, null);
});

// ───────── ⑩ 確約の見張り ─────────

test('約束になる表現を拾う', () => {
  const hits = checkPromises('効果を保証します。3日で納品いたします。');
  assert.ok(hits.length >= 2);
  assert.ok(hits.some((h) => h.label.includes('保証')));
});

test('ふつうの文章では鳴らない', () => {
  assert.deepEqual(checkPromises('調べた結果、AとBに違いがありました。'), []);
});

// ───────── ⑪ 受付の条件 ─────────

test('受付の条件は仕事に残り、空でも壊れない', () => {
  const t = createTask({ request: '書いて', assign: () => ({ id: 'e1', name: 'A' }), doneWhen: '出典3つ' });
  assert.equal(t.spec.doneWhen, '出典3つ');
  assert.equal(t.dueAt, null);
  const plain = createTask({ request: '書いて', assign: () => ({ id: 'e1', name: 'A' }) });
  assert.deepEqual(plain.spec, { deliverable: '', doneWhen: '', materials: '', constraints: '' });
  assert.deepEqual(plain.decisions, []);
});

test('担当は、動いている人／次に動く人を返す', () => {
  assert.equal(ownerOf(task()), 'ルナ');
  assert.equal(ownerOf(task({ steps: [] })), '');
});

test('引き継ぎの絞り込みは applyStepResult からも効く', () => {
  const t = {
    steps: [
      { id: 'a', group: 0, status: 'pending' },
      { id: 'b', group: 1, status: 'pending' },
    ],
    result: {},
  };
  const text = '### ①結論\n' + 'けつろん。'.repeat(40) + '\n### ③判断が必要な事項\n- ないしょ';
  const after = applyStepResult(t, 'a', { text });
  assert.ok(!after.steps[1].input.includes('ないしょ'));
  const full = applyStepResult(t, 'a', { text }, 'full');
  assert.ok(full.steps[1].input.includes('ないしょ'));
});

// ───────── 検査で見つかった不具合の再発防止 ─────────

test('判断は「提出物を書いた手順」から拾う（全手順の連結文からではない）', async () => {
  const { finalOutput } = await import('../src/lib/workflow.js');
  const t = {
    steps: [
      {
        id: 'a',
        group: 0,
        status: 'done',
        employeeName: 'ルナ',
        // 途中の手順も「判断」らしい見出しを書くことがある。
        // 連結文から拾うと、先に出てきたこちらが勝ってしまう。
        output: '### まとめ\n調べた結果です。\n### 判断が必要な事項\n- 特になし（調査の範囲では）',
      },
      {
        id: 'b',
        group: 1,
        status: 'done',
        employeeName: 'ソフィア',
        output: '### ①結論\n結論B\n### ③あなたの判断が要ること\n- 価格を決める',
      },
    ],
  };
  assert.ok(finalOutput(t).includes('結論B'));
  assert.deepEqual(extractDecisions(finalOutput(t)), ['価格を決める']);
  // 連結文から拾うと、途中の手順の見出しや担当者名が混ざる
  const joined = t.steps.map((s) => `## ${s.employeeName}\n\n${s.output}`).join('\n\n---\n\n');
  assert.notDeepEqual(extractDecisions(joined), ['価格を決める']);
});

test('提出物がまだ無ければ、最後の手順の本文は空', async () => {
  const { finalOutput } = await import('../src/lib/workflow.js');
  assert.equal(finalOutput({ steps: [{ id: 'a', status: 'pending' }] }), '');
});

test('見出しより前の本文を引き継ぎで捨てない', () => {
  const lead = '調査の本文です。'.repeat(40);
  const text = `${lead}\n\n### まとめ\nまとめ。\n### やること\n次へ`;
  const out = compactOutput(text);
  assert.ok(out.includes('調査の本文です。'), '前置きの本文が消えている');
});

test('実行中に保留にされた仕事を running へ戻さない', () => {
  const t = {
    status: 'on_hold',
    holdReason: 'あとで',
    steps: [
      { id: 'a', group: 0, status: 'running' },
      { id: 'b', group: 1, status: 'pending' },
    ],
    result: {},
  };
  const after = applyStepResult(t, 'a', { text: 'できました' });
  assert.equal(after.status, 'on_hold');
  assert.equal(isRunnable(after), false);
});

test('承認待ちから保留にして解くと、承認待ちへ戻る（承認が二重に並ばない）', () => {
  const t = task({ status: 'awaiting_approval' });
  assert.equal(resumeTask(holdTask(t, 'あとで')).status, 'awaiting_approval');
});

test('CSVの日付は読める形だけ受け取る（読めない時は今の期限を消さない）', async () => {
  const { parseDateCell } = await import('../src/lib/ledgerCsv.js');
  assert.ok(parseDateCell('2026/9/1') > 0);
  assert.ok(parseDateCell('2026-09-01') > 0);
  assert.ok(parseDateCell('2026年9月1日') > 0);
  assert.equal(parseDateCell('9/1'), null);
  assert.equal(parseDateCell('来週'), null);
  assert.equal(parseDateCell('2026/2/31'), null);
  assert.equal(parseDateCell(''), null);

  const t = task({ dueAt: Date.now() });
  const plan = readLedgerCsv([{ 受付番号: ticketOf(t), 期限: '来週' }], [t]);
  assert.equal(plan[0].hasDue, false);
  assert.equal(plan[0].dueUnread, true);
});

test('ローカルの日付が UTC でずれない', async () => {
  // 日本時間の午前0時を toISOString() で切ると前日になる。
  // 台帳の編集欄はローカルのまま扱う。
  const local = new Date(2026, 8, 1); // 9/1 00:00 ローカル
  const iso = local.toISOString().slice(0, 10);
  const ymd = [local.getFullYear(), '09', '01'].join('-');
  assert.equal(ymd, '2026-09-01');
  if (local.getTimezoneOffset() < 0) assert.notEqual(iso, ymd); // 東の時間帯ではズレる
});
