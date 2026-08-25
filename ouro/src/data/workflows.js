// 定型の仕事の流れ（Workflow）。依頼のたびに社員を選ばなくて済むようにする。
// steps は roleId の並び。dispatcher の自動判定より優先される。

export const WORKFLOWS = [
  {
    id: 'deep_research',
    name: '徹底調査',
    reading: 'てっていちょうさ',
    glyph: '⌕',
    desc: '集める → 整理する → 確かめる → 使える形にする',
    steps: ['researcher', 'analyzer', 'reviewer', 'strategist'],
    example: '〇〇について、信頼できる情報だけをまとめて',
  },
  {
    id: 'make_content',
    name: 'コンテンツ制作',
    reading: 'こんてんつせいさく',
    glyph: '✦',
    desc: '調べる → 作る → 誤りを潰す',
    steps: ['researcher', 'creator', 'reviewer'],
    example: '〇〇についてのブログ記事を書いて',
  },
  {
    id: 'decide',
    name: '意思決定を助ける',
    reading: 'いしけっていをたすける',
    glyph: '△',
    desc: '整理する → 反対側から見る → 選択肢に落とす',
    steps: ['analyzer', 'reviewer', 'strategist'],
    example: '〇〇をやるべきか迷っている',
  },
  {
    id: 'learn',
    name: '学ぶ・身につける',
    reading: 'まなぶみにつける',
    glyph: '◎',
    desc: '調べる → 噛み砕く → 続く形にする',
    steps: ['researcher', 'analyzer', 'mentor'],
    example: '〇〇を1か月で使えるようになりたい',
  },
  {
    id: 'earn',
    name: 'お金にする道を探す',
    reading: 'おかねにするみちをさがす',
    glyph: '¥',
    desc: '相場を調べる → 自分の持ち物と突き合わせる → 今日の1手を出す',
    steps: ['researcher', 'analyzer', 'strategist'],
    example: '今の自分のスキルで来月までに収入を作る方法を探して',
  },
  {
    id: 'quick',
    name: 'ひとりで即答',
    reading: 'ひとりでそくとう',
    glyph: '•',
    desc: '1人だけに聞く（速い・安い）',
    steps: [],
    example: '短い質問',
  },
];

export function workflowById(id) {
  return WORKFLOWS.find((w) => w.id === id) || null;
}
