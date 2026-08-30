// 構造化ナレッジベース（KB）
//
// 問題の「自動生成」と「誤りチェック（内容照合）」の両方の土台となる、
// 鍼灸国家試験の標準知識を構造化したデータ。
//
// ⚠️ 重要：本データは高信頼の標準知識に絞って収録した「監修前ドラフト」です。
// 出題・学習に用いる前に、必ず下記の参考文献および最新の出題基準でご確認ください。
//
// 参考文献（References）:
//  [1] 公益社団法人 東洋療法学校協会 編『新版 経絡経穴概論（第2版）』医道の日本社
//  [2] WHO西太平洋地域事務局『WHO/WPRO標準経穴部位 日本語公式版』
//      （第二次日本経穴委員会 監訳）医道の日本社, 2009
//  [3] 東洋療法学校協会 編『新版 東洋医学概論』医道の日本社
//  [4] 東洋療法学校協会 編 教科書シリーズ『解剖学』『生理学』『病理学概論』
//      『はりきゅう理論』医歯薬出版
//  [5] 公益財団法人 東洋療法研修試験財団『はり師国家試験・きゅう師国家試験 出題基準』
//
// ※ 版・ページは各自の手元の版でご確認ください。相互に矛盾がある場合は
//    最新の教科書・出題基準を優先してください。

export const REFERENCES = [
  '公益社団法人 東洋療法学校協会 編『新版 経絡経穴概論（第2版）』医道の日本社',
  'WHO西太平洋地域事務局『WHO/WPRO標準経穴部位 日本語公式版』（第二次日本経穴委員会 監訳）医道の日本社, 2009',
  '東洋療法学校協会 編『新版 東洋医学概論』医道の日本社',
  '東洋療法学校協会 編 教科書シリーズ『解剖学』『生理学』『病理学概論』『はりきゅう理論』医歯薬出版',
  '公益財団法人 東洋療法研修試験財団『はり師国家試験・きゅう師国家試験 出題基準』',
];

// ---- 正経十二経＋奇経（任脈・督脈） ----
// element: 五行、yinYang: 陰陽、organ: 対応する臓腑
export const meridians = [
  { id: 'LU', name: '手の太陰肺経', short: '肺経', organ: '肺', yinYang: '陰', element: '金' },
  { id: 'LI', name: '手の陽明大腸経', short: '大腸経', organ: '大腸', yinYang: '陽', element: '金' },
  { id: 'ST', name: '足の陽明胃経', short: '胃経', organ: '胃', yinYang: '陽', element: '土' },
  { id: 'SP', name: '足の太陰脾経', short: '脾経', organ: '脾', yinYang: '陰', element: '土' },
  { id: 'HT', name: '手の少陰心経', short: '心経', organ: '心', yinYang: '陰', element: '火' },
  { id: 'SI', name: '手の太陽小腸経', short: '小腸経', organ: '小腸', yinYang: '陽', element: '火' },
  { id: 'BL', name: '足の太陽膀胱経', short: '膀胱経', organ: '膀胱', yinYang: '陽', element: '水' },
  { id: 'KI', name: '足の少陰腎経', short: '腎経', organ: '腎', yinYang: '陰', element: '水' },
  { id: 'PC', name: '手の厥陰心包経', short: '心包経', organ: '心包', yinYang: '陰', element: '相火' },
  { id: 'TE', name: '手の少陽三焦経', short: '三焦経', organ: '三焦', yinYang: '陽', element: '相火' },
  { id: 'GB', name: '足の少陽胆経', short: '胆経', organ: '胆', yinYang: '陽', element: '木' },
  { id: 'LR', name: '足の厥陰肝経', short: '肝経', organ: '肝', yinYang: '陰', element: '木' },
];

// 原穴（十二原穴）: 経絡ID → 経穴名
export const yuanPoints = {
  LU: '太淵', LI: '合谷', ST: '衝陽', SP: '太白',
  HT: '神門', SI: '腕骨', BL: '京骨', KI: '太谿',
  PC: '大陵', TE: '陽池', GB: '丘墟', LR: '太衝',
};

// 絡穴（十五絡穴）: 経絡ID → 経穴名（脾之大絡＝大包を含む）
export const luoPoints = {
  LU: '列缺', LI: '偏歴', ST: '豊隆', SP: '公孫',
  HT: '通里', SI: '支正', BL: '飛揚', KI: '大鍾',
  PC: '内関', TE: '外関', GB: '光明', LR: '蠡溝',
  CV: '鳩尾', GV: '長強', SP_GREAT: '大包',
};

// 郄穴（十二経の郄穴）: 経絡ID → 経穴名
export const xiPoints = {
  LU: '孔最', LI: '温溜', ST: '梁丘', SP: '地機',
  HT: '陰郄', SI: '養老', BL: '金門', KI: '水泉',
  PC: '郄門', TE: '会宗', GB: '外丘', LR: '中都',
};

