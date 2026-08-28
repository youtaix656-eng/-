// 要件のたな卸し——**押す前に、足りていないものを見せる。**
//
// 作る側の値段はもう十分に下がった。詰まるのは上流で、
// **何を作るかが曖昧なままだと、どれだけ速く作っても作り直しになる。**
// AI社員は「足りない」と言わずに推測で埋めてしまうので、
// 実行してから薄い成果に気づく——その1回ぶんが丸ごと無駄になる。
//
// 決まりごと：
//  ・**AIを呼ばない。** 依頼文と受付の欄を、語の一致で見るだけ（費用ゼロ）。
//  ・**止めない。** 足りなくても実行はできる（通せない関門にしない）。
//    薄いまま進むかどうかは人が決めること。
//  ・**当てずっぽうを断定で書かない。** 当たった語がある時だけ「書けている」とし、
//    無ければ「見当たりませんでした」と正直に書く（項目87と同じ線）。
//  ・**後読み（lookbehind）を使わない**（古い Safari で構文エラーになる）。

/**
 * 要件の6項目。
 *  spec  … 受付の欄（`task.spec`）に対応するもの。書いてあれば埋まり。
 *  re    … 受付の欄が無いものは、依頼文の中の語で見る。
 */
export const REQ_FIELDS = [
  {
    id: 'who',
    label: '誰のためか',
    why: '読み手が決まっていないと、当たり障りのない文章になります。',
    hint: '例：病院で異常なしと言われた40〜60代／うちの新人スタッフ',
    re: /向け|のために|読み手|読者|お客さ|お客様|ユーザー|初心者|経験者|[0-9０-９]+\s*(?:代|歳)|さん向|患者|担当者|新人|自分用/,
  },
  {
    id: 'why',
    label: 'なぜ要るか',
    why: '目的が無いと、どちらの案が良いかを社員が選べません。',
    hint: '例：問い合わせを減らしたい／来月までに1本売りたい',
    re: /したい|できるように|ために|困って|悩んで|増やし|減らし|目的|解決|楽にな|短くし|防ぎ|防ぐ/,
  },
  { id: 'what', label: '何を作るか', spec: 'deliverable', why: '成果物の形が決まっていないと、長さも体裁もばらつきます。', hint: '例：2000字の記事1本／A4のチェックリスト' },
  { id: 'done', label: '何ができたら終わりか', spec: 'doneWhen', why: '完成条件があると、最後に1つずつ確かめる手順が自動で足されます。', hint: '例：出典が3つ以上ある／受診の目安が入っている' },
  { id: 'material', label: '使う材料', spec: 'materials', why: '手元の資料や数字を渡さないと、社員は一般論しか書けません。', hint: '例：先月の売上表／過去に書いたnote' },
  { id: 'avoid', label: 'やらないこと', spec: 'constraints', why: '触れてほしくないことは、先に言っておかないと必ず出てきます。', hint: '例：他社名を出さない／断定した効果を書かない' },
];

/** 薄いと見なす境目（埋まった数）。これ以下なら知らせる。 */
export const THIN_AT = 2;

/**
 * 依頼文と受付の欄から、埋まっているもの・足りないものを出す。
 * @returns {{filled:object[], missing:object[], count:number, total:number,
 *            level:'thin'|'ok'|'good', hits:object}}
 */
export function reqReview({ request = '', spec = {} } = {}) {
  const text = String(request || '');
  const filled = [];
  const missing = [];
  const hits = {};

  for (const f of REQ_FIELDS) {
    let ok = false;
    if (f.spec) {
      ok = Boolean(spec && String(spec[f.spec] || '').trim());
    } else if (f.re) {
      const m = f.re.exec(text);
      if (m) {
        ok = true;
        hits[f.id] = m[0];
      }
    }
    (ok ? filled : missing).push(f);
  }

  const count = filled.length;
  return {
    filled,
    missing,
    hits,
    count,
    total: REQ_FIELDS.length,
    level: count <= THIN_AT ? 'thin' : count >= REQ_FIELDS.length - 1 ? 'good' : 'ok',
  };
}

/** 画面に出す1行。**やめろとは言わない**（決めるのは人）。 */
export function reqLine(review) {
  if (!review) return '';
  if (review.level === 'good') return `要件は${review.count}／${review.total}まで埋まっています。このまま進めて大丈夫です。`;
  if (review.level === 'thin') {
    return `要件が${review.count}／${review.total}です。このまま進めても動きますが、当たり障りのない成果になりがちです（作り直すと、その1回ぶんの料金がまた掛かります）。`;
  }
  return `要件は${review.count}／${review.total}です。足りないものを埋めると、成果が具体的になります。`;
}

/** 「見当たりませんでした」の理由（当たった語がある時だけ、それを見せる）。 */
export function hitLabel(review, id) {
  const w = review && review.hits && review.hits[id];
  return w ? `「${w}」と書かれています` : '';
}
