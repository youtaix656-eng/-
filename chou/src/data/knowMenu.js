// 「しらべる」の一覧（2026-09-05）。
//
// **画面ではなくデータに持つ**——24件が見出しのない平らな一覧になっていて、
// 設定へ行くのに3画面ぶんスクロールする状態だった。まとまりで分け、さがせるようにする。
//
// 決めていること
//  - **1つの画面につき、入口はひとつ**（同じ行き先を2か所に置かない。Ouro 決まり㉕と同じ線）。
//    整腸剤のように「読み物でもあり道具でもある」ものは、**主にすることのほう**へ置き、
//    説明にもう片方があると書く。
//  - **読みを手で持つ**（`reading`）。漢字の読みを機械が当てない（README 決まり11）。
//    ひらがなでもさがせるようにするために要る。
//  - **画面に if を足さない**——`Know.jsx` はこの配列を読んで並べるだけ。
//    1件足せば一覧もさがす対象も自動で増える。
//  - まとまりの並びは**使う順**（受診 → 記録 → 読み物 → 設定）で、
//    件数の多い順にはしない。

/** まとまり。**この並びが画面の並び** */
export const KNOW_GROUPS = [
  {
    id: 'visit',
    label: '受診のために',
    reading: 'じゅしんのために',
    note: 'このアプリを持つ理由です。困ったときは、ここから読んでください。',
  },
  {
    id: 'tool',
    label: '記録の道具',
    reading: 'きろくのどうぐ',
    note: '毎日の記録に足せるもの。どれも印をつけるだけで、判定はしません。',
  },
  {
    id: 'read',
    label: '読み物',
    reading: 'よみもの',
    note: 'どれも「そう説明されている」までで止めています。読まなくても記録はできます。',
  },
  {
    id: 'app',
    label: 'このアプリのこと',
    reading: 'このあぷりのこと',
    note: '',
  },
];

/**
 * 一覧の1件。
 *  - `view` … 行き先の画面（`targetId` があればその場所まで運ぶ）
 *  - `link` … 外のリンクの名前。**URL はここに書かない**——`src/data` は
 *    「出典に URL を書かない」を機械チェックしているので、緩めずに画面側へ置く。
 *  - `keywords` … ふだんの言い方（任意）。題にも読みにも出てこないが、
 *    その画面をさがすときに実際に打つ語だけを置く（鏡の `SYNONYMS` と同じ考え方）。
 *    **新しい主張を作らない**——中にあるものの呼び名だけで、無い機能の名前は入れない。
 */
