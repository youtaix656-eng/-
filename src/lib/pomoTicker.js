// ポモドーロタイマーの「1秒ごとの見直し」を起こす仕組み。
// 画面を消した・アプリを裏に回した時、ページ本体のsetIntervalはブラウザに間引かれて
// ほとんど動かなくなる（曲は<audio>なので鳴り続けるのに、休憩に入る処理もカウントダウンも
// 走らない、という食い違いが起きる。2026-11-15 ユーザー報告）。
// Web Workerの中のタイマーは間引かれにくいので、そちらからも毎秒起こしてもらう。
// ページ本体のsetIntervalも残す（Workerが使えない環境の受け皿）。同じ秒に2回呼ばれても
// よいよう、呼ばれる側（Pomodoro.jsx）が二重実行を防ぐ。
// ※ ページごと凍結された場合（OSがタブを止めた等）はどちらも動かない。その時は
//   画面へ戻った瞬間（visibilitychange）に追いつく。
export function startTicker(onTick, intervalMs = 1000) {
  let worker = null;
  let url = null;
  try {
    if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
      url = URL.createObjectURL(new Blob(
        [`setInterval(function(){postMessage(0)},${Math.max(250, Math.floor(intervalMs))});`],
        { type: 'text/javascript' },
      ));
      worker = new Worker(url);
      worker.onmessage = () => onTick();
      worker.onerror = () => { /* 受け皿のsetIntervalに任せる */ };
    }
  } catch (e) {
    worker = null;
  }
  const timer = setInterval(onTick, intervalMs);
  return () => {
    clearInterval(timer);
    try { worker?.terminate(); } catch (e) { /* noop */ }
    try { if (url) URL.revokeObjectURL(url); } catch (e) { /* noop */ }
  };
}
