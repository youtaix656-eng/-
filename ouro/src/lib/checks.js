// 完成条件のセルフチェック（新規）。
//
// 「完成条件」は受付のときに書けるようになったが、**書いただけで誰も確かめていなかった**。
// 社員のプロンプトに入るだけなので、実際には「文章を出した＝完了」のまま。
//
// そこで、完成条件を1行ずつの YES/NO に割って、**最後に別の担当が答える手順**を足す。
// 「高品質であること」のような曖昧な条件ではなく、YES か NO で答えられる形に寄せる。
//
// 判定そのものはAIがするが、**結果の読み取りは機械でやる**（○×の並びを数えるだけ）。
// 読み取れなければ本文をそのまま出す（勝手に「合格」にしない）。

export const MAX_CHECKS = 8;

/** 完成条件の文を、1行ずつの確認項目に割る。 */
export function parseChecklist(doneWhen) {
  const src = String(doneWhen || '').trim();
  if (!src) return [];
  const parts = src
    .split(/[\n。、,，]|・|／|\//)
    .map((x) => x.replace(/^[\s>#*_・\-–—]*[①-⑳0-9０-９]*[.．)）]?\s*/, '').trim())
    .filter((x) => x.length >= 3);
  const out = [];
  for (const p of parts) {
    if (out.includes(p)) continue;
    out.push(p.slice(0, 100));
    if (out.length >= MAX_CHECKS) break;
  }
  return out;
}

/** チェック担当への指示文。 */
export function checkInstruction(items = []) {
  return [
    'オーナーが決めた「完成の条件」を1つずつ確かめてください。作り直しはしません。',
    '',
    '次の形で、条件の数だけ行を書いてください（この形以外は書かないこと）：',
    '- [YES] 条件の文',
    '- [NO] 条件の文 — 満たしていない理由と、どこを直せばよいか',
    '',
    '確かめる条件：',
    ...items.map((x) => `- ${x}`),
    '',
    '判断がつかないものは [NO] にして、その理由を書いてください。',
  ].join('\n');
}

/**
 * チェックの答えを読み取る。
 * @returns {{items:{ok:boolean, text:string, reason:string}[], parsed:boolean}}
 */
export function readCheckResult(text, expected = []) {
  const lines = String(text || '').split('\n');
  const items = [];
  for (const line of lines) {
    const m = /\[\s*(YES|NO|ＹＥＳ|ＮＯ)\s*\]\s*(.*)$/i.exec(line);
    if (!m) continue;
    const ok = /^y/i.test(m[1].replace(/[Ａ-Ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));
    const body = m[2].trim();
    const cut = body.split(/\s*[—―-]\s+/);
    items.push({ ok, text: (cut[0] || body).trim(), reason: (cut[1] || '').trim() });
    if (items.length >= MAX_CHECKS * 2) break;
  }
  // 期待した数の半分も読めていないなら、読み取り失敗として扱う（勝手に合格にしない）
  const parsed = items.length > 0 && (!expected.length || items.length >= Math.ceil(expected.length / 2));
  return { items, parsed };
}

/** 仕事の中の「完成の確認」手順。 */
export function checkStepOf(task) {
  return (task.steps || []).find((s) => s.kind === 'check') || null;
}

/**
 * 完成の確認の結果。
 *   'none'    条件を決めていない
 *   'pending' まだ確認していない
 *   'unread'  答えを読み取れなかった（本文を見せる）
 *   'passed'  全部 YES
 *   'failed'  NO がある
 */
export function checkSummary(task) {
  const step = checkStepOf(task);
  if (!step) return { state: 'none', items: [], step: null };
  if (step.status !== 'done' || !step.output) return { state: 'pending', items: [], step };
  const expected = parseChecklist(task.spec && task.spec.doneWhen);
  const { items, parsed } = readCheckResult(step.output, expected);
  if (!parsed) return { state: 'unread', items: [], step };
  return { state: items.every((x) => x.ok) ? 'passed' : 'failed', items, step };
}
