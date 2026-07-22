"use client";

import { useCallback, useEffect, useState } from "react";
import { readJSON, writeJSON, STORAGE_KEYS } from "./storage";

// ============================================================
// お気に入り（★）の状態を localStorage に保存するフック
// 複数コンポーネントで同じ状態を共有するため、簡易なイベントで同期する。
// ============================================================

const EVENT = "rirakuru:favorites-changed";

function readFavorites(): string[] {
  return readJSON<string[]>(STORAGE_KEYS.favorites, []);
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  // 初期読み込み＋他コンポーネント/別タブからの変更を購読
  useEffect(() => {
    setFavorites(readFavorites());
    const sync = () => setFavorites(readFavorites());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const current = readFavorites();
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    writeJSON(STORAGE_KEYS.favorites, next);
    setFavorites(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const isFavorite = useCallback(
    (id: string) => favorites.includes(id),
    [favorites]
  );

  return { favorites, toggle, isFavorite };
}
