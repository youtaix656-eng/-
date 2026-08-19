// 「回」表記のゆらぎを吸収するヘルパー。
// 過去問データの round フィールドは、科目データファイルによって
// round: 34（数値）／ round: '34'（数値文字列）／ round: '第34回'（フル文字列）が混在する。
// 比較・並び替え・表示のどこでも同じ回として扱えるよう、まず正規化してから使う。

// 表示・比較用の正規化キー（数字部分のみの文字列）を返す。例：34, '34', '第34回' → '34'
export function roundKey(round) {
  if (round == null) return null;
  const s = String(round);
  const m = s.match(/(\d+)/);
  return m ? m[1] : s;
}

// 表示用の文字列（例：'第34回'）を返す。
export function formatRound(round) {
  const key = roundKey(round);
  return key == null ? '' : `第${key}回`;
}

// 2つの round 値が同じ回を指すか判定する。
export function isSameRound(a, b) {
  return roundKey(a) === roundKey(b);
}
