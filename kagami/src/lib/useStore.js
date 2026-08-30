// 端末内の状態（記録と設定）。保存は storage.js（localStorage のみ）。
import { useCallback, useEffect, useMemo, useState } from 'react';
import { load, save, clear, storageSize } from './storage.js';
import { makeRecord, sortRecords } from './records.js';
import { makeCase, updateCase, sortCases } from './cases.js';
import { makeTry } from './tried.js';
import { pushSnapshot, withSeenAt, makeUndo } from './caseTools.js';
import { mergeCases, mergeTries } from './personIO.js';

const EMPTY = {
  records: [],
  cases: [],
  tries: [],
  myHabits: [],
  personView: { scene: '', core: '', history: [], hidden: [], filters: [], seenTypes: [], sort: 'catalog' },
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
      tries: Array.isArray(loaded.tries) ? loaded.tries : [],
      myHabits: Array.isArray(loaded.myHabits) ? loaded.myHabits : [],
      personView: { ...EMPTY.personView, ...(loaded.personView || {}) },
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
      if (found) {
        // 直す前の中身を版として残してから書き換える（上書きで消さない）
        const snapshots = pushSnapshot(found, input.checkedIds || found.checkedIds);
        saved = {
          ...updateCase(found, input),
          snapshots,
          seenAt: withSeenAt(found.seenAt, input.checkedIds || found.checkedIds),
          stage: input.stage === undefined ? found.stage || 0 : input.stage,
          status: input.status === undefined ? found.status || 'open' : input.status,
          nextAction: input.nextAction === undefined ? found.nextAction || '' : input.nextAction,
          nextMeetAt: input.nextMeetAt === undefined ? found.nextMeetAt || '' : input.nextMeetAt,
        };
      } else {
        saved = {
          ...makeCase(input),
          snapshots: [],
          seenAt: withSeenAt({}, input.checkedIds || []),
          stage: input.stage || 0,
          status: input.status || 'open',
          nextAction: input.nextAction || '',
          nextMeetAt: input.nextMeetAt || '',
        };
      }
      const rest = s.cases.filter((c) => c.id !== saved.id);
      return { ...s, cases: [saved, ...rest] };
    });
    return saved;
  }, []);

  const removeCase = useCallback((id) => {
    setState((s) => {
      const gone = s.cases.find((c) => c.id === id) || null;
      return { ...s, cases: s.cases.filter((c) => c.id !== id), undoCase: makeUndo(gone) };
    });
  }, []);

  /** 消した直後の1件だけ戻せる */
  const undoRemoveCase = useCallback(() => {
    setState((s) => (s.undoCase ? { ...s, cases: [s.undoCase.item, ...s.cases], undoCase: null } : s));
  }, []);

  const setMyHabits = useCallback((ids) => {
    setState((s) => ({ ...s, myHabits: ids }));
  }, []);

  /** 人間分析のぶんだけ消す（設定の「すべて消す」とは別） */
  const clearPeople = useCallback(() => {
    setState((s) => ({ ...s, cases: [], tries: [], undoCase: null, personView: EMPTY.personView }));
  }, []);

  /** 取り込み（画面側で必ず確認を出してから呼ぶ） */
  const importPeople = useCallback(({ cases = [], tries = [], myHabits = [] }) => {
    setState((s) => ({
      ...s,
      cases: mergeCases(s.cases, cases),
      tries: mergeTries(s.tries, tries),
      myHabits: [...new Set([...s.myHabits, ...myHabits])],
    }));
  }, []);

  const addTry = useCallback((input) => {
    const t = makeTry(input);
    setState((s) => ({ ...s, tries: [t, ...s.tries] }));
    return t;
  }, []);

  const removeTry = useCallback((id) => {
    setState((s) => ({ ...s, tries: s.tries.filter((t) => t.id !== id) }));
  }, []);

  /** 人間分析のしぼり込み・検索履歴・隠した手を覚えておく */
  const setPersonView = useCallback((patch) => {
    setState((s) => ({ ...s, personView: { ...s.personView, ...patch } }));
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
    tries: state.tries,
    addTry,
    removeTry,
    undoCase: state.undoCase || null,
    undoRemoveCase,
    myHabits: state.myHabits,
    setMyHabits,
    clearPeople,
    importPeople,
    personView: state.personView,
    setPersonView,
    setSetting,
    clearAll,
    storageSize,
  };
}
