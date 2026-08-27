// 終わったことを知らせる（端末の通知）と、走っている間 眠らせない（Wake Lock）。
//
// **サーバーを持たないので、押し通知（プッシュ）は作れない。**
// 出せるのは「アプリが生きている間の、端末の中の通知」だけ。
// つまり裏に回っているタブが仕事を終えた時には出せるが、
// アプリを完全に閉じている間には出せない。**そこは正直に画面へ書く。**
//
// どちらも**既定オフのオプトイン**。勝手に許可を求めない。

export function canNotify(win = typeof window === 'undefined' ? null : window) {
  return Boolean(win && 'Notification' in win);
}

export function notifyState(win = typeof window === 'undefined' ? null : window) {
  if (!canNotify(win)) return 'unsupported';
  return win.Notification.permission; // 'default' | 'granted' | 'denied'
}

/** 許可を頼む。**押した時だけ**呼ぶこと（勝手に出すと嫌われて拒否される）。 */
export async function askNotifyPermission(win = typeof window === 'undefined' ? null : window) {
  if (!canNotify(win)) return 'unsupported';
  try {
    return await win.Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/**
 * 仕事が終わったことを知らせる。
 * @returns {boolean} 実際に出せたか
 */
export function notifyDone(task, { win = typeof window === 'undefined' ? null : window, onClick } = {}) {
  if (!canNotify(win) || win.Notification.permission !== 'granted') return false;
  try {
    const n = new win.Notification('成果物が完成しました', {
      body: (task && task.title) || '仕事が終わりました',
      // 同じ仕事で何度も出さない
      tag: `ouro-task-${task && task.id}`,
      silent: false,
    });
    n.onclick = () => {
      try {
        win.focus();
      } catch {
        /* noop */
      }
      n.close();
      if (onClick) onClick(task);
    };
    return true;
  } catch {
    return false;
  }
}

// ── 走っている間、画面を眠らせない ──
//
// スマホは画面が消えるとタブを止めることがある。実行中だけ Wake Lock を取れば
// 最後まで走り切れる。**終わったら必ず離すこと**（点けっぱなしは電池を食う）。

let lock = null;

export function canKeepAwake(nav = typeof navigator === 'undefined' ? null : navigator) {
  return Boolean(nav && nav.wakeLock && typeof nav.wakeLock.request === 'function');
}

export async function keepAwake(nav = typeof navigator === 'undefined' ? null : navigator) {
  if (!canKeepAwake(nav) || lock) return false;
  try {
    lock = await nav.wakeLock.request('screen');
    // 画面が隠れると勝手に外れる。覚えている参照も捨てる。
    lock.addEventListener?.('release', () => {
      lock = null;
    });
    return true;
  } catch {
    lock = null;
    return false;
  }
}

export async function releaseAwake() {
  if (!lock) return;
  try {
    await lock.release();
  } catch {
    /* noop */
  }
  lock = null;
}

/** テスト用。 */
export function isAwake() {
  return Boolean(lock);
}
