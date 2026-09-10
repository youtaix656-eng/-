// 目次の飛び先（DOM の id）の登録簿。**ここが単一の正**。
//
// 画面側は必ずこの定数を使って id を書く。文字列を画面に直書きすると、
// 目次の destinations と静かに食い違って「飛んだのに着かない」が起きる
// （toc.spec.ts が destinations の飛び先がすべてここに在ることを機械チェックする）。

export const ANCHORS = {
  // 今日／カレンダーの日次カード
  routine: 'anchor-routine',
  threeRulesDay: 'anchor-three-day',
  habits: 'anchor-habits',
  condition: 'anchor-condition',
  meal: 'anchor-meal',
  monk: 'anchor-monk',
  meditation: 'anchor-meditation',
  bedtime: 'anchor-bedtime',
  sleepQuality: 'anchor-sleep-quality',
  note: 'anchor-note',
  // 今日の下部・その他の画面
  cycle: 'anchor-cycle',
  threeRulesMonth: 'anchor-three-month',
  weekly: 'anchor-weekly',
  habitsList: 'anchor-habits-list',
  habitPresets: 'anchor-habit-presets',
  settings: 'anchor-settings',
  backup: 'anchor-backup',
  // 目次の中の飛び先
  tocCandidates: 'anchor-toc-candidates',
  tocHistory: 'anchor-toc-history',
} as const;

export type AnchorId = (typeof ANCHORS)[keyof typeof ANCHORS];

export const ALL_ANCHORS: string[] = Object.values(ANCHORS);
