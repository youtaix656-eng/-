// マインドマップ用の「比較されやすいもの」「数値を変えられやすいもの」データ。
//
// ⚠️ 重要：標準的で誤りにくい知識に絞った学習補助データです。必ず最新の教科書・
//   出題基準でご確認ください（下記 REFERENCES）。相互に矛盾する場合は教科書優先。
//
// REFERENCES:
//  [1] 東洋療法学校協会 編『新版 経絡経穴概論（第2版）』医道の日本社
//  [2] WHO/WPRO『標準経穴部位 日本語公式版』医道の日本社, 2009
//  [3] 東洋療法学校協会 編『新版 東洋医学概論』/『解剖学』/『生理学』ほか 教科書シリーズ
//  [4] 東洋療法研修試験財団『はり師・きゅう師国家試験 出題基準』

export const MINDMAP_REFERENCES = [
  '東洋療法学校協会 編『新版 経絡経穴概論（第2版）』医道の日本社',
  'WHO/WPRO『標準経穴部位 日本語公式版』医道の日本社, 2009',
  '東洋療法学校協会 編 教科書シリーズ『東洋医学概論』『解剖学』『生理学』ほか',
  '東洋療法研修試験財団『はり師・きゅう師国家試験 出題基準』',
];

// 比較されやすいもの（違いを取り違えやすい＝入れ替え問題が作りやすい）
// terms: このグループに関係づけたいキーワード（センターにしたとき表示）
export const COMPARISONS = [
  {
    id: 'yaketsu',
    title: '要穴の種類（原穴・絡穴・郄穴）',
    members: ['原穴：各経の代表的な要穴（十二原穴）', '絡穴：表裏の経をつなぐ（十五絡穴）', '郄穴：急性症状・出血に（十六郄穴）'],
    note: '「合谷＝原穴」を「絡穴」に書き換えるなどの入れ替えに注意。数は 原穴12・絡穴15・郄穴16。',
    terms: ['原穴', '絡穴', '郄穴', '要穴', '合谷', '列缺', '孔最'],
  },
  {
    id: 'gotsuketsu',
    title: '五兪穴の順序（井・滎・兪・経・合）',
    members: ['井穴：末端', '滎穴', '兪穴', '経穴', '合穴：肘膝に近い'],
    note: '流注の向き（末端→体幹）と順序の入れ替えに注意。陰経・陽経で五行配当が異なる。',
    terms: ['五兪穴', '井穴', '滎穴', '兪穴', '経穴', '合穴'],
  },
  {
    id: 'jiritsu',
    title: '交感神経 ⇔ 副交感神経',
    members: ['交感：心拍↑・散瞳・気管支拡張・消化抑制', '副交感：心拍↓・縮瞳・消化促進'],
    note: '作用が逆。「散瞳＝副交感」等の入れ替えに注意。節前・節後線維の長さも問われる。',
    terms: ['交感神経', '副交感神経', '自律神経'],
  },
  {
    id: 'gogyo',
    title: '五行 相生 ⇔ 相剋',
    members: ['相生：木→火→土→金→水→木（生む）', '相剋：木→土→水→火→金→木（抑える）'],
    note: '「相生」と「相剋」の向き・組合せの入れ替えに注意。母子関係＝相生。',
    terms: ['五行', '相生', '相剋', '木', '火', '土', '金', '水'],
  },
  {
    id: 'shishin',
    title: '四診（望・聞・問・切）',
    members: ['望診：視覚', '聞診：聴覚・嗅覚', '問診：問いかけ', '切診：触れる（脈診・腹診）'],
    note: '「舌診＝望診」「脈診＝切診」。感覚のどれを使うかの入れ替えに注意。',
    terms: ['四診', '望診', '聞診', '問診', '切診', '脈診', '舌診'],
  },
  {
    id: 'hakko',
    title: '八綱（表裏・寒熱・虚実・陰陽）',
    members: ['表裏：病位', '寒熱：性質', '虚実：正邪の盛衰', '陰陽：総括'],
    note: '対になる概念の取り違えに注意。虚証と実証の症状の入れ替えが頻出。',
    terms: ['八綱', '虚実', '寒熱', '表裏', '陰陽', '虚証', '実証'],
  },
];

