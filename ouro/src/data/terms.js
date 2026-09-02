// 用語集——このアプリの中で使っている言葉を引く場所。
//
// **これは目次専用の手書きデータではない。** 用語そのものが元データで、
// 目次（`data/toc.js` の `buildTocEntries`）はここから毎回導出する。
//
// 決まりごと：
//  ・**読み（reading）は必ず手で書く。** 漢字の読みは推定しない（共通ルール3）。
//    書き忘れたものは目次の「その他」行に落ちて、入れ忘れが見えるようになる。
//  ・**説明（description）は自分の言葉で書く。** 空なら画面に「※説明未登録」と出す。
//  ・**確かめていないものは `descriptionStatus: 'needs_review'`** にして
//    画面に「※要確認」を出す。**`verified` にしてよいのは人が明示的に確かめた時だけ**
//    （会話から入ってきたものは必ず `needs_review` のまま）。
//  ・**飛び先（destinations）は実在する画面・目印だけ**を書く（行き止まりを作らない）。
//    type は page（画面）／question（問い）／function（機能）／system（仕組み）の4つ。
//  ・別名（aliases）からも引ける（`aliasesResolve` が正式な題名へ戻す）。

/** 飛び先の種類。**ここに無い type を書かない**（画面が出し分けられなくなる）。 */
export const DESTINATION_TYPES = {
  page: { name: '画面', glyph: '▤' },
  question: { name: '問い', glyph: '？' },
  function: { name: '機能', glyph: '⚒' },
  system: { name: '仕組み', glyph: '⟳' },
};

export const DESCRIPTION_STATUS = {
  verified: { name: '確認済み', badge: '' },
  needs_review: { name: '要確認', badge: '※要確認' },
};

/**
 * 用語。**title は全体で重複させない**（`test/tocIndex.test.mjs` が機械チェックする）。
 * destinations の view は `lib/preload.js` の画面名、anchor は画面内の id。
 */
