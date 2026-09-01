import test from 'node:test';
import assert from 'node:assert/strict';
import {
  overallCoverageRate,
  overallCorrectRate,
  star3Count,
  aRankMasteryRate,
  examScoreStability,
  lapCount900,
  phaseChecks,
  nextActionFor,
} from '../src/lib/g100Progress.js';

const questions = [
  { id: 'q1', genre: '経絡経穴｜総論', subject: '経絡経穴概論', round: 30 },
  { id: 'q2', genre: '経絡経穴｜総論', subject: '経絡経穴概論', round: 31 },
  { id: 'q3', genre: '経絡経穴｜総論', subject: '経絡経穴概論', round: 32 },
  { id: 'q4', genre: '解剖｜骨', subject: '解剖学', round: 30 },
];

test('overallCoverageRate: 解いたことのある問題の割合', () => {
  const history = [{ questionId: 'q1', correct: true }, { questionId: 'q2', correct: false }];
  assert.equal(overallCoverageRate(questions, history), 0.5);
});

test('overallCoverageRate: 問題が無ければ0', () => {
  assert.equal(overallCoverageRate([], []), 0);
});

test('overallCorrectRate: 正答率を返し、履歴が空ならnull', () => {
  const history = [
    { correct: true, at: 1 },
    { correct: false, at: 2 },
    { correct: true, at: 3 },
  ];
  assert.equal(overallCorrectRate(history), 2 / 3);
  assert.equal(overallCorrectRate([]), null);
});

test('overallCorrectRate: 直近windowSize件だけを見る（古い誤答に生涯引っ張られない）', () => {
  // 最初に9問連続で誤答（ずっと前）、直近3問は全問正解
  const old = Array.from({ length: 9 }, (_, i) => ({ correct: false, at: i }));
  const recent = Array.from({ length: 3 }, (_, i) => ({ correct: true, at: 100 + i }));
  const history = [...old, ...recent];
  assert.equal(overallCorrectRate(history, 3), 1); // 直近3件だけなら全問正解
  assert.equal(overallCorrectRate(history, 100), 3 / 12); // 全期間で見れば低いまま
});

test('overallCorrectRate: 履歴の並び順に依存しない（atで並べ替えてから直近を見る）', () => {
  // 配列としては新しい解答が先頭に来ている（同期マージ等で順序が崩れたケースを想定）
  const history = [
    { correct: true, at: 300 },
    { correct: false, at: 1 },
    { correct: false, at: 2 },
  ];
  assert.equal(overallCorrectRate(history, 1), 1); // atが最大＝最新は正解
});

test('star3Count: ✕2回以上の問題数を数える', () => {
  const selfKindCounts = { q1: { batsu: 2 }, q2: { batsu: 1, sankaku: 5 }, q3: { sankaku: 3 } };
  // starLevelOf: batsu>=2→3, else sankaku>=3→2
  assert.equal(star3Count(questions, selfKindCounts), 1);
});

test('aRankMasteryRate: Aランク（3回以上出題のジャンル）のマスター率', () => {
  // q1,q2,q3 は同じジャンルで3回にまたがって出題＝Aランク。q4はCランク。
  const srs = { q1: { correctStreak: 5 }, q2: { correctStreak: 5 }, q3: { correctStreak: 0 } };
  const rate = aRankMasteryRate(questions, srs);
  assert.equal(rate, 2 / 3);
});

test('aRankMasteryRate: Aランクが無ければnull', () => {
  const solo = [{ id: 'x', genre: 'g｜a', round: 1 }];
  assert.equal(aRankMasteryRate(solo, {}), null);
});

test('examScoreStability: 3回未満はstable:null', () => {
  const r = examScoreStability([{ scorePct: 80 }, { scorePct: 75 }]);
  assert.equal(r.stable, null);
});

test('examScoreStability: 直近3回のみで前3回が無ければstable:null', () => {
  const r = examScoreStability([{ scorePct: 80 }, { scorePct: 75 }, { scorePct: 78 }]);
  assert.equal(r.stable, null);
  assert.equal(r.recentAvg, 78);
});

test('examScoreStability: 前回より落ちていなければstable:true', () => {
  const results = [{ scorePct: 82 }, { scorePct: 80 }, { scorePct: 78 }, { scorePct: 75 }, { scorePct: 74 }, { scorePct: 73 }];
  const r = examScoreStability(results);
  assert.equal(r.stable, true);
});

test('examScoreStability: 大きく下がっていればstable:false', () => {
  const results = [{ scorePct: 50 }, { scorePct: 52 }, { scorePct: 51 }, { scorePct: 80 }, { scorePct: 79 }, { scorePct: 81 }];
  const r = examScoreStability(results);
  assert.equal(r.stable, false);
});

