// お客さんの情報を持たない（新規）。
//
// 施術の仕事では、これが最大のリスク。腰痛ナビで既に決めている
// 「表示名だけで管理し、氏名・連絡先を持たない」を Ouro にも通す。
//
// Ouro は端末内にしかデータを置かないが、**書き出し（バックアップ）や
// CSV は端末の外へ出る**。そこに他人の連絡先が入っていると、
// 落とした時に取り返しがつかない。
//
// 判定はAIを呼ばず、形（数字の並び・@・URL）だけで見る。**止めない**——
// 誤検知で書けなくなる方が困るので、気づけるようにするだけ。

export const PERSONAL_PATTERNS = [
  {
    // 携帯・固定・ハイフンあり／なし
    re: /(?:0\d{1,4}[-（(]?\d{1,4}[-）)]?\d{3,4}|0\d{9,10})/g,
    label: '電話番号らしい並び',
  },
  { re: /[\w.+-]+@[\w-]+\.[\w.-]+/g, label: 'メールアドレス' },
  // メールアドレスの一部を二重に拾わないよう、@ の前の1文字も一緒に取る。
  // **後読み（lookbehind）は使わない**——古い Safari では構文エラーになり、
  // その場でチャンク全体が読み込めなくなる。
  { re: /(?:(^|[^\w.+-])@[A-Za-z0-9_]{3,}|line\.me\/[^\s]+)/g, label: 'SNS・LINEのID', trimLead: true },
  {
    re: /(?:〒\s*\d{3}-?\d{4}|[都道府県][^\s、。]{0,10}[市区町村][^\s、。]{0,12}\d+[-−ー]\d+)/g,
    label: '住所らしい記述',
  },
  { re: /(?:生年月日|マイナンバー|保険証|カルテ番号)/g, label: '本人を特定する情報' },
];

/**
 * 本文に、お客さん個人を特定できるものが入っていないか。
 * @returns {{label:string, phrase:string}[]}
 */
const MAX_HITS = 8;

export function checkPersonal(text) {
  const src = String(text || '');
  const out = [];
  const seen = new Set();
  for (const p of PERSONAL_PATTERNS) {
    const re = new RegExp(p.re.source, 'g');
    let m = re.exec(src);
    while (m) {
      // 前の1文字を一緒に取る型は、その1文字を落とす
      const phrase = (p.trimLead ? m[0].replace(/^[^@]/, '') : m[0]).trim();
      if (phrase && !seen.has(phrase)) {
        seen.add(phrase);
        // **伏せた文字ではなく、元の文字で数える。** 伏せた形で数えると
        // 別々の番号が同じ形になり、画面で見分けられなくなる。
        out.push({ id: `${p.label}:${phrase}`, label: p.label, phrase: mask(phrase) });
      }
      if (m.index === re.lastIndex) re.lastIndex += 1;
      m = re.exec(src);
    }
  }
  // 分類ごとに打ち切らない（後ろの分類が調べられなくなるため）
  return out.slice(0, MAX_HITS);
}

/**
 * 画面に出すときは伏せる。
 * **見つけたものをそのまま画面に出したら、隠す意味がない。**
 */
export function mask(phrase) {
  const s = String(phrase || '');
  if (s.length <= 4) return '●'.repeat(s.length);
  return `${s.slice(0, 2)}${'●'.repeat(Math.max(2, s.length - 4))}${s.slice(-2)}`;
}

/** 案件のお客さん欄は「呼び名だけ」にする。 */
export const CLIENT_HINT = '呼び名だけにしてください（例：Aさん／〇〇整体院）。氏名・電話・住所は書かないでください。';

export function hasPersonal(text) {
  return checkPersonal(text).length > 0;
}
