// 社員どうしが進み具合を共有する仕組み（10件）のテスト。
//
// ここで守っているのは主に：
//   ・共有のためにAIを呼ばない（呼ぶのは会議と相談だけ）
//   ・掲示板は溜める場所ではない（30日で消える）
//   ・中身の無い掲示を作らない
//   ・全員が賛成する会議を黙って通さない

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  makePost,
  addPost,
  removePost,
  livePosts,
  prunePosts,
  boardPrompt,
  extractShare,
  BOARD_TTL_DAYS,
  MAX_POSTS,
  kindById,
} from '../src/lib/board.js';
import { buildPresence, presenceOf, presenceCounts, presenceState } from '../src/lib/presence.js';
import { buildStandup, standupText, standupSummaryPrompt, alreadyHeld } from '../src/lib/standup.js';
import { relatedTasks, relatedPrompt, overlap, NEAR } from '../src/lib/related.js';
import { buildBriefing, weeklyTopic, weeklyPrompt } from '../src/lib/briefing.js';
import { consultPrompt, gapPrompt, supplementPrompt, trimAnswer, isNothing, MAX_ANSWER_LINES } from '../src/lib/consult.js';
import {
  createMeeting,
  hasGuard,
  GUARD_ROLE_IDS,
  opinionPrompt,
  rebuttalPrompt,
  synthesisPrompt,
  meetingTakeaways,
  estimatedCalls,
} from '../src/lib/meeting.js';
import { buildContext } from '../src/lib/memory.js';
import { SOURCE_TYPES, ORIGINS } from '../src/lib/knowledge.js';
import { roleById } from '../src/data/roles.js';
import { redoFrom, redoCount } from '../src/lib/workflow.js';

const DAY = 24 * 60 * 60 * 1000;
const task = (over = {}) => ({
  id: 't1',
  title: 'テストの仕事',
  request: '腰痛について調べて記事を書いて',
  status: 'running',
  createdAt: Date.now(),
  steps: [],
  decisions: [],
  ...over,
});

// ───────── ① 社内掲示板 ─────────

test('掲示板は30日で消える（溜める場所にしない）', () => {
  const now = Date.now();
  const old = { ...makePost({ text: '古い連絡です' }), at: now - (BOARD_TTL_DAYS + 1) * DAY };
  const fresh = makePost({ text: '新しい連絡です' });
  const board = [old, fresh];
  assert.equal(livePosts(board, now).length, 1);
  assert.equal(prunePosts(board, now).length, 1);
});

test('同じ本文を二度貼らない（同じ仕事を2回実行した時のため）', () => {
  let b = [];
  b = addPost(b, makePost({ text: '出典は2024年版が最新です', taskId: 't1' }));
  b = addPost(b, makePost({ text: '出典は2024年版が最新です', taskId: 't1' }));
  assert.equal(b.length, 1);
  // 別の仕事からなら残る
  b = addPost(b, makePost({ text: '出典は2024年版が最新です', taskId: 't2' }));
  assert.equal(b.length, 2);
});

test('掲示板は増えすぎない・消せる', () => {
  let b = [];
  for (let i = 0; i < MAX_POSTS + 10; i += 1) b = addPost(b, makePost({ text: `連絡${i}` }));
  assert.equal(b.length, MAX_POSTS);
  const id = b[0].id;
  assert.equal(removePost(b, id).length, MAX_POSTS - 1);
});

test('社員に読ませるのは新しい方から数件だけ', () => {
  let b = [];
  for (let i = 0; i < 20; i += 1) b = addPost(b, makePost({ text: `連絡${i}`, employeeName: 'ルナ' }));
  const p = boardPrompt(b, { limit: 5 });
  assert.equal(p.split('\n').length, 6); // 見出し + 5件
  assert.ok(p.includes('連絡19'));
  assert.ok(!p.includes('連絡0\n'));
});

