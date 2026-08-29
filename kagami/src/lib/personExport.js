// 人間分析の見立てを、持ち出せる文章にする。
//
// **判定を書き足さない。** 出すのは、選んだふるまいと、近かった型と、取れる距離だけ。
// 「この人は◯◯です」という一行を作らない（画面と同じ線）。
// ここはネットワークにも保存にも触れない。文字列を組み立てるだけ。

function line(s) {
  return String(s || '').trim();
}

/**
 * @param {{label?:string, sceneLabel?:string, at?:number,
 *          behaviors?:string[], matches?:Array, note?:string}} input
 * @returns {string}
 */
export function caseToText(input = {}) {
  const at = new Date(Number(input.at) || Date.now());
  const p = (n) => String(n).padStart(2, '0');
  const when = `${at.getFullYear()}/${p(at.getMonth() + 1)}/${p(at.getDate())}`;

  const out = [];
  out.push(`【人間分析の見立て】${line(input.label) || '（呼び名なし）'}`);
  out.push(`日付：${when}${input.sceneLabel ? `／場面：${input.sceneLabel}` : ''}`);
  out.push('');

  const behaviors = input.behaviors || [];
  out.push(`■ 見たふるまい（${behaviors.length}件）`);
  if (behaviors.length === 0) out.push('（なし）');
  for (const b of behaviors) out.push(`・${b}`);
  out.push('');

  const matches = input.matches || [];
  out.push(`■ 近かった型（${matches.length}件）`);
  if (matches.length === 0) {
    out.push('（同じ型のふるまいが2つ以上そろっていません。問題がないという意味ではありません）');
  }
  for (const m of matches) {
    out.push(`○ ${m.type.name}`);
    for (const b of m.behaviors) out.push(`  ・${b}`);
    out.push(`  取れる距離：${line(m.type.distance)}`);
  }

  if (line(input.note)) {
    out.push('');
    out.push('■ メモ');
    out.push(line(input.note));
  }

  out.push('');
  out.push('※ 人を採点したものではありません。決めているのは距離であって、その人の人格ではありません。');
  return out.join('\n');
}

/** 端末のクリップボードへ。使えない環境では false を返す（落とさない） */
export async function copyText(text) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
