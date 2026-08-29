// 人間分析 — 気になる相手との「距離の決め方」を見立てる枠。
//
// この枠でいちばん大事な約束:
//   1. **属性で分けない。** 元にした文章は 高齢者／女性／男性 でふるまいを
//      分けていたが、そのまま持ち込むと「女性は◯◯」「年寄りは◯◯」という
//      決めつけの道具になる。分けるのは**ふるまい**だけ。
//      元の文章自身が最後にこう結んでいる——共通するのは性別・年代を問わず3点だと。
//   2. **人を採点しない・順位を付けない・診断名を当てない**（型カタログと同じ線）。
//      出すのは「あなたが実際に見たふるまい」と「そこで取れる距離」だけ。
//   3. **「関わらないほうがいい人」というレッテルを人に貼らない。**
//      決めるのは距離であって、その人がどういう人間かではない。
//   4. **保存しない。** 端末の中に人物の記録を作らない（`lib/analysis.js` 参照）。

/** 元の文章が結論として挙げていた3つの芯 */
export const CORES = [
  {
    id: 'inconsistent',
    label: '一貫性のなさ',
    reading: 'いっかんせいのなさ',
    summary: '言うことがブレる。相手や場面で態度が変わる。',
  },
  {
    id: 'boundary',
    label: '境界線の軽視',
    reading: 'きょうかいせんのけいし',
    summary: 'こちらの都合・気持ち・断りを、無いものとして扱う。',
  },
  {
    id: 'responsibility',
    label: '責任を取らない',
    reading: 'せきにんをとらない',
    summary: '自分の非を認めず、他人や環境のせいにする。',
  },
  {
    id: 'reenact',
    label: '無自覚な再現',
    reading: 'むじかくなさいげん',
    summary: '自分が受けた扱いや教わった価値観を、気づかないまま人に繰り返す。',
  },
];

export const CORE_MAP = Object.fromEntries(CORES.map((c) => [c.id, c]));

/**
 * 場面（どこで起きたか）。
 * 元にした文章は 高齢者／女性／男性／親 で章立てされていたが、
 * そこで実際に書かれていたのは「どこで、どういうふるまいに遭ったか」だった。
 * **誰がやったかではなく、どこで起きるかで分ける。**
 */
export const SCENES = [
  { id: 'work', label: '職場・仕事', reading: 'しょくばしごと' },
  { id: 'home', label: '家庭・親しい人', reading: 'かていしたしいひと' },
  { id: 'street', label: '道・店・近所', reading: 'みちみせきんじょ' },
  { id: 'kids', label: '子ども連れの場', reading: 'こどもづれのば' },
  { id: 'online', label: 'ネット・SNS', reading: 'ねっとえすえぬえす' },
];

export const SCENE_MAP = Object.fromEntries(SCENES.map((s) => [s.id, s]));

/**
 * 自分を守るために使い返してよい型（`counters` に書けるのはこの中だけ）。
 *
 * 線の引き方：**こちらが呑まれないための型だけ**を入れる。
 * 相手の判断をこちらの都合のいい方へ動かす型（借りを作る・レッテルを貼る・
 * 罪悪感で縛る等）は入れない。それは守りではなく、こちらが仕掛ける側に回ること。
 */
export const SELF_DEFENSE_TACTIC_IDS = [
  'silence_pressure',
  'slow_tempo',
  'stare',
  'two_sided',
  'framing',
  'anchoring',
  'presupposition',
  'deadline',
  'false_choice',
  'backtracking',
];

/**
 * **使い返してはいけない型。**
 * やり返すと、相手のふるまいをこちらが再現することになる
 * （4つ目の芯「無自覚な再現」がまさにこれ）。効くか効かないかの話ではなく、
 * 自分が同じものになるかどうかの話なので、ここは動かさない。
 */
export const NEVER_TURN_BACK_IDS = [
  'gaslight',
  'person_attack',
  'blame_shift',
  'isolate',
  'guilt',
  'silence',
  'intermittent',
  'fear_relief',
  'safe_base',
  'secret',
  'loaded_choice',
  'pity_question',
];

