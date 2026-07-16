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
  fourCommandPoints.forEach((f) => add(f.point, f.meridian, '四総穴'));
  return index;
}

export function meridianById(id) {
  return meridians.find((m) => m.id === id) || null;
}