test('lapCount900: roundLogのtarget=900の件数を返す', () => {
  const log = [{ target: 900, at: 1 }, { target: 60, at: 2 }, { target: 900, at: 3 }];
  assert.equal(lapCount900(log), 2);
});

test('phaseChecks: 何も解いていない状態はphase1・未達（blocked/unknown混在ではなくcurrentPhaseId=phase1）', () => {
  const r = phaseChecks({ questions, history: [], srs: {}, selfKindCounts: {}, examResults: [], roundLog: [] });
  assert.equal(r.currentPhaseId, 'phase1');
  assert.equal(r.phase1.status, 'blocked'); // coverage 0 < 1 → met:false
});

test('phaseChecks: 全問正解・全問解答済みでphase1完了、Aランク未達でphase2に留まる', () => {
  const history = questions.map((q, i) => ({ questionId: q.id, correct: true, at: i }));
  const srs = { q1: { correctStreak: 5 }, q2: { correctStreak: 0 }, q3: { correctStreak: 0 }, q4: { correctStreak: 5 } };
  const r = phaseChecks({ questions, history, srs, selfKindCounts: {}, examResults: [], roundLog: [] });
  assert.equal(r.phase1.status, 'done');
  assert.equal(r.currentPhaseId, 'phase2');
});

test('phaseChecks: 即答5秒達成率はtimeAttackLogから実測される（データが無ければunknown）', () => {
  const history = questions.map((q, i) => ({ questionId: q.id, correct: true, at: i }));
  const srs = { q1: { correctStreak: 5 }, q2: { correctStreak: 5 }, q3: { correctStreak: 5 }, q4: { correctStreak: 5 } };
  const r = phaseChecks({ questions, history, srs, selfKindCounts: {}, examResults: [], roundLog: [], timeAttackLog: [] });
  assert.equal(r.phase1.status, 'done');
  // Aランク100%達成だが、即答5秒はtimeAttackLogが空でmet:null＝判定不可なのでphase2はdoneにならない
  assert.equal(r.phase2.status, 'unknown');
  const speedCheck = r.phase2.checks.find((c) => c.label === '即答5秒達成率');
  assert.equal(speedCheck.met, null);
});

test('phaseChecks: timeAttackLogの実績が閾値を超えればphase2もdoneになる', () => {
  const history = questions.map((q, i) => ({ questionId: q.id, correct: true, at: i }));
  const srs = { q1: { correctStreak: 5 }, q2: { correctStreak: 5 }, q3: { correctStreak: 5 }, q4: { correctStreak: 5 } };
  const timeAttackLog = Array.from({ length: 10 }, () => ({ correct: true, ms: 3000 }));
  const r = phaseChecks({ questions, history, srs, selfKindCounts: {}, examResults: [], roundLog: [], timeAttackLog });
  assert.equal(r.phase2.status, 'done');
});

test('phaseChecks: すべて満たせばcurrentPhaseId=complete', () => {
  const history = questions.map((q, i) => ({ questionId: q.id, correct: true, at: i }));
  const srs = { q1: { correctStreak: 5 }, q2: { correctStreak: 5 }, q3: { correctStreak: 5 }, q4: { correctStreak: 5 } };
  const examResults = [82, 80, 78, 75, 74, 73].map((scorePct) => ({ scorePct }));
  const timeAttackLog = Array.from({ length: 10 }, () => ({ correct: true, ms: 3000 }));
  const r = phaseChecks({ questions, history, srs, selfKindCounts: {}, examResults, roundLog: [], timeAttackLog });
  assert.equal(r.phase3.checks.find((c) => c.label.includes('★3')).met, true);
  assert.equal(r.currentPhaseId, 'complete');
});

test('nextActionFor: phase1未達なら未達項目の案内を返す', () => {
  const r = phaseChecks({ questions, history: [], srs: {}, selfKindCounts: {}, examResults: [], roundLog: [], timeAttackLog: [] });
  const action = nextActionFor(r);
  assert.equal(action.label, '全範囲1周（解いたことのある問題の割合）');
  assert.equal(action.reason, 'blocked');
  assert.equal(action.view, 'session');
});

test('nextActionFor: すべて完了ならnull', () => {
  const history = questions.map((q, i) => ({ questionId: q.id, correct: true, at: i }));
  const srs = { q1: { correctStreak: 5 }, q2: { correctStreak: 5 }, q3: { correctStreak: 5 }, q4: { correctStreak: 5 } };
  const examResults = [82, 80, 78, 75, 74, 73].map((scorePct) => ({ scorePct }));
  const timeAttackLog = Array.from({ length: 10 }, () => ({ correct: true, ms: 3000 }));
  const r = phaseChecks({ questions, history, srs, selfKindCounts: {}, examResults, roundLog: [], timeAttackLog });
  assert.equal(nextActionFor(r), null);
});
