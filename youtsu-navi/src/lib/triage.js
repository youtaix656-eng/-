// 安全トリアージ — 企画書 第4部②（MVP必須機能）
//
// レッドフラグ定義（data/redFlags.js）とタグを突き合わせ、
//   level: 'stop'（緊急）/ 'refer'（受診推奨）/ 'caution'（要注意）/ 'clear'（該当なし）
// を返す。医療行為の代替ではなく、施術者が「やめる／すすめる」を判断する材料。

import { SEVERITY } from '../data/redFlags.js';

const LEVEL_BY_SEVERITY = { emergency: 'stop', urgent: 'refer', caution: 'caution' };

export const LEVELS = {
  stop: {
    key: 'stop',
    label: '施術中止・直ちに受診',
    tone: 'danger',
    message: '緊急性の高い所見があります。施術は行わず、直ちに医療機関の受診（状況により救急要請）をすすめてください。',
  },
  refer: {
    key: 'refer',
    label: '施術を見合わせ・受診推奨',
    tone: 'danger',
    message: '医療機関での評価が優先される所見があります。今回の施術は見合わせ、受診をすすめてください。',
  },
  caution: {
    key: 'caution',
    label: '注意して施術',
    tone: 'warn',
    message: '注意すべき所見があります。刺激量・体位・時間を制限し、変化があればその場で中止してください。',
  },
  clear: {
    key: 'clear',
    label: '明らかなレッドフラグなし',
    tone: 'ok',
    message: '入力の範囲では明らかなレッドフラグはありません。施術中・施術後の変化には引き続き注意してください。',
  },
};

/** 1つのレッドフラグ定義が発火するか */
export function matches(flag, tagSet) {
  const hit = (flag.tags || []).some((t) => tagSet.has(t));
  if (!hit) return false;
  if (flag.withTags && flag.withTags.length) {
    return flag.withTags.some((t) => tagSet.has(t));
  }
  return true;
}

/**
 * @param {string[]} tags
 * @param {object[]} redFlags data/redFlags.js の定義
 * @returns {{ level, levelInfo, flags, counts }}
 */
export function triage(tags = [], redFlags = []) {
  const tagSet = new Set(tags);
  const flags = redFlags
    .filter((f) => matches(f, tagSet))
    .sort((a, b) => SEVERITY[b.severity].order - SEVERITY[a.severity].order);

  const counts = { emergency: 0, urgent: 0, caution: 0 };
  for (const f of flags) counts[f.severity] += 1;

  let level = 'clear';
  if (counts.emergency > 0) level = 'stop';
  else if (counts.urgent > 0) level = 'refer';
  else if (counts.caution > 0) level = 'caution';

  return { level, levelInfo: LEVELS[level], flags, counts };
}

/** 施術に進んでよいか（false なら結果画面で施術方針を折りたたむ） */
export function canTreat(level) {
  return level === 'clear' || level === 'caution';
}

/** レッドフラグが複数重なるほど疑いは強くなる（Downie 2013 の指摘） */
export function stackedWarning(result) {
  const n = result.flags.length;
  if (n >= 2 && result.level !== 'stop') {
    return 'レッドフラグが複数重なっています。単独では判断材料になりにくい項目でも、重なる場合は受診をすすめてください。';
  }
  return '';
}

export { SEVERITY };
