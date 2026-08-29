// 画面から使う状態。保存は storage.js（端末内のみ）。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { load, save, clear, storageSize, pushHistory, EMPTY } from './storage.js';

/** 試した記録の種類（増やす時はここだけ。画面が追従する） */
export const TRIED_STATUS = [
  { id: 'doing', label: '続けている', icon: '🔁' },
  { id: 'once', label: '試した', icon: '👍' },
  { id: 'notforme', label: '合わなかった', icon: '🙅' },
];

export function useStore() {
  const [state, setState] = useState(() => (typeof window === 'undefined' ? { ...EMPTY } : load()));
  const timer = useRef(null);

  // 書き込みはまとめる（打つたびに保存しない）
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(state), 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state]);

  // 閉じる時は待たずに書く（打ち込み途中の記録を落とさない）
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const flush = () => save(state);
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [state]);

  const toggleFavorite = useCallback((id) => {
    setState((s) => ({
      ...s,
      favorites: s.favorites.includes(id) ? s.favorites.filter((x) => x !== id) : [id, ...s.favorites],
    }));
  }, []);

  const setTried = useCallback((id, status) => {
    setState((s) => {
      const tried = { ...s.tried };
      if (!status || (tried[id] && tried[id].status === status)) delete tried[id];
      else tried[id] = { ...(tried[id] || {}), status, at: Date.now() };
      return { ...s, tried };
    });
  }, []);

  const setMemo = useCallback((id, memo) => {
    setState((s) => {
      const tried = { ...s.tried };
      const current = tried[id] || { status: 'once', at: Date.now() };
      if (!memo && !current.status) delete tried[id];
      else tried[id] = { ...current, memo };
      return { ...s, tried };
    });
  }, []);

  const remember = useCallback((query) => {
    setState((s) => ({ ...s, history: pushHistory(s.history, query) }));
  }, []);

  const forgetHistory = useCallback(() => setState((s) => ({ ...s, history: [] })), []);

  const setSettings = useCallback((patch) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const reset = useCallback(() => {
    clear();
    setState({ ...EMPTY });
  }, []);

  const favoriteSet = useMemo(() => new Set(state.favorites), [state.favorites]);

  return {
    state,
    favoriteSet,
    toggleFavorite,
    setTried,
    setMemo,
    remember,
    forgetHistory,
    setSettings,
    reset,
    storageSize,
  };
}
