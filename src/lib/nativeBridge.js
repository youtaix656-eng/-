// Capacitorでネイティブ（Android）にラップした時だけ使う橋渡し。
//
// 「外部ランタイム依存なし」は変えない——このファイルは @capacitor/core を
// importしない（ビルド時の依存＝devDependenciesに追加しただけで、Webアプリの
// 実行時バンドルからは一切importしていない）。Capacitorのネイティブ実行環境は
// 実行時に `window.Capacitor` というグローバルを自動で用意するので、それが
// 無ければ（＝通常のブラウザ・PWAとして開いている圧倒的多数のユーザー）
// すべての関数が静かに何もしないだけで終わる。
//
// 音声学習×連結学習（src/lib/audioEngine.js）の再生中・画面ロック時・
// バックグラウンド時に、Androidのネイティブ側でフォアグラウンドサービスを
// 起動しておくことで、OSにプロセスを凍結・停止されにくくする（android/の
// BackgroundAudioService.kt／BackgroundAudioPlugin.kt）。曲や問題の内容は
// 一切ここへ渡さない——渡すのは通知に出す見出し（title/body）と再生中かどうか
// （playing）だけ。
//
// 【未検証】このファイルが呼び出すネイティブ側（android/）は、このセッションの
// 実行環境にAndroid SDKが無く、Gradleビルド・実機確認のいずれも行えていない
// （CLAUDE.md参照）。プレーンなWeb版（圧倒的多数のユーザー）の動作には
// 一切影響しない設計だが、Capacitorでビルドしたネイティブ版での実際の挙動は
// ユーザー自身のAndroid Studio環境での確認が必要。

function plugin() {
  try {
    if (typeof window === 'undefined') return null;
    const cap = window.Capacitor;
    if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return null;
    return cap.Plugins?.BackgroundAudio || null;
  } catch (e) {
    return null;
  }
}

export function isNativeApp() {
  return plugin() != null;
}

export function nativeAudioStart({ title, body } = {}) {
  const p = plugin();
  if (!p) return;
  try {
    p.start({ title: title || '鍼灸国試対策', body: body || '音声学習を再生中' });
  } catch (e) {
    /* noop */
  }
}

export function nativeAudioUpdate({ title, body, playing } = {}) {
  const p = plugin();
  if (!p) return;
  try {
    p.update({ title: title || '鍼灸国試対策', body: body || '', playing: playing !== false });
  } catch (e) {
    /* noop */
  }
}

export function nativeAudioStop() {
  const p = plugin();
  if (!p) return;
  try {
    p.stop();
  } catch (e) {
    /* noop */
  }
}

// 通知のボタン（前へ/再生・一時停止/次へ）が押された時にネイティブ側（Androidの
// BackgroundAudioPlugin.kt）から送られてくるイベントを受け取る。
// handler は ({action}) => void（actionは 'playPause' | 'next' | 'prev'）。
// 戻り値は購読解除関数（プラグインが無い＝通常のWeb版では何もしない関数を返す）。
export function onNativeAudioControl(handler) {
  const p = plugin();
  if (!p || typeof p.addListener !== 'function') return () => {};
  try {
    const handle = p.addListener('controlAction', (data) => {
      try {
        handler(data);
      } catch (e) {
        /* noop */
      }
    });
    return () => {
      try {
        handle.remove?.();
      } catch (e) {
        /* noop */
      }
    };
  } catch (e) {
    return () => {};
  }
}

// ── ファイルの書き出し（アプリ版だけ） ──────────────────────────────
// Android の WebView は <a download> でファイルを保存しない（押しても何も起きない）ので、
// アプリ版ではネイティブ側（android/ の BackupFilePlugin.kt）に代わりに書かせる。
function filePlugin() {
  try {
    if (typeof window === 'undefined') return null;
    const cap = window.Capacitor;
    if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return null;
    return cap.Plugins?.BackupFile || null;
  } catch (e) {
    return null;
  }
}

export function canNativeSaveFile() {
  return filePlugin() != null;
}

// 「ダウンロード」フォルダへ保存する。成功すれば { location, filename } を返し、失敗は例外。
export async function nativeSaveTextFile(content, filename, mime) {
  const p = filePlugin();
  if (!p) throw new Error('アプリ版ではありません');
  return p.save({ content: String(content), filename, mime: mime || 'application/json' });
}

// 共有シート（Googleドライブ・LINE・メール等）へ渡す。
export async function nativeShareTextFile(content, filename, mime) {
  const p = filePlugin();
  if (!p) throw new Error('アプリ版ではありません');
  return p.share({ content: String(content), filename, mime: mime || 'application/json' });
}

// ファイル選択画面を開き、選んだファイルの中身を文字で受け取る（復元用）。
// 戻り値は { content, name } か、やめた時は { canceled: true }。失敗は例外。
export function canNativePickFile() {
  const p = filePlugin();
  return !!(p && typeof p.pick === 'function');
}

export async function nativePickTextFile() {
  const p = filePlugin();
  if (!p || typeof p.pick !== 'function') throw new Error('アプリ版ではありません');
  return p.pick({});
}
