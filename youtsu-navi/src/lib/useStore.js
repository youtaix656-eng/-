// アプリ全体の状態。外部ライブラリを使わない小さなストア（購読 + localStorage 永続化）。

import { useSyncExternalStore } from 'react';
import { load, save, clear } from './storage.js';
import { CONSENT_VERSION, makeConsentRecord } from './consent.js';

export const DEFAULT_STATE = {
  settings: {
    theme: 'light', // 'light' | 'dark'
    fontScale: 'l', // 'm' | 'l' | 'xl'（既定は大きめ＝施術中の視認性優先）
    licenseId: null,
    symptomId: 'lowback',
    showOutOfScope: false, // 業務範囲外の提案も表示するか
  },
  consent: null, // { agreedAt, version, licenseId }
  consentLog: [], // 同意履歴（企画書 改善策 #7）
  lastResult: null, // { at, symptomId, answers, tags }
  draft: null, // 入力途中の内容
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
  agreeConsent(licenseId) {
    const at = Date.now();
    set((s) => ({
      ...s,
      consent: { agreedAt: at, version: CONSENT_VERSION, licenseId: licenseId ?? s.settings.licenseId },
      consentLog: [
        makeConsentRecord({ at, licenseId: licenseId ?? s.settings.licenseId, kind: 'initial' }),
        ...s.consentLog,
      ].slice(0, 200),
    }));
  },
  logResultConsent(licenseId) {
    // 提案結果を表示するたびに残す確認ログ（企画書 改善策 #7）
    set((s) => ({
      ...s,
      consentLog: [makeConsentRecord({ licenseId: licenseId ?? s.settings.licenseId, kind: 'result' }), ...s.consentLog].slice(0, 200),
    }));
  },
  saveDraft(draft) {
    set((s) => ({ ...s, draft }));
  },
  clearDraft() {
    set((s) => ({ ...s, draft: null }));
  },
  saveResult(result) {
    set((s) => ({ ...s, lastResult: result }));
  },
  clearResult() {
    set((s) => ({ ...s, lastResult: null }));
  },
  resetAll() {
    clear();
    state = { ...DEFAULT_STATE, consentLog: [] };
    emit();
  },
};

export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
