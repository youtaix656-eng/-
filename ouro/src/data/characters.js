// AIキャラクターの索引（会社チーム①〜⑩ × 各3名 ＝ 30名 ＋ マーケティングチーム5名）。
//
// ここに置くのは**一覧を描くのに要るものだけ**（新項目03）。
//   name    … 表示名（指定どおりの綴り）
//   kana    … カタカナ表記
//   reading … ひらがなの読み（目次の並びに使う。推定しないので必ず持たせる）
//   strength… 3人の中でのこの席の持ち味（依頼を割り振る目印）
//   portrait… 線画アバターのパーツ（髪型・眼鏡・装い・襟）
//
// 長い文章（出身・人物像・書き方）は data/characterDetails.js に分けてあり、
// **名鑑を開く・雇う時に初めて読み込む**。起動時に35名ぶんの文章を読まないため。
// 取り出しは characterDetail()／読み込みは loadCharacterDetails()。
//
// 肖像は data/portraits.js ＋ components/Portrait.jsx が描く。
// **顔立ちで人種・民族を描き分けない**方針のため、見分けは髪型・装い・紋章でつける。

export const CHARACTERS = [
  {
    roleId: 'productowner', seat: 1,
    name: 'Sofia Marchetti', kana: 'ソフィア・マルケッティ', reading: 'そふぃあまるけってぃ',
    strength: '大局観',
    portrait: { hair: 'wave', glasses: null, extra: 'earring', collar: 'coat' },
  },
  {
    roleId: 'productowner', seat: 2,
    name: 'Daniel Kim', kana: 'ダニエル・キム', reading: 'だにえるきむ',
    strength: '数字で決める',
    portrait: { hair: 'short', glasses: 'square', extra: null, collar: 'shirt' },
  },
  {
    roleId: 'productowner', seat: 3,
    name: 'Amara Okafor', kana: 'アマラ・オカフォー', reading: 'あまらおかふぉー',
    strength: '人を巻き込む',
    portrait: { hair: 'locs', glasses: null, extra: 'headband', collar: 'v' },
  },
  {
    roleId: 'clinical', seat: 1,
    name: 'Dr. Lukas Weber', kana: 'ルーカス・ヴェーバー', reading: 'るーかすうぇーばー',
    strength: '厳格',
    portrait: { hair: 'sidepart', glasses: 'round', extra: null, collar: 'shirt' },
  },
  {
    roleId: 'clinical', seat: 2,
    name: 'Dr. Priya Sharma', kana: 'プリヤ・シャルマ', reading: 'ぷりやしゃるま',
    strength: '根拠と橋渡し',
    portrait: { hair: 'bun', glasses: null, extra: 'stud', collar: 'round' },
  },
  {
    roleId: 'clinical', seat: 3,
    name: 'Dr. Marco Rossi', kana: 'マルコ・ロッシ', reading: 'まるころっし',
    strength: '現場感覚',
    portrait: { hair: 'curls', glasses: null, extra: null, collar: 'coat' },
  },
  {
    roleId: 'promptdesigner', seat: 1,
    name: 'Elena Petrova', kana: 'エレナ・ペトロワ', reading: 'えれなぺとろわ',
    strength: '構造',
    portrait: { hair: 'long', glasses: 'square', extra: null, collar: 'v' },
  },
  {
    roleId: 'promptdesigner', seat: 2,
    name: 'Wei Zhang', kana: 'ウェイ・ジャン', reading: 'うぇいじゃん',
    strength: '反復改善',
    portrait: { hair: 'crop', glasses: null, extra: null, collar: 'round' },
  },
  {
    roleId: 'promptdesigner', seat: 3,
    name: 'Noah Bergström', kana: 'ノア・ベルイストレーム', reading: 'のあべるいすとれーむ',
    strength: '使い心地',
    portrait: { hair: 'buzz', glasses: 'round', extra: null, collar: 'shirt' },
  },
  {
    roleId: 'contentmarketer', seat: 1,
    name: 'Camille Dubois', kana: 'カミーユ・デュボワ', reading: 'かみーゆでゅぼわ',
    strength: '物語',
    portrait: { hair: 'bob', glasses: null, extra: 'scarf', collar: 'round' },
  },
  {
    roleId: 'contentmarketer', seat: 2,
    name: 'Isabella Santos', kana: 'イザベラ・サントス', reading: 'いざべらさんとす',
    strength: '共感',
    portrait: { hair: 'curls', glasses: null, extra: 'earring', collar: 'v' },
  },
  {
    roleId: 'contentmarketer', seat: 3,
    name: 'Liam O\'Connor', kana: 'リアム・オコナー', reading: 'りあむおこなー',
    strength: '言葉の切れ味',
    portrait: { hair: 'layered', glasses: null, extra: null, collar: 'shirt' },
  },
  {
    roleId: 'sales', seat: 1,
    name: 'Carlos Mendoza', kana: 'カルロス・メンドーサ', reading: 'かるろすめんどーさ',
    strength: '信頼づくり',
    portrait: { hair: 'short', glasses: null, extra: 'tie', collar: 'shirt' },
  },
  {
    roleId: 'sales', seat: 2,
    name: 'Hannah Müller', kana: 'ハンナ・ミュラー', reading: 'はんなみゅらー',
    strength: '詰めの強さ',
    portrait: { hair: 'pony', glasses: 'square', extra: null, collar: 'coat' },
  },
  {
    roleId: 'sales', seat: 3,
    name: 'Jamal Bello', kana: 'ジャマル・ベロ', reading: 'じゃまるべろ',
    strength: '粘り強さ',
    portrait: { hair: 'buzz', glasses: null, extra: 'stud', collar: 'v' },
  },
  {
    roleId: 'support', seat: 1,
    name: 'Grace Tan', kana: 'グレース・タン', reading: 'ぐれーすたん',
    strength: '丁寧さ',
    portrait: { hair: 'bob', glasses: 'round', extra: null, collar: 'round' },
  },
  {
    roleId: 'support', seat: 2,
    name: 'Mateus Silva', kana: 'マテウス・シルバ', reading: 'まてうすしるば',
    strength: '親しみやすさ',
    portrait: { hair: 'wave', glasses: null, extra: null, collar: 'round' },
  },
  {
    roleId: 'support', seat: 3,
    name: 'Aisha Rahman', kana: 'アイシャ・ラーマン', reading: 'あいしゃらーまん',
    strength: '気配り',
    portrait: { hair: 'braid', glasses: null, extra: 'stud', collar: 'v' },
  },
  {
    roleId: 'engineer', seat: 1,
    name: 'Viktor Novák', kana: 'ヴィクトル・ノヴァーク', reading: 'うぃくとるのわーく',
    strength: '堅実さ',
    portrait: { hair: 'sidepart', glasses: 'square', extra: null, collar: 'coat' },
  },
  {
    roleId: 'engineer', seat: 2,
    name: 'Ravi Patel', kana: 'ラヴィ・パテル', reading: 'らびぱてる',
    strength: '速さ',
    portrait: { hair: 'topknot', glasses: null, extra: null, collar: 'round' },
  },
  {
    roleId: 'engineer', seat: 3,
    name: 'Anders Larsen', kana: 'アンダース・ラーセン', reading: 'あんだーすらーせん',
    strength: '簡潔さ',
    portrait: { hair: 'crop', glasses: 'round', extra: null, collar: 'v' },
  },
  {
    roleId: 'analytics', seat: 1,
    name: 'Julia Novak', kana: 'ユリア・ノヴァク', reading: 'ゆりあのわく',
    strength: '読み解き',
    portrait: { hair: 'long', glasses: null, extra: null, collar: 'round' },
  },
  {
    roleId: 'analytics', seat: 2,
    name: 'Ethan Clarke', kana: 'イーサン・クラーク', reading: 'いーさんくらーく',
    strength: '仮説検証',
    portrait: { hair: 'bob', glasses: 'round', extra: 'tie', collar: 'shirt' },
  },
  {
    roleId: 'analytics', seat: 3,
    name: 'Mei Lin', kana: 'メイ・リン', reading: 'めいりん',
    strength: '見せ方',
    portrait: { hair: 'halfup', glasses: null, extra: 'stud', collar: 'v' },
  },
  {
    roleId: 'finance', seat: 1,
    name: 'Anna Kowalski', kana: 'アンナ・コワルスキ', reading: 'あんなこわるすき',
    strength: '正確さ',
    portrait: { hair: 'bun', glasses: 'square', extra: null, collar: 'shirt' },
  },
  {
    roleId: 'finance', seat: 2,
    name: 'Thomas Andersen', kana: 'トーマス・アンデルセン', reading: 'とーますあんでるせん',
    strength: '契約に強い',
    portrait: { hair: 'short', glasses: 'round', extra: 'tie', collar: 'coat' },
  },
  {
    roleId: 'finance', seat: 3,
    name: 'Fatima Al-Sayed', kana: 'ファティマ・アルサイード', reading: 'ふぁてぃまあるさいーど',
    strength: 'リスク管理',
    portrait: { hair: 'braid', glasses: null, extra: 'scarf', collar: 'round' },
  },
  {
    roleId: 'pr', seat: 1,
    name: 'Olivia Bennett', kana: 'オリビア・ベネット', reading: 'おりびあべねっと',
    strength: '共感を呼ぶ',
    portrait: { hair: 'wave', glasses: null, extra: null, collar: 'v' },
  },
  {
    roleId: 'pr', seat: 2,
    name: 'Diego Fernández', kana: 'ディエゴ・フェルナンデス', reading: 'でぃえごふぇるなんです',
    strength: '見た目で伝える',
    portrait: { hair: 'layered', glasses: null, extra: 'earring', collar: 'coat' },
  },
  {
    roleId: 'pr', seat: 3,
    name: 'Naomi Adeyemi', kana: 'ナオミ・アデイエミ', reading: 'なおみあでいえみ',
    strength: '広げ方',
    portrait: { hair: 'topknot', glasses: null, extra: 'headband', collar: 'round' },
  },
  {
    roleId: 'mkt_content', seat: 1,
    name: 'Olivia', kana: 'オリビア', reading: 'おりびあ',
    strength: '攻め・企画',
    portrait: { hair: 'halfup', glasses: null, extra: 'scarf', collar: 'coat' },
  },
  {
    roleId: 'mkt_governance', seat: 1,
    name: 'Ethan', kana: 'イーサン', reading: 'いーさん',
    strength: '守り・ブレーキ役',
    portrait: { hair: 'sidepart', glasses: 'square', extra: 'tie', collar: 'shirt' },
  },
  {
    roleId: 'mkt_ops', seat: 1,
    name: 'Sofia', kana: 'ソフィア', reading: 'そふぃあ',
    strength: '攻め・配信',
    portrait: { hair: 'pony', glasses: null, extra: 'headband', collar: 'round' },
  },
  {
    roleId: 'mkt_brand', seat: 1,
    name: 'Lucas', kana: 'ルーカス', reading: 'るーかす',
    strength: '対外・一貫性',
    portrait: { hair: 'wave', glasses: 'round', extra: 'earring', collar: 'v' },
  },
  {
    roleId: 'mkt_forecast', seat: 1,
    name: 'Mia', kana: 'ミア', reading: 'みあ',
    strength: '助言・数値の裏づけ',
    portrait: { hair: 'braid', glasses: 'square', extra: null, collar: 'coat' },
  },
];