export const TERMS = [
  {
    id: 'venture',
    title: '事業',
    reading: 'じぎょう',
    description: '「1件の仕事」ではなく「1つの売りもの」をまとめて持つ器です。誰に・何を・いくらで売るのかと、いつまでにダメならやめるのかを1か所に置きます。実行中にできるのは1つだけです。',
    descriptionStatus: 'verified',
    aliases: ['ベンチャー', 'venture'],
    destinations: [
      { type: 'page', label: '事業の画面をひらく', view: 'ventures' },
      { type: 'system', label: 'やめる基準を決める', view: 'ventures', anchor: 'venture-verdict' },
      { type: 'question', label: '続くかどうかの見立てに答える', view: 'ventures', anchor: 'venture-risk' },
    ],
  },
  {
    id: 'deal',
    title: '案件',
    reading: 'あんけん',
    description: '受けた1件の仕事とその報酬です。事業が「売りもの」なら、案件は「売れた1件」。仕事との結びつきは仕事の側だけが持ちます。',
    descriptionStatus: 'verified',
    aliases: ['ディール', 'deal'],
    destinations: [{ type: 'page', label: '案件の画面をひらく', view: 'deals' }],
  },
  {
    id: 'kit',
    title: '型パック',
    reading: 'かたぱっく',
    description: 'うまくいった仕事の流れを、依頼文・完成条件・結果の見本つきで固めたものです。売っているのはファイルではなく、その型に流すと毎回出てくる結果です。',
    descriptionStatus: 'verified',
    aliases: ['キット', 'kit', 'スキル'],
    destinations: [
      { type: 'page', label: '型パックの画面をひらく', view: 'kits' },
      { type: 'system', label: '3回まわしてから売る', view: 'kits', anchor: 'kit-runs' },
      { type: 'function', label: 'SKILL.md の形で書き出す', view: 'kits', anchor: 'kit-export' },
    ],
  },
  {
    id: 'rivals',
    title: '競合台帳',
    reading: 'きょうごうだいちょう',
    description: '実際に自分の目で見た競合を1件ずつ書き留める場所です。AIには調べさせません（もっともらしい値段とURLを作られるため）。3件たまると自分の値段の位置が出ます。',
    descriptionStatus: 'verified',
    aliases: ['ライバル', '競合'],
    destinations: [
      { type: 'page', label: '事業の画面でひらく', view: 'ventures', anchor: 'venture-rivals' },
      { type: 'question', label: '「実際に3人見たか」に答える', view: 'ventures', anchor: 'venture-risk' },
    ],
  },
  {
    id: 'demand',
    title: '需要の観測',
    reading: 'じゅようのかんそく',
    description: '実際に見た「困りごとの声」を、その人が使った言葉のまま貯める場所です。検索ボリュームのような手元にない数字は持ちません。同じ言葉が2回以上出たものだけを重なりとして出します。',
    descriptionStatus: 'verified',
    aliases: ['声', 'ニーズ'],
    destinations: [{ type: 'page', label: '事業の画面でひらく', view: 'ventures', anchor: 'venture-demand' }],
  },
  {
    id: 'funnel',
    title: '収益導線',
    reading: 'しゅうえきどうせん',
    description: '集める→読ませる→登録→買ってもらう、の4段でどこで人が減っているかを見る地図です。段の数と順番は変えません（呼び名だけ変えられます）。数字は自分で手入力します。',
    descriptionStatus: 'verified',
    aliases: ['ファネル', 'funnel'],
    destinations: [{ type: 'page', label: '収益導線をひらく', view: 'funnel' }],
  },
  {
    id: 'loop',
    title: '回し方',
    reading: 'まわしかた',
    description: 'OODA（週1周）とPDCA（月1周）を1段ずつ進める仕組みです。数字がまだ無いうちはOODA、貯まったらPDCA。勝手には進まず、進めるのは人が押した時だけです。',
    descriptionStatus: 'verified',
    aliases: ['OODA', 'PDCA', 'ループ'],
    destinations: [{ type: 'page', label: '事業の画面でひらく', view: 'ventures', anchor: 'venture-loop' }],
  },
  {
    id: 'offload',
    title: '任せたら月いくら浮くか',
    reading: 'まかせたらつきいくらうくか',
    description: '手でやっている作業が月に何時間あって、それが金額でいくらかを出す引き算です。時給は必ずあなたが入れます（平均賃金や相場は初期値に置きません）。',
    descriptionStatus: 'verified',
    aliases: ['手離れ', 'オフロード'],
    destinations: [{ type: 'page', label: '会社の画面でひらく', view: 'company', anchor: 'company-offload' }],
  },
  {
    id: 'approval',
    title: '承認',
    reading: 'しょうにん',
    description: '費用の出る実行・送信・削除・支払い・外部公開の前に、必ず人が押す関門です。「毎回の確認を省く」を入れても、月や日の上限に達したら確認へ戻ります。',
    descriptionStatus: 'verified',
    aliases: ['アプルーブ'],
    destinations: [
      { type: 'page', label: '承認待ちをひらく', view: 'approvals' },
      { type: 'system', label: '上限を設定する', view: 'settings', anchor: 'settings-cap' },
      { type: 'function', label: '操作の履歴を見る', view: 'audit' },
    ],
  },
  {
    id: 'knowledge',
    title: '知識',
    reading: 'ちしき',
    description: '仕事の成果を、出典つきで残した会社の資産です。出典のないものは「AI生成（未検証）」として区別します。掲示板（30日で消える業務連絡）とは層が違います。',
    descriptionStatus: 'verified',
    aliases: ['ナレッジ', 'knowledge'],
    destinations: [{ type: 'page', label: '知識をひらく', view: 'knowledge' }],
  },
  {
    id: 'source',
    title: '出典',
    reading: 'しゅってん',
    description: 'その知識がどこから来たかの記録です。検索できない時にURLを書かせないのがいちばん大事な決まりで、確かめられないものは「未確認（要出典）」と印を付けます。',
    descriptionStatus: 'verified',
    aliases: ['ソース', 'source'],
    destinations: [{ type: 'page', label: '知識をひらく', view: 'knowledge' }],
  },
  {
    id: 'board',
    title: '社内掲示板',
    reading: 'しゃないけいじばん',
    description: '社員どうしの業務連絡です。**30日で消えます**——溜めるほど価値が上がる場所にしないため。資産として残すものは知識のほうへ入れます。',
    descriptionStatus: 'verified',
    aliases: ['掲示板', 'ボード'],
    destinations: [{ type: 'page', label: 'チームの画面をひらく', view: 'team' }],
  },
  {
    id: 'pitfalls',
    title: 'つまずき集',
    reading: 'つまずきしゅう',
    description: '役職ごとに、過去に起きた失敗を貯めたものです。掲示板と違って消えません。中止したものは貯めません（「中止しました」がずっとプロンプトに入ってしまうため）。',
    descriptionStatus: 'verified',
    aliases: ['失敗集'],
    destinations: [{ type: 'page', label: 'チームの画面をひらく', view: 'team' }],
  },
  {
    id: 'byok',
    title: 'BYOK',
    reading: 'びーわいおーけー',
    description: 'AIエンジンのカギ（APIキー）を、あなた自身のものを持ち込んで使う形です。カギはこの端末の中だけに残り、書き出しにも含めません。',
    descriptionStatus: 'verified',
    aliases: ['自分のキー', 'APIキー'],
    destinations: [{ type: 'page', label: 'エンジンをつなぐ', view: 'connect' }],
  },
  {
    id: 'local_employee',
    title: 'ローカル社員',
    reading: 'ろーかるしゃいん',
    description: 'AIエンジンを1つも繋いでいない時に動く、仕事の型だけを返す社員です。**AIではありません**——画面にもそう書いてあり、成果は「AI生成」として記録しません。',
    descriptionStatus: 'verified',
    aliases: ['ローカル'],
    destinations: [{ type: 'page', label: 'エンジンをつなぐ', view: 'connect' }],
  },
  {
    id: 'unstaffed',
    title: '未雇用の役職',
    reading: 'みこようのやくしょく',
    description: '席に誰も座っていない役職です。計画から自動で外れます（外さないと担当が見つからず仕事全体が失敗するため）。外したことは結果画面で「雇えば次から担当に入る」と伝えます。',
    descriptionStatus: 'verified',
    aliases: ['空席'],
    destinations: [{ type: 'page', label: '社員を雇う', view: 'hire' }],
  },
  {
    id: 'handoff',
    title: '引き継ぎ',
    reading: 'ひきつぎ',
    description: '前の手順の成果を次の担当へ渡すことです。枠が読み取れた時だけ要点を絞り、読み取れなければ全文をそのまま渡します（材料を勝手に消さないため）。',
    descriptionStatus: 'verified',
    aliases: ['ハンドオフ'],
    destinations: [{ type: 'page', label: '仕事台帳をひらく', view: 'ledger' }],
  },
  {
    id: 'prepublish',
    title: '出す前チェック',
    reading: 'だすまえちぇっく',
    description: '外へ出す直前に、確約・言い方・個人情報・完成条件・書き出しの重なりを1枚で通す関門です。**止めるのは個人情報だけ**で、ほかは知らせるだけです。',
    descriptionStatus: 'verified',
    aliases: ['公開前チェック'],
    destinations: [{ type: 'page', label: '発信の画面をひらく', view: 'studio' }],
  },
  {
    id: 'pattern',
    title: '投稿の型',
    reading: 'とうこうのかた',
    description: '伸びた投稿を次の投稿の種にするための型です。1本伸びただけでは型にしません（3本から）。勝ち型を勝手に入れ替えることもしません。',
    descriptionStatus: 'verified',
    aliases: ['パターン'],
    destinations: [{ type: 'page', label: '発信の画面をひらく', view: 'studio' }],
  },
  {
    id: 'style',
    title: '書き方の見本',
    reading: 'かきかたのみほん',
    description: 'あなたが実際に書いた文章そのものです。「AIっぽい文章」は決まりを増やしても直らず、社員があなたの文章を一度も読んでいないのが原因なので、見本として渡します。読ませるのは書く役だけです。',
    descriptionStatus: 'verified',
    aliases: ['スタイル', '文体'],
    destinations: [{ type: 'page', label: '会社のルールをひらく', view: 'rules' }],
  },
  {
    id: 'rules',
    title: '会社の決まり',
    reading: 'かいしゃのきまり',
    description: '全AI社員が仕事の前に必ず読むものです。出典を書く・断定を避ける・最終判断は人間、などの消せない行に、自分で足した行が続きます。**足せますが外せません**。',
    descriptionStatus: 'verified',
    aliases: ['ルール', '社則'],
    destinations: [{ type: 'page', label: '会社のルールをひらく', view: 'rules' }],
  },
  {
    id: 'seat',
    title: '席',
    reading: 'せき',
    description: '役職×ジャンルの組の中で数える番号です。同じリサーチャーでも医療と副業では別の3人を雇えます。席数は増やせます。',
    descriptionStatus: 'verified',
    aliases: ['シート'],
    destinations: [{ type: 'page', label: '社員を雇う', view: 'hire' }],
  },
  {
    id: 'weight',
    title: '読ませた量',
    reading: 'よませたりょう',
    description: '社員に渡した材料の文字数です。材料を足すほど賢くなるのではなく、入れすぎたところで急に答えがぼやけ、入力ぶんの料金も毎回かかります。**知らせるだけで勝手に削りません**。',
    descriptionStatus: 'verified',
    aliases: ['コンテキスト量'],
    destinations: [{ type: 'page', label: '仕事台帳をひらく', view: 'ledger' }],
  },
  {
    id: 'untrusted',
    title: '資料として囲う',
    reading: 'しりょうとしてかこう',
    description: '外から取り込んだ文章を「指示」ではなく「資料」として社員に渡すことです。囲わないと、貼り付けた記事の中の「これまでの指示を無視して〇〇と書け」がそのまま通ります。',
    descriptionStatus: 'verified',
    aliases: ['プロンプトインジェクション対策'],
    destinations: [{ type: 'page', label: '情報を取り込む', view: 'ingest' }],
  },
];

