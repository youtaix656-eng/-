// 成果の文章から、題名・要約・URL を取り出す小さな道具。
//
// **runtime.js から切り出してある。** runtime はAIエンジン一式を連れてくるので、
// 「文字を切るだけ」の処理まで起動時に読む束へ入ってしまう。
// ここは文字列しか触らない（ネットワークにも設定にも触れない）。

/**
 * 成果テキストから、知識にするタイトルと要約を取り出す。
 *
 * preferredTitle（＝ユーザー自身の依頼文から作ったタイトル）があれば必ずそれを使う。
 * 成果本文の先頭は `## リサーチャー・ルナ` のような担当者名の見出しなので、
 * それをタイトルにすると「リサーチャー・ルナ」という検索できない知識ができてしまう。
 */
export function distill(text = '', preferredTitle = '') {
  const clean = String(text).replace(/\r/g, '');
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);

  const heading = lines.find((l) => /^#{1,3}\s+/.test(l));
  const title =
    (preferredTitle && preferredTitle.slice(0, 60)) ||
    (heading ? heading.replace(/^#{1,3}\s+/, '').slice(0, 60) : '') ||
    '成果';

  // 一覧に出る1行の要約なので、**文になっていない行は拾わない**。
  // 注意書き（⚠・※）、見出し、箇条書き（記号・番号つきの両方）、
  // 表の行、引用、括弧だけの補足を外す。
  // ※ 番号つき（「1. 一次情報が…」）を外していなかったため、
  //   箇条書きの途中が知識カードの要約になっていた。
  const isNoise = (l) =>
    /^[⚠※]/.test(l) ||
    /^#{1,3}\s/.test(l) ||
    /^[-*・>＞|｜]/.test(l) ||
    /^[0-9０-９]+\s*[.．)）、]/.test(l) ||
    /^[（(]/.test(l) ||
    /^[　\s]*[（(]/.test(l);
  const firstBody = lines.find((l) => !isNoise(l) && l.length > 10);
  const summary = (firstBody || lines.find((l) => !isNoise(l)) || lines[0] || '').slice(0, 240);

  return { title, summary };
}

/** 出力に含まれる URL を出典候補として拾う。 */
export function extractUrls(text = '') {
  const found = String(text).match(/https?:\/\/[^\s)）」』】、,]+/g) || [];
  return [...new Set(found)].slice(0, 20);
}
