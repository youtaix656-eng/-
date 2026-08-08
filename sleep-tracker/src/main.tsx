import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW register failed', e));
  });
}

// 睡眠記録はブラウザのストレージ整理で消えてほしくないデータなので、
// 端末が対応していれば永続化ストレージを要求しておく（ベストエフォート）。
if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}