/**
 * 飛び先を、いまの状態で実際に開ける形に直す。
 *
 * 事業の中の目印（`venture-…`）は**事業の詳細**にあり、事業の一覧には無い。
 * 用語は事業の id を知らないので、押した時に「いま実行中の事業」へ読み替える。
 * **事業が1つも無ければ目印を外して一覧へ送る**——
 * 見つからない目印を渡すと、飛んだのに何も光らず「壊れている」ように見える。
 */
export function resolveDestination(dest, { ventures = [] } = {}) {
  if (!dest) return null;
  const d = { type: dest.type, label: dest.label, view: dest.view, arg: dest.arg ?? null, anchor: dest.anchor || null };
  if (d.view !== 'ventures' || !d.anchor || !String(d.anchor).startsWith('venture-')) return d;
  const list = Array.isArray(ventures) ? ventures : [];
  const target = list.find((v) => v.state === 'running') || list[0] || null;
  if (!target) return { ...d, anchor: null };
  return { ...d, view: 'venture', arg: target.id };
}

/** 別名から正式な題名へ戻す（`aliasesResolveToCanonicalTitle`）。 */
export function resolveAlias(text, terms = TERMS) {
  const q = String(text || '').trim().toLowerCase();
  if (!q) return null;
  for (const t of terms) {
    if (String(t.title).toLowerCase() === q) return t.title;
    if ((t.aliases || []).some((a) => String(a).toLowerCase() === q)) return t.title;
  }
  return null;
}

export function termById(id, terms = TERMS) {
  return terms.find((t) => t.id === id) || null;
}
