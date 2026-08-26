// 「改善点10件」で入れた変更のテスト。
// どれも「気づかないうちに損をする」類なので、機械チェックで固定しておく。

import test from 'node:test';
import assert from 'node:assert/strict';

import { checkAction, monthlyCap, overMonthlyCap, monthStart, DEFAULT_MONTHLY_CAP_USD } from '../src/lib/permissions.js';
import { createMeeting, estimatedCalls } from '../src/lib/meeting.js';
import { createTask, applyStepResult, nextGroup, retryFailed, isEmptyResult, assembleResult } from '../src/lib/workflow.js';
import { createKnowledge, ORIGINS, orphanSourceIds } from '../src/lib/knowledge.js';
import { backupReminder, REMIND_AFTER_DAYS, REMIND_AFTER_ITEMS } from '../src/lib/backup.js';
import { makeSettings } from '../src/lib/defaults.js';
import { makeCompany } from '../src/lib/seed.js';
import { readFile } from 'node:fs/promises';

const emp = { name: 'テスト', permissions: { read: true, create: true } };
const assign = (roleId) => ({ id: `e_${roleId}`, name: roleId, roleId });

// ───────── ① AI会議も承認を通す ─────────

test('会議はAIを「人数×2＋1」回呼ぶ（承認画面で伝える回数）', () => {
  assert.equal(estimatedCalls(5), 11);
  assert.equal(estimatedCalls(2), 5);
  assert.equal(estimatedCalls(0), 0, '参加者がいなければ呼ばない');
});

test('新しい会議は未承認の状態で始まる', () => {
  const m = createMeeting({ topic: 'テスト', employees: [{ id: 'a' }, { id: 'b' }] });
  assert.equal(m.costApproved, false, '承認を通さずに実行できてしまう');
});

// ───────── ③ 今月の費用の上限 ─────────

test('自動承認でも、今月の上限に達したら確認へ戻る', () => {
  const settings = { autoApproveCost: true };
  const under = checkAction({ employee: emp, action: 'costly', settings, spentThisMonth: 1 });
  assert.equal(under.needsApproval, false, '少額まで止めては自動承認の意味がない');

  const over = checkAction({ employee: emp, action: 'costly', settings, spentThisMonth: DEFAULT_MONTHLY_CAP_USD });
  assert.equal(over.needsApproval, true, '上限に達しても素通りしている');
  assert.match(over.reason, /上限/);
});

test('上限0は「上限なし」（自分で外した人だけ）', () => {
  const settings = { autoApproveCost: true, monthlyCapUsd: 0 };
  assert.equal(overMonthlyCap(settings, 9999), false);
  assert.equal(checkAction({ employee: emp, action: 'costly', settings, spentThisMonth: 9999 }).needsApproval, false);
});

test('上限の既定値が設定にある', () => {
  assert.equal(makeSettings().monthlyCapUsd, DEFAULT_MONTHLY_CAP_USD);
  assert.equal(monthlyCap({}), DEFAULT_MONTHLY_CAP_USD);
  assert.equal(monthlyCap({ monthlyCapUsd: 12 }), 12);
});

test('今月の始まりは月初の0時', () => {
  const d = new Date(monthStart(new Date(2026, 7, 26, 13, 45).getTime()));
  assert.equal(d.getDate(), 1);
  assert.equal(d.getHours(), 0);
});

// ───────── ④ 失敗した仕事をやり直せる ─────────

test('失敗した手順を待機へ戻して、そこから再開できる', () => {
  const t = createTask({ request: 'テスト', forceRoles: ['researcher', 'analyzer'], assign });
  const g = nextGroup(t);
  const failed = applyStepResult(t, g[0].id, { error: '通信に失敗' });
  assert.equal(failed.status, 'failed');

  const revived = retryFailed(failed);
  assert.equal(revived.status, 'queued', 'やり直せる状態に戻っていない');
  assert.equal(revived.steps[0].status, 'pending');
  assert.equal(revived.steps[0].error, null, '前の失敗の理由が残っている');
  assert.equal(nextGroup(revived).length, 1, '再開の対象が見つからない');
});

test('やり直しても、成功済みの手順はもう一度実行しない', () => {
  const t = createTask({ request: 'テスト', forceRoles: ['researcher', 'analyzer'], assign });
  let cur = applyStepResult(t, nextGroup(t)[0].id, { text: '調べた結果' });
  cur = applyStepResult(cur, nextGroup(cur)[0].id, { error: '通信に失敗' });
  const revived = retryFailed(cur);
  assert.equal(revived.steps[0].status, 'done', '終わった手順まで巻き戻している（費用が二重にかかる）');
  assert.equal(revived.steps[1].status, 'pending');
});

test('失敗が無ければ、やり直しは何もしない', () => {
  const t = createTask({ request: 'テスト', forceRoles: ['researcher'], assign });
  assert.equal(retryFailed(t), t);
});

