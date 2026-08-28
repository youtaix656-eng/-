// 経穴フラッシュカード（#7）。
// 表＝経穴名／裏＝経絡・分類・部位（取穴）・主治。figure は図（任意）。
// 361穴を完全収録（仮サンプル5枚＋督脈28穴＋任脈24穴＋手の太陰肺経11穴＋
// 手の陽明大腸経20穴＋足の陽明胃経45穴＋足の太陰脾経21穴＋手の少陰心経9穴＋
// 手の太陽小腸経19穴＋足の太陽膀胱経67穴＋足の少陰腎経27穴＋手の厥陰心包経9穴＋
// 手の少陽三焦経23穴＋足の少陽胆経44穴＋足の厥陰肝経14穴＝361枚。2026-08-28完了。
// 合谷・曲池・足三里・三陰交・太衝は仮サンプルと重複するため各経で新規追加枚数のみ
// カウントしている）。
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
// 手の陽明大腸経20穴の出典：同書 p.60-71。
// 足の陽明胃経45穴の出典：同書 p.72-91。
// 足の太陰脾経21穴の出典：同書 p.92-103。
// 手の少陰心経9穴の出典：同書 p.104-109。
// 手の太陽小腸経19穴の出典：同書 p.110-119。
// 足の太陽膀胱経67穴の出典：同書 p.120-149。
// 足の少陰腎経27穴の出典：同書 p.150-163。
// 手の厥陰心包経9穴の出典：同書 p.164-169。
// 手の少陽三焦経23穴の出典：同書 p.170-181。
// 足の少陽胆経44穴の出典：同書 p.182-201。
// 足の厥陰肝経14穴の出典：同書 p.202-208。

