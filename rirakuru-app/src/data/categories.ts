import type { Category } from "./types";

// ============================================================
// カテゴリ一覧（トップページに並ぶ大分類）
// 並び順がそのまま表示順になります。
// ============================================================
export const categories: Category[] = [
  {
    slug: "attendance",
    title: "出勤・退勤の流れ",
    description: "入店時刻・着替え・朝礼・タイムカード・清掃分担・退勤処理",
    icon: "Clock",
  },
  {
    slug: "service-flow",
    title: "接客の流れ",
    description: "お出迎え〜カルテ確認〜ヒアリング〜ご案内〜施術後説明〜お見送り・会計",
    icon: "HeartHandshake",
  },
  {
    slug: "treatment",
    title: "施術手順",
    description: "うつ伏せ／仰向け／横向きの基本ルーティン・部位別・時間配分",
    icon: "Hand",
  },
  {
    slug: "options",
    title: "オプションメニュー",
    description: "足つぼ・ヘッドスパ・ホットストーンなどの手順と提案タイミング",
    icon: "Sparkles",
  },
  {
    slug: "contraindications",
    title: "禁忌・注意事項",
    description: "施術を控える症状・妊娠中の対応・体調不良・圧の確認方法",
    icon: "ShieldAlert",
  },
  {
    slug: "qa",
    title: "お客様対応Q&A",
    description: "要望・クレームへの返し方・指名対応・延長提案トーク例",
    icon: "MessageCircleQuestion",
  },
  {
    slug: "store-rules",
    title: "店舗ルール",
    description: "身だしなみ・私物管理・休憩・シフト申請・遅刻欠勤の連絡手順",
    icon: "ClipboardList",
  },
  {
    slug: "supplies",
    title: "備品・清掃",
    description: "タオル交換・ベッドメイク・備品の場所・消耗品補充の基準",
    icon: "Package",
  },
  {
    slug: "payroll",
    title: "給与・シフト",
    description: "歩合の仕組み・指名料・シフト提出締切・有給",
    icon: "Wallet",
  },
  {
    slug: "glossary",
    title: "用語集",
    description: "社内用語・施術用語（五十音順）",
    icon: "BookA",
  },
];

/** slug からカテゴリを引く */
export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
