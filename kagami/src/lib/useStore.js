// 端末内の状態（記録と設定）。保存は storage.js（localStorage のみ）。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { load, save, clear, storageSize } from './storage.js';
import { makeRecord, sortRecords } from './records.js';
import { makeCase, updateCase, sortCases, normalizeCase } from './cases.js';
import { makeTry } from './tried.js';
import { pushSnapshot, withSeenAt, makeUndo, UNDO_KEEP } from './caseTools.js';
import { toBackup, mergeRecords } from './backup.js';
import { mergeCases, mergeTries, mergePersonView } from './personIO.js';

const EMPTY = {
  records: [],
  cases: [],
  tries: [],
  myHabits: [],
  // hiddenByType は**型ごと**に隠した手（以前の hidden は型をまたいで消えていた）
  personView: {
    scene: '', core: '', history: [], hiddenByType: {}, filters: [], seenTypes: [], sort: 'catalog',
  },
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
      // 端末に入っているものも必ず形をそろえてから画面へ渡す
      cases: Array.isArray(loaded.cases) ? loaded.cases.map((c) => normalizeCase(c)).filter(Boolean) : [],
      tries: Array.isArray(loaded.tries) ? loaded.tries : [],
      myHabits: Array.isArray(loaded.myHabits) ? loaded.myHabits : [],
      personView: {
        ...EMPTY.personView,
        ...(loaded.personView || {}),
        // 古い形（型をまたぐ hidden）は引き継がない——隠したままだと
        // 「おすすめ3つ」が別の型でも黙って減る。隠し直せるようにして戻す
        hidden: undefined,
        hiddenByType:
          loaded.personView && typeof loaded.personView.hiddenByType === 'object'
            ? loaded.personView.hiddenByType
            : {},
      },
      settings: { ...EMPTY.settings, ...(loaded.settings || {}) },
    };
  });

  /**
   * 保存できなかったこと（端末がいっぱい等）を画面に出すための印。
   * **黙って失敗しない**——`save()` の戻り値を誰も見ていなかったので、
   * 「保存しました」と出たまま何も残らず、再読み込みで全部消えていた（実際に踏んだ）。
   */
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    // **消したものを端末に残さない。** undoCases は「消した直後だけ戻せる」ための
    // 覚え書きなので、保存に混ぜると消したはずの本文が localStorage に残り続ける。
    const { undoCases, ...persisted } = state;
    setSaveFailed(!save(persisted));
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
      // **続けて消しても、前のぶんを黙って捨てない**（1件しか持っていなかったので、
      // 2件目を消した瞬間に1件目が戻せなくなっていた）
      const undo = gone ? [makeUndo(gone), ...(s.undoCases || [])].slice(0, UNDO_KEEP) : s.undoCases;
      return { ...s, cases: s.cases.filter((c) => c.id !== id), undoCases: undo };
    });
  }, []);

  /** 消した直後のものを戻す（どれを戻すかは画面が選ぶ） */
  const undoRemoveCase = useCallback((id) => {
    let back = null;
    setState((s) => {
      const list = s.undoCases || [];
      const found = id ? list.find((u) => u.item.id === id) : list[0];
      if (!found) return s;
      back = found.item;
      return {
        ...s,
        cases: [found.item, ...s.cases.filter((c) => c.id !== found.item.id)],
        undoCases: list.filter((u) => u !== found),
      };
    });
    return back;
  }, []);

  /** 戻さずに案内だけ閉じる（画面の下をずっと覆わない） */
  const dismissUndo = useCallback((id) => {
    setState((s) => ({
      ...s,
      undoCases: (s.undoCases || []).filter((u) => (id ? u.item.id !== id : false)),
    }));
  }, []);

  const setMyHabits = useCallback((ids) => {
    setState((s) => ({ ...s, myHabits: ids }));
  }, []);

  /** 人間分析のぶんだけ消す（設定の「すべて消す」とは別） */
  const clearPeople = useCallback(() => {
    setState((s) => ({ ...s, cases: [], tries: [], undoCases: [], personView: EMPTY.personView }));
  }, []);

  /** 取り込み（画面側で必ず確認を出してから呼ぶ） */
  const importPeople = useCallback(({ cases = [], tries = [], myHabits = [], personView = null }) => {
    setState((s) => ({
      ...s,
      cases: mergeCases(s.cases, cases.map((c) => normalizeCase(c)).filter(Boolean)),
      tries: mergeTries(s.tries, tries),
      myHabits: [...new Set([...s.myHabits, ...myHabits])],
      personView: mergePersonView(s.personView, personView),
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

  /** その型で「合わない」と印を付けた手（型ごと。型をまたいで消さない） */
  const hideCounter = useCallback((typeId, tacticId) => {
    setState((s) => {
      const cur = s.personView.hiddenByType || {};
      const next = { ...cur };
      if (tacticId === null) delete next[typeId];
      else next[typeId] = [...new Set([...(cur[typeId] || []), tacticId])];
      return { ...s, personView: { ...s.personView, hiddenByType: next } };
    });
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

  /** この端末のものを、まるごと持ち出す */
  const exportAll = useCallback(() => toBackup(stateRef.current), []);

  /** まるごと取り込む（画面側で必ず確認を出してから呼ぶ） */
  const importAll = useCallback((data) => {
    setState((s) => ({
      ...s,
      records: mergeRecords(s.records, data.records || []),
      cases: mergeCases(s.cases, (data.cases || []).map((c) => normalizeCase(c)).filter(Boolean)),
      tries: mergeTries(s.tries, data.tries || []),
      myHabits: [...new Set([...s.myHabits, ...(data.myHabits || [])])],
      personView: mergePersonView(s.personView, data.personView),
    }));
  }, []);

  // 書き出しは「呼んだ時点の中身」を読む（state を閉じ込めると古いものが出る）
  const stateRef = useRef(state);
  stateRef.current = state;

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
    hideCounter,
    undoCases: state.undoCases || [],
    undoRemoveCase,
    dismissUndo,
    saveFailed,
    myHabits: state.myHabits,
    setMyHabits,
    clearPeople,
    importPeople,
    personView: state.personView,
    setPersonView,
    setSetting,
    clearAll,
    exportAll,
    importAll,
    storageSize,
  };
}
