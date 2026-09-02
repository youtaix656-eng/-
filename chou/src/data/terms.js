// 用語の本体データ。**目次専用の手書きの一覧は作らない**——目次（`toc.js`）はここと
// `scales.js`／`redFlags.js`／`fodmap.js` から毎回導く。
//
// 決めていること
//  1. **読み（reading）は手で書く。** 漢字の読みを機械が当てると必ず間違えるので、
//     入れ忘れは「その他」行に落として目に見えるようにする（推定しない）。
//  2. **説明の確からしさを必ず持つ**（`descriptionStatus`）。
//     `verified` はこのアプリ自身の作り（画面・保存の仕組み・記録の決まり）だけ。
//     体のこと・食材の分類のように**手元で確かめきれないもの**は必ず `needs_review` で、
//     画面に「※要確認」を出す。**`verified` へ上げてよいのは、人が明示的に確かめた時だけ。**
//  3. **別名（aliases）にも読みを持たせる**（別名から引けるようにするため）。
//  4. 飛び先（destinations）の type は4つだけ：page（画面）／question（記録の設問）／
//     function（機能）／system（仕組み・決まり）。

export const TERMS = [
  {
    id: 'term-ibs',
    title: 'IBS',
    reading: 'IBS',
    aliases: [
      { name: '過敏性腸症候群', reading: 'かびんせいちょうしょうこうぐん' },
      { name: '過敏性腸症', reading: 'かびんせいちょうしょう' },
    ],
    description:
      'お腹の痛みや不快感と、お通じの変化（回数・かたさ）が続く状態を指す呼び名です。検査で目に見える異常が見つからないことが多く、そのぶん本人の記録そのものが診察の材料になります。このアプリが記録を中心に作られているのはそのためです。',
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'redflags', targetId: 'flag-list', label: '受診の目安を読む' },
      { type: 'function', view: 'visitnote', targetId: 'note-out', label: '受診メモをつくる' },
    ],
  },
  {
    id: 'term-fodmap',
    title: 'FODMAP',
    reading: 'FODMAP',
    aliases: [
      { name: 'フォドマップ', reading: 'ふぉどまっぷ' },
      { name: '低FODMAP食', reading: 'ていふぉどまっぷしょく' },
    ],
    description:
      '小腸で吸収されにくく、大腸で発酵しやすいとされる糖の仲間をまとめた呼び名です。一度減らしてから一つずつ戻し、自分に合わないものを見つけるための考え方で、減らしたまま長く続ける食事ではありません。',
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'fodmap', targetId: 'fodmap-notes', label: '食材の一覧をひらく' },
      { type: 'system', view: 'fodmap', targetId: 'fodmap-source', label: '出典と最終確認日を見る' },
    ],
  },
  {
    id: 'term-bristol',
    title: 'ブリストルスケール',
    reading: 'ぶりすとるすけーる',
    aliases: [{ name: '便のかたさ', reading: 'べんのかたさ' }],
    description:
      '便のかたさを7段階の絵で選ぶ、医療の場で通じる共通の物差しです。このアプリが受診メモに数字のまま書くのはこのためで、平均は出しません（1と7が1回ずつあった日の「平均4」は、ふつうの便が1回あったという意味にならないからです）。',
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'question', view: 'home', targetId: 'rec-stool', label: 'きょうのお通じを記録する' },
      { type: 'page', view: 'look', targetId: 'look-stool', label: 'ふりかえりで分布を見る' },
    ],
  },
  {
    id: 'term-redflag',
    title: '受診の目安',
    reading: 'じゅしんのめやす',
    aliases: [{ name: 'レッドフラグ', reading: 'れっどふらぐ' }],
    description:
      '医療機関で相談したほうがよいこととして一般に挙げられる項目です。このアプリは当てはまった数を数えず、順位も色も付けません。いくつ当てはまったかで決まるものではなく、ひとつも当てはまらなくても、つらいときは受診してよいからです。',
    descriptionStatus: 'verified',
    destinations: [
      { type: 'page', view: 'redflags', targetId: 'flag-list', label: '一覧を読む' },
      { type: 'question', view: 'home', targetId: 'rec-stool', label: '気になった印を記録する' },
    ],
  },
  {
    id: 'term-visit-note',
    title: '受診メモ',
    reading: 'じゅしんめも',
    aliases: [{ name: '症状メモ', reading: 'しょうじょうめも' }],
    description:
      '記録から、そのまま読める文章を組み立てる機能です。解釈や病名は書かず、並べるのは本人が記録した事実と、その数え方だけ。アプリが誰かへ送ることはなく、渡す相手は本人が選びます。',
    descriptionStatus: 'verified',
    destinations: [
      { type: 'function', view: 'visitnote', targetId: 'note-out', label: 'いま作る' },
      { type: 'function', view: 'visitnote', targetId: 'note-parts', label: '入れるものを選ぶ' },
    ],
  },
  {
    id: 'term-belly-scale',
    title: 'お腹の調子（5つの段）',
    reading: 'おなかのちょうし',
    aliases: [{ name: '体調の段', reading: 'たいちょうのだん' }],
    description:
      'とても楽／楽／ふつう／つらい／とてもつらい の5つから選びます。点数にしていないのは、点にすると体調の悪い日が「自分の失点」に見えるからです。並べ替えには内部の順番を使いますが、画面に数字は出しません。',
    descriptionStatus: 'verified',
    destinations: [
      { type: 'question', view: 'home', targetId: 'rec-belly', label: 'きょうの調子を選ぶ' },
      { type: 'page', view: 'look', targetId: 'look-belly', label: 'ふりかえりで並びを見る' },
    ],
  },
  {
    id: 'term-recorded-day',
    title: '記録した日',
    reading: 'きろくしたひ',
    aliases: [{ name: '通算の記録日数', reading: 'つうさんのきろくにっすう' }],
    description:
      'お腹の段・お通じ・たべもの・ひとことのどれか1つでも入っていれば「記録した日」になります。連続日数は数えません——お腹の調子は自分で決められるものではないので、途切れた日が「怠けた日」に見える作りにしないためです。',
    descriptionStatus: 'verified',
    destinations: [
      { type: 'question', view: 'home', targetId: 'rec-total', label: 'これまでの記録を見る' },
      { type: 'system', view: 'settings', targetId: 'set-storage', label: '保存されているものを見る' },
    ],
  },
  {
    id: 'term-no-average',
    title: '平均を出さない',
    reading: 'へいきんをださない',
    aliases: [{ name: '分布で見る', reading: 'ぶんぷでみる' }],
    description:
      'ブリストルもお腹の段も平均を出しません。1と7が1回ずつあった日の平均4は「ふつうの便が1回あった」ではないからです。出すのは分布（1〜2が何回、3〜5が何回、6〜7が何回）と、1日あたりの回数の幅だけです。',
    descriptionStatus: 'verified',
    destinations: [
      { type: 'page', view: 'look', targetId: 'look-stool', label: '分布を見る' },
      { type: 'function', view: 'visitnote', targetId: 'note-out', label: '受診メモでの書き方を見る' },
    ],
  },
  {
    id: 'term-correlation',
    title: '相関と原因',
    reading: 'そうかんとげんいん',
    aliases: [{ name: '食べたものとの関係', reading: 'たべたものとのかんけい' }],
    description:
      '食べたものとお腹の調子を同じ期間で並べますが、どちらかがどちらかの原因かは、その表からは分かりません。気になるものがあれば、しばらくやめて記録を続けると自分の答えのほうが出ます。矢印で結ばないのはそのためです。',
    descriptionStatus: 'verified',
    destinations: [{ type: 'page', view: 'look', targetId: 'look-foods', label: 'よく食べていたものを見る' }],
  },
  {
    id: 'term-local-only',
    title: '端末の中だけに保存',
    reading: 'たんまつのなかだけにほぞん',
    aliases: [{ name: '送信しない', reading: 'そうしんしない' }],
    description:
      '記録はこの端末の中だけに残り、どこにも送っていません。お通じと食事の記録は、健康の記録の中でもとりわけ人に見られたくないものだからです。端末を変えるときは、書き出したファイルを持ち運んでください。',
    descriptionStatus: 'verified',
    destinations: [
      { type: 'system', view: 'settings', targetId: 'set-storage', label: '保存されているものを見る' },
      { type: 'function', view: 'settings', targetId: 'set-io', label: '書き出す・取り込む' },
    ],
  },
  {
    id: 'term-toilet-map',
    title: 'トイレをさがす',
    reading: 'といれをさがす',
    aliases: [{ name: 'トイレマップ', reading: 'といれまっぷ' }],
    description:
      '端末の地図アプリを開くリンクを置いているだけで、このアプリは現在地を受け取りも保存もしません（地図アプリの側で現在地を使うことはあります）。自前で地図を持つと、いつ・どこで困ったかという最も漏らせない情報を抱えることになるためです。',
    descriptionStatus: 'verified',
    destinations: [{ type: 'page', view: 'know', targetId: 'know-menu', label: 'しらべるをひらく' }],
  },
  {
    id: 'term-undo',
    title: '消したものを戻す',
    reading: 'けしたものをもどす',
    aliases: [{ name: '元に戻す', reading: 'もとにもどす' }],
    description:
      '消した記録は20秒のあいだだけ戻せます。戻す用の控えは端末に保存しません（保存に混ぜると、消したはずのものが残ります）。',
    descriptionStatus: 'verified',
    destinations: [{ type: 'system', view: 'settings', targetId: 'set-storage', label: '保存の仕組みを見る' }],
  },
  {
    id: 'term-input-only',
    title: '保存するのは入力だけ',
    reading: 'ほぞんするのはにゅうりょくだけ',
    aliases: [{ name: '判定結果を保存しない', reading: 'はんていけっかをほぞんしない' }],
    description:
      '保存するのは選んだ段・押した印・書いた文字だけで、集計や判定の結果は保存しません。あとで計算のしかたを直しても、過去の記録をそのまま読み直せるようにするためです。',
    descriptionStatus: 'verified',
    destinations: [{ type: 'system', view: 'settings', targetId: 'set-storage', label: '保存されているものを見る' }],
  },
  {
    id: 'term-food-memo',
    title: 'たべものメモ',
    reading: 'たべものめも',
    aliases: [{ name: '食事記録', reading: 'しょくじきろく' }],
    description:
      '「、」やスペースで区切って書くと、あとで日数を数えられます。区切りはざっくり見ているだけなので、書き方によっては拾えないものがあります（拾えないことを黙って0件として出さないよう、画面にも書いています）。',
    descriptionStatus: 'verified',
    destinations: [
      { type: 'question', view: 'home', targetId: 'rec-meal', label: 'きょうのたべものを書く' },
      { type: 'page', view: 'look', targetId: 'look-foods', label: 'よく食べていたものを見る' },
    ],
  },
  {
    id: 'term-gut-character',
    title: '腸のキャラクター',
    reading: 'ちょうのきゃらくたー',
    aliases: [{ name: 'キャラクターの表情', reading: 'きゃらくたーのひょうじょう' }],
    description:
      '記録に応じて表情が変わりますが、責める顔・怒る顔・泣く顔は持っていません。調子が悪い日にキャラクターまで悲しむと、記録そのものが気まずくなるからです。記録しなかった日も責めず、眠って待っています。',
    descriptionStatus: 'verified',
    destinations: [{ type: 'page', view: 'home', targetId: 'gut-character', label: 'きょうの画面で見る' }],
  },
  {
    id: 'term-mark-urgent',
    title: '間に合わない感じ',
    reading: 'まにあわないかんじ',
    aliases: [{ name: '便意切迫', reading: 'べんいせっぱく' }],
    description:
      'お通じ1回ごとに付ける印のひとつです。事実だけを残すもので、意味づけや判定はしません。受診メモには「付いた日数」として出ます。',
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'question', view: 'home', targetId: 'rec-stool', label: '印を付ける' },
      { type: 'page', view: 'look', targetId: 'look-marks', label: '付いた日数を見る' },
    ],
  },
  {
    id: 'term-mark-blood',
    title: '血が混じった',
    reading: 'ちがまじった',
    aliases: [{ name: '血便', reading: 'けつべん' }],
    description:
      'お通じの印のうち、受診の目安にも載っている項目です。印が付いても判定はせず、読める場所（受診の目安）を出すだけにしています。鮮やかな赤でも、便に付く程度でも相談の材料になります。',
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'question', view: 'home', targetId: 'rec-stool', label: '印を付ける' },
      { type: 'page', view: 'redflags', targetId: 'flag-blood', label: '受診の目安で読む' },
    ],
  },
  {
    id: 'term-backup',
    title: '書き出し・取り込み',
    reading: 'かきだしとりこみ',
    aliases: [{ name: 'バックアップ', reading: 'ばっくあっぷ' }],
    description:
      '記録そのものが入ったファイルを書き出せます。取り込むときは今ある記録を消さず、同じ日はあとから直したほうを残します。書き出したファイルには記録が入っているので、置き場所に気をつけてください。',
    descriptionStatus: 'verified',
    destinations: [{ type: 'function', view: 'settings', targetId: 'set-io', label: '書き出す・取り込む' }],
  },
  {
    id: 'term-calendar',
    title: 'カレンダーの濃さ',
    reading: 'かれんだーのこさ',
    aliases: [{ name: '月表示', reading: 'つきひょうじ' }],
    description:
      '日付の下の帯の濃さがお腹の調子を表します。色は使いません（赤や黄を1つ入れると、それだけで「危ない状態の印」に見えてしまうからです）。記録が無い日は点線で、空欄を責める見せ方はしません。',
    descriptionStatus: 'verified',
    destinations: [{ type: 'page', view: 'calendar', targetId: 'cal-grid', label: 'カレンダーをひらく' }],
  },
  {
    id: 'term-toc-candidate',
    title: '目次の追加候補',
    reading: 'もくじのついかこうほ',
    aliases: [{ name: '候補一覧', reading: 'こうほいちらん' }],
    description:
      '会話や教材から拾った言葉を、目次へ入れる前に置いておく場所です。候補のあいだは本体のデータに一切書き込みません。「追加する」を押したときに初めて、読み・重複・分類・表記の4つを確かめてから入ります。',
    descriptionStatus: 'verified',
    destinations: [
      { type: 'function', view: 'toc', targetId: 'toc-candidates', label: '候補一覧をひらく' },
      { type: 'system', view: 'toc', targetId: 'toc-history', label: '決めたことの履歴を見る' },
    ],
  },
  {
    id: 'term-mark-black',
    title: '黒っぽい便',
    reading: 'くろっぽいべん',
    aliases: [{ name: 'タール便', reading: 'たーるべん' }],
    description:
      'お通じの印のうち、受診の目安にも載っている項目です。鉄剤や一部の薬でも黒くなることがあるので、飲んでいるものも一緒に伝えます。',
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'question', view: 'home', targetId: 'rec-stool', label: '印を付ける' },
      { type: 'page', view: 'redflags', targetId: 'flag-black', label: '受診の目安で読む' },
    ],
  },
  {
    id: 'term-mark-incomplete',
    title: '出しきれない感じ',
    reading: 'だしきれないかんじ',
    aliases: [{ name: '残便感', reading: 'ざんべんかん' }],
    description:
      'お通じ1回ごとに付ける印のひとつです。事実だけを残すもので、意味づけや判定はしません。受診メモには「付いた日数」として出ます。',
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'question', view: 'home', targetId: 'rec-stool', label: '印を付ける' },
      { type: 'page', view: 'look', targetId: 'look-marks', label: '付いた日数を見る' },
    ],
  },
  {
    id: 'term-mark-pain',
    title: '出すときの痛み',
    reading: 'だすときのいたみ',
    aliases: [{ name: '排便時痛', reading: 'はいべんじつう' }],
    description:
      'お通じ1回ごとに付ける印のひとつです。判定はしませんが、続くときは受診メモに載せて医療者へ伝えられます。',
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'question', view: 'home', targetId: 'rec-stool', label: '印を付ける' },
      { type: 'function', view: 'visitnote', targetId: 'note-parts', label: '受診メモに入れる' },
    ],
  },
];