test('自分の仕事の掲示は自分に読ませない（同じことを読み返さない）', () => {
  const b = addPost([], makePost({ text: 'この仕事で分かったこと', taskId: 't1' }));
  assert.equal(boardPrompt(b, { exceptTaskId: 't1' }), '');
  assert.ok(boardPrompt(b, { exceptTaskId: 't2' }).includes('この仕事で分かったこと'));
});

test('中身の無い掲示を作らない（拾えなければ空）', () => {
  assert.equal(extractShare('ふつうの文章です。特筆すべきことはありません'), '');
  assert.equal(extractShare(''), '');
  assert.ok(extractShare('- 注意：この統計は2023年のもので、要確認です').includes('注意'));
});

test('空の掲示は貼られない', () => {
  assert.equal(addPost([], makePost({ text: '   ' })).length, 0);
});

test('掲示の種類は必ず決まった中から選ばれる', () => {
  assert.equal(kindById('でたらめ').id, 'share');
  assert.equal(makePost({ text: 'x', kind: 'でたらめ' }).kind, 'share');
});

// ───────── ③ 在席ボード ─────────

test('在席はAIを呼ばずに仕事から決まる', () => {
  const emp = { id: 'e1', name: 'ルナ' };
  const running = task({ steps: [{ employeeId: 'e1', status: 'running', instruction: '調べる' }] });
  assert.equal(presenceOf(emp, [running]).state, 'running');
  const waiting = task({ status: 'awaiting_approval', steps: [{ employeeId: 'e1', status: 'pending' }] });
  assert.equal(presenceOf(emp, [waiting]).state, 'waiting');
  const held = task({ status: 'on_hold', holdReason: '材料待ち', steps: [{ employeeId: 'e1', status: 'pending' }] });
  assert.equal(presenceOf(emp, [held]).note, '材料待ち');
  assert.equal(presenceOf(emp, []).state, 'idle');
});

test('判断待ちの仕事を持つ社員は「あなた待ち」', () => {
  const emp = { id: 'e1', name: 'ルナ' };
  const t = task({ status: 'done', decisions: [{ state: 'open', text: 'x' }], steps: [{ employeeId: 'e1', status: 'done' }] });
  assert.equal(presenceOf(emp, [t]).state, 'waiting');
});

test('手当てが要る人から順に並ぶ', () => {
  const employees = [
    { id: 'idle', name: '手あき' },
    { id: 'run', name: '実行中' },
  ];
  const tasks = [task({ steps: [{ employeeId: 'run', status: 'running' }] })];
  const rows = buildPresence(employees, tasks);
  assert.equal(rows[0].employee.id, 'run');
  assert.equal(presenceCounts(rows).idle, 1);
  assert.equal(presenceState('でたらめ').id, 'idle');
});

// ───────── ② 朝会 ─────────

test('朝会はAIを呼ばずに作れる', () => {
  const now = Date.now();
  const employees = [{ id: 'e1', name: 'ルナ', roleId: 'researcher' }];
  const tasks = [
    task({ id: 'a', title: '記事', steps: [{ employeeId: 'e1', status: 'done', finishedAt: now - 1000 }, { employeeId: 'e1', status: 'pending' }] }),
    task({ id: 'b', title: '相場', status: 'failed', steps: [{ employeeId: 'e1', status: 'failed' }] }),
  ];
  const st = buildStandup({ tasks, employees, now });
  assert.equal(st.counts.people, 1);
  assert.equal(st.counts.done, 1);
  assert.equal(st.counts.blocked, 1);
  const text = standupText(st);
  assert.ok(text.includes('ルナ'));
  assert.ok(text.includes('詰まっていること'));
});

test('動いていない社員は朝会に並べない（人数ぶん呼ばないため）', () => {
  const st = buildStandup({ tasks: [], employees: [{ id: 'e1', name: '手あき' }], now: Date.now() });
  assert.equal(st.rows.length, 0);
  assert.ok(standupText(st).includes('動いている仕事はありません'));
});

test('書記への指示は「推測で数字を作らない」を含む', () => {
  const st = buildStandup({ tasks: [], employees: [], now: Date.now() });
  const p = standupSummaryPrompt(st);
  assert.ok(p.includes('3行'));
  assert.ok(p.includes('推測'));
});

