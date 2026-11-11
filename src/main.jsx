import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';
import { installErrorHandlers } from './lib/errorLog.js';
import { isPomoRunning, isAudioPlaying } from './lib/runtimeFlags.js';

// 端末内エラーログを有効化（外部送信なし。設定→データ管理で閲覧・消去）
installErrorHandlers();

// 自動世代バックアップ（#3）：起動後に1日1回だけ、進捗の世代スナップショットを取る。
//   起動処理と競合しないよう遅延実行し、失敗しても本体に影響させない。
if (typeof window !== 'undefined' && !import.meta.env.DEV) {
  setTimeout(() => {
    Promise.all([import('./lib/backupSnapshots.js'), import('./lib/storage.js')])
      .then(([snap, storage]) => snap.maybeAutoSnapshot(storage))
      .catch(() => {});
  }, 8000);
}

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
  //
  // ただし、ポモドーロタイマー実行中・音声学習×連結学習の再生中はリロードすると
  // 進行中のセッションが断りなく中断され「アプリが止まった/リセットされた」ように
  // 見えてしまう（2026-11-12：音声学習だけ他アプリへ切り替えて戻ると止まるという
  // 報告があり調査した結果、音声側だけこのガードから漏れていたことを発見・追加した。
  // ポモドーロと同じ理由で、実行中は少し待って再チェックし、止まった/一区切りついた
  // タイミングで反映する）。ずっと実行し続けて無期限に古いバージョンのままになるのを
  // 避けるため、一定回数（MAX_DEFERRALS×RECHECK_MS＝約10分）待っても実行中のままなら
  // 強制的に反映する。
  let reloading = false;
  let deferCount = 0;
  const RECHECK_MS = 15000;
  const MAX_DEFERRALS = 40;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !navigator.serviceWorker.controller) return;
    const attempt = () => {
      if (reloading) return;
      if ((isPomoRunning() || isAudioPlaying()) && deferCount < MAX_DEFERRALS) {
        if (deferCount === 0) {
          // 初回だけ、更新を保留していることを知らせる（黙って何も起きないと
          // 「反映されていない？」と不安にさせるため）。
          window.dispatchEvent(new CustomEvent('app-update-deferred'));
        }
        deferCount += 1;
        setTimeout(attempt, RECHECK_MS);
        return;
      }
      reloading = true;
      window.location.reload();
    };
    attempt();
  });

  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker
      .register(swUrl)
      .then((reg) => {
        // 起動時と、以後定期的に更新確認。ポモドーロ実行中・音声学習の再生中はこの
        // 確認自体をスキップする（確認しても意味の無い自動リロードが即座に保留される
        // だけなので、次の巡回まで待たせて確認の負荷そのものも減らす）。
        const skipCheck = () => isPomoRunning() || isAudioPlaying();
        if (!skipCheck()) reg.update();
        setInterval(() => { if (!skipCheck()) reg.update(); }, 60 * 60 * 1000);
      })
      .catch((e) => {
        console.warn('Service Worker 登録に失敗しました', e);
      });
  });
}
