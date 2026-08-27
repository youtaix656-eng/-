// 軽い相談と、引き継ぎの確認（新規）。
//
// 会議は Ouro でいちばん高い（人数×2＋1回）。
// 「会議を開くほどではないが、1人の意見が欲しい」場面のために、
// **AI 1回だけ**の相談を用意する。答えは3行まで。
//
// 引き継ぎの確認も同じ仕組みで動かす。今の引き継ぎは一方向で、
// 受け取った側は「材料が足りない」と言えなかった。

export const MAX_ANSWER_LINES = 3;

/** 他の担当に短く聞く。 */
export function consultPrompt(question, brief = '') {
  return [
    'あなたの専門から見て、次の相談に答えてください。',
    '',
    `## 相談`,
    String(question || '').slice(0, 600),
    brief ? `\n## いまの社内の状況\n${brief}` : '',
    '',
    '## 答え方',
    `- **${MAX_ANSWER_LINES}行以内**。前置き・挨拶は書かない。`,
    '- 1行目に結論。2行目以降に理由か、確かめるべきこと。',
    '- 自分の担当外のことは「担当外です」と正直に書く。',
    '- 調べていない数字を書かない。',
  ]
    .filter((x) => x !== '')
    .join('\n');
}

/** 受け取った側が「足りない材料」を返す（引き継ぎ会・1回目）。 */
export function gapPrompt(instruction, handoff) {
  return [
    'これからあなたが担当する手順の前に、受け取った材料を確認します。**作業はまだしないでください。**',
    '',
    '## あなたがこれからやること',
    String(instruction || '').slice(0, 400),
    '',
    '## 前の担当から受け取ったもの',
    String(handoff || '（受け取っていません）').slice(0, 3000),
    '',
    '## 答え方',
    '- 足りない材料を**3つまで**、箇条書きで挙げる。',
    '- 足りているなら「なし」とだけ書く。',
    '- 「あると良い」ではなく、**無いと進められないもの**だけを挙げる。',
  ].join('\n');
}

/** 渡した側が足りない分を補う（引き継ぎ会・2回目）。 */
export function supplementPrompt(gap, myOutput) {
  return [
    '次の担当から「材料が足りない」と返ってきました。**あなたが出した内容の範囲で**補ってください。',
    '',
    '## 足りないと言われたもの',
    String(gap || '').slice(0, 800),
    '',
    '## あなたが出した内容',
    String(myOutput || '').slice(0, 3000),
    '',
    '## 答え方',
    '- 足りない分だけを書く。全体を書き直さない。',
    '- 手元に無いものは「これは調べていません」と正直に書く。**推測で埋めない。**',
  ].join('\n');
}

/** 答えを3行に切りそろえる（長く返ってきた時のため）。 */
export function trimAnswer(text, lines = MAX_ANSWER_LINES) {
  const kept = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, lines);
  return kept.join('\n');
}

/** 「なし」だけの答えか。 */
export function isNothing(text) {
  const t = String(text || '').trim().replace(/[。.\s]/g, '');
  return !t || ['なし', '特になし', '足りているものはありません', 'ありません'].includes(t);
}
