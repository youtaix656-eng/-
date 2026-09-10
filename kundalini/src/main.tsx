import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // 束ねられた JS は assets/ の下にあるので、基準は document.baseURI で組み立てる
    const url = new URL('sw.js', document.baseURI).href;
    navigator.serviceWorker.register(url).catch(() => {
      /* オフライン対応が無効でもアプリ自体は動く */
    });
  });
}

// 記録は消えてほしくないので、対応端末では永続化ストレージを頼む（ベストエフォート）
if (navigator.storage?.persist) {
  void navigator.storage.persist().catch(() => {});
}
