// アダムスキー式の「食べ合わせ」。
//
// 出典は**本人の要約（動画の書き起こし）で、一次資料（原著）を確かめていない**ので、
// このアプリでは次の線を必ず守る（変革ノートの『できる男は超小食』・モンクモードと同じ扱い）。
//
//  1. **効果を断定しない。** 書くのは「そう紹介されている」までで、
//     「詰まっている」「毒素が出ている」とアプリが判定しない。
//  2. **出典の数字をアプリの計算に使わない**（30分・18時間・毒素10倍・免疫の8割…）。
//     手元で確かめられないので、**主張としてそのまま並べる**だけにする。
//     例外は食事の間隔の4時間で、これは**出典が言っている目安**と明記したうえで、
//     自分の記録の間隔を並べるためだけに使う（達成・未達で責めない）。
//  3. **低FODMAP と食い違う所は、両方そのまま見せる**（`lib/conflicts.js`）。
//     ヨーグルト・はちみつ・たまねぎ・にんにく・牛乳は、片方が「よい」、片方が「多め」で
//     正面から反対になる。**アプリはどちらが正しいかを決めない。**
//  4. **誰にでも勧められる話ではない**（`ADAMSKI_PRECHECKS`）。朝食を軽くする・
//     食事の間隔を空けるは、体質や持病によっては勧められない。

/** 消化の速さの3つ。**出典の言い方をそのまま使う**（点数にしない・順位を付けない） */
export const SPEED_CLASSES = [
  { id: 'fast', label: '速い', mark: '速', note: '出典では「消化管を30分ほどで通る」と紹介されています。※要確認' },
  { id: 'slow', label: '遅い', mark: '遅', note: '出典では「数時間かかる」と紹介されています。※要確認' },
  {
    id: 'neutral',
    label: 'ニュートラル',
    mark: '中',
    note: '出典では「一緒に食べたものの消化を助ける」と紹介されています。※要確認',
  },
];

export const SPEED_BY_ID = Object.fromEntries(SPEED_CLASSES.map((s) => [s.id, s]));

/**
 * 出典で**名指しされている**食べもの。
 * ここに無いものは名指しされていない——`lib/combine.js` が「出どころ」を必ず添える。
 */
export const SPEED_NAMED = [
  // ── 速い ──
  { name: 'トマト', reading: 'とまと', speed: 'fast' },
  { name: 'かぼちゃ', reading: 'かぼちゃ', speed: 'fast' },
  { name: 'パプリカ', reading: 'ぱぷりか', speed: 'fast' },
  { name: '唐辛子', reading: 'とうがらし', speed: 'fast' },
  { name: 'はちみつ', reading: 'はちみつ', speed: 'fast' },
  { name: '緑茶', reading: 'りょくちゃ', speed: 'fast' },
  { name: 'ヨーグルト', reading: 'よーぐると', speed: 'fast' },

  // ── 遅い ──
  { name: 'パスタ（小麦）', reading: 'ぱすた', speed: 'slow' },
  { name: '小麦のパン', reading: 'こむぎのぱん', speed: 'slow' },
  { name: '白米', reading: 'はくまい', speed: 'slow' },
  { name: 'ピザ', reading: 'ぴざ', speed: 'slow' },
  { name: 'じゃがいも', reading: 'じゃがいも', speed: 'slow' },
  { name: 'とうもろこし', reading: 'とうもろこし', speed: 'slow' },
  { name: '肉（味つけなし）', reading: 'にく', speed: 'slow' },
  { name: '魚', reading: 'さかな', speed: 'slow' },
  { name: 'ハードチーズ（チェダー・パルメザン）', reading: 'はーどちーず', speed: 'slow' },
  { name: '卵', reading: 'たまご', speed: 'slow' },
  { name: '木綿豆腐', reading: 'もめんどうふ', speed: 'slow' },
  { name: '絹ごし豆腐', reading: 'きぬごしどうふ', speed: 'slow' },
  { name: 'くるみ', reading: 'くるみ', speed: 'slow' },
  { name: 'アーモンド', reading: 'あーもんど', speed: 'slow' },
  { name: 'カシューナッツ', reading: 'かしゅーなっつ', speed: 'slow' },
  { name: 'ピーナッツ', reading: 'ぴーなっつ', speed: 'slow' },
  { name: 'ピスタチオ', reading: 'ぴすたちお', speed: 'slow' },

  // 出典が使っている短い呼び名。**書き手が実際に書く言い方**でも拾えるようにする
  // （一覧の見出しを長い名前にしたせいで「パン」「米」が拾えなかった。実際に踏んだ）
  { name: 'パスタ', reading: 'ぱすた', speed: 'slow' },
  { name: '生ハム', reading: 'なまはむ', speed: 'slow' },
  { name: '小麦粉', reading: 'こむぎこ', speed: 'slow' },
  { name: '焼肉', reading: 'やきにく', speed: 'slow' },
  { name: 'メロン', reading: 'めろん', speed: 'fast' },
  { name: 'パン', reading: 'ぱん', speed: 'slow' },
  { name: '米', reading: 'こめ', speed: 'slow' },
  { name: 'ごはん', reading: 'ごはん', speed: 'slow' },
  { name: '肉', reading: 'にく', speed: 'slow' },
  { name: 'チーズ', reading: 'ちーず', speed: 'slow' },
  { name: '豆腐', reading: 'とうふ', speed: 'slow' },
  { name: 'ナッツ', reading: 'なっつ', speed: 'slow' },
  { name: 'くだもの', reading: 'くだもの', speed: 'fast' },
  { name: 'フルーツ', reading: 'ふるーつ', speed: 'fast' },
  { name: 'オリーブオイル', reading: 'おりーぶおいる', speed: 'neutral' },
  // ── ニュートラル ──
  { name: 'オリーブ油', reading: 'おりーぶあぶら', speed: 'neutral' },
  { name: '酢', reading: 'す', speed: 'neutral' },
  { name: 'にんにく', reading: 'にんにく', speed: 'neutral' },
  { name: 'たまねぎ', reading: 'たまねぎ', speed: 'neutral' },
  { name: 'なす', reading: 'なす', speed: 'neutral' },
  { name: '紅茶', reading: 'こうちゃ', speed: 'neutral' },
  { name: 'コーヒー', reading: 'こーひー', speed: 'neutral' },
  { name: '砂糖（上白糖）', reading: 'さとう', speed: 'neutral' },
  { name: '牛乳', reading: 'ぎゅうにゅう', speed: 'neutral' },
];

