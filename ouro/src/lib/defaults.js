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
    // 1日の上限（USD）。0 で上限なし。**月だけだと気づくのが遅い。**
    dailyCapUsd: 0,
    costDay: '', // 'YYYY-MM-DD'
    costDayUsd: 0,
    // モデルの選び方の既定（'auto' | 'cheap' | 'best'）。依頼ごとに上書きできる。
    costMode: 'auto',
    // ローカルAI（OpenAI互換）の宛先とモデル名。空なら使わない。
    // **パソコンの Chrome / Firefox でのみ動く**（iPhone・iPad は不可）。
    compatBaseUrl: '',
    compatModel: '',
    // 音声メモ入力。**端末内保存方針の明示的な例外**なので既定はオフ。
    // ブラウザの音声認識は、音声を提供元のサーバへ送る場合がある。
    voiceInput: false,
    // 手順から手順への引き継ぎ方（lib/handoff.js）。
    //   compact … 次の担当に要るものだけ渡す（既定・トークンが減る）
    //   full    … これまでどおり前の担当の出力をまるごと渡す
    handoffMode: 'compact',
    // 最初の道しるべ（lib/onboarding.js）。棚卸しだけは状態から導けないので印を持つ。
    didInventory: false,
    // 共有が書かれていない仕事を「完了」にしない（lib/ledger.js の needsShare）。
    // 切ると、掲示板が空のままでも完了になる。
    requireShare: true,
    starterHidden: false,
    // ── 裏で動かす・知らせる（既定の考え方）──
    // **閉じたら止まるのは Web の仕組み上どうにもならない。**
    // その代わり「次に開いた時に続きから走る」を既定で入れておく。
    autoResume: true,
    // 最後にアプリを見ていた時刻。これより後に終わったものを「知らせ」に出す。
    lastSeenAt: 0,
    // 端末の通知（裏に回っている間に終わった時だけ出す）。許可が要るので既定オフ。
    notifyDone: false,
    // 走っている間、画面を眠らせない。電池を食うので既定オフ。
    keepAwake: false,
  };
}
