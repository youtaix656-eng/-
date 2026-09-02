// 「アプリを閉じている間もタイマーを動かす」ための、Webで実際に使える数少ない手段を
// 1か所に集約する。結論から言うと、閉じている間そのものを正確に計り続けることは
// Webでは作れない（Service Workerは数十秒〜長くて数分しか生きられない）。
// ここにあるのはすべて「効けば嬉しいおまけ」で、対応環境も信頼性も限定的。
// 本命は別の2つ（①裏のタブなら動き続ける ②閉じても次に開いた時に正確に追いつく）で、
// Pomodoro.jsx側の時刻ベース設計（advanceState）が担っている。

/** @returns {boolean} navigator.setAppBadge に対応しているか（PWAインストール時のみ意味を持つ）。 */
export function hasBadging() {
  return typeof navigator !== 'undefined' && 'setAppBadge' in navigator;
}

/** アプリアイコンに残り分数を表示する（対応端末・PWAインストール時のみ）。失敗は握りつぶす。 */
export async function setAppBadgeMinutes(minutes) {
  if (!hasBadging()) return;
  try {
    if (minutes > 0) await navigator.setAppBadge(minutes);
    else await navigator.clearAppBadge();
  } catch (e) { /* noop */ }
}

export async function clearAppBadgeSafe() {
  if (!hasBadging()) return;
  try { await navigator.clearAppBadge(); } catch (e) { /* noop */ }
}

/**
 * @returns {boolean} TimestampTrigger（Notification Triggers API）に対応しているか。
 * 2026年時点でも一部のChromium系ブラウザの実験的機能でしかなく、多くの環境では
 * 常にfalseになる想定（それ自体は異常ではない）。
 */
export function hasNotificationTrigger() {
  return typeof window !== 'undefined' && typeof window.TimestampTrigger === 'function';
}

/**
 * 対応環境でだけ、指定時刻に通知を予約する（閉じていても届く可能性がある）。
 * 未対応環境では何もせずfalseを返す（呼び出し側は「効かないかもしれない」前提で扱う）。
 * @param {ServiceWorkerRegistration} reg
 * @param {number} whenMs 予約したい時刻（Date.now()と同じ単位）
 * @param {{title:string, body:string, tag?:string}} opts
 */
export async function scheduleTimestampNotification(reg, whenMs, opts) {
  if (!hasNotificationTrigger() || !reg || !reg.showNotification) return false;
  try {
    await reg.showNotification(opts.title, {
      body: opts.body,
      tag: opts.tag || 'pomodoro-trigger',
      // eslint-disable-next-line no-undef
      showTrigger: new TimestampTrigger(whenMs),
    });
    return true;
  } catch (e) {
    return false;
  }
}

/** 予約済みの通知トリガーを取り消す（tag指定）。未対応環境では何もしない。 */
export async function cancelTimestampNotification(reg, tag = 'pomodoro-trigger') {
  if (!reg || !reg.getNotifications) return;
  try {
    const list = await reg.getNotifications({ tag });
    list.forEach((n) => n.close());
  } catch (e) { /* noop */ }
}

/** @returns {boolean} Periodic Background Sync に対応しているか（PWAインストール必須・権限は別途要る）。 */
export function hasPeriodicSync() {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PeriodicSyncManager' in window;
}

/**
 * 対応環境・PWAインストール済みでだけ、定期的なバックグラウンド同期の登録を試みる。
 * 実際に何分おきに呼ばれるかはブラウザの裁量（本人の利用頻度等）で、多くの場合
 * 半日〜1日おき程度まで間引かれる。「勉強タイマーの通知」用途としては精度が粗すぎるため、
 * あくまで「登録できたら試す」だけの位置づけで、失敗しても静かに諦める。
 * @returns {Promise<'registered'|'unsupported'|'denied'|'error'>}
 */
export async function tryRegisterPeriodicSync(reg, tag = 'pomodoro-periodic-check') {
  if (!hasPeriodicSync() || !reg || !reg.periodicSync) return 'unsupported';
  try {
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (status.state !== 'granted') return 'denied';
    await reg.periodicSync.register(tag, { minInterval: 60 * 60 * 1000 });
    return 'registered';
  } catch (e) {
    return 'error';
  }
}

/** 診断表示用：3つのAPIの対応状況をまとめて返す。 */
export function backgroundCapabilities() {
  return {
    badging: hasBadging(),
    notificationTrigger: hasNotificationTrigger(),
    periodicSync: hasPeriodicSync(),
  };
}
