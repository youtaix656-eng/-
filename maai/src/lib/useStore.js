// 端末内の状態（記録・やってみた印・設定）。保存は storage.js（localStorage のみ）。
import { useCallback, useEffect, useMemo, useState } from 'react';
import { load, save, clear, storageSize } from './storage.js';
import { makeRecord, sortRecords } from './records.js';

const EMPTY = {
  records: [],
  // 近づき方のうち「やってみた」印。**効き目は記録しない**——分かるのは
  // 自分がそれをやれたかどうかまでで、相手の変化は測れない（点数を付けない線）。
  tried: {},
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
      tried: loaded.tried && typeof loaded.tried === 'object' ? loaded.tried : {},
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

  /** 近づき方に「やってみた」印を付ける／外す */
  const toggleTried = useCallback((approachId) => {
    setState((s) => {
      const next = { ...s.tried };
      if (next[approachId]) delete next[approachId];
      else next[approachId] = Date.now();
      return { ...s, tried: next };
    });
  }, []);

  const setSetting = useCallback((key, value) => {
    setState((s) => ({ ...s, settings: { ...s.settings, [key]: value } }));
  }, []);

  const clearAll = useCallback(() => {
    clear();
    setState(EMPTY);
  }, []);

  const records = useMemo(() => sortRecords(state.records), [state.records]);

  return {
    records,
    tried: state.tried,
    settings: state.settings,
    addRecord,
    removeRecord,
    toggleTried,
    setSetting,
    clearAll,
    storageSize,
  };
}