// ───────── ⑤ 空の応答を「完了」にしない ─────────

test('空の応答は完了ではなく失敗として扱う', () => {
  assert.equal(isEmptyResult({ text: '   ' }), true);
  assert.equal(isEmptyResult({ text: '該当なし' }), false, '短くても答えは答え');
  assert.equal(isEmptyResult({ error: 'x', text: '' }), false, 'エラーはエラーとして扱う');

  const t = createTask({ request: 'テスト', forceRoles: ['researcher'], assign });
  const done = applyStepResult(t, t.steps[0].id, { text: '' });
  assert.equal(done.status, 'failed', '中身ゼロで「完了」と出てしまう');
  assert.match(done.steps[0].error, /空/);
});

test('空の応答を次の担当へ引き継がない', () => {
  const t = createTask({ request: 'テスト', forceRoles: ['researcher', 'analyzer'], assign });
  const after = applyStepResult(t, nextGroup(t)[0].id, { text: '' });
  assert.equal(after.steps[1].input, '', '空の結果を引き継いでいる');
});

// ───────── ⑥ ローカル社員の成果を「AI生成」にしない ─────────

test('AI未接続で作った知識は「AI生成」と名乗らない', () => {
  assert.ok(ORIGINS.template, '仕事の型の来歴が用意されていない');
  const { knowledge, extraSources } = createKnowledge({ title: '型', origin: 'template' });
  assert.equal(knowledge.origin, 'template');
  assert.doesNotMatch(extraSources[0].title, /AI生成/, 'AIが動いていないのにAI生成と記録している');
});

test('知らない来歴は従来どおり ai に倒す', () => {
  assert.equal(createKnowledge({ title: 'x', origin: 'なんとなく' }).knowledge.origin, 'ai');
});

// ───────── ⑨ 提出物を二重に保存しない ─────────

test('提出物の本文を仕事のデータに持たない（手順から組み立てる）', () => {
  const t = createTask({ request: 'テスト', forceRoles: ['researcher', 'analyzer'], assign });
  let cur = t;
  for (const s of t.steps) cur = applyStepResult(cur, s.id, { text: 'あ'.repeat(500) });
  assert.equal(cur.status, 'done');
  assert.equal(cur.result.text, undefined, '同じ本文を result にも持っている（保存量が増える）');
  assert.ok(assembleResult(cur).includes('あ'), '組み立てた提出物が空になっている');
});

// ───────── ② バックアップを促す ─────────

test('使い始めてすぐは促さない。たまってから促す', () => {
  assert.equal(backupReminder({ lastExportAt: 0, items: REMIND_AFTER_ITEMS - 1 }).show, false);
  assert.equal(backupReminder({ lastExportAt: 0, items: REMIND_AFTER_ITEMS }).show, true);
});

test('書き出してからの日数で促す', () => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  assert.equal(backupReminder({ lastExportAt: now - 5 * day, items: 99, now }).show, false);
  const late = backupReminder({ lastExportAt: now - (REMIND_AFTER_DAYS + 1) * day, items: 99, now });
  assert.equal(late.show, true);
  assert.match(late.reason, /日/);
});

// ───────── ⑩ 席数の呼び名を1つに ─────────

test('会社データの席数は seatsPerGenre に統一されている', () => {
  const c = makeCompany();
  assert.equal(c.seatsPerGenre, 3);
  assert.equal(c.seatsPerRole, undefined, '古い名前が残っている');
});

// ───────── ⑧ 知識を消したら、その知識だけの出典も消す ─────────

test('その知識だけが持っていた出典は、消したときに一緒に消える', () => {
  const a = { id: 'k1', sourceIds: ['s1', 's2'] };
  const b = { id: 'k2', sourceIds: ['s2', 's3'] };
  // s2 は b がまだ使っているので残す。s1 だけが行き場を失う。
  assert.deepEqual(orphanSourceIds(a, [b]), ['s1']);
});

test('他に知識が無ければ、その出典は全部行き場を失う', () => {
  assert.deepEqual(orphanSourceIds({ id: 'k1', sourceIds: ['s1', 's2'] }, []), ['s1', 's2']);
});

test('出典を持たない知識を消しても、何も巻き添えにしない', () => {
  assert.deepEqual(orphanSourceIds({ id: 'k1' }, [{ id: 'k2', sourceIds: ['s1'] }]), []);
  assert.deepEqual(orphanSourceIds(null, []), []);
});

// ───────── ① 会議の回数の数え方は1か所 ─────────

test('会議の回数は estimatedCalls だけが決める（画面に式を書かない）', async () => {
  const src = await readFile(new URL('../src/components/Meeting.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /picked\.length \* 2 \+ 1/, '画面が独自に回数を計算している');
  assert.match(src, /estimatedCalls\(/, '共通の数え方を使っていない');
});
