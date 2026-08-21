import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages のサブパス配信（/-/henkaku-note）を考慮し、相対パスでビルドする
export default defineConfig({
  plugins: [react()],
  base: './',
});
