import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages などのサブパス配信を考慮し、相対パスでビルドする
export default defineConfig({
  plugins: [react()],
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
