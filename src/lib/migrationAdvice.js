// 機種変更ガイド（MigrationGuide.jsx）向け：状況に合った移行方法の自動判定。
// あくまで「おすすめ」の提案であり、他の方法もいつでも選べる（強制はしない）。

// QR誤り訂正レベルLの実用容量（qr.js側の目安と揃える）に対して十分小さい、
// QR1枚で収まる目安のバイト数
const QR_SINGLE_FRAME_BYTES = 2500;
// これを超えるとQR分割の枚数が多くなりすぎて非現実的になってくる目安
const QR_MANY_FRAMES_LIMIT = 60_000;
// Web Share・WebRTCで問題なく渡せる目安の上限（あまりに大きいと失敗しうる）
const REASONABLE_TRANSFER_LIMIT = 20_000_000; // 20MB

export const MIGRATION_METHODS = {
  qr: { id: 'qr', title: 'QRコードでその場で移行' },
  'qr-multi': { id: 'qr-multi', title: '分割QR（自動連続表示）' },
  share: { id: 'share', title: '共有ボタン' },
  webrtc: { id: 'webrtc', title: 'WebRTCで直接転送' },
  file: { id: 'file', title: 'バックアップファイル' },
};

// syncPayloadBytes: QR/URL受け渡し用ペイロード（進捗・設定のみ、圧縮後）のバイト数
// fullBackupBytes: 問題データも含む完全バックアップのバイト数
// hasShareApi: この端末がWeb Share API（ファイル共有）に対応しているか（後方互換のため残す。
//   capabilities.shareApi が指定されていればそちらを優先する）
// capabilities: deviceCapabilities.jsのcheckDeviceCapabilities()の戻り値（任意）。
//   指定すると、この端末で実際には使えない方法（カメラ非対応なのにQRをすすめる 等）を除外する。
//   未指定時は全て対応しているものとして扱う（既存呼び出し側との後方互換）。
export function recommendMigrationMethod({ syncPayloadBytes, fullBackupBytes, hasShareApi, capabilities }) {
  const caps = {
    camera: true,
    webrtc: true,
    shareApi: hasShareApi,
    ...capabilities,
  };

  if (syncPayloadBytes != null && syncPayloadBytes <= QR_SINGLE_FRAME_BYTES && caps.camera) {
    return {
      ...MIGRATION_METHODS.qr,
      reason: '進捗・設定だけならQRコード1枚で収まるサイズです。最も手軽な方法です。',
    };
  }
  if (syncPayloadBytes != null && syncPayloadBytes <= QR_MANY_FRAMES_LIMIT && caps.camera) {
    return {
      ...MIGRATION_METHODS['qr-multi'],
      reason: 'QRを複数枚に自動分割して連続表示すれば移行できます。相手のカメラをかざし続けるだけです。',
    };
  }
  if (caps.shareApi) {
    return {
      ...MIGRATION_METHODS.share,
      reason: '問題データも含めたバックアップ全体は、共有ボタン（AirDrop・LINE・Google Drive等）で直接送るのが簡単です。',
    };
  }
  if (caps.webrtc && (fullBackupBytes == null || fullBackupBytes <= REASONABLE_TRANSFER_LIMIT)) {
    return {
      ...MIGRATION_METHODS.webrtc,
      reason: '共有ボタンが使えない環境では、WebRTCで端末同士を直接つないで転送できます（同じWi-Fiがおすすめ）。',
    };
  }
  return {
    ...MIGRATION_METHODS.file,
    reason: 'データ量が大きいため、バックアップファイルを保存してクラウドストレージ経由で移すのが確実です。',
  };
}
