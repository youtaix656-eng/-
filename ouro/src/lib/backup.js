// 「そろそろ書き出しましょう」の判定だけを持つ小さなファイル。
//
// Ouro はサーバーを持たないので、**端末が壊れたら復旧手段はバックアップだけ**。
// それなのに、書き出すかどうかがユーザーの記憶頼みになっていた。
// ここで「いつ促すか」を1か所に決めて、画面はその結果を出すだけにする。

/** これだけ経ったら促す（日）。 */
export const REMIND_AFTER_DAYS = 30;

/** これだけ積み上がったら、初回でも促す。 */
export const REMIND_AFTER_ITEMS = 10;

const DAY = 24 * 60 * 60 * 1000;

/**
 * 書き出しを促すか。
 * @param {object} o
 * @param {number} o.lastExportAt 最後に書き出した時刻（0 ＝ 一度もしていない）
 * @param {number} o.items        失って困るものの数（知識＋案件）
 * @param {number} o.now
 * @returns {{ show: boolean, reason: string, days: number }}
 */
export function backupReminder({ lastExportAt = 0, items = 0, now = Date.now() } = {}) {
  const days = lastExportAt ? Math.floor((now - lastExportAt) / DAY) : Infinity;

  // 一度も書き出していない：ある程度たまってから促す。
  // 使い始めてすぐに出すと、まだ失うものが無いのに邪魔になるだけ。
  if (!lastExportAt) {
    return items >= REMIND_AFTER_ITEMS
      ? { show: true, reason: `${items}件たまっていますが、まだ一度も書き出していません`, days: 0 }
      : { show: false, reason: '', days: 0 };
  }

  if (days >= REMIND_AFTER_DAYS) {
    return { show: true, reason: `最後に書き出してから${days}日たちました`, days };
  }
  return { show: false, reason: '', days };
}
