// 「鍼灸国家試験の内容」の初期スキャフォールド（枠）。
// 本文は空のまま用意し、あとで自分で貼り付けて使う。
// ※ 公式の最新情報は必ず（公財）東洋療法研修試験財団の発表で確認すること。

let n = 0;
const id = () => `ec-seed-${++n}`;

const DEFAULT_EXAM_CONTENT = [
  { id: id(), title: '試験概要（試験日・時間割）', body: '' },
  { id: id(), title: '受験資格・受験手続き', body: '' },
  { id: id(), title: '出題基準・出題範囲', body: '' },
  { id: id(), title: '合格基準・配点', body: '' },
  { id: id(), title: '当日の持ち物・注意事項', body: '' },
  { id: id(), title: '過去の頻出テーマ・傾向メモ', body: '' },
  { id: id(), title: 'その他メモ', body: '' },
];

export default DEFAULT_EXAM_CONTENT;
