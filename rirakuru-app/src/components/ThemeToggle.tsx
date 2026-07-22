"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { STORAGE_KEYS } from "@/lib/storage";

// ============================================================
// ダークモードの切り替えボタン
// <html class="dark"> を付け外しし、localStorage に記憶する。
// 初期反映は layout.tsx のインラインスクリプトで行う（チラつき防止）。
// ============================================================
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage.setItem(STORAGE_KEYS.theme, next ? "dark" : "light");
    } catch {
      /* 保存できなくても動作は継続 */
    }
    setDark(next);
  };

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "ライトモードに切り替え" : "ダークモードに切り替え"}
      className="flex h-11 w-11 items-center justify-center rounded-full text-cocoa-600 transition-colors hover:bg-cream-100 dark:text-cream-100 dark:hover:bg-cocoa-800"
    >
      {dark ? <Sun size={22} /> : <Moon size={22} />}
    </button>
  );
}
