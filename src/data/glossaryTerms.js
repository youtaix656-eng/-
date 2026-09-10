// 用語集（目次・索引）の本体データ。
//
// 「目次・索引パターン」の元データ（単一の正）。ここに書いた項目から
// data/toc.js の buildTocEntries() が毎回、あ〜ん索引・詳細パネルを導出する
// （目次専用の別データを手で複製しない）。
//
// 各項目のフィールド：
//   id                … 全体で一意なID
//   title             … 表示名
//   reading           … ひらがなの読み（必須。無いと索引で「その他」に落ちる＝意図した動作）
//   category          … GLOSSARY_CATEGORIES のいずれか
//   description       … 説明文（自分の言葉で。教科書の文章そのままにしない）
//   descriptionStatus … 'verified'（既存アプリのデータと突き合わせ済み）
//                        | 'needs_review'（会話由来の候補など未確認）
//   aliases           … 別名・略称の配列 [{ title, reading }]。別名からも索引で引ける
//   destinations      … 関連する飛び先の配列 [{ type, target, arg?, label }]
//                        type: 'page'（画面へ遷移するだけ）
//                             | 'function'（App.jsxの既存の中継関数を呼ぶ。argにキーワード等）
//                             | 'question'（特定の問題1問だけの演習を開始）
//                             | 'system'（この用語集内の別の項目へジャンプ）
//
// 出典：src/data/knowledgeBase.js（十二経・原穴等の既存データ）、
//       src/lib/yomi.js の TERM_READINGS（読みの既存データ）と矛盾しないことを確認済み。

export const GLOSSARY_CATEGORIES = [
  { id: 'keiraku', label: '経絡・経穴の基礎' },
  { id: 'zangfu', label: '陰陽五行・臓腑' },
  { id: 'anatomy', label: '解剖・生理の基礎' },
];

export const DESTINATION_TYPES = ['page', 'question', 'function', 'system'];

