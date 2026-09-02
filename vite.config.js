import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

// GitHub Pages などのサブパス配信を考慮し、相対パスでビルドする
export default defineConfig({
  plugins: [
    react(),
    // `npm run build:analyze` の時だけ dist/stats.html にバンドル構成のtreemapを出す
    // （通常のビルド・デプロイでは生成しない。手動でファイルサイズを推定する代わりに
    // 数字でボトルネックを継続観測するためのツール）。
    ...(process.env.ANALYZE ? [visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true })] : []),
  ],
  base: './',
  build: {
    rollupOptions: {
      output: {
        // react/react-dom は更新頻度がアプリ本体のコードよりずっと低いため、
        // 別チャンクに分けておくと、アプリを更新した時にService Worker経由の
        // 再ダウンロードがアプリ本体分だけで済む（vendorチャンクはハッシュが
        // 変わらない限りキャッシュを再利用できる）。
        manualChunks: (id) =>
          id.includes('node_modules') && (id.includes('/react/') || id.includes('/react-dom/'))
            ? 'vendor-react'
            : undefined,
      },
    },
  },
});
