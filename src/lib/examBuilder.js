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
function pickFromSlot(questions, slot, used) {
  if (slot.integrated) {
    const cases = shuffle(groupIntegratedCases(questions, slot.integratedSession));
    const picked = [];
    for (const group of cases) {
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
  const picked = pool.slice(0, slot.count);
  picked.forEach((q) => used.add(q.id));
  return { picked, requested: slot.count, got: picked.length, fromIntegrated: 0, fromFallback: 0 };
}

// ブループリント（午前 or 午後）から出題列を組み立てる。
// 通常科目のブロックはシャッフルして先頭に、総合問題（連問）は最後にケース単位でまとめて出す。
export function buildBlueprintExam(blueprint, questions) {
  const used = new Set();
  const regularBlocks = [];
  const integratedBlocks = [];
  const shortfalls = [];

  for (const slot of blueprint.slots) {
    const result = pickFromSlot(questions, slot, used);
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
    };
  });
}
