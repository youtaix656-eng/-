// 資格試験カタログ — 「いろいろな資格試験に対応する」ための単一の正。
//
// ここに1件足せば、計画書・勉強法の提案・変換プロンプト・目次がすべて自動で追従する
// （画面に if を足さない）。
//
// ■ このファイルの一番大事な約束 ─────────────────────────────
// **毎年変わる数字（合格率・合格点・試験日・受験料・出題数）をここに持たない。**
// 持った瞬間に「アプリに書いてあったから」と古い数字を信じてしまう。
// 代わりに checkPoints（公式サイトで必ず自分で確かめること）を持つ。
// 出題形式や科目の並びも制度改正で変わるので、あくまで**書き換え前提の雛形**として置き、
// ユーザーが自分の試験を追加・編集できるようにしてある（lib/myExam.js）。
//
// traits（この試験はどういう性格か）は **このアプリの見立てであって公式の分類ではない**。
// この見立てが勉強法の提案につながるので、合わなければユーザーが編集する。
// ────────────────────────────────────────────────

/** 試験の性格（勉強法の提案につながる語彙。単一の正） */
export const TRAIT_VOCABULARY = {
  memory: { label: '暗記量が多い', hint: '覚える項目そのものが多い。思い出す練習を主役にする' },
  wide: { label: '範囲が広い', hint: '全部を同じ濃さでやると終わらない。捨てる所を決める' },
  law: { label: '法令・改正が絡む', hint: '古い教材が事故になる。改正点を毎年つぶす' },
  calc: { label: '計算がある', hint: '読むだけでは伸びない。手を動かした回数が効く' },
  case: { label: '事例・応用が出る', hint: '知識を「使う」練習が要る。丸暗記だけでは届かない' },
  essay: { label: '記述・論述がある', hint: '書いて、人に読んでもらう工程が要る' },
  practical: { label: '実技がある', hint: '机の上の勉強とは別枠の時間を確保する' },
  oral: { label: '口述・面接がある', hint: '声に出す練習を予定に入れる' },
  speed: { label: '時間が足りなくなりやすい', hint: '本番と同じ時間で解く練習を早めに始める' },
  update: { label: '統計・数値が毎年動く', hint: '数値問題は直前期にまとめて更新する' },
};

export const TRAIT_IDS = Object.keys(TRAIT_VOCABULARY);

/** 出題形式（変換プロンプトの作り分けに使う） */
export const FORMAT_VOCABULARY = {
  choice: { label: '択一（マークシート）', hint: '正解1つ。誤答選択肢の“正しい内容”まで拾うと一気に増える' },
  multi: { label: '多肢選択・組み合わせ', hint: '「正しいものの組み合わせ」型。1つずつ○×に割ると弱点が見える' },
  ox: { label: '○×', hint: '短く作れるので、思い出す練習の回数を稼ぐのに向く' },
  essay: { label: '記述・論述', hint: 'AIには「模範解答」より「採点の観点」を作らせるほうが役に立つ' },
  practical: { label: '実技', hint: '手順を分解して、口で言えるところまで落とす' },
  oral: { label: '口述・面接', hint: '想定問答を作り、声に出して答える' },
};

export const FORMAT_IDS = Object.keys(FORMAT_VOCABULARY);

/** カテゴリ（目次の色分け・絞り込みに使う） */
export const EXAM_CATEGORIES = [
  { id: 'medical', label: '医療・福祉', reading: 'いりょうふくし', icon: '🩺' },
  { id: 'legal', label: '士業・法律', reading: 'しぎょうほうりつ', icon: '⚖️' },
  { id: 'business', label: 'ビジネス・会計', reading: 'びじねすかいけい', icon: '📊' },
  { id: 'it', label: 'IT・情報', reading: 'あいてぃーじょうほう', icon: '💻' },
  { id: 'technical', label: '技術・技能', reading: 'ぎじゅつぎのう', icon: '🔧' },
];

export const CATEGORY_MAP = Object.fromEntries(EXAM_CATEGORIES.map((c) => [c.id, c]));

