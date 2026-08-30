// 手順から手順への引き継ぎ（新規）。
//
// これまでは前の手順の出力を **まるごと** 次へ渡していた（末尾を切るだけ）。
// 人間のチームで言えば「会話ログを全部転送する」やり方で、
// 長い仕事ほどトークンが増え、そのまま費用になる。
//
// 渡すのは、次の担当が続きをやるために要るものだけにする：
//   ・何が分かったか（結論）
//   ・出来上がっているもの（成果物）
//   ・残っていること（TODO）
//
// **枠に沿っていない出力は、そのまま全部渡す。** 拾えなかったからといって
// 削ると、次の担当に材料が届かず仕事そのものが劣化する。
// 削るのは「拾えた時に、確実に要らないと分かるもの」だけ。

import { parseSections } from './outline.js';

// 引き継ぎでは落とす節。
//   priority … 前の担当が自分で何から書くかの話
//   decision … 人間が決めること（次の担当が決めるものではない）
const DROP = ['priority', 'decision'];

// 「出典：」以降は次の担当には要らない（出典は step.citations に別で残る）。
const SOURCE_HEAD = /^[\s>#*_・\-–—]*(?:出典|参考|参照|references?|sources?)\s*[:：]?\s*$/i;

/** 出力1件ぶんを、引き継ぎ用に絞る。 */
export function compactOutput(text) {
  const src = String(text || '');
  const { sections, lead, found } = parseSections(src);
  if (found.length < 2) return stripSources(src);
  const keep = found.filter((k) => !DROP.includes(k));
  if (!keep.length) return stripSources(src);
  // **見出しより前の本文（lead）を落とさない。**
  // 「まとめ」「やること」のような言い方が2つあるだけで節ありと判定されるので、
  // lead を捨てると調査の本文がまるごと消えることがある。
  const parts = [stripSources(lead).trim(), ...keep.map((k) => stripSources(sections[k] || '').trim())].filter(
    Boolean
  );
  const out = parts.join('\n\n').trim();
  // 絞った結果ほとんど残らないなら、元のまま渡す（削りすぎない）
  return out.length >= Math.min(200, src.length * 0.2) ? out : stripSources(src);
}

function stripSources(text) {
  const lines = String(text || '').split('\n');
  const at = lines.findIndex((l) => SOURCE_HEAD.test(l));
  if (at < 0) return text;
  return lines.slice(0, at).join('\n').trimEnd();
}

/**
 * 同時に走った手順たちの結果を、次のかたまりへの引き継ぎにまとめる。
 * @param {object[]} steps 同じ group の完了した手順
 * @param {'compact'|'full'} mode
 */
export function buildHandoff(steps = [], mode = 'compact') {
  const done = steps.filter((s) => s && s.output);
  if (!done.length) return '';
  const many = done.length > 1;
  return done
    .map((s) => {
      const body = mode === 'full' ? s.output : compactOutput(s.output);
      return many ? `## ${s.employeeName || s.roleId}\n\n${body}` : body;
    })
    .join('\n\n---\n\n');
}
