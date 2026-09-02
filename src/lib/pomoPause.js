// 勉強中に一時停止した理由（任意）を軽く記録する。何にどれだけ中断されやすいかを
// 本人が把握できるようにするための記録で、判定・注意には使わない。

import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:pomoPauseReasons';
const MAX_ENTRIES = 200;

export const PAUSE_REASONS = ['電話・連絡', 'トイレ・移動', '他の作業', 'その他'];

export async function loadPauseReasons() {
  try { return (await idbGet(KEY)) || []; } catch (e) { return []; }
}

export async function appendPauseReason(reason, at = Date.now()) {
  const log = await loadPauseReasons();
  const next = [...log, { reason, at }].slice(-MAX_ENTRIES);
  try { await idbSet(KEY, next); } catch (e) { /* noop */ }
  return next;
}
