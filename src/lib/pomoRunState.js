// ポモドーロタイマーの「いま動いている状態」を端末内に残し、アプリを閉じて開き直しても
// 続きから数えられるようにする（2026-11-15・ユーザー指定。2026-11-08の全面リセットで
// いったん外した「再読み込みをまたいだ続きから」を、この形で戻した）。
// タイマーは「終わる時刻（endAt）」から毎回引き算する作りなので、残すのは終わる時刻と
// 止めている時の残り秒数だけでよい。閉じている間は何も動かない（音も鳴らない）——
// 開き直した時に「本当はいまどこにいるはずか」を計算し直すだけ。
// 書き込みは同期で終わるlocalStorage（閉じる直前の変更も取りこぼさないため）。
import { COURSE_PHASES, catchUpCourse } from './pomoCourse.js';

const KEY = 'shinkyu:pomoRun';
// 止めたまま・終わったままの状態を覚えておく長さ。これより古いものは待機中へ戻す
// （何日も前の止めかけが突然出てこないようにするための、アプリ内部の区切り）。
export const POMO_RUN_KEEP_MS = 12 * 60 * 60 * 1000;

export function loadPomoRun() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function savePomoRun(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearPomoRun() {
  try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
}

// 保存してあった状態から、開き直した「今」の状態を求める（時計を読まない純関数）。
// 戻り値：null（待機中から始める）、または
// { running, endAt, remaining, coursePhaseIndex, finished, courseFinishedAt, note }
// note：'continued'（動いたまま続き）／'paused'（止めたまま）／'ended'（閉じている間に終了）
export function restorePomoRun(saved, now, mode) {
  if (!saved || typeof saved !== 'object') return null;
  const savedMode = saved.mode === 'course2h' ? 'course2h' : 'simple';
  const curMode = mode === 'course2h' ? 'course2h' : 'simple';
  if (savedMode !== curMode) return null;
  const savedAt = Number(saved.savedAt) || 0;
  const idx = Number.isInteger(saved.coursePhaseIndex) ? saved.coursePhaseIndex : null;
  const base = { running: false, endAt: 0, remaining: 0, coursePhaseIndex: null, finished: false, courseFinishedAt: null };

  if (saved.running) {
    const endAt = Number(saved.endAt) || 0;
    if (!endAt) return null;
    if (curMode === 'course2h') {
      if (idx == null || idx < 0 || idx >= COURSE_PHASES.length) return null;
      const r = catchUpCourse(idx, endAt, now);
      if (r.finished) {
        if (now - r.endAt > POMO_RUN_KEEP_MS) return null;
        return { ...base, finished: true, courseFinishedAt: r.endAt, note: 'ended' };
      }
      return {
        ...base, running: true, endAt: r.endAt, coursePhaseIndex: r.phaseIndex,
        remaining: Math.max(0, Math.ceil((r.endAt - now) / 1000)), note: 'continued',
      };
    }
    if (endAt <= now) {
      if (now - endAt > POMO_RUN_KEEP_MS) return null;
      return { ...base, finished: true, note: 'ended' };
    }
    return { ...base, running: true, endAt, remaining: Math.ceil((endAt - now) / 1000), note: 'continued' };
  }

  if (now - savedAt > POMO_RUN_KEEP_MS) return null;
  if (saved.finished) {
    return { ...base, finished: true, courseFinishedAt: curMode === 'course2h' ? (saved.courseFinishedAt || null) : null, note: null };
  }
  const remaining = Math.floor(Number(saved.remaining) || 0);
  if (remaining <= 0) return null;
  if (curMode === 'course2h') {
    if (idx == null || idx < 0 || idx >= COURSE_PHASES.length) return null;
    return { ...base, remaining, coursePhaseIndex: idx, note: 'paused' };
  }
  return { ...base, remaining, note: 'paused' };
}
