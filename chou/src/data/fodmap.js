// 低FODMAP の食材一覧。
//
// 決めていること
//  1. **料理名から判定するAIを持たない。** 出せるのは「よく挙げられる分類」までで、
//     カレーやラーメンの中身は当てられない（README 決まり4）。
//  2. **○/× の二択にしない。** 実際には量で変わるものが多いので、
//     「少なめ／量による／多め」の3つで持つ。
//  3. **一覧は改訂され続けている。** 出典と最終確認日を必ず画面に出し、
//     確かめきれていないものは「※要確認」を付ける。**URL は書かない。**
//  4. **合う／合わないを機械が決めない。** 自分のからだの結果は本人が1件ずつ付ける。
//  5. 読みは手で書く（自動推定しない）。検索と並べ替えに使う。

export const FODMAP_LEVELS = [
  { id: 'low', label: '少なめ', mark: '低' },
  { id: 'depends', label: '量による', mark: '量' },
  { id: 'high', label: '多め', mark: '高' },
];

export const FODMAP_CATEGORIES = [
  { id: 'grain', label: 'ごはん・パン・めん' },
  { id: 'veg', label: 'やさい・いも' },
  { id: 'fruit', label: 'くだもの' },
  { id: 'protein', label: '肉・魚・卵・豆' },
  { id: 'dairy', label: '乳製品と、その代わりになるもの' },
  { id: 'nut', label: 'ナッツ・種' },
  { id: 'season', label: '調味料・甘み' },
  { id: 'drink', label: '飲みもの' },
];

