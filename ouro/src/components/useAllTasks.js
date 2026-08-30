// 「古い仕事も要る画面」で、残りを読み足すための小さなフック。
//
// 起動時は新しい120件だけ読んでいる（useStore.js の TASK_PAGE）。
// ホームはそれで足りるが、次の画面は**全部そろっていないと数字や表示が狂う**：
//   ・案件（かかったAI費用の合計）
//   ・カレンダー（過去の実績の印）
//   ・社員の詳細（その人が担当した仕事）
//   ・知識の詳細（元になった仕事）
//   ・仕事の詳細（古い仕事を直接開いた時）
// そういう画面の先頭でこれを呼ぶ。読み込みは1回だけで、2回目以降は何もしない。

import { useEffect } from 'react';

export function useAllTasks(store) {
  const partial = store.tasksPartial;
  const load = store.loadAllTasks;
  useEffect(() => {
    if (!partial || typeof load !== 'function') return;
    load().catch(() => {
      // 読めなくても画面は出す（手元にあるぶんだけで動く）
    });
  }, [partial, load]);
  // 全部そろっているか。件数を出す画面が「読み込み中」を出せるように返す。
  return !partial;
}
