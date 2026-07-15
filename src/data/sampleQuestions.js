// 鍼灸国家試験対策アプリ サンプル問題
// type: 'ox'（○×形式） / 'choice'（四択形式）
// ox の場合  answer は 0（○=正しい） または 1（×=誤り）
// choice の場合 answer は choices 配列の 0 始まりインデックス
//
// 本番データは設定画面から CSV / JSON でインポートできます。
// （項目：科目, 問題文, 選択肢, 正解, 解説）

const sampleQuestions = [
  // ---- 経絡経穴概論 ----
  {
    id: 'sample-keiraku-1',
    subject: '経絡経穴概論',
    type: 'ox',
    question: '手の太陰肺経は、中焦に起こり大腸を絡う。',
    choices: ['○（正しい）', '×（誤り）'],
    answer: 0,
    explanation:
      '手の太陰肺経は中焦に起こり、下って大腸を絡い、胃口を巡って肺に属する。流注の起始は中焦で正しい。',
  },
  {
    id: 'sample-keiraku-2',
    subject: '経絡経穴概論',
    type: 'choice',
    question: '合谷穴が属する経絡はどれか。',
    choices: ['手の陽明大腸経', '手の太陰肺経', '手の少陰心経', '手の厥陰心包経'],
    answer: 0,
    explanation:
      '合谷は手の陽明大腸経の原穴で、第2中手骨橈側の中点に取る。四総穴の一つで顔面・口の症状に用いる。',
  },
  {
    id: 'sample-keiraku-3',
    subject: '経絡経穴概論',
    type: 'choice',
    question: '足の三里の取穴部位として正しいのはどれか。',
    choices: [
      '犢鼻穴から下方3寸、脛骨稜の外方1寸',
      '内果尖の上方3寸',
      '膝蓋骨底の上方2寸',
      '外果尖の後方',
    ],
    answer: 0,
    explanation:
      '足の三里は犢鼻の下3寸、脛骨前縁から外方に指1本（約1寸）のところ。足の陽明胃経の合土穴で、四総穴（腹部）にあたる。',
  },
  {
    id: 'sample-keiraku-4',
    subject: '経絡経穴概論',
    type: 'ox',
    question: '督脈は身体前正中線を上行する。',
    choices: ['○（正しい）', '×（誤り）'],
    answer: 1,
    explanation:
      '督脈は身体「後」正中線を上行する経脈で、陽脈の海と呼ばれる。前正中線を上行するのは任脈（陰脈の海）である。',
  },

  // ---- 東洋医学概論 ----
  {
    id: 'sample-toyo-1',
    subject: '東洋医学概論',
    type: 'choice',
    question: '五行色体表で「肝」に配当される五主はどれか。',
    choices: ['筋', '脈', '肌肉', '皮'],
    answer: 0,
    explanation:
      '肝は筋を主る。心＝脈、脾＝肌肉、肺＝皮（毛）、腎＝骨。五行色体の基本配当として頻出。',
  },
  {
    id: 'sample-toyo-2',
    subject: '東洋医学概論',
    type: 'ox',
    question: '五行の相剋関係で、木は土を剋す。',
    choices: ['○（正しい）', '×（誤り）'],
    answer: 0,
    explanation:
      '相剋は「木剋土・土剋水・水剋火・火剋金・金剋木」。木は土を剋す（木克土）で正しい。',
  },
  {
    id: 'sample-toyo-3',
    subject: '東洋医学概論',
    type: 'choice',
    question: '六淫のうち、上昇・発散の性質をもち、風とともに人体を侵しやすいのはどれか。',
    choices: ['火（熱）', '寒', '湿', '燥'],
    answer: 0,
    explanation:
      '火（熱）邪は炎上性で上昇・発散の性質をもつ。風邪とともに侵入すると風熱となる。寒は収引、湿は重濁、燥は乾燥が特徴。',
  },
  {
    id: 'sample-toyo-4',
    subject: '東洋医学概論',
    type: 'ox',
    question: '気の作用のうち、体温を維持する働きを固摂作用という。',
    choices: ['○（正しい）', '×（誤り）'],
    answer: 1,
    explanation:
      '体温維持は「温煦（おんく）作用」。固摂作用は血や津液などが漏れ出ないよう留める働きを指す。',
  },

  // ---- 解剖学 ----
  {
    id: 'sample-kaibo-1',
    subject: '解剖学',
    type: 'choice',
    question: '橈骨神経が支配する筋はどれか。',
    choices: ['上腕三頭筋', '上腕二頭筋', '円回内筋', '尺側手根屈筋'],
    answer: 0,
    explanation:
      '橈骨神経は上腕三頭筋や前腕伸筋群を支配する。上腕二頭筋・円回内筋は筋皮神経／正中神経、尺側手根屈筋は尺骨神経支配。',
  },
  {
    id: 'sample-kaibo-2',
    subject: '解剖学',
    type: 'ox',
    question: '心臓の左心室から出る血管は肺動脈である。',
    choices: ['○（正しい）', '×（誤り）'],
    answer: 1,
    explanation:
      '左心室から出るのは大動脈。肺動脈は右心室から出て肺へ向かう。左心室＝体循環の起点である。',
  },
  {
    id: 'sample-kaibo-3',
    subject: '解剖学',
    type: 'choice',
    question: '成人の脊髄が終わる高さとして最も適切なのはどれか。',
    choices: [
      '第1〜2腰椎の高さ',
      '第12胸椎の高さ',
      '第4〜5腰椎の高さ',
      '第1仙椎の高さ',
    ],
    answer: 0,
    explanation:
      '成人の脊髄下端（脊髄円錐）は第1〜2腰椎の高さで終わる。腰椎穿刺は脊髄を避けて第3〜4腰椎間で行う。',
  },

  // ---- 生理学 ----
  {
    id: 'sample-seiri-1',
    subject: '生理学',
    type: 'choice',
    question: '安静時の血漿浸透圧を主に決定するのはどれか。',
    choices: ['ナトリウムイオン', 'カリウムイオン', 'カルシウムイオン', 'グルコース'],
    answer: 0,
    explanation:
      '血漿浸透圧の主役は Na+（と対イオンの Cl-）。細胞外液で最も濃度が高く、浸透圧の大半を担う。',
  },
  {
    id: 'sample-seiri-2',
    subject: '生理学',
    type: 'ox',
    question: '交感神経が優位になると心拍数は減少する。',
    choices: ['○（正しい）', '×（誤り）'],
    answer: 1,
    explanation:
      '交感神経優位では心拍数は「増加」する。心拍数を減少させるのは副交感神経（迷走神経）の作用である。',
  },
  {
    id: 'sample-seiri-3',
    subject: '生理学',
    type: 'choice',
    question: 'インスリンを分泌する細胞はどれか。',
    choices: [
      '膵ランゲルハンス島B（β）細胞',
      '膵ランゲルハンス島A（α）細胞',
      '副腎髄質のクロム親和性細胞',
      '甲状腺の傍濾胞細胞',
    ],
    answer: 0,
    explanation:
      'インスリンは膵ランゲルハンス島のB（β）細胞から分泌される。A（α）細胞はグルカゴン、傍濾胞細胞はカルシトニンを分泌する。',
  },

  // ---- 病理学 ----
  {
    id: 'sample-byori-1',
    subject: '病理学概論',
    type: 'ox',
    question: '肥大とは、細胞の数が増えることによって臓器が大きくなる現象である。',
    choices: ['○（正しい）', '×（誤り）'],
    answer: 1,
    explanation:
      '肥大は個々の細胞の「容積」が増大する現象。細胞の「数」が増えるのは過形成（増生）である。',
  },
  {
    id: 'sample-byori-2',
    subject: '病理学概論',
    type: 'choice',
    question: '良性腫瘍の特徴として正しいのはどれか。',
    choices: ['膨張性発育', '転移する', '異型性が強い', '再発しやすい'],
    answer: 0,
    explanation:
      '良性腫瘍は膨張性（圧排性）発育を示し、被膜をもち転移しない。浸潤・転移・強い異型性は悪性腫瘍の特徴。',
  },

  // ---- はり・きゅう理論 ----
  {
    id: 'sample-hari-1',
    subject: 'はり理論',
    type: 'choice',
    question: '鍼の響き（得気）に関与する主な受容器はどれか。',
    choices: ['ポリモーダル受容器', '味蕾', '前庭器官', 'マイスネル小体のみ'],
    answer: 0,
    explanation:
      '得気（響き）にはポリモーダル受容器など深部の感覚受容器が関与するとされる。鍼刺激の鎮痛機序の説明に用いられる。',
  },
  {
    id: 'sample-kyu-1',
    subject: 'きゅう理論',
    type: 'ox',
    question: '有痕灸は、施灸部に灸痕（瘢痕）を残す施灸法である。',
    choices: ['○（正しい）', '×（誤り）'],
    answer: 0,
    explanation:
      '有痕灸は皮膚に直接施灸し灸痕を残す方法（透熱灸など）。灸痕を残さないのは無痕灸（知熱灸・温灸など）である。',
  },
];

export default sampleQuestions;
