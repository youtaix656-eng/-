# Android（Capacitor）ラップ — 背景再生つきネイティブアプリ

このディレクトリは、鍼灸国試対策アプリ（Web版）を Capacitor でそのままラップした
Android Studio プロジェクトです。目的は主に1つ——**音声学習×連結学習の再生中、
画面ロック・バックグラウンドへ移っても再生が止まりにくくする**（フォアグラウンド
サービスでOSにプロセスを凍結・停止されにくくする）ことと、Google Play への配信を
可能にすることです。

**このセッション（クラウド実行環境）には Android SDK が無く、ここに書かれたコードは
一度もビルド・実機確認ができていません。** `dl.google.com`（Android SDKの唯一の
配布元）への接続がこの環境のプロキシ方針で遮断されているため、`sdkmanager`や
Gradleのビルド自体を実行できませんでした。以下の手順はすべて、**あなた自身の
Android Studio環境**で実行して確認してください。

## 構成

- `capacitor.config.json`（リポジトリ直下）：Capacitorの設定。`webDir: "dist"`
  （Vite の通常のビルド出力をそのまま使う）。
- `android/`：Capacitor が生成した標準の Android Studio プロジェクト
  （`npx cap add android` で作成）。
- `android/app/src/main/java/com/youtaix656/shinkyu/`：
  - `MainActivity.java` — 自作プラグインを登録するだけの最小限の変更。
  - `BackgroundAudioPlugin.kt` — JS（`src/lib/nativeBridge.js`）から呼ばれる
    ネイティブ橋渡し。曲や問題の内容は一切持たず、通知に出す見出し（title/body）・
    再生中かどうか（playing）だけを受け取る。
  - `BackgroundAudioService.kt` — フォアグラウンドサービス本体。通知の表示と
    ウェイクロックの保持だけを行う（実際の読み上げ＝音声合成はWebView側のJS
    （`speechSynthesis`やボイスクローンの`<audio>`要素）がそのまま行う。
    ここでは音声合成そのものをネイティブへ移していない）。

## 大事な前提（できること・できないこと）

- **できること（想定）**：フォアグラウンドサービスにより、アプリが画面ロック中・
  他アプリに切り替えている間もOSのプロセス凍結・停止の対象になりにくくなる。
  これにより、音声学習の読み上げ（WebViewのJSが行っているもの）が、画面OFFや
  バックグラウンド化だけでは止まりにくくなることを期待している。
- **できないこと**：タスク一覧からスワイプして完全にアプリを終了（プロセスを
  破棄）した場合は、どの方法でも再生を続けることはできない（Androidの
  OS仕様上の制約で、ネイティブアプリでも例外ではない）。
- **【要実機検証】** フォアグラウンドサービスが「OSにプロセスを凍結されない」こと
  を保証しても、Chromium（WebViewのレンダリングエンジン）自身がページの
  可視性に基づいてJavaScriptのタイマー処理を間引く（スロットリングする）仕様が
  別にあり、これがWebView上でも同様に働くかどうかは機種・Android/WebView
  バージョン依存で、このセッションでは確認できていません。実機で画面を
  ロックしたまま一定時間置き、読み上げの進行が実際に続くかを確認してください。
  **もし止まる・大きく遅延することが分かった場合**、次の一手は「読み上げの
  シーケンス進行そのものをネイティブ（Androidの`android.speech.tts.TextToSpeech`）
  へ移す」ことですが、今回のバッチでは着手していません（CLAUDE.mdの該当
  セクション参照）。

## ビルド手順（あなたのAndroid Studio環境で）

1. このリポジトリをクローンし、ルートで `npm install` を実行する。
2. `npm run build` でWebアプリをビルドする（`dist/`が作られる）。
3. `npx cap sync android` を実行する（`dist/`の内容を
   `android/app/src/main/assets/public/`へコピーし、プラグイン一覧を更新する。
   **これをしないと、古い/空のWeb内容のまま起動してしまう**）。
4. Android Studio で `android/` フォルダを開く（「Open an existing project」）。
5. Gradle Sync が自動で走る（初回はAndroid Studioが提案するAGP/Kotlinの
   バージョンに従って良い——`android/build.gradle`に書いたKotlinプラグインの
   バージョン（2.0.21）は「広く安定している組み合わせ」という推測であり、
   実際に動作確認はできていない）。
6. 実機またはエミュレータで実行する。

Webアプリの内容を更新した時は、毎回 **手順2〜3（`npm run build` →
`npx cap sync android`）をやり直す**必要があります（`android/app/src/main/assets/public/`
は `.gitignore` 済みの生成物で、リポジトリには含まれていません）。

## 署名・Google Play 提出について

このバッチでは署名設定（keystore・`signingConfigs`）は行っていません。
Google Play App Signing を使う場合、Android Studio の
「Build」→「Generate Signed App Bundle」から案内される手順に従ってください
（`.aab`形式が新規アプリでは必須）。Play Console でのアプリ登録・プライバシー
ポリシーURL・コンテンツレーティング・ストア掲載情報（アイコン512×512・
フィーチャーグラフィック1024×500・スクリーンショット2枚以上）は、
このリポジトリの外（Google Play Console）での作業です。
