import type { Item } from "./types";

// ============================================================
// 詳細項目データ
// カテゴリごとに 1〜2 件のサンプルを入れています。
// ここに追記していくのが基本の使い方です（README 参照）。
//
// ※ ここに書かれている内容は「入れ物」を示すサンプルです。
//   実際の業務内容・社内ルールは店舗や研修の資料に従ってください。
// ============================================================
export const items: Item[] = [
  // ---------- 出勤・退勤の流れ ----------
  {
    id: "attendance-clock-in",
    categorySlug: "attendance",
    title: "出勤時の流れ",
    summary: "入店から施術開始までの準備手順",
    body: "出勤したら、まず身だしなみを整えてタイムカードを打刻します。朝礼で当日の予約状況と連絡事項を確認します。",
    steps: [
      { text: "入店したらスタッフに挨拶し、私物をロッカーへ" },
      { text: "ユニフォームに着替え、身だしなみをチェック", note: "爪・髪・匂いを確認" },
      { text: "タイムカードを打刻する", note: "打刻漏れに注意" },
      { text: "朝礼で予約状況・連絡事項を確認" },
      { text: "担当エリアの清掃・ベッドメイクを済ませる" },
    ],
    warnings: [
      { level: "warning", text: "打刻忘れは給与計算に影響します。忘れたら必ず店長へ報告。" },
    ],
    related: ["attendance-clock-out", "store-rules-appearance"],
    tags: ["出勤", "打刻", "朝礼", "着替え"],
  },
  {
    id: "attendance-clock-out",
    categorySlug: "attendance",
    title: "退勤時の流れ",
    summary: "片付けから退勤処理まで",
    steps: [
      { text: "担当ベッド周りを片付け、タオルを回収" },
      { text: "翌日の分の補充・準備を確認" },
      { text: "退勤の打刻をする" },
      { text: "戸締り・消灯（最終スタッフの場合）", note: "当番表を確認" },
    ],
    related: ["attendance-clock-in", "supplies-towel"],
    tags: ["退勤", "打刻", "片付け", "戸締り"],
  },

  // ---------- 接客の流れ ----------
  {
    id: "service-welcome",
    categorySlug: "service-flow",
    title: "お出迎え〜ヒアリング",
    summary: "来店からコース確認までの接客",
    body: "笑顔でお出迎えし、コースと気になる部位を確認します。初回のお客様はカルテ記入をご案内します。",
    steps: [
      { text: "「いらっしゃいませ」と笑顔でお出迎え" },
      { text: "予約名・コース・時間を確認" },
      { text: "初回のお客様にはカルテ記入をご案内" },
      { text: "気になる部位・体調・圧の好みをヒアリング", note: "強め/弱めを必ず確認" },
      { text: "施術ベッドへご案内し、うつ伏せ／仰向けをご説明" },
    ],
    warnings: [
      { level: "warning", text: "体調・既往歴のヒアリングは省略しない。禁忌に該当しないか必ず確認。" },
    ],
    related: ["service-closing", "contraindications-avoid", "treatment-basic-prone"],
    tags: ["接客", "お出迎え", "ヒアリング", "カルテ"],
  },
  {
    id: "service-closing",
    categorySlug: "service-flow",
    title: "施術後の説明〜お見送り・会計",
    summary: "施術後のフォローと会計・見送り",
    steps: [
      { text: "施術後、ゆっくり起き上がっていただく" },
      { text: "本日ほぐした部位・自宅でのケアを一言お伝えする" },
      { text: "お会計（コース料金＋オプション＋指名料）" },
      { text: "次回のご来店・お身体の変化を案内" },
      { text: "「ありがとうございました」とお見送り" },
    ],
    related: ["service-welcome", "qa-extension"],
    tags: ["会計", "お見送り", "アフター説明"],
  },

  // ---------- 施術手順 ----------
  {
    id: "treatment-basic-prone",
    categorySlug: "treatment",
    title: "うつ伏せの基本ルーティン",
    summary: "背中〜脚の基本的な流れ",
    body: "うつ伏せでは背中から下半身に向けて全身をほぐしていきます。まず軽い圧で体をならしてから、こりの強い部位を重点的に。",
    steps: [
      { text: "肩・首まわりを軽圧でならす" },
      { text: "背中（脊柱起立筋）を上から下へ" },
      { text: "腰・臀部をほぐす", note: "妊娠中・腰痛は圧に注意" },
      { text: "太もも裏〜ふくらはぎ" },
      { text: "足裏で仕上げ、仰向けへ移行" },
    ],
    warnings: [
      { level: "warning", text: "骨の上（背骨・肩甲骨の縁）は強圧を避ける。" },
    ],
    related: ["treatment-time-allocation", "contraindications-pressure"],
    tags: ["施術", "うつ伏せ", "背中", "ルーティン"],
  },
  {
    id: "treatment-time-allocation",
    categorySlug: "treatment",
    title: "コース別の時間配分",
    summary: "60分／90分／120分の組み立て目安",
    body: "コース時間に応じて部位ごとの配分を決めます。お客様の希望部位を優先しつつ、全身のバランスを取ります。",
    steps: [
      { text: "60分：全身をひと通り＋希望部位を重点" },
      { text: "90分：全身＋2部位を重点的に" },
      { text: "120分：全身をじっくり＋オプション提案も" },
    ],
    warnings: [
      { level: "warning", text: "終了時刻の5分前を目安に仕上げへ入る。延長は事前確認。" },
    ],
    related: ["treatment-basic-prone", "qa-extension"],
    tags: ["時間配分", "コース", "60分", "90分", "120分"],
  },

  // ---------- オプションメニュー ----------
  {
    id: "options-footcare",
    categorySlug: "options",
    title: "足つぼ",
    summary: "足裏の反射区を刺激するオプション",
    body: "足裏の反射区を程よい圧で刺激します。むくみ・疲れが気になるお客様への提案タイミングは、ヒアリング時か脚の施術中です。",
    steps: [
      { text: "足裏全体をならす" },
      { text: "反射区を順に刺激", note: "痛がる箇所は圧を調整" },
      { text: "アキレス腱・足首まわりをほぐして仕上げ" },
    ],
    warnings: [
      { level: "warning", text: "強い痛みや腫れがある場合は無理に刺激しない。" },
    ],
    related: ["options-headspa"],
    tags: ["オプション", "足つぼ", "反射区", "むくみ"],
  },
  {
    id: "options-headspa",
    categorySlug: "options",
    title: "ヘッドスパ",
    summary: "頭部・首肩の疲れにおすすめ",
    steps: [
      { text: "後頭部・側頭部を指圧でほぐす" },
      { text: "頭頂部〜生え際を刺激" },
      { text: "首・肩とつなげてリラックスへ導く" },
    ],
    related: ["options-footcare"],
    tags: ["オプション", "ヘッドスパ", "頭", "眼精疲労"],
  },

  // ---------- 禁忌・注意事項 ----------
  {
    id: "contraindications-avoid",
    categorySlug: "contraindications",
    title: "施術を控えるべき症状",
    summary: "この症状は施術NG／要相談",
    body: "以下に該当する場合は施術をお断りするか、店長・医師の判断を仰ぎます。無理な施術は絶対にしないでください。",
    warnings: [
      { level: "danger", text: "発熱・強い炎症・感染症の疑いがあるとき" },
      { level: "danger", text: "骨折・打撲・捻挫など急性の外傷部位" },
      { level: "danger", text: "飲酒直後・体調が著しく悪いとき" },
      { level: "warning", text: "血圧・心臓・持病に不安がある方は事前に確認する" },
    ],
    related: ["contraindications-pregnancy", "contraindications-pressure"],
    tags: ["禁忌", "注意", "発熱", "外傷", "感染症"],
  },
  {
    id: "contraindications-pregnancy",
    categorySlug: "contraindications",
    title: "妊娠中の対応",
    summary: "妊娠中のお客様への配慮",
    body: "妊娠中のお客様は、体調と時期を必ず確認します。店舗の方針に従い、対応可否とうつ伏せの可否を判断してください。",
    warnings: [
      { level: "danger", text: "腹部・腰の強い刺激、特定のツボへの強圧は避ける。" },
      { level: "warning", text: "うつ伏せが難しい場合は横向き中心で対応。" },
    ],
    related: ["contraindications-avoid"],
    tags: ["禁忌", "妊娠", "マタニティ", "横向き"],
  },
  {
    id: "contraindications-pressure",
    categorySlug: "contraindications",
    title: "圧の強さの確認方法",
    summary: "「痛気持ちいい」を基準に",
    body: "圧はお客様に必ず確認します。「痛気持ちいい」を目安に、我慢していないか施術中も声かけを続けます。",
    steps: [
      { text: "施術前に強め／弱めの好みを聞く" },
      { text: "最初の部位で「強さはいかがですか」と確認" },
      { text: "反応を見ながら微調整、我慢の様子があれば弱める" },
    ],
    related: ["contraindications-avoid", "treatment-basic-prone"],
    tags: ["圧", "強さ", "確認", "声かけ"],
  },

  // ---------- お客様対応Q&A ----------
  {
    id: "qa-extension",
    categorySlug: "qa",
    title: "延長のご提案トーク",
    summary: "自然な延長提案の言い回し",
    body: "残り時間が少なくなってきた頃、まだこりが残る部位があれば延長を提案します。押し売りにならないよう、お客様の状態を主語に。",
    steps: [
      { text: "残り10分前後で「肩、まだ張りが強いですね」と状態を共有" },
      { text: "「もう少しほぐすと楽になりそうですが、延長いかがですか？」" },
      { text: "断られたら無理に勧めず、自宅ケアを案内" },
    ],
    warnings: [
      { level: "warning", text: "強引な勧誘はクレームの元。あくまで提案にとどめる。" },
    ],
    related: ["qa-complaint", "treatment-time-allocation"],
    tags: ["Q&A", "延長", "トーク", "提案"],
  },
  {
    id: "qa-complaint",
    categorySlug: "qa",
    title: "「痛い／効いていない」への対応",
    summary: "施術中の要望・不満への返し方",
    steps: [
      { text: "まず謝意と共感（「失礼しました、すぐ調整しますね」）" },
      { text: "圧・部位をその場で調整" },
      { text: "対応が難しい場合は店長に相談" },
    ],
    related: ["qa-extension", "contraindications-pressure"],
    tags: ["Q&A", "クレーム", "痛い", "対応"],
  },

  // ---------- 店舗ルール ----------
  {
    id: "store-rules-appearance",
    categorySlug: "store-rules",
    title: "身だしなみ",
    summary: "清潔感を第一に",
    body: "お客様と至近距離で接するため、清潔感が最優先です。爪・髪・匂いに特に気を配ります。",
    steps: [
      { text: "爪は短く整える（施術で当たらない長さ）" },
      { text: "髪はまとめ、顔にかからないように" },
      { text: "香水・体臭・口臭に注意", note: "食事後は特に" },
      { text: "ユニフォームは清潔なものを着用" },
    ],
    warnings: [
      { level: "warning", text: "アクセサリーは施術の妨げ・お客様を傷つける恐れがあるため外す。" },
    ],
    related: ["store-rules-absence", "attendance-clock-in"],
    tags: ["身だしなみ", "清潔", "爪", "髪", "匂い"],
  },
  {
    id: "store-rules-absence",
    categorySlug: "store-rules",
    title: "遅刻・欠勤の連絡手順",
    summary: "早めの連絡が原則",
    steps: [
      { text: "遅刻・欠勤が分かった時点ですぐ店舗へ電話連絡" },
      { text: "予約が入っている場合は特に早く伝える" },
      { text: "メールやチャットだけで済ませない", note: "電話が基本" },
    ],
    warnings: [
      { level: "danger", text: "無断欠勤は厳禁。どんな事情でも必ず連絡する。" },
    ],
    related: ["store-rules-appearance", "payroll-shift"],
    tags: ["遅刻", "欠勤", "連絡", "電話"],
  },

  // ---------- 備品・清掃 ----------
  {
    id: "supplies-towel",
    categorySlug: "supplies",
    title: "タオル交換・ベッドメイク",
    summary: "お客様ごとに清潔なタオルへ",
    steps: [
      { text: "お客様が替わるごとにタオル・シーツを交換" },
      { text: "使用済みは所定の回収カゴへ" },
      { text: "枕・フェイスカバーを整える" },
      { text: "ベッドの高さ・シワを確認" },
    ],
    warnings: [
      { level: "warning", text: "使い回しは厳禁。1名ごとに必ず清潔なものへ。" },
    ],
    related: ["supplies-restock", "attendance-clock-out"],
    tags: ["タオル", "ベッドメイク", "清掃", "シーツ"],
  },
  {
    id: "supplies-restock",
    categorySlug: "supplies",
    title: "消耗品の補充基準",
    summary: "残りわずかになったら補充",
    body: "消耗品は在庫場所を把握し、少なくなったら早めに補充・報告します。",
    steps: [
      { text: "残り2〜3個になったら補充する" },
      { text: "在庫が切れそうなら店長へ報告" },
      { text: "補充した分は在庫リストに反映（店舗運用に従う）" },
    ],
    related: ["supplies-towel"],
    tags: ["消耗品", "補充", "在庫", "備品"],
  },

  // ---------- 給与・シフト ----------
  {
    id: "payroll-commission",
    categorySlug: "payroll",
    title: "歩合・指名料の仕組み",
    summary: "報酬の基本的な考え方",
    body: "報酬は施術時間に応じた歩合が基本です。指名が入ると指名料が加算されます。詳細な料率は店舗の契約内容に従ってください。",
    warnings: [
      { level: "warning", text: "具体的な金額・料率は店舗・契約により異なります。研修資料で必ず確認。" },
    ],
    related: ["payroll-shift"],
    tags: ["給与", "歩合", "指名料", "報酬"],
  },
  {
    id: "payroll-shift",
    categorySlug: "payroll",
    title: "シフト提出締切・有給",
    summary: "シフト申請のルール",
    steps: [
      { text: "シフトは締切までに提出（店舗指定の方法で）" },
      { text: "希望休は早めに申請" },
      { text: "有給の取得方法は店長に確認" },
    ],
    related: ["payroll-commission", "store-rules-absence"],
    tags: ["シフト", "締切", "有給", "申請"],
  },
];

/** id から項目を引く */
export function getItem(id: string): Item | undefined {
  return items.find((i) => i.id === id);
}

/** カテゴリに属する項目を返す */
export function getItemsByCategory(slug: string): Item[] {
  return items.filter((i) => i.categorySlug === slug);
}
