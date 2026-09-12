// 画面を眠らせない（Wake Lock）と、裏に回っている時の端末通知。
// ⚠ どちらも「アプリが生きている間」しか効かない。サーバーを持たないので押し通知は無い。
//    通知は既定オフで、押した時にだけ許可を求める。

type WakeLockSentinelLike = { release: () => Promise<void>; addEventListener?: (t: string, cb: () => void) => void };

let sentinel: WakeLockSentinelLike | null = null;

export function wakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

export async function acquireWakeLock(): Promise<void> {
  if (!wakeLockSupported() || sentinel) return;
  try {
    const nav = navigator as unknown as { wakeLock: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } };
    sentinel = await nav.wakeLock.request('screen');
    sentinel.addEventListener?.('release', () => {
      sentinel = null;
    });
  } catch {
    sentinel = null;
  }
}

export async function releaseWakeLock(): Promise<void> {
  if (!sentinel) return;
  try {
    await sentinel.release();
  } catch {
    /* noop */
  }
  sentinel = null;
}

export function notifySupported(): boolean {
  return typeof Notification !== 'undefined';
}

export async function requestNotifyPermission(): Promise<boolean> {
  if (!notifySupported()) return false;
  try {
    const r = await Notification.requestPermission();
    return r === 'granted';
  } catch {
    return false;
  }
}

/** 裏に回っている時だけ出す（前にいる時は画面が伝える） */
export function notifyIfHidden(title: string, body: string): void {
  if (!notifySupported() || Notification.permission !== 'granted') return;
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;
  try {
    const n = new Notification(title, { body, silent: true, tag: 'earpomo-phase' });
    n.onclick = () => {
      try {
        window.focus();
      } catch {
        /* noop */
      }
      n.close();
    };
  } catch {
    /* noop */
  }
}
