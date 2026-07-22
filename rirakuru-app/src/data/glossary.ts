import type { GlossaryTerm } from "./types";

// ============================================================
// 用語集
// reading（よみがな・ひらがな）で五十音順に並べ、頭出しナビを作ります。
// ============================================================
export const glossary: GlossaryTerm[] = [
  {
    id: "g-momihogushi",
    term: "もみほぐし",
    reading: "もみほぐし",
    definition: "着衣のまま行う、筋肉のこりをほぐす施術。りらくるの基本メニュー。",
  },
  {
    id: "g-shimei",
    term: "指名",
    reading: "しめい",
    definition: "お客様がセラピストを指定してご予約すること。指名料が加算される場合がある。",
  },
  {
    id: "g-karute",
    term: "カルテ",
    reading: "かるて",
    definition: "お客様の情報・要望・施術履歴を記録する用紙・データ。初回時に作成する。",
  },
  {
    id: "g-hansyaku",
    term: "反射区",
    reading: "はんしゃく",
    definition: "足裏などにある、体の各部位に対応するとされる区域。足つぼで刺激する。",
  },
  {
    id: "g-atsu",
    term: "圧（あつ）",
    reading: "あつ",
    definition: "施術で加える力の強さ。「強め／弱め」をお客様に確認して調整する。",
  },
];