test('今日もう開いたかが分かる', () => {
  const now = Date.now();
  assert.equal(alreadyHeld(now, now), true);
  assert.equal(alreadyHeld(now - 2 * DAY, now), false);
  assert.equal(alreadyHeld(0, now), false);
});

// ───────── ④ 関係する仕事 ─────────

test('日本語でも「似た依頼」を見つけられる', () => {
  assert.ok(overlap('腰痛について調べて記事を書いて', '腰痛の記事作成の相場を調べて') >= NEAR);
  assert.ok(overlap('腰痛について調べて記事を書いて', '猫の写真をSNSに投稿する') < NEAR);
});

test('同じ案件・同じ担当・似た依頼の順に拾う', () => {
  const now = Date.now();
  const me = task({ id: 'me', dealId: 'd1', steps: [{ employeeId: 'e1' }] });
  const others = [
    task({ id: 'same-deal', title: '同じ案件', dealId: 'd1', createdAt: now }),
    task({ id: 'same-emp', title: '同じ担当', steps: [{ employeeId: 'e1' }], createdAt: now }),
    task({ id: 'far', title: '別', request: '猫の写真', createdAt: now }),
  ];
  const rows = relatedTasks(me, others, { now });
  assert.equal(rows[0].task.id, 'same-deal');
  assert.ok(rows.some((r) => r.task.id === 'same-emp'));
  assert.ok(!rows.some((r) => r.task.id === 'far'));
});

test('古い仕事・中止した仕事は持ち出さない', () => {
  const now = Date.now();
  const me = task({ id: 'me' });
  const others = [
    task({ id: 'old', title: '古い', createdAt: now - 90 * DAY }),
    task({ id: 'cancelled', title: '中止', status: 'cancelled', createdAt: now }),
  ];
  assert.deepEqual(relatedTasks(me, others, { now }), []);
});

test('関係する仕事は数行だけ渡す', () => {
  const now = Date.now();
  const me = task({ id: 'me', dealId: 'd1' });
  const others = Array.from({ length: 10 }, (_, i) =>
    task({ id: `x${i}`, title: `仕事${i}`, dealId: 'd1', createdAt: now })
  );
  const rows = relatedTasks(me, others, { now });
  assert.ok(rows.length <= 4);
  const p = relatedPrompt(rows);
  assert.ok(p.includes('二度調べないでください'));
  assert.ok(p.includes('進行中') || p.includes('完了'));
});

test('関係する仕事が無ければ何も足さない', () => {
  assert.equal(relatedPrompt([]), '');
});

// ───────── 社員が読むもの（共通記憶が届いているか）─────────

test('掲示板と関係する仕事が、社員の読むものに入る', () => {
  const ctx = buildContext({
    employee: { id: 'e1', name: 'ルナ', roleId: 'researcher' },
    task: task(),
    knowledgeList: [],
    boardText: '## 社内で共有されていること\n- 【共有】ルナ：統計は2024年版',
    relatedText: '## いま社内で動いている、関係する仕事\n- 「相場調査」',
  });
  assert.ok(ctx.text.includes('統計は2024年版'));
  assert.ok(ctx.text.includes('相場調査'));
  assert.ok(ctx.layers.some((l) => l.layer === 'board'));
  assert.ok(ctx.layers.some((l) => l.layer === 'related'));
});

test('共有するものが無ければ、読むものは増えない', () => {
  const ctx = buildContext({ employee: { id: 'e1', roleId: 'researcher' }, task: task(), knowledgeList: [] });
  assert.ok(!ctx.layers.some((l) => l.layer === 'board'));
  assert.ok(!ctx.layers.some((l) => l.layer === 'related'));
});

// ───────── ⑥⑦ 会議の材料と週次レビュー ─────────

