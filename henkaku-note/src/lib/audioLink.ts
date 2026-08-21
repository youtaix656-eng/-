// 音声学習（鍼灸国家試験アプリ）への導線 — 仕様の「任意・将来拡張」。
//
// いまは **リンクを出すだけ** の拡張ポイント。アプリ間でデータのやり取りはしない
// （別オリジン・別ビルドなので、勝手に読み書きしない）。
// 深いリンク（特定の科目・モードを開く）が必要になったら、
// ここに1関数足すだけで済むように、導線の定義をこのファイルに閉じてある。

import type { Habit, Settings } from '../types/index.js';

/** 既定のリンク先（同じ GitHub Pages に同梱されている鍼灸アプリ） */
export const DEFAULT_AUDIO_URL = 'https://youtaix656-eng.github.io/-/';

export interface AudioSuggestion {
  habitId: string;
  label: string;
  reason: string;
  url: string;
}

/**
 * 音声学習をすすめるのは、ステップ①③④のいずれかを達成した時だけ。
 * 「達成したから、その勢いで一歩だけ進める」導線であって、
 * 未達成の人をせっつくためのものではない（未達成では出さない）。
 */
const LINKED_STEPS: Record<string, { label: string; reason: string }> = {
  'step1-peers': {
    label: '音声学習で1問だけ聞く',
    reason: '仲間とのやり取りで出た論点を、耳で1問だけ確認しておくと定着します。',
  },
  'step3-noise': {
    label: '音声学習に切り替える',
    reason: '娯楽から離れられた時間帯は、耳だけ使う学習に置き換えやすいです。',
  },
  'step4-zero-morning': {
    label: '起き抜けの1問を音声で',
    reason: '起きてすぐは画面より音のほうが始めやすく、ゼロ・モーニングと相性がよいです。',
  },
};

export function suggestionsFor(checkedHabitIds: string[], habits: Habit[], settings: Settings): AudioSuggestion[] {
  if (!settings.audioLinkEnabled) return [];
  const url = settings.audioLinkUrl || DEFAULT_AUDIO_URL;
  const known = new Set(habits.map((h) => h.id));
  return checkedHabitIds
    .filter((id) => known.has(id) && LINKED_STEPS[id])
    .map((id) => ({ habitId: id, url, ...LINKED_STEPS[id] }));
}

/** 導線を持つ習慣かどうか（習慣一覧にバッジを出すため） */
export function hasAudioLink(habitId: string): boolean {
  return Boolean(LINKED_STEPS[habitId]);
}