export const KNOW_ITEMS = [
  // ───────── 受診のために ─────────
  {
    id: 'redflags',
    group: 'visit',
    title: '受診の目安',
    reading: 'じゅしんのめやす',
    desc: '医療機関で相談したほうがよいこと。数えたり、色で決めたりはしません。',
    keywords: ['病院', 'びょういん', 'じゅしん', '血', 'ち'],
    view: 'redflags',
  },
  {
    id: 'visitnote',
    group: 'visit',
    title: '受診メモをつくる',
    reading: 'じゅしんめもをつくる',
    desc: '記録から、そのまま読める形に組み立てます。印刷・共有もここから。',
    keywords: ['病院', 'びょういん', 'めも', '印刷', 'いんさつ'],
    view: 'visitnote',
  },
  {
    id: 'visits',
    group: 'visit',
    title: '通院',
    reading: 'つういん',
    desc: '予定・聞きたいこと・言われたこと。通知は鳴らしません。',
    keywords: ['よやく', '病院', 'びょういん', 'ききたいこと'],
    view: 'visits',
  },

  // ───────── 記録の道具 ─────────
  {
    id: 'periods',
    group: 'tool',
    title: 'いつもと違う期間',
    reading: 'いつもとちがうきかん',
    desc: '旅行・薬が変わった・生理など。印をつけるだけで、判定も予測もしません。',
    keywords: ['りょこう', 'せいり', 'しゅっちょう', 'くすり'],
    view: 'periods',
  },
  {
    id: 'probiotics',
    group: 'tool',
    title: '整腸剤',
    reading: 'せいちょうざい',
    desc: '飲んでいるものを登録して、試している期間を見ます。菌・製品の読み物も同じ画面です。',
    keywords: ['きん', 'びおてぃくす', 'のんでいるもの'],
    view: 'probiotics',
  },

  // ───────── 読み物 ─────────
  {
    id: 'digest',
    group: 'read',
    title: 'まとめて見る',
    reading: 'まとめてみる',
    desc: '訂正・裏が取れていない主張・食い違い・扱わないこと・出典を、素材をまたいで横に並べます。',
    keywords: ['ていせい', 'しゅってん', 'くいちがい', 'おうだん'],
    view: 'digest',
  },
  {
    id: 'ibs',
    group: 'read',
    title: '過敏性腸症候群のこと',
    reading: 'かびんせいちょうしょうこうぐんのこと',
    desc: '検査で異常が出ないこと、分け方、出典が挙げる手当て。記録から型は当てません。',
    keywords: ['IBS', 'あいびーえす', 'かびんせい'],
    view: 'ibs',
  },
  {
    id: 'ibscare',
    group: 'read',
    title: '型ごとにできること',
    reading: 'かたごとにできること',
    desc: '下痢・便秘・混合・分類不能。型は自分で選ぶだけで、記録から当てません。',
    keywords: ['IBS', 'あいびーえす', 'げり', 'べんぴ', 'せるふけあ'],
    view: 'ibscare',
  },
  {
    id: 'diseases',
    group: 'read',
    title: 'お腹の病気の読み物',
    reading: 'おなかのびょうきのよみもの',
    desc: '名前が挙がることのある病気の説明。当てはめる仕掛けは作っていません。',
    keywords: ['びょうき', 'ずかん', 'だいちょう'],
    view: 'diseases',
  },
  {
    id: 'breathing',
    group: 'read',
    title: 'お腹の力を抜く',
    reading: 'おなかのちからをぬく',
    desc: 'お腹で息をする・なでる。やめどきを先に置いています。',
    keywords: ['こきゅう', 'まっさーじ', 'ふくしきこきゅう'],
    view: 'breathing',
  },
  {
    id: 'fodmap',
    group: 'read',
    title: '低FODMAP の食材',
    reading: 'ていふぉどまっぷのしょくざい',
    desc: '少なめ／量による／多め の一覧。自分のからだの結果を1件ずつ付けられます。',
    keywords: ['ふぉどまっぷ', 'しょくざい', 'FODMAP'],
    view: 'fodmap',
  },
  {
    id: 'eatingout',
    group: 'read',
    title: '外で食べるときの選び方',
    reading: 'そとでたべるときのえらびかた',
    desc: '買うときに表示のどこを見るか。お店や商品の名前は持ちません。',
    keywords: ['がいしょく', 'こんびに', 'べんとう'],
    view: 'eatingout',
  },
  {
    id: 'combine',
    group: 'read',
    title: '食べ合わせ（アダムスキー式）',
    reading: 'たべあわせあだむすきーしき',
    desc: '消化の速いものと遅いものを一緒に食べない、という考え方。低FODMAP と反対になる所も並べます。',
    view: 'combine',
  },
  {
    id: 'cleanup',
    group: 'read',
    title: '腸のお掃除（5つ）',
    reading: 'ちょうのおそうじ',
    desc: '食べ物・発酵食品・ストレス・姿勢・運動と睡眠。3つの考え方が食い違う所も並べます。',
    view: 'cleanup',
  },
  {
    id: 'prebiotics',
    group: 'read',
    title: '善玉菌の餌',
    reading: 'ぜんだまきんのえさ',
    desc: '水溶性食物繊維・オリゴ糖・レジスタントスターチ。低FODMAP と目的が反対を向く所も並べます。',
    view: 'prebiotics',
  },
  {
    id: 'butyrate',
    group: 'read',
    title: '酪酸菌と短鎖脂肪酸',
    reading: 'らくさんきんとたんさしぼうさん',
    desc: '出典が挙げるはたらきと、出典自身が取り下げた説（痩せ菌・デブ菌）を並べます。',
    view: 'butyrate',
  },
  {
    id: 'flora',
    group: 'read',
    title: '腸内フローラの言葉',
    reading: 'ちょうないふろーらのことば',
    desc: 'よく出てくる言葉の説明。あなたの菌がどうなっているかは分かりません。',
    keywords: ['ふろーら', 'ちょうないさいきん', 'ぜんだまきん'],
    view: 'flora',
  },
  {
    id: 'morning',
    group: 'read',
    title: '朝のリズムと排便',
    reading: 'あさのりずむとはいべん',
    desc: '出典が挙げる特徴とやってみること。出なくても責めない、が芯です。',
    view: 'morning',
  },
  {
    id: 'habits',
    group: 'read',
    title: '胃腸の習慣',
    reading: 'いちょうのしゅうかん',
    desc: '傷つけるとされる7つ・整えるとされる4つ。食物繊維の言い分が割れる所も並べます。',
    view: 'habits',
  },
  {
    id: 'protein',
    group: 'read',
    title: 'タンパク質と腸',
    reading: 'たんぱくしつとちょう',
    desc: '出典が挙げる目安と、ためしにやめてみる（小麦・乳製品）。グラム数は計算しません。',
    view: 'protein',
  },
  {
    id: 'scared',
    group: 'read',
    title: '名指しされた食べもの',
    reading: 'なざしされたたべもの',
    desc: '「猛毒」「食べるな」と言われるもの。このアプリは食べものに札を貼りません。',
    view: 'scared',
  },
  {
    id: 'fasting',
    group: 'read',
    title: '断食・空腹の時間',
    reading: 'だんじきくうふくのじかん',
    desc: 'このアプリは勧めていません。やめどきと、そのままにできない主張を先に並べます。',
    keywords: ['だんじき', 'くうふく', 'ふぁすてぃんぐ'],
    view: 'fasting',
  },
  {
    id: 'otc',
    group: 'read',
    title: '市販薬とのつきあい方',
    reading: 'しはんやくとのつきあいかた',
    desc: '下痢止め・胃薬・痛み止め。飲み合わせは判定しません。使った日は記録に残せます。',
    keywords: ['くすり', 'しはんやく', 'げりどめ'],
    view: 'otc',
  },
  {
    id: 'seasonings',
    group: 'read',
    title: '調味料の選び方',
    reading: 'ちょうみりょうのえらびかた',
    desc: 'さしすせそ＋みりん・甘酒の7つ。買うときに表示のどこを見るか。',
    keywords: ['ちょうみりょう', 'しお', 'しょうゆ', 'みそ'],
    view: 'seasonings',
  },

  // ───────── このアプリのこと ─────────
  {
    id: 'toilet',
    group: 'app',
    title: '近くのトイレをさがす',
    reading: 'ちかくのといれをさがす',
    desc:
      '地図アプリを開くだけです。このアプリは現在地を受け取りも保存もしません'
      + '（地図アプリの側で現在地を使うことがあります）。',
    link: 'toilet',
  },
  {
    id: 'settings',
    group: 'app',
    title: 'このアプリのこと・書き出し',
    reading: 'このあぷりのことかきだし',
    desc: '保存されているもの、バックアップ、消しかた。読みやすさの設定もここです。',
    keywords: ['せってい', 'ばっくあっぷ', 'かきだし', 'けす', 'もじのおおきさ'],
    view: 'settings',
  },
];

/** まとまりごとに分ける。**空のまとまりは出さない**（さがした結果で空になることがある） */
export function groupItems(items) {
  return KNOW_GROUPS.map((group) => ({
    ...group,
    items: (items || []).filter((item) => item.group === group.id),
  })).filter((group) => group.items.length > 0);
}

export const KNOW_NOTE =
  'お腹の症状の原因はいろいろで、同じ症状でも人によって違います。'
  + 'このアプリは、その見分けをするものではありません。'
  + 'できるのは、あとで思い出せない材料を残しておくことまでです。';
