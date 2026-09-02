// 模擬試験「午前」「午後」の科目別配分（examBlueprint.js）から、
// 実際に出題する問題列を組み立てる純粋関数群。

import { subjectMatches } from '../data/examScope.js';

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// #17：得意/苦手/選択式モードでも、直近の模試で使った問題（avoidIds）を後回しにする。
// 足りなければ使用済みも混ぜて埋める（安定ソート相当。呼び出し前にshuffleしておくこと）。
export function preferUnused(pool, avoidIds = new Set()) {
  const fresh = pool.filter((q) => !avoidIds.has(q.id));
  const usedRecently = pool.filter((q) => avoidIds.has(q.id));
  return [...fresh, ...usedRecently];
}

export function poolForSubject(questions, subjectName, excludeTags) {
  const pool = questions.filter((q) => subjectMatches(q.subject, { name: subjectName }));
  if (!excludeTags || !excludeTags.length) return pool;
  return pool.filter((q) => !(q.tags || []).some((t) => excludeTags.includes(t)));
}

// 総合問題（連問）を caseId ごとにまとめる
export function groupIntegratedCases(questions, examSession) {
  const list = questions.filter((q) => q.subject === '総合問題' && (q.examSession || '') === examSession);
  const byCase = new Map();
  for (const q of list) {
    const key = q.caseId || q.id;
    if (!byCase.has(key)) byCase.set(key, []);
    byCase.get(key).push(q);
  }
  for (const arr of byCase.values()) {
    arr.sort((a, b) => (a.caseOrder || 0) - (b.caseOrder || 0));
  }
  return [...byCase.values()];
}

// 1つのスロット（科目）から count 問を選ぶ。used に選んだ id を積む。
//   avoidIds：直近の模試で使った問題（#11・#16。あれば後回しにして使い回しを減らす）。
//   srs：あれば「通常学習で解いたことがある問題」を未出題の中でも優先する（#19。
//   まったくの初見をいきなり模試で出すより、定着確認に使う方が測定として意味がある）。
function pickFromSlot(questions, slot, used, avoidIds = new Set(), srs = null) {
  if (slot.integrated) {
    const cases = shuffle(groupIntegratedCases(questions, slot.integratedSession));
    // 未出題のケースを優先し、足りなければ直近で使ったケースも混ぜる（#16）。
    const freshCases = cases.filter((g) => !g.some((q) => avoidIds.has(q.id)));
    const usedCases = cases.filter((g) => g.some((q) => avoidIds.has(q.id)));
    const orderedCases = [...freshCases, ...usedCases];
    const picked = [];
    for (const group of orderedCases) {
      if (picked.length >= slot.count) break;
      if (group.some((q) => used.has(q.id))) continue;
      picked.push(...group);
    }
    const truncated = picked.slice(0, slot.count);
    truncated.forEach((q) => used.add(q.id));
    let shortfall = slot.count - truncated.length;
    const fallbackPicked = [];
    if (shortfall > 0 && slot.fallbackSubjects && slot.fallbackSubjects.length) {
      const fallbackPool = shuffle(
        slot.fallbackSubjects.flatMap((s) => poolForSubject(questions, s, null))
      ).filter((q) => !used.has(q.id));
      for (const q of fallbackPool) {
        if (fallbackPicked.length >= shortfall) break;
        fallbackPicked.push(q);
        used.add(q.id);
      }
    }
    return {
      picked: [...truncated, ...fallbackPicked],
      requested: slot.count,
      got: truncated.length + fallbackPicked.length,
      fromIntegrated: truncated.length,
      fromFallback: fallbackPicked.length,
    };
  }
  const pool = shuffle(poolForSubject(questions, slot.subject, slot.excludeTags)).filter(
    (q) => !used.has(q.id)
  );
  const fresh = pool.filter((q) => !avoidIds.has(q.id));
  const usedRecently = pool.filter((q) => avoidIds.has(q.id));
  // #19：未出題（fresh）の中でも、通常学習（srs）で既に解いたことがある問題を先に出す
  // （sortは安定ソートなので、シャッフルによるランダム性はグループ内で保たれる）。
  if (srs) fresh.sort((a, b) => (srs[b.id] ? 1 : 0) - (srs[a.id] ? 1 : 0));
  const ordered = [...fresh, ...usedRecently];
  const picked = ordered.slice(0, slot.count);
  picked.forEach((q) => used.add(q.id));
  return { picked, requested: slot.count, got: picked.length, fromIntegrated: 0, fromFallback: 0 };
}

// ブループリント（午前 or 午後）から出題列を組み立てる。
// 通常科目のブロックはシャッフルして先頭に、総合問題（連問）は最後にケース単位でまとめて出す。
//   opts.avoidIds：直近の模試で使った問題id（Set）。opts.srs：通常学習のSRS状態（#19用、任意）。
export function buildBlueprintExam(blueprint, questions, opts = {}) {
  const { avoidIds = new Set(), srs = null } = opts;
  const used = new Set();
  const regularBlocks = [];
  const integratedBlocks = [];
  const shortfalls = [];

  for (const slot of blueprint.slots) {
    const result = pickFromSlot(questions, slot, used, avoidIds, srs);
    if (result.got < result.requested) {
      shortfalls.push({
        subject: slot.subject,
        note: slot.note || slot.subject,
        requested: result.requested,
        got: result.got,
      });
    }
    if (slot.integrated) integratedBlocks.push(...result.picked);
    else regularBlocks.push(...shuffle(result.picked));
  }

  const order = [...shuffle(regularBlocks), ...integratedBlocks];
  return { order, shortfalls };
}

// セットアップ画面用：実際に抽選せず、各スロットの必要数に対する収録数を確認する。
//   roundsPossible（#12）：この収録数だと理論上何回ぶんユニークな模試が組めるか（floor(available/requested)）。
export function blueprintAvailability(blueprint, questions) {
  return blueprint.slots.map((slot) => {
    if (slot.integrated) {
      const cases = groupIntegratedCases(questions, slot.integratedSession);
      const available = cases.reduce((sum, g) => sum + g.length, 0);
      const fallbackAvailable = (slot.fallbackSubjects || []).reduce(
        (sum, s) => sum + poolForSubject(questions, s, null).length,
        0
      );
      return {
        subject: slot.subject,
        note: slot.note || slot.subject,
        requested: slot.count,
        available,
        fallbackAvailable,
        sufficient: available >= slot.count,
        roundsPossible: slot.count > 0 ? Math.floor((available + fallbackAvailable) / slot.count) : 0,
      };
    }
    const available = poolForSubject(questions, slot.subject, slot.excludeTags).length;
    return {
      subject: slot.subject,
      note: slot.note || slot.subject,
      requested: slot.count,
      available,
      fallbackAvailable: 0,
      sufficient: available >= slot.count,
      roundsPossible: slot.count > 0 ? Math.floor(available / slot.count) : 0,
    };
  });
}
