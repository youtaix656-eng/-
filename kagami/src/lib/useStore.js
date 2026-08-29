// 端末内の状態（記録と設定）。保存は storage.js（localStorage のみ）。
import { useCallback, useEffect, useMemo, useState } from 'react';
import { load, save, clear, storageSize } from './storage.js';
import { makeRecord, sortRecords } from './records.js';
import { makeCase, updateCase, sortCases } from './cases.js';

const EMPTY = {
  records: [],
  cases: [],
  settings: {
    keepRaw: false, // 記録するとき本文をそのまま残すか（既定は伏せる）
    seenIntro: false,
  },
};

export function useStore() {
  const [state, setState] = useState(() => {
    const loaded = load(EMPTY);
    return {
      ...EMPTY,
      ...loaded,
      records: Array.isArray(loaded.records) ? loaded.records : [],
      cases: Array.isArray(loaded.cases) ? loaded.cases : [],
      settings: { ...EMPTY.settings, ...(loaded.settings || {}) },
    };
  });

  useEffect(() => {
    save(state);
  }, [state]);

  const addRecord = useCallback((input) => {
    const record = makeRecord({ ...input, keepRaw: input.keepRaw });
    setState((s) => ({ ...s, records: [record, ...s.records] }));
    return record;
  }, []);

  const removeRecord = useCallback((id) => {
    setState((s) => ({ ...s, records: s.records.filter((r) => r.id !== id) }));
  }, []);

  /** 新しく作る／既にある見立てを直す（id があれば上書き） */
  const saveCase = useCallback((input) => {
    let saved = null;
    setState((s) => {
      const found = input.id ? s.cases.find((c) => c.id === input.id) : null;
      saved = found ? updateCase(found, input) : makeCase(input);
      const rest = s.cases.filter((c) => c.id !== saved.id);
      return { ...s, cases: [saved, ...rest] };
    });
    return saved;
  }, []);

  const removeCase = useCallback((id) => {
    setState((s) => ({ ...s, cases: s.cases.filter((c) => c.id !== id) }));
  }, []);

  const setSetting = useCallback((key, value) => {
    setState((s) => ({ ...s, settings: { ...s.settings, [key]: value } }));
  }, []);

  const clearAll = useCallback(() => {
    clear();
    setState(EMPTY);
  }, []);

  const records = useMemo(() => sortRecords(state.records), [state.records]);
  const cases = useMemo(() => sortCases(state.cases), [state.cases]);

  return {
    records,
    cases,
    settings: state.settings,
    addRecord,
    removeRecord,
    saveCase,
    removeCase,
    setSetting,
    clearAll,
    storageSize,
  };
}
