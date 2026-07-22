import type { Checklist } from "./types";

// ============================================================
// チェックリスト
// タップでチェック、日付が変わると自動でリセットされます。
// ============================================================
export const checklists: Checklist[] = [
  {
    id: "open",
    title: "出勤時チェック",
    items: [
      { id: "open-1", label: "身だしなみを整えた（爪・髪・匂い）" },
      { id: "open-2", label: "タイムカードを打刻した" },
      { id: "open-3", label: "朝礼で連絡事項を確認した" },
      { id: "open-4", label: "担当エリアを清掃した" },
      { id: "open-5", label: "ベッドメイク・タオルを準備した" },
    ],
  },
  {
    id: "before-treatment",
    title: "施術前チェック",
    items: [
      { id: "bt-1", label: "コース・時間を確認した" },
      { id: "bt-2", label: "体調・既往歴をヒアリングした" },
      { id: "bt-3", label: "圧の好み（強め/弱め）を確認した" },
      { id: "bt-4", label: "禁忌に該当しないか確認した" },
    ],
  },
  {
    id: "after-treatment",
    title: "施術後チェック",
    items: [
      { id: "at-1", label: "ほぐした部位・ケアを説明した" },
      { id: "at-2", label: "会計（オプション・指名料含む）を確認した" },
      { id: "at-3", label: "ベッド・タオルを片付けた" },
      { id: "at-4", label: "次のお客様の準備をした" },
    ],
  },
  {
    id: "close",
    title: "退勤時チェック",
    items: [
      { id: "close-1", label: "担当ベッド周りを片付けた" },
      { id: "close-2", label: "タオルを回収・補充した" },
      { id: "close-3", label: "退勤の打刻をした" },
      { id: "close-4", label: "戸締り・消灯を確認した（最終者）" },
    ],
  },
];
