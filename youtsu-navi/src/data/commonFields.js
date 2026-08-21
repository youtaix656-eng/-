// どの症状でも同じように聞く項目（腰痛・頸部痛・膝痛で共有する）。
//
// 症状ごとに書き写すと表現がぶれるため、ここを単一の正とする。
// 各症状モジュールは COMMON_SAFETY_FIELDS / COMMON_LIFE_FIELDS を自分の fields に混ぜる。

/** 受診・検査の状況と服薬（安全確認のステップで聞く） */
export const COMMON_SAFETY_FIELDS = [
  {
    id: 'care',
    step: 'safety',
    label: '医療機関の受診・検査は',
    type: 'single',
    required: true,
    help: '診断がついている場合は、その方針が最優先になります。',
    options: [
      { value: 'none', label: '受診していない', tags: ['care:none'] },
      { value: 'seen', label: '受診したが、画像検査はしていない', tags: ['care:seen_no_image'] },
      { value: 'imaged', label: 'レントゲン・MRIなどの検査を受けた', tags: ['care:imaged'] },
      { value: 'diagnosed', label: '診断名がついている', tags: ['care:diagnosed'] },
      { value: 'surgery', label: '手術を受けたことがある', tags: ['care:post_surgery'] },
      { value: 'other', label: '他の施術所にも通っている', tags: ['care:other_clinic'] },
    ],
  },
  {
    id: 'meds',
    step: 'safety',
    label: '服薬（複数選択可）',
    type: 'multi',
    required: true,
    help: '抗凝固薬・ステロイドは施術の強度に関わります。',
    options: [
      { value: 'analgesic_ok', label: '鎮痛薬を飲むと楽になる', tags: ['meds:analgesic_effective'] },
      { value: 'analgesic_ng', label: '鎮痛薬を飲んでも変わらない', tags: ['meds:analgesic_ineffective'], alarm: true },
      { value: 'anticoagulant', label: '血液をさらさらにする薬（抗凝固薬・抗血小板薬）', tags: ['meds:anticoagulant'], alarm: true },
      { value: 'steroid', label: 'ステロイド', tags: ['meds:steroid'], alarm: true },
      { value: 'osteo', label: '骨粗鬆症の薬', tags: ['meds:osteoporosis_med'] },
      { value: 'none', label: '特になし', tags: ['meds:none'], exclusive: true },
    ],
  },
];

/** 生活への支障と、慢性化に関わる考え方（生活のステップで聞く） */
export const COMMON_LIFE_FIELDS = [
  {
    id: 'impact',
    step: 'life',
    label: '生活・仕事への支障（複数選択可）',
    type: 'multi',
    required: true,
    options: [
      { value: 'off_work', label: '仕事を休んでいる', tags: ['impact:off_work'] },
      { value: 'restricted', label: '仕事は続けているが、できないことがある', tags: ['impact:restricted_work'] },
      { value: 'daily', label: '家事・入浴・着替えなど日常生活に支障がある', tags: ['impact:daily_limited'] },
      { value: 'sleep', label: '痛みで眠れない・目が覚める', tags: ['impact:sleep_disturbed'] },
      { value: 'none', label: '大きな支障はない', tags: ['impact:none'], exclusive: true },
    ],
  },
  {
    id: 'yellow',
    step: 'life',
    label: 'お客様の受け止め方で当てはまるもの（複数選択可）',
    type: 'multi',
    required: true,
    help: '慢性化しやすさに関わる項目です。責めるためではなく、伝え方を変えるために聞きます。',
    options: [
      { value: 'fear', label: '「動くと悪化する」と考えて動きを控えている', tags: ['yellow:fear_avoidance'] },
      { value: 'catastrophizing', label: '「このまま治らないのでは」と強く心配している', tags: ['yellow:catastrophizing'] },
      { value: 'work', label: '仕事の負担や人間関係にストレスがある', tags: ['yellow:work_dissatisfaction'] },
      { value: 'rest', label: '安静にして過ごす時間が長い', tags: ['yellow:rest_seeking'] },
      { value: 'mood', label: '気分の落ち込み・意欲の低下がある', tags: ['yellow:low_mood'] },
      { value: 'none', label: '当てはまるものはない', tags: ['yellow:none'], exclusive: true },
    ],
  },
];
