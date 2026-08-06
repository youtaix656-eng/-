// 経穴フラッシュカード（#7）の仮サンプル（5枚）。
// 表＝経穴名／裏＝経絡・分類・部位（取穴）・主治。figure は図（任意）。
// 今は「項目（枠）＋サンプル5枚」。今後、361穴へ拡充予定。

export const KEIKETSU_CARDS = [
  {
    id: 'kc-goukoku',
    name: '合谷',
    yomi: 'ごうこく',
    meridian: '手陽明大腸経',
    ryaku: 'LI4',
    type: '原穴',
    location: '第1・第2中手骨間、第2中手骨中点の橈側。',
    shuji: '頭・顔・口の症状（頭痛・歯痛・鼻疾患）、発汗調整。四総穴「面口は合谷」。',
    figure: 'hand-goukoku',
  },
  {
    id: 'kc-sanri',
    name: '足三里',
    yomi: 'あしさんり',
    meridian: '足陽明胃経',
    ryaku: 'ST36',
    type: '合土穴・胃の下合穴',
    location: '犢鼻（膝眼）の下3寸、脛骨稜の外方1寸、前脛骨筋上。',
    shuji: '胃腸症状（消化不良・下痢）、全身の強壮。四総穴「肚腹は三里」。',
    figure: 'leg-sanri',
  },
  {
    id: 'kc-kyokuchi',
    name: '曲池',
    yomi: 'きょくち',
    meridian: '手陽明大腸経',
    ryaku: 'LI11',
    type: '合土穴',
    location: '肘を曲げてできる横紋の外端（尺沢と上腕骨外側上顆を結ぶ中点）。',
    shuji: '肘の痛み、皮膚疾患、発熱、高血圧。上肢の代表的な要穴。',
    figure: null,
  },
  {
    id: 'kc-saninkou',
    name: '三陰交',
    yomi: 'さんいんこう',
    meridian: '足太陰脾経',
    ryaku: 'SP6',
    type: '脾・肝・腎の交会穴',
    location: '内果尖の上3寸、脛骨内縁の後際。',
    shuji: '婦人科症状（月経異常）、泌尿・消化器。妊婦への刺激は慎重に。',
    figure: null,
  },
  {
    id: 'kc-taisho',
    name: '太衝',
    yomi: 'たいしょう',
    meridian: '足厥陰肝経',
    ryaku: 'LR3',
    type: '原穴・兪土穴',
    location: '足背、第1・第2中足骨間の後方の陥凹部。',
    shuji: '肝の症状（イライラ・目の症状・頭痛）、月経不順。原穴として肝の変動に。',
    figure: null,
  },
];

// 参考：四総穴（表）。フラッシュカード画面下部の早見表に使う。
export const YOUKETSU_TABLE = {
  title: '四総穴（覚えておきたい要穴の表）',
  columns: ['部位・主治', '経穴'],
  rows: [
    ['肚腹（腹部）', '足三里'],
    ['腰背（腰・背中）', '委中'],
    ['頭項（頭・首）', '列缺'],
    ['面口（顔・口）', '合谷'],
  ],
};