/** どの試験にも共通で確かめてほしいこと（毎年変わる・制度で変わる） */
export const COMMON_CHECK_POINTS = [
  '今年の試験日・申込期間・申込方法',
  '合格基準（点数が決まっているのか、上位◯%なのか）',
  '出題数と試験時間',
  '受験資格（実務経験・指定校・講習の要否）',
  '直近の制度改正・出題範囲の変更',
];

export const EXAMS = [
  {
    id: 'shinkyu',
    name: 'はり師・きゅう師',
    reading: 'はりしきゅうし',
    category: 'medical',
    body: '厚生労働省（指定試験機関が実施）',
    formats: ['choice'],
    traits: ['memory', 'wide', 'update'],
    core: '過去問で問われ方を覚えてから教科書に戻る。東洋医学概論・経絡経穴概論は暗記の芯なので早く始める。',
    pitfall: '教科書を頭から読み直してしまい、演習の量が最後まで足りない。',
    subjects: [
      { name: '医療概論', reading: 'いりょうがいろん' },
      { name: '衛生学公衆衛生学', reading: 'えいせいがくこうしゅうえいせいがく' },
      { name: '関係法規', reading: 'かんけいほうき' },
      { name: '解剖学', reading: 'かいぼうがく' },
      { name: '生理学', reading: 'せいりがく' },
      { name: '病理学概論', reading: 'びょうりがくがいろん' },
      { name: '臨床医学総論', reading: 'りんしょういがくそうろん' },
      { name: '臨床医学各論', reading: 'りんしょういがくかくろん' },
      { name: 'リハビリテーション医学', reading: 'りはびりてーしょんいがく' },
      { name: '東洋医学概論', reading: 'とうよういがくがいろん' },
      { name: '経絡経穴概論', reading: 'けいらくけいけつがいろん' },
      { name: '東洋医学臨床論', reading: 'とうよういがくりんしょうろん' },
      { name: 'はり理論', reading: 'はりりろん' },
      { name: 'きゅう理論', reading: 'きゅうりろん' },
    ],
    checkPoints: ['国民医療費など統計の最新値', 'はり師・きゅう師で共通科目と専門科目の扱い'],
  },
  {
    id: 'judo',
    name: '柔道整復師',
    reading: 'じゅうどうせいふくし',
    category: 'medical',
    body: '厚生労働省（指定試験機関が実施）',
    formats: ['choice'],
    traits: ['memory', 'wide', 'case'],
    core: '柔道整復理論を軸に、基礎医学（解剖・生理）を土台として並行させる。損傷別の整復・固定は figure と結びつけて覚える。',
    pitfall: '基礎医学を後回しにして、理論の「なぜ」が最後まで曖昧なまま終わる。',
    subjects: [
      { name: '解剖学', reading: 'かいぼうがく' },
      { name: '生理学', reading: 'せいりがく' },
      { name: '運動学', reading: 'うんどうがく' },
      { name: '病理学概論', reading: 'びょうりがくがいろん' },
      { name: '衛生学・公衆衛生学', reading: 'えいせいがくこうしゅうえいせいがく' },
      { name: '一般臨床医学', reading: 'いっぱんりんしょういがく' },
      { name: '外科学概論', reading: 'げかがくがいろん' },
      { name: '整形外科学', reading: 'せいけいげかがく' },
      { name: 'リハビリテーション医学', reading: 'りはびりてーしょんいがく' },
      { name: '柔道整復理論', reading: 'じゅうどうせいふくりろん' },
      { name: '関係法規', reading: 'かんけいほうき' },
    ],
    checkPoints: ['必修問題の扱い（基準点があるか）'],
  },
  {
    id: 'kangoshi',
    name: '看護師',
    reading: 'かんごし',
    category: 'medical',
    body: '厚生労働省',
    formats: ['choice', 'multi'],
    traits: ['memory', 'wide', 'case', 'update', 'speed'],
    core: '必修問題を落とさないことが最優先。状況設定問題は「知識」ではなく「読み取り」なので、別枠で練習する。',
    pitfall: '一般問題ばかり解いて、必修と状況設定の練習量が偏る。',
    subjects: [
      { name: '人体の構造と機能', reading: 'じんたいのこうぞうときのう' },
      { name: '疾病の成り立ちと回復の促進', reading: 'しっぺいのなりたちとかいふくのそくしん' },
      { name: '健康支援と社会保障制度', reading: 'けんこうしえんとしゃかいほしょうせいど' },
      { name: '基礎看護学', reading: 'きそかんごがく' },
      { name: '成人看護学', reading: 'せいじんかんごがく' },
      { name: '老年看護学', reading: 'ろうねんかんごがく' },
      { name: '小児看護学', reading: 'しょうにかんごがく' },
      { name: '母性看護学', reading: 'ぼせいかんごがく' },
      { name: '精神看護学', reading: 'せいしんかんごがく' },
      { name: '在宅看護論・看護の統合と実践', reading: 'ざいたくかんごろんとかんごのとうごうとじっせん' },
    ],
    checkPoints: ['必修問題の基準（一般・状況設定とは別に基準があるか）', '社会保障制度の改正点'],
  },
  {
    id: 'pt',
    name: '理学療法士',
    reading: 'りがくりょうほうし',
    category: 'medical',
    body: '厚生労働省',
    formats: ['choice', 'multi'],
    traits: ['memory', 'wide', 'case'],
    core: '解剖・生理・運動学の3つが全科目の土台。ここが固まると専門科目の暗記量が一気に減る。',
    pitfall: '専門科目から入って、土台が無いまま丸暗記になる。',
    subjects: [
      { name: '解剖学', reading: 'かいぼうがく' },
      { name: '生理学', reading: 'せいりがく' },
      { name: '運動学', reading: 'うんどうがく' },
      { name: '病理学概論', reading: 'びょうりがくがいろん' },
      { name: '臨床心理学', reading: 'りんしょうしんりがく' },
      { name: 'リハビリテーション医学', reading: 'りはびりてーしょんいがく' },
      { name: '臨床医学大要', reading: 'りんしょういがくたいよう' },
      { name: '理学療法', reading: 'りがくりょうほう' },
    ],
    checkPoints: ['一般問題と実地問題の配点の扱い'],
  },
  {
    id: 'kaigo',
    name: '介護福祉士',
    reading: 'かいごふくしし',
    category: 'medical',
    body: '公益財団法人 社会福祉振興・試験センター',
    formats: ['choice'],
    traits: ['memory', 'wide', 'case', 'law', 'update'],
    core: '全科目群で最低1点を取る必要があるので、捨て科目を作れない。苦手科目こそ薄く広く回す。',
    pitfall: '得意分野を伸ばしてしまい、0点科目を作って不合格になる。',
    subjects: [
      { name: '人間の尊厳と自立・人間関係とコミュニケーション', reading: 'にんげんのそんげんとじりつ' },
      { name: '社会の理解', reading: 'しゃかいのりかい' },
      { name: 'こころとからだのしくみ', reading: 'こころとからだのしくみ' },
      { name: '発達と老化の理解', reading: 'はったつとろうかのりかい' },
      { name: '認知症の理解', reading: 'にんちしょうのりかい' },
      { name: '障害の理解', reading: 'しょうがいのりかい' },
      { name: '医療的ケア', reading: 'いりょうてきけあ' },
      { name: '介護の基本・介護過程', reading: 'かいごのきほんとかいごかてい' },
      { name: '生活支援技術', reading: 'せいかつしえんぎじゅつ' },
      { name: '総合問題', reading: 'そうごうもんだい' },
    ],
    checkPoints: ['科目群ごとの最低基準（0点科目群があると不合格になるか）', '介護保険制度の改正点'],
  },
  {
    id: 'seishin',
    name: '精神保健福祉士',
    reading: 'せいしんほけんふくしし',
    category: 'medical',
    body: '公益財団法人 社会福祉振興・試験センター',
    formats: ['choice'],
    traits: ['memory', 'wide', 'law', 'case', 'update'],
    core: '共通科目（社会福祉士と重なる範囲）が量の大半。制度と法律を年表で押さえると散らばらない。',
    pitfall: '専門科目だけ厚くして、共通科目の量を見誤る。',
    subjects: [
      { name: '精神医学と精神医療', reading: 'せいしんいがくとせいしんいりょう' },
      { name: '現代の精神保健の課題と支援', reading: 'げんだいのせいしんほけんのかだいとしえん' },
      { name: '精神保健福祉の原理', reading: 'せいしんほけんふくしのげんり' },
      { name: 'ソーシャルワークの理論と方法', reading: 'そーしゃるわーくのりろんとほうほう' },
      { name: '社会福祉の共通科目', reading: 'しゃかいふくしのきょうつうかもく' },
    ],
    checkPoints: ['共通科目の免除条件', 'カリキュラム改正の適用年度'],
  },
  {
    id: 'shinrishi',
    name: '公認心理師',
    reading: 'こうにんしんりし',
    category: 'medical',
    body: '一般財団法人 日本心理研修センター',
    formats: ['choice'],
    traits: ['memory', 'wide', 'case', 'law'],
    core: '事例問題の配点が重いので、知識の暗記より「この場面で何をするか」の判断練習に時間を割く。',
    pitfall: '用語の暗記に寄りすぎて、事例で点が伸びない。',
    subjects: [
      { name: '公認心理師としての職責', reading: 'こうにんしんりしとしてのしょくせき' },
      { name: '心理学の基礎', reading: 'しんりがくのきそ' },
      { name: '心理状態の観察と結果の分析', reading: 'しんりじょうたいのかんさつ' },
      { name: '健康・医療分野', reading: 'けんこういりょうぶんや' },
      { name: '福祉・教育・司法・産業分野', reading: 'ふくしきょういくしほうさんぎょうぶんや' },
      { name: '関係行政論', reading: 'かんけいぎょうせいろん' },
    ],
    checkPoints: ['事例問題の配点', '受験資格の区分'],
  },
  {
    id: 'sharoushi',
    name: '社会保険労務士',
    reading: 'しゃかいほけんろうむし',
    category: 'legal',
    body: '全国社会保険労務士会連合会 試験センター',
    formats: ['choice', 'multi'],
    traits: ['memory', 'wide', 'law', 'update', 'speed'],
    core: '科目ごとの基準点があるので、苦手科目を作れない。選択式は1科目の取りこぼしが致命傷になる。',
    pitfall: '得意科目を伸ばして、選択式の1科目で基準点に届かず落ちる。',
    subjects: [
      { name: '労働基準法・労働安全衛生法', reading: 'ろうどうきじゅんほうとろうどうあんぜんえいせいほう' },
      { name: '労働者災害補償保険法', reading: 'ろうどうしゃさいがいほしょうほけんほう' },
      { name: '雇用保険法', reading: 'こようほけんほう' },
      { name: '労働保険徴収法', reading: 'ろうどうほけんちょうしゅうほう' },
      { name: '労務管理その他の労働に関する一般常識', reading: 'ろうむかんりろうどういっぱんじょうしき' },
      { name: '社会保険に関する一般常識', reading: 'しゃかいほけんいっぱんじょうしき' },
      { name: '健康保険法', reading: 'けんこうほけんほう' },
      { name: '厚生年金保険法', reading: 'こうせいねんきんほけんほう' },
      { name: '国民年金法', reading: 'こくみんねんきんほう' },
    ],
    checkPoints: ['選択式・択一式それぞれの総得点と科目別基準点', '救済措置の有無', '法改正の施行日'],
  },
  {
    id: 'gyousei',
    name: '行政書士',
    reading: 'ぎょうせいしょし',
    category: 'legal',
    body: '一般財団法人 行政書士試験研究センター',
    formats: ['choice', 'multi', 'essay'],
    traits: ['memory', 'law', 'case', 'essay', 'update'],
    core: '行政法と民法で点の大半が決まる。記述式は部分点を取りにいく（白紙を作らない）。',
    pitfall: '一般知識で基準点に届かず、法令科目が良くても落ちる。',
    subjects: [
      { name: '憲法', reading: 'けんぽう' },
      { name: '行政法', reading: 'ぎょうせいほう' },
      { name: '民法', reading: 'みんぽう' },
      { name: '商法・会社法', reading: 'しょうほうかいしゃほう' },
      { name: '基礎法学', reading: 'きそほうがく' },
      { name: '一般知識等', reading: 'いっぱんちしきとう' },
    ],
    checkPoints: ['一般知識等の基準点', '記述式の配点', '法令の基準日（何年何月時点の法令か）'],
  },
  {
    id: 'takken',
    name: '宅地建物取引士',
    reading: 'たくちたてものとりひきし',
    category: 'legal',
    body: '一般財団法人 不動産適正取引推進機構',
    formats: ['choice'],
    traits: ['memory', 'law', 'update', 'speed'],
    core: '宅建業法で満点近くを狙い、権利関係（民法）は深追いしない。合格点は年により動くので余裕を作る。',
    pitfall: '民法を完璧にしようとして、配点の大きい宅建業法の演習量が足りなくなる。',
    subjects: [
      { name: '宅建業法', reading: 'たっけんぎょうほう' },
      { name: '権利関係', reading: 'けんりかんけい' },
      { name: '法令上の制限', reading: 'ほうれいじょうのせいげん' },
      { name: '税・その他', reading: 'ぜいそのた' },
    ],
    checkPoints: ['今年の合格点（毎年動く）', '法令の基準日', '登録講習による5問免除の対象か'],
  },
  {
    id: 'shindanshi',
    name: '中小企業診断士',
    reading: 'ちゅうしょうきぎょうしんだんし',
    category: 'business',
    body: '一般社団法人 中小企業診断協会',
    formats: ['choice', 'essay', 'oral'],
    traits: ['wide', 'calc', 'case', 'essay', 'oral', 'speed'],
    core: '1次は7科目の総合点なので、得意科目で苦手科目を補う設計にする。2次は「解答の型」を先に決める。',
    pitfall: '1次の知識を増やし続けて、2次の記述練習に入るのが遅れる。',
    subjects: [
      { name: '経済学・経済政策', reading: 'けいざいがくけいざいせいさく' },
      { name: '財務・会計', reading: 'ざいむかいけい' },
      { name: '企業経営理論', reading: 'きぎょうけいえいりろん' },
      { name: '運営管理', reading: 'うんえいかんり' },
      { name: '経営法務', reading: 'けいえいほうむ' },
      { name: '経営情報システム', reading: 'けいえいじょうほうしすてむ' },
      { name: '中小企業経営・中小企業政策', reading: 'ちゅうしょうきぎょうけいえいせいさく' },
    ],
    checkPoints: ['科目合格制度の条件と有効期間', '2次試験の日程', '足切り（科目別の最低点）'],
  },
  {
    id: 'fp',
    name: 'ファイナンシャル・プランニング技能士',
    reading: 'ふぁいなんしゃるぷらんにんぐぎのうし',
    category: 'business',
    body: '日本FP協会／一般社団法人 金融財政事情研究会',
    formats: ['choice', 'practical'],
    traits: ['memory', 'calc', 'case', 'update', 'law'],
    core: '学科は6分野の暗記、実技は計算パターンの反復。実技は受検先で内容が違うので先に決める。',
    pitfall: '学科だけ仕上げて、実技の計算スピードが足りない。',
    subjects: [
      { name: 'ライフプランニングと資金計画', reading: 'らいふぷらんにんぐとしきんけいかく' },
      { name: 'リスク管理', reading: 'りすくかんり' },
      { name: '金融資産運用', reading: 'きんゆうしさんうんよう' },
      { name: 'タックスプランニング', reading: 'たっくすぷらんにんぐ' },
      { name: '不動産', reading: 'ふどうさん' },
      { name: '相続・事業承継', reading: 'そうぞくじぎょうしょうけい' },
    ],
    checkPoints: ['どの実施団体で受けるか（実技の科目が違う）', '税制改正の反映時期', '級と受検資格'],
  },
  {
    id: 'boki',
    name: '日商簿記検定',
    reading: 'にっしょうぼきけんてい',
    category: 'business',
    body: '日本商工会議所',
    formats: ['choice', 'practical'],
    traits: ['calc', 'speed', 'case'],
    core: '読んで理解する時間より、手を動かして解いた回数がそのまま点になる。仕訳を反射で書けるまで回す。',
    pitfall: 'テキストを読み込んで分かった気になり、時間内に解き切れない。',
    subjects: [
      { name: '商業簿記', reading: 'しょうぎょうぼき' },
      { name: '工業簿記', reading: 'こうぎょうぼき' },
      { name: '会計学', reading: 'かいけいがく' },
      { name: '原価計算', reading: 'げんかけいさん' },
    ],
    checkPoints: ['受ける級と、統一試験かネット試験か', '出題区分表の改定'],
  },
  {
    id: 'kihonjouhou',
    name: '基本情報技術者',
    reading: 'きほんじょうほうぎじゅつしゃ',
    category: 'it',
    body: '独立行政法人 情報処理推進機構（IPA）',
    formats: ['choice'],
    traits: ['wide', 'calc', 'case', 'speed'],
    core: '科目Aは過去問の反復で伸びる。科目B（アルゴリズム・セキュリティ）は別物なので早く着手する。',
    pitfall: '用語暗記だけで科目Bに入り、トレースが追えず時間切れになる。',
    subjects: [
      { name: 'テクノロジ系', reading: 'てくのろじけい' },
      { name: 'マネジメント系', reading: 'まねじめんとけい' },
      { name: 'ストラテジ系', reading: 'すとらてじけい' },
      { name: 'アルゴリズムとプログラミング', reading: 'あるごりずむとぷろぐらみんぐ' },
      { name: '情報セキュリティ', reading: 'じょうほうせきゅりてぃ' },
    ],
    checkPoints: ['試験方式（通年のCBTか）', '科目A・科目Bそれぞれの基準点', 'シラバスの版'],
  },
  {
    id: 'ouyoujouhou',
    name: '応用情報技術者',
    reading: 'おうようじょうほうぎじゅつしゃ',
    category: 'it',
    body: '独立行政法人 情報処理推進機構（IPA）',
    formats: ['choice', 'essay'],
    traits: ['wide', 'calc', 'case', 'essay', 'speed'],
    core: '午後は選択する分野を先に決めて、その分野だけ深くやる。全分野に手を出すと午前対策の時間が消える。',
    pitfall: '午後の選択分野を決めないまま直前期に入る。',
    subjects: [
      { name: 'テクノロジ系', reading: 'てくのろじけい' },
      { name: 'マネジメント系', reading: 'まねじめんとけい' },
      { name: 'ストラテジ系', reading: 'すとらてじけい' },
      { name: '午後の選択分野', reading: 'ごごのせんたくぶんや' },
    ],
    checkPoints: ['午後の選択できる分野と選択数', '午前免除の条件'],
  },
  {
    id: 'touroku',
    name: '登録販売者',
    reading: 'とうろくはんばいしゃ',
    category: 'medical',
    body: '各都道府県',
    formats: ['choice'],
    traits: ['memory', 'law', 'update'],
    core: '「主な医薬品とその作用」の暗記量が突出しているので、ここに時間の半分を置く。都道府県ごとに問題が違う。',
    pitfall: '全国共通だと思って、受ける都道府県の過去問を見ないまま進める。',
    subjects: [
      { name: '医薬品に共通する特性と基本的な知識', reading: 'いやくひんにきょうつうするとくせい' },
      { name: '人体の働きと医薬品', reading: 'じんたいのはたらきといやくひん' },
      { name: '主な医薬品とその作用', reading: 'おもないやくひんとそのさよう' },
      { name: '薬事関係法規・制度', reading: 'やくじかんけいほうきせいど' },
      { name: '医薬品の適正使用・安全対策', reading: 'いやくひんのてきせいしよう' },
    ],
    checkPoints: ['受ける都道府県と試験日（都道府県ごとに違う）', '手引きの改訂', '各章の最低正答率'],
  },
  {
    id: 'hoikushi',
    name: '保育士',
    reading: 'ほいくし',
    category: 'medical',
    body: '一般社団法人 全国保育士養成協議会',
    formats: ['choice', 'practical'],
    traits: ['memory', 'wide', 'law', 'practical', 'update'],
    core: '科目ごとに合否が決まり合格科目は持ち越せるので、1回で全部を狙わず回数で割る戦略が取れる。',
    pitfall: '全科目を同時に薄くやって、どれも基準に届かない。',
    subjects: [
      { name: '保育の心理学', reading: 'ほいくのしんりがく' },
      { name: '保育原理', reading: 'ほいくげんり' },
      { name: '子ども家庭福祉', reading: 'こどもかていふくし' },
      { name: '社会福祉', reading: 'しゃかいふくし' },
      { name: '教育原理・社会的養護', reading: 'きょういくげんりとしゃかいてきようご' },
      { name: '子どもの保健', reading: 'こどものほけん' },
      { name: '子どもの食と栄養', reading: 'こどものしょくとえいよう' },
      { name: '保育実習理論', reading: 'ほいくじっしゅうりろん' },
    ],
    checkPoints: ['合格科目の有効期間', '「教育原理」と「社会的養護」の同時合格の条件', '実技試験で選ぶ分野'],
  },
  {
    id: 'kikenbutsu',
    name: '危険物取扱者 乙種第4類',
    reading: 'きけんぶつとりあつかいしゃおつしゅだいよんるい',
    category: 'technical',
    body: '一般財団法人 消防試験研究センター',
    formats: ['choice'],
    traits: ['memory', 'calc'],
    core: '範囲が狭く過去問の反復が最も効く。3科目それぞれに最低基準があるので、物理・化学を捨てられない。',
    pitfall: '法令だけ固めて、物理・化学で基準に届かない。',
    subjects: [
      { name: '危険物に関する法令', reading: 'きけんぶつにかんするほうれい' },
      { name: '基礎的な物理学及び基礎的な化学', reading: 'きそてきなぶつりがくおよびかがく' },
      { name: '危険物の性質並びにその火災予防及び消火の方法', reading: 'きけんぶつのせいしつとしょうかのほうほう' },
    ],
    checkPoints: ['科目ごとの最低正答率', '科目免除の対象か'],
  },
  {
    id: 'denki2',
    name: '第二種電気工事士',
    reading: 'だいにしゅでんきこうじし',
    category: 'technical',
    body: '一般財団法人 電気技術者試験センター',
    formats: ['choice', 'practical'],
    traits: ['memory', 'calc', 'practical'],
    core: '学科は過去問の使い回しが多く反復が効く。技能は候補問題が公表されるので、全問を時間内に完成させる練習をする。',
    pitfall: '学科合格で安心して、技能の工具作業の練習量が足りない。',
    subjects: [
      { name: '電気に関する基礎理論', reading: 'でんきにかんするきそりろん' },
      { name: '配電理論及び配線設計', reading: 'はいでんりろんおよびはいせんせっけい' },
      { name: '電気機器・配線器具・材料及び工具', reading: 'でんきききはいせんきぐざいりょうこうぐ' },
      { name: '電気工事の施工方法', reading: 'でんきこうじのせこうほうほう' },
      { name: '一般用電気工作物の検査方法', reading: 'いっぱんようでんきこうさくぶつのけんさほうほう' },
      { name: '配線図', reading: 'はいせんず' },
      { name: '技能（候補問題）', reading: 'ぎのうこうほもんだい' },
    ],
    checkPoints: ['今年の技能試験の候補問題', '上期・下期どちらで受けるか', '欠陥の判断基準'],
  },
];

export const EXAM_MAP = Object.fromEntries(EXAMS.map((e) => [e.id, e]));

export function examById(id) {
  return EXAM_MAP[id] || null;
}

export function examsByCategory(categoryId) {
  return EXAMS.filter((e) => e.category === categoryId);
}

/** この試験の checkPoints（共通＋個別）。画面はこれをそのまま並べる */
export function checkPointsOf(exam) {
  if (!exam) return [...COMMON_CHECK_POINTS];
  return [...COMMON_CHECK_POINTS, ...(exam.checkPoints || [])];
}

/** 試験の性格を日本語の行にする（勉強法の提案・計画書・設計書で共用） */
export function traitLines(exam) {
  if (!exam) return [];
  return (exam.traits || [])
    .filter((t) => TRAIT_VOCABULARY[t])
    .map((t) => ({ id: t, ...TRAIT_VOCABULARY[t] }));
}

/** 出題形式を日本語の行にする */
export function formatLines(exam) {
  if (!exam) return [];
  return (exam.formats || [])
    .filter((f) => FORMAT_VOCABULARY[f])
    .map((f) => ({ id: f, ...FORMAT_VOCABULARY[f] }));
}