export const FODMAP_FOODS = [
  // ── ごはん・パン・めん ──
  { name: '白米', reading: 'はくまい', category: 'grain', level: 'low' },
  { name: '玄米', reading: 'げんまい', category: 'grain', level: 'low' },
  { name: 'もち米', reading: 'もちごめ', category: 'grain', level: 'low' },
  { name: '米粉のパン', reading: 'こめこのぱん', category: 'grain', level: 'low' },
  { name: 'ビーフン', reading: 'びーふん', category: 'grain', level: 'low' },
  { name: '十割そば', reading: 'じゅうわりそば', category: 'grain', level: 'low', note: 'つなぎに小麦が入るそばは多めのほうへ寄ります。' },
  { name: 'オートミール', reading: 'おーとみーる', category: 'grain', level: 'depends', note: '少量なら少なめ。量が増えると多めになります。' },
  { name: 'コーンフレーク', reading: 'こーんふれーく', category: 'grain', level: 'depends', note: 'ドライフルーツやはちみつ入りのものは別に見ます。' },
  { name: '小麦のパン', reading: 'こむぎのぱん', category: 'grain', level: 'high' },
  { name: 'うどん', reading: 'うどん', category: 'grain', level: 'high' },
  { name: 'ラーメン', reading: 'らーめん', category: 'grain', level: 'high' },
  { name: 'パスタ（小麦）', reading: 'ぱすた', category: 'grain', level: 'high' },
  { name: '大麦', reading: 'おおむぎ', category: 'grain', level: 'high' },
  { name: 'ライ麦パン', reading: 'らいむぎぱん', category: 'grain', level: 'high' },

  // ── やさい・いも ──
  { name: 'にんじん', reading: 'にんじん', category: 'veg', level: 'low' },
  { name: 'なす', reading: 'なす', category: 'veg', level: 'low' },
  { name: 'トマト', reading: 'とまと', category: 'veg', level: 'low', note: '乾かしたトマトは同じ量でも中身が濃くなるので多めのほうへ寄ります。' },
  { name: 'きゅうり', reading: 'きゅうり', category: 'veg', level: 'low' },
  { name: 'ほうれん草', reading: 'ほうれんそう', category: 'veg', level: 'low' },
  { name: 'レタス', reading: 'れたす', category: 'veg', level: 'low' },
  { name: 'だいこん', reading: 'だいこん', category: 'veg', level: 'low' },
  { name: 'ピーマン', reading: 'ぴーまん', category: 'veg', level: 'low' },
  { name: 'ズッキーニ', reading: 'ずっきーに', category: 'veg', level: 'low' },
  { name: 'チンゲン菜', reading: 'ちんげんさい', category: 'veg', level: 'low' },
  { name: 'もやし', reading: 'もやし', category: 'veg', level: 'low' },
  { name: 'じゃがいも', reading: 'じゃがいも', category: 'veg', level: 'low' },
  { name: '長ねぎの青い部分', reading: 'ながねぎのあおいぶぶん', category: 'veg', level: 'low', note: '白い部分とは分けて見ます。香りづけに使いやすいところ。' },
  { name: 'かぼちゃ', reading: 'かぼちゃ', category: 'veg', level: 'depends' },
  { name: 'さつまいも', reading: 'さつまいも', category: 'veg', level: 'depends' },
  { name: 'ブロッコリー', reading: 'ぶろっこりー', category: 'veg', level: 'depends', note: '茎の部分のほうが多めのほうへ寄ります。' },
  { name: 'キャベツ', reading: 'きゃべつ', category: 'veg', level: 'depends', note: '芽キャベツは多めのほうです。' },
  { name: 'とうもろこし', reading: 'とうもろこし', category: 'veg', level: 'depends' },
  { name: 'セロリ', reading: 'せろり', category: 'veg', level: 'depends' },
  { name: 'たまねぎ', reading: 'たまねぎ', category: 'veg', level: 'high', note: '刻んで炒めたものが多くの料理に入っています。外食で見えにくいところ。' },
  { name: 'にんにく', reading: 'にんにく', category: 'veg', level: 'high' },
  { name: '長ねぎの白い部分', reading: 'ながねぎのしろいぶぶん', category: 'veg', level: 'high' },
  { name: 'アスパラガス', reading: 'あすぱらがす', category: 'veg', level: 'high' },
  { name: 'カリフラワー', reading: 'かりふらわー', category: 'veg', level: 'high' },
  { name: 'マッシュルーム', reading: 'まっしゅるーむ', category: 'veg', level: 'high' },
  { name: 'ごぼう', reading: 'ごぼう', category: 'veg', level: 'high' },
  { name: 'グリンピース', reading: 'ぐりんぴーす', category: 'veg', level: 'high' },

  // ── くだもの ──
  { name: 'いちご', reading: 'いちご', category: 'fruit', level: 'low' },
  { name: 'ぶどう', reading: 'ぶどう', category: 'fruit', level: 'low' },
  { name: 'オレンジ', reading: 'おれんじ', category: 'fruit', level: 'low' },
  { name: 'みかん', reading: 'みかん', category: 'fruit', level: 'low' },
  { name: 'キウイ', reading: 'きうい', category: 'fruit', level: 'low' },
  { name: 'パイナップル', reading: 'ぱいなっぷる', category: 'fruit', level: 'low' },
  { name: 'メロン（マスクメロン）', reading: 'めろん', category: 'fruit', level: 'low', note: 'すいかは多めのほうです。' },
  { name: 'バナナ', reading: 'ばなな', category: 'fruit', level: 'depends', note: '熟していないものは少なめ、よく熟したものは量が増えると多めになります。' },
  { name: 'ブルーベリー', reading: 'ぶるーべりー', category: 'fruit', level: 'depends' },
  { name: 'グレープフルーツ', reading: 'ぐれーぷふるーつ', category: 'fruit', level: 'depends' },
  { name: 'アボカド', reading: 'あぼかど', category: 'fruit', level: 'depends' },
  { name: '柿', reading: 'かき', category: 'fruit', level: 'depends', note: '干し柿は水分が抜けているぶん多めのほうへ寄ります。' },
  { name: 'りんご', reading: 'りんご', category: 'fruit', level: 'high' },
  { name: 'なし', reading: 'なし', category: 'fruit', level: 'high' },
  { name: 'もも', reading: 'もも', category: 'fruit', level: 'high' },
  { name: 'すいか', reading: 'すいか', category: 'fruit', level: 'high' },
  { name: 'さくらんぼ', reading: 'さくらんぼ', category: 'fruit', level: 'high' },
  { name: 'マンゴー', reading: 'まんごー', category: 'fruit', level: 'high' },
  { name: 'ドライフルーツ', reading: 'どらいふるーつ', category: 'fruit', level: 'high', note: '水分が抜けているので、少しの量でも中身が多くなります。' },

  // ── 肉・魚・卵・豆 ──
  { name: '肉（味つけなし）', reading: 'にく', category: 'protein', level: 'low', note: '味つけに入るたまねぎ・にんにくのほうを見ます。' },
  { name: '魚', reading: 'さかな', category: 'protein', level: 'low' },
  { name: '卵', reading: 'たまご', category: 'protein', level: 'low' },
  { name: '木綿豆腐', reading: 'もめんどうふ', category: 'protein', level: 'low', note: '水を切ってあるぶん、絹ごしとは分けて見ます。' },
  { name: 'テンペ', reading: 'てんぺ', category: 'protein', level: 'low' },
  { name: '納豆', reading: 'なっとう', category: 'protein', level: 'depends', note: '少ない量なら少なめとされます。' },
  { name: 'あずき', reading: 'あずき', category: 'protein', level: 'depends' },
  { name: 'ひよこ豆', reading: 'ひよこまめ', category: 'protein', level: 'depends', note: '缶詰を水で洗ったものは、少量なら少なめのほうへ寄ります。' },
  { name: 'レンズ豆', reading: 'れんずまめ', category: 'protein', level: 'depends', note: '同上。' },
  { name: '絹ごし豆腐', reading: 'きぬごしどうふ', category: 'protein', level: 'high' },
  { name: '大豆（ゆでたもの）', reading: 'だいず', category: 'protein', level: 'high' },

  // ── 乳製品と、その代わりになるもの ──
  { name: 'ラクトースフリー牛乳', reading: 'らくとーすふりーぎゅうにゅう', category: 'dairy', level: 'low' },
  { name: 'アーモンドミルク', reading: 'あーもんどみるく', category: 'dairy', level: 'low' },
  { name: 'ハードチーズ（チェダー・パルメザン）', reading: 'はーどちーず', category: 'dairy', level: 'low' },
  { name: 'カマンベールチーズ', reading: 'かまんべーるちーず', category: 'dairy', level: 'low' },
  { name: 'バター', reading: 'ばたー', category: 'dairy', level: 'low' },
  { name: 'クリームチーズ', reading: 'くりーむちーず', category: 'dairy', level: 'depends' },
  { name: '牛乳', reading: 'ぎゅうにゅう', category: 'dairy', level: 'high' },
  { name: 'ヨーグルト', reading: 'よーぐると', category: 'dairy', level: 'high', note: '「お腹によい」と言われるものですが、乳糖のぶんは別に見ます。合うかどうかは自分の記録で。' },
  { name: 'アイスクリーム', reading: 'あいすくりーむ', category: 'dairy', level: 'high' },
  { name: '練乳', reading: 'れんにゅう', category: 'dairy', level: 'high' },
  { name: '豆乳（大豆をまるごと使ったもの）', reading: 'とうにゅうだいずまるごと', category: 'dairy', level: 'high' },

  // ── ナッツ・種 ──
  { name: 'くるみ', reading: 'くるみ', category: 'nut', level: 'low' },
  { name: 'ピーナッツ', reading: 'ぴーなっつ', category: 'nut', level: 'low' },
  { name: 'かぼちゃの種', reading: 'かぼちゃのたね', category: 'nut', level: 'low' },
  { name: 'アーモンド', reading: 'あーもんど', category: 'nut', level: 'depends', note: 'ひとつかみを超えると多めのほうへ寄ります。' },
  { name: 'カシューナッツ', reading: 'かしゅーなっつ', category: 'nut', level: 'high' },
  { name: 'ピスタチオ', reading: 'ぴすたちお', category: 'nut', level: 'high' },

  // ── 調味料・甘み ──
  { name: '塩', reading: 'しお', category: 'season', level: 'low' },
  { name: 'しょうゆ', reading: 'しょうゆ', category: 'season', level: 'low' },
  { name: '酢', reading: 'す', category: 'season', level: 'low' },
  { name: 'オリーブ油', reading: 'おりーぶあぶら', category: 'season', level: 'low' },
  { name: 'しょうが', reading: 'しょうが', category: 'season', level: 'low' },
  { name: 'こしょう', reading: 'こしょう', category: 'season', level: 'low' },
  { name: 'メープルシロップ', reading: 'めーぷるしろっぷ', category: 'season', level: 'low' },
  { name: '砂糖（上白糖）', reading: 'さとう', category: 'season', level: 'low' },
  { name: 'にんにくの香りを移した油', reading: 'にんにくのかおりをうつしたあぶら', category: 'season', level: 'low', note: 'にんにくそのものを食べずに香りだけ使う方法。油に溶け出さない成分があるためとされます。' },
  { name: 'みそ', reading: 'みそ', category: 'season', level: 'depends' },
  { name: 'ケチャップ', reading: 'けちゃっぷ', category: 'season', level: 'depends', note: 'たまねぎ・にんにくが入っている製品があります。' },
  { name: 'はちみつ', reading: 'はちみつ', category: 'season', level: 'high' },
  { name: '果糖ぶどう糖液糖', reading: 'かとうぶどうとうえきとう', category: 'season', level: 'high', note: '清涼飲料や菓子によく入っています。' },
  { name: 'ソルビトール・キシリトールなどの甘味料', reading: 'そるびとーるきしりとーる', category: 'season', level: 'high', note: '「シュガーレス」の菓子やガムに入っていることがあります。' },
  { name: '固形スープの素', reading: 'こけいすーぷのもと', category: 'season', level: 'high', note: 'たまねぎ・にんにくが入っている製品が多いところ。' },

  // ── 飲みもの ──
  { name: '水', reading: 'みず', category: 'drink', level: 'low' },
  { name: '緑茶', reading: 'りょくちゃ', category: 'drink', level: 'low' },
  { name: 'コーヒー', reading: 'こーひー', category: 'drink', level: 'low', note: 'FODMAP としては少なめですが、量が多いとお腹が動きやすくなる人がいます。' },
  { name: '紅茶', reading: 'こうちゃ', category: 'drink', level: 'depends', note: '濃く出したものは多めのほうへ寄ります。' },
  { name: 'りんごジュース', reading: 'りんごじゅーす', category: 'drink', level: 'high' },
];

/** 一覧のいちばん上に必ず出す注意書き。**消さない。** */
export const FODMAP_NOTES = [
  '量によって変わります。少なめの食材でも、たくさん食べれば合わないことがあります。',
  'この一覧は改訂され続けています。ここに無いもの・食べたあとの自分の記録のほうを信じてください。',
  '低FODMAP は「一度減らして、ひとつずつ戻して、自分に合わないものを見つける」ための方法で、'
    + '減らしたまま長く続ける食事ではありません。続けるときは管理栄養士・医師に相談してください。',
];

/** 出典。**URL は書かない**（確かめられないリンクは、出典があるように見えて実は無い） */
export const FODMAP_SOURCE = {
  text: 'モナシュ大学（Monash University）が広めた低FODMAP食の考え方にもとづく、一般的な分類',
  check: true, // ※要確認：版と改訂日まで確かめきれていない
  checkedOn: '2026-09-02',
};

/** 自分のからだの結果（**機械が決めない**。押すのは本人） */
export const FOOD_RESULTS = [
  { id: 'ok', label: '合った', mark: '○' },
  { id: 'ng', label: '合わなかった', mark: '×' },
  { id: 'unknown', label: 'わからない', mark: '?' },
];
