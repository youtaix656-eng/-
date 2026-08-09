// 問題データの検証（スキーマ＋重複）— 純粋関数。
//   アプリ本体の動作には影響せず、CI（scripts/validate-content.mjs）と
//   アプリ内の誤りチェック（QuestionTools）から共通で使うための単一ソース。
//
// 問題の型: { id, subject, type:'choice'|'ox', question, choices[], answer(0始まり),
//            explanation, round?, tags?, deck?, genre? }

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

// 1問の妥当性を検証し、エラーメッセージ配列を返す（空＝問題なし）。
export function validateQuestion(q) {
  const errs = [];
  if (!q || typeof q !== 'object') return ['問題がオブジェクトでない'];
  if (!isStr(q.id)) errs.push('id が未設定');
  if (!isStr(q.subject)) errs.push('subject が未設定');
  if (q.type !== 'choice' && q.type !== 'ox') errs.push(`type が不正（${q.type}）`);
  if (!isStr(q.question)) errs.push('question が空');
  if (!Array.isArray(q.choices)) {
    errs.push('choices が配列でない');
  } else {
    const n = q.choices.length;
    if (q.type === 'choice' && n !== 4) errs.push(`四択の選択肢が ${n} 個（4個であるべき）`);
    if (q.type === 'ox' && n !== 2) errs.push(`○×の選択肢が ${n} 個（2個であるべき）`);
    if (q.choices.some((c) => !isStr(c))) errs.push('空の選択肢がある');
    if (new Set(q.choices).size !== n) errs.push('選択肢に重複がある');
    if (!Number.isInteger(q.answer)) errs.push(`answer が整数でない（${q.answer}）`);
    else if (q.answer < 0 || q.answer >= n) errs.push(`answer が範囲外（${q.answer} / 0〜${n - 1}）`);
  }
  if (!isStr(q.explanation)) errs.push('解説（explanation）が空');
  if (q.round != null && typeof q.round !== 'number' && !isStr(q.round)) errs.push('round が数値でも文字列でもない');
  if (q.tags != null && !Array.isArray(q.tags)) errs.push('tags が配列でない');
  return errs;
}

// 問題文（stem）が完全一致で重複しているものを返す。
//   取り込み時の重複判定は問題文で行うため、同一 stem は片方が消える。
//   同じ設問が複数回出た場合は末尾に（第XX回）等を付けて必ず一意にする必要がある。
export function findDuplicateStems(list) {
  const seen = new Map();
  for (const q of list) {
    const key = (q.question || '').trim();
    if (!key) continue;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  return [...seen.entries()].filter(([, n]) => n > 1).map(([stem, n]) => ({ stem, count: n }));
}

// 論点の被り（ヒューリスティック）：同一科目で「正解の選択肢テキスト＋主要タグ」が一致するもの。
//   完全な重複ではなく“見直し候補”として返す（誤検知はあり得る）。
export function findLogicalDuplicates(list) {
  const groups = new Map();
  for (const q of list) {
    if (!Array.isArray(q.choices) || !Number.isInteger(q.answer)) continue;
    const ans = q.choices[q.answer];
    if (!isStr(ans)) continue;
    const tagKey = Array.isArray(q.tags) ? [...q.tags].sort().slice(0, 2).join('|') : '';
    const key = `${q.subject}∥${ans.trim()}∥${tagKey}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(q.id);
  }
  return [...groups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ key, ids }));
}

// バンク全体を検証してレポートを返す。
export function validateBank(list) {
  const perQuestion = [];
  const idSeen = new Map();
  for (const q of list) {
    const errs = validateQuestion(q);
    if (errs.length) perQuestion.push({ id: q && q.id, errors: errs });
    const id = q && q.id;
    if (id != null) idSeen.set(id, (idSeen.get(id) || 0) + 1);
  }
  const dupIds = [...idSeen.entries()].filter(([, n]) => n > 1).map(([id, n]) => ({ id, count: n }));
  const dupStems = findDuplicateStems(list);
  const logicalDups = findLogicalDuplicates(list);
  const hardErrors = perQuestion.length + dupIds.length + dupStems.length;
  return {
    total: list.length,
    perQuestion,
    dupIds,
    dupStems,
    logicalDups, // 警告扱い（hardErrors には含めない）
    hardErrors,
    ok: hardErrors === 0,
  };
}