export const GLOSSARY_TERMS = [
  {
    id: 'gt-keiraku',
    title: '経絡',
    reading: 'けいらく',
    category: 'keiraku',
    description: '経脈（正経十二経脈・奇経八脈など）と絡脈（十五絡脈・孫絡）を合わせた、気血が全身をめぐる通路の総称。',
    descriptionStatus: 'verified',
    aliases: [],
    destinations: [
      { type: 'page', target: 'kgraph', label: '知識グラフで経絡のつながりを見る' },
      { type: 'function', target: 'openKeyword', arg: '経絡', label: '連結学習で深掘りする' },
    ],
  },
  {
    id: 'gt-keiketsu',
    title: '経穴',
    reading: 'けいけつ',
    category: 'keiraku',
    description: '経絡上にある、気血の出入りする部位（いわゆる「ツボ」）。全身に正経十二経＋任脈・督脈の経穴がある。',
    descriptionStatus: 'verified',
    aliases: [{ title: 'ツボ', reading: 'つぼ' }],
    destinations: [
      { type: 'page', target: 'flashcards', label: 'フラッシュカード（経穴カード）で覚える' },
      { type: 'page', target: 'keizetsuindex', label: '経絡経穴 索引・目次で調べる' },
    ],
  },
  {
    id: 'gt-genketsu',
    title: '原穴',
    reading: 'げんけつ',
    category: 'keiraku',
    description: '十二経それぞれに1つずつある要穴。原気（生命活動の原動力）が集まり、その経絡・臓腑の変調が現れやすい部位とされる（例：肺経＝太淵、大腸経＝合谷）。',
    descriptionStatus: 'verified',
    aliases: [],
    destinations: [
      { type: 'question', target: 'kk-keiraku-a1b', label: 'この用語に関連する問題を解く' },
      { type: 'page', target: 'flashcards', label: 'フラッシュカードで確認する' },
    ],
  },
  {
    id: 'gt-rakuketsu',
    title: '絡穴',
    reading: 'らくけつ',
    category: 'keiraku',
    description: '十二経＋任脈・督脈・脾の大絡にある要穴。表裏関係にある経絡どうしを連絡する絡脈が分かれ出る部位。',
    descriptionStatus: 'verified',
    aliases: [],
    destinations: [{ type: 'page', target: 'flashcards', label: 'フラッシュカードで確認する' }],
  },
  {
    id: 'gt-boketsu',
    title: '募穴',
    reading: 'ぼけつ',
    category: 'keiraku',
    description: '各臓腑の気が胸腹部に集まるとされる要穴。臓腑の変調が反応として現れやすい部位とされる。',
    descriptionStatus: 'verified',
    aliases: [],
    destinations: [{ type: 'page', target: 'flashcards', label: 'フラッシュカードで確認する' }],
  },
  {
    id: 'gt-yousetsu',
    title: '要穴',
    reading: 'ようけつ',
    category: 'keiraku',
    description: '原穴・絡穴・郄穴・募穴・背部兪穴・八会穴・八脈交会穴・五兪穴など、特別な働きを持つとされる経穴の総称。',
    descriptionStatus: 'verified',
    aliases: [],
    destinations: [
      { type: 'system', target: 'gt-genketsu', label: '原穴を見る' },
      { type: 'system', target: 'gt-rakuketsu', label: '絡穴を見る' },
      { type: 'system', target: 'gt-boketsu', label: '募穴を見る' },
      { type: 'system', target: 'gt-gekiketsu', label: '郄穴を見る' },
      { type: 'system', target: 'gt-hachieketsu', label: '八会穴を見る' },
      { type: 'system', target: 'gt-goyuketsu', label: '五兪穴を見る' },
    ],
  },
  {
    id: 'gt-shisouketsu',
    title: '四総穴',
    reading: 'しそうけつ',
    category: 'keiraku',
    description: '「肚腹は三里、腰背は委中、頭項は列缺、面口は合谷」の語呂で知られる、体幹部の主治範囲が広い4つの経穴（足三里・委中・列缺・合谷）。',
    descriptionStatus: 'verified',
    aliases: [],
    destinations: [{ type: 'page', target: 'flashcards', label: 'フラッシュカードで四総穴の表を見る' }],
  },
  {
    id: 'gt-inyou',
    title: '陰陽',
    reading: 'いんよう',
    category: 'zangfu',
    description: 'あらゆる事物・現象を相対する2つの側面（陰と陽）で捉える東洋医学の基本概念。表裏・寒熱・虚実などの弁証にも用いられる。',
    descriptionStatus: 'verified',
    aliases: [],
    destinations: [{ type: 'function', target: 'openKeyword', arg: '陰陽', label: '連結学習で深掘りする' }],
  },
  {
    id: 'gt-gogyou',
    title: '五行',
    reading: 'ごぎょう',
    category: 'zangfu',
    description: '木・火・土・金・水の5要素で自然界・人体の変化と関係性を説明する考え方。五臓や経絡の配当（相生・相剋）にも用いられる。',
    descriptionStatus: 'verified',
    aliases: [],
    destinations: [
      { type: 'function', target: 'openKeyword', arg: '五行', label: '連結学習で深掘りする' },
      { type: 'page', target: 'kgraph', label: '知識グラフで相生・相剋のつながりを見る' },
    ],
  },
  {
    id: 'gt-gozou',
    title: '五臓',
    reading: 'ごぞう',
    category: 'zangfu',
    description: '肝・心・脾・肺・腎の5つの臓。五行にそれぞれ配当され（肝＝木、心＝火、脾＝土、肺＝金、腎＝水）、対応する六腑・経絡を持つ。',
    descriptionStatus: 'verified',
    aliases: [],
    destinations: [{ type: 'function', target: 'openKeyword', arg: '五臓', label: '連結学習で深掘りする' }],
  },
  {
    id: 'gt-rokufu',
    title: '六腑',
    reading: 'ろっぷ',
    category: 'zangfu',
    description: '胆・小腸・胃・大腸・膀胱・三焦の6つの腑。それぞれ五臓と表裏関係にあり、対応する経絡を持つ（胆と肝、小腸と心、など）。',
    descriptionStatus: 'verified',
    aliases: [],
    destinations: [{ type: 'function', target: 'openKeyword', arg: '六腑', label: '連結学習で深掘りする' }],
  },
  {
    id: 'gt-keimyaku',
    title: '経脈',
    reading: 'けいみゃく',
    category: 'keiraku',
    description: '正経十二経脈・十二経別・奇経八脈からなる、経絡のうち幹となる通路。絡脈（十五絡脈・孫絡）とあわせて経絡を構成する。',
    descriptionStatus: 'verified',
    aliases: [],
    destinations: [{ type: 'question', target: 'kk-keiraku-a1', label: 'この用語に関連する問題を解く' }],
  },
  {
    id: 'gt-gekiketsu',
    title: '郄穴',
    reading: 'げきけつ',
    category: 'keiraku',
    description: '十二経＋陰陽の四維脈（陰蹻脈・陽蹻脈・陰維脈・陽維脈）にある要穴。経気が深く集まる部位とされ、急性症状の治療に用いられるとされる。',
    descriptionStatus: 'verified',
    aliases: [],
    destinations: [{ type: 'system', target: 'gt-yousetsu', label: '要穴の一覧を見る' }],
  },
  {
    id: 'gt-hachieketsu',
    title: '八会穴',
    reading: 'はちえけつ',
    category: 'keiraku',
    description: '臓・腑・気・血・筋・脈・骨・髄という8つの働きが集まるとされる8つの要穴（例：臓会＝章門、腑会＝中脘）。',
    descriptionStatus: 'verified',
    aliases: [],
    destinations: [{ type: 'system', target: 'gt-yousetsu', label: '要穴の一覧を見る' }],
  },
  {
    id: 'gt-goyuketsu',
    title: '五兪穴',
    reading: 'ごゆけつ',
    category: 'keiraku',
    description: '四肢の肘・膝から先にある井・滎・兪・経・合の5つの要穴。経気の流れを水の流れにたとえて位置づけたもの。',
    descriptionStatus: 'verified',
    aliases: [],
    destinations: [{ type: 'system', target: 'gt-yousetsu', label: '要穴の一覧を見る' }],
  },
  {
    id: 'gt-kikeihachimyaku',
    title: '奇経八脈',
    reading: 'きけいはちみゃく',
    category: 'keiraku',
    description: '正経十二経脈以外の8つの経脈（任脈・督脈・衝脈・帯脈・陰蹻脈・陽蹻脈・陰維脈・陽維脈）の総称。正経の気血を調整する働きを持つとされる。',
    descriptionStatus: 'verified',
    aliases: [],
    destinations: [{ type: 'system', target: 'gt-keimyaku', label: '経脈を見る' }],
  },
  {
    id: 'gt-hyouri',
    title: '表裏',
    reading: 'ひょうり',
    category: 'zangfu',
    description: '八綱弁証の一組で、病位の深さを表す概念。表＝体表に近い浅い病位、裏＝体内の深い病位を指す。',
    descriptionStatus: 'verified',
    aliases: [],
    destinations: [{ type: 'function', target: 'openKeyword', arg: '表裏', label: '連結学習で深掘りする' }],
  },
  {
    id: 'gt-kyojitsu',
    title: '虚実',
    reading: 'きょじつ',
    category: 'zangfu',
    description: '八綱弁証の一組で、病の勢いを表す概念。虚＝正気（生体の抵抗力）の不足、実＝邪気（病因）が盛んな状態を指す。',
    descriptionStatus: 'verified',
    aliases: [],
    destinations: [{ type: 'function', target: 'openKeyword', arg: '虚実', label: '連結学習で深掘りする' }],
  },
  {
    id: 'gt-jiritsushinkei',
    title: '自律神経',
    reading: 'じりつしんけい',
    category: 'anatomy',
    description: '交感神経と副交感神経からなり、内臓・血管・腺などの働きを意志とは無関係に調節する神経系。鍼灸の効果機序の説明にも関わる。',
    descriptionStatus: 'verified',
    aliases: [],
    destinations: [],
  },
];

// 本体データ（GLOSSARY_TERMS）＋候補フローで承認された実行時追加分（extra）を合わせ、
// 削除が承認された項目（removedIds）を除いた「今アプリが使う用語集」。
// glossaryTerms.js自体（本体データの配列）は静的ファイルで実行時に書き換えられないため、
// 承認された追加・削除は必ずこの合成を通す（tocCandidates.js・data/toc.jsが共用する）。
export function effectiveGlossary(extra = [], removedIds = []) {
  const removed = new Set(removedIds);
  return [...GLOSSARY_TERMS, ...extra].filter((t) => !removed.has(t.id));
}
