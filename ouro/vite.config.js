import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages のサブパス配信（/-/ouro）を考慮し、相対パスでビルドする
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        // 項目06：初期の1ファイルに全部を詰めない。
        //  - react は中身が変わらないので、アプリを更新してもキャッシュが効く
        //  - 役職・キャラクターの定義は量が多いので分ける（並行して読める）
        manualChunks(id) {
          if (id.includes('node_modules/react')) return 'react';
          if (id.includes('/src/data/characters.js') || id.includes('/src/data/roles.js')) {
            return 'roster';
          }
          return undefined;
        },
      },
    },
  },
});
