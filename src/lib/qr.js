import qrcode from './vendor/qrcode-generator.mjs';

// テキストから QR のモジュール2次元配列（true=黒）を返す。大きすぎる場合は null。
export function qrMatrix(text) {
  try {
    const qr = qrcode(0, 'L'); // type 0 = 自動サイズ, 誤り訂正 L
    qr.addData(text, 'Byte');
    qr.make();
    const n = qr.getModuleCount();
    const m = [];
    for (let r = 0; r < n; r++) {
      const row = [];
      for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
      m.push(row);
    }
    return m;
  } catch (e) {
    return null; // 収まらない
  }
}
