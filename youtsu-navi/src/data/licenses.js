// 資格別の業務範囲 — 企画書 改善策 #4
//
// アプリ初期設定で資格を選ばせ、範囲外の施術提案には資格ごとの警告文を出し分ける。
// ここに書いた法的範囲はあくまで「一般的な整理」であり、実務上の可否は
// 通知・自治体・保険者の解釈によって異なる。すべて ※要確認 の扱いとする。

/** 施術手段（modality）— 施術方針カードはこのIDで自分の手段を宣言する */
export const MODALITIES = {
  manual: '手技（マッサージ・指圧・徒手）',
  acupuncture: 'はり',
  moxa: 'きゅう',
  judo: '整復・固定（応急手当を含む）',
  exercise: '運動指導・ストレッチ指導',
  education: '生活指導・セルフケア指導',
  physical: '温熱・寒冷などの物理的手段',
};

export const LICENSES = [
  {
    id: 'anma',
    name: 'あん摩マッサージ指圧師',
    kind: '国家資格',
    allowed: ['manual', 'exercise', 'education', 'physical'],
    lawIds: ['law_anma217'],
    summary: 'あん摩・マッサージ・指圧を業として行える国家資格。',
    cautions: [
      'はり・きゅうは別免許。保有していない場合は行わない。',
      '脱臼・骨折の患部への施術は、応急手当を除き医師の同意が必要（※要確認）。',
      '「治療」「診断」など医行為と誤認される説明は避ける。',
    ],
  },
  {
    id: 'shinkyu',
    name: 'はり師・きゅう師（鍼灸師）',
    kind: '国家資格',
    allowed: ['acupuncture', 'moxa', 'exercise', 'education', 'physical'],
    lawIds: ['law_anma217'],
    summary: 'はり・きゅうを業として行える国家資格。',
    cautions: [
      'マッサージ（あん摩・指圧）はあん摩マッサージ指圧師の免許が必要（※要確認：付随行為の範囲は解釈が分かれる）。',
      '感染対策（single use・清潔操作）と気胸などのリスク部位の把握を前提とする。',
      '脱臼・骨折の患部は、応急手当を除き医師の同意が必要（※要確認）。',
    ],
  },
  {
    id: 'judo',
    name: '柔道整復師',
    kind: '国家資格',
    allowed: ['judo', 'manual', 'exercise', 'education', 'physical'],
    lawIds: ['law_judo19'],
    summary: '打撲・捻挫・挫傷・脱臼・骨折（応急手当）の施術を業として行える国家資格。',
    cautions: [
      '脱臼・骨折は応急手当を除き医師の同意が必要（※要確認）。',
      '慢性的な疲労・肩こり・腰痛などは療養費の対象外（自費）になる点に注意（※要確認）。',
      'あん摩マッサージ指圧・はり・きゅうは別免許。',
    ],
  },
  {
    id: 'seitai',
    name: '整体師・セラピスト（民間資格・無資格を含む）',
    kind: '民間資格',
    allowed: ['manual', 'exercise', 'education'],
    lawIds: ['law_anma217', 'law_ishi17'],
    summary: '国家資格ではないため、医業・医業類似行為と誤認される行為・表示に特に注意が必要。',
    cautions: [
      '診断・治療にあたる説明（「◯◯症です」「治します」）は行わない。',
      'あん摩・マッサージ・指圧、はり、きゅうにあたる行為は無免許で行えない（※要確認：手技の呼称ではなく実質で判断される）。',
      '骨格の矯正など強い力を加える手技は、事故時の責任が重い。異常があれば中止し受診をすすめる。',
    ],
  },
];

export const LICENSE_MAP = Object.fromEntries(LICENSES.map((l) => [l.id, l]));

export function licenseById(id) {
  return LICENSE_MAP[id] || null;
}
