// 腰痛の推定原因パターン — 企画書 第4部①
//
// inference.js が「入力から集めたタグ」と evidence / against を突き合わせて採点する。
// 表示される％は診断確率ではなく、入力内容がどのパターンらしいかの「目安」。
//
//   prior       … 基礎点（臨床でよく出会うものほど高い）
//   evidence    … 該当すると加点する所見（tags は any-of）
//   against     … 該当すると減点する所見
//   requireTags … これが無い時はそもそも候補にしない（any-of／省略可）
//   checks      … 施術者が自分の手で確かめるとよい所見（参考。診断ではない）
//   approaches  … 施術方針（modality で資格による出し分けを行う）
//   homecare    … お客様に渡すセルフケア
//   avoid       … このパターンで避けたいこと
//   referral    … true なら結果画面で受診を強くすすめる

export const LOW_BACK_PATTERNS = [
  {
    id: 'myofascial',
    name: '筋・筋膜性腰痛（非特異的腰痛）',
    short: '腰背部の筋・筋膜の過緊張',
    description:
      '腰痛の多くを占めるタイプ。特定の動作で誘発され、圧痛点がはっきりし、神経症状を伴わないのが典型です。急性（いわゆるぎっくり腰）もここに含まれることが多いです。',
    prior: 1.6,
    evidence: [
      { tags: ['duration:acute'], weight: 2, label: '発症から4週未満' },
      { tags: ['trigger:lifting'], weight: 2, label: '重い物を持ち上げて発症' },
      { tags: ['trigger:twisting'], weight: 1.5, label: 'ひねって発症' },
      { tags: ['quality:dull', 'quality:stiff'], weight: 1.5, label: '鈍い・こわばる痛み' },
      { tags: ['region:lumbar_center', 'region:lumbar_side'], weight: 1, label: '腰部に限局' },
      { tags: ['relief:heat'], weight: 1.5, label: '温めると楽になる' },
      { tags: ['aggr:transition'], weight: 1, label: '寝返り・起き上がりで痛む' },
      { tags: ['work:heavy_labor'], weight: 1, label: '力仕事が多い' },
    ],
    against: [
      { tags: ['neuro:radiating_below_knee'], weight: 3, label: '膝より下への放散痛' },
      { tags: ['neuro:claudication'], weight: 3, label: '間欠跛行' },
      { tags: ['neuro:weakness'], weight: 2, label: '筋力低下' },
    ],
    checks: ['圧痛点（起立筋・腰方形筋・多裂筋）の再現痛', '体幹の可動域と痛みの出る角度', 'SLRテストが陰性であること（※神経症状の除外）'],
    approaches: [
      { modality: 'manual', text: '急性期は圧痛部の周囲から軽い手技で。強圧・深部への押し込みは翌日の増悪を招きやすいので避ける。' },
      { modality: 'manual', text: '腰方形筋・脊柱起立筋・大殿筋・ハムストリングスの緊張をまとめて確認し、骨盤帯の左右差を整える。' },
      { modality: 'acupuncture', text: '腎兪・大腸兪・志室などの局所と、遠隔の委中を組み合わせる。急性期は刺激量を控えめに。' },
      { modality: 'moxa', text: '慢性・冷えを伴う例では腰部への温灸。熱傷リスクのため感覚鈍麻・糖尿病の方には特に注意。' },
      { modality: 'exercise', text: '痛みの出ない範囲で骨盤の前後傾、膝抱えなど低負荷の運動から再開する。' },
      { modality: 'education', text: '「安静にしすぎない」ことが回復を早めるとされる点を説明し、日常動作の続け方を具体的に伝える。' },
    ],
    homecare: [
      '痛みの範囲で普段の生活を続ける（長時間の安静はかえって回復を遅らせるとされます）',
      '楽な姿勢（膝を立てた仰向け、横向きで膝の間にクッション）で休む',
      '温めて楽になるなら入浴・蒸しタオル。急性で熱感が強い時は冷やして様子をみる',
      '重い物は体に近づけ、膝を使って持ち上げる',
    ],
    avoid: ['急性期の強い伸張・強圧', '痛みを我慢させるストレッチ', '長時間の同一姿勢'],
    sourceIds: ['jpn_lbp_gl2019', 'nice_ng59', 'mhlw_lbp2013'],
  },
  {
    id: 'facet',
    name: '椎間関節性の腰痛',
    short: '反らす・ひねる動作で痛む',
    description:
      '腰を反らす／ひねる動作で誘発され、前かがみで楽になりやすいタイプ。片側の腰〜殿部に限局した痛みを訴えることが多いです。',
    prior: 1.1,
    evidence: [
      { tags: ['aggr:extension'], weight: 3, label: '反らすと悪化' },
      { tags: ['aggr:rotation'], weight: 2, label: 'ひねると悪化' },
      { tags: ['relief:flexion'], weight: 2, label: '前かがみで楽' },
      { tags: ['aggr:standing'], weight: 1.5, label: '立ち続けると悪化' },
      { tags: ['region:lumbar_side'], weight: 1.5, label: '片側性' },
      { tags: ['neuro:radiating_above_knee'], weight: 1, label: '膝より上までの関連痛' },
    ],
    against: [
      { tags: ['aggr:flexion'], weight: 2, label: '前屈で悪化' },
      { tags: ['neuro:radiating_below_knee'], weight: 1.5, label: '膝より下への放散痛' },
    ],
    checks: ['伸展＋回旋（Kemp徴候）での再現痛', '棘突起外側の圧痛', '前屈での痛みが軽いこと'],
    approaches: [
      { modality: 'manual', text: '多裂筋・回旋筋など深層の緊張をゆるめ、胸椎・股関節の可動性を確保して腰椎の代償を減らす。' },
      { modality: 'manual', text: '施術体位は伸展位を避け、側臥位や膝を立てた仰臥位で。' },
      { modality: 'acupuncture', text: '患側の華佗夾脊・腰陽関周囲。反応点を丁寧に取り、刺激は中等度まで。' },
      { modality: 'exercise', text: '腹部の支持（ドローイン）と股関節屈筋のストレッチで、反り腰の負担を分散する。' },
      { modality: 'education', text: '上を向く作業、反り腰での立位、うつ伏せ寝を一時的に減らすよう伝える。' },
    ],
    homecare: ['反らす動作を一時的に控える', 'うつ伏せで長時間過ごさない', '膝を立てて仰向けに休む', '股関節前面（腸腰筋）のやさしいストレッチ'],
    avoid: ['伸展方向への強い矯正操作', '腹臥位での長時間の圧迫'],
    sourceIds: ['jpn_lbp_gl2019', 'textbook_toyo'],
  },
  {
    id: 'discogenic',
    name: '椎間板性の腰痛（神経症状なし）',
    short: '前かがみ・座位で悪化',
    description:
      '前屈、長時間の座位、咳やくしゃみで悪化しやすいタイプ。下肢への放散痛がなければ神経根症状は伴っていないと考えます。',
    prior: 1.1,
    evidence: [
      { tags: ['aggr:flexion'], weight: 3, label: '前かがみで悪化' },
      { tags: ['aggr:sitting'], weight: 2.5, label: '座り続けると悪化' },
      { tags: ['aggr:cough'], weight: 2.5, label: '咳・くしゃみで響く' },
      { tags: ['aggr:transition'], weight: 1.5, label: '起き上がりで痛む' },
      { tags: ['trigger:lifting'], weight: 1.5, label: '持ち上げ動作で発症' },
      { tags: ['onset:sudden'], weight: 1, label: '突然の発症' },
    ],
    against: [
      // このパターンは定義上「神経症状なし」。下肢へ放散する症状があれば
      // 神経根症状のパターンを上位に出す（ここを外すと両者が入れ替わる）。
      { tags: ['neuro:radiating_below_knee'], weight: 3, label: '膝より下への放散痛' },
      { tags: ['neuro:numbness', 'neuro:weakness'], weight: 1.5, label: 'しびれ・筋力低下' },
      { tags: ['relief:flexion'], weight: 2, label: '前かがみで楽' },
      { tags: ['aggr:extension'], weight: 1.5, label: '反らすと悪化' },
      { tags: ['special:elderly'], weight: 1, label: '高齢' },
    ],
    checks: ['座位より立位・歩行のほうが楽か', '前屈での再現痛', 'SLRテスト（陽性なら神経根症状の評価へ）'],
    approaches: [
      { modality: 'manual', text: '腰部の過度な前屈をつくらない体位で、殿筋・ハムストリングス・胸腰筋膜の緊張をゆるめる。' },
      { modality: 'acupuncture', text: '腰部局所に加え、委中・崑崙など下肢の要穴を使い刺激量を分散させる。' },
      { modality: 'exercise', text: '座位の姿勢調整（骨盤を立てる・こまめな立ち上がり）を運動指導として組み込む。' },
      { modality: 'education', text: '30〜40分に一度は姿勢を変える、床から物を拾う時は膝を使う、を具体的に伝える。' },
    ],
    homecare: ['長時間の座位を避け、こまめに立つ', '座面の高さと骨盤の角度を見直す', '前屈での持ち上げを避ける', '痛みが下肢へ広がってきたら施術者へ連絡する'],
    avoid: ['前屈方向への強い持続的ストレッチ', '座位での長時間施術'],
    sourceIds: ['jpn_lbp_gl2019', 'nice_ng59'],
  },
  {
    id: 'radiculopathy',
    name: '神経根症状を伴う腰痛（坐骨神経痛・椎間板ヘルニアなど）',
    short: '膝より下への放散痛・しびれ',
    description:
      '腰から殿部・下肢へ放散する痛みやしびれを伴うタイプ。筋力低下や感覚の変化が進む場合は、施術より受診が優先されます。',
    prior: 1.0,
    referral: false,
    evidence: [
      { tags: ['neuro:radiating_below_knee'], weight: 4, label: '膝より下への放散痛' },
      { tags: ['neuro:numbness', 'quality:numb'], weight: 2, label: 'しびれを伴う' },
      { tags: ['quality:burning'], weight: 1.5, label: '焼けるような痛み' },
      { tags: ['aggr:cough'], weight: 2, label: '咳・くしゃみで下肢に響く' },
      { tags: ['region:lower_leg', 'region:foot'], weight: 1.5, label: '下腿・足への症状' },
      { tags: ['neuro:weakness'], weight: 2, label: '力の入りにくさ' },
    ],
    against: [{ tags: ['neuro:none'], weight: 4, label: '神経症状なし' }],
    checks: ['SLRテスト（下肢挙上での放散痛の再現）', 'デルマトームに沿ったしびれの分布', '足関節背屈・母趾伸展の筋力（左右差）'],
    approaches: [
      { modality: 'manual', text: '神経症状を強める体位・牽引は避け、殿部（梨状筋周囲）と腰部の緊張緩和にとどめる。施術中にしびれが増したら即中止。' },
      { modality: 'acupuncture', text: '環跳・委中・承山・崑崙など下肢の経穴で症状の走行に沿って。強刺激で症状が増悪しないか毎回確認する。' },
      { modality: 'exercise', text: '症状が中枢（腰側）へ戻る方向の運動は続け、末梢（足先）へ広がる方向は中止する目安を共有する。' },
      { modality: 'education', text: '筋力低下の進行、排尿・排便の異常が出たら、その場で施術を中止し受診するよう明確に伝える。' },
    ],
    homecare: [
      'しびれが強くなる姿勢・動作を記録して避ける',
      '長時間の座位・運転を避ける',
      '足の力が入らない、つまずく、排尿排便に異常が出たらすぐ受診',
      '痛みで眠れない状態が続く場合も受診をすすめる',
    ],
    avoid: ['症状を末梢へ広げる操作', '下肢の強い牽引・持続的な神経伸張', '「様子を見ましょう」で受診の判断を先延ばしにすること'],
    sourceIds: ['jpn_lbp_gl2019', 'nice_ng59'],
  },
  {
    id: 'sij',
    name: '仙腸関節性の腰痛',
    short: '腰とお尻の境目がピンポイントで痛む',
    description:
      '上後腸骨棘のやや内下方を「ここ」と指させることが多く、寝返りや立ち上がりで痛みが出やすいタイプ。妊娠中・産後にも多くみられます。',
    prior: 1.0,
    evidence: [
      { tags: ['region:sacroiliac'], weight: 3, label: '仙腸部の限局痛' },
      { tags: ['aggr:transition'], weight: 2, label: '寝返り・起き上がりで痛む' },
      { tags: ['region:groin'], weight: 2, label: '鼠径部の痛み' },
      { tags: ['special:pregnancy', 'special:postpartum'], weight: 2, label: '妊娠中・産後' },
      { tags: ['aggr:standing'], weight: 1.5, label: '片脚立ち・立位で悪化' },
      { tags: ['region:buttock'], weight: 1.5, label: '殿部痛' },
    ],
    against: [
      { tags: ['neuro:radiating_below_knee'], weight: 1.5, label: '膝より下への放散痛' },
      { tags: ['aggr:cough'], weight: 1, label: '咳で響く' },
    ],
    checks: ['ワンフィンガーテスト（痛みの部位を1本指で示せるか）', '仙腸関節の圧痛', '片脚立位・階段昇降での再現痛'],
    approaches: [
      { modality: 'manual', text: '骨盤周囲（大殿筋・中殿筋・腸腰筋・広背筋）の緊張差を整え、仙腸関節への負担をならす。' },
      { modality: 'acupuncture', text: '次髎・胞肓など仙骨部の反応点。妊娠中は仙骨部への刺激そのものに配慮が必要（※要確認）。' },
      { modality: 'exercise', text: '骨盤ベルトの併用や、片脚に荷重を預けない立ち方を指導する。' },
      { modality: 'education', text: '足を組む、片側だけで荷物を持つなど、左右差を強める習慣を洗い出す。' },
    ],
    homecare: ['骨盤ベルトを腸骨稜のやや下で締める（強すぎない）', '片脚重心・足組みを避ける', '寝返りは膝を揃えてから', '低い椅子・柔らかいソファを避ける'],
    avoid: ['骨盤への強い矯正・スラスト操作', '片側だけを強く緩めて左右差を大きくすること'],
    sourceIds: ['jpn_lbp_gl2019', 'textbook_toyo'],
  },
  {
    id: 'stenosis',
    name: '腰部脊柱管狭窄症の疑い',
    short: '間欠跛行・反ると悪化・前かがみで楽',
    description:
      '少し歩くと下肢のしびれ・だるさが出て、前かがみや座って休むと回復するのが典型。中高年に多く、症状が強い場合は整形外科での画像評価が必要です。',
    prior: 0.9,
    referral: true,
    evidence: [
      { tags: ['neuro:claudication'], weight: 4, label: '間欠跛行' },
      { tags: ['relief:flexion'], weight: 2.5, label: '前かがみで楽' },
      { tags: ['aggr:extension'], weight: 2, label: '反らすと悪化' },
      { tags: ['aggr:walking'], weight: 2, label: '歩行で悪化' },
      { tags: ['special:elderly'], weight: 2, label: '55歳以上' },
      { tags: ['neuro:numbness'], weight: 1.5, label: '下肢のしびれ' },
    ],
    against: [
      { tags: ['special:minor'], weight: 2, label: '若年' },
      { tags: ['duration:acute'], weight: 1, label: '急性発症' },
    ],
    checks: ['歩行可能距離と、休んで回復するまでの時間', '自転車なら長く漕げるか（前傾で楽になるか）', '足背動脈の拍動（血管性跛行との区別。※判断は医師）'],
    approaches: [
      { modality: 'manual', text: '腸腰筋・脊柱起立筋・ハムストリングスをゆるめ、伸展位でのストレスを減らす。伸展位を長く保たせない。' },
      { modality: 'acupuncture', text: '腰部の局所刺激に加え、下肢の循環を意識した配穴。効果と歩行距離の変化を毎回記録する。' },
      { modality: 'exercise', text: '前傾姿勢を利用した歩行（カート・自転車）で活動量を保つ。' },
      { modality: 'education', text: '症状の進行、両下肢のしびれ、排尿障害があれば受診が必要であることを伝える。' },
    ],
    homecare: ['歩行は距離ではなく「休みながら合計で稼ぐ」', '長時間の立位・反り姿勢を避ける', '症状が両脚に広がる・排尿に異常が出たらすぐ受診'],
    avoid: ['伸展方向への強い操作', '長距離歩行を我慢させる指導'],
    sourceIds: ['jpn_lbp_gl2019', 'nice_ng59'],
  },
  {
    id: 'piriformis',
    name: '梨状筋症候群など殿部由来の下肢症状',
    short: '殿部の圧痛＋座位で悪化',
    description:
      '殿部深部の圧痛がはっきりし、座位や長時間の運転で悪化するタイプ。腰椎由来との区別が難しいため、経過での再評価が重要です。',
    prior: 0.8,
    evidence: [
      { tags: ['region:buttock'], weight: 3, label: '殿部の限局痛' },
      { tags: ['aggr:sitting'], weight: 2, label: '座位で悪化' },
      { tags: ['region:thigh_post'], weight: 1.5, label: '大腿後面への広がり' },
      { tags: ['work:driving_long'], weight: 1.5, label: '長時間の運転' },
      { tags: ['neuro:radiating_below_knee'], weight: 1.5, label: '下肢への放散' },
    ],
    against: [
      { tags: ['aggr:cough'], weight: 1.5, label: '咳で響く（椎間板性を示唆）' },
      { tags: ['neuro:weakness'], weight: 1, label: '筋力低下' },
    ],
    checks: ['梨状筋部の圧痛と再現痛', '股関節内旋・内転での症状再現', '腰椎の動きでは症状が変わらないこと'],
    approaches: [
      { modality: 'manual', text: '梨状筋・中殿筋・大腿筋膜張筋を、坐骨神経の走行を意識して圧を加減しながら緩める。しびれが増えたら中止。' },
      { modality: 'acupuncture', text: '環跳・秩辺などの殿部深層への刺鍼。深さと方向に注意し、放散感が強すぎないよう調整する。' },
      { modality: 'exercise', text: '梨状筋ストレッチ（仰臥位で膝を反対の肩へ）を痛みの出ない範囲で。' },
      { modality: 'education', text: '座面の硬さ・財布の後ポケット・長時間運転など、殿部を圧迫し続ける習慣を見直す。' },
    ],
    homecare: ['30〜60分ごとに立って歩く', '後ろポケットに財布を入れない', '座面にクッションを入れて圧を分散', '症状が強い時は無理なストレッチをしない'],
    avoid: ['しびれが増える強圧', '症状増悪時の持続的な圧迫'],
    sourceIds: ['textbook_toyo', 'nice_ng59'],
  },
  {
    id: 'postural',
    name: '姿勢・生活習慣由来の腰痛',
    short: '徐々に始まり、慢性・反復する',
    description:
      'はっきりしたきっかけがなく徐々に始まり、仕事や生活の姿勢と連動して繰り返すタイプ。施術と同じくらい、生活側の調整が効きます。',
    prior: 1.2,
    evidence: [
      { tags: ['onset:gradual'], weight: 2, label: '徐々に発症' },
      { tags: ['duration:chronic', 'duration:recurrent'], weight: 2, label: '慢性・反復' },
      { tags: ['aggr:sitting'], weight: 2, label: '座位で悪化' },
      { tags: ['work:desk', 'trigger:desk_work'], weight: 2, label: 'デスクワーク中心' },
      { tags: ['work:standing_work'], weight: 1.5, label: '立ち仕事中心' },
      { tags: ['relief:position_change'], weight: 1.5, label: '姿勢を変えると楽' },
      { tags: ['quality:stiff', 'quality:heavy'], weight: 1.5, label: 'こわばり・重だるさ' },
    ],
    against: [
      { tags: ['onset:sudden'], weight: 2, label: '突然の発症' },
      { tags: ['onset:after_trauma'], weight: 2, label: '外傷後' },
    ],
    checks: ['1日の姿勢配分（座位・立位・移動）', '症状が軽い日と重い日の違い', '睡眠・ストレス・活動量の変化'],
    approaches: [
      { modality: 'manual', text: '全身のバランス（胸椎・股関節・足部）を見て、腰だけを緩める施術にしない。' },
      { modality: 'acupuncture', text: '慢性例では刺激量を控えめに、間隔をあけて反応をみる。効果判定の指標を初回に決めておく。' },
      { modality: 'moxa', text: '冷え・血流低下を伴う例に温灸。心地よさが続く範囲で。' },
      { modality: 'exercise', text: '週単位で続けられる運動（歩行・軽い筋トレ）を1つだけ決める。種目より継続を優先。' },
      { modality: 'education', text: '作業環境（椅子・机の高さ・モニタ位置）と休憩間隔を具体的な数字で提案する。' },
    ],
    homecare: ['30〜60分ごとに姿勢を変える', '歩行を1日10〜20分から習慣化', '寝具・椅子を見直す', '痛みの日誌をつけ、増える条件を特定する'],
    avoid: ['強い刺激で一時的な変化だけを狙うこと', '「姿勢が悪いから痛い」と決めつけて不安を強めること'],
    sourceIds: ['nice_ng59', 'who_cplbp_2023', 'mhlw_lbp2013'],
  },
  {
    id: 'pgp',
    name: '妊娠関連骨盤帯痛（妊娠中・産後）',
    short: '妊娠中・産後の骨盤帯の痛み',
    description:
      '妊娠中〜産後に起こる骨盤帯の痛み。仙腸関節部や恥骨部に出やすく、寝返り・階段・片脚立ちで悪化します。施術は体位と刺激量への配慮が最優先です。',
    prior: 0.7,
    requireTags: ['special:pregnancy', 'special:postpartum'],
    evidence: [
      { tags: ['special:pregnancy'], weight: 4, label: '妊娠中' },
      { tags: ['special:postpartum'], weight: 3, label: '産後6か月以内' },
      { tags: ['region:sacroiliac'], weight: 2, label: '仙腸部の痛み' },
      { tags: ['region:groin'], weight: 2, label: '恥骨・鼠径部の痛み' },
      { tags: ['aggr:transition'], weight: 1.5, label: '寝返りで痛む' },
      { tags: ['aggr:walking'], weight: 1.5, label: '歩行で悪化' },
    ],
    against: [],
    checks: ['妊娠週数・産後経過', '主治医からの運動・施術に関する指示の有無', '寝返り・階段・片脚立ちでの痛み'],
    approaches: [
      { modality: 'manual', text: '側臥位を基本に、軽擦法中心のやさしい手技で。腹臥位・長時間の仰臥位は避ける。', caution: '腹部の圧迫は行わない。' },
      { modality: 'acupuncture', text: '妊娠中の刺鍼は禁忌部位・禁忌穴の扱いが資格・流派で異なるため、必ず自身の教育課程と所属団体の基準に従う。', caution: '※要確認：三陰交・合谷・仙骨部などの扱いは統一見解がない。' },
      { modality: 'exercise', text: '骨盤ベルトの装着位置を一緒に確認し、寝返り・起き上がりの動作指導を行う。' },
      { modality: 'education', text: '出血・腹痛・破水など産科的な異常があれば施術ではなく受診であることを最初に共有する。' },
    ],
    homecare: ['寝返りは膝を揃えて体を丸ごと回す', '骨盤ベルトを活用する', '階段・片脚立ちを避ける', '産科の指示を最優先にする'],
    avoid: ['腹臥位', '腹部・腰仙部への強い刺激', '妊娠経過に関する助言（産科の領分）'],
    sourceIds: ['jpn_lbp_gl2019', 'textbook_toyo'],
  },
  {
    id: 'spondylolysis',
    name: '腰椎分離症・すべり症の疑い（若年・スポーツ）',
    short: '若年＋反らすと痛い＋スポーツ',
    description:
      '成長期のスポーツ選手で、反る・ひねる動作で腰痛が出る場合に考えます。早期であれば安静で治癒が期待できるため、疑った時点で整形外科の受診をすすめます。',
    prior: 0.5,
    referral: true,
    requireTags: ['special:minor', 'special:athlete', 'trigger:sports'],
    evidence: [
      { tags: ['special:minor'], weight: 3, label: '20歳未満' },
      { tags: ['trigger:sports'], weight: 2.5, label: 'スポーツで発症' },
      { tags: ['aggr:extension'], weight: 2.5, label: '反らすと痛む' },
      { tags: ['special:athlete'], weight: 2, label: '競技スポーツをしている' },
      { tags: ['aggr:rotation'], weight: 1.5, label: 'ひねると痛む' },
    ],
    against: [{ tags: ['special:elderly'], weight: 3, label: '高齢' }],
    checks: ['片脚立位での伸展（ストークテスト）での再現痛', '練習量・試合の増えた時期と痛みの出た時期が一致するか', '2週間以上続く運動時痛'],
    approaches: [
      { modality: 'education', text: 'まず整形外科（MRI・CTでの評価）をすすめる。分離症は早期発見で治癒率が変わるとされるため、施術で経過を見過ぎない。' },
      { modality: 'manual', text: '受診と並行して、股関節・胸椎の柔軟性低下（腰椎への代償）に対する手技は有用。伸展の再現は行わない。' },
      { modality: 'exercise', text: '医師の指示のもとで、体幹の支持と股関節可動域の改善に取り組む。' },
    ],
    homecare: ['痛みが出る競技動作を中止し、まず受診する', '「湿布で様子見」を続けない', '医師の許可が出るまで復帰しない'],
    avoid: ['伸展の再現テストの繰り返し', '受診をすすめずに施術を継続すること'],
    sourceIds: ['jpn_lbp_gl2019'],
  },
  {
    id: 'visceral_referred',
    name: '内臓由来の関連痛の疑い（施術対象外の可能性）',
    short: '姿勢や動作で痛みが変わらない',
    description:
      '体位や動作で痛みが変化しない、側腹部〜背部の痛み、発熱や全身症状を伴う場合は、内臓疾患による関連痛の可能性を考えます。施術ではなく受診の判断が必要です。',
    prior: 0.4,
    referral: true,
    evidence: [
      { tags: ['aggr:none'], weight: 3, label: '動作で痛みが変わらない' },
      { tags: ['relief:none'], weight: 3, label: '何をしても楽にならない' },
      { tags: ['region:flank'], weight: 2.5, label: '側腹部〜背部の痛み' },
      { tags: ['sys:fever'], weight: 2, label: '発熱' },
      { tags: ['sys:night_pain', 'sys:rest_pain'], weight: 1.5, label: '夜間痛・安静時痛' },
      { tags: ['quality:throbbing'], weight: 1.5, label: 'ズキズキする痛み' },
      { tags: ['sys:malaise'], weight: 1, label: '強い倦怠感' },
    ],
    against: [
      { tags: ['aggr:flexion', 'aggr:extension', 'aggr:rotation'], weight: 1.5, label: '特定方向で悪化する（機械的腰痛らしい）' },
      { tags: ['relief:position_change'], weight: 1.5, label: '姿勢を変えると楽になる' },
    ],
    checks: ['体位変換で痛みが変わるか', '発熱・排尿症状・消化器症状の有無', '食事・時間帯との関連'],
    approaches: [
      { modality: 'education', text: '施術で改善を狙う対象ではない可能性を伝え、医療機関の受診をすすめる。原因の推測（病名）は伝えない。' },
      { modality: 'manual', text: '受診を前提としたうえで、緊張緩和目的の軽い手技にとどめる。腹部への圧迫は行わない。' },
    ],
    homecare: ['まず医療機関を受診する', '発熱・激しい腹痛・血尿などがあれば早めに受診', '施術で改善しないことを我慢しない'],
    avoid: ['腹部の圧迫', '「筋肉のこり」と決めつけて施術を継続すること'],
    sourceIds: ['jpn_lbp_gl2019', 'downie_bmj2013'],
  },
];
