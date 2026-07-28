// ============================================================
// 研修教材一覧（るるくるスプラウト「教材確認 STEP1 レッスン」）
// 画面に表示された順番をもとに、内容ごとに大項目（ジャンル）を作り、
// 各大項目の中で項目に 1〜 の番号を振っています。
//
// covered: true の項目はこのアプリ内に詳細コンテンツを収録済み。
//   link にアプリ内のパスを指定するとボタンから直接開けます。
// covered: false の項目は研修ポータル側の動画・テキストの「見出し」のみで、
//   このアプリには詳細内容が入っていません（チェックのみ可能）。
// ============================================================

export type MaterialItem = {
  /** 大項目内の通し番号（1始まり） */
  no: number;
  /** 一意なID（チェック状態の保存キーに使用） */
  id: string;
  /** 教材名（研修ポータル表示のまま） */
  title: string;
  /** 教材の種類 */
  kind: "video" | "text";
  /** このアプリ内に詳細コンテンツを収録済みか */
  covered: boolean;
  /** covered=true のときのアプリ内リンク */
  link?: string;
};

export type MaterialGenre = {
  /** 大項目番号（1始まり） */
  no: number;
  /** 大項目名 */
  title: string;
  items: MaterialItem[];
};

export const materialGenres: MaterialGenre[] = [
  {
    no: 1,
    title: "オリエンテーション（面談・受講案内）",
    items: [
      {
        no: 1,
        id: "m1-1",
        title: "面談動画（202512）",
        kind: "video",
        covered: true,
        link: "/category/payroll",
      },
      { no: 2, id: "m1-2", title: "受講約款", kind: "text", covered: false },
    ],
  },
  {
    no: 2,
    title: "リラクゼーション基礎知識",
    items: [
      { no: 1, id: "m2-1", title: "リラクゼーション座学（2607）", kind: "video", covered: false },
      { no: 2, id: "m2-2", title: "リラクゼーション基礎知識①", kind: "text", covered: false },
      { no: 3, id: "m2-3", title: "リラクゼーション基礎知識②", kind: "text", covered: false },
      { no: 4, id: "m2-4", title: "リラクゼーション基礎知識③", kind: "text", covered: false },
    ],
  },
  {
    no: 3,
    title: "自主基準",
    items: [
      {
        no: 1,
        id: "m3-1",
        title: "自主基準（前半）",
        kind: "video",
        covered: true,
        link: "/category/standards",
      },
      {
        no: 2,
        id: "m3-2",
        title: "自主基準（後半）",
        kind: "video",
        covered: true,
        link: "/category/standards",
      },
      {
        no: 3,
        id: "m3-3",
        title: "自主基準テストを受講する",
        kind: "text",
        covered: true,
        link: "/test",
      },
    ],
  },
  {
    no: 4,
    title: "もみほぐし手技",
    items: [
      { no: 1, id: "m4-1", title: "もみほぐし（ブロック1.導入〜腕）2607", kind: "video", covered: false },
      { no: 2, id: "m4-2", title: "もみほぐし（ブロック②起立筋〜腰）2607", kind: "video", covered: false },
      { no: 3, id: "m4-3", title: "もみほぐし（ブロック③下半身導入〜足裏）2607", kind: "video", covered: false },
      { no: 4, id: "m4-4", title: "もみほぐし（ブロック4.仰向け）2607", kind: "video", covered: false },
      { no: 5, id: "m4-5", title: "もみほぐし（ブロック④仰向け）2607", kind: "text", covered: false },
      { no: 6, id: "m4-6", title: "もみほぐし（ブロック1.導入〜腕）2607", kind: "text", covered: false },
      { no: 7, id: "m4-7", title: "もみほぐし（ブロック2.起立筋〜腰）2607", kind: "text", covered: false },
      { no: 8, id: "m4-8", title: "もみほぐし（ブロック3.下半身導入〜足裏）2607", kind: "text", covered: false },
    ],
  },
  {
    no: 5,
    title: "ヘッド",
    items: [
      { no: 1, id: "m5-1", title: "クイックヘッド（2606）", kind: "video", covered: false },
      { no: 2, id: "m5-2", title: "ヘッド（2606）", kind: "text", covered: false },
    ],
  },
  {
    no: 6,
    title: "接客",
    items: [
      { no: 1, id: "m6-1", title: "接客の心得①", kind: "video", covered: false },
      { no: 2, id: "m6-2", title: "接客の心得②", kind: "video", covered: false },
      { no: 3, id: "m6-3", title: "接客の心得③", kind: "video", covered: false },
      { no: 4, id: "m6-4", title: "接客_1.受付（予約有り）", kind: "video", covered: false },
      { no: 5, id: "m6-5", title: "接客_1.受付（予約無し）", kind: "video", covered: false },
      { no: 6, id: "m6-6", title: "接客_2.案内", kind: "video", covered: false },
      { no: 7, id: "m6-7", title: "接客_3.施術", kind: "video", covered: false },
      { no: 8, id: "m6-8", title: "接客_4.会計", kind: "video", covered: false },
      { no: 9, id: "m6-9", title: "接客（③施術前）", kind: "text", covered: false },
      { no: 10, id: "m6-10", title: "接客（④施術中）", kind: "text", covered: false },
      { no: 11, id: "m6-11", title: "接客（⑤施術後）", kind: "text", covered: false },
    ],
  },
  {
    no: 7,
    title: "POSレジ操作",
    items: [
      { no: 1, id: "m7-1", title: "pos_開局日締め編", kind: "video", covered: false },
      { no: 2, id: "m7-2", title: "pos_受注編", kind: "video", covered: false },
      { no: 3, id: "m7-3", title: "pos_会計編", kind: "video", covered: false },
    ],
  },
  {
    no: 8,
    title: "ハンドリフレ",
    items: [
      {
        no: 1,
        id: "m8-1",
        title: "ハンドリフレ（2606）",
        kind: "video",
        covered: true,
        link: "/hand",
      },
      {
        no: 2,
        id: "m8-2",
        title: "ハンド（2606）",
        kind: "text",
        covered: true,
        link: "/hand",
      },
    ],
  },
  {
    no: 9,
    title: "足つぼ",
    items: [
      { no: 1, id: "m9-1", title: "足つぼ前半（2606）", kind: "video", covered: false },
      { no: 2, id: "m9-2", title: "足つぼ後半（2606）", kind: "video", covered: false },
      { no: 3, id: "m9-3", title: "足つぼ（前半）", kind: "text", covered: false },
      { no: 4, id: "m9-4", title: "足つぼ（後半）", kind: "text", covered: false },
    ],
  },
];
