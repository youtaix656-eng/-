// 「今日の記録がまだ無ければ知らせる」ローカル通知。
//
// 重要な制約: これはアプリ（タブ）を開いている間だけ動くベストエフォートの仕組み。
// アプリを閉じた後にも確実に届く通知には Web Push + サーバー + Service Worker の
// 購読が必要で、このアプリはサーバー無し・ブラウザ完結の方針のため対応していない。
// 「うっかり閉じ忘れたときの保険」程度に考えてください。

import type { SleepRecord } from '../types/sleep';
import { todayISODate } from './time';

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30分おきにチェック
const REMIND_FROM_HOUR = 18; // 夕方以降だけ知らせる

let intervalId: number | null = null;
let lastNotifiedDate: string | null = null;

export function isNotificationSupported(): boolean {
  return typeof Notification !== 'undefined';
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  return Notification.requestPermission();
}

export function startReminderWatch(getRecords: () => SleepRecord[]): void {
  stopReminderWatch();
  if (!isNotificationSupported()) return;

  const check = () => {
    if (Notification.permission !== 'granted') return;
    if (new Date().getHours() < REMIND_FROM_HOUR) return;
    const todayISO = todayISODate();
    if (lastNotifiedDate === todayISO) return;

    const today = getRecords().find((r) => r.date === todayISO);
    if (today?.coreSleep.start) return;

    lastNotifiedDate = todayISO;
    new Notification('睡眠トラッカー', {
      body: '今日の睡眠がまだ記録されていません',
      icon: './icons/icon-192.png',
    });
  };

  intervalId = window.setInterval(check, CHECK_INTERVAL_MS);
}

export function stopReminderWatch(): void {
  if (intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
}
