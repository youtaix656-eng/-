// テキストから QR のます目（true＝黒）を作る。**画像ファイルを持たない**——
// 画面では SVG でその場に四角を描く（README 決まり9）。
//
// **このファイルはライブラリを読み込まない。** `src/lib` は
// 「送る仕組みを持たない」ことを機械チェックしているので、あとから読み込む書き方もここには置かない。
// 同梱の MIT ライセンスのライブラリ（`vendor/qrcode-generator.mjs`）は、
// 受け渡しの画面が押された時に読み込んで、この関数へ渡す。

/** `qrcode` は vendor の作る関数。入りきらない時は null を返す（**入ったふりをしない**） */
export function toMatrix(qrcode, text) {
  try {
    const qr = qrcode(0, 'L');
    qr.addData(String(text), 'Byte');
    qr.make();
    const n = qr.getModuleCount();
    const m = [];
    for (let r = 0; r < n; r += 1) {
      const row = [];
      for (let c = 0; c < n; c += 1) row.push(qr.isDark(r, c));
      m.push(row);
    }
    return m;
  } catch {
    return null;
  }
}
