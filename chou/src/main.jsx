import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// ホーム画面に追加できるようにする（提案27）。
// **通知は登録しない**（サーバーを持たないので約束できない。README 決まり6）。
// 開発中は登録しない（古いファイルを掴んで直したものが出なくなるため）。
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // 初回インストールのときは controller が無いので、読み込み直さない
    if (reloading || !navigator.serviceWorker.controller) return;
    reloading = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    // **`import.meta.url` から組み立てない**——束ねられた JS は assets/ の下にあるので、
    // そこを見に行って 404 になる（実機で踏んだ）。基準はページ自身（`document.baseURI`）。
    const url = new URL('sw.js', document.baseURI);
    navigator.serviceWorker.register(url, { scope: './' }).catch(() => {
      // 使えない端末では静かに諦める（アプリはそのまま動く）
    });
  });
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
