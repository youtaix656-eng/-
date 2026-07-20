import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Service Worker 登録（オフライン起動・ホーム画面追加・自動更新のため）
// dev サーバーでは登録しない（HMR と競合するため）。
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  // 新しいバージョンが有効化されたら一度だけリロードして最新に切り替える。
  // （初回インストール時は controller が無いのでリロードしない）
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !navigator.serviceWorker.controller) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker
      .register(swUrl)
      .then((reg) => {
        // 起動時と、以後定期的に更新確認
        reg.update();
        setInterval(() => reg.update(), 60 * 60 * 1000);
      })
      .catch((e) => {
        console.warn('Service Worker 登録に失敗しました', e);
      });
  });
}