/**
 * 名指しされていないものの扱い。出典は
 * 「ほぼ全てのフルーツは速い」「速い以外のほぼ全ての食品は遅い」と言っているので、
 * **区分から当てる**。ただし当てたことは画面に必ず出す（`basis` を見せる）。
 * 「ほぼ」と言っている以上、例外があることも書く。
 */
export const SPEED_BY_CATEGORY = { fruit: 'fast' };
export const SPEED_DEFAULT = 'slow';

/** 出どころの言い方（当てずっぽうを断定で書かないため） */
export const SPEED_BASIS_LABELS = {
  named: '出典で名前が挙がっています',
  category: '出典の「くだものはほぼ全て速い」から当てはめました',
  default: '出典の「速いもの以外はほぼ全て遅い」から当てはめました',
  unknown: '出典に出てきません',
};

/** 出典が「よくない組み合わせ」として挙げている代表例 */
export const BAD_PAIRS = [
  {
    id: 'tomato_pasta',
    title: 'トマトソースのパスタ',
    reading: 'とまとそーすのぱすた',
    fast: 'トマト',
    slow: 'パスタ',
    note: '出典がいちばん代表的な例として挙げているもの。トマトを使わないパスタなら問題にならない、とされています。',
  },
  {
    id: 'tomato_pizza',
    title: 'トマトの乗ったピザ',
    reading: 'とまとののったぴざ',
    fast: 'トマト',
    slow: 'ピザ生地・チーズ',
    note: '生地とチーズは同じ「遅い」どうしなので、トマトを外せば組み合わせとしては合う、とされています。',
  },
  {
    id: 'ham_melon',
    title: '生ハムメロン',
    reading: 'なまはむめろん',
    fast: 'メロン',
    slow: '生ハム',
    note: '速いくだものと遅い肉の組み合わせ。',
  },
  {
    id: 'fruit_tart',
    title: 'フルーツタルト',
    reading: 'ふるーつたると',
    fast: 'くだもの',
    slow: '小麦粉・バター・卵',
    note: '見た目は軽くても、速いものと遅いものが一緒になっている例として挙げられています。',
  },
  {
    id: 'fruit_after_meat',
    title: '焼肉のあとのくだもの',
    reading: 'やきにくのあとのくだもの',
    fast: 'くだもの',
    slow: '肉',
    note: '「体によいものを足す」つもりが組み合わせとしては合わない、という例。',
  },
];

/**
 * 食べてしまった時に出典が勧めている一手。
 * **「効く」と書かない**——勧められている、までにする。
 */
export const OLIVE_OIL_TIP = {
  title: 'オリーブオイルをひと口',
  reading: 'おりーぶおいるをひとくち',
  body:
    '合わない組み合わせを食べてしまった時は、オリーブオイルをひと口だけ飲むことが出典で勧められています。'
    + '消化管のすべりをよくする、という説明のしかたです。',
  caution:
    '油をとると差しさわりのある持病（胆のうの病気・脂質の制限を受けている など）がある人は、'
    + '先に医師・管理栄養士に相談してください。効き目が確かめられている手当てではありません。',
  check: true,
};

/** 出典が言っている食事の間隔。**目安として並べるだけ**で、守れたかを採点しない */
export const MEAL_GAP_HOURS = 4;
export const MEAL_GAP_NOTE =
  '出典は「食事と食事の間を最低でも4時間」と勧めています。この数字は出典のもので、'
  + 'このアプリが確かめたものではありません。※要確認';

