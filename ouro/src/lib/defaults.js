// 設定の初期値だけを置く小さなファイル。
//
// 新項目04：アプリの状態の初期値（EMPTY）が要るのは起動の一番はじめなので、
// ここだけは必ず即時に読まれる。**重いものを import しないこと。**
// 初期データの組み立て（seed.js）はここには置かない——初回起動でしか使わないのに
// 毎回読むことになるため。

export function makeSettings() {
  return {
    routerMode: 'auto', // 'auto' | 'manual'
    autoApproveCost: false, // コストのかかる実行を毎回確認するか
    maxTokens: 8000,
    usdJpy: 155, // 円換算の目安（設定で変えられる）
    splashSeen: false,
    theme: 'ouro',
  };
}
