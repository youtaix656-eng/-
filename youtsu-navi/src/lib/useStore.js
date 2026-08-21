// アプリ全体の状態。外部ライブラリを使わない小さなストア（購読 + localStorage 永続化）。

import { useSyncExternalStore } from 'react';
import { load, save, clear } from './storage.js';
import { CONSENT_VERSION, makeConsentRecord } from './consent.js';
import { makeRecord, upsertRecord, removeRecord, normalizeLabel } from './records.js';

export const DEFAULT_STATE = {
  settings: {
    theme: 'light', // 'light' | 'dark'
    fontScale: 'l', // 'm' | 'l' | 'xl'（既定は大きめ＝施術中の視認性優先）
    licenseId: null,
    symptomId: 'lowback',
    showOutOfScope: false, // 業務範囲外の提案も表示するか
    // 音声メモ入力（Phase 2）。既定はオフ＝明示的なオプトイン。
    // 音声認識はブラウザ提供元のサーバへ音声を送る場合があるため（lib/voice.js の注意書き）。
    voiceInput: false,
  },
  consent: null, // { agreedAt, version, licenseId }
  consentLog: [], // 同意履歴（企画書 改善策 #7）
  lastResult: null, // { at, symptomId, answers, tags }
  draft: null, // 入力途中の内容
  records: [], // カルテ（Phase 2）。端末内のみ・個人情報は持たない
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

  // ── カルテ（Phase 2）─────────────────────────────
  /** 評価結果をカルテに保存し、作成した記録を返す */
  saveRecord(result, extra = {}) {
    const record = makeRecord(result, extra);
    set((s) => ({ ...s, records: upsertRecord(s.records || [], record) }));
    return record;
  },
  updateRecord(id, patch) {
    set((s) => ({
      ...s,
      records: (s.records || []).map((r) =>
        r.id === id
          ? { ...r, ...patch, clientLabel: patch.clientLabel !== undefined ? normalizeLabel(patch.clientLabel) : r.clientLabel, updatedAt: Date.now() }
          : r,
      ),
    }));
  },
  deleteRecord(id) {
    set((s) => ({ ...s, records: removeRecord(s.records || [], id) }));
  },
  /** バックアップの取り込み（同じidは新しい方を残す） */
  importRecords(incoming = []) {
    let added = 0;
    set((s) => {
      let list = s.records || [];
      for (const r of incoming) {
        const exists = list.find((x) => x.id === r.id);
        if (exists && (exists.updatedAt || 0) >= (r.updatedAt || 0)) continue;
        list = upsertRecord(list, r);
        added += 1;
      }
      return { ...s, records: list };
    });
    return added;
  },
  clearRecords() {
    set((s) => ({ ...s, records: [] }));
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
