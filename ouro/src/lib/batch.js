// まとめて作る（量産）と、成果物を1投稿ずつに切り分ける。
//
// 依頼文はここで組み立てる（**AIを呼ばない**）。実行そのものは、これまでどおり
// 依頼 → 提案 → 承認 → AI社員、の道を通る（費用の確認も上限もそのまま効く）。
//
// 決まりごと：
//  ・**型は「資料」として囲って渡す**（lib/untrusted.js）。まねるのは組み立て方で、
//    型の本文に書かれている指示に従わせない。
//  ・**本数を無制限にしない。** 1回で作りすぎると、確かめないまま出すことになる。
//  ・**効果を保証する言い方を作らせない。** 出したあと出す前チェックも通す。

import { wrapUntrusted } from './untrusted.js';
import { parseSections } from './outline.js';

/** 1回で作る本数。20本ずつ出して数字を見る、が動きやすい。 */
export const BATCH_SIZES = [5, 10, 20];
export const DEFAULT_BATCH = 20;
export const MAX_BATCH = 30;

/** 投稿先ごとの文字数の目安（超えたら画面で知らせるだけ）。 */
export const CHANNEL_LIMITS = {
  x: 280,
  threads: 500,
  instagram: 2200,
  tiktok: 2200,
  note: 0, // 上限なし
  mail: 0,
  youtube: 5000,
  other: 0,
};

