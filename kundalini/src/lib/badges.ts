// 実績（バッジ）。**解放状態を保存しない**——日数から毎回導く。
// 保存すると「ロジックを直したら過去の実績が消えた／勝手に増えた」が起きる。

import { BADGES, type Badge } from '../data/badges.js';

export interface BadgeState {
  badge: Badge;
  /** これまでのどこかで届いたか（最長記録で見る） */
  unlocked: boolean;
  /** いまの継続で届いているか */
  currentlyHeld: boolean;
  /** いまの継続であと何日で届くか */
  daysLeft: number;
}

export function badgeStates(currentDays: number, longestDays: number): BadgeState[] {
  return BADGES.map((badge) => ({
    badge,
    unlocked: longestDays >= badge.days,
    currentlyHeld: currentDays >= badge.days,
    daysLeft: Math.max(0, badge.days - currentDays),
  }));
}

/** ちょうど今日届いたもの（お祝いの演出用。1件だけ返す） */
export function justReached(currentDays: number): Badge | null {
  return BADGES.find((b) => b.days === currentDays) ?? null;
}

/** 次に届くもの */
export function nextBadge(currentDays: number): Badge | null {
  return BADGES.find((b) => b.days > currentDays) ?? null;
}
