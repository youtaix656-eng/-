// 問題の誤りチェック（問題ドクター）
//
// 4種類のチェックを行う:
//  1. 形式チェック  … 正解の範囲・選択肢の重複や欠落・空欄など（確実に自動判定できる）
//  2. 重複チェック  … ほぼ同一の設問が複数ある
//  3. 矛盾チェック  … 同じ設問なのに正解が食い違う
//  4. 内容チェック  … ナレッジベースと照合（経穴↔経絡の対応など）※あくまで補助
//
// 各指摘は { questionId, severity, category, message } を返す。
// severity: 'error'（要修正）/ 'warn'（要確認）/ 'info'（参考）

import { buildPointIndex, meridianById } from '../data/knowledgeBase.js';

// 設問文を正規化（空白・記号を除去）して比較キーにする
function normalize(text) {
  return String(text || '')
    .replace(/\s+/g, '')
    .replace(/[。、，．,.\-—・「」『』（）()\[\]]/g, '')
    .toLowerCase();
}

// ---- 1. 形式チェック ----
export function checkFormat(q) {
  const findings = [];
  const push = (severity, category, message) =>
    findings.push({ questionId: q.id, severity, category, message });

  if ((!q.question || !q.question.trim()) && !q.image) {
    push('error', 'format', '問題文が空です。');
  }
  if (!Array.isArray(q.choices) || q.choices.length < 2) {
    push('error', 'format', '選択肢が2つ未満です。');
  } else {
    // 空の選択肢
    if (q.choices.some((c) => !String(c).trim())) {
      push('error', 'format', '空の選択肢があります。');
    }
    // 重複した選択肢
    const norm = q.choices.map((c) => normalize(c));
    const dup = norm.filter((c, i) => norm.indexOf(c) !== i);
    if (dup.length > 0) {
      push('warn', 'format', '選択肢に重複があります。');
    }
    // 正解インデックスの範囲
    if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.choices.length) {
      push('error', 'format', `正解の指定（${q.answer}）が選択肢の範囲外です。`);
    }
    if (q.type === 'choice' && q.choices.length > 4) {
      push('info', 'format', `選択肢が${q.choices.length}個あります（通常は4択）。`);
    }
  }
  if (!q.explanation || !q.explanation.trim()) {
    push('info', 'format', '解説が空です。');
  }
  return findings;
}

// ---- 2. 重複チェック ----
export function checkDuplicates(questions) {
  const groups = {};
  questions.forEach((q) => {
    const key = normalize(q.question);
    if (!key) return;
    (groups[key] = groups[key] || []).push(q);
  });
  const findings = [];
  Object.values(groups).forEach((grp) => {
    if (grp.length > 1) {
      grp.forEach((q) =>
        findings.push({
          questionId: q.id,
          severity: 'warn',
          category: 'duplicate',
          message: `同じ設問が ${grp.length} 件あります（重複の可能性）。`,
        })
      );
    }
  });
  return findings;
}

// ---- 3. 矛盾チェック ----
// 同じ設問文なのに「正解の文字列」が異なるものを検出
export function checkContradictions(questions) {
  const groups = {};
  questions.forEach((q) => {
    const key = normalize(q.question);
    if (!key || !Array.isArray(q.choices)) return;
    const ans = q.choices[q.answer];
    (groups[key] = groups[key] || []).push({ q, ans: normalize(ans) });
  });
  const findings = [];
  Object.values(groups).forEach((grp) => {
    const answers = new Set(grp.map((g) => g.ans));
    if (grp.length > 1 && answers.size > 1) {
      grp.forEach(({ q }) =>
        findings.push({
          questionId: q.id,
          severity: 'error',
          category: 'contradiction',
          message: '同じ設問なのに正解が食い違っています。',
        })
      );
    }
  });
  return findings;
}

// ---- 4. 内容チェック（KB照合） ----
// 「〜が属する経絡はどれか」型で、設問文に含まれる経穴が KB にあり、
// 選択肢が経絡名のとき、正解が KB の対応と一致するか照合する。
export function checkAgainstKB(questions) {
  const pointIndex = buildPointIndex();
  const points = Object.keys(pointIndex);
  const findings = [];

  questions.forEach((q) => {
    if (q.type !== 'choice' || !Array.isArray(q.choices)) return;
    const text = String(q.question || '');
    const correctChoice = q.choices[q.answer];
    // 正解が経絡のフルネームのときだけ照合する
    const correctMeridianId = meridianNameToId()[String(correctChoice || '').trim()];
    if (!correctMeridianId) return;

    // 設問文に含まれる KB 既知の経穴を探す（1つに定まる場合のみ）
    const found = points.filter((p) => text.includes(p));
    if (found.length !== 1) return; // 曖昧な場合はスキップ（誤検出を避ける）
    const point = found[0];
    const expectedMeridians = pointIndex[point].map((e) => e.meridian);

    if (!expectedMeridians.includes(correctMeridianId)) {
      const expNames = expectedMeridians
        .map((id) => meridianById(id)?.name)
        .filter(Boolean)
        .join('・');
      findings.push({
        questionId: q.id,
        severity: 'warn',
        category: 'kb',
        message: `「${point}」は${expNames}の経穴です。正解「${correctChoice}」と一致しない可能性があります（要確認）。`,
      });
    }
  });
  return findings;
}

// 経絡フルネーム → id のマップ（初回のみ構築）
let _nameMap = null;
function meridianNameToId() {
  if (_nameMap) return _nameMap;
  _nameMap = {};
  ['LU', 'LI', 'ST', 'SP', 'HT', 'SI', 'BL', 'KI', 'PC', 'TE', 'GB', 'LR'].forEach((id) => {
    const m = meridianById(id);
    if (m) _nameMap[m.name] = id;
  });
  return _nameMap;
}

// ---- すべてのチェックを集約 ----
export function runAllChecks(questions) {
  const findings = [];
  questions.forEach((q) => findings.push(...checkFormat(q)));
  findings.push(...checkDuplicates(questions));
  findings.push(...checkContradictions(questions));
  findings.push(...checkAgainstKB(questions));

  const order = { error: 0, warn: 1, info: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  const summary = {
    error: findings.filter((f) => f.severity === 'error').length,
    warn: findings.filter((f) => f.severity === 'warn').length,
    info: findings.filter((f) => f.severity === 'info').length,
    total: findings.length,
  };
  return { findings, summary };
}
