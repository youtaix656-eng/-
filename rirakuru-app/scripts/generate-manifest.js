// ============================================================
// PWA マニフェスト（public/manifest.webmanifest）を生成する。
// basePath（GitHub Pages のサブパス）を各パスに反映する。
// build 前に自動実行される（package.json の "prebuild"）。
//   ローカル: NEXT_PUBLIC_BASE_PATH 未設定 → "/"
//   公開ビルド: CI が NEXT_PUBLIC_BASE_PATH=/-/rirakuru を渡す
// ============================================================
const fs = require("fs");
const path = require("path");

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

const manifest = {
  name: "りらくる 業務マニュアル",
  short_name: "業務マニュアル",
  description:
    "りらくる セラピストの業務手順・接客ルール・施術内容の個人用マニュアル",
  start_url: `${base}/`,
  scope: `${base}/`,
  display: "standalone",
  orientation: "portrait",
  background_color: "#faf7f2",
  theme_color: "#6f4e37",
  lang: "ja",
  icons: [
    { src: `${base}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
    { src: `${base}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
    { src: `${base}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

const out = path.join(__dirname, "..", "public", "manifest.webmanifest");
fs.writeFileSync(out, JSON.stringify(manifest, null, 2));
console.log(`wrote public/manifest.webmanifest (base="${base || "/"}")`);