export function charactersOf(roleId) {
  return CHARACTERS.filter((c) => c.roleId === roleId).sort((a, b) => a.seat - b.seat);
}

export function characterAt(roleId, seat) {
  return CHARACTERS.find((c) => c.roleId === roleId && c.seat === seat) || null;
}

/** キャラクター設定を持つ役職の一覧。 */
export function characterRoleIds() {
  return [...new Set(CHARACTERS.map((c) => c.roleId))];
}

// ── 人物像・書き方・出身（別ファイル。要る時にだけ読む）──

let details = null;
let loading = null;

/**
 * 長い文章のほうを読み込む。何度呼んでも読み込みは1回だけ。
 * 名鑑を開く時と、雇う時に呼ぶ。
 */
export function loadCharacterDetails() {
  if (details) return Promise.resolve(details);
  if (!loading) {
    loading = import('./characterDetails.js')
      .then((m) => {
        details = m.CHARACTER_DETAILS;
        return details;
      })
      .catch((e) => {
        loading = null; // 次に呼ばれた時にやり直せるようにする
        throw e;
      });
  }
  return loading;
}

/**
 * 読み込み済みの人物像を返す。まだなら null。
 *
 * **null を「設定が無い」と解釈しないこと。**「まだ読んでいない」だけなので、
 * 呼ぶ側は loadCharacterDetails() を待つか、席の持ち味で代用する
 * （data/employees.js の fromCharacter がそうしている）。
 */
export function characterDetail(roleId, seat) {
  if (!details) return null;
  return details[`${roleId}:${seat}`] || null;
}

/** テスト用：読み込み済みかどうか。 */
export function characterDetailsLoaded() {
  return details != null;
}
