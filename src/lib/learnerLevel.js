// 学習レベル（初級/中級/上級）の自動判定。
// Home画面のレベルバッジ、Roadmap.jsxの「レベル別：問題演習の進め方」との連携に使う。
// 目安であり厳密な診断ではない（本人の体感と違っても気にしなくてよい）。

import { isMastered } from './srs.js';
import { recentAccuracy } from './stats.js';

export const LEVELS = {
  beginner: { id: 'beginner', label: '初級者', icon: '🔰' },
  intermediate: { id: 'intermediate', label: '中級者', icon: '📘' },
  advanced: { id: 'advanced', label: '上級者', icon: '🎯' },
};

// 触れた問題数がこれ未満は初級者（まだ全体像がない時期）
const BEGINNER_TOUCHED_MAX = 100;
// マスター済みがこの数以上なら上級者
const ADVANCED_MASTERED_MIN = 500;
// もしくは、多く触れた上で直近の正答率が高ければ上級者
const ADVANCED_TOUCHED_MIN = 800;
const ADVANCED_ACCURACY_MIN = 0.75;

// { questions, srs, history } から現在のレベルを推定する
export function estimateLevel({ srs, history } = {}) {
  const entries = Object.values(srs || {});
  const touchedCount = entries.length;
  const masteredCount = entries.filter((s) => isMastered(s)).length;
  const accuracy = recentAccuracy(history || [], 120);

  if (touchedCount < BEGINNER_TOUCHED_MAX) {
    return { ...LEVELS.beginner, touchedCount, masteredCount, accuracy };
  }
  const highMastery = masteredCount >= ADVANCED_MASTERED_MIN;
  const highAccuracy = accuracy != null && accuracy >= ADVANCED_ACCURACY_MIN && touchedCount >= ADVANCED_TOUCHED_MIN;
  if (highMastery || highAccuracy) {
    return { ...LEVELS.advanced, touchedCount, masteredCount, accuracy };
  }
  return { ...LEVELS.intermediate, touchedCount, masteredCount, accuracy };
}