/** 目次に出す画面（飛び先の入口）。**画面を足したらここにも足す** */
export const SCREENS = [
  {
    id: 'screen-home',
    title: 'きょう（記録）',
    reading: 'きょうきろく',
    aliases: [{ name: 'ホーム', reading: 'ほーむ' }],
    description: 'その日のお腹の調子・お通じ・たべもの・ひとことを記録する画面です。ひとつ押せばその日は「記録した日」になります。',
    descriptionStatus: 'verified',
    destinations: [{ type: 'page', view: 'home', targetId: 'rec-belly', label: 'ひらく' }],
  },
  {
    id: 'screen-calendar',
    title: 'カレンダー',
    reading: 'かれんだー',
    aliases: [],
    description: '月ごとの記録を見て、過ぎた日にも書き足せる画面です。',
    descriptionStatus: 'verified',
    destinations: [{ type: 'page', view: 'calendar', targetId: 'cal-grid', label: 'ひらく' }],
  },
  {
    id: 'screen-look',
    title: 'ふりかえり',
    reading: 'ふりかえり',
    aliases: [],
    description: '2週間・1か月・3か月の並びを見る画面です。並べるだけで、原因と結果は結びません。',
    descriptionStatus: 'verified',
    destinations: [{ type: 'page', view: 'look', targetId: 'look-belly', label: 'ひらく' }],
  },
  {
    id: 'screen-know',
    title: 'しらべる',
    reading: 'しらべる',
    aliases: [],
    description: '受診の目安・低FODMAPの食材・トイレさがし・このアプリのこと への入口です。',
    descriptionStatus: 'verified',
    destinations: [{ type: 'page', view: 'know', targetId: 'know-menu', label: 'ひらく' }],
  },
  {
    id: 'screen-settings',
    title: 'このアプリのこと',
    reading: 'このあぷりのこと',
    aliases: [{ name: '設定', reading: 'せってい' }],
    description: '保存されているもの・書き出し・取り込み・見た目・すべて消す をまとめた画面です。',
    descriptionStatus: 'verified',
    destinations: [{ type: 'page', view: 'settings', targetId: 'set-storage', label: 'ひらく' }],
  },
];
