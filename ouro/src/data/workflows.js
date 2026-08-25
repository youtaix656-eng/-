// 定型の仕事の流れ（Workflow）。依頼のたびに社員を選ばなくて済むようにする。
// steps は roleId の並び。dispatcher の自動判定より優先される。
//
// 新項目22：steps の要素に**配列**を書くと「同時に走らせてよい手順」になる。
//   ['researcher', ['analyzer', 'reviewer'], 'strategist']
// 入れ子を平らにして役職だけ見たい時は flatSteps() を使うこと
// （`wf.steps` をそのまま回すと配列が混ざる）。

export const WORKFLOWS = [
  {
    id: 'deep_research',
    name: '徹底調査',
    reading: 'てっていちょうさ',
    glyph: '⌕',
    desc: '集める →（整理する・確かめる を同時に）→ 使える形にする',
    // 新項目22：入れ子は「同時に走らせてよい手順」。
    // 整理と検証はどちらも「調べた結果」だけを見るので、互いの結果を待たなくてよい。
    steps: ['researcher', ['analyzer', 'reviewer'], 'strategist'],
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
    id: 'mkt_publish',
    name: 'マーケ：作って出す',
    reading: 'まーけつくってだす',
    glyph: '✎',
    desc: '企画・制作 → ガバナンス確認 → 配信（確認を飛ばさない）',
    steps: ['mkt_content', 'mkt_governance', 'mkt_ops'],
    example: '来週のSNS投稿を作って出したい',
  },
  {
    id: 'mkt_invest',
    name: 'マーケ：どこへ投じるか',
    reading: 'まーけどこへとうじるか',
    glyph: '⊿',
    desc: '数値の裏づけ → 企画 → ガバナンス確認',
    steps: ['mkt_forecast', 'mkt_content', 'mkt_governance'],
    example: '来月の広告予算をどこに配分すべきか',
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

/** steps の入れ子を平らにして、役職 id の並びだけを返す。 */
export function flatSteps(wf) {
  return (wf && Array.isArray(wf.steps) ? wf.steps : []).flatMap((x) => (Array.isArray(x) ? x : [x]));
}
