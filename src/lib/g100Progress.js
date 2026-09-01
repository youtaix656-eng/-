// G-100システム（1〜100周ガイド）の各フェーズの完了条件を、実際の解答データから判定する。
// 「今何周目か」を正確に数える手段は無い（900問1周ボタンを使わない解き方もできるため）ので、
// 断定はせず、g100Guide.jsのdoneWhen/goalMetricsに書かれている基準を実データで測れる範囲だけ判定し、
// 測れないもの・データ不足のものは met:null（判定不可）として正直に返す
// （手元に無い基準を作らない、他の見立てロジックと同じ線。「当てずっぽうを断定で書かない」）。

import { rankBreakdown } from './pastExamTrends.js';
import { starLevelOf } from './starWeak.js';
import { countForTarget } from './roundLog.js';
import { quickAnswerRate } from './timeAttackLog.js';

// 全問題のうち、一度でも解いたことがある問題の割合（Phase1の「全範囲1周」の目安）
export function overallCoverageRate(questions, history) {
  if (!questions || questions.length === 0) return 0;
  const answeredIds = new Set((history || []).map((h) => h.questionId));
  const covered = questions.filter((q) => answeredIds.has(q.id)).length;
  return covered / questions.length;
}

// 全履歴を通した正答率（Phase1の「○率50%」の目安）
export function overallCorrectRate(history) {
  if (!history || history.length === 0) return null;
  const correct = history.filter((h) => h.correct).length;
  return correct / history.length;
}

// ★3（✕2回以上）の件数（Phase3の「★3件数が0件」の判定に使う）
export function star3Count(questions, selfKindCounts) {
  return (questions || []).filter((q) => starLevelOf((selfKindCounts || {})[q.id]) === 3).length;
}

// Aランク（3回以上出題）のマスター済み率（Phase2の「Aランク○率85%」の目安）
export function aRankMasteryRate(questions, srs) {
  const a = rankBreakdown(questions || [], srs || {}).find((r) => r.id === 'A');
  if (!a || a.total === 0) return null;
  return a.rate;
}

// 模試スコアが安定しているか（直近3回平均と、その前3回平均の差が小さいか）。
// 対象は午前/午後（本番同形式）のみ・新しい→古い順を想定。6回未満は判定不可（stable:null）。
export function examScoreStability(examResults) {
  const scoped = (examResults || []).filter((r) => !r.mode || r.mode === 'am' || r.mode === 'pm');
  if (scoped.length < 3) return { stable: null, recentAvg: null };
  const recent = scoped.slice(0, 3).map((r) => r.scorePct);
  const recentAvg = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
  const prev = scoped.slice(3, 6).map((r) => r.scorePct);
  if (prev.length === 0) return { stable: null, recentAvg };
  const prevAvg = Math.round(prev.reduce((a, b) => a + b, 0) / prev.length);
  const delta = recentAvg - prevAvg;
  // 前回より落ちていない（僅差=5ポイント以内の低下は横ばいとみなす）ことを「安定」とする
  return { stable: delta >= -5, recentAvg, prevAvg, delta };
}

// 通算900問1周を完了した回数（参考値。900問ボタンを使わない解き方もできるため
// 実際の「周目」と一致するとは限らない。roundLog.js の countForTarget を流用）
export function lapCount900(roundLog) {
  return countForTarget(roundLog, 900);
}

// 1つのフェーズの完了状態。unmeasurable（このアプリでは測定不可な項目）は判定から除外する。
// 残った項目がすべてmet:trueなら'done'、met:falseが1つでもあれば'blocked'、
// falseが無くnullが混じるだけなら'unknown'（データ不足のため断定しない）。
function phaseStatus(checks) {
  const measurable = checks.filter((c) => !c.unmeasurable);
  if (measurable.some((c) => c.met === false)) return 'blocked';
  if (measurable.length > 0 && measurable.every((c) => c.met === true)) return 'done';
  return 'unknown';
}

