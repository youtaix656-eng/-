import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages などのサブパス配信を考慮し、相対パスでビルドする
export default defineConfig({
  plugins: [react()],
  base: './',
});
