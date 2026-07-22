import * as icons from "lucide-react";
import type { LucideProps } from "lucide-react";

// ============================================================
// アイコン名（文字列）から lucide-react のアイコンを描画する。
// データ側では文字列で指定できるので編集が楽になる。
// ============================================================
type Props = LucideProps & { name: string };

export function Icon({ name, ...props }: Props) {
  const map = icons as unknown as Record<string, React.ComponentType<LucideProps>>;
  const Cmp = map[name] ?? icons.Circle;
  return <Cmp {...props} />;
}