// 募穴（十二募穴）: 経絡ID → 経穴名
export const muPoints = {
  LU: '中府', LI: '天枢', ST: '中脘', SP: '章門',
  HT: '巨闕', SI: '関元', BL: '中極', KI: '京門',
  PC: '膻中', TE: '石門', GB: '日月', LR: '期門',
};
// 募穴の所在（自経上／任脈上／他経上）。自経上は中府（肺）・日月（胆）・期門（肝）の3穴のみ。
// 天枢（大腸募）は足の陽明胃経上（ST25）、章門（脾募）は足の厥陰肝経上（LR13）にあり、
// どちらも自経上ではない（2026-08-28、任脈24穴を教科書p.42-51で直接確認して訂正。
// 天枢が任脈24穴に含まれないこと・章門が肝経の経穴であることの両方を裏付けに使った）。
export const muPointLocation = {
  LU: 'self', LI: 'ST', ST: 'CV', SP: 'LR',
  HT: 'CV', SI: 'CV', BL: 'CV', KI: 'GB',
  PC: 'CV', TE: 'CV', GB: 'self', LR: 'self',
};

// 兪穴（十二背部兪穴）: 経絡ID → 経穴名（すべて足の太陽膀胱経上にある）
export const shuPoints = {
  LU: '肺兪', LI: '大腸兪', ST: '胃兪', SP: '脾兪',
  HT: '心兪', SI: '小腸兪', BL: '膀胱兪', KI: '腎兪',
  PC: '厥陰兪', TE: '三焦兪', GB: '胆兪', LR: '肝兪',
};

// 独自の経穴を持たない6奇経の所属経穴（他経の経穴を借用する）
// 出典：新版 経絡経穴概論（第2版）p.212-214
export const extraMeridianPoints = [
  {
    id: 'chong', name: '衝脈', count: 22,
    points: '腎経の横骨〜幽門（左右各11穴）',
    note: '気衝から胃経の腹部経穴とする説もあるが、一般には前者（腎経ルート）をとる。',
  },
  {
    id: 'dai', name: '帯脈', count: 8,
    points: '肝経の章門＋胆経の帯脈・五枢・維道（左右各4穴）',
    note: null,
  },
  {
    id: 'yangqiao', name: '陽蹻脈', count: 22,
    points: '膀胱経の申脈・僕参・跗陽・睛明、胆経の居髎、小腸経の臑兪、大腸経の肩髃・巨骨、胃経の地倉・巨髎・承泣（左右各11穴）',
    note: '風池穴を加える説もある。',
  },
  {
    id: 'yinqiao', name: '陰蹻脈', count: 8,
    points: '腎経の然谷・照海・交信、膀胱経の睛明（左右各4穴）',
    note: null,
  },
  {
    id: 'yangwei', name: '陽維脈', count: 24,
    points: '膀胱経の金門、胆経の陽交・肩井・陽白・本神・頭臨泣・正営・脳空・風池、小腸経の臑兪、三焦経の天髎（左右各11穴）＋督脈の瘂門・風府',
    note: '古書には異説も多い。',
  },
  {
    id: 'yinwei', name: '陰維脈', count: 12,
    points: '腎経の築賓、脾経の府舎・大横・腹哀、肝経の期門（左右各5穴）＋任脈の天突・廉泉',
    note: null,
  },
];

// 361穴のうち、部位・取り方が2説併記されている6穴
// 出典：新版 経絡経穴概論（第2版）
export const dualDefinitionPoints = ['禾髎', '迎香', '水溝', '労宮', '中衝', '環跳'];