// フェーズごとの完了条件チェック。
export function phaseChecks(data) {
  const { questions = [], history = [], srs = {}, selfKindCounts = {}, examResults = [], roundLog = [], timeAttackLog = [] } = data || {};
  const coverage = overallCoverageRate(questions, history);
  const correctRate = overallCorrectRate(history);
  const aRank = aRankMasteryRate(questions, srs);
  const star3 = star3Count(questions, selfKindCounts);
  const examStability = examScoreStability(examResults);
  const quickRate = quickAnswerRate(timeAttackLog);

  const phase1Checks = [
    { label: '全範囲1周（解いたことのある問題の割合）', value: coverage, target: 1, unit: 'pct', met: coverage >= 1 },
    { label: '全体の○率', value: correctRate, target: 0.5, unit: 'pct', met: correctRate == null ? null : correctRate >= 0.5 },
  ];
  const phase2Checks = [
    { label: 'Aランク（頻出）○率', value: aRank, target: 0.85, unit: 'pct', met: aRank == null ? null : aRank >= 0.85 },
    {
      label: '即答5秒達成率',
      value: quickRate,
      target: 0.8,
      unit: 'pct',
      met: quickRate == null ? null : quickRate >= 0.8,
      hint: 'タイムアタックモードで解いた問題から計測します',
    },
  ];
  const phase3Checks = [
    { label: '★3（要注意）件数', value: star3, target: 0, unit: 'count', met: star3 === 0 },
    { label: '模試スコアの安定', value: examStability.recentAvg, target: null, unit: 'pct', met: examStability.stable },
  ];

  const phase1 = { id: 'phase1', checks: phase1Checks, status: phaseStatus(phase1Checks) };
  const phase2 = { id: 'phase2', checks: phase2Checks, status: phaseStatus(phase2Checks) };
  const phase3 = { id: 'phase3', checks: phase3Checks, status: phaseStatus(phase3Checks) };

  // 「今どこにいるか」は、doneでない最初のフェーズ（unknownも未完了扱い＝先読みで進んだ判定はしない）
  let currentPhaseId = 'phase1';
  if (phase1.status === 'done') {
    currentPhaseId = phase2.status === 'done' ? (phase3.status === 'done' ? 'complete' : 'phase3') : 'phase2';
  }

  return {
    currentPhaseId,
    lapCount: lapCount900(roundLog),
    phase1,
    phase2,
    phase3,
  };
}

// 各チェック項目に対応する「次にやること」の案内文と、その場で開ける画面。
const CHECK_ACTIONS = {
  '全範囲1周（解いたことのある問題の割合）': { advice: 'まだ解いていない問題を「学習」で進めましょう。', view: 'session', label: '学習を開く' },
  '全体の○率': { advice: '「間違えた問題」で復習を重ね、正答率を上げましょう。', view: 'review', label: '間違えた問題を開く' },
  'Aランク（頻出）○率': { advice: '「傾向と対策」のAランクの問題を優先して解きましょう。', view: 'pasttrends', label: '傾向と対策を開く' },
  '即答5秒達成率': { advice: '「一問一答」でタイムアタックモード（5秒）を試しましょう。', view: 'quiz', label: '一問一答を開く' },
  '★3（要注意）件数': { advice: '「間違えた問題」の★★★（今日つぶす）から片づけましょう。', view: 'review', label: '間違えた問題を開く' },
  '模試スコアの安定': { advice: '模試を受けてスコアの推移を記録しましょう。', view: 'exam', label: '模試を開く' },
};

// 今のフェーズで、次に何をすべきかの案内を1つ返す（未達（met:false）を優先し、
// 無ければデータ不足（met:null）の項目。全フェーズ完了ならnull）。
export function nextActionFor(result) {
  const phase = { phase1: result.phase1, phase2: result.phase2, phase3: result.phase3 }[result.currentPhaseId];
  if (!phase) return null;
  const target = phase.checks.find((c) => c.met === false) || phase.checks.find((c) => c.met == null);
  if (!target) return null;
  const action = CHECK_ACTIONS[target.label];
  return {
    label: target.label,
    reason: target.met === false ? 'blocked' : 'unknown',
    advice: action?.advice || null,
    view: action?.view || null,
    linkLabel: action?.label || null,
  };
}
