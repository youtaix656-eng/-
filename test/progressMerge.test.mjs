import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeSrs,
  mergeHistory,
  mergeExamResults,
  mergeObjectMap,
  mergeProgress,
  progressChanged,
} from '../src/lib/progressMerge.js';

test('mergeSrs: 片方にしかない問題はそのまま残る', () => {
  const local = { 'q-1': { lastAnswered: 100 } };
  const remote = { 'q-2': { lastAnswered: 200 } };
  const out = mergeSrs(local, remote);
  assert.deepEqual(out, { 'q-1': { lastAnswered: 100 }, 'q-2': { lastAnswered: 200 } });
});

test('mergeSrs: 両方にある問題はlastAnsweredが新しい方を採用', () => {
  const local = { 'q-1': { lastAnswered: 100, correctStreak: 2 } };
  const remote = { 'q-1': { lastAnswered: 300, correctStreak: 3 } };
  const out = mergeSrs(local, remote);
  assert.equal(out['q-1'].correctStreak, 3);
});

test('mergeSrs: remoteの方が古ければlocalを保持（後発の端末データで上書きしない）', () => {
  const local = { 'q-1': { lastAnswered: 500, correctStreak: 5 } };
  const remote = { 'q-1': { lastAnswered: 100, correctStreak: 1 } };
  const out = mergeSrs(local, remote);
  assert.equal(out['q-1'].correctStreak, 5);
});

test('mergeSrs: lastAnsweredが無ければdueで比較する', () => {
  const local = { 'q-1': { due: 100 } };
  const remote = { 'q-1': { due: 200 } };
  const out = mergeSrs(local, remote);
  assert.equal(out['q-1'].due, 200);
});

test('mergeHistory: 重複する解答記録は1件にまとめる', () => {
  const local = [{ questionId: 'q-1', at: 100, correct: true }];
  const remote = [{ questionId: 'q-1', at: 100, correct: true }, { questionId: 'q-2', at: 200, correct: false }];
  const out = mergeHistory(local, remote);
  assert.equal(out.length, 2);
});

test('mergeHistory: 時刻順に並ぶ', () => {
  const local = [{ questionId: 'q-2', at: 300, correct: true }];
  const remote = [{ questionId: 'q-1', at: 100, correct: true }];
  const out = mergeHistory(local, remote);
  assert.deepEqual(out.map((e) => e.questionId), ['q-1', 'q-2']);
});

test('mergeExamResults: idでUNION（重複除去）', () => {
  const local = [{ id: 'ex-1', at: 100 }];
  const remote = [{ id: 'ex-1', at: 100 }, { id: 'ex-2', at: 200 }];
  const out = mergeExamResults(local, remote);
  assert.equal(out.length, 2);
});

test('mergeObjectMap: remoteNewer=trueならキー競合時にremoteを優先しつつUNION', () => {
  const local = { a: 1, b: 2 };
  const remote = { b: 20, c: 3 };
  const out = mergeObjectMap(local, remote, true);
  assert.deepEqual(out, { a: 1, b: 20, c: 3 });
});

test('mergeObjectMap: remoteNewer=falseならlocalを優先', () => {
  const local = { a: 1, b: 2 };
  const remote = { b: 20, c: 3 };
  const out = mergeObjectMap(local, remote, false);
  assert.deepEqual(out, { a: 1, b: 2, c: 3 });
});

test('mergeProgress: 各フィールドが正しく統合される', () => {
  const local = {
    srs: { 'q-1': { lastAnswered: 100 } },
    history: [{ questionId: 'q-1', at: 100, correct: true }],
    memos: { 'q-1': 'ローカルのメモ' },
    links: {},
    examResults: [{ id: 'ex-1', at: 100 }],
    settings: { dailyGoal: 100 },
  };
  const remote = {
    srs: { 'q-2': { lastAnswered: 200 } },
    history: [{ questionId: 'q-2', at: 200, correct: false }],
    memos: { 'q-2': 'リモートのメモ' },
    links: {},
    examResults: [{ id: 'ex-2', at: 200 }],
    settings: { dailyGoal: 200 },
  };
  const out = mergeProgress(local, remote, { localUpdatedAt: 100, remoteUpdatedAt: 500 });
  assert.deepEqual(Object.keys(out.srs).sort(), ['q-1', 'q-2']);
  assert.equal(out.history.length, 2);
  assert.deepEqual(out.memos, { 'q-1': 'ローカルのメモ', 'q-2': 'リモートのメモ' });
  assert.equal(out.examResults.length, 2);
  assert.equal(out.settings.dailyGoal, 200); // remoteの方が新しいので優先
});

test('mergeProgress: 欠けているフィールドがあっても落ちない', () => {
  const out = mergeProgress({}, {}, {});
  assert.deepEqual(out.srs, {});
  assert.deepEqual(out.history, []);
  assert.deepEqual(out.memos, {});
  assert.deepEqual(out.examResults, []);
});

test('progressChanged: 何も変わらなければfalse', () => {
  const local = {
    srs: { 'q-1': { lastAnswered: 100 } },
    history: [{ questionId: 'q-1', at: 100, correct: true }],
    memos: {},
    links: {},
    examResults: [],
  };
  assert.equal(progressChanged(local, local), false);
});

test('progressChanged: 件数が同じでも既存キーの値だけ更新されていればtrue（クラウド自動同期のバグ再発防止）', () => {
  // 実際に起きていたバグ: 他端末でq-1をより新しく解答した結果がマージされても、
  // 件数（Object.keys(...).length）は変わらないため「変化なし」と誤判定され、
  // マージ済みの新しい値がローカルの画面・SRSスケジューリングに反映されなかった。
  const local = { srs: { 'q-1': { lastAnswered: 100 } }, history: [], memos: {}, links: {}, examResults: [] };
  const merged = { srs: { 'q-1': { lastAnswered: 999 } }, history: [], memos: {}, links: {}, examResults: [] };
  assert.equal(progressChanged(local, merged), true);
});

test('progressChanged: history/memos/links/examResultsのいずれかの値変化も検出する', () => {
  const base = { srs: {}, history: [{ questionId: 'q-1', at: 1, correct: true }], memos: { a: '1' }, links: { a: ['q-1'] }, examResults: [{ id: 'e-1', at: 1 }] };
  assert.equal(progressChanged(base, { ...base, history: [{ questionId: 'q-1', at: 1, correct: false }] }), true);
  assert.equal(progressChanged(base, { ...base, memos: { a: '2' } }), true);
  assert.equal(progressChanged(base, { ...base, links: { a: ['q-2'] } }), true);
  assert.equal(progressChanged(base, { ...base, examResults: [{ id: 'e-1', at: 2 }] }), true);
});

test('progressChanged: local/mergedが欠けていても例外を投げない', () => {
  assert.equal(progressChanged(undefined, undefined), false);
  assert.equal(progressChanged({}, { srs: { a: 1 } }), true);
});