/** 朝を軽くする話。**「必ずそうすべき」と書かない** */
export const LIGHT_MORNING_NOTE =
  '出典は「朝は速いものだけにすると腸を休ませやすい」と勧めています。'
  + 'ただし朝食を軽くする・抜くことが向かない人もいます（下の「はじめる前に」を読んでください）。';

/** 消化管が働きにくくなる原因として出典が挙げている3つ */
export const THREE_CAUSES = [
  { id: 'combination', label: '合わない食べ合わせ' },
  { id: 'stress', label: 'ストレス' },
  { id: 'inactive', label: '体を動かしていないこと' },
];

/**
 * **裏が取れていない主張**。隠さず出したうえで、1件ずつ「確かめられていない」と添える
 * （変革ノートの `UNVERIFIED_CLAIMS` と同じ形）。
 * ここに置くものを画面から消さない——消すと、確からしさの分からない話が
 * 「アプリが言っていること」に見えてしまう。
 */
// `title`／`reading` は目次のためのもの（**読みは手で書く**）
export const ADAMSKI_UNVERIFIED = [
  {
    id: 'toxin',
    title: '腐敗と毒素',
    reading: 'ふはいとどくそ',
    claim: '消化管に食べ物が長くとどまると腐敗が起き、ふだんの10倍の毒素が出る',
    note: '「毒素」が何を指すのかがはっきりせず、10倍という数字の出どころも確かめられていません。体調不良の原因を1つに決めつける言い方でもあります。',
  },
  {
    id: 'hours18',
    title: '消化に18時間',
    reading: 'しょうかに18じかん',
    claim: '合わない組み合わせを食べると消化に18時間・24時間かかる',
    note: '消化にかかる時間は食べた量・体調・人によって変わります。この数字は確かめられていません。',
  },
  {
    id: 'immune80',
    title: '免疫の8割は腸',
    reading: 'めんえきの8わりはちょう',
    claim: '腸が免疫のはたらきの8割を担っている',
    note: 'よく言われる言い方ですが、「8割」という数え方の根拠は確かめられていません。',
  },
  {
    id: 'athlete',
    title: '運動する人の消化時間',
    reading: 'うんどうするひとのしょうかじかん',
    claim: '運動する人は3〜8時間で消化が終わる（ふつうは30〜40時間）',
    note: '運動が腸の動きに関わるという話自体はよく言われますが、この時間の数字は確かめられていません。',
  },
  {
    id: 'all_from_gut',
    title: '不調のほとんどは腸で決まる',
    reading: 'ふちょうのほとんどはちょうできまる',
    claim: '頭痛・不眠・肌荒れ・血行不良など、不調のほとんどは腸の状態で決まる',
    note: '不調の原因はさまざまです。この言い方を信じると、ほかの原因の受診が遅れることがあります。',
  },
  {
    id: 'thirty_min',
    title: '速いものは30分で通る',
    reading: 'はやいものは30ぷんでとおる',
    claim: '速い食べ物は30分で消化管を通る',
    note: '出典の説明に出てくる数字で、確かめられていません。このアプリはこの数字を計算に使っていません。',
  },
];

/**
 * はじめる前に。**該当したら画面の上に出し続ける**（消えない）。
 * 止めはしない——やるかどうかを決めるのは本人。
 */
export const ADAMSKI_PRECHECKS = [
  { id: 'diabetes', label: '血糖に関わる持病がある（糖尿病など）' },
  { id: 'medicine', label: '毎日のむ薬がある' },
  { id: 'pregnant', label: '妊娠中・授乳中' },
  { id: 'growing', label: '成長期のこども' },
  { id: 'eating', label: '摂食障害の経験がある' },
  { id: 'lowweight', label: '体重が少なめだと言われている' },
  { id: 'gallbladder', label: '胆のうの病気がある・脂質の制限を受けている' },
];

export const ADAMSKI_PRECHECK_WARNING =
  '当てはまるものがあります。食事の間隔を空ける・朝を軽くする・油をとる のどれも、'
  + '体の状態によっては勧められません。**先に医師・管理栄養士に相談してください。**';

/** できる範囲でよい、という出典自身の言葉。**この一文を消さない** */
export const ADAMSKI_PARTIAL_OK =
  '出典自身が「100%守ることはできないので、できる範囲で試してほしい」と書いています。'
  + 'このアプリも守れた回数を数えません。調子のよい日は好きなものを食べて構いません。';

/** 出典。**URL は書かない**（確かめられないリンクは、出典があるように見えて実は無い） */
export const ADAMSKI_SOURCE = {
  text: 'フランク・ラポルト＝アダムスキー『腸がすべて』で紹介されている食べ合わせの考え方（本人による要約から）',
  check: true, // ※要確認：原著・原論文を確かめきれていない
  checkedOn: '2026-09-02',
};
