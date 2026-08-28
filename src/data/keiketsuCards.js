// 経穴フラッシュカード（#7）。
// 表＝経穴名／裏＝経絡・分類・部位（取穴）・主治。figure は図（任意）。
// 361穴へ拡充中（現状：仮サンプル5枚＋督脈28穴＋任脈24穴＋手の太陰肺経11穴の完全収録＝68枚）。
//
// sourceIds: 出典ID（未設定=[]）。将来361穴へ拡充する時、内容を裏付けた出典
// （例: lib/keiketsuLibrary.js に置いた教科書原文のページID、または書名）をここに残す。
// 空のままでも動作に影響しない（既存5枚は監修済みの仮データのため）。
//
// shuji（主治）について：『新版 経絡経穴概論（第2版）』は十四経脈上の361穴について
// 部位・取り方・解剖（筋枝/皮枝/血管）のみを記載し、主治（症状）は記載しない
// （主治が明記されるのは奇穴・新穴のみ）。そのため督脈・任脈の穴には shuji を null にし、
// 本書に無い情報を捏造しない（既存5枚の shuji は本書以外の出典に基づく可能性が高い
// ため据え置くが、督脈以降の新規追加分では本書の記載範囲を厳密に守る）。
//
// 督脈28穴の出典：新版 経絡経穴概論（第2版）p.26-39。
// 任脈24穴の出典：同書 p.42-51。
// 手の太陰肺経11穴の出典：同書 p.52-59。

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

  // ---- 任脈（CV）24穴（p.42-51・完全収録） ----
  {
    id: 'kc-cv1', name: '会陰', yomi: 'えいん', meridian: '任脈', ryaku: 'CV1', type: null,
    location: '会陰部。男性は陰嚢根部と肛門を結ぶ線の中点、女性は後陰唇交連と肛門を結ぶ線の中点。側臥位または膝胸位で取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-cv2', name: '曲骨', yomi: 'きょくこつ', meridian: '任脈', ryaku: 'CV2', type: null,
    location: '下腹部、前正中線上、恥骨結合上縁の中点（神闕から曲骨までの長さを5寸とする）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-cv3', name: '中極', yomi: 'ちゅうきょく', meridian: '任脈', ryaku: 'CV3', type: '膀胱の募穴',
    location: '下腹部、前正中線上、臍中央の下方4寸。神闕の下方4寸、曲骨の上方1寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-cv4', name: '関元', yomi: 'かんげん', meridian: '任脈', ryaku: 'CV4', type: '小腸の募穴',
    location: '下腹部、前正中線上、臍中央の下方3寸。神闕と曲骨とを結ぶ線の中点の下方5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-cv5', name: '石門', yomi: 'せきもん', meridian: '任脈', ryaku: 'CV5', type: '三焦の募穴',
    location: '下腹部、前正中線上、臍中央の下方2寸。神闕と曲骨とを結ぶ線の中点の上方5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-cv6', name: '気海', yomi: 'きかい', meridian: '任脈', ryaku: 'CV6', type: null,
    location: '下腹部、前正中線上、臍中央の下方1寸5分。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-cv7', name: '陰交', yomi: 'いんこう', meridian: '任脈', ryaku: 'CV7', type: null,
    location: '下腹部、前正中線上、臍中央の下方1寸。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-cv8', name: '神闕', yomi: 'しんけつ', meridian: '任脈', ryaku: 'CV8', type: null,
    location: '上腹部、臍の中央（中庭から神闕までの長さを8寸とする）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-cv9', name: '水分', yomi: 'すいぶん', meridian: '任脈', ryaku: 'CV9', type: null,
    location: '上腹部、前正中線上、臍中央の上方1寸。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-cv10', name: '下脘', yomi: 'げかん', meridian: '任脈', ryaku: 'CV10', type: null,
    location: '上腹部、前正中線上、臍中央の上方2寸。中庭と神闕とを結ぶ線を4等分し、神闕から4分の1のところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-cv11', name: '建里', yomi: 'けんり', meridian: '任脈', ryaku: 'CV11', type: null,
    location: '上腹部、前正中線上、臍中央の上方3寸。中脘の下方1寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-cv12', name: '中脘', yomi: 'ちゅうかん', meridian: '任脈', ryaku: 'CV12', type: '胃の募穴・八会穴の腑会',
    location: '上腹部、前正中線上、臍中央の上方4寸。中庭と神闕とを結ぶ線の中点に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-cv13', name: '上脘', yomi: 'じょうかん', meridian: '任脈', ryaku: 'CV13', type: null,
    location: '上腹部、前正中線上、臍中央の上方5寸。中脘の上方1寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-cv14', name: '巨闕', yomi: 'こけつ', meridian: '任脈', ryaku: 'CV14', type: '心の募穴',
    location: '上腹部、前正中線上、臍中央の上方6寸。中庭と神闕とを結ぶ線を4等分し、中庭から4分の1のところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-cv15', name: '鳩尾', yomi: 'きゅうび', meridian: '任脈', ryaku: 'CV15', type: '任脈の絡穴',
    location: '上腹部、前正中線上、胸骨体下端の下方1寸（中庭の下方1寸）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-cv16', name: '中庭', yomi: 'ちゅうてい', meridian: '任脈', ryaku: 'CV16', type: null,
    location: '前胸部、前正中線上、胸骨体下端の中点。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-cv17', name: '膻中', yomi: 'だんちゅう', meridian: '任脈', ryaku: 'CV17', type: '心包の募穴・八会穴の気会',
    location: '前胸部、前正中線上、第4肋間と同じ高さ。胸骨角（第2肋骨の高さ）を基準に取る。胸骨裂孔がある場合があるため刺鍼に注意。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-cv18', name: '玉堂', yomi: 'ぎょくどう', meridian: '任脈', ryaku: 'CV18', type: null,
    location: '前胸部、前正中線上、第3肋間と同じ高さ。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-cv19', name: '紫宮', yomi: 'しきゅう', meridian: '任脈', ryaku: 'CV19', type: null,
    location: '前胸部、前正中線上、第2肋間と同じ高さ（胸骨角の下方）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-cv20', name: '華蓋', yomi: 'かがい', meridian: '任脈', ryaku: 'CV20', type: null,
    location: '前胸部、前正中線上、第1肋間と同じ高さ（胸骨角と胸鎖関節の高さのほぼ中央）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-cv21', name: '璇璣', yomi: 'せんき', meridian: '任脈', ryaku: 'CV21', type: null,
    location: '前胸部、前正中線上、頸窩（胸骨上窩）の下方1寸（天突の下方1寸）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-cv22', name: '天突', yomi: 'てんとつ', meridian: '任脈', ryaku: 'CV22', type: null,
    location: '前頸部、前正中線上、頸窩（胸骨上窩）の中央。左右の鎖骨内端の間で最もくぼんだところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-cv23', name: '廉泉', yomi: 'れんせん', meridian: '任脈', ryaku: 'CV23', type: null,
    location: '前頸部、前正中線上、喉頭隆起上方、舌骨の上方陥凹部。頸部を軽く後屈して舌骨を触れ、その上際に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-cv24', name: '承漿', yomi: 'しょうしょう', meridian: '任脈', ryaku: 'CV24', type: null,
    location: '顔面部、オトガイ唇溝中央の陥凹部。',
    shuji: null, figure: null, sourceIds: [],
  },

  // ---- 手の太陰肺経（LU）11穴（p.52-59・完全収録） ----
  {
    id: 'kc-lu1', name: '中府', yomi: 'ちゅうふ', meridian: '手の太陰肺経', ryaku: 'LU1', type: '肺の募穴',
    location: '前胸部、第1肋間と同じ高さ、鎖骨下窩の外側、前正中線の外方6寸。雲門の下方1寸、鎖骨下窩で大胸筋の張ったところよりやや上方に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-lu2', name: '雲門', yomi: 'うんもん', meridian: '手の太陰肺経', ryaku: 'LU2', type: null,
    location: '前胸部、鎖骨下窩の陥凹部、烏口突起の内方、前正中線の外方6寸。上肢を前に挙げて、鎖骨中央のやや外方下方にできる陥凹部に取る（腋窩動脈が深部を通る）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-lu3', name: '天府', yomi: 'てんぷ', meridian: '手の太陰肺経', ryaku: 'LU3', type: null,
    location: '上腕前外側、上腕二頭筋外側縁、腋窩横紋前端の下方3寸（腋窩横紋前端から尺沢までを9寸として3等分した上方1/3）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-lu4', name: '侠白', yomi: 'きょうはく', meridian: '手の太陰肺経', ryaku: 'LU4', type: null,
    location: '上腕前外側、上腕二頭筋外側縁、腋窩横紋前端の下方4寸（天府の下方1寸）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-lu5', name: '尺沢', yomi: 'しゃくたく', meridian: '手の太陰肺経', ryaku: 'LU5', type: '肺経の合水穴',
    location: '肘前部、肘窩横紋上、上腕二頭筋腱外方の陥凹部。肘を軽く曲げて上腕二頭筋腱を緊張させ、その外側陥凹部に取る（尺沢から太淵までの長さを1尺2寸とする）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-lu6', name: '孔最', yomi: 'こうさい', meridian: '手の太陰肺経', ryaku: 'LU6', type: '肺経の郄穴',
    location: '前腕前外側、尺沢と太淵を結ぶ線上、手関節掌側横紋の上方7寸（尺沢と太淵の中点の上方1寸）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    // 教科書の印字は「列欠」（欠）だが、アプリ内では既存データ・過去問収録が
    // すべて「列缺」（缺）で統一されているため、表記ゆれを防ぐためこちらに合わせる
    // （同じ経穴の異体字であり、事実としての違いはない）。
    id: 'kc-lu7', name: '列缺', yomi: 'れっけつ', meridian: '手の太陰肺経', ryaku: 'LU7', type: '肺経の絡穴・四総穴・八脈交会穴',
    location: '前腕橈側、長母指外転筋腱と短母指伸筋腱の間、手関節掌側横紋の上方1寸5分。太淵の上方1寸5分で、母指を外転・伸展させてできる腱の間の溝に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-lu8', name: '経渠', yomi: 'けいきょ', meridian: '手の太陰肺経', ryaku: 'LU8', type: '肺経の経金穴',
    location: '前腕前外側、橈骨下端の橈側で最も突出した部位と橈骨動脈の間、手関節掌側横紋の上方1寸（太淵の上方1寸）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-lu9', name: '太淵', yomi: 'たいえん', meridian: '手の太陰肺経', ryaku: 'LU9', type: '肺の原穴・肺経の兪土穴・八会穴の脈会',
    location: '手関節前外側、橈骨茎状突起と舟状骨の間、長母指外転筋腱の尺側陥凹部。手関節前面横紋上で橈骨動脈拍動部に取る（太淵・大陵・神門は手関節掌側横紋上に並ぶ）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-lu10', name: '魚際', yomi: 'ぎょさい', meridian: '手の太陰肺経', ryaku: 'LU10', type: '肺経の榮火穴',
    location: '手掌、第1中手骨中点の橈側、赤白肉際。第1中手骨中点の外側、手掌と手背の境目に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-lu11', name: '少商', yomi: 'しょうしょう', meridian: '手の太陰肺経', ryaku: 'LU11', type: '肺経の井木穴',
    location: '母指、末節骨橈側、爪甲角の近位外方1分。母指爪根部近位縁に引いた線と外側縁に引いた線との交点に取る。',
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
