import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { actions } from './lib/useStore';
import './styles.css';

// 保存済みのデータを読んでから描画する（一瞬だけ空の状態が見える、を避ける）
void actions.hydrate();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* オフライン対応が無効でもアプリ自体は動く */
    });
  });
}

// 記録は消えてほしくないデータなので、対応端末では永続化ストレージを要求する（ベストエフォート）
if (navigator.storage?.persist) {
  void navigator.storage.persist().catch(() => {});
}
