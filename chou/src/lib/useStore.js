// 画面から使う状態のまとめ。保存は storage.js（端末内だけ）。
//
// 決めていること
//  - 外から来たもの（取り込み）は必ず `normalizeDays` を通してから state に入れる。
//  - 消したものは 20 秒だけ戻せる（`undo`）。**戻せる間も、端末には消した後の形で保存する**
//    （戻す用の控えを保存に混ぜない）。
//  - 保存できなかったことを黙らない（`saveFailed` を画面のいちばん上に出す）。

import { useCallback, useEffect, useRef, useState } from 'react';
import { load, save, clear, storageSize } from './storage.js';
import { emptyDay, normalizeDays, normalizeDay, newId } from './days.js';
import { todayKey } from './dates.js';

const EMPTY = {
  days: {},
  foodResults: {},
  settings: { theme: 'auto' },
};

/** 消したものを戻せる時間 */
export const UNDO_MS = 20000;

function hydrate(raw) {
  return {
    days: normalizeDays(raw.days),
    foodResults: raw.foodResults && typeof raw.foodResults === 'object' ? { ...raw.foodResults } : {},
    settings: { ...EMPTY.settings, ...(raw.settings || {}) },
  };
}

export function useStore() {
  const [state, setState] = useState(() => hydrate(load(EMPTY)));
  const [saveFailed, setSaveFailed] = useState(false);
  const [undo, setUndo] = useState(null);
  const first = useRef(true);
  const undoTimer = useRef(null);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaveFailed(!save(state));
  }, [state]);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const offerUndo = useCallback((label, restore) => {
    clearTimeout(undoTimer.current);
    setUndo({ id: newId('u'), label, restore });
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  }, []);

  const clearUndo = useCallback(() => {
    clearTimeout(undoTimer.current);
    setUndo(null);
  }, []);

  const runUndo = useCallback(() => {
    setUndo((cur) => {
      if (cur) cur.restore();
      return null;
    });
    clearTimeout(undoTimer.current);
  }, []);

  /** 1日の記録を書き換える。`patch` は値でも関数でもよい */
  const updateDay = useCallback((date, patch) => {
    setState((prev) => {
      const before = prev.days[date] || emptyDay(date);
      const changed = typeof patch === 'function' ? patch(before) : { ...before, ...patch };
      const next = normalizeDay({ ...changed, date, updatedAt: Date.now() });
      if (!next) return prev;
      return { ...prev, days: { ...prev.days, [date]: next } };
    });
  }, []);

  const addStool = useCallback(
    (date, stool) => {
      updateDay(date, (day) => ({ ...day, stools: [...day.stools, { id: newId('s'), ...stool }] }));
    },
    [updateDay],
  );

  const updateStool = useCallback(
    (date, id, patch) => {
      updateDay(date, (day) => ({
        ...day,
        stools: day.stools.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      }));
    },
    [updateDay],
  );

  const removeStool = useCallback(
    (date, id) => {
      let removed = null;
      updateDay(date, (day) => {
        removed = day.stools.find((s) => s.id === id) || null;
        return { ...day, stools: day.stools.filter((s) => s.id !== id) };
      });
      if (removed) {
        const back = removed;
        offerUndo('お通じの記録を1件消しました', () =>
          updateDay(date, (day) => ({ ...day, stools: [...day.stools, back] })),
        );
      }
    },
    [updateDay, offerUndo],
  );

  const addMeal = useCallback(
    (date, meal) => {
      updateDay(date, (day) => ({ ...day, meals: [...day.meals, { id: newId('m'), ...meal }] }));
    },
    [updateDay],
  );

  const removeMeal = useCallback(
    (date, id) => {
      let removed = null;
      updateDay(date, (day) => {
        removed = day.meals.find((m) => m.id === id) || null;
        return { ...day, meals: day.meals.filter((m) => m.id !== id) };
      });
      if (removed) {
        const back = removed;
        offerUndo('たべもののメモを1件消しました', () =>
          updateDay(date, (day) => ({ ...day, meals: [...day.meals, back] })),
        );
      }
    },
    [updateDay, offerUndo],
  );

  const removeDay = useCallback(
    (date) => {
      setState((prev) => {
        const back = prev.days[date];
        if (!back) return prev;
        const days = { ...prev.days };
        delete days[date];
        offerUndo('1日ぶんの記録を消しました', () =>
          setState((cur) => ({ ...cur, days: { ...cur.days, [date]: back } })),
        );
        return { ...prev, days };
      });
    },
    [offerUndo],
  );

  const setFoodResult = useCallback((name, result) => {
    setState((prev) => {
      const next = { ...prev.foodResults };
      if (!result || next[name] === result) delete next[name];
      else next[name] = result;
      return { ...prev, foodResults: next };
    });
  }, []);

  const setSettings = useCallback((patch) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  }, []);

  const clearAll = useCallback(() => {
    clear();
    setState(hydrate(EMPTY));
    clearUndo();
  }, [clearUndo]);

  /** 書き出し。取り込みと同じ形（この端末の中身そのまま） */
  const exportAll = useCallback(
    () => ({
      app: 'chou',
      version: 1,
      exportedOn: todayKey(),
      days: state.days,
      foodResults: state.foodResults,
      settings: state.settings,
    }),
    [state],
  );

  /** 取り込み。**今あるものは消さない**（同じ日は、あとから直したほうを残す） */
  const importAll = useCallback((raw) => {
    if (!raw || typeof raw !== 'object') return { ok: false, added: 0, updated: 0 };
    const incoming = normalizeDays(raw.days);
    let added = 0;
    let updated = 0;
    setState((prev) => {
      const days = { ...prev.days };
      for (const key of Object.keys(incoming)) {
        const mine = days[key];
        if (!mine) {
          days[key] = incoming[key];
          added += 1;
        } else if ((incoming[key].updatedAt || 0) > (mine.updatedAt || 0)) {
          days[key] = incoming[key];
          updated += 1;
        }
      }
      return {
        ...prev,
        days,
        foodResults: { ...prev.foodResults, ...(raw.foodResults || {}) },
      };
    });
    return { ok: true, added, updated };
  }, []);

  return {
    ...state,
    saveFailed,
    undo,
    runUndo,
    clearUndo,
    updateDay,
    addStool,
    updateStool,
    removeStool,
    addMeal,
    removeMeal,
    removeDay,
    setFoodResult,
    setSettings,
    clearAll,
    exportAll,
    importAll,
    storageSize,
  };
}
