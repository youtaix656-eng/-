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

  // ---------- 自主基準（サービス適正化） ----------
  // 出典：『りらくる』のサービス適正化に関する自主基準（研修動画）第1〜4条。
  {
    id: "standards-purpose",
    categorySlug: "standards",
    title: "第1条（目的）",
    summary: "危険な手技・施術を制限し、施術事故やクレームを無くすための基準",
    body: "本『りらくる』サービス適正化に関する自主基準（以下「りらくる自主基準」という）は、当社およびセラピストを適用範囲とし、法令や以下に定める基準を遵守することで、お客様に安心・安全なサービスを受けていただくことを目的として定めたものです。\n\n危険な手技・施術を制限し、施術事故やクレームを無くすことを目的として制定されています。",
    warnings: [
      { level: "warning", text: "適用範囲は「当社およびセラピスト」。全員が遵守の対象です。" },
    ],
    related: ["standards-definition", "standards-treatment-rules", "standards-prohibited-techniques"],
    tags: ["自主基準", "目的", "第1条", "サービス適正化", "安心", "安全"],
  },
  {
    id: "standards-definition",
    categorySlug: "standards",
    title: "第2条（定義）",
    summary: "りらくるのリラクゼーションを満たす3点の条件",
    body: "りらくるのリラクゼーションは、下記の3点を満たした手技や施術などの行為であり、もみほぐしを通して「癒やし」をご提供するものと定義します。",
    steps: [
      { text: "(1) あはき業に関する法律およびその他法令に抵触しない「その他医業類似行為」であること" },
      { text: "(2) 痛みや人の健康に害を及ぼすおそれのある危険な手技や施術方法を用いないこと" },
      { text: "(3) 治療を目的としないこと" },
    ],
    warnings: [
      { level: "warning", text: "「治療」を目的にしてはいけません。あくまで“もみほぐしによる癒やし”です。" },
    ],
    related: ["standards-medical-similar", "standards-prohibited-acts", "standards-purpose"],
    tags: ["自主基準", "定義", "第2条", "その他医業類似行為", "治療目的でない", "癒やし", "もみほぐし"],
  },
  {
    id: "standards-medical-similar",
    categorySlug: "standards",
    title: "医業類似行為の区分（国家資格／その他）",
    summary: "りらくるは国家資格を要しない「その他医業類似行為」",
    body: "医業類似行為は次のように分かれます。\n\n■ 国家資格【あはき業】\n・あんま（マッサージ・指圧）\n・はり、灸\n・柔道整復\n\n■ その他医業類似行為\n・リラクゼーション業\n\n「人の健康に害を及ぼすおそれがない」限り、禁止・処罰しない旨の最高裁判決（昭和35年1月27日判決）が出ており、リラクゼーション業はこの「その他医業類似行為」に含まれます。",
    warnings: [
      { level: "warning", text: "根拠は昭和35年1月27日の最高裁判決。「害を及ぼすおそれがない」ことが前提です。" },
    ],
    related: ["standards-definition", "standards-prohibited-acts"],
    tags: ["医業類似行為", "国家資格", "あはき業", "あんま", "はり", "灸", "柔道整復", "リラクゼーション業", "最高裁判決", "昭和35年"],
  },
  {
    id: "standards-prohibited-acts",
    categorySlug: "standards",
    title: "りらくるで行ってはいけない行為・表現",
    summary: "あん摩・はり灸・柔整・整体・カイロ・治療、そして誤解を招く表現はNG",
    body: "りらくるのリラクゼーションは国家資格を有しない「その他医業類似行為」に当たります。そのため、国家資格が必要な行為や誤解を招く表現は行えません。",
    warnings: [
      { level: "danger", text: "「あん摩（マッサージ・指圧含む）」「はり・灸」「柔道整復」は行えません。" },
      { level: "danger", text: "治療行為、整体やカイロプラクティックのような骨格矯正などの施術も行ってはなりません。" },
      { level: "danger", text: "「マッサージ」という文言もリラクゼーションを逸脱する表現。効果効能を謳（うた）うことはあはき業に関する法律・法令に抵触するため、誤解を招く表現や発言は行ってはいけません。" },
    ],
    related: ["standards-medical-similar", "standards-definition", "qa-complaint"],
    tags: ["禁止", "あん摩", "マッサージ", "指圧", "はり", "灸", "柔道整復", "整体", "カイロプラクティック", "骨格矯正", "治療", "効果効能", "表現"],
  },
  {
    id: "standards-treatment-rules",
    categorySlug: "standards",
    title: "第3条（施術規定）",
    summary: "『顧客本位でない』施術の禁止（2023年11月1日施行）",
    body: "安全配慮の徹底とお客様のご要望に相違したサービスの防止のため、以下に例示するような『顧客本位でない』施術を禁止します。りらくるのリラクゼーションは、お客様から十分な情報を得た上で、お客様のお体の状態やご要望を確認して施術します。\n\n【背景】従来の自主基準を守り適切に施術していても、施術前後・施術中の説明や確認不足が要因でクレームが発生。セラピストをクレームから守るため、第3条を新設し2023年11月1日より施行しています。",
    steps: [
      { text: "施術前に施術コースの確認を怠ること", note: "＝禁止（以下すべて“怠ること”を禁止）" },
      { text: "施術前に施術コース内容と時間配分の説明を怠ること" },
      { text: "施術前に免責事項と体調の確認を怠ること" },
      { text: "施術前に施術に対して副次的に出現しうる「もみ返し」の説明を怠ること" },
      { text: "施術前に深呼吸確認を怠ること" },
      { text: "体位変換時の施術部位確認及び施術圧の強弱確認を怠ること" },
      { text: "施術後に深呼吸確認を怠ること" },
    ],
    warnings: [
      { level: "warning", text: "深呼吸確認は「施術前」と「施術後」の両方で行います。" },
      { level: "warning", text: "2023年11月1日より施行。説明・確認不足はクレームの主因です。" },
    ],
    related: ["standards-purpose", "service-welcome", "contraindications-pressure"],
    tags: ["自主基準", "施術規定", "第3条", "顧客本位", "深呼吸", "もみ返し", "免責事項", "体位変換", "2023年11月1日"],
  },
  {
    id: "standards-prohibited-techniques",
    categorySlug: "standards",
    title: "第4条（禁止する手技・施術）",
    summary: "健康に害を及ぼすおそれのある危険な9つの手技・施術",
    body: "痛みや人の健康に害を及ぼすおそれのある危険な行為として、以下の手技および施術を禁止します。",
    steps: [
      { text: "瞬間的に圧力をかける手技", note: "骨折・挫傷・打撲などの健康被害を誘引するリスクが高く危険（例：両手での手掌圧迫）" },
      { text: "骨格矯正、脊椎に対するアジャスト・スラスト施術", note: "過去の施術事故の事例からも危険性を考慮し禁止" },
      { text: "足裏および、膝を使った圧迫" },
      { text: "頭部・頸部・肩部・背部・腰部において、肘の先端部を使った圧迫", note: "頭部・頸部においては前腕(尺骨)での圧迫も禁止" },
      { text: "腋下に対する拇指での圧迫および肘の先端部・前腕(尺骨)を使った圧迫" },
      { text: "頸部・肩部・股関節へのけん引" },
      { text: "頸部および腰部への捻転ストレッチ" },
      { text: "当社が予め承諾していない器具やクリーム・オイルなどを使用する施術" },
      { text: "外傷を伴う手技および施術" },
    ],
    warnings: [
      { level: "danger", text: "瞬間的に圧を加える手技は、骨折・挫傷・打撲などの健康被害を誘引するリスクが高く危険です。" },
      { level: "danger", text: "骨格矯正・スラスト・アジャスト施術は過去の施術事故の事例からも禁止です。" },
    ],
    related: ["standards-prohibited-acts", "standards-definition", "contraindications-avoid"],
    tags: ["自主基準", "禁止手技", "第4条", "瞬間的な圧", "骨格矯正", "スラスト", "アジャスト", "肘圧迫", "尺骨", "けん引", "捻転ストレッチ", "外傷", "器具", "オイル"],
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
