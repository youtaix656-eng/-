"use client";

import { useEffect } from "react";

// ============================================================
// Service Worker を登録して PWA（オフライン閲覧）を有効化する。
// 本番ビルド（npm run build → start）で有効に動作する。
// ============================================================
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }
    // GitHub Pages のサブパス配信に対応（例: /-/rirakuru/sw.js）
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    navigator.serviceWorker.register(`${base}/sw.js`).catch(() => {
      // 登録に失敗してもアプリ自体は通常どおり動く
    });
  }, []);

  return null;
}