test('会議の材料に、仕事・数字・掲示板が入る', () => {
  const now = Date.now();
  const tasks = [task({ id: 'a', title: '記事を書く', status: 'running', steps: [{ employeeId: 'e1', employeeName: 'ルナ', status: 'running' }] })];
  const funnel = { labels: {}, entries: [{ id: 'w', weekStart: now, values: { reach: 1000, read: 100, lead: 5, sale: 1 }, note: '' }] };
  const board = addPost([], makePost({ text: '統計は2024年版が最新', employeeName: 'ルナ' }));
  const brief = buildBriefing({ tasks, deals: [], funnel, board, now });
  assert.ok(brief.includes('記事を書く'));
  assert.ok(brief.includes('1000'));
  assert.ok(brief.includes('統計は2024年版が最新'));
});

test('材料が長くなりすぎない', () => {
  const now = Date.now();
  const tasks = Array.from({ length: 50 }, (_, i) => task({ id: `t${i}`, title: `とても長い仕事の名前${i}`.repeat(5), status: 'running' }));
  assert.ok(buildBriefing({ tasks, now }).length <= 1900);
});

test('材料が何も無ければ空（無い材料を作らない）', () => {
  assert.equal(buildBriefing({ tasks: [], deals: [], funnel: null, board: [] }), '');
});

test('配った材料が、意見・反論・統合すべてに渡る', () => {
  const m = '## いま動いている仕事\n- 「記事」';
  assert.ok(opinionPrompt('議題', [], m).includes('記事'));
  assert.ok(rebuttalPrompt('議題', [], m).includes('記事'));
  assert.ok(synthesisPrompt('議題', [], [], m).includes('記事'));
});

test('週次レビューは答え方が決まっている', () => {
  assert.ok(weeklyTopic().includes('振り返り'));
  const p = weeklyPrompt();
  assert.ok(p.includes('できたこと'));
  assert.ok(p.includes('来週やる1つ'));
  assert.ok(p.includes('推測で書かない'));
});

test('会議を作ると材料と反対役の有無が残る', () => {
  const mtg = createMeeting({
    topic: 'x',
    employees: [{ id: 'e1', roleId: 'creator' }, { id: 'e2', roleId: 'reviewer' }],
    materials: '材料',
    kind: 'weekly',
  });
  assert.equal(mtg.materials, '材料');
  assert.equal(mtg.kind, 'weekly');
  assert.equal(mtg.hasGuard, true);
});

// ───────── ⑧ 反対役 ─────────

test('反対役がいない会議が分かる', () => {
  assert.equal(hasGuard([{ roleId: 'creator' }, { roleId: 'marketer' }]), false);
  assert.equal(hasGuard([{ roleId: 'creator' }, { roleId: 'reviewer' }]), true);
});

test('反対役の候補は実在する役職', () => {
  for (const id of GUARD_ROLE_IDS) assert.ok(roleById(id), id);
});

test('承認役は反対役として数える', () => {
  const approver = { roleId: 'mkt_governance' };
  assert.equal(Boolean(roleById(approver.roleId).isApprover), true);
  assert.equal(hasGuard([approver]), true);
});

// ───────── ⑨ 議事録 ─────────

test('結論から「決まったこと」を拾う（AIを呼ばない）', () => {
  const mtg = {
    conclusion: [
      '1. 合意できたこと',
      '- 価格は5000円で試す',
      '- 記事は週2本',
      '2. 割れたこと',
      '- ここは拾わない',
    ].join('\n'),
  };
  const out = meetingTakeaways(mtg);
  assert.ok(out.includes('価格は5000円で試す'));
  assert.ok(!out.some((x) => x.includes('拾わない')));
});

test('結論が無ければ何も拾わない', () => {
  assert.deepEqual(meetingTakeaways({ conclusion: '' }), []);
  assert.deepEqual(meetingTakeaways({}), []);
});

test('会議の結論は「AI生成」と混ぜない', () => {
  assert.ok(SOURCE_TYPES.meeting);
  assert.ok(ORIGINS.meeting);
  assert.notEqual(ORIGINS.meeting, ORIGINS.ai);
});

// ───────── ⑤⑩ 引き継ぎ会と軽い相談 ─────────

