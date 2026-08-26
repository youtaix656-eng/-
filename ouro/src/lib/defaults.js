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
    // 今月のAI費用の上限（USD）。0 で上限なし。
    // 「毎回の確認を省く」を入れても、この線を越えたら確認へ戻る。
    monthlyCapUsd: 5,
    // 最後にバックアップを書き出した時刻。0 は一度も書き出していない。
    lastExportAt: 0,
    // AI費用の積み上げ（USD）。
    // **操作履歴から数え直さないこと。** 履歴は起動時に新しい400件しか読まないので、
    // 数え直すと合計が実際より小さく出て、月の上限が効かなくなる。
    costTotalUsd: 0,
    costMonth: '', // 'YYYY-MM'
    costMonthUsd: 0,
    // 手順から手順への引き継ぎ方（lib/handoff.js）。
    //   compact … 次の担当に要るものだけ渡す（既定・トークンが減る）
    //   full    … これまでどおり前の担当の出力をまるごと渡す
    handoffMode: 'compact',
  };
}
