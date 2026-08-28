// 経穴フラッシュカード（#7）。
// 表＝経穴名／裏＝経絡・分類・部位（取穴）・主治。figure は図（任意）。
// 361穴へ拡充中（現状：仮サンプル5枚＋督脈28穴の完全収録＝33枚）。
//
// sourceIds: 出典ID（未設定=[]）。将来361穴へ拡充する時、内容を裏付けた出典
// （例: lib/keiketsuLibrary.js に置いた教科書原文のページID、または書名）をここに残す。
// 空のままでも動作に影響しない（既存5枚は監修済みの仮データのため）。
//
// shuji（主治）について：『新版 経絡経穴概論（第2版）』は十四経脈上の361穴について
// 部位・取り方・解剖（筋枝/皮枝/血管）のみを記載し、主治（症状）は記載しない
// （主治が明記されるのは奇穴・新穴のみ）。そのため督脈28穴には shuji を null にし、
// 本書に無い情報を捏造しない（既存5枚の shuji は本書以外の出典に基づく可能性が高い
// ため据え置くが、督脈以降の新規追加分では本書の記載範囲を厳密に守る）。
//
// 督脈28穴の出典：新版 経絡経穴概論（第2版）p.26-39。

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
    sourceIds: [],
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
    sourceIds: [],
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
    sourceIds: [],
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
    sourceIds: [],
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
    sourceIds: [],
  },

  // ---- 督脈（GV）28穴（p.26-39・完全収録） ----
  {
    id: 'kc-gv1', name: '長強', yomi: 'ちょうきょう', meridian: '督脈', ryaku: 'GV1',
    type: '督脈の絡穴',
    location: '会陰部、尾骨の下方、尾骨端と肛門の中央。伏臥位または膝胸位で、尾骨下端の下方、肛門との間の陥凹に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv2', name: '腰兪', yomi: 'ようゆ', meridian: '督脈', ryaku: 'GV2', type: null,
    location: '仙骨部、後正中線上、仙骨裂孔。殿裂の直上に仙骨裂孔を触れ、その陥凹中に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv3', name: '腰陽関', yomi: 'こしようかん', meridian: '督脈', ryaku: 'GV3', type: null,
    location: '腰部、後正中線上、第4腰椎棘突起下方の陥凹部。左右の腸骨稜最高点を結ぶ線（ヤコビー線）と脊柱との交点が第4腰椎棘突起の目安。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv4', name: '命門', yomi: 'めいもん', meridian: '督脈', ryaku: 'GV4', type: null,
    location: '腰部、後正中線上、第2腰椎棘突起下方の陥凹部。左右の第12肋骨先端を結ぶ線と脊柱との交点が第2腰椎棘突起の目安。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv5', name: '懸枢', yomi: 'けんすう', meridian: '督脈', ryaku: 'GV5', type: null,
    location: '腰部、後正中線上、第1腰椎棘突起下方の陥凹部。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv6', name: '脊中', yomi: 'せきちゅう', meridian: '督脈', ryaku: 'GV6', type: null,
    location: '上背部、後正中線上、第11胸椎棘突起下方の陥凹部（第11・第12胸椎棘突起間）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv7', name: '中枢', yomi: 'ちゅうすう', meridian: '督脈', ryaku: 'GV7', type: null,
    location: '上背部、後正中線上、第10胸椎棘突起下方の陥凹部。左右の肩甲骨下角を結ぶ線と脊柱との交点が第7胸椎棘突起の目安。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv8', name: '筋縮', yomi: 'きんしゅく', meridian: '督脈', ryaku: 'GV8', type: null,
    location: '上背部、後正中線上、第9胸椎棘突起下方の陥凹部（第7胸椎棘突起を基準に取る）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv9', name: '至陽', yomi: 'しよう', meridian: '督脈', ryaku: 'GV9', type: null,
    location: '上背部、後正中線上、第7胸椎棘突起下方の陥凹部。左右の肩甲骨下角を結ぶ線と脊柱との交点が目安。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv10', name: '霊台', yomi: 'れいだい', meridian: '督脈', ryaku: 'GV10', type: null,
    location: '上背部、後正中線上、第6胸椎棘突起下方の陥凹部。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv11', name: '神道', yomi: 'しんどう', meridian: '督脈', ryaku: 'GV11', type: null,
    location: '上背部、後正中線上、第5胸椎棘突起下方の陥凹部。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv12', name: '身柱', yomi: 'しんちゅう', meridian: '督脈', ryaku: 'GV12', type: null,
    location: '上背部、後正中線上、第3胸椎棘突起下方の陥凹部。左右の肩甲棘内端を結ぶ線と脊柱との交点が目安。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv13', name: '陶道', yomi: 'とうどう', meridian: '督脈', ryaku: 'GV13', type: null,
    location: '上背部、後正中線上、第1胸椎棘突起下方の陥凹部。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv14', name: '大椎', yomi: 'だいつい', meridian: '督脈', ryaku: 'GV14',
    type: '督脈・手の陽明大腸経・足の陽明胃経・手の太陽小腸経・足の太陽膀胱経・手の少陽三焦経・足の少陽胆経の交会穴',
    location: '後頭部、後正中線上、第7頸椎棘突起下方の陥凹部。頭部を軽く前屈・回旋させ、最も突出する棘突起（第7頸椎）を目安に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv15', name: '瘂門', yomi: 'あもん', meridian: '督脈', ryaku: 'GV15', type: null,
    location: '後頸部、後正中線上、第2頸椎棘突起上方の陥凹部（風府の下方5分）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv16', name: '風府', yomi: 'ふうふ', meridian: '督脈', ryaku: 'GV16', type: null,
    location: '後頭部、後正中線上、外後頭隆起の直下、左右の僧帽筋間の陥凹部。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv17', name: '脳戸', yomi: 'のうこ', meridian: '督脈', ryaku: 'GV17', type: null,
    location: '頭部、後正中線上、外後頭隆起上方の陥凹部。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv18', name: '強間', yomi: 'きょうかん', meridian: '督脈', ryaku: 'GV18', type: null,
    location: '頭部、後正中線上、後髪際の上方4寸。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv19', name: '後頂', yomi: 'ごちょう', meridian: '督脈', ryaku: 'GV19', type: null,
    location: '頭部、後正中線上、後髪際の上方5寸5分。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv20', name: '百会', yomi: 'ひゃくえ', meridian: '督脈', ryaku: 'GV20',
    type: '督脈・足の太陽膀胱経・手の少陽三焦経・足の厥陰肝経の交会穴',
    location: '頭部、前正中線上、前髪際の後方5寸（前後髪際を結ぶ線の中点の前方1寸が目安）。左右の耳介を前に折り、その上角を結ぶ線の中点でも取れる。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv21', name: '前頂', yomi: 'ぜんちょう', meridian: '督脈', ryaku: 'GV21', type: null,
    location: '頭部、前正中線上、前髪際の後方3寸5分。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv22', name: '顖会', yomi: 'しんえ', meridian: '督脈', ryaku: 'GV22', type: null,
    location: '頭部、前正中線上、前髪際の後方2寸。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv23', name: '上星', yomi: 'じょうせい', meridian: '督脈', ryaku: 'GV23', type: null,
    location: '頭部、前正中線上、前髪際の後方1寸。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv24', name: '神庭', yomi: 'しんてい', meridian: '督脈', ryaku: 'GV24', type: null,
    location: '頭部、前正中線上、前髪際の後方5分（前髪際が不明瞭な場合は眉間中点の上方3寸5分）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv25', name: '素髎', yomi: 'そりょう', meridian: '督脈', ryaku: 'GV25', type: null,
    location: '顔面部、鼻の尖端（鼻尖中央の陥凹部）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv26', name: '水溝', yomi: 'すいこう', meridian: '督脈', ryaku: 'GV26',
    type: '別説あり（2説併記）',
    location: '顔面部、人中溝の中点。〈別説〉人中溝の上から3分の1のところ。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv27', name: '兌端', yomi: 'だたん', meridian: '督脈', ryaku: 'GV27', type: null,
    location: '顔面部、上唇結節上縁の中点（皮膚と粘膜の移行部）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gv28', name: '齦交', yomi: 'ぎんこう', meridian: '督脈', ryaku: 'GV28', type: null,
    location: '顔面部、上歯齦、上唇小帯の接合部。上唇を上げ、上唇小帯と歯齦との移行部に取る。',
    shuji: null, figure: null, sourceIds: [],
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
