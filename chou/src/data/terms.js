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
  {
    id: 'term-combine',
    title: '食べ合わせ（アダムスキー式）',
    reading: 'たべあわせ',
    aliases: [{ name: 'アダムスキー式', reading: 'あだむすきーしき' }],
    description:
      '消化の速いものと遅いものを一緒に食べない、という考え方です。出典は本人の要約で原著を確かめていないので、このアプリは「そう紹介されている」までしか書かず、詰まっている・毒素が出ているといった判定はしません。',
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'function', view: 'combine', targetId: 'combine-check', label: '組み合わせを見る' },
      { type: 'system', view: 'combine', targetId: 'combine-unverified', label: '裏が取れていない主張を読む' },
    ],
  },
  {
    id: 'term-speed-fast',
    title: '消化の速い食べもの',
    reading: 'しょうかのはやいたべもの',
    aliases: [{ name: '速いもの', reading: 'はやいもの' }],
    description:
      'くだもの・トマト・かぼちゃ・パプリカ・唐辛子・はちみつ・緑茶・ヨーグルトが挙げられています。出典では「消化管を30分ほどで通る」と紹介されていますが、この数字は確かめられていません。',
    descriptionStatus: 'needs_review',
    destinations: [{ type: 'page', view: 'combine', targetId: 'combine-speeds', label: '一覧で見る' }],
  },
  {
    id: 'term-speed-slow',
    title: '消化の遅い食べもの',
    reading: 'しょうかのおそいたべもの',
    aliases: [{ name: '遅いもの', reading: 'おそいもの' }],
    description:
      'パスタ・パン・米・ピザ・いも・とうもろこし・肉・魚・チーズ・卵・豆腐・ナッツなど、速いもの以外のほとんどです。同じ「遅い」どうしで食べるぶんには問題にならない、という考え方です。',
    descriptionStatus: 'needs_review',
    destinations: [{ type: 'page', view: 'combine', targetId: 'combine-speeds', label: '一覧で見る' }],
  },
  {
    id: 'term-speed-neutral',
    title: 'ニュートラルの食べもの',
    reading: 'にゅーとらるのたべもの',
    aliases: [{ name: '中間のもの', reading: 'ちゅうかんのもの' }],
    description:
      '油・酢・にんにく・たまねぎ・なす・紅茶・コーヒー・砂糖・牛乳など。出典では「一緒に食べたものの消化を助ける」とされています。ただし、たまねぎ・にんにく・牛乳は低FODMAP では減らす候補で、言っていることが反対になります。',
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'combine', targetId: 'combine-speeds', label: '一覧で見る' },
      { type: 'system', view: 'combine', targetId: 'combine-conflicts', label: '反対になるものを見る' },
    ],
  },
  {
    id: 'term-conflict',
    title: '2つの考え方が反対になるところ',
    reading: 'ふたつのかんがえかたがはんたいになるところ',
    aliases: [{ name: '食い違い', reading: 'くいちがい' }],
    description:
      'はちみつ・ヨーグルト・にんにく・たまねぎ・牛乳は、低FODMAP では「多め（減らす候補）」、アダムスキー式では「速い・消化を助ける」とされ、正面から反対になります。このアプリはどちらが正しいかを決めません。合うかどうかは自分の記録で見つけてください。',
    descriptionStatus: 'verified',
    destinations: [
      { type: 'system', view: 'combine', targetId: 'combine-conflicts', label: '並べて見る' },
      { type: 'page', view: 'fodmap', targetId: 'fodmap-notes', label: '低FODMAP の一覧を見る' },
    ],
  },
  {
    id: 'term-olive-oil',
    title: 'オリーブオイルをひと口',
    reading: 'おりーぶおいるをひとくち',
    aliases: [],
    description:
      '合わない組み合わせを食べてしまった時に、出典が勧めている一手です。効き目が確かめられている手当てではありません。胆のうの病気や脂質の制限がある人は、先に相談してください。',
    descriptionStatus: 'needs_review',
    destinations: [{ type: 'page', view: 'combine', targetId: 'combine-olive', label: '読む' }],
  },
  {
    id: 'term-meal-gap',
    title: '食事の間隔',
    reading: 'しょくじのかんかく',
    aliases: [{ name: '4時間空ける', reading: 'よじかんあける' }],
    description:
      '出典は「食事と食事の間を最低でも4時間」と勧めています。この数字は出典のもので、このアプリが確かめたものではありません。記録した時刻から間隔を並べますが、守れた回数は数えません。',
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'combine', targetId: 'combine-gap', label: '自分の間隔を見る' },
      { type: 'question', view: 'home', targetId: 'rec-meal', label: '食べた時刻を記録する' },
    ],
  },
  {
    id: 'term-light-morning',
    title: '朝を軽くする',
    reading: 'あさをかるくする',
    aliases: [],
    description:
      '出典は「朝は速いものだけにすると腸を休ませやすい」と勧めています。ただし朝食を軽くする・抜くことが向かない人もいます（血糖に関わる持病・妊娠中・成長期・摂食障害の経験など）。',
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'combine', targetId: 'combine-gap', label: '読む' },
      { type: 'system', view: 'combine', targetId: 'combine-precheck', label: 'はじめる前の確認' },
    ],
  },
  {
    id: 'term-stress',
    title: 'ストレスの記録',
    reading: 'すとれすのきろく',
    aliases: [],
    description:
      '出典が挙げる「消化管が働きにくくなる3つの原因」のひとつです。4つの段で記録できます。お腹の調子との間にどちらが原因かは、並べただけでは分かりません。',
    descriptionStatus: 'verified',
    destinations: [
      { type: 'question', view: 'home', targetId: 'rec-life', label: 'きょうの記録へ' },
      { type: 'page', view: 'look', targetId: 'look-life', label: 'ふりかえりで見る' },
    ],
  },
  {
    id: 'term-exercise',
    title: '体を動かした記録',
    reading: 'からだをうごかしたきろく',
    aliases: [{ name: '運動の記録', reading: 'うんどうのきろく' }],
    description:
      '出典は「運動が腸のマッサージになる」と紹介しています。時間や歩数は数えません——「何分やれば効く」という基準が手元に無いからです。残すのは自分の感じ方の段だけです。',
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'question', view: 'home', targetId: 'rec-life', label: 'きょうの記録へ' },
      { type: 'page', view: 'look', targetId: 'look-life', label: 'ふりかえりで見る' },
    ],
  },
  {
    id: 'term-partial-ok',
    title: 'できる範囲でよい',
    reading: 'できるはんいでよい',
    aliases: [],
    description:
      '出典自身が「100%守ることはできないので、できる範囲で試してほしい」と書いています。このアプリも守れた回数を数えません。調子のよい日は好きなものを食べて構いません。',
    descriptionStatus: 'verified',
    destinations: [{ type: 'page', view: 'combine', targetId: 'combine-check', label: '食べ合わせをひらく' }],
  },
  {
    id: 'term-probiotic',
    title: '整腸剤',
    reading: 'せいちょうざい',
    aliases: [{ name: 'プロバイオティクス', reading: 'ぷろばいおてぃくす' }],
    description:
      '腸内の菌のバランスを整えることを目的に飲むもの。市販の多くは「指定医薬部外品」で、食品ではありません（区分は製品によって違うので箱の表示を見てください）。このアプリは商品を勧めず、飲み合わせも調べません。',
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'function', view: 'probiotics', targetId: 'probiotic-mine', label: '飲んでいるものを登録する' },
      { type: 'system', view: 'probiotics', targetId: 'probiotic-unverified', label: '裏が取れていない主張を読む' },
    ],
  },
  {
    id: 'term-butyrate',
    title: '酪酸菌',
    reading: 'らくさんきん',
    aliases: [{ name: '宮入菌', reading: 'みやいりきん' }],
    description:
      '出典では、ぬか漬けなどに入っている菌で、日本人の腸に合うと紹介されています。作り出す酪酸は「短鎖脂肪酸」の仲間として注目されていますが、健康効果の中身は確かめきれていません。',
    descriptionStatus: 'needs_review',
    destinations: [{ type: 'page', view: 'probiotics', targetId: 'bacteria-miyairi', label: '菌の一覧で見る' }],
  },
  {
    id: 'term-spore',
    title: '芽胞（がほう）',
    reading: 'がほう',
    aliases: [],
    description:
      '菌を包む殻のようなもの。出典では「胃酸や熱、抗生物質に強く、生きたまま腸へ届きやすい」と紹介されています。※要確認',
    descriptionStatus: 'needs_review',
    destinations: [{ type: 'page', view: 'probiotics', targetId: 'bacteria-miyairi', label: '菌の一覧で見る' }],
  },
  {
    id: 'term-trial-month',
    title: 'まず1か月ためす',
    reading: 'まずいっかげつためす',
    aliases: [{ name: 'お試し期間', reading: 'おためしきかん' }],
    description:
      '出典は「同じものを1か月ほど続けて、変わらなければ別の菌が入ったものへ」と勧めています。このアプリは日数を並べるだけで、効いたかどうかは判定しません。連続日数も数えません。',
    descriptionStatus: 'needs_review',
    destinations: [{ type: 'function', view: 'probiotics', targetId: 'probiotic-mine', label: '試している期間を見る' }],
  },
  {
    id: 'term-sashisuseso',
    title: 'さしすせそ',
    reading: 'さしすせそ',
    aliases: [{ name: '基本の調味料', reading: 'きほんのちょうみりょう' }],
    description:
      '砂糖・塩・酢・醤油・味噌の5つ。出典はこれにみりんと甘酒を足した7つを挙げています。全部いっぺんに替えなくてよく、よく使うものから1つずつで十分です。',
    descriptionStatus: 'verified',
    destinations: [{ type: 'page', view: 'seasonings', targetId: 'seasoning-list', label: '7つの見分け方を見る' }],
  },
  {
    id: 'term-refined',
    title: '精製（していない）',
    reading: 'せいせい',
    aliases: [{ name: '未精製', reading: 'みせいせい' }],
    description:
      '砂糖と塩の選び方に出てくる言い方です。精製していないものはミネラルが残り、色が付いていて、味に幅があるとされます。砂糖は白いものより甘さが2〜3割ひかえめとされます。',
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'seasonings', targetId: 'seasoning-sugar', label: '砂糖の見分け方' },
      { type: 'page', view: 'seasonings', targetId: 'seasoning-salt', label: '塩の見分け方' },
    ],
  },
  {
    id: 'term-brew',
    title: '天然醸造・静置発酵',
    reading: 'てんねんじょうぞうせいちはっこう',
    aliases: [{ name: '木桶仕込み', reading: 'きおけじこみ' }],
    description:
      '時間をかけて発酵させる作り方のこと。出典は酢・醤油・味噌でこれを勧めています。蔵に住む菌によって味が変わるとされます。',
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'seasonings', targetId: 'seasoning-vinegar', label: '酢の見分け方' },
      { type: 'page', view: 'seasonings', targetId: 'seasoning-miso', label: '味噌の見分け方' },
    ],
  },
  {
    id: 'term-honmirin',
    title: '本みりん',
    reading: 'ほんみりん',
    aliases: [{ name: 'みりん風調味料', reading: 'みりんふうちょうみりょう' }],
    description:
      '「本みりん」はアルコールを含む酒類調味料で、「みりん風調味料」とは別のものです。品名の表示で見分けられます。アルコールを避けている人は注意してください。',
    descriptionStatus: 'needs_review',
    destinations: [{ type: 'page', view: 'seasonings', targetId: 'seasoning-mirin', label: 'みりんの見分け方' }],
  },
  {
    id: 'term-marudaizu',
    title: '丸大豆',
    reading: 'まるだいず',
    aliases: [{ name: '脱脂加工大豆', reading: 'だっしかこうだいず' }],
    description:
      '醤油の原材料の表示に出てくる言い方です。出典は丸大豆のものを勧めています。原材料が大豆・小麦・塩・水だけかどうかも、あわせて見るところです。',
    descriptionStatus: 'needs_review',
    destinations: [{ type: 'page', view: 'seasonings', targetId: 'seasoning-soy', label: '醤油の見分け方' }],
  },
  {
    id: 'term-gut-brain',
    title: '腸脳相関',
    reading: 'ちょうのうそうかん',
    aliases: [{ name: '脳と腸のつながり', reading: 'のうとちょうのつながり' }],
    description:
      '脳と腸が互いに影響しあうという考え方です。緊張するとお腹に来る、という形でよく知られています。ただし「腸を整えれば心も整う」と一方向に読まないでください——気分の落ち込みが続くときは医療機関へ。',
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'cleanup', targetId: 'cleanup-stress', label: 'ストレスの項を読む' },
      { type: 'question', view: 'home', targetId: 'rec-life', label: 'ストレスを記録する' },
    ],
  },
  {
    id: 'term-serotonin',
    title: 'セロトニン',
    reading: 'せろとにん',
    aliases: [{ name: '幸福ホルモン', reading: 'こうふくほるもん' }],
    description:
      '体の中のセロトニンの多くが腸にある、とよく言われます。ただし腸で作られたセロトニンは脳へ入れません（関門を通れないため）。「腸のセロトニンを増やす＝脳のセロトニンが増える」ではありません。うつの原因をセロトニン不足とする考え方も、近年強く見直されています。',
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'system', view: 'cleanup', targetId: 'ccorrection-serotonin_pool', label: '訂正を読む' },
      { type: 'system', view: 'cleanup', targetId: 'ccorrection-depression', label: 'うつとの関係を読む' },
    ],
  },
  {
    id: 'term-ros',
    title: '活性酸素',
    reading: 'かっせいさんそ',
    aliases: [],
    description:
      '細胞を傷つけるとされるものです。出典は「異常発生の90%が腸で起きる」と言っていますが、出どころをたどれていません。活性酸素は体のいろいろな場所で出ます。',
    descriptionStatus: 'needs_review',
    destinations: [{ type: 'system', view: 'cleanup', targetId: 'cunverified-ros90', label: '裏が取れていない主張として読む' }],
  },
  {
    id: 'term-fermented',
    title: '発酵食品',
    reading: 'はっこうしょくひん',
    aliases: [{ name: '生きた菌の食べもの', reading: 'いきたきんのたべもの' }],
    description:
      'ヨーグルト・甘酒・乳酸菌飲料・ぬか漬け・味噌・キムチ・納豆など。腸活では勧められますが、低FODMAP では「多め／量による」に入るものがあり、言うことが反対になります。このアプリはどちらが正しいかを決めません。',
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'system', view: 'cleanup', targetId: 'cleanup-ferment', label: '3つの考え方から見る' },
      { type: 'page', view: 'fodmap', targetId: 'fodmap-notes', label: '低FODMAP の一覧' },
    ],
  },
  {
    id: 'term-autonomic',
    title: '自律神経',
    reading: 'じりつしんけい',
    aliases: [],
    description:
      '腸の動きを調節している神経です。出典は「よく眠ると自律神経が整い、腸も整う」と説明しています。眠りの記録はこのアプリでも残せますが、時間は数えません。',
    descriptionStatus: 'needs_review',
    destinations: [{ type: 'question', view: 'home', targetId: 'rec-body', label: '眠れたかを記録する' }],
  },
  {
    id: 'term-sleep-record',
    title: '眠れたかの記録',
    reading: 'ねむれたかのきろく',
    aliases: [{ name: '睡眠の記録', reading: 'すいみんのきろく' }],
    description:
      '3つの段（よく眠れなかった／まあまあ／よく眠れた）で残します。時間は数えません——「何時間で足りる」という基準が手元に無いのと、時計の数字より本人の感じ方のほうが確かだからです。',
    descriptionStatus: 'verified',
    destinations: [
      { type: 'question', view: 'home', targetId: 'rec-body', label: 'きょうの記録へ' },
      { type: 'page', view: 'look', targetId: 'look-life', label: 'ふりかえりで見る' },
    ],
  },
  {
    id: 'term-posture-record',
    title: '姿勢の記録',
    reading: 'しせいのきろく',
    aliases: [],
    description:
      '3つの段（前かがみが多かった／気づいて伸ばした／だいたい保てた）で残します。採点しません——出典自身が「ずっと保てなくてよい。気づいたら伸ばす」と言っています。',
    descriptionStatus: 'verified',
    destinations: [
      { type: 'question', view: 'home', targetId: 'rec-body', label: 'きょうの記録へ' },
      { type: 'page', view: 'cleanup', targetId: 'cleanup-posture', label: '姿勢の項を読む' },
    ],
  },
  {
    id: 'term-prebiotic',
    title: 'プレバイオティクス',
    reading: 'ぷればいおてぃくす',
    aliases: [{ name: '善玉菌の餌', reading: 'ぜんだまきんのえさ' }],
    description:
      'もともと腸にいる菌の餌になるとされる食べもの（水溶性食物繊維・オリゴ糖・レジスタントスターチ）のことです。生きた菌そのものを入れる考え方（プロバイオティクス）とは別のものとして紹介されます。低FODMAP は同じ糖を減らす考え方なので、目的が反対を向いています。このアプリはどちらが正しいかを決めません。',
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'prebiotics', targetId: 'prebiotic-kinds', label: '善玉菌の餌をひらく' },
      { type: 'system', view: 'prebiotics', targetId: 'prebiotic-vs-fodmap', label: '低FODMAP との食い違いを読む' },
    ],
  },
  {
    id: 'term-probiotic-word',
    title: 'プロバイオティクス',
    reading: 'ぷろばいおてぃくす',
    aliases: [],
    description:
      '生きた菌そのものをとる考え方のことです。整腸剤やヨーグルトがこれにあたると紹介されます。餌を増やす考え方（プレバイオティクス）とは別のものです。なお「飲んだ菌が住み着くかどうか」は出典どうしで言うことが違います。',
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'probiotics', targetId: 'probiotic-mine', label: '整腸剤の画面をひらく' },
      { type: 'system', view: 'prebiotics', targetId: 'sconflict-settle', label: '住み着くのかの食い違いを読む' },
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
  {
    id: 'screen-combine',
    title: '食べ合わせ',
    reading: 'たべあわせがめん',
    aliases: [],
    description: '消化の速い・遅いで組み合わせを見る画面です。低FODMAP と反対になる所も並べます。',
    descriptionStatus: 'verified',
    destinations: [{ type: 'page', view: 'combine', targetId: 'combine-check', label: 'ひらく' }],
  },
  {
    id: 'screen-probiotics',
    title: '整腸剤の画面',
    reading: 'せいちょうざいのがめん',
    aliases: [],
    description: '飲んでいる整腸剤を登録し、試している期間を見る画面です。商品を勧めることはしません。',
    descriptionStatus: 'verified',
    destinations: [{ type: 'page', view: 'probiotics', targetId: 'probiotic-mine', label: 'ひらく' }],
  },
  {
    id: 'screen-seasonings',
    title: '調味料の画面',
    reading: 'ちょうみりょうのがめん',
    aliases: [],
    description: 'さしすせそ＋みりん・甘酒の見分け方と、いまの自分の棚おろしの画面です。',
    descriptionStatus: 'verified',
    destinations: [{ type: 'page', view: 'seasonings', targetId: 'seasoning-list', label: 'ひらく' }],
  },
  {
    id: 'screen-cleanup',
    title: '腸のお掃除の画面',
    reading: 'ちょうのおそうじのがめん',
    aliases: [],
    description: '出典が挙げる5つと、3つの考え方が食い違う所、訂正、裏が取れていない主張をまとめた画面です。',
    descriptionStatus: 'verified',
    destinations: [{ type: 'page', view: 'cleanup', targetId: 'cleanup-steps', label: 'ひらく' }],
  },
  {
    id: 'screen-prebiotics',
    title: '善玉菌の餌の画面',
    reading: 'ぜんだまきんのえさのがめん',
    aliases: [{ name: 'プレバイオティクスの画面', reading: 'ぷればいおてぃくすのがめん' }],
    description:
      '餌になるとされる食べものと、低FODMAP とぶつかる所、出典どうしが食い違う所、訂正、裏が取れていない主張をまとめた画面です。',
    descriptionStatus: 'verified',
    destinations: [{ type: 'page', view: 'prebiotics', targetId: 'prebiotic-kinds', label: 'ひらく' }],
  },
];
