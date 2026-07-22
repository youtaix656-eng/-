/** @type {import('next').NextConfig} */

// GitHub Pages のサブパス（例: /-/rirakuru）配信に対応するための basePath。
// ローカル開発時は空（"/"）、公開ビルド時は CI が環境変数で指定する。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  // 静的サイトとして書き出す（out/ に生成）。GitHub Pages で配信できる。
  output: "export",
  // サブパス配信。空文字のときは付与しない。
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  // GitHub Pages は末尾スラッシュのディレクトリ index を配信しやすい
  trailingSlash: true,
  // 静的書き出しでは next/image の最適化を無効化する必要がある
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
