// 出す前チェック——外へ出す直前に、1枚で通す。
//
// 見張りは前からあった（確約・言い方・個人情報・完成条件・書き出しの重なり）が、
// **画面のあちこちにバラバラに出ていた**ので、出す直前にどれを見たのか
// 分からなかった。ここが1か所の正になる。
//
// 決まりごと：
//  ・**止めるのは個人情報だけ。** ほかは「ここは見直す所」と伝えるだけ
//    （誤検知で書けなくなる方が害が大きい、という既存の方針のまま）。
//  ・AIを呼ばない。
//  ・判定を足したい時は**このファイルだけ**を直す。

import { checkPromises, checkRespect } from './guard.js';
import { checkPersonal } from './privacy.js';
import { similarOpenings } from './opening.js';
import { checkSummary } from './checks.js';
import { hasSections } from './outline.js';
// 型パックを売り物として出すときの確認（`kit` が渡された時だけ効く）。
import { runsOf as kitRuns, MIN_RUNS } from './kit.js';

/** 重い順。画面の並びもこの順。 */
export const LEVELS = ['stop', 'warn', 'ok', 'skip'];

function worstOf(items) {
  if (items.some((i) => i.level === 'stop')) return 'stop';
  if (items.some((i) => i.level === 'warn')) return 'warn';
  return 'ok';
}

/**
 * @param {object} o
 * @param {string} o.text 出そうとしている本文
 * @param {object} o.task 仕事（完成条件の確認に使う。無くてよい）
 * @param {{id,title,text}[]} o.past 過去の成果物（書き出しの重なりに使う）
 * @param {object} o.kit 売り物として出す型（型パックを出すときだけ。無くてよい）
 * @param {object[]} o.kitTasks その型で回した仕事を数えるための一覧
 * @param {number} o.rivalCount 競合台帳の件数（0件を「空いている」と読ませないため）
 * @returns {{items, worst, blocked}}
 */
export function prepublishChecks({ text = '', task = null, past = [], kit = null, kitTasks = [], rivalCount = null } = {}) {
  const body = String(text || '');
  const items = [];

  // ① 個人情報（ここだけ止める）
  const personal = checkPersonal(body);
  items.push({
    id: 'personal',
    title: 'お客さんの氏名・連絡先',
    level: personal.length ? 'stop' : 'ok',
    hits: personal,
    ok: '個人を特定できるものは見つかりませんでした。',
    ng: '呼び名だけにしてください。ここは外へ出すと戻せません。',
  });

  // ② 完成条件
  const sum = task ? checkSummary(task) : { state: 'none', items: [] };
  items.push({
    id: 'checks',
    title: '完成条件',
    level:
      sum.state === 'failed' ? 'warn'
      : sum.state === 'passed' ? 'ok'
      : sum.state === 'none' ? 'skip'
      : 'warn',
    state: sum.state,
    hits: (sum.items || []).filter((x) => !x.ok).map((x) => ({ label: '未達', phrase: x.text })),
    ok: '決めた条件は満たしています。',
    ng: sum.state === 'none' ? '完成条件を決めていない仕事です。' : 'まだ満たしていない条件があります。',
  });

  // ③ 確約（価格・納期・効果）
  const promises = checkPromises(body);
  items.push({
    id: 'promise',
    title: '確約していないか',
    level: promises.length ? 'warn' : 'ok',
    hits: promises,
    ok: '言い切っている所はありませんでした。',
    ng: '価格・納期・効果の確約は、あなたが引き受ける所です。',
  });

  // ④ 言い方（人ではなく成果物を指しているか）
  const respect = checkRespect(body);
  items.push({
    id: 'respect',
    title: '人ではなく成果物を指しているか',
    level: respect.length ? 'warn' : 'ok',
    hits: respect,
    ok: '人に向いた言い方は見つかりませんでした。',
    ng: '直す箇所と直し方で書き直してください。',
  });

  // ⑤ 書き出しの重なり
  const same = similarOpenings(body, past);
  items.push({
    id: 'opening',
    title: '書き出しが前と同じでないか',
    level: same.length ? 'warn' : 'ok',
    hits: same.map((s) => ({ label: `${Math.round(s.score * 100)}%似ている`, phrase: s.title, id: s.id })),
    ok: '前に出したものと書き出しは違います。',
    ng: '同じ書き出しが続くと、読み飛ばされます。',
  });

  // ⑥ 回答の枠（最後の成果物だけ）
  items.push({
    id: 'outline',
    title: '結論から書けているか',
    level: hasSections(body) ? 'ok' : 'skip',
    hits: [],
    ok: '①結論から始まっています。',
    ng: '枠に沿っていない文章です（短いものはこれで構いません）。',
  });

  // ⑦〜⑨ 型パックを売り物として出すときだけ（`kit` が渡された時に限る）。
  // **止めない**——足りないものを並べるだけ（他の見張りと同じ線）。
  if (kit) {
    const runs = kitRuns(kit, kitTasks);
    items.push({
      id: 'kitRuns',
      title: `自分で ${MIN_RUNS} 回やったか`,
      level: runs >= MIN_RUNS ? 'ok' : 'warn',
      hits: [],
      ok: `${runs} 回まわしています。ただし**中身の違う ${MIN_RUNS} 回かは機械では見られません。**`,
      ng: `まだ ${runs} 回です。${MIN_RUNS} 回そろえてから出すと事故が減ります（出すこと自体は止めません）。`,
    });
    items.push({
      id: 'kitSamples',
      title: '結果の見本が付いているか',
      level: (kit.samples || []).length > 0 ? 'ok' : 'warn',
      hits: [],
      ok: '出てくる結果の見本が付いています。',
      ng: '見本がありません。**買う人が欲しいのは手順ではなく、そこから出てくる結果です。**',
    });
    if (rivalCount !== null) {
      items.push({
        id: 'kitMarket',
        title: '競合を見たか',
        level: rivalCount > 0 ? 'ok' : 'warn',
        hits: [],
        ok: `競合台帳に ${rivalCount} 件あります。`,
        ng: '競合台帳が0件です。**0件は「空いている」ではなく「まだ見ていない」**——'
          + '誰もやっていない理由が先にあることもあります。',
      });
    }
  }

  const shown = items.filter((i) => i.level !== 'skip');
  return {
    items,
    worst: worstOf(shown),
    // **止めるのは個人情報だけ。**
    blocked: items.some((i) => i.id === 'personal' && i.level === 'stop'),
  };
}

/** 1行のまとめ。 */
export function prepublishLine(result) {
  if (!result) return '';
  if (result.blocked) return '外へ出す前に直すところがあります（個人情報）。';
  if (result.worst === 'warn') {
    const n = result.items.filter((i) => i.level === 'warn').length;
    return `見直す所が${n}件あります。読んでから出してください。`;
  }
  return '出す前チェックは通りました。';
}
