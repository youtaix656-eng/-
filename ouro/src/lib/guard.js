// 「確約」の見張り（新規）。
//
// 人間が最後に責任を持つ、という線引きの実務側。Ouro は外部へ送る道具を
// 持っていないので、権限をもう1つ足すより **成果物の中に約束が書かれていないか**
// を見て知らせる方が実際に効く。
//
// 止めはしない（誤検知で書けなくなる方が困る）。「ここは自分の言葉で
// 引き受けるところですよ」と見えるようにするだけ。

export const PROMISE_PATTERNS = [
  { re: /保証(?:いた)?し(?:ます|ました)|保証付き/g, label: '効果や結果の保証' },
  { re: /確約(?:いた)?します|お約束(?:いた)?します/g, label: '確約' },
  { re: /必ず[^。\n]{0,12}(?:します|いたします|できます|届けます)/g, label: '「必ず」の言い切り' },
  { re: /絶対に[^。\n]{0,12}(?:ます|ません)/g, label: '「絶対」の言い切り' },
  { re: /[0-9０-９]+\s*(?:日|週間|か月|ヶ月|営業日)(?:以内)?で(?:納品|完成|お届け|仕上げ)/g, label: '納期の確約' },
  { re: /返金(?:いた)?します|全額返金/g, label: '返金の約束' },
  { re: /100\s*[%％]|１００\s*[%％]/g, label: '100%という表現' },
  { re: /(?:必ず|確実に)(?:治|なお)(?:り|る)|完治(?:します|できます)/g, label: '医療的な断定' },
];

/**
 * 本文に含まれる「確約」を拾う。
 * @returns {{label:string, phrase:string}[]} 重複は畳む
 */
export function checkPromises(text) {
  const src = String(text || '');
  const out = [];
  const seen = new Set();
  for (const p of PROMISE_PATTERNS) {
    const re = new RegExp(p.re.source, 'g');
    let m = re.exec(src);
    while (m) {
      const phrase = m[0].trim();
      const key = `${p.label}:${phrase}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ label: p.label, phrase });
      }
      if (out.length >= 12) return out;
      m = re.exec(src);
    }
  }
  return out;
}