// 数値を変えられやすいもの（正しい数を覚える）
export const NUMBER_FACTS = [
  { id: 'n-keiketsu', topic: 'WHO標準の経穴数', value: '361穴', note: '正経十二経＋任脈・督脈の単穴を合わせた総数。', terms: ['経穴', '経穴数', '361'] },
  { id: 'n-seikei', topic: '正経', value: '十二経', note: '手足の陰陽で12。奇経は別に八脈。', terms: ['正経十二経', '経絡', '正経'] },
  { id: 'n-kikei', topic: '奇経', value: '八脈', note: '督脈・任脈・衝脈・帯脈・陰維・陽維・陰蹻・陽蹻。', terms: ['奇経', '奇経八脈'] },
  { id: 'n-genketsu', topic: '原穴', value: '12', note: '十二原穴（各正経に1つ）。', terms: ['原穴'] },
  { id: 'n-rakuketsu', topic: '絡穴', value: '15', note: '十五絡穴（十二経＋任脈・督脈・脾之大絡）。', terms: ['絡穴'] },
  { id: 'n-gekiketsu', topic: '郄穴', value: '16', note: '十二経＋陰維・陽維・陰蹻・陽蹻。', terms: ['郄穴'] },
  { id: 'n-boketsu', topic: '募穴', value: '12', note: '五臓六腑（＋心包）に対応。', terms: ['募穴'] },
  { id: 'n-hakkai', topic: '八会穴', value: '8', note: '臓・腑・気・血・筋・脈・骨・髄。', terms: ['八会穴'] },
  { id: 'n-soketsu', topic: '四総穴', value: '4', note: '肚腹＝足三里・腰背＝委中・頭項＝列缺・面口＝合谷。', terms: ['四総穴', '足三里', '委中', '列缺', '合谷'] },
  { id: 'n-keitsui', topic: '頸椎', value: '7個', note: '脊柱：頸7・胸12・腰5。', terms: ['頸椎', '脊柱', '椎骨'] },
  { id: 'n-kyotsui', topic: '胸椎', value: '12個', note: '肋骨と同じく12（対）。', terms: ['胸椎', '脊柱', '肋骨'] },
  { id: 'n-yotsui', topic: '腰椎', value: '5個', note: '仙椎5（癒合）・尾椎は通常3〜5。', terms: ['腰椎', '脊柱'] },
  { id: 'n-rokkotsu', topic: '肋骨', value: '12対', note: '真肋7・仮肋5（うち浮肋2）。', terms: ['肋骨'] },
  { id: 'n-nou', topic: '脳神経', value: '12対', note: '嗅・視・動眼…（Ⅰ〜Ⅻ）。', terms: ['脳神経', '三叉神経', '顔面神経', '迷走神経'] },
  { id: 'n-sekizui', topic: '脊髄神経', value: '31対', note: '頸8・胸12・腰5・仙5・尾1。', terms: ['脊髄神経', '脊髄'] },
];

// キーワードに関係する比較グループ
export function comparisonsForKeyword(kw) {
  return COMPARISONS.filter((c) => c.terms.includes(kw) || c.title.includes(kw));
}
// キーワードに関係する数値ファクト
export function numbersForKeyword(kw) {
  return NUMBER_FACTS.filter((n) => n.terms.includes(kw) || n.topic.includes(kw));
}

// マインドマップのセンターとして「おすすめ」できるトピック（データが無くても学べる）
export function suggestedCenters() {
  const set = new Set();
  COMPARISONS.forEach((c) => c.terms.slice(0, 2).forEach((t) => set.add(t)));
  NUMBER_FACTS.forEach((n) => n.terms.slice(0, 1).forEach((t) => set.add(t)));
  return [...set];
}
