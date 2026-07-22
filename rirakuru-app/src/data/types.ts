// ============================================================
// データ型定義
// ここで定義した型に沿って /src/data 配下のファイルを埋めていきます。
// ============================================================

/** カテゴリ（トップに並ぶ大分類） */
export type Category = {
  /** URL に使う識別子（英数字・ハイフン）。例: "attendance" */
  slug: string;
  /** 画面に表示するカテゴリ名。例: "出勤・退勤の流れ" */
  title: string;
  /** カード下に出る一言説明 */
  description: string;
  /** lucide-react のアイコン名（例: "Clock", "HeartHandshake"） */
  icon: string;
};

/** 手順ステップ */
export type Step = {
  /** ステップの本文 */
  text: string;
  /** 補足メモ（任意） */
  note?: string;
};

/** 注意・警告の1件 */
export type Warning = {
  /** warning=アンバー（注意） / danger=レッド（禁忌・厳守） */
  level: "warning" | "danger";
  /** 表示するテキスト */
  text: string;
};

/** 詳細ページ1件分のデータ */
export type Item = {
  /** 一意な ID（英数字・ハイフン）。例: "attendance-clock-in" */
  id: string;
  /** どのカテゴリに属するか（Category.slug） */
  categorySlug: string;
  /** 見出し */
  title: string;
  /** 一覧・検索用の短い要約（任意） */
  summary?: string;
  /** 本文（任意・改行で段落分け） */
  body?: string;
  /** 手順ステップ（任意） */
  steps?: Step[];
  /** 注意点（任意） */
  warnings?: Warning[];
  /** 関連する項目の id（任意） */
  related?: string[];
  /** 検索用キーワード（任意） */
  tags?: string[];
};

/** チェックリスト内の1項目 */
export type ChecklistItemDef = {
  /** 一意な ID */
  id: string;
  /** 表示ラベル */
  label: string;
};

/** チェックリスト1本分 */
export type Checklist = {
  /** 一意な ID */
  id: string;
  /** タイトル。例: "出勤時チェック" */
  title: string;
  /** チェック項目の並び */
  items: ChecklistItemDef[];
};

/** 用語集の1語 */
export type GlossaryTerm = {
  /** 一意な ID */
  id: string;
  /** 用語（表示名）。例: "もみほぐし" */
  term: string;
  /** よみがな（五十音の並び替え・頭出しに使う。ひらがな） */
  reading: string;
  /** 意味・説明 */
  definition: string;
};
