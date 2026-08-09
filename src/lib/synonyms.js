// タグ正規化・同義語辞書（#12）— 表記ゆれを正式名称へ寄せ、検索の取りこぼしを防ぐ。
//   canonical: 変種→正式名称 / variantsOf: 正式名称→変種一覧 / expandQuery: 検索語を同義語へ展開。
//   医療・鍼灸領域で問われやすい表記ゆれを収録（随時追加）。

// 正式名称 → その別表記（変種）の一覧
export const SYNONYM_GROUPS = {
  頸部: ['頚部', 'けい部'],
  靱帯: ['靭帯', 'じん帯'],
  ビタミン: ['ヴィタミン'],
  カルシウム: ['Ca', 'ｶﾙｼｳﾑ'],
  ナトリウム: ['Na'],
  カリウム: ['K'],
  糖尿病: ['DM'],
  関節リウマチ: ['慢性関節リウマチ', 'RA'],
  心筋梗塞: ['MI', '急性心筋梗塞', 'AMI'],
  脳梗塞: ['脳血栓', '脳塞栓'],
  高血圧: ['高血圧症', 'HT'],
  第一中足趾節関節: ['第1中足趾節関節', 'MTP関節'],
  前十字靱帯: ['前十字靭帯', 'ACL'],
  発育性股関節形成不全: ['先天性股関節脱臼', 'DDH'],
  慢性閉塞性肺疾患: ['COPD'],
  全身性エリテマトーデス: ['SLE'],
};

// 変種 → 正式名称 の逆引きマップ
const CANON = (() => {
  const m = new Map();
  for (const [canon, variants] of Object.entries(SYNONYM_GROUPS)) {
    m.set(canon, canon);
    for (const v of variants) m.set(v, canon);
  }
  return m;
})();

// 変種を正式名称へ寄せる（未知語はそのまま返す）
export function canonical(term) {
  const t = String(term || '').trim();
  return CANON.get(t) || t;
}

// 正式名称に紐づく変種一覧（正式名称自身を含む）
export function variantsOf(term) {
  const canon = canonical(term);
  const variants = SYNONYM_GROUPS[canon] || [];
  return [canon, ...variants];
}

// 検索語を同義語込みに展開（重複除去）
export function expandQuery(term) {
  return [...new Set(variantsOf(term))];
}
