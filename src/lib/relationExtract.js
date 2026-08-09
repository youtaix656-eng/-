// 関係抽出パイプライン（#5）— 解説文から概念間の型付き関係を推定する（ルール＋辞書）。
//   自作解説が自動でグラフの「意味のある辺」になる。控えめに（誤検出を避けて）抽出する。

// 手がかり語 → 関係タイプ（出現順で最初に一致したものを採用）
const CUES = [
  { re: /鑑別|区別|対比|まぎらわし|混同|⇔/, type: 'contrast' },
  { re: /原因|により|によって|きたす|生じ|引き起こ|続発/, type: 'causes' },
  { re: /分類|一種|一つ|に属|の型|に含ま/, type: 'partOf' },
  { re: /治療|適応|投与|奏効/, type: 'treats' },
  { re: /好発|にみられる|に多い|部位|に生じ/, type: 'locatedAt' },
];

// text 中に登場する概念ペアに、最初に一致した手がかりの関係タイプを与える。
//   concepts: この問題の概念ID配列。text: 解説など。
//   [{ from, to, type }]（登場順の早い方→遅い方）
export function extractRelations(text, concepts, { limit = 6 } = {}) {
  const s = String(text || '');
  if (!s || !Array.isArray(concepts) || concepts.length < 2) return [];
  // 手がかりタイプ（文章全体で判定：無ければ関係を作らない）
  let type = '';
  for (const c of CUES) if (c.re.test(s)) { type = c.type; break; }
  if (!type) return [];
  // text に実際に出現する概念だけを、出現位置順に並べる
  const present = concepts
    .map((id) => ({ id, at: s.indexOf(id) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at);
  const out = [];
  for (let i = 0; i < present.length && out.length < limit; i++)
    for (let j = i + 1; j < present.length && out.length < limit; j++)
      if (present[i].id !== present[j].id)
        out.push({ from: present[i].id, to: present[j].id, type });
  return out;
}
