// 「エンジンをいくつ繋いだか」だけを見る、いちばん軽い判定。
//
// **providers/index.js を読まずに数える。** あちらは4種のエンジンの実装
// （通信の受け口を含む）を連れてくるので、ホームで「未接続です」と出すためだけに
// 読むと、起動時に読む量が数KB増える。ここは設定と鍵の有無しか見ない。

/** 実際に使えるエンジンの id（local は数えない）。 */
export function connectedEngines(secrets = {}, settings = {}) {
  const out = Object.keys(secrets || {}).filter(
    (id) => id !== 'local' && String(secrets[id] || '').trim()
  );
  // ローカルAI（OpenAI互換）はキーではなく宛先で決まる
  if (settings && String(settings.compatBaseUrl || '').trim()) out.push('compat');
  return out;
}

export function hasEngine(secrets = {}, settings = {}) {
  return connectedEngines(secrets, settings).length > 0;
}