test('相談は3行までと決まっている', () => {
  const p = consultPrompt('この価格で出して大丈夫？', '材料');
  assert.ok(p.includes(`${MAX_ANSWER_LINES}行`));
  assert.ok(p.includes('担当外'));
  assert.ok(p.includes('材料'));
  assert.equal(trimAnswer('1\n2\n3\n4').split('\n').length, MAX_ANSWER_LINES);
});

test('相談は会議より安い（1回で済む）', () => {
  // 会議は 人数×2＋1 回。5人なら11回。
  assert.equal(estimatedCalls(5), 11);
  assert.equal(estimatedCalls(0), 0);
});

test('引き継ぎの確認は「作業をしない」と伝える', () => {
  const p = gapPrompt('記事を書く', '調査の結果です');
  assert.ok(p.includes('作業はまだしないでください'));
  assert.ok(p.includes('3つまで'));
  assert.ok(p.includes('なし'));
});

test('補うときは推測で埋めさせない', () => {
  const p = supplementPrompt('出典が足りません', '調査の結果');
  assert.ok(p.includes('推測で埋めない'));
  assert.ok(p.includes('書き直さない'));
});

test('「なし」を足りないものとして扱わない', () => {
  assert.equal(isNothing('なし'), true);
  assert.equal(isNothing('特になし。'), true);
  assert.equal(isNothing(''), true);
  assert.equal(isNothing('出典が足りません'), false);
});

// ───────── 検査で見つかった不具合の再発防止 ─────────

test('反対役に勧める役職は、必ず守り役として数える', async () => {
  // 勧めた人を入れても警告が消えない、が起きないように。
  for (const id of GUARD_ROLE_IDS) {
    assert.equal(hasGuard([{ roleId: id }]), true, id);
  }
  // stance の値は roles.js のもの（日本語ではない）
  assert.equal(roleById('mkt_governance').stance, 'defense');
});

test('掲示板は新しい方を残して切る', async () => {
  const { trimHead } = await import('../src/lib/memory.js');
  const text = ['## 社内で共有されていること', ...Array.from({ length: 60 }, (_, i) => `- 連絡${i}`)].join('\n');
  const cut = trimHead(text, 200);
  assert.ok(cut.startsWith('## 社内で共有されていること'), '見出しが落ちている');
  assert.ok(cut.includes('連絡0'), '新しい掲示が落ちている');
  assert.ok(!cut.includes('連絡59'));
});

test('やり直しても、使った費用は消えない', async () => {
  const { redoFrom, redoCount } = await import('../src/lib/workflow.js');
  const t = {
    steps: [
      { id: 'a', group: 0, status: 'done', output: 'x', cost: 0.01 },
      { id: 'b', group: 1, status: 'done', output: 'y', cost: 0.02 },
    ],
    decisions: [{ id: 'd', state: 'open', text: 'x' }],
  };
  const after = redoFrom(t, 'a');
  assert.equal(after.totalCost, 0.03);
  assert.equal(after.steps[0].status, 'pending');
  assert.equal(after.steps[0].output, '');
  assert.deepEqual(after.decisions, []); // 提出物が変わるので拾い直す
  assert.equal(redoCount(t, 'b'), 1);
  assert.equal(redoFrom(t, 'ない').steps[0].status, 'done');
});

test('在席は「その人の手順」で見る（同じ仕事の順番待ちを実行中にしない）', () => {
  const t = task({
    status: 'running',
    steps: [
      { employeeId: 'run', status: 'running' },
      { employeeId: 'wait', status: 'pending' },
    ],
  });
  assert.equal(presenceOf({ id: 'run' }, [t]).state, 'running');
  assert.equal(presenceOf({ id: 'wait' }, [t]).state, 'queued');
});

test('「なし」は足りないものとして持たない（要らない1回を課金しない）', () => {
  // runConsultRef が isNothing で弾く。ここでは判定そのものを固定しておく。
  assert.equal(isNothing('なし'), true);
  assert.equal(isNothing('- 出典が足りません'), false);
});