export function limitOf(channel) {
  const n = CHANNEL_LIMITS[channel];
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * 量産の依頼文を組み立てる。
 *
 * @param {object} o
 * @param {object} o.venture 事業（誰に・何を・いくらで）
 * @param {object[]} o.patterns 種にする型（1〜4本）
 * @param {number} o.count 作る本数
 * @param {string} o.channel 出す先
 * @param {string} o.extra 追加の指定（自由記述）
 */
export function batchRequest({ venture = null, patterns = [], count = DEFAULT_BATCH, channel = 'x', extra = '' } = {}) {
  const n = Math.max(1, Math.min(MAX_BATCH, Math.round(Number(count) || DEFAULT_BATCH)));
  const limit = limitOf(channel);
  const per = patterns.length ? Math.max(1, Math.round(n / patterns.length)) : n;

  const lines = [
    `${channelLabel(channel)}へ出す投稿を${n}本、まとめて作ってください。`,
    '',
    '## 誰に・何を',
  ];
  if (venture) {
    if (venture.who) lines.push(`- 読む人：${venture.who}`);
    if (venture.what) lines.push(`- 売っているもの：${venture.what}`);
    if (venture.priceJpy) lines.push(`- 値段：${venture.priceJpy.toLocaleString('ja-JP')}円`);
    if (venture.hypothesis) lines.push(`- いま確かめたいこと：${venture.hypothesis}`);
  } else {
    lines.push('- （事業がまだ決まっていません。一般向けとして書いてください）');
  }

  if (patterns.length) {
    lines.push(
      '',
      '## まねる型',
      `次の${patterns.length}本は、**実際に反応があった投稿**です。`,
      `**組み立て方（書き出し・話の運び・締め）をまねて**、それぞれ${per}本ずつ作ってください。`,
      '中身をそのまま言い換えただけの投稿は作らないでください。',
      ''
    );
    patterns.forEach((p, i) => {
      lines.push(wrapUntrusted(p.text, { label: `型${i + 1}${p.label ? `：${p.label}` : ''}`, origin: 'external' }));
      lines.push('');
    });
  } else {
    lines.push('', '## 型', 'まだ型がありません。切り口を変えて散らして作ってください。');
  }

  lines.push(
    '## 書き方の決まり',
    `- 1本ずつ「### 投稿1」「### 投稿2」…の見出しを付け、その下に本文だけを書く（そのまま貼れる形に）。`,
    limit ? `- 1本は${limit}字以内。` : '- 1本は読み切れる長さに。',
    '- **効果・結果を保証しない**（「必ず痩せる」「絶対に稼げる」等は書かない）。',
    '- 体験や数字を出すときは、**作り話をしない**。手元に無い数字は書かない。',
    '- 同じ書き出しを続けて使わない。1本ずつ入口を変える。',
    '- お客さんの氏名・連絡先は書かない。',
    '- 医療・健康の話は、診断ではないと分かる書き方にし、受診の目安を添える。'
  );
  if (extra.trim()) lines.push('', '## 追加の指定', extra.trim());
  return lines.join('\n');
}

function channelLabel(channel) {
  const names = { x: 'X（Threads も同じ形で使えます）', tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', note: 'note・ブログ', mail: 'メール・LINE', other: 'SNS' };
  return names[channel] || 'SNS';
}

/**
 * 成果物を1投稿ずつに切り分ける。
 *
 * **見出しが無くても諦めない**——AIは指定した形で返さないことがある。
 * 見出し → 番号つきの行 → 区切り線、の順に試し、どれも当たらなければ
 * **切らずに1本として返す**（勝手に切ると文の途中で割れる）。
 */
export function splitPosts(text = '') {
  let src = String(text || '').replace(/\r/g, '').trim();
  if (!src) return [];

  // **提出物の枠ごと切らない。** 成果は「①結論〜⑤TODO」の枠で返ってくるので、
  // そのまま切ると最後の投稿に「⑤担当と期限つきのTODO」がくっついてくる
  // （実際にそうなった）。④成果物の中だけを見る。
  const { sections } = parseSections(src);
  if (sections && sections.deliverable && sections.deliverable.trim().length > 20) {
    src = sections.deliverable.trim();
  }

  // ① 「### 投稿1」「## 投稿 1」「【投稿1】」
  const byHeading = splitBy(src, /^\s*(?:#{1,4}\s*)?[【\[]?投稿\s*[0-9０-９]+[】\]]?[：:.、]?\s*$/gm);
  if (byHeading.length >= 2) return numbered(byHeading);

  // ② 「① …」「1. …」で始まる行（同じ行に本文が続く形）
  const byNumber = splitAtLines(src, /^\s*(?:[①-⑳]|[0-9０-９]{1,2}[.．)）、])\s*\S/);
  if (byNumber.length >= 2) return numbered(byNumber);

  // ③ 区切り線
  const byRule = src.split(/^\s*(?:-{3,}|—{3,}|={3,})\s*$/gm).map((s) => s.trim()).filter(Boolean);
  if (byRule.length >= 2) return numbered(byRule);

  return numbered([src]);
}

/** 見出し行そのものは落として、その下の本文を集める。 */
function splitBy(src, re) {
  const lines = src.split('\n');
  const out = [];
  let cur = null;
  for (const line of lines) {
    re.lastIndex = 0;
    if (re.test(line)) {
      if (cur !== null) out.push(cur.join('\n').trim());
      cur = [];
      continue;
    }
    if (cur !== null) cur.push(line);
  }
  if (cur !== null) out.push(cur.join('\n').trim());
  return out.filter(Boolean);
}

/** 番号つきの行で切る（その行も本文に残す）。 */
function splitAtLines(src, re) {
  const lines = src.split('\n');
  const out = [];
  let cur = [];
  for (const line of lines) {
    if (re.test(line) && cur.length) {
      out.push(cur.join('\n').trim());
      cur = [line];
    } else {
      cur.push(line);
    }
  }
  if (cur.length) out.push(cur.join('\n').trim());
  return out.filter(Boolean).filter((t) => t.length > 4);
}

function numbered(items) {
  return items.map((text, i) => ({
    n: i + 1,
    // 先頭に残った番号（「① 」「1. 」）は貼るときに邪魔なので落とす
    text: text.replace(/^\s*(?:[①-⑳]|[0-9０-９]{1,2}[.．)）、])\s*/, '').trim(),
    chars: text.length,
  })).filter((x) => x.text);
}

/** 長すぎる投稿を知らせる（切らない。切ると意味が変わる）。 */
export function overLimit(items = [], channel = 'x') {
  const limit = limitOf(channel);
  if (!limit) return [];
  return items.filter((x) => x.text.length > limit).map((x) => ({ n: x.n, chars: x.text.length, limit }));
}
