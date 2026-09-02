// 通知許可のリクエスト・状態表示（Pomodoro.jsx本体とPomodoroConfigFields.jsxの両方が使うため
// 小さな共通ファイルへ切り出し、同じ分岐を2箇所に書かない）。

/** 通知の許可を1か所からリクエストする。 */
export function requestNotifyPermissionIfNeeded() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

/** 通知許可の現在状態を日本語で説明する。iPhone・iPad（Notification未対応）も含めて代替手段を明示する。 */
export function notifyStatusLabel() {
  if (typeof Notification === 'undefined') return 'この端末では通知に対応していません（iPhone・iPad含む。バイブレーションのみ利用できます）';
  if (Notification.permission === 'granted') return '許可済み';
  if (Notification.permission === 'denied') return 'ブロックされています（ブラウザの設定から許可してください）';
  return '未確認（通知間隔を設定すると確認されます）';
}
