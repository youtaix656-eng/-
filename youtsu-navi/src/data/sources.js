// 提案ロジックの根拠管理 — 企画書 改善策 #1・#2
//
// パターン判定・レッドフラグ・施術方針の根拠になった情報源をここに一元化し、
// 各カードから sourceIds で参照する。結果画面には常に「この提案の根拠」を出す。
//
// review: 'unreviewed'（AI・作成者のみ）/ 'reviewed'（医師・専門家の監修済み）
// 企画書 Phase 1.5 の監修レビューが済んだ項目から 'reviewed' に更新していく運用。

export const REVIEW_STATUS = {
  unreviewed: { label: '未監修', tone: 'warn' },
  reviewed: { label: '監修済み', tone: 'ok' },
};

export const SOURCES = [
  {
    id: 'jpn_lbp_gl2019',
    tocTitle: '腰痛診療ガイドライン2019',
    reading: 'ようつうしんりょうがいどらいん',
    title: '腰痛診療ガイドライン2019（改訂第2版）',
    author: '日本整形外科学会・日本腰痛学会 監修',
    publisher: '南江堂',
    year: 2019,
    kind: 'ガイドライン',
    note: 'レッドフラグ・急性腰痛の経過・安静より活動維持という方針の根拠として参照。',
    review: 'unreviewed',
  },
  {
    id: 'nice_ng59',
    tocTitle: 'NICE NG59（腰痛・坐骨神経痛）',
    reading: '',
    title: 'Low back pain and sciatica in over 16s: assessment and management (NG59)',
    author: 'NICE（英国国立医療技術評価機構）',
    publisher: 'NICE',
    year: 2016,
    kind: 'ガイドライン',
    note: '2020年更新。運動療法・徒手療法を運動と併用する位置づけ、安静を勧めない方針の根拠。',
    review: 'unreviewed',
  },
  {
    id: 'who_cplbp_2023',
    tocTitle: 'WHO 慢性腰痛ガイドライン（2023）',
    reading: '',
    title: 'WHO guideline for non-surgical management of chronic primary low back pain in adults',
    author: '世界保健機関（WHO）',
    publisher: 'WHO',
    year: 2023,
    kind: 'ガイドライン',
    note: '慢性一次性腰痛に対する非手術的管理（運動・教育・徒手療法など）の位置づけ。',
    review: 'unreviewed',
  },
  {
    id: 'downie_bmj2013',
    tocTitle: 'Downie 2013（レッドフラグの精度）',
    reading: '',
    title: 'Red flags to screen for malignancy and fracture in patients with low back pain: systematic review',
    author: 'Downie A, et al.',
    publisher: 'BMJ 2013;347:f7095',
    year: 2013,
    kind: 'systematic review',
    note: 'レッドフラグ単独の検出力は高くないため「複数の該当」「経過での再評価」を重視する根拠。',
    review: 'unreviewed',
  },
  {
    id: 'mhlw_lbp2013',
    tocTitle: '職場における腰痛予防対策指針',
    reading: 'しょくばにおけるようつうよぼうたいさくししん',
    title: '職場における腰痛予防対策指針',
    author: '厚生労働省',
    publisher: '厚生労働省',
    year: 2013,
    kind: '行政指針',
    note: '作業姿勢・持ち上げ動作などホームケア／生活指導の根拠。',
    review: 'unreviewed',
  },
  {
    id: 'law_anma217',
    tocTitle: 'あん摩マツサージ指圧師等に関する法律',
    reading: 'あんままつさーじしあつしとうにかんするほうりつ',
    title: 'あん摩マツサージ指圧師、はり師、きゆう師等に関する法律（昭和22年法律第217号）',
    author: '—',
    publisher: 'e-Gov 法令検索',
    year: 1947,
    kind: '法令',
    note: '資格別の業務範囲の出発点。実務上の解釈は通知・自治体判断にもよるため ※要確認。',
    review: 'unreviewed',
  },
  {
    id: 'law_judo19',
    tocTitle: '柔道整復師法',
    reading: 'じゅうどうせいふくしほう',
    title: '柔道整復師法（昭和45年法律第19号）',
    author: '—',
    publisher: 'e-Gov 法令検索',
    year: 1970,
    kind: '法令',
    note: '応急手当を除き医師の同意が必要な範囲など。実務解釈は ※要確認。',
    review: 'unreviewed',
  },
  {
    id: 'law_ishi17',
    tocTitle: '医師法 第17条',
    reading: 'いしほうだいじゅうななじょう',
    title: '医師法（昭和23年法律第201号）第17条',
    author: '—',
    publisher: 'e-Gov 法令検索',
    year: 1948,
    kind: '法令',
    note: '診断は医行為。本アプリが「診断」を行わない立てつけである根拠。',
    review: 'unreviewed',
  },
  {
    id: 'textbook_toyo',
    tocTitle: '教科書（東洋療法学校協会編）',
    reading: 'きょうかしょ',
    title: '教科書（東洋療法学校協会編 各科目）',
    author: '東洋療法学校協会 編',
    publisher: '医道の日本社 ほか',
    year: null,
    kind: '教科書',
    note: '解剖・生理・臨床医学各論の一般的記載を参照。版により記載差があるため要確認。',
    review: 'unreviewed',
  },
];

export const SOURCE_MAP = Object.fromEntries(SOURCES.map((s) => [s.id, s]));

export function sourcesFor(ids = []) {
  return ids.map((id) => SOURCE_MAP[id]).filter(Boolean);
}

/** 監修レビューの進捗（設定画面に表示） */
export function reviewProgress(list = SOURCES) {
  const total = list.length;
  const reviewed = list.filter((s) => s.review === 'reviewed').length;
  return { total, reviewed, pct: total ? Math.round((reviewed / total) * 100) : 0 };
}