export const KEIKETSU_CARDS = [
  {
    id: 'kc-goukoku',
    name: '合谷',
    yomi: 'ごうこく',
    meridian: '手の陽明大腸経',
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
    meridian: '足の陽明胃経',
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
    meridian: '手の陽明大腸経',
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
    meridian: '足の太陰脾経',
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
    meridian: '足の厥陰肝経',
    ryaku: 'LR3',
    type: '原穴・兪土穴',
    location: '足背、第1・第2中足骨底接合部の遠位、陥凹部。足背動脈拍動部にあたる。第1・第2中足骨間を指頭で撫で上げたとき、指が止まるところで、足背動脈の拍動部に取る。',
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

  // ---- 手の陽明大腸経（LI）20穴（p.60-71・完全収録） ----
  // LI4（合谷＝kc-goukoku）とLI11（曲池＝kc-kyokuchi）は既存の仮サンプルカードで
  // 収録済みのため、ここでは残り18穴を追加する（重複防止）。
  {
    id: 'kc-li1', name: '商陽', yomi: 'しょうよう', meridian: '手の陽明大腸経', ryaku: 'LI1', type: '大腸経の井金穴',
    location: '示指、末節骨橈側、爪甲角の近位外方1分。示指爪根部近位縁に引いた線と外側縁に引いた線との交点に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-li2', name: '二間', yomi: 'じかん', meridian: '手の陽明大腸経', ryaku: 'LI2', type: '大腸経の榮水穴',
    location: '示指、第2中手指節関節橈側の遠位陥凹部、赤白肉際。関節の外側を触診し、下部に触れる陥凹中、表裏の境目に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-li3', name: '三間', yomi: 'さんかん', meridian: '手の陽明大腸経', ryaku: 'LI3', type: '大腸経の兪木穴',
    location: '手背、第2中手指節関節橈側の近位陥凹部。第2中手骨の外側縁を指頭で撫で下ろし、指が止まるところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-li5', name: '陽渓', yomi: 'ようけい', meridian: '手の陽明大腸経', ryaku: 'LI5', type: '大腸経の経火穴',
    location: '手関節後外側、タバコ窩（橈骨小窩）の陥凹部、手関節背側横紋橈側。長母指伸筋腱と短母指伸筋腱の間で、母指を十分に外転・伸展させたときにできる（陽渓から曲池までの長さを1尺2寸とする）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-li6', name: '偏歴', yomi: 'へんれき', meridian: '手の陽明大腸経', ryaku: 'LI6', type: '大腸経の絡穴',
    location: '前腕後外側、陽渓と曲池を結ぶ線上、手関節背側横紋の上方3寸。陽渓と曲池を4等分し、陽渓から4分の1のところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-li7', name: '温溜', yomi: 'おんる', meridian: '手の陽明大腸経', ryaku: 'LI7', type: '大腸経の郄穴',
    location: '前腕後外側、陽渓と曲池を結ぶ線上、手関節背側横紋の上方5寸。陽渓と曲池の中点の下方1寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-li8', name: '下廉', yomi: 'げれん', meridian: '手の陽明大腸経', ryaku: 'LI8', type: null,
    location: '前腕後外側、陽渓と曲池を結ぶ線上、肘窩横紋の下方4寸。陽渓と曲池を3等分し、曲池から3分の1のところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-li9', name: '上廉', yomi: 'じょうれん', meridian: '手の陽明大腸経', ryaku: 'LI9', type: null,
    location: '前腕後外側、陽渓と曲池を結ぶ線上、肘窩横紋の下方3寸。陽渓と曲池を4等分し、曲池から4分の1のところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-li10', name: '手三里', yomi: 'てさんり', meridian: '手の陽明大腸経', ryaku: 'LI10', type: null,
    location: '前腕後外側、陽渓と曲池を結ぶ線上、肘窩横紋の下方2寸（曲池の下方2寸）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-li12', name: '肘髎', yomi: 'ちゅうりょう', meridian: '手の陽明大腸経', ryaku: 'LI12', type: null,
    location: '肘後外側、上腕骨外側上顆の上縁、外側顆上稜の前縁。曲池の後上方で、上腕骨の外側顆上稜の前縁に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-li13', name: '手五里', yomi: 'てごり', meridian: '手の陽明大腸経', ryaku: 'LI13', type: null,
    location: '上腕外側、曲池と肩髃を結ぶ線上、肘窩横紋の上方3寸。上腕三頭筋の外側縁に取る（深部を橈骨神経幹が通る）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-li14', name: '臂臑', yomi: 'ひじゅ', meridian: '手の陽明大腸経', ryaku: 'LI14', type: null,
    location: '上腕外側、三角筋前縁、曲池の上方7寸。三角筋の前縁に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-li15', name: '肩髃', yomi: 'けんぐう', meridian: '手の陽明大腸経', ryaku: 'LI15', type: '陽蹻脈の所属経穴（借穴）',
    location: '肩周囲部、肩峰外縁の前端と上腕骨大結節の間の陥凹部。肩関節を90度外転したとき、肩峰の前後にできる2つの陥凹部のうち前の陥凹部に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-li16', name: '巨骨', yomi: 'ここつ', meridian: '手の陽明大腸経', ryaku: 'LI16', type: '陽蹻脈の所属経穴（借穴）',
    location: '肩周囲部、鎖骨の肩峰端と肩甲棘の間の陥凹部。棘上窩の外側で、鎖骨肩峰端と肩甲棘との間、肩鎖関節の後内方陥中に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-li17', name: '天鼎', yomi: 'てんてい', meridian: '手の陽明大腸経', ryaku: 'LI17', type: null,
    location: '前頸部、輪状軟骨と同じ高さ、胸鎖乳突筋の後縁。扶突の下方で胸鎖乳突筋の後縁に取る（水突＝胃経と同じ高さ）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-li18', name: '扶突', yomi: 'ふとつ', meridian: '手の陽明大腸経', ryaku: 'LI18', type: null,
    location: '前頸部、甲状軟骨上縁と同じ高さ、胸鎖乳突筋の前縁と後縁の間。下顎角の直下で胸鎖乳突筋中、人迎（胃経）の外方に取る（深部に内頸静脈があるため刺鍼に注意）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-li19', name: '禾髎', yomi: 'かりょう', meridian: '手の陽明大腸経', ryaku: 'LI19', type: '別説あり（2説併記）',
    location: '顔面部、人中溝中点と同じ高さ、鼻孔外縁の下方。水溝（督脈）の外方5分に取る。〈別説〉人中溝の上から3分の1と同じ高さ。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-li20', name: '迎香', yomi: 'げいこう', meridian: '手の陽明大腸経', ryaku: 'LI20', type: '別説あり（2説併記）',
    location: '顔面部、鼻唇溝中、鼻翼外縁中点と同じ高さ。〈別説〉鼻翼下縁の高さ。',
    shuji: null, figure: null, sourceIds: [],
  },

  // ---- 足の陽明胃経（ST）45穴（p.72-91・完全収録） ----
  // ST36（足三里＝kc-sanri）は既存の仮サンプルカードで収録済みのため、
  // ここでは残り44穴を追加する（重複防止）。
  {
    id: 'kc-st1', name: '承泣', yomi: 'しょうきゅう', meridian: '足の陽明胃経', ryaku: 'ST1', type: null,
    location: '顔面部、眼球と眼窩下縁の間、瞳孔線上。正視させて瞳孔を通る垂線上で、眼球と眼窩下縁の間に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st2', name: '四白', yomi: 'しはく', meridian: '足の陽明胃経', ryaku: 'ST2', type: null,
    location: '顔面部、眼窩下孔部。正視させて承泣の下方で骨が陥凹しているところに取る（眼窩下神経の出る部）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st3', name: '巨髎', yomi: 'こりょう', meridian: '足の陽明胃経', ryaku: 'ST3', type: null,
    location: '顔面部、瞳孔線上、鼻翼下縁と同じ高さ。瞳孔を通る垂線と、鼻翼下端から横に引いた線との交点に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st4', name: '地倉', yomi: 'ちそう', meridian: '足の陽明胃経', ryaku: 'ST4', type: null,
    location: '顔面部、口角の外方4分（指寸）。鼻唇溝あるいはその延長線上に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st5', name: '大迎', yomi: 'だいげい', meridian: '足の陽明胃経', ryaku: 'ST5', type: null,
    location: '顔面部、下顎角の前方、咬筋付着部の前方陥凹部、顔面動脈上。下顎角から下顎体に沿って指を前方に進め、顔面動脈拍動部に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st6', name: '頬車', yomi: 'きょうしゃ', meridian: '足の陽明胃経', ryaku: 'ST6', type: null,
    location: '顔面部、下顎角の前上方1横指（中指）。歯を噛み締めると咬筋が緊張し、力を抜くと陥凹するところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st7', name: '下関', yomi: 'げかん', meridian: '足の陽明胃経', ryaku: 'ST7', type: null,
    location: '顔面部、頬骨弓の下縁中点と下顎切痕の間の陥凹部。口を閉じてできる陥凹に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st8', name: '頭維', yomi: 'ずい', meridian: '足の陽明胃経', ryaku: 'ST8', type: null,
    location: '頭部、額角髪際の直上5分、前正中線の外方4寸5分。神庭（督脈）の外方4寸5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st9', name: '人迎', yomi: 'じんげい', meridian: '足の陽明胃経', ryaku: 'ST9', type: null,
    location: '前頸部、甲状軟骨上縁と同じ高さ、胸鎖乳突筋の前縁、総頸動脈上。胸鎖乳突筋の前縁で総頸動脈拍動部に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st10', name: '水突', yomi: 'すいとつ', meridian: '足の陽明胃経', ryaku: 'ST10', type: null,
    location: '前頸部、輪状軟骨と同じ高さ、胸鎖乳突筋の前縁。人迎の下方で胸鎖乳突筋の前縁に取る（天鼎＝大腸経と同じ高さ）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st11', name: '気舎', yomi: 'きしゃ', meridian: '足の陽明胃経', ryaku: 'ST11', type: null,
    location: '前頸部、小鎖骨上窩で鎖骨胸骨端の上方、胸鎖乳突筋の胸骨頭と鎖骨頭の間の陥凹部。鎖骨内端の上部で胸鎖乳突筋の二頭間に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st12', name: '欠盆', yomi: 'けつぼん', meridian: '足の陽明胃経', ryaku: 'ST12', type: null,
    location: '前頸部、大鎖骨上窩、前正中線の外方4寸、鎖骨上方の陥凹部（肺尖部に近く気胸に注意）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st13', name: '気戸', yomi: 'きこ', meridian: '足の陽明胃経', ryaku: 'ST13', type: null,
    location: '前胸部、鎖骨下縁、前正中線の外方4寸。鎖骨の下縁と乳頭線との交点に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st14', name: '庫房', yomi: 'こぼう', meridian: '足の陽明胃経', ryaku: 'ST14', type: null,
    location: '前胸部、第1肋間、前正中線の外方4寸。華蓋（任脈）から第1肋間に沿って外方4寸、乳頭線上に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st15', name: '屋翳', yomi: 'おくえい', meridian: '足の陽明胃経', ryaku: 'ST15', type: null,
    location: '前胸部、第2肋間、前正中線の外方4寸。紫宮（任脈）から第2肋間に沿って外方4寸、乳頭線上に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st16', name: '膺窓', yomi: 'ようそう', meridian: '足の陽明胃経', ryaku: 'ST16', type: null,
    location: '前胸部、第3肋間、前正中線の外方4寸。玉堂（任脈）から第3肋間に沿って外方4寸、乳頭線上に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st17', name: '乳中', yomi: 'にゅうちゅう', meridian: '足の陽明胃経', ryaku: 'ST17', type: null,
    location: '前胸部、乳頭中央。膻中（任脈）から第4肋間に沿って外方4寸、乳頭部中央に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st18', name: '乳根', yomi: 'にゅうこん', meridian: '足の陽明胃経', ryaku: 'ST18', type: null,
    location: '前胸部、第5肋間、前正中線の外方4寸、乳頭線上（女性では乳房下縁の中点）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st19', name: '不容', yomi: 'ふよう', meridian: '足の陽明胃経', ryaku: 'ST19', type: null,
    location: '上腹部、臍中央の上方6寸、前正中線の外方2寸。天枢の上方6寸、巨闕（任脈）の外方2寸で腹直筋中に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st20', name: '承満', yomi: 'しょうまん', meridian: '足の陽明胃経', ryaku: 'ST20', type: null,
    location: '上腹部、臍中央の上方5寸、前正中線の外方2寸。天枢の上方5寸、上脘（任脈）の外方2寸、腹直筋中に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st21', name: '梁門', yomi: 'りょうもん', meridian: '足の陽明胃経', ryaku: 'ST21', type: null,
    location: '上腹部、臍中央の上方4寸、前正中線の外方2寸。天枢の上方4寸、中脘（任脈）の外方2寸、腹直筋中に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st22', name: '関門', yomi: 'かんもん', meridian: '足の陽明胃経', ryaku: 'ST22', type: null,
    location: '上腹部、臍中央の上方3寸、前正中線の外方2寸。天枢の上方3寸、建里（任脈）の外方2寸、腹直筋中に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st23', name: '太乙', yomi: 'たいいつ', meridian: '足の陽明胃経', ryaku: 'ST23', type: null,
    location: '上腹部、臍中央の上方2寸、前正中線の外方2寸。天枢の上方2寸、下脘（任脈）の外方2寸、腹直筋中に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st24', name: '滑肉門', yomi: 'かつにくもん', meridian: '足の陽明胃経', ryaku: 'ST24', type: null,
    location: '上腹部、臍中央の上方1寸、前正中線の外方2寸。天枢の上方1寸、水分（任脈）の外方2寸、腹直筋中に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st25', name: '天枢', yomi: 'てんすう', meridian: '足の陽明胃経', ryaku: 'ST25', type: '大腸の募穴',
    location: '上腹部、臍中央の外方2寸。神闕（任脈）の外方2寸、腹直筋中に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st26', name: '外陵', yomi: 'がいりょう', meridian: '足の陽明胃経', ryaku: 'ST26', type: null,
    location: '下腹部、臍中央の下方1寸、前正中線の外方2寸。天枢の下方1寸、陰交（任脈）の外方2寸、腹直筋中に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st27', name: '大巨', yomi: 'たいこ', meridian: '足の陽明胃経', ryaku: 'ST27', type: null,
    location: '下腹部、臍中央の下方2寸、前正中線の外方2寸。天枢の下方2寸、石門（任脈）の外方2寸、腹直筋中に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st28', name: '水道', yomi: 'すいどう', meridian: '足の陽明胃経', ryaku: 'ST28', type: null,
    location: '下腹部、臍中央の下方3寸、前正中線の外方2寸。天枢の下方3寸、関元（任脈）の外方2寸、腹直筋中に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st29', name: '帰来', yomi: 'きらい', meridian: '足の陽明胃経', ryaku: 'ST29', type: null,
    location: '下腹部、臍中央の下方4寸、前正中線の外方2寸。天枢の下方4寸、中極（任脈）の外方2寸、腹直筋中に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st30', name: '気衝', yomi: 'きしょう', meridian: '足の陽明胃経', ryaku: 'ST30', type: null,
    location: '鼡径部、恥骨結合上縁と同じ高さ、前正中線の外方2寸、大腿動脈拍動部。天枢の下方5寸、曲骨（任脈）の外方2寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st31', name: '髀関', yomi: 'ひかん', meridian: '足の陽明胃経', ryaku: 'ST31', type: null,
    location: '大腿前面、大腿直筋・縫工筋・大腿筋膜張筋の近位部の間の陥凹部。上前腸骨棘と膝蓋骨底外端とを結ぶ線上、大転子頂点の高さに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st32', name: '伏兎', yomi: 'ふくと', meridian: '足の陽明胃経', ryaku: 'ST32', type: null,
    location: '大腿前外側、膝蓋骨底外端と上前腸骨棘を結ぶ線上、膝蓋骨底の上方6寸。膝蓋骨底外端から3分の1、大腿直筋の外縁に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st33', name: '陰市', yomi: 'いんし', meridian: '足の陽明胃経', ryaku: 'ST33', type: null,
    location: '大腿前外側、大腿直筋腱の外側で膝蓋骨底の上方3寸。膝蓋骨底外端の上方3寸、大腿直筋腱の外側縁に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st34', name: '梁丘', yomi: 'りょうきゅう', meridian: '足の陽明胃経', ryaku: 'ST34', type: '胃経の郄穴',
    location: '大腿前外側、外側広筋と大腿直筋外縁の間、膝蓋骨底の上方2寸。膝蓋骨底外端の上方2寸、外側広筋と大腿直筋腱との間に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st35', name: '犢鼻', yomi: 'とくび', meridian: '足の陽明胃経', ryaku: 'ST35', type: null,
    location: '膝前面、膝蓋靭帯外方の陥凹部。膝を軽く曲げたとき、膝蓋骨外下方にできる陥凹中に取る（犢鼻から解渓までの長さを1尺6寸とする）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st37', name: '上巨虚', yomi: 'じょうこきょ', meridian: '足の陽明胃経', ryaku: 'ST37', type: '大腸の下合穴',
    location: '下腿前面、犢鼻と解渓を結ぶ線上、犢鼻の下方6寸。条口の上方2寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st38', name: '条口', yomi: 'じょうこう', meridian: '足の陽明胃経', ryaku: 'ST38', type: null,
    location: '下腿前面、犢鼻と解渓を結ぶ線上、犢鼻の下方8寸。犢鼻と解渓との中点に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st39', name: '下巨虚', yomi: 'げこきょ', meridian: '足の陽明胃経', ryaku: 'ST39', type: '小腸の下合穴',
    location: '下腿前面、犢鼻と解渓を結ぶ線上、犢鼻の下方9寸。条口の下方1寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st40', name: '豊隆', yomi: 'ほうりゅう', meridian: '足の陽明胃経', ryaku: 'ST40', type: '胃経の絡穴',
    location: '下腿前外側、前脛骨筋の外縁、外果尖の上方8寸。条口の外方1横指（中指）、前脛骨筋の外縁に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st41', name: '解渓', yomi: 'かいけい', meridian: '足の陽明胃経', ryaku: 'ST41', type: '胃経の経火穴',
    location: '足関節前面中央の陥凹部、長母指伸筋腱と長指伸筋腱の間（内果尖と外果尖の中点にあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st42', name: '衝陽', yomi: 'しょうよう', meridian: '足の陽明胃経', ryaku: 'ST42', type: '胃の原穴',
    location: '足背、第2中足骨底と中間楔状骨の間、足背動脈拍動部に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st43', name: '陥谷', yomi: 'かんこく', meridian: '足の陽明胃経', ryaku: 'ST43', type: '胃経の兪木穴',
    location: '足背、第2・第3中足骨間、第2中足指節関節の近位陥凹部。第2中足指節関節の後外側陥凹中に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st44', name: '内庭', yomi: 'ないてい', meridian: '足の陽明胃経', ryaku: 'ST44', type: '胃経の榮水穴',
    location: '足背、第2・第3指間、みずかきの後縁、赤白肉際。第2・第3中足指節関節間の直前の陥凹部に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-st45', name: '厲兌', yomi: 'れいだ', meridian: '足の陽明胃経', ryaku: 'ST45', type: '胃経の井金穴',
    location: '足の第2指、末節骨外側、爪甲角の近位外方1分。足の第2指爪根部近位縁に引いた線と外側縁に引いた線との交点に取る。',
    shuji: null, figure: null, sourceIds: [],
  },

  // ---- 足の太陰脾経（SP）21穴（p.92-103・完全収録） ----
  // SP6（三陰交＝kc-saninkou）は既存の仮サンプルカードで収録済みのため、
  // ここでは残り20穴を追加する（重複防止）。
  {
    id: 'kc-sp1', name: '隠白', yomi: 'いんぱく', meridian: '足の太陰脾経', ryaku: 'SP1', type: '脾経の井木穴',
    location: '足の第1指、末節骨内側、爪甲角の近位内方1分。足の第1指爪根部近位縁に引いた線と内側縁に引いた線との交点に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-sp2', name: '大都', yomi: 'だいと', meridian: '足の太陰脾経', ryaku: 'SP2', type: '脾経の榮火穴',
    location: '足の第1指、第1中足指節関節内側の遠位陥凹部、赤白肉際。関節の内側を触察し前部に触れる陥凹中、表裏の境目に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-sp3', name: '太白', yomi: 'たいはく', meridian: '足の太陰脾経', ryaku: 'SP3', type: '脾の原穴・脾経の兪土穴',
    location: '足内側、第1中足指節関節内側の近位陥凹部、赤白肉際。第1中足骨の内側縁を後ろからつま先の方へ撫でていき指が止まるところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-sp4', name: '公孫', yomi: 'こうそん', meridian: '足の太陰脾経', ryaku: 'SP4', type: '脾経の絡穴・八脈交会穴',
    location: '足内側、第1中足骨底内側の遠位陥凹部、赤白肉際。太白から第1中足骨の内側縁に沿って後方へ撫で、指が止まるところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-sp5', name: '商丘', yomi: 'しょうきゅう', meridian: '足の太陰脾経', ryaku: 'SP5', type: '脾経の経金穴',
    location: '足内側、内果の前下方、舟状骨粗面と内果尖の中央陥凹部。内果前縁を通る垂線と内果下縁を通る水平線との交点に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-sp7', name: '漏谷', yomi: 'ろうこく', meridian: '足の太陰脾経', ryaku: 'SP7', type: null,
    location: '下腿内側（脛側）、脛骨内縁の後際、内果尖の上方6寸。内果尖と陰陵泉とを結ぶ線のほぼ中点の高さに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-sp8', name: '地機', yomi: 'ちき', meridian: '足の太陰脾経', ryaku: 'SP8', type: '脾経の郄穴',
    location: '下腿内側（脛側）、脛骨内縁の後際、陰陵泉の下方3寸。内果尖と膝蓋骨尖とを結ぶ線を3等分し、膝蓋骨尖から3分の1の高さに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-sp9', name: '陰陵泉', yomi: 'いんりょうせん', meridian: '足の太陰脾経', ryaku: 'SP9', type: '脾経の合水穴',
    location: '下腿内側（脛側）、脛骨内側顆下縁と脛骨内縁が接する陥凹部。脛骨内側縁を指頭で撫で上げ、指が止まるところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-sp10', name: '血海', yomi: 'けっかい', meridian: '足の太陰脾経', ryaku: 'SP10', type: null,
    location: '大腿前内側、内側広筋隆起部、膝蓋骨底内端の上方2寸。膝蓋骨底内側端の上方2寸で内側広筋の隆起部に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-sp11', name: '箕門', yomi: 'きもん', meridian: '足の太陰脾経', ryaku: 'SP11', type: null,
    location: '大腿内側、膝蓋骨底内端と衝門を結ぶ線上、衝門から3分の1、縫工筋と長内転筋の間、大腿動脈拍動部。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-sp12', name: '衝門', yomi: 'しょうもん', meridian: '足の太陰脾経', ryaku: 'SP12', type: null,
    location: '鼡径部、鼡径溝、大腿動脈拍動部の外方。曲骨（任脈）の外方で、府舎の内下方、大腿動脈拍動部の外方に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-sp13', name: '府舎', yomi: 'ふしゃ', meridian: '足の太陰脾経', ryaku: 'SP13', type: null,
    location: '下腹部、臍中央の下方4寸3分、前正中線の外方4寸。中極（任脈）の外方4寸のやや下方に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-sp14', name: '腹結', yomi: 'ふっけつ', meridian: '足の太陰脾経', ryaku: 'SP14', type: null,
    location: '下腹部、臍中央の下方1寸3分、前正中線の外方4寸。陰交（任脈）の外方4寸のやや下方に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-sp15', name: '大横', yomi: 'だいおう', meridian: '足の太陰脾経', ryaku: 'SP15', type: null,
    location: '上腹部、臍中央の外方4寸。神闕（任脈）の外方4寸に取る（肓兪＝腎経、天枢＝胃経と同じ高さ）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-sp16', name: '腹哀', yomi: 'ふくあい', meridian: '足の太陰脾経', ryaku: 'SP16', type: null,
    location: '上腹部、臍中央の上方3寸、前正中線の外方4寸。建里（任脈）の外方4寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-sp17', name: '食竇', yomi: 'しょくとく', meridian: '足の太陰脾経', ryaku: 'SP17', type: null,
    location: '前胸部、第5肋間、前正中線の外方6寸。第5肋間に沿って前正中線外方6寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-sp18', name: '天渓', yomi: 'てんけい', meridian: '足の太陰脾経', ryaku: 'SP18', type: null,
    location: '前胸部、第4肋間、前正中線の外方6寸。膻中（任脈）から第4肋間に沿って外方6寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-sp19', name: '胸郷', yomi: 'きょうきょう', meridian: '足の太陰脾経', ryaku: 'SP19', type: null,
    location: '前胸部、第3肋間、前正中線の外方6寸。玉堂（任脈）から第3肋間に沿って外方6寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-sp20', name: '周栄', yomi: 'しゅうえい', meridian: '足の太陰脾経', ryaku: 'SP20', type: null,
    location: '前胸部、第2肋間、前正中線の外方6寸。紫宮（任脈）から第2肋間に沿って外方6寸に取る（中府＝肺経の下方にあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-sp21', name: '大包', yomi: 'だいほう', meridian: '足の太陰脾経', ryaku: 'SP21', type: '脾の大絡の絡穴',
    location: '側胸部、第6肋間、中腋窩線上。側臥して肩関節を外転させ、中腋窩線上で第6肋間の高さに取る。',
    shuji: null, figure: null, sourceIds: [],
  },

  // ---- 手の少陰心経（HT）9穴（p.104-109・完全収録） ----
  {
    id: 'kc-ht1', name: '極泉', yomi: 'きょくせん', meridian: '手の少陰心経', ryaku: 'HT1', type: null,
    location: '腋窩、腋窩中央、腋窩動脈拍動部。腋窩の中央で腋窩動脈拍動部に取る（極泉から少海までの長さを9寸とする）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ht2', name: '青霊', yomi: 'せいれい', meridian: '手の少陰心経', ryaku: 'HT2', type: null,
    location: '上腕内側面、上腕二頭筋の内側縁、肘窩横紋の上方3寸。極泉と少海とを結ぶ線を3等分し、少海から3分の1のところ、上腕二頭筋の内側縁に取る（肩関節を外転・外旋すると取りやすい）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ht3', name: '少海', yomi: 'しょうかい', meridian: '手の少陰心経', ryaku: 'HT3', type: '心経の合水穴',
    location: '肘前内側、上腕骨内側上顆の前縁、肘窩横紋と同じ高さ。肘関節を屈曲し、上腕骨内側上顆と肘窩横紋の内側端との中点に取る（少海から神門までの長さを1尺2寸とする）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ht4', name: '霊道', yomi: 'れいどう', meridian: '手の少陰心経', ryaku: 'HT4', type: '心経の経金穴',
    location: '前腕前内側、尺側手根屈筋腱の橈側縁、手関節掌側横紋の上方1寸5分。神門の上方1寸5分で尺骨頭上縁の高さ、尺側手根屈筋腱の外側に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ht5', name: '通里', yomi: 'つうり', meridian: '手の少陰心経', ryaku: 'HT5', type: '心経の絡穴',
    location: '前腕前内側、尺側手根屈筋腱の橈側縁、手関節掌側横紋の上方1寸。神門の上方1寸で、尺側手根屈筋腱の外側に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ht6', name: '陰郄', yomi: 'いんげき', meridian: '手の少陰心経', ryaku: 'HT6', type: '心経の郄穴',
    location: '前腕前内側、尺側手根屈筋腱の橈側縁、手関節掌側横紋の上方5分。神門の上方5分で尺骨頭下縁の高さ、尺側手根屈筋腱の外側に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ht7', name: '神門', yomi: 'しんもん', meridian: '手の少陰心経', ryaku: 'HT7', type: '心の原穴・心経の兪土穴',
    location: '手関節前内側、尺側手根屈筋腱の橈側縁、手関節掌側横紋上。豆状骨上縁の橈側で、手関節前面横紋上、尺側手根屈筋腱の外側に取る（太淵＝肺経、大陵＝心包経、神門は手関節掌側横紋上に並ぶ）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ht8', name: '少府', yomi: 'しょうふ', meridian: '手の少陰心経', ryaku: 'HT8', type: '心経の榮火穴',
    location: '手掌、第5中手指節関節の近位端と同じ高さ、第4・第5中手骨の間。手掌で第4・第5中手間、こぶしを握ったとき小指頭があたるところに取る（労宮＝心包経と同じ高さ）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ht9', name: '少衝', yomi: 'しょうしょう', meridian: '手の少陰心経', ryaku: 'HT9', type: '心経の井木穴',
    location: '小指、末節骨橈側、爪甲角の近位外方1分（指寸）。小指爪根部近位縁に引いた線と、外側縁に引いた線との交点に取る。',
    shuji: null, figure: null, sourceIds: [],
  },

  // ---- 手の太陽小腸経（SI）19穴（p.110-119・完全収録） ----
  {
    id: 'kc-si1', name: '少沢', yomi: 'しょうたく', meridian: '手の太陽小腸経', ryaku: 'SI1', type: '小腸経の井金穴',
    location: '小指、末節骨尺側、爪甲角の近位内方1分（指寸）。小指爪根部近位縁に引いた線と、内側縁に引いた線との交点に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-si2', name: '前谷', yomi: 'ぜんこく', meridian: '手の太陽小腸経', ryaku: 'SI2', type: '小腸経の榮水穴',
    location: '小指、第5中手指節関節尺側の遠位陥凹部、赤白肉際。小指の中手指節関節の内側を触察し、その下部に触れる陥凹中に取る。またはこぶしを軽く握り、小指の中手指節関節にできる掌側横紋の尺側端に取る（表裏の境目）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-si3', name: '後渓', yomi: 'こうけい', meridian: '手の太陽小腸経', ryaku: 'SI3', type: '小腸経の兪木穴・八脈交会穴',
    location: '手背、第5中手指節関節尺側の近位陥凹部、赤白肉際。こぶしを軽く握り、小指の中手骨の内側縁を指頭で撫で下ろしたとき指が止まるところに取る。またはこぶしを軽く握り、手掌の横紋の尺側端に取る（表裏の境目）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-si4', name: '腕骨', yomi: 'わんこつ', meridian: '手の太陽小腸経', ryaku: 'SI4', type: '小腸の原穴',
    location: '手関節後内側、第5中手骨底と三角骨の間の陥凹部、赤白肉際。小指の中手骨の内側を指頭で撫で上げ、底を越えたところにある陥凹中、表裏の境目に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-si5', name: '陽谷', yomi: 'ようこく', meridian: '手の太陽小腸経', ryaku: 'SI5', type: '小腸経の経火穴',
    location: '手関節後内側、三角骨と尺骨茎状突起の間の陥凹部。尺側手根伸筋腱の内側に取る（陽谷から小海までの長さを1尺2寸とする。陽渓＝大腸経、陽池＝三焦経、陽谷＝小腸経は手関節背側横紋上に並ぶ）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-si6', name: '養老', yomi: 'ようろう', meridian: '手の太陽小腸経', ryaku: 'SI6', type: '小腸経の郄穴',
    location: '前腕後内側、尺骨頭橈側の陥凹部、手関節背側横紋の上方1寸。前腕を回内して手掌を下に向け、指で尺骨頭の頂点を押さえながら回外して手掌を胸につけると、指が滑り込む骨の割れ目に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-si7', name: '支正', yomi: 'しせい', meridian: '手の太陽小腸経', ryaku: 'SI7', type: '小腸経の絡穴',
    location: '前腕後内側、尺骨内縁と尺側手根屈筋の間、手関節背側横紋の上方5寸。手掌を胸にあて、陽谷と小海とを結ぶ線の中点の下方1寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-si8', name: '小海', yomi: 'しょうかい', meridian: '手の太陽小腸経', ryaku: 'SI8', type: '小腸経の合土穴',
    location: '肘後内側、肘頭と上腕骨内側上顆の間の陥凹部。肘関節を軽く屈曲し、尺骨神経溝中に取る（圧すると前腕内側から小指にひびく）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-si9', name: '肩貞', yomi: 'けんてい', meridian: '手の太陽小腸経', ryaku: 'SI9', type: null,
    location: '肩周囲部、肩関節の後下方、腋窩横紋後端の上方1寸。肩関節を内転し、腋窩横紋後端の上方1寸、三角筋の後側に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-si10', name: '臑兪', yomi: 'じゅゆ', meridian: '手の太陽小腸経', ryaku: 'SI10', type: null,
    location: '肩周囲部、腋窩横紋後端の上方、肩甲棘の下方陥凹部。肩関節を内転し、腋窩横紋後端の上方で肩甲棘の直下に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-si11', name: '天宗', yomi: 'てんそう', meridian: '手の太陽小腸経', ryaku: 'SI11', type: null,
    location: '肩甲部、肩甲棘の中点と肩甲骨下角を結んだ線上、肩甲棘から3分の1にある陥凹部。線を3等分し、肩甲棘から3分の1のところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-si12', name: '秉風', yomi: 'へいふう', meridian: '手の太陽小腸経', ryaku: 'SI12', type: null,
    location: '肩甲部、棘上窩、肩甲棘中点の上方。肩甲棘中央の直上で、肩関節を外転して陥凹するところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-si13', name: '曲垣', yomi: 'きょくえん', meridian: '手の太陽小腸経', ryaku: 'SI13', type: null,
    location: '肩甲部、肩甲棘内端の上方陥凹部。肩甲棘内端の直上で、棘上窩内側の隅の陥凹中に取る（臑兪と第2胸椎棘突起との中点にあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-si14', name: '肩外兪', yomi: 'けんがいゆ', meridian: '手の太陽小腸経', ryaku: 'SI14', type: null,
    location: '上背部、第1胸椎棘突起下縁と同じ高さ、後正中線の外方3寸。陶道（督脈）を通る水平線と肩甲骨内側縁の延長線との交点に取る（陶道の外方3寸、肩甲骨上角の内方にあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-si15', name: '肩中兪', yomi: 'けんちゅうゆ', meridian: '手の太陽小腸経', ryaku: 'SI15', type: null,
    location: '上背部、第7頸椎棘突起下縁と同じ高さ、後正中線の外方2寸。大椎（督脈）の外方2寸、肩外兪の内上方に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-si16', name: '天窓', yomi: 'てんそう', meridian: '手の太陽小腸経', ryaku: 'SI16', type: null,
    location: '前頸部、胸鎖乳突筋の後縁、甲状軟骨上縁と同じ高さ。胸鎖乳突筋の後縁、甲状軟骨上縁の高さで、胸鎖乳突筋をはさんで人迎（胃経）と同じ高さに取る（甲状軟骨上縁の高さで、胸鎖乳突筋の前縁に人迎＝胃経、中央に扶突＝大腸経、後縁に天窓が並ぶ）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-si17', name: '天容', yomi: 'てんよう', meridian: '手の太陽小腸経', ryaku: 'SI17', type: null,
    location: '前頸部、下顎角の後方、胸鎖乳突筋の前方陥凹部。下顎角の後方で、胸鎖乳突筋との間に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-si18', name: '顴髎', yomi: 'けんりょう', meridian: '手の太陽小腸経', ryaku: 'SI18', type: null,
    location: '顔面部、外眼角の直下、頬骨下方の陥凹部。外眼角を通る垂線上で頬骨下方の陥凹部に取る（下関＝胃経の前方にあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-si19', name: '聴宮', yomi: 'ちょうきゅう', meridian: '手の太陽小腸経', ryaku: 'SI19', type: null,
    location: '顔面部、耳珠中央の前縁と下顎骨関節突起の間の陥凹部。耳珠と下顎骨との間にある陥凹部で、下顎骨関節突起の後縁に取る（口をわずかに開けると取りやすい）。',
    shuji: null, figure: null, sourceIds: [],
  },

  // ---- 足の太陽膀胱経（BL）67穴（p.120-149・完全収録） ----
  {
    id: 'kc-bl1', name: '睛明', yomi: 'せいめい', meridian: '足の太陽膀胱経', ryaku: 'BL1', type: null,
    location: '顔面部、内眼角の内上方と眼窩内側壁の間の陥凹部。目を閉じて、内眼角の内上方1分の陥凹部に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl2', name: '攅竹', yomi: 'さんちく', meridian: '足の太陽膀胱経', ryaku: 'BL2', type: null,
    location: '頭部、眉毛内端の陥凹部。睛明の直上で、眉毛内端、前頭切痕の陥凹中に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl3', name: '眉衝', yomi: 'びしょう', meridian: '足の太陽膀胱経', ryaku: 'BL3', type: null,
    location: '頭部、前頭切痕の上方、前髪際の後方5分。神庭（督脈）と曲差との中点に取る（前髪際の後方5分には前正中線から、神庭、眉衝、曲差、頭臨泣＝胆経、本神＝胆経、頭維＝胃経が並ぶ）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl4', name: '曲差', yomi: 'きょくさ', meridian: '足の太陽膀胱経', ryaku: 'BL4', type: null,
    location: '頭部、前髪際の後方5分、前正中線の外方1寸5分。神庭と頭維とを結ぶ線を3等分し、神庭から3分の1のところに取る（神庭、曲差、本神、頭維を等間隔に取る）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl5', name: '五処', yomi: 'ごしょ', meridian: '足の太陽膀胱経', ryaku: 'BL5', type: null,
    location: '頭部、前髪際の後方1寸、前正中線の外方1寸5分。上星（督脈）の外方1寸5分、曲差の後方5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl6', name: '承光', yomi: 'しょうこう', meridian: '足の太陽膀胱経', ryaku: 'BL6', type: null,
    location: '頭部、前髪際の後方2寸5分、前正中線の外方1寸5分。前正中線の外方1寸5分、五処の後方1寸5分に取る（五処と絡却とを結ぶ線を3等分し、五処から3分の1のところにあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl7', name: '通天', yomi: 'つうてん', meridian: '足の太陽膀胱経', ryaku: 'BL7', type: null,
    location: '頭部、前髪際の後方4寸、前正中線の外方1寸5分。五処と絡却とを結ぶ線を3等分し、絡却から3分の1のところに取る（承光と絡却の中点にあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl8', name: '絡却', yomi: 'らっきゃく', meridian: '足の太陽膀胱経', ryaku: 'BL8', type: null,
    location: '頭部、前髪際の後方5寸5分、後正中線の外方1寸5分。百会の後方5分の外方1寸5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl9', name: '玉枕', yomi: 'ぎょくちん', meridian: '足の太陽膀胱経', ryaku: 'BL9', type: null,
    location: '頭部、外後頭隆起上縁と同じ高さ、後正中線の外方1寸3分。脳戸（督脈）の外方1寸3分で、頭半棘筋膨隆部の外縁を通る垂線と上項線との交点に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl10', name: '天柱', yomi: 'てんちゅう', meridian: '足の太陽膀胱経', ryaku: 'BL10', type: null,
    location: '後頸部、第2頸椎棘突起上縁と同じ高さ、僧帽筋外縁の陥凹部。瘂門（督脈）の外方で、頭半棘筋膨隆部の外縁に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl11', name: '大杼', yomi: 'だいじょ', meridian: '足の太陽膀胱経', ryaku: 'BL11', type: '八会穴の骨会',
    location: '上背部、第1胸椎棘突起下縁と同じ高さ、後正中線の外方1寸5分。陶道（督脈）の外方1寸5分に取る（大杼から白環兪までの経穴は、後正中線外方1寸5分とする）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl12', name: '風門', yomi: 'ふうもん', meridian: '足の太陽膀胱経', ryaku: 'BL12', type: null,
    location: '上背部、第2胸椎棘突起下縁と同じ高さ、後正中線の外方1寸5分。第2・第3胸椎棘突起間、外方1寸5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl13', name: '肺兪', yomi: 'はいゆ', meridian: '足の太陽膀胱経', ryaku: 'BL13', type: '肺の背部兪穴',
    location: '上背部、第3胸椎棘突起下縁と同じ高さ、後正中線の外方1寸5分。身柱（督脈）の外方1寸5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl14', name: '厥陰兪', yomi: 'けついんゆ', meridian: '足の太陽膀胱経', ryaku: 'BL14', type: '心包の背部兪穴',
    location: '上背部、第4胸椎棘突起下縁と同じ高さ、後正中線の外方1寸5分。第4・第5胸椎棘突起間、外方1寸5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl15', name: '心兪', yomi: 'しんゆ', meridian: '足の太陽膀胱経', ryaku: 'BL15', type: '心の背部兪穴',
    location: '上背部、第5胸椎棘突起下縁と同じ高さ、後正中線の外方1寸5分。神道（督脈）の外方1寸5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl16', name: '督兪', yomi: 'とくゆ', meridian: '足の太陽膀胱経', ryaku: 'BL16', type: null,
    location: '上背部、第6胸椎棘突起下縁と同じ高さ、後正中線の外方1寸5分。霊台（督脈）の外方1寸5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl17', name: '膈兪', yomi: 'かくゆ', meridian: '足の太陽膀胱経', ryaku: 'BL17', type: '八会穴の血会',
    location: '上背部、第7胸椎棘突起下縁と同じ高さ、後正中線の外方1寸5分。至陽（督脈）の外方1寸5分に取る（肩甲骨下角は第7胸椎棘突起と同じ高さにある）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl18', name: '肝兪', yomi: 'かんゆ', meridian: '足の太陽膀胱経', ryaku: 'BL18', type: '肝の背部兪穴',
    location: '上背部、第9胸椎棘突起下縁と同じ高さ、後正中線の外方1寸5分。筋縮（督脈）の外方1寸5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl19', name: '胆兪', yomi: 'たんゆ', meridian: '足の太陽膀胱経', ryaku: 'BL19', type: '胆の背部兪穴',
    location: '上背部、第10胸椎棘突起下縁と同じ高さ、後正中線の外方1寸5分。中枢（督脈）の外方1寸5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl20', name: '脾兪', yomi: 'ひゆ', meridian: '足の太陽膀胱経', ryaku: 'BL20', type: '脾の背部兪穴',
    location: '上背部、第11胸椎棘突起下縁と同じ高さ、後正中線の外方1寸5分。脊中（督脈）の外方1寸5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl21', name: '胃兪', yomi: 'いゆ', meridian: '足の太陽膀胱経', ryaku: 'BL21', type: '胃の背部兪穴',
    location: '上背部、第12胸椎棘突起下縁と同じ高さ、後正中線の外方1寸5分。第12胸椎・第1腰椎棘突起間、外方1寸5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl22', name: '三焦兪', yomi: 'さんしょうゆ', meridian: '足の太陽膀胱経', ryaku: 'BL22', type: '三焦の背部兪穴',
    location: '腰部、第1腰椎棘突起下縁と同じ高さ、後正中線の外方1寸5分。懸枢（督脈）の外方1寸5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl23', name: '腎兪', yomi: 'じんゆ', meridian: '足の太陽膀胱経', ryaku: 'BL23', type: '腎の背部兪穴',
    location: '腰部、第2腰椎棘突起下縁と同じ高さ、後正中線の外方1寸5分。命門（督脈）の外方1寸5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl24', name: '気海兪', yomi: 'きかいゆ', meridian: '足の太陽膀胱経', ryaku: 'BL24', type: null,
    location: '腰部、第3腰椎棘突起下縁と同じ高さ、後正中線の外方1寸5分。第3・第4腰椎棘突起間、外方1寸5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl25', name: '大腸兪', yomi: 'だいちょうゆ', meridian: '足の太陽膀胱経', ryaku: 'BL25', type: '大腸の背部兪穴',
    location: '腰部、第4腰椎棘突起下縁と同じ高さ、後正中線の外方1寸5分。腰陽関（督脈）の外方1寸5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl26', name: '関元兪', yomi: 'かんげんゆ', meridian: '足の太陽膀胱経', ryaku: 'BL26', type: null,
    location: '腰部、第5腰椎棘突起下縁と同じ高さ、後正中線の外方1寸5分。第5腰椎棘突起と正中仙骨稜との間、外方1寸5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl27', name: '小腸兪', yomi: 'しょうちょうゆ', meridian: '足の太陽膀胱経', ryaku: 'BL27', type: '小腸の背部兪穴',
    location: '仙骨部、第1後仙骨孔と同じ高さ、正中仙骨稜の外方1寸5分。上髎の高さで後正中線の外方1寸5分に取る（仙骨部の小腸兪から白環兪までと上髎から下髎までの経穴は、次髎を基準にする）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl28', name: '膀胱兪', yomi: 'ぼうこうゆ', meridian: '足の太陽膀胱経', ryaku: 'BL28', type: '膀胱の背部兪穴',
    location: '仙骨部、第2後仙骨孔と同じ高さ、正中仙骨稜の外方1寸5分。次髎の高さで後正中線の外方1寸5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl29', name: '中膂兪', yomi: 'ちゅうりょゆ', meridian: '足の太陽膀胱経', ryaku: 'BL29', type: null,
    location: '仙骨部、第3後仙骨孔と同じ高さ、正中仙骨稜の外方1寸5分。中髎の高さで後正中線の外方1寸5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl30', name: '白環兪', yomi: 'はっかんゆ', meridian: '足の太陽膀胱経', ryaku: 'BL30', type: null,
    location: '仙骨部、第4後仙骨孔と同じ高さ、正中仙骨稜の外方1寸5分。腰兪（督脈）の外方1寸5分に取る（下髎と同じ高さにある）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl31', name: '上髎', yomi: 'じょうりょう', meridian: '足の太陽膀胱経', ryaku: 'BL31', type: null,
    location: '仙骨部、第1後仙骨孔。次髎から撫で上げたとき、最初に触れる陥凹部に取る（上後腸骨稜の頂点の高さにあたる。左右の上髎・次髎・中髎・下髎の8穴を一般に八髎穴という）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl32', name: '次髎', yomi: 'じりょう', meridian: '足の太陽膀胱経', ryaku: 'BL32', type: null,
    location: '仙骨部、第2後仙骨孔。上後腸骨棘下縁の高さで、上後腸骨棘と正中仙骨稜とのほぼ中央に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl33', name: '中髎', yomi: 'ちゅうりょう', meridian: '足の太陽膀胱経', ryaku: 'BL33', type: null,
    location: '仙骨部、第3後仙骨孔。次髎から撫で下ろしたとき、最初に触れる陥凹部に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl34', name: '下髎', yomi: 'げりょう', meridian: '足の太陽膀胱経', ryaku: 'BL34', type: null,
    location: '仙骨部、第4後仙骨孔。次髎から撫で下ろしたとき、2つめに触れる陥凹部に取る（腰兪＝督脈の外方にあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl35', name: '会陽', yomi: 'えよう', meridian: '足の太陽膀胱経', ryaku: 'BL35', type: null,
    location: '殿部、尾骨下端外方5分。伏臥位あるいは膝胸位にし、尾骨下端の外方5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl36', name: '承扶', yomi: 'しょうふ', meridian: '足の太陽膀胱経', ryaku: 'BL36', type: null,
    location: '殿部、殿溝の中点。大腿後面の中線と殿溝との交点に取る（承扶から委中までの長さを1尺4寸とする。深部に坐骨神経が通る）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl37', name: '殷門', yomi: 'いんもん', meridian: '足の太陽膀胱経', ryaku: 'BL37', type: null,
    location: '大腿部後面、大腿二頭筋と半腱様筋の間、殿溝の下方6寸。承扶と委中とを結ぶ線の中点の上方1寸で、大腿二頭筋と半腱様筋との間に取る（深部に坐骨神経が通る）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl38', name: '浮郄', yomi: 'ふげき', meridian: '足の太陽膀胱経', ryaku: 'BL38', type: null,
    location: '膝後面、大腿二頭筋腱の内縁、膝窩横紋の上方1寸。委陽から大腿二頭筋腱の内側縁に沿って上方1寸に取る（深部に総腓骨神経が通る）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl39', name: '委陽', yomi: 'いよう', meridian: '足の太陽膀胱経', ryaku: 'BL39', type: '三焦の下合穴',
    location: '膝後外側、大腿二頭筋腱の内縁、膝窩横紋上。委中の外方で、大腿二頭筋腱の内側に取る（軽く膝関節を屈曲すると大腿二頭筋腱がよく現れる。深部に総腓骨神経が通る）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl40', name: '委中', yomi: 'いちゅう', meridian: '足の太陽膀胱経', ryaku: 'BL40', type: '膀胱経の合土穴・四総穴・膀胱の下合穴',
    location: '膝後面、膝窩横紋の中点。膝を曲げたときにできる横紋の中央、膝窩動脈拍動部に取る（深部に脛骨神経が通る）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl41', name: '附分', yomi: 'ふぶん', meridian: '足の太陽膀胱経', ryaku: 'BL41', type: null,
    location: '上背部、第2胸椎棘突起下縁と同じ高さ、後正中線の外方3寸。第2・第3胸椎棘突起間、外方3寸に取る（肩甲骨の内側縁で肩甲棘内端の内上方にあたる。左右の肩甲棘内端縁の間を6寸とする）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl42', name: '魄戸', yomi: 'はっこ', meridian: '足の太陽膀胱経', ryaku: 'BL42', type: null,
    location: '上背部、第3胸椎棘突起下縁と同じ高さ、後正中線の外方3寸。身柱（督脈）の外方3寸に取る（肩甲骨の内側縁で肩甲棘内端の内下方にあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl43', name: '膏肓', yomi: 'こうこう', meridian: '足の太陽膀胱経', ryaku: 'BL43', type: null,
    location: '上背部、第4胸椎棘突起下縁と同じ高さ、後正中線の外方3寸。第4・第5胸椎棘突起間、外方3寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl44', name: '神堂', yomi: 'しんどう', meridian: '足の太陽膀胱経', ryaku: 'BL44', type: null,
    location: '上背部、第5胸椎棘突起下縁と同じ高さ、後正中線の外方3寸。神道（督脈）の外方3寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl45', name: '譩譆', yomi: 'いき', meridian: '足の太陽膀胱経', ryaku: 'BL45', type: null,
    location: '上背部、第6胸椎棘突起下縁と同じ高さ、後正中線の外方3寸。霊台（督脈）の外方3寸に取る（聴診三角にあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl46', name: '膈関', yomi: 'かくかん', meridian: '足の太陽膀胱経', ryaku: 'BL46', type: null,
    location: '上背部、第7胸椎棘突起下縁と同じ高さ、後正中線の外方3寸。至陽（督脈）の外方3寸に取る（左右の肩甲骨下角を結んだ線のやや下方にあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl47', name: '魂門', yomi: 'こんもん', meridian: '足の太陽膀胱経', ryaku: 'BL47', type: null,
    location: '上背部、第9胸椎棘突起下縁と同じ高さ、後正中線の外方3寸。筋縮（督脈）の外方3寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl48', name: '陽綱', yomi: 'ようこう', meridian: '足の太陽膀胱経', ryaku: 'BL48', type: null,
    location: '上背部、第10胸椎棘突起下縁と同じ高さ、後正中線の外方3寸。中枢（督脈）の外方3寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl49', name: '意舎', yomi: 'いしゃ', meridian: '足の太陽膀胱経', ryaku: 'BL49', type: null,
    location: '上背部、第11胸椎棘突起下縁と同じ高さ、後正中線の外方3寸。脊中（督脈）の外方3寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl50', name: '胃倉', yomi: 'いそう', meridian: '足の太陽膀胱経', ryaku: 'BL50', type: null,
    location: '上背部、第12胸椎棘突起下縁と同じ高さ、後正中線の外方3寸。第12胸椎・第1腰椎棘突起間、外方3寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl51', name: '肓門', yomi: 'こうもん', meridian: '足の太陽膀胱経', ryaku: 'BL51', type: null,
    location: '腰部、第1腰椎棘突起下縁と同じ高さ、後正中線の外方3寸。懸枢（督脈）の外方3寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl52', name: '志室', yomi: 'ししつ', meridian: '足の太陽膀胱経', ryaku: 'BL52', type: null,
    location: '腰部、第2腰椎棘突起下縁と同じ高さ、後正中線の外方3寸。命門（督脈）の外方3寸に取る（第12肋骨端下縁の内方にあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl53', name: '胞肓', yomi: 'ほうこう', meridian: '足の太陽膀胱経', ryaku: 'BL53', type: null,
    location: '殿部、第2後仙骨孔と同じ高さ、正中仙骨稜の外方3寸。次髎の高さで後正中線の外方3寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl54', name: '秩辺', yomi: 'ちっぺん', meridian: '足の太陽膀胱経', ryaku: 'BL54', type: null,
    location: '殿部、第4後仙骨孔と同じ高さ、正中仙骨稜の外方3寸。腰兪（督脈）の外方3寸に取る（下髎と同じ高さにあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl55', name: '合陽', yomi: 'ごうよう', meridian: '足の太陽膀胱経', ryaku: 'BL55', type: null,
    location: '下腿後面、腓腹筋外側頭と内側頭の間、膝窩横紋の下方2寸。委中と承山とを結ぶ線を4等分し、委中から4分の1のところに取る（膝窩中央から外果尖までの長さを1尺6寸、委中から承山までの長さを8寸とする）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl56', name: '承筋', yomi: 'しょうきん', meridian: '足の太陽膀胱経', ryaku: 'BL56', type: null,
    location: '下腿後面、腓腹筋の両筋腹の間、膝窩横紋の下方5寸。委中と承山とを結ぶ線の中点の下方1寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl57', name: '承山', yomi: 'しょうざん', meridian: '足の太陽膀胱経', ryaku: 'BL57', type: null,
    location: '下腿後面、腓腹筋筋腹とアキレス腱の移行部。委中の下方8寸に取る（アキレス腱の後面を指頭で撫で上げたとき、指が止まるところにあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl58', name: '飛揚', yomi: 'ひよう', meridian: '足の太陽膀胱経', ryaku: 'BL58', type: '膀胱経の絡穴',
    location: '下腿後外側、腓腹筋外側頭下縁とアキレス腱の間、崑崙の上方7寸。崑崙の上方7寸、承山の外下方1寸、腓腹筋外側頭下縁とアキレス腱の間に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl59', name: '跗陽', yomi: 'ふよう', meridian: '足の太陽膀胱経', ryaku: 'BL59', type: '陽蹻脈の郄穴',
    location: '下腿後外側、腓骨とアキレス腱の間、崑崙の上方3寸。崑崙の上方3寸、腓骨とアキレス腱との間に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl60', name: '崑崙', yomi: 'こんろん', meridian: '足の太陽膀胱経', ryaku: 'BL60', type: '膀胱経の経火穴',
    location: '足関節後外側、外果尖とアキレス腱の間の陥凹部。外果尖とアキレス腱との間の陥凹中に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl61', name: '僕参', yomi: 'ぼくしん', meridian: '足の太陽膀胱経', ryaku: 'BL61', type: null,
    location: '足外側、崑崙の下方、踵骨外側、赤白肉際。外果尖の後下方、踵骨隆起の前下方にある陥凹中、表裏の境目に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl62', name: '申脈', yomi: 'しんみゃく', meridian: '足の太陽膀胱経', ryaku: 'BL62', type: '八脈交会穴',
    location: '足外側、外果尖の直下、外果下縁と踵骨の間の陥凹部。外果尖の直下、外果下縁の下方陥凹部に取る（申脈に対応する内側の経穴は照海＝腎経である）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl63', name: '金門', yomi: 'きんもん', meridian: '足の太陽膀胱経', ryaku: 'BL63', type: '膀胱経の郄穴',
    location: '足背、外果前縁の遠位、第5中足骨粗面の後方、立方骨下方の陥凹部。第5中足骨粗面の後方、立方骨下方（足底側）の陥凹部に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl64', name: '京骨', yomi: 'けいこつ', meridian: '足の太陽膀胱経', ryaku: 'BL64', type: '膀胱の原穴',
    location: '足外側、第5中足骨粗面の遠位、赤白肉際。第5中足骨粗面の前縁、表裏の境目に取る（第5中足骨粗面は踵と第5中足指節関節のほぼ中央にある）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl65', name: '束骨', yomi: 'そっこつ', meridian: '足の太陽膀胱経', ryaku: 'BL65', type: '膀胱経の兪木穴',
    location: '足外側、第5中足指節関節外側の近位陥凹部、赤白肉際。第5中足骨の外側縁を後ろからつま先の方へ撫でていくと、指が止まるところ、表裏の境目に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl66', name: '足通谷', yomi: 'あしつうこく', meridian: '足の太陽膀胱経', ryaku: 'BL66', type: '膀胱経の榮水穴',
    location: '足の第5指、第5中足指節関節外側の遠位陥凹部、赤白肉際。第5中足指節関節の外側を触察し、その前部に触れる陥凹中、表裏の境目に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-bl67', name: '至陰', yomi: 'しいん', meridian: '足の太陽膀胱経', ryaku: 'BL67', type: '膀胱経の井金穴',
    location: '足の第5指、末節骨外側、爪甲角の近位外方1分（指寸）。足の第5指爪根部近位縁に引いた線と、外側縁に引いた線との交点に取る。',
    shuji: null, figure: null, sourceIds: [],
  },

  // ---- 足の少陰腎経（KI）27穴（p.150-163・完全収録） ----
  {
    id: 'kc-ki1', name: '湧泉', yomi: 'ゆうせん', meridian: '足の少陰腎経', ryaku: 'KI1', type: '腎経の井木穴',
    location: '足底、足指屈曲時、足底の最陥凹部。足指を屈曲して、第2・第3指の間のみずかきと踵とを結ぶ線を3等分し、みずかきから3分の1のところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki2', name: '然谷', yomi: 'ねんこく', meridian: '足の少陰腎経', ryaku: 'KI2', type: '腎経の榮火穴',
    location: '足内側、舟状骨粗面の下方、赤白肉際。内果の前下方で、舟状骨の尖ったところの直下、表裏の境目に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki3', name: '太谿', yomi: 'たいけい', meridian: '足の少陰腎経', ryaku: 'KI3', type: '腎の原穴・腎経の兪土穴',
    location: '足関節後内側、内果尖とアキレス腱の間の陥凹部。内果尖とアキレス腱との間で、後脛骨動脈拍動部に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki4', name: '大鍾', yomi: 'だいしょう', meridian: '足の少陰腎経', ryaku: 'KI4', type: '腎経の絡穴',
    location: '足内側、内果後下方、踵骨上方、アキレス腱付着部内側前方の陥凹部。太谿の下方で踵骨上方、アキレス腱の前陥凹部に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki5', name: '水泉', yomi: 'すいせん', meridian: '足の少陰腎経', ryaku: 'KI5', type: '腎経の郄穴',
    location: '足内側、太谿の下方1寸、踵骨隆起前方の陥凹部。太谿の下方1寸の陥凹部に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki6', name: '照海', yomi: 'しょうかい', meridian: '足の少陰腎経', ryaku: 'KI6', type: '八脈交会穴',
    location: '足内側、内果尖の下方1寸、内果下方の陥凹部。内果尖の下方1寸の陥凹部に取る（照海に対応する外側の経穴は申脈＝膀胱経である）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki7', name: '復溜', yomi: 'ふくりゅう', meridian: '足の少陰腎経', ryaku: 'KI7', type: '腎経の経金穴',
    location: '下腿後内側、アキレス腱の前縁、内果尖の上方2寸。太谿の上方2寸で、アキレス腱と長指屈筋との間に取る（内果尖から膝窩横紋までの長さを1尺5寸とする。交信と同じ高さで、交信の後方5分にある）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki8', name: '交信', yomi: 'こうしん', meridian: '足の少陰腎経', ryaku: 'KI8', type: '陰蹻脈の郄穴',
    location: '下腿内側、脛骨内縁の後方の陥凹部、内果尖の上方2寸。復溜の前方5分、復溜と脛骨内縁後際との間に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki9', name: '築賓', yomi: 'ちくひん', meridian: '足の少陰腎経', ryaku: 'KI9', type: '陰維脈の郄穴',
    location: '下腿後内側、ヒラメ筋とアキレス腱の間、内果尖の上方5寸。太谿と陰谷を結ぶ線を3等分し、太谿から3分の1のところ、ヒラメ筋とアキレス腱との間に取る（太谿の上方5寸、蠡溝＝肝経と同じ高さにある）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki10', name: '陰谷', yomi: 'いんこく', meridian: '足の少陰腎経', ryaku: 'KI10', type: '腎経の合水穴',
    location: '膝後内側、半腱様筋腱の外縁、膝窩横紋上。膝関節を軽く屈曲したときにできる膝窩横紋上で、半腱様筋腱の外縁に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki11', name: '横骨', yomi: 'おうこつ', meridian: '足の少陰腎経', ryaku: 'KI11', type: null,
    location: '下腹部、臍中央の下方5寸、前正中線の外方5分。曲骨（任脈）の外方5分に取る（腎経の腹部の経穴は、前正中線外方5分とする）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki12', name: '大赫', yomi: 'だいかく', meridian: '足の少陰腎経', ryaku: 'KI12', type: null,
    location: '下腹部、臍中央の下方4寸、前正中線の外方5分。中極（任脈）の外方5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki13', name: '気穴', yomi: 'きけつ', meridian: '足の少陰腎経', ryaku: 'KI13', type: null,
    location: '下腹部、臍中央の下方3寸、前正中線の外方5分。関元（任脈）の外方5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki14', name: '四満', yomi: 'しまん', meridian: '足の少陰腎経', ryaku: 'KI14', type: null,
    location: '下腹部、臍中央の下方2寸、前正中線の外方5分。石門（任脈）の外方5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki15', name: '中注', yomi: 'ちゅうちゅう', meridian: '足の少陰腎経', ryaku: 'KI15', type: null,
    location: '下腹部、臍中央の下方1寸、前正中線の外方5分。陰交（任脈）の外方5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki16', name: '肓兪', yomi: 'こうゆ', meridian: '足の少陰腎経', ryaku: 'KI16', type: null,
    location: '上腹部、臍中央の外方5分。神闕（任脈）の外方5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki17', name: '商曲', yomi: 'しょうきょく', meridian: '足の少陰腎経', ryaku: 'KI17', type: null,
    location: '上腹部、臍中央の上方2寸、前正中線の外方5分。下脘（任脈）の外方5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki18', name: '石関', yomi: 'せきかん', meridian: '足の少陰腎経', ryaku: 'KI18', type: null,
    location: '上腹部、臍中央の上方3寸、前正中線の外方5分。建里（任脈）の外方5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki19', name: '陰都', yomi: 'いんと', meridian: '足の少陰腎経', ryaku: 'KI19', type: null,
    location: '上腹部、臍中央の上方4寸、前正中線の外方5分。中脘（任脈）の外方5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki20', name: '腹通谷', yomi: 'ふくつうこく', meridian: '足の少陰腎経', ryaku: 'KI20', type: null,
    location: '上腹部、臍中央の上方5寸、前正中線の外方5分。上脘（任脈）の外方5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki21', name: '幽門', yomi: 'ゆうもん', meridian: '足の少陰腎経', ryaku: 'KI21', type: null,
    location: '上腹部、臍中央の上方6寸、前正中線の外方5分。巨闕（任脈）の外方5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki22', name: '歩廊', yomi: 'ほろう', meridian: '足の少陰腎経', ryaku: 'KI22', type: null,
    location: '前胸部、第5肋間、前正中線の外方2寸。第5肋間で前正中線の外方2寸に取る（歩廊から彧中までの経穴は、前正中線と乳頭線との中間の線と、各肋間との交点にあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki23', name: '神封', yomi: 'しんぷう', meridian: '足の少陰腎経', ryaku: 'KI23', type: null,
    location: '前胸部、第4肋間、前正中線の外方2寸。膻中（任脈）の外方2寸に取る（第4肋間の高さには前正中線から、神封、乳中＝胃経、天池＝心包経、天渓＝脾経、輒筋＝胆経、淵腋＝胆経が並ぶ）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki24', name: '霊墟', yomi: 'れいきょ', meridian: '足の少陰腎経', ryaku: 'KI24', type: null,
    location: '前胸部、第3肋間、前正中線の外方2寸。玉堂（任脈）の外方2寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki25', name: '神蔵', yomi: 'しんぞう', meridian: '足の少陰腎経', ryaku: 'KI25', type: null,
    location: '前胸部、第2肋間、前正中線の外方2寸。紫宮（任脈）の外方2寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki26', name: '彧中', yomi: 'いくちゅう', meridian: '足の少陰腎経', ryaku: 'KI26', type: null,
    location: '前胸部、第1肋間、前正中線の外方2寸。華蓋（任脈）の外方2寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-ki27', name: '兪府', yomi: 'ゆふ', meridian: '足の少陰腎経', ryaku: 'KI27', type: null,
    location: '前胸部、鎖骨下縁、前正中線の外方2寸。前正中線の外方2寸で、鎖骨の下縁に取る。',
    shuji: null, figure: null, sourceIds: [],
  },

  // ---- 手の厥陰心包経（PC）9穴（p.164-169・完全収録） ----
  {
    id: 'kc-pc1', name: '天池', yomi: 'てんち', meridian: '手の厥陰心包経', ryaku: 'PC1', type: null,
    location: '前胸部、第4肋間、前正中線の外方5寸。乳頭の外方1寸で第4肋間、乳中（胃経）と天渓（脾経）との中点に取る（第4肋間の高さには前正中線から、膻中＝任脈、神封＝腎経、乳中＝胃経、天池、天渓＝脾経、輒筋＝胆経、淵腋＝胆経が並ぶ）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-pc2', name: '天泉', yomi: 'てんせん', meridian: '手の厥陰心包経', ryaku: 'PC2', type: null,
    location: '上腕前面、上腕二頭筋長頭と短頭の間、腋窩横紋前端の下方2寸。腋窩横紋前端の下方2寸、上腕二頭筋長頭と短頭との筋溝に取る（腋窩横紋前端から曲沢までの長さを9寸とする）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-pc3', name: '曲沢', yomi: 'きょくたく', meridian: '手の厥陰心包経', ryaku: 'PC3', type: '心包経の合水穴',
    location: '肘前面、肘窩横紋上、上腕二頭筋腱内方の陥凹部。肘関節を屈曲して上腕二頭筋腱を緊張させ、その腱の内側陥凹中に取る（上腕動脈拍動部で、尺沢＝肺経と少海＝心経とのほぼ中点にあたる。曲沢から大陵までの長さを1尺2寸とする）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-pc4', name: '郄門', yomi: 'げきもん', meridian: '手の厥陰心包経', ryaku: 'PC4', type: '心包経の郄穴',
    location: '前腕前面、長掌筋腱と橈側手根屈筋腱の間、手関節掌側横紋の上方5寸。曲沢と大陵とを結ぶ線の中点の下方1寸で、長掌筋腱と橈側手根屈筋腱との間に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-pc5', name: '間使', yomi: 'かんし', meridian: '手の厥陰心包経', ryaku: 'PC5', type: '心包経の経金穴',
    location: '前腕前面、長掌筋腱と橈側手根屈筋腱の間、手関節掌側横紋の上方3寸。大陵と曲沢とを結ぶ線を4等分し、大陵から4分の1のところ、長掌筋腱と橈側手根屈筋腱との間に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-pc6', name: '内関', yomi: 'ないかん', meridian: '手の厥陰心包経', ryaku: 'PC6', type: '心包経の絡穴・八脈交会穴',
    location: '前腕前面、長掌筋腱と橈側手根屈筋腱の間、手関節掌側横紋の上方2寸。大陵の上方2寸で、橈側手根屈筋腱と長掌筋腱との間に取る（内関に対応する後ろの経穴は外関＝三焦経である）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-pc7', name: '大陵', yomi: 'だいりょう', meridian: '手の厥陰心包経', ryaku: 'PC7', type: '心包の原穴・心包経の兪土穴',
    location: '手関節前面、長掌筋腱と橈側手根屈筋腱の間、手関節掌側横紋上。手関節前面横紋の中央で、橈側手根屈筋腱と長掌筋腱との間に取る（長掌筋腱が不明瞭な場合は橈側手根屈筋腱の内側に取る。太淵＝肺経、大陵、神門＝心経は手関節掌側横紋上に並ぶ）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-pc8', name: '労宮', yomi: 'ろうきゅう', meridian: '手の厥陰心包経', ryaku: 'PC8', type: '心包経の榮火穴',
    location: '手掌、第2・第3中手骨間、中手指節関節の近位陥凹部。手掌で第2・第3中手骨間、手を握ったとき、手掌面に触れる示指頭と中指頭との間に取る（別説では第3・第4中手骨間、中指頭と薬指頭との間とする）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-pc9', name: '中衝', yomi: 'ちゅうしょう', meridian: '手の厥陰心包経', ryaku: 'PC9', type: '心包経の井木穴',
    location: '中指、中指先端中央。中指先端の中央に取る（別説では末節骨橈側、爪甲角の近位外方1分＝指寸とする）。',
    shuji: null, figure: null, sourceIds: [],
  },

  // ---- 手の少陽三焦経（TE）23穴（p.170-181・完全収録） ----
  {
    id: 'kc-te1', name: '関衝', yomi: 'かんしょう', meridian: '手の少陽三焦経', ryaku: 'TE1', type: '三焦経の井金穴',
    location: '薬指、末節骨尺側、爪甲角から近位内方1分（指寸）、爪甲尺側縁の垂線と爪甲基底部の水平線との交点。薬指爪根部近位縁に引いた線と、内側縁に引いた線との交点に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-te2', name: '液門', yomi: 'えきもん', meridian: '手の少陽三焦経', ryaku: 'TE2', type: '三焦経の榮水穴',
    location: '手背、薬指と小指の間、みずかきの近位陥凹部、赤白肉際。手を握り、第4・第5中手指節関節間の直下の陥凹部に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-te3', name: '中渚', yomi: 'ちゅうしょ', meridian: '手の少陽三焦経', ryaku: 'TE3', type: '三焦経の兪木穴',
    location: '手背、第4・第5中手骨間、第4中手指節関節の近位陥凹部。手を握り、第4中手指節関節の上の内側陥凹中に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-te4', name: '陽池', yomi: 'ようち', meridian: '手の少陽三焦経', ryaku: 'TE4', type: '三焦の原穴',
    location: '手関節後面、総指伸筋腱の尺側陥凹部、手関節背側横紋上。手関節後面横紋のほぼ中央で、総指伸筋腱と小指伸筋腱との間の陥凹中に取る（陽渓＝大腸経、陽池、陽谷＝小腸経は手関節背側横紋上に並ぶ。陽池から肘頭までの長さを1尺2寸とする）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-te5', name: '外関', yomi: 'がいかん', meridian: '手の少陽三焦経', ryaku: 'TE5', type: '三焦経の絡穴・八脈交会穴',
    location: '前腕後面、橈骨と尺骨の骨間の中点、手関節背側横紋の上方2寸。陽池の上方2寸で、総指伸筋腱と小指伸筋腱との間に取る（外関に対応する前側の経穴は内関＝心包経である）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-te6', name: '支溝', yomi: 'しこう', meridian: '手の少陽三焦経', ryaku: 'TE6', type: '三焦経の経火穴',
    location: '前腕後面、橈骨と尺骨の骨間の中点、手関節背側横紋の上方3寸。陽池と肘頭とを結ぶ線を4等分し、陽池から4分の1のところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-te7', name: '会宗', yomi: 'えそう', meridian: '手の少陽三焦経', ryaku: 'TE7', type: '三焦経の郄穴',
    location: '前腕後面、尺骨の橈側縁、手関節背側横紋の上方3寸。支溝から小指伸筋腱を越えたところで、尺側手根伸筋との間に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-te8', name: '三陽絡', yomi: 'さんようらく', meridian: '手の少陽三焦経', ryaku: 'TE8', type: null,
    location: '前腕後面、橈骨と尺骨の骨間の中点、手関節背側横紋の上方4寸。陽池と肘頭とを結ぶ線を3等分し、陽池から3分の1のところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-te9', name: '四瀆', yomi: 'しとく', meridian: '手の少陽三焦経', ryaku: 'TE9', type: null,
    location: '前腕後面、橈骨と尺骨の骨間の中点、肘頭の下方5寸。陽池と肘頭とを結ぶ線の中点の上方1寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-te10', name: '天井', yomi: 'てんせい', meridian: '手の少陽三焦経', ryaku: 'TE10', type: '三焦経の合土穴',
    location: '肘後面、肘頭の上方1寸、陥凹部。肘頭の上方1寸で、肘関節をやや屈曲したときにできる陥凹部（肘頭窩）に取る（肘頭から肩峰角までの長さを、上肢を下垂したとき1尺2寸、肩関節を90度外転したとき1尺とする）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-te11', name: '清冷淵', yomi: 'せいれいえん', meridian: '手の少陽三焦経', ryaku: 'TE11', type: null,
    location: '上腕後面、肘頭と肩峰角を結ぶ線上、肘頭の上方2寸。肘関節を伸展し、肘頭の上方2寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-te12', name: '消濼', yomi: 'しょうれき', meridian: '手の少陽三焦経', ryaku: 'TE12', type: null,
    location: '上腕後面、肘頭と肩峰角を結ぶ線上、肘頭の上方5寸。肘頭の上方5寸、上肢を下垂したとき肘頭と肩峰角とを結ぶ線の中点の下方1寸で、橈骨神経溝中に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-te13', name: '臑会', yomi: 'じゅえ', meridian: '手の少陽三焦経', ryaku: 'TE13', type: null,
    location: '上腕後面、三角筋の後下縁、肩峰角の下方3寸。肩峰角の下方3寸で、三角筋の後下縁に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-te14', name: '肩髎', yomi: 'けんりょう', meridian: '手の少陽三焦経', ryaku: 'TE14', type: null,
    location: '肩周囲部、肩峰角と上腕骨大結節の間の陥凹部。肩関節を90度外転したとき、肩峰の前後に現れる2つの陥凹部のうち、後ろの陥凹部に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-te15', name: '天髎', yomi: 'てんりょう', meridian: '手の少陽三焦経', ryaku: 'TE15', type: null,
    location: '肩甲部、肩甲骨上角の上方陥凹部。肩井（胆経）と曲垣（小腸経）との中点で、肩甲骨上角の上方に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-te16', name: '天牖', yomi: 'てんゆう', meridian: '手の少陽三焦経', ryaku: 'TE16', type: null,
    location: '前頸部、下顎角と同じ高さ、胸鎖乳突筋後方の陥凹部。下顎角の後方で、胸鎖乳突筋の後方に取る（胸鎖乳突筋をはさんで天容＝小腸経と相対するところにあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-te17', name: '翳風', yomi: 'えいふう', meridian: '手の少陽三焦経', ryaku: 'TE17', type: null,
    location: '前頸部、耳垂後方、乳様突起下端前方の陥凹部。天容（小腸経）の上方で、乳様突起下端と下顎枝との間の陥凹中に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-te18', name: '瘈脈', yomi: 'けいみゃく', meridian: '手の少陽三焦経', ryaku: 'TE18', type: null,
    location: '頭部、乳様突起の中央、翳風と角孫を結ぶ（耳の輪郭に沿った）曲線上、翳風から3分の1。翳風から角孫に至る円弧上で、翳風から3分の1のところに取る（耳介を隔てて外耳孔と相対するところにあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-te19', name: '顱息', yomi: 'ろそく', meridian: '手の少陽三焦経', ryaku: 'TE19', type: null,
    location: '頭部、翳風と角孫を結ぶ（耳の輪郭に沿った）曲線上で、翳風から3分の2。翳風から角孫に至る円弧上で、角孫から3分の1のところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-te20', name: '角孫', yomi: 'かくそん', meridian: '手の少陽三焦経', ryaku: 'TE20', type: null,
    location: '頭部、耳尖のあたるところ。耳を前方に折り曲げて、耳尖が頭に触れるところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-te21', name: '耳門', yomi: 'じもん', meridian: '手の少陽三焦経', ryaku: 'TE21', type: null,
    location: '顔面部、耳珠上の切痕と下顎骨の関節突起の間、陥凹部。耳珠の前上方で頬骨弓の後端に取る（聴宮＝小腸経の直上にあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-te22', name: '和髎', yomi: 'わりょう', meridian: '手の少陽三焦経', ryaku: 'TE22', type: null,
    location: '頭部、もみあげの後方、耳介の付け根の前方、浅側頭動脈の後方。頬骨弓後端の上方で、浅側頭動脈拍動部の後方に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-te23', name: '糸竹空', yomi: 'しちくくう', meridian: '手の少陽三焦経', ryaku: 'TE23', type: null,
    location: '頭部、眉毛外端の陥凹部。眉毛の外端で、骨のくぼんだところに取る（瞳子髎＝胆経の直上にある）。',
    shuji: null, figure: null, sourceIds: [],
  },

  // ---- 足の少陽胆経（GB）44穴（p.182-201・完全収録） ----
  {
    id: 'kc-gb1', name: '瞳子髎', yomi: 'どうしりょう', meridian: '足の少陽胆経', ryaku: 'GB1', type: null,
    location: '頭部、外眼角の外方5分、陥凹部。外眼角の外方5分で、骨の少しくぼんだところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb2', name: '聴会', yomi: 'ちょうえ', meridian: '足の少陽胆経', ryaku: 'GB2', type: null,
    location: '顔面部、珠間切痕と下顎骨関節突起の間、陥凹部。珠間切痕の直前陥凹中で、口を開くと深くくぼむところに取る（聴宮＝小腸経の直下にあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb3', name: '上関', yomi: 'じょうかん', meridian: '足の少陽胆経', ryaku: 'GB3', type: '別名：客主人',
    location: '頭部、頬骨弓中央の上際陥凹部。頬骨弓中央の上際に取る（頬骨弓をはさんで下関＝胃経の直上にあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb4', name: '頷厭', yomi: 'がんえん', meridian: '足の少陽胆経', ryaku: 'GB4', type: null,
    location: '頭部、頭維と曲鬢を結ぶ（側頭の髪際に沿った）曲線上、頭維から4分の1。側頭髪際にほぼ並行して、頭維（胃経）から曲鬢までをなだらかに結ぶ曲線上で、頭維から4分の1のところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb5', name: '懸顱', yomi: 'けんろ', meridian: '足の少陽胆経', ryaku: 'GB5', type: null,
    location: '頭部、頭維と曲鬢を結ぶ（側頭の髪際に沿った）曲線上の中点。側頭髪際にほぼ並行して、頭維（胃経）から曲鬢までをなだらかに結ぶ曲線の中点に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb6', name: '懸釐', yomi: 'けんり', meridian: '足の少陽胆経', ryaku: 'GB6', type: null,
    location: '頭部、頭維と曲鬢を結ぶ（側頭の髪際に沿った）曲線上、頭維から4分の3。側頭髪際にほぼ並行して、頭維（胃経）から曲鬢までをなだらかに結ぶ曲線上で、曲鬢から4分の1のところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb7', name: '曲鬢', yomi: 'きょくびん', meridian: '足の少陽胆経', ryaku: 'GB7', type: null,
    location: '頭部、もみあげ後縁の垂線と耳尖の水平線の交点。もみあげ後縁の上方で、耳尖の高さに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb8', name: '率谷', yomi: 'そっこく', meridian: '足の少陽胆経', ryaku: 'GB8', type: null,
    location: '頭部、耳尖の直上、髪際の上方1寸5分。角孫（三焦経）の上方1寸5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb9', name: '天衝', yomi: 'てんしょう', meridian: '足の少陽胆経', ryaku: 'GB9', type: null,
    location: '頭部、耳介の付け根の後縁の直上、髪際の上方2寸。率谷の後方5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb10', name: '浮白', yomi: 'ふはく', meridian: '足の少陽胆経', ryaku: 'GB10', type: null,
    location: '頭部、乳様突起の後上方、天衝と完骨を結ぶ（耳の輪郭に沿った）曲線上、天衝から3分の1。耳尖直後の髪際の後方1寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb11', name: '頭竅陰', yomi: 'あたまきょういん', meridian: '足の少陽胆経', ryaku: 'GB11', type: null,
    location: '頭部、乳様突起の後上方、天衝と完骨を結ぶ（耳の輪郭に沿った）曲線上、天衝から3分の2。乳様突起の後上方で、完骨から天衝に向かって約3分の1のところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb12', name: '完骨', yomi: 'かんこつ', meridian: '足の少陽胆経', ryaku: 'GB12', type: null,
    location: '前頭部、乳様突起の後下方、陥凹部。乳様突起の後下方陥凹中に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb13', name: '本神', yomi: 'ほんじん', meridian: '足の少陽胆経', ryaku: 'GB13', type: null,
    location: '頭部、前髪際の後方5分、前正中線の外方3寸。神庭（督脈）と頭維（胃経）とを結ぶ線を3等分し、頭維から3分の1のところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb14', name: '陽白', yomi: 'ようはく', meridian: '足の少陽胆経', ryaku: 'GB14', type: null,
    location: '頭部、眉の上方1寸、瞳孔線上。眉毛中央の上方1寸、瞳孔を通る垂直線上で骨の陥凹部に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb15', name: '頭臨泣', yomi: 'あたまりんきゅう', meridian: '足の少陽胆経', ryaku: 'GB15', type: null,
    location: '頭部、前髪際から入ること5分、瞳孔線上。神庭（督脈）と頭維（胃経）とを結ぶ線の中点に取る（瞳孔の直上にあたる。前髪際の後方5分には前正中線から、神庭、眉衝＝膀胱経、曲差＝膀胱経、頭臨泣、本神、頭維＝胃経が並ぶ）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb16', name: '目窓', yomi: 'もくそう', meridian: '足の少陽胆経', ryaku: 'GB16', type: null,
    location: '頭部、前髪際から入ること1寸5分、瞳孔線上。頭臨泣の後方1寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb17', name: '正営', yomi: 'しょうえい', meridian: '足の少陽胆経', ryaku: 'GB17', type: null,
    location: '頭部、前髪際から入ること2寸5分、瞳孔線上。承光（膀胱経）の外方で、頭臨泣の後方2寸に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb18', name: '承霊', yomi: 'しょうれい', meridian: '足の少陽胆経', ryaku: 'GB18', type: null,
    location: '頭部、前髪際から入ること4寸、瞳孔線上。通天（膀胱経）の外方で、正営の後方1寸5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb19', name: '脳空', yomi: 'のうくう', meridian: '足の少陽胆経', ryaku: 'GB19', type: null,
    location: '頭部、外後頭隆起上縁と同じ高さ、風池の直上。上項線と風池を通る垂線との交点に取る（脳戸＝督脈、玉枕＝膀胱経と同じ高さにある）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb20', name: '風池', yomi: 'ふうち', meridian: '足の少陽胆経', ryaku: 'GB20', type: null,
    location: '前頸部、後頭骨の下方、胸鎖乳突筋と僧帽筋の起始部の間、陥凹部。風府（督脈）の外方で、僧帽筋と胸鎖乳突筋との間の陥凹中に取る（深部に椎骨動脈が通る）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb21', name: '肩井', yomi: 'けんせい', meridian: '足の少陽胆経', ryaku: 'GB21', type: null,
    location: '後頭部、第7頸椎棘突起と肩峰外縁を結ぶ線上の中点。第7頸椎棘突起と肩峰外縁中央との中点に取る（天髎＝三焦経の上方にあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb22', name: '淵腋', yomi: 'えんえき', meridian: '足の少陽胆経', ryaku: 'GB22', type: null,
    location: '側胸部、第4肋間、中腋窩線上。腋窩中央の下方で第4肋間に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb23', name: '輒筋', yomi: 'ちょうきん', meridian: '足の少陽胆経', ryaku: 'GB23', type: null,
    location: '側胸部、第4肋間、中腋窩線の前方1寸。淵腋の前方1寸で、天渓（脾経）との中点に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb24', name: '日月', yomi: 'じつげつ', meridian: '足の少陽胆経', ryaku: 'GB24', type: '胆の募穴',
    location: '前胸部、第7肋間、前正中線の外方4寸。乳頭中央の下方で、乳根（胃経）の2肋間下に取る（女性では鎖骨中線と第7肋間との交点に取る）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb25', name: '京門', yomi: 'けいもん', meridian: '足の少陽胆経', ryaku: 'GB25', type: '腎の募穴',
    location: '側腹部、第12肋骨端下縁。側臥して、第12肋骨下縁を脊柱側から押していくと前端に触れ、その下縁に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb26', name: '帯脈', yomi: 'たいみゃく', meridian: '足の少陽胆経', ryaku: 'GB26', type: null,
    location: '側腹部、第11肋骨端下方、臍中央と同じ高さ。臍の中央を通る水平線と、第11肋骨端を通る垂線との交点に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb27', name: '五枢', yomi: 'ごすう', meridian: '足の少陽胆経', ryaku: 'GB27', type: null,
    location: '下腹部、臍中央の下方3寸、上前腸骨棘の内方。関元（任脈）の外方で、帯脈の前下方、上前腸骨棘の内方に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb28', name: '維道', yomi: 'いどう', meridian: '足の少陽胆経', ryaku: 'GB28', type: null,
    location: '下腹部、上前腸骨棘の内下方5分。五枢の内下方5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb29', name: '居髎', yomi: 'きょりょう', meridian: '足の少陽胆経', ryaku: 'GB29', type: null,
    location: '殿部、上前腸骨棘と大転子頂点の中点。維道の外下方で、上前腸骨棘と大転子の頂点との中点に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb30', name: '環跳', yomi: 'かんちょう', meridian: '足の少陽胆経', ryaku: 'GB30', type: null,
    location: '殿部、大転子の頂点と仙骨裂孔を結ぶ線上、大転子頂点から3分の1。仙骨裂孔（督脈の腰兪）と大転子の頂点とを結ぶ線を3等分し、大転子頂点から3分の1のところに取る（側臥し股関節を屈曲すると取穴しやすい。別説では大腿部、大転子の頂点と上前腸骨棘の間、大転子頂点から3分の1とする）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb31', name: '風市', yomi: 'ふうし', meridian: '足の少陽胆経', ryaku: 'GB31', type: null,
    location: '大腿部外側、直立して腕を下垂し、手掌を大腿部に付けたとき、中指の先端があたる腸脛靭帯の後方陥凹部。直立して上肢を下垂したとき、大腿外側に中指頭があたるところで、腸脛靭帯と大腿二頭筋との間に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb32', name: '中瀆', yomi: 'ちゅうとく', meridian: '足の少陽胆経', ryaku: 'GB32', type: null,
    location: '大腿部外側、腸脛靭帯の後方で、膝窩横紋の上方7寸。膝窩横紋の上方7寸で、腸脛靭帯と大腿二頭筋との間に取る（大転子から膝窩中央までの長さを1尺9寸とする）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb33', name: '膝陽関', yomi: 'ひざようかん', meridian: '足の少陽胆経', ryaku: 'GB33', type: null,
    location: '膝外側、大腿二頭筋腱と腸脛靭帯の間の陥凹部、大腿骨外側上顆の後上縁。中瀆から腸脛靭帯後縁に沿って下がると大腿骨外側上顆に触れ、その後上縁に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb34', name: '陽陵泉', yomi: 'ようりょうせん', meridian: '足の少陽胆経', ryaku: 'GB34', type: '胆経の合土穴・八会穴の筋会・胆の下合穴',
    location: '下腿外側、腓骨頭前下方の陥凹部。下腿外側で腓骨頭の前下部、長腓骨筋腱の前縁に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb35', name: '陽交', yomi: 'ようこう', meridian: '足の少陽胆経', ryaku: 'GB35', type: '陽維脈の郄穴',
    location: '下腿外側、腓骨の後方、外果尖の上方7寸。外果尖と膝窩横紋外端とを結ぶ線の中点の下方1寸の高さで、腓骨直後の陥凹部に取る（外丘と飛揚＝膀胱経との間にあたる。外果尖から膝窩横紋外端までの長さを1尺6寸とする）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb36', name: '外丘', yomi: 'がいきゅう', meridian: '足の少陽胆経', ryaku: 'GB36', type: '胆経の郄穴',
    location: '下腿外側、腓骨の前方、外果尖の上方7寸。外果尖と膝窩横紋外端を結ぶ線上の中点の下方1寸の高さで、腓骨直前の陥凹部に取る（陽交と下巨虚＝胃経との間にあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb37', name: '光明', yomi: 'こうめい', meridian: '足の少陽胆経', ryaku: 'GB37', type: '胆経の絡穴',
    location: '下腿外側、腓骨の前方、外果尖の上方5寸。外果尖と膝窩横紋外端を結ぶ線上の外果尖の上方5寸の高さで、腓骨の前方に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb38', name: '陽輔', yomi: 'ようほ', meridian: '足の少陽胆経', ryaku: 'GB38', type: '胆経の経火穴',
    location: '下腿外側、腓骨の前方、外果尖の上方4寸。外果尖と膝窩横紋外端とを結ぶ線を4等分し、外果尖から4分の1のところ、腓骨の前方に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb39', name: '懸鍾', yomi: 'けんしょう', meridian: '足の少陽胆経', ryaku: 'GB39', type: '八会穴の髄会',
    location: '下腿外側、腓骨の前方、外果尖の上方3寸。外果尖の上方3寸で、腓骨の前方に取る（跗陽＝膀胱経の前方にあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb40', name: '丘墟', yomi: 'きゅうきょ', meridian: '足の少陽胆経', ryaku: 'GB40', type: '胆の原穴',
    location: '足関節前外側、長指伸筋腱外側の陥凹部、外果尖の前下方。抵抗に抗して足の第2指から第5指を伸展させると長指伸筋腱がはっきり現れ、その外側陥凹中に取る（外果尖の前下方にあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb41', name: '足臨泣', yomi: 'あしりんきゅう', meridian: '足の少陽胆経', ryaku: 'GB41', type: '胆経の兪木穴・八脈交会穴',
    location: '足背、第4・第5中足骨底接合部の遠位、第5指の長指伸筋腱外側の陥凹部。第4・第5中足骨間を指頭で撫で上げたとき、指が止まるところに取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb42', name: '地五会', yomi: 'ちごえ', meridian: '足の少陽胆経', ryaku: 'GB42', type: null,
    location: '足背、第4・第5中足骨間、第4中足指節関節の近位陥凹部。第4中足指節関節の後外側陥凹中に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb43', name: '侠渓', yomi: 'きょうけい', meridian: '足の少陽胆経', ryaku: 'GB43', type: '胆経の榮水穴',
    location: '足背、第4・第5指間、みずかきの近位、赤白肉際。第4・第5中足指節関節間の直前の陥凹部に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-gb44', name: '足竅陰', yomi: 'あしきょういん', meridian: '足の少陽胆経', ryaku: 'GB44', type: '胆経の井金穴',
    location: '足の第4指、末節骨外側、爪甲角の近位外方1分（指寸）、爪甲外側縁の垂線と爪甲基底部の水平線との交点。足の第4指爪根部近位縁に引いた線と、外側縁に引いた線との交点に取る。',
    shuji: null, figure: null, sourceIds: [],
  },

  // ---- 足の厥陰肝経（LR）14穴（p.202-208・完全収録） ----
  {
    id: 'kc-lr1', name: '大敦', yomi: 'だいとん', meridian: '足の厥陰肝経', ryaku: 'LR1', type: '肝経の井木穴',
    location: '足の第1指、末節骨外側、爪甲角の近位外方1分（指寸）、爪甲外側縁の垂線と爪甲基底部の水平線との交点。足の第1指爪根部近位縁に引いた線と、外側縁に引いた線との交点に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-lr2', name: '行間', yomi: 'こうかん', meridian: '足の厥陰肝経', ryaku: 'LR2', type: '肝経の榮火穴',
    location: '足背、第1・第2指間、みずかきの近位、赤白肉際。第1・第2中足指節関節の直前の陥凹部に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-lr4', name: '中封', yomi: 'ちゅうほう', meridian: '足の厥陰肝経', ryaku: 'LR4', type: '肝経の経金穴',
    location: '足関節前内側、前脛骨筋腱内側の陥凹部、内果尖の前方。内果尖の前方で、前脛骨筋腱の内側陥凹中に取る（解渓＝胃経と商丘＝脾経との間にあたる）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-lr5', name: '蠡溝', yomi: 'れいこう', meridian: '足の厥陰肝経', ryaku: 'LR5', type: '肝経の絡穴',
    location: '下腿前内側、脛骨内側面の中央、内果尖の上方5寸。内果尖と膝蓋骨尖とを結ぶ線を3等分し、内果尖から3分の1のところ、脛骨の前縁と内側縁との中間に取る（内果尖から膝蓋骨尖までの長さを1尺5寸とする）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-lr6', name: '中都', yomi: 'ちゅうと', meridian: '足の厥陰肝経', ryaku: 'LR6', type: '肝経の郄穴',
    location: '下腿前内側、脛骨内側面の中央、内果尖の上方7寸。内果尖と膝蓋骨尖とを結ぶ線の中点の下方5分、脛骨の前縁と内側縁との中間に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-lr7', name: '膝関', yomi: 'しつかん', meridian: '足の厥陰肝経', ryaku: 'LR7', type: null,
    location: '下腿脛骨面、脛骨内側顆の下方、陰陵泉の後方1寸。陰陵泉（脾経）の後方1寸で、脛骨内側顆の下方に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-lr8', name: '曲泉', yomi: 'きょくせん', meridian: '足の厥陰肝経', ryaku: 'LR8', type: '肝経の合水穴',
    location: '膝内側、半腱・半膜様筋腱内側の陥凹部、膝窩横紋の内側端。膝関節を屈曲し、膝窩横紋の内端で最も明らかに触れる腱の内側陥凹中に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-lr9', name: '陰包', yomi: 'いんぽう', meridian: '足の厥陰肝経', ryaku: 'LR9', type: null,
    location: '大腿部内側、薄筋と縫工筋の間、膝蓋骨底の上方4寸。曲泉の上方、膝蓋骨底上方4寸の高さで、薄筋と縫工筋との間に取る（膝蓋骨上縁から恥骨結合上縁までの長さを1尺8寸とする）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-lr10', name: '足五里', yomi: 'あしごり', meridian: '足の厥陰肝経', ryaku: 'LR10', type: null,
    location: '大腿部内側、気衝の下方3寸、動脈拍動部。大腿内側の上部で気衝（胃経）の下方3寸、動脈拍動部に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-lr11', name: '陰廉', yomi: 'いんれん', meridian: '足の厥陰肝経', ryaku: 'LR11', type: null,
    location: '大腿部内側、気衝の下方2寸。大腿内側の上部で気衝（胃経）の外下方2寸に取る（長内転筋の外方にある）。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-lr12', name: '急脈', yomi: 'きゅうみゃく', meridian: '足の厥陰肝経', ryaku: 'LR12', type: null,
    location: '鼡径部、恥骨結合上縁と同じ高さ、前正中線の外方2寸5分。曲骨（任脈）の外方2寸5分に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-lr13', name: '章門', yomi: 'しょうもん', meridian: '足の厥陰肝経', ryaku: 'LR13', type: '脾の募穴・八会穴の臓会',
    location: '側腹部、第11肋骨端下縁。側臥して、第11肋骨前端の下縁に取る。',
    shuji: null, figure: null, sourceIds: [],
  },
  {
    id: 'kc-lr14', name: '期門', yomi: 'きもん', meridian: '足の厥陰肝経', ryaku: 'LR14', type: '肝の募穴',
    location: '前胸部、第6肋間、前正中線の外方4寸。乳頭中央の下方で、乳根（胃経）の1肋間下に取る（巨闕＝任脈の外方4寸にあたる。女性では鎖骨中線と第6肋間の交点に取る）。',
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
