// ページ全体に影響する処理（Service Workerの更新反映など）が、今アプリ側で
// 何か重要な操作の最中かどうかを確認するための共有フラグ。
// main.jsx（Reactツリーの外）とPomodoro.jsx（Reactツリーの中）の間で、
// import一つだけで受け渡せる単純なモジュールスコープの値にしている
// （React Contextを新設するほどではない、ごく単純な一方向の問い合わせのため）。

let pomoRunning = false;
let audioPlaying = false;

export function setPomoRunning(v) {
  pomoRunning = !!v;
}

export function isPomoRunning() {
  return pomoRunning;
}

// 音声学習×連結学習が実際に読み上げ中かどうか（audioEngine.jsが更新）。
// Service Worker更新の反映保留判定（main.jsx）がポモドーロと同じ理由で参照する
// ——再生中にリロードすると、読み上げ・セッションの状態が断りなく消えてしまうため。
export function setAudioPlaying(v) {
  audioPlaying = !!v;
}

export function isAudioPlaying() {
  return audioPlaying;
}
