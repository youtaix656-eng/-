// この端末が各移行方法に必要なブラウザ機能に対応しているかを調べる。
// MigrationGuide.jsxで「この端末の対応状況」として表示し、recommendMigrationMethod
// （migrationAdvice.js）が対応していない方法をすすめないようにするために使う。
// テストしやすいよう window/navigator を引数で受け取れるようにしている
// （省略時は実際のグローバルを使う）。

export function checkDeviceCapabilities(
  win = typeof window !== 'undefined' ? window : {},
  nav = typeof navigator !== 'undefined' ? navigator : {}
) {
  return {
    camera: !!(nav.mediaDevices && nav.mediaDevices.getUserMedia),
    barcodeDetector: 'BarcodeDetector' in win,
    webrtc: 'RTCPeerConnection' in win,
    shareApi: !!nav.share,
    clipboard: !!(nav.clipboard && nav.clipboard.writeText),
  };
}
