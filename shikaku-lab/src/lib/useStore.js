// アプリ全体の状態。外部ライブラリを使わない小さなストア（購読 + 端末内保存）。

import { useSyncExternalStore } from 'react';
import { load, save, clear } from './storage.js';
import { DEFAULT_POMODORO, startTimer, pauseTimer, resumeTimer, addSession, todayCount, nextPhase } from './pomodoro.js';
import { makeExam, upsertExam, removeExam } from './myExam.js';
import { dedupeAgainst } from './convert.js';

export const DEFAULT_STATE = {
  settings: {
    theme: 'light', // 'light' | 'dark'
    fontScale: 'l', // 'm' | 'l' | 'xl'
    examId: null,
    examDate: '', // 'YYYY-MM-DD'
    weekdayMin: 60,
    weekendMin: 120,
    phaseRatio: null, // null なら schedule.js の既定
    subjectWeights: {},
    chosenMethods: [], // 空＝まだ選んでいない（提案を仮置きする）
    checkedPoints: {}, // 公式サイトで確かめた項目
    angles: [], // 変換で使う角度。空なら出題形式の既定
    convertDraft: {}, // 変換画面の入力の下書き
    didOpenSpec: false,
  },
  pomodoro: DEFAULT_POMODORO,
  pomodoroLog: [], // [{ day, count }] 新しい日が先頭
  timer: null, // { phase, endsAt, pausedRemain }
  cognitive: {}, // { [questionId]: 0..3 }
  questions: [], // 取り込んだ問題
  myExams: [], // 自分で足した試験
  notes: '',
};

let state = load(DEFAULT_STATE);
const listeners = new Set();

function emit() {
  save(state);
  for (const l of listeners) l();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function set(updater) {
  state = typeof updater === 'function' ? updater(state) : { ...state, ...updater };
  emit();
}

export const actions = {
  setSettings(patch) {
    set((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  },
  setNotes(text) {
    set((s) => ({ ...s, notes: String(text) }));
  },

  // ── 認知特性（自己申告）──────────────────────────
  answerCognitive(questionId, value) {
    set((s) => ({ ...s, cognitive: { ...s.cognitive, [questionId]: value } }));
  },
  clearCognitive() {
    set((s) => ({ ...s, cognitive: {} }));
  },

  // ── 勉強法の選択 ───────────────────────────────
  toggleMethod(id) {
    set((s) => {
      const chosen = s.settings.chosenMethods || [];
      const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
      return { ...s, settings: { ...s.settings, chosenMethods: next } };
    });
  },
  /** 提案をそのまま採用する（「仮置き」を「選んだ」に変える） */
  adoptMethods(ids = []) {
    set((s) => ({ ...s, settings: { ...s.settings, chosenMethods: [...ids] } }));
  },
  toggleCheckPoint(text) {
    set((s) => {
      const map = { ...(s.settings.checkedPoints || {}) };
      if (map[text]) delete map[text];
      else map[text] = Date.now();
      return { ...s, settings: { ...s.settings, checkedPoints: map } };
    });
  },
  toggleAngle(id) {
    set((s) => {
      const list = s.settings.angles || [];
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      return { ...s, settings: { ...s.settings, angles: next } };
    });
  },

  // ── 自分の試験 ────────────────────────────────
  addExam(input) {
    const exam = makeExam(input);
    set((s) => ({ ...s, myExams: upsertExam(s.myExams || [], exam), settings: { ...s.settings, examId: exam.id } }));
    return exam;
  },
  updateExam(exam) {
    set((s) => ({ ...s, myExams: upsertExam(s.myExams || [], exam) }));
  },
  deleteExam(id) {
    set((s) => ({
      ...s,
      myExams: removeExam(s.myExams || [], id),
      settings: { ...s.settings, examId: s.settings.examId === id ? null : s.settings.examId },
    }));
  },

  // ── 取り込んだ問題 ──────────────────────────────
  /**
   * 取り込み。**重複は足さずに件数だけ返す**（黙って捨てない）。
   * @returns {{ added:number, duplicates:number }}
   */
  addQuestions(items = []) {
    let added = 0;
    let duplicates = 0;
    set((s) => {
      const { fresh, duplicates: dups } = dedupeAgainst(s.questions || [], items);
      added = fresh.length;
      duplicates = dups.length;
      return { ...s, questions: [...fresh, ...(s.questions || [])] };
    });
    return { added, duplicates };
  },
  deleteQuestion(id) {
    set((s) => ({ ...s, questions: (s.questions || []).filter((q) => q.id !== id) }));
  },
  clearQuestions() {
    set((s) => ({ ...s, questions: [] }));
  },

  // ── ポモドーロ ────────────────────────────────
  setPomodoro(patch) {
    set((s) => ({ ...s, pomodoro: { ...s.pomodoro, ...patch } }));
  },
  /** 区間を始める（phase 省略時は集中） */
  startPhase(phase = 'focus') {
    set((s) => ({ ...s, timer: startTimer(phase, s.pomodoro) }));
  },
  pause() {
    set((s) => ({ ...s, timer: pauseTimer(s.timer) }));
  },
  resume() {
    set((s) => ({ ...s, timer: resumeTimer(s.timer) }));
  },
  /** 止める（記録は残さない。押し間違いで本数が増えないように） */
  stopTimer() {
    set((s) => ({ ...s, timer: null }));
  },
  /**
   * 区間を終える。集中だったら1本として記録し、次の区間を用意する。
   * 自動で次へ進むかは設定（既定は手で押す＝勝手に費用も時間も進めない）。
   */
  finishPhase() {
    set((s) => {
      const phase = s.timer?.phase || 'focus';
      const log = phase === 'focus' ? addSession(s.pomodoroLog) : s.pomodoroLog;
      const done = todayCount(log);
      const next = nextPhase(phase, done, s.pomodoro);
      return {
        ...s,
        pomodoroLog: log,
        timer: s.pomodoro.autoNext ? startTimer(next, s.pomodoro) : { phase: next, endsAt: null, pausedRemain: null },
      };
    });
  },
  /** 休憩を飛ばして集中へ戻る（決めた形に人を合わせない） */
  skipBreak() {
    set((s) => ({ ...s, timer: { phase: 'focus', endsAt: null, pausedRemain: null } }));
  },

  // ── 書き出し・取り込み・消去 ───────────────────────
  exportAll() {
    return JSON.stringify({ version: 1, exportedAt: Date.now(), state }, null, 2);
  },
  /** 取り込みは**必ず確認を出してから**呼ぶこと（今のデータを置き換えるため） */
  importAll(text) {
    let parsed;
    try {
      parsed = JSON.parse(String(text));
    } catch {
      return { ok: false, error: 'JSON として読めませんでした' };
    }
    const incoming = parsed?.state || parsed;
    if (!incoming || typeof incoming !== 'object') return { ok: false, error: '中身が読めませんでした' };
    set(() => ({
      ...DEFAULT_STATE,
      ...incoming,
      settings: { ...DEFAULT_STATE.settings, ...(incoming.settings || {}) },
      pomodoro: { ...DEFAULT_STATE.pomodoro, ...(incoming.pomodoro || {}) },
    }));
    return { ok: true };
  },
  resetAll() {
    clear();
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    emit();
  },
};

export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
