// 成果物の「形」を決める1か所（新規）。
//
// 社員ごとに答えの形が違うと、読む側（人間）が毎回長文を頭から読む羽目になる。
// そこで **会社としての提出物だけ**に5項目の枠をかける。
//
// **途中の手順には枠をかけない。** 1行で足りる調査結果に
// 「①結論②最優先…」が付くのは害でしかない。枠が要るのは最後の1手順だけ。
//
// 画面側はここの `parseSections()` で見出しを機械的に拾い、
// 結論と「判断が要ること」だけを先に出す（長い本文を読まないで済ませるため）。

export const OUTPUT_SECTIONS = [
  { key: 'conclusion', num: '①', title: '結論', hint: '最終的に何が分かったのか。3行以内。' },
  { key: 'priority', num: '②', title: '最優先事項', hint: '最初に手を付けるべきこと。1つだけ。' },
  {
    key: 'decision',
    num: '③',
    title: 'あなたの判断が要ること',
    hint: '承認・選択・外部への回答など、人間が決めること。無ければ「なし」と書く。',
  },
  { key: 'deliverable', num: '④', title: '成果物', hint: '本文・案・一覧・資料そのもの。' },
  { key: 'todo', num: '⑤', title: '担当と期限つきのTODO', hint: '誰が・いつまでに・何をするか。' },
];

export function sectionByKey(key) {
  return OUTPUT_SECTIONS.find((s) => s.key === key) || null;
}

/** 最後の手順にだけ渡す、出力の形の指示。 */
export function outputFormatPrompt() {
  return [
    '## 出力の形（この手順だけの決まり）',
    'あなたは会社としての提出物を書きます。次の5つの見出しを、この順で必ず使ってください。',
    ...OUTPUT_SECTIONS.map((s) => `### ${s.num}${s.title}\n${s.hint}`),
    '',
    '見出しの文字はそのまま使うこと（言い換えない）。',
    '③に書けることが無いときは「なし」とだけ書く。空欄にしない。',
    '④が本体なので、①②③⑤は短くまとめる。',
  ].join('\n');
}

// 見出しの言い方のゆれ。AIは指示どおりに書かないことがあるので、
// 近い言い方も拾う（拾えなかった時は「枠なし」として扱えばよく、壊れない）。
const TITLE_ALIASES = {
  conclusion: ['結論', 'まとめ', '要点'],
  priority: ['最優先事項', '最優先', '優先事項', '最初にやること'],
  decision: [
    'あなたの判断が要ること',
    '判断が要ること',
    '判断が必要な事項',
    '課長判断が必要な事項',
    '人間の判断が必要な事項',
    '要判断',
    'あなたの判断',
  ],
  deliverable: ['成果物', 'aiが作成した成果物', '作成した成果物', '本文', '納品物'],
  todo: ['担当と期限つきのtodo', '担当者・期限付きtodo', '期限つきのtodo', 'todo', '次の対応', 'やること'],
};

// 行頭・行末の飾り。「## ①結論：」のような書き方をぜんぶ剥がす。
const LEAD = /^[\s>#*_・\-–—]*[①-⑳0-9０-９]*[.．、)）:：\s]*[【「『<［[]?\s*/;
const TAIL = /\s*[】」』>］\]]?\s*[*_]*\s*$/;

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s　・:：]/g, '');
}

/**
 * 1行が見出しなら、その section の key と「同じ行に続いていた本文」を返す。
 * 見出しでなければ null。
 */
export function headingKey(line) {
  const raw = String(line || '');
  if (raw.length > 80) return null; // 長い行は本文
  let body = raw.replace(LEAD, '');
  let inline = '';
  const cut = body.search(/[:：]/);
  if (cut >= 0) {
    inline = body.slice(cut + 1).trim();
    body = body.slice(0, cut);
  }
  body = body.replace(TAIL, '');
  const norm = normalize(body);
  if (!norm || norm.length > 24) return null;
  for (const [key, names] of Object.entries(TITLE_ALIASES)) {
    if (names.some((n) => normalize(n) === norm)) return { key, inline };
  }
  return null;
}

/**
 * 本文を5項目に切り分ける。
 * 見出しが見つからなければ空の器を返す（＝枠なしの文章として扱えばよい）。
 * @returns {{sections:object, lead:string, found:string[]}}
 */
export function parseSections(text) {
  const lines = String(text || '').split('\n');
  const sections = {};
  const found = [];
  const lead = [];
  let cur = null;
  for (const line of lines) {
    const hit = headingKey(line);
    if (hit && !found.includes(hit.key)) {
      cur = hit.key;
      found.push(cur);
      sections[cur] = hit.inline ? [hit.inline] : [];
      continue;
    }
    if (cur) sections[cur].push(line);
    else lead.push(line);
  }
  const out = {};
  for (const k of found) out[k] = sections[k].join('\n').trim();
  return { sections: out, lead: lead.join('\n').trim(), found };
}

/** 枠に沿って書かれているか（2項目以上見つかったら、そうみなす）。 */
export function hasSections(text) {
  return parseSections(text).found.length >= 2;
}

/** 1行の要約。結論があればそこから、無ければ最初の中身のある行から。 */
export function summaryOf(text, limit = 120) {
  const { sections, lead } = parseSections(text);
  const src = sections.conclusion || lead || String(text || '');
  const line = src
    .split('\n')
    .map((l) => l.replace(LEAD, '').trim())
    .find((l) => l.length > 0);
  if (!line) return '';
  return line.length > limit ? `${line.slice(0, limit)}…` : line;
}