// 紛らわしい経穴（同経同字・異経同字・同音異字での取り違え）
// 出典：新版 経絡経穴概論（第2版）p.239 参考資料
export const confusablePoints = [
  // (1) 同経・同字・異穴（2組）
  { group: 'same-meridian', a: '頭竅陰', aMeridian: 'GB', b: '足竅陰', bMeridian: 'GB' },
  { group: 'same-meridian', a: '頭臨泣', aMeridian: 'GB', b: '足臨泣', bMeridian: 'GB' },
  // (2) 異経・同字・異穴（4組）
  { group: 'same-char', a: '手五里', aMeridian: 'LI', b: '足五里', bMeridian: 'LR' },
  { group: 'same-char', a: '手三里', aMeridian: 'LI', b: '足三里', bMeridian: 'ST' },
  { group: 'same-char', a: '足通谷', aMeridian: 'BL', b: '腹通谷', bMeridian: 'KI' },
  { group: 'same-char', a: '腰陽関', aMeridian: 'GV', b: '膝陽関', bMeridian: 'GB' },
  // (3) 同音・異字・異穴（17組）
  { group: 'homophone', a: '少海', aMeridian: 'HT', b: '小海', bMeridian: 'SI' },
  { group: 'homophone', a: '照海', aMeridian: 'KI', b: '少海', bMeridian: 'HT' },
  { group: 'homophone', a: '承漿', aMeridian: 'CV', b: '少商', bMeridian: 'LU' },
  { group: 'homophone', a: '少衝', aMeridian: 'HT', b: '少商', bMeridian: 'LU' },
  { group: 'homophone', a: '箕門', aMeridian: 'SP', b: '期門', bMeridian: 'LR' },
  { group: 'homophone', a: '極泉', aMeridian: 'HT', b: '曲泉', bMeridian: 'LR' },
  { group: 'homophone', a: '下脘', aMeridian: 'CV', b: '下関', bMeridian: 'ST' },
  { group: 'homophone', a: '建里', aMeridian: 'CV', b: '懸釐', bMeridian: 'GB' },
  { group: 'homophone', a: '顴髎', aMeridian: 'SI', b: '肩髎', bMeridian: 'TE' },
  { group: 'homophone', a: '上脘', aMeridian: 'CV', b: '上関', bMeridian: 'GB' },
  { group: 'homophone', a: '承泣', aMeridian: 'ST', b: '商丘', bMeridian: 'SP' },
  { group: 'homophone', a: '少府', aMeridian: 'HT', b: '承扶', bMeridian: 'BL' },
  { group: 'homophone', a: '衝門', aMeridian: 'SP', b: '章門', bMeridian: 'LR' },
  { group: 'homophone', a: '商陽', aMeridian: 'LI', b: '衝陽', bMeridian: 'ST' },
  { group: 'homophone', a: '神道', aMeridian: 'GV', b: '神堂', bMeridian: 'BL' },
  { group: 'homophone', a: '肘髎', aMeridian: 'LI', b: '中髎', bMeridian: 'BL' },
  { group: 'homophone', a: '天宗', aMeridian: 'SI', b: '天窓', bMeridian: 'SI' },
  { group: 'homophone', a: '不容', aMeridian: 'ST', b: '跗陽', bMeridian: 'BL' },
  { group: 'homophone', a: '陽綱', aMeridian: 'BL', b: '陽交', bMeridian: 'GB' },
];

// 四総穴: 主治部位 → 経穴（「肚腹は三里に留め…」の歌訣）
export const fourCommandPoints = [
  { area: '肚腹（腹部）', point: '足三里', meridian: 'ST' },
  { area: '腰背', point: '委中', meridian: 'BL' },
  { area: '頭項', point: '列缺', meridian: 'LU' },
  { area: '面口', point: '合谷', meridian: 'LI' },
];

// ---- 五行 ----
// 相生（そうせい）: A が B を生む  A → B
export const wuxingSheng = [
  ['木', '火'], ['火', '土'], ['土', '金'], ['金', '水'], ['水', '木'],
];
// 相剋（そうこく）: A が B を剋す  A → B
export const wuxingKe = [
  ['木', '土'], ['土', '水'], ['水', '火'], ['火', '金'], ['金', '木'],
];
export const wuxingElements = ['木', '火', '土', '金', '水'];

// ---- 五臓の五行色体表 ----
// 五主（五体）・五官・五志・五色・五味
export const zangTable = [
  { zang: '肝', element: '木', tai: '筋', kan: '目', shi: '怒', shiki: '青', mi: '酸' },
  { zang: '心', element: '火', tai: '血脈', kan: '舌', shi: '喜', shiki: '赤', mi: '苦' },
  { zang: '脾', element: '土', tai: '肌肉', kan: '口', shi: '思', shiki: '黄', mi: '甘' },
  { zang: '肺', element: '金', tai: '皮（毛）', kan: '鼻', shi: '悲・憂', shiki: '白', mi: '辛' },
  { zang: '腎', element: '水', tai: '骨', kan: '耳', shi: '恐（驚）', shiki: '黒', mi: '鹹' },
];

// 逆引き用：経穴名 → { meridian, role } のインデックスを作る
export function buildPointIndex() {
  const index = {};
  const add = (point, meridianId, role) => {
    if (!point) return;
    if (!index[point]) index[point] = [];
    index[point].push({ meridian: meridianId, role });
  };
  Object.entries(yuanPoints).forEach(([m, p]) => add(p, m, '原穴'));
  Object.entries(luoPoints).forEach(([m, p]) => add(p, m, '絡穴'));
  Object.entries(xiPoints).forEach(([m, p]) => add(p, m, '郄穴'));
  Object.entries(muPoints).forEach(([m, p]) => add(p, m, '募穴'));
  Object.entries(shuPoints).forEach(([m, p]) => add(p, m, '兪穴'));
  fourCommandPoints.forEach((f) => add(f.point, f.meridian, '四総穴'));
  return index;
}

export function meridianById(id) {
  return meridians.find((m) => m.id === id) || null;
}

// 経絡ID → 表示名（十二正経＋任脈・督脈）。confusablePoints 等、正経以外のIDも扱う。
export function meridianNameById(id) {
  if (id === 'GV') return '督脈';
  if (id === 'CV') return '任脈';
  const m = meridianById(id);
  return m ? m.name : id;
}