export const PERSON_TYPES = [
  {
        counters: [
      { tacticId: 'backtracking', how: '言われた条件を、その場で同じ言葉にして返す。相手の口から二度言わせると、あとで話が変わりにくい。' },
      { tacticId: 'deadline', how: 'こちらから「いつまでに文字で」と期限を切る。口約束のまま置かない。' },
      { tacticId: 'anchoring', how: '金額や範囲を先に自分から出して、あとから動かす余地を減らす。' },
    ],
id: 'unstable_words',
    name: '言うことが変わる',
    reading: 'いうことがかわる',
    scenes: ['work', 'home', 'street', 'online'],
    cores: ['inconsistent'],
    summary: '前に言ったことと違うことを、悪びれずに言う。約束が残らない。',
    why:
      '言うことが変わる相手とは、こちらが何を準備しても無駄になる。準備が無駄になった側が「聞き間違いだったかも」と自分を疑い始めると、確かめる基準まで相手に預けることになる。',
    behaviors: [
      '前に決めたことが、次に会うと別の話になっている',
      '約束の期日や金額が、そのつど違う',
      '話を大きく盛る。あとで確かめると事実と食い違う',
      '言った・言わないの話に必ずなる',
      '約束の当日に、理由をつけて取りやめになることが繰り返される',
      '同じ話を、別の相手にも同じように話している',
    ],
    distance:
      '口約束で進めない。決めたことをその場で文字にして相手にも渡す。渡せない相手なら、その相手とは決めごとをしない。',
    replyIds: ['record', 'takeout', 'pause'],
    relatedTacticIds: ['gaslight', 'consistency', 'lowball'],
  },
  {
        counters: [
      { tacticId: 'stare', how: '態度が変わった瞬間に、目を逸らさない。気づいていることが伝わるだけでよく、言葉にしなくていい。' },
      { tacticId: 'backtracking', how: '陰で言われたことを、本人の前で同じ言葉のまま確かめる。' },
      { tacticId: 'slow_tempo', how: '相手の勢いに合わせて早口にならない。速さを合わせた側が呑まれる。' },
    ],
id: 'two_faced',
    name: '相手によって態度を変える',
    reading: 'あいてによってたいどをかえる',
    scenes: ['work', 'home', 'street', 'online'],
    cores: ['inconsistent'],
    summary: '立場の弱い相手には強く、強い相手には低く出る。本人の前と陰とで話が違う。',
    why:
      'こちらへの態度は、その人の人柄ではなく、こちらの立場に対して選ばれたもの。立場が変われば態度も変わるので、いま優しくても安心の材料にはならない。',
    behaviors: [
      '店員・後輩・下請けにだけ、口調が変わる',
      '本人がいる時といない時で、その人の評価が正反対になる',
      '陰口を、聞こえる場所でわざと言う',
      '「誰が言ったかは言えないけど」と出どころを濁して伝えてくる',
      '気に入らない人を、集団から静かに外していく',
      '自分には甘く、同じことを人がすると厳しい',
      '立場が上の人の前でだけ、急に丁寧になる',
      '直接は言わず、嫌味や当てこすりの形で伝えてくる',
    ],
    distance:
      'その人が自分より弱い立場の人にどう接するかを見る。そこが本当の態度。こちらに向けられている好意を、判断の材料にしない。',
    replyIds: ['third', 'record', 'pause'],
    relatedTacticIds: ['windsor', 'triangulate', 'isolate'],
  },
  {
        counters: [
      { tacticId: 'slow_tempo', how: '機嫌に合わせて自分の動く速さを変えない。合わせた時点で、機嫌が道具として効いてしまう。' },
      { tacticId: 'silence_pressure', how: '察して沈黙を埋めない。黙って待つ。' },
      { tacticId: 'presupposition', how: '「この話はここまで」と決まったこととして置いて離れる。' },
    ],
id: 'mood_rules',
    name: '機嫌で場を動かす',
    reading: 'きげんでばをうごかす',
    scenes: ['work', 'home', 'street'],
    cores: ['inconsistent', 'boundary'],
    summary: '不機嫌・ため息・沈黙で、言葉を使わずに周りを動かす。',
    why:
      '機嫌が道具になると、周りは先回りして機嫌を取るようになる。何が悪かったのか言われないので、こちらが推し量って謝るしかなくなり、推し量るほどその形は強くなる。',
    behaviors: [
      '話が通じる日と、まったく通じない日の差が大きい',
      '不機嫌の理由を聞いても答えず、察することを求められる',
      '物に当たる。音を立てる。ドアを強く閉める',
      'その人の機嫌を、周りが確かめてから話しかけている',
      '自分の不満と関係のない相手に、八つ当たりしている',
    ],
    distance:
      '機嫌は相手のもので、こちらが預かるものではない。察して先回りするのをやめ、言葉で言われたことにだけ答える。',
    replyIds: ['leave', 'record', 'third'],
    relatedTacticIds: ['silence', 'blame_shift', 'intermittent'],
  },
  {
        counters: [
      { tacticId: 'presupposition', how: '断りを交渉ごとにしない。「しません」を、決まったこととして置く。' },
      { tacticId: 'silence_pressure', how: '押し返された時にすぐ答えない。同じ言葉を、間を置いて繰り返す。' },
      { tacticId: 'deadline', how: '「今日は決めません」と自分の側から区切る。' },
    ],
id: 'crosses_line',
    name: '「やめて」が効かない',
    reading: 'やめてがきかない',
    scenes: ['work', 'home', 'street', 'kids', 'online'],
    cores: ['boundary'],
    summary: '断っても引き下がらない。小さな違反を繰り返して、こちらの反応を試す。',
    why:
      '一度で引く相手なら、そもそも困っていない。効かないのは伝え方が悪いからではなく、聞く気がないから。小さな越境は、どこまで通るかを測るために繰り返される。',
    behaviors: [
      '断ったのに、言い方を変えて何度も来る',
      '「冗談だよ」で越えたことを無かったことにする',
      'こちらの予定や都合を確かめずに決めてくる',
      '小さな約束破りが、少しずつ大きくなっている',
      '一度絡まれると引き際がなく、長く続く',
    ],
    distance:
      '理由を足さない。同じ言葉で短く繰り返す。それでも続くなら、話し合いではなく、会う回数と場面を減らす。',
    replyIds: ['no_reason', 'record', 'leave'],
    relatedTacticIds: ['foot_in_door', 'just_joking', 'presupposition'],
  },
  {
        counters: [
      { tacticId: 'framing', how: '答える範囲を自分で決めて、その枠の中だけで答える。嘘をつく必要はない。' },
      { tacticId: 'silence_pressure', how: 'すぐ答えない。間があくと、相手のほうが話題を変えることが多い。' },
      { tacticId: 'slow_tempo', how: '質問の速さに巻き込まれない。一つずつ、ゆっくり返す。' },
    ],
id: 'pries',
    name: '踏み込んで聞いてくる',
    reading: 'ふみこんできいてくる',
    scenes: ['work', 'home', 'street', 'online'],
    cores: ['boundary'],
    summary: '収入・家族・体・過去に、断りきれない形で入ってくる。',
    why:
      '答えたくないことに答えないと、こちらが隠しごとをしているように見える形になっている。答えても答えなくても不利になる聞き方は、知りたいのではなく、こちらを動かすための聞き方であることがある。',
    behaviors: [
      '答えたくない話題に、何度も戻ってくる',
      '答えないと「水くさい」「隠すようなことなの」と言われる',
      '聞き出したことを、別の人に話している',
      'こちらの話は聞きたがるのに、自分のことは話さない',
      '聞き出したことが、いつのまにか周りに広まっている',
    ],
    distance:
      '「その話はしません」で足りる。理由を言うと理由を崩しにこられる。話したことが誰に伝わったかを一度確かめる。',
    replyIds: ['vague', 'ask_back', 'no_reason', 'record', 'third'],
    relatedTacticIds: ['secret', 'pratfall', 'favor'],
  },
  {
        counters: [
      { tacticId: 'deadline', how: '「相談してから決めます」と、自分の側に時間を確保する。' },
      { tacticId: 'anchoring', how: '会う頻度やお金の範囲を、こちらから先に線として出す。' },
      { tacticId: 'two_sided', how: '外の人と会う話は、都合の悪い点も自分から添えて先に出す。反対の材料を先に使い切る。' },
    ],
id: 'controls',
    name: '決めさせない・囲い込む',
    reading: 'きめさせないかこいこむ',
    scenes: ['home', 'work'],
    cores: ['boundary'],
    summary: '予定・付き合い・お金を細かく確かめ、こちらが決める範囲を狭めていく。',
    why:
      '一つひとつは心配や気づかいの形をしている。狭められていることに気づくのは、外の人と会おうとした時や、やめようとした時だけ。',
    behaviors: [
      '誰と会うか、いちいち確認される',
      'こちらの家族や友人の悪い話が、繰り返し出てくる',
      'お金や持ち物を、その人を通さないと動かせなくなっている',
      '知られたくないことを握られていて、それが時々ほのめかされる',
    ],
    distance:
      'この人以外に話せる相手を、いま一人つくる。判断が正しいかではなく、相談先が一つしかない状態そのものを崩す。',
    replyIds: ['third', 'window', 'record'],
    relatedTacticIds: ['isolate', 'safe_base', 'secret'],
  },
  {
        counters: [
      { tacticId: 'backtracking', how: '決まったことを、その場で言葉にして返して残す。あとで「そうは言っていない」を成り立たなくする。' },
      { tacticId: 'two_sided', how: 'こちらの案の弱いところを先に自分で言い、崩す材料を渡さない。' },
      { tacticId: 'anchoring', how: '謝罪ではなく「次はどうするか」の基準を先に置く。' },
    ],
id: 'never_wrong',
    name: '非を認めない',
    reading: 'ひをみとめない',
    scenes: ['work', 'home', 'street', 'kids'],
    cores: ['responsibility'],
    summary: '謝らない。謝っても、その場だけで何も変わらない。',
    why:
      '直らないものを直そうとすると、こちらの時間だけが減っていく。変わるかどうかは言葉ではなく、次に同じことが起きるかどうかでしか分からない。',
    behaviors: [
      '注意された時だけ低姿勢で、そのあと元に戻る',
      '謝罪が「そう受け取ったなら悪かった」の形になっている',
      '指摘すると、こちらの過去の落ち度が返ってくる',
      '同じことが、同じ形で繰り返されている',
      '恥をかかされたと感じると、話の中身より怒りが前に出る',
      '指摘されると、自分がそういう人間だと認められず話をなかったことにする',
    ],
    distance:
      '言葉で判断しない。同じことが次に起きるかどうかだけを見る。二回目からは、期待ではなく段取りで対処する。',
    replyIds: ['record', 'takeout', 'third'],
    relatedTacticIds: ['blame_shift', 'person_attack', 'peak_end'],
  },
  {
        counters: [
      { tacticId: 'false_choice', how: '気持ちの話に移る前に、選べる二つを出して、起きたことの話に戻す。' },
      { tacticId: 'slow_tempo', how: '泣かれても責められても、話す速さを変えない。' },
      { tacticId: 'presupposition', how: '「この件はこう進めます」と置く。責める話にしないほうが、話が終わる。' },
    ],
id: 'victim',
    name: 'すぐ被害者の側に回る',
    reading: 'すぐひがいしゃのがわにまわる',
    scenes: ['work', 'home', 'kids'],
    cores: ['responsibility'],
    summary: '困りごとを伝えると、いつのまにかこちらが加害者の側にされている。',
    why:
      '話題が「起きたこと」から「傷ついた人がいる」に移ると、元の問題は誰も扱わなくなる。扱われないまま、こちらだけが謝って終わる。',
    behaviors: [
      '指摘すると、泣く・体調が悪くなる・黙り込む',
      '第三者や子どもを持ち出して、話の向きが変わる',
      '「そんなつもりじゃなかった」で、起きたことの話が終わる',
      'あとから周りに、こちらが責めたという形で伝わっている',
    ],
    distance:
      '起きたことと、気持ちの話を分ける。分けられない相手とは、その場で解決しようとせず、記録して日を改める。',
    replyIds: ['record', 'third', 'pause'],
    relatedTacticIds: ['blame_shift', 'guilt', 'pity_question'],
  },
  {
        counters: [
      { tacticId: 'anchoring', how: '引き受ける範囲を、頼まれる前に自分から数字で出しておく。' },
      { tacticId: 'deadline', how: '「今週ぶんだけ」と、引き受ける時に終わりを一緒に言う。' },
      { tacticId: 'false_choice', how: '全部か無しかにしない。こちらが出せる二つを示して、その中から選ばせる。' },
    ],
id: 'takes_only',
    name: 'もらって当然・人任せ',
    reading: 'もらってとうぜんひとまかせ',
    scenes: ['work', 'home', 'kids'],
    cores: ['responsibility', 'boundary'],
    summary: '好意を権利のように扱う。面倒なところだけが、いつもこちらに回ってくる。',
    why:
      '感謝が返らないこと自体より、返らないまま量が増えていくことが問題になる。断らない人は「優しい人」ではなく「頼めばやってくれる人」として扱われていく。',
    behaviors: [
      'してもらったことに、礼が返ってこない',
      '貸したお金や時間が、そのままになっている',
      '面倒な部分だけが、決まってこちらに回ってくる',
      '相談の形をしていない（「やっておいて」から始まる）',
      '自分に得がある時だけ、急に連絡が増える',
    ],
    distance:
      '引き受ける時に、範囲と終わりを一緒に言う。貸すのは、返ってこなくても関係が壊れない額まで。',
    replyIds: ['no_reason', 'takeout', 'pause'],
    relatedTacticIds: ['reciprocity', 'needed', 'labeling'],
  },
  {
        counters: [
      { tacticId: 'presupposition', how: '注意役を引き受けず、「そちらにお伝えします」と決まったこととして動く。' },
      { tacticId: 'deadline', how: 'いつまでに止まらなければ誰に伝えるかを、先に自分の中で決めておく。' },
      { tacticId: 'anchoring', how: '何が困っているかを、感想ではなく具体（回数・時間・場所）で先に出す。' },
    ],
id: 'looks_away',
    name: '見て見ぬふりをする',
    reading: 'みてみぬふりをする',
    scenes: ['kids', 'work', 'street'],
    cores: ['responsibility'],
    summary: '目の前で起きていることに気づいていながら止めない。指摘した側が悪者になる。',
    why:
      '止めないことは、その場では何もしていないように見える。だから責任を問いにくく、実害が出てから「知らなかった」で済ませられる。困っている側だけが、指摘するかどうかの重荷を負わされる。',
    behaviors: [
      '迷惑になっていることに気づいているのに、注意しない',
      '他人が代わりに注意すると、注意したほうに怒る',
      '実害が出ているのに、それでも止めない',
      '「まだ小さいから」「悪気はないから」を、何年も同じように使い続ける',
      '注意やしつけを「型にはめること」と言って避ける',
      'その場では低姿勢に謝るが、次も同じことが起きる',
    ],
    distance:
      'その場で相手を変えようとしない。店員・管理者・主催者など、その場を預かっている人に伝える。注意役を自分で引き受けない。',
    replyIds: ['leave', 'record', 'window'],
    relatedTacticIds: ['blame_shift', 'just_joking', 'guilt'],
  },
  {
        counters: [
      { tacticId: 'backtracking', how: '口頭で決まったことを言葉にして返し、記録の残る形に移す。' },
      { tacticId: 'framing', how: '「気に入られているか」ではなく「決まりごとはどうなっているか」の枠で話す。' },
      { tacticId: 'two_sided', how: '自分の案の弱点を先に言って、外す口実を減らす。' },
    ],
id: 'favoritism',
    name: 'えこひいきする・派閥をつくる',
    reading: 'えこひいきするはばつをつくる',
    scenes: ['work', 'kids', 'street'],
    cores: ['inconsistent'],
    summary: '気に入った相手にだけ優しく、そうでない相手には情報も機会も回さない。',
    why:
      '同じことをしても評価が違うので、こちらは仕事の中身ではなく、気に入られているかどうかを気にするようになる。誰も口に出さないので、気のせいだと言われれば終わってしまう。',
    behaviors: [
      '同じ内容でも、誰が言ったかで通り方が変わる',
      '決まったことが、自分だけ後から知らされる',
      'お気に入りの相手にだけ、口調も表情もはっきり違う',
      '外された理由を聞いても、はっきりした答えが返らない',
    ],
    distance:
      '気に入られようとする方向に力を使わない。決まったことは記録に残る形で受け取り、口頭で済まされたら自分から文字にして確認する。',
    replyIds: ['record', 'takeout', 'third'],
    relatedTacticIds: ['isolate', 'favor', 'triangulate'],
  },
  {
        counters: [
      { tacticId: 'anchoring', how: '決めてよい範囲を、始める前に数字と線で出す。' },
      { tacticId: 'deadline', how: '口を出せる締め切りを先に決める（この日以降は変えません、と置く）。' },
      { tacticId: 'backtracking', how: '途中の変更指示をそのまま言葉にして返し、いつ誰が言ったかを残す。' },
    ],
id: 'micromanages',
    name: '任せた後から口を出す',
    reading: 'まかせたあとからくちをだす',
    scenes: ['work', 'home'],
    cores: ['boundary'],
    summary: '任せたと言いながら、細かいところまで確かめ、途中でやり方を変えさせる。',
    why:
      '任された側は、決めてよい範囲が分からないまま責任だけを持つことになる。うまくいけば任せた人の手柄、失敗すればやった人の責任、という形になりやすい。',
    behaviors: [
      '任せると言われたのに、進め方を一つずつ確認される',
      '途中で方針が変わり、それまでの作業が無駄になる',
      '報告の回数や形式が、仕事の中身より重く扱われる',
      'どこまで自分で決めてよいかを聞いても、はっきりしない',
    ],
    distance:
      '決めてよい範囲を先に、文字にして確かめる。それが出てこない仕事は、引き受ける量のほうを減らす。',
    replyIds: ['takeout', 'pause', 'record'],
    relatedTacticIds: ['presupposition', 'needed', 'consistency'],
  },
  {
        counters: [
      { tacticId: 'presupposition', how: '気持ちの話をせず「これはやめてください」を、決まったこととして置く。' },
      { tacticId: 'silence_pressure', how: '「そんなつもりは」と言われても、すぐ引き取らない。' },
      { tacticId: 'backtracking', how: '言われた言い訳をそのまま返す。こちらが折れて終わる形にしない。' },
    ],
id: 'unaware',
    name: '悪気がないので止まらない',
    reading: 'わるぎがないのでとまらない',
    scenes: ['work', 'street', 'kids', 'home'],
    cores: ['reenact', 'boundary'],
    summary: '本人は指導や親切のつもりでいるので、嫌がられていることに気づかず続く。',
    why:
      '悪意がないぶん、言っても伝わりにくい。伝えると「そんなつもりはなかった」で話が終わり、こちらが気にしすぎたことにされる。悪気の有無は、受けている側の負担とは関係がない。',
    behaviors: [
      'こちらが困っているのに、良かれと思ってやっている様子がある',
      '伝えても「そんなつもりはなかった」で終わり、次も同じことが起きる',
      '自分が昔されたことを、同じ形で人にしている',
      '周りも「悪い人ではないから」と言って、誰も止めない',
    ],
    distance:
      '気持ちの話をしない。やめてほしい行為だけを一つ、短く伝える。それでも続くなら、伝わらない相手として扱いを変える（その場を預かっている人に伝える・回数を減らす）。',
    replyIds: ['record', 'third', 'window'],
    relatedTacticIds: ['just_joking', 'blame_shift', 'labeling'],
  },
  {
        counters: [
      { tacticId: 'framing', how: '正しさの話に乗らず「うちはこうしています」の枠に置き換える。' },
      { tacticId: 'silence_pressure', how: '勧められても、すぐ賛成も反対もしない。' },
      { tacticId: 'slow_tempo', how: '勢いに合わせない。合わせるほど、断る所がなくなる。' },
    ],
id: 'one_right_way',
    name: '自分のやり方だけが正しいとする',
    reading: 'じぶんのやりかただけがただしいとする',
    scenes: ['home', 'work', 'street', 'kids'],
    cores: ['boundary', 'reenact'],
    summary: '暮らし方や進め方に唯一の正解があるものとして、繰り返し勧めてくる。',
    why:
      '本人にとっては助言なので、断られると否定されたように受け取る。だからこちらは、断るたびに相手をなだめる手間まで背負うことになる。',
    behaviors: [
      '「普通は」「ちゃんとした人は」で始まる話が多い',
      'こちらのやり方を聞く前に、直すところの話になる',
      '一度断っても、形を変えてまた勧められる',
      '本人が後悔していることを、こちらの選択に重ねて話してくる',
    ],
    distance:
      '合わせない。「うちはこうしています」で終わらせ、理由も反論も足さない。会う場所と回数のほうを調整する。',
    replyIds: ['vague', 'no_reason', 'pause'],
    relatedTacticIds: ['social_proof', 'labeling', 'consistency'],
  },
  {
        counters: [
      { tacticId: 'deadline', how: '会う前に終わりの時刻を決めて、先に伝えておく。' },
      { tacticId: 'false_choice', how: '話題を二つ出して、悪口以外のほうへ振り替える。' },
      { tacticId: 'slow_tempo', how: '巻き込まれて同じ速さで話さない。' },
    ],
id: 'drains',
    name: '一緒にいると削られる',
    reading: 'いっしょにいるとけずられる',
    scenes: ['work', 'home', 'street', 'online'],
    cores: [],
    summary: '否定・比較・説教・蒸し返しが続き、会ったあとに疲れが残る。',
    why:
      'ひとつずつは責めるほどのことではない。だから理由を説明しにくく、離れることに引け目を感じてしまう。それでも、会ったあとに残るものは、いちばん確かな材料になる。',
    behaviors: [
      '話がだいたい、誰かの悪口か愚痴で終わる',
      '何かを始めようとすると、まず難点から言われる',
      '持ち物・家族・境遇を、さりげなく比べられる',
      '終わったはずの失敗を、何度も持ち出される',
      'こちらを世代や立場でひとくくりにして、説教が始まる',
      '昔のやり方を、いまの状況に関係なく押し付けてくる',
      '「私のほうが大変」で、こちらの話が相手の苦労話に変わる',
      '人の評価が、噂と比べ合いだけでできている',
      '「自分の若い頃は」で始まる話が、指導の形をとって繰り返される',
    ],
    distance:
      '会う回数と長さを先に決めてから会う。理由を説明できなくてよい。会ったあとに残るもので決めてよい。',
    replyIds: ['leave', 'pause', 'third'],
    relatedTacticIds: ['triangulate', 'person_attack', 'social_proof'],
  },
];

export const PERSON_TYPE_MAP = Object.fromEntries(PERSON_TYPES.map((t) => [t.id, t]));

/** ふるまいの全一覧（画面のチェック項目。型ごとの id を付けて返す） */
export function allBehaviors() {
  const out = [];
  for (const t of PERSON_TYPES) {
    t.behaviors.forEach((text, i) => {
      out.push({ id: `${t.id}:${i}`, typeId: t.id, text });
    });
  }
  return out;
}
