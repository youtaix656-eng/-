// 「今すぐでなくてよい処理」を後ろへ回すための小さな道具（新項目06）。
//
// await afterPaint() を挟むと、その先は画面を描き終えてから走る。
// 起動直後の読み込みと最初の描画がぶつかると、指が触れた時に固まって見える。

/** 次の描画が終わるまで待つ。 */
export function afterPaint() {
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve();
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      // rAF の中はまだ描く前。もう1回またいで「描き終わった後」にする。
      if (typeof setTimeout === 'function') setTimeout(resolve, 0);
      else resolve();
    });
  });
}

/** ブラウザの手が空くまで待つ（最大 timeout ミリ秒）。 */
export function whenIdle(timeout = 2000) {
  // Chrome にはより細かい scheduler.postTask がある。無ければ requestIdleCallback。
  const scheduler = typeof globalThis !== 'undefined' ? globalThis.scheduler : null;
  if (scheduler && typeof scheduler.postTask === 'function') {
    try {
      return scheduler.postTask(() => {}, { priority: 'background' });
    } catch {
      /* 対応していない優先度なら下へ落ちる */
    }
  }
  if (typeof requestIdleCallback === 'function') {
    return new Promise((resolve) => requestIdleCallback(() => resolve(), { timeout }));
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}
