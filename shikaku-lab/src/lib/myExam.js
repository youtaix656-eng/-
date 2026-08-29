// 自分の試験を足す・編集する。
//
// カタログ（data/exams.js）に無い試験でも、ここで足せば
// 計画書・勉強法の提案・変換プロンプト・目次がすべて同じように動く。
// **同梱の試験と自作の試験を、後ろの仕組みから見て区別しない**のがこのファイルの役目
// （区別すると、画面ごとに「自作なら〜」の if が増えて必ず食い違う）。

import { EXAMS, examById, TRAIT_IDS, FORMAT_IDS } from '../data/exams.js';

let seq = 0;

/** 自作の試験を作る。読みは必須（目次の共通ルール。空なら「その他」に落として入れ忘れを見せる） */
export function makeExam(input = {}) {
  seq += 1;
  const name = String(input.name || '').trim();
  return {
    id: input.id || `my_${Date.now().toString(36)}_${seq.toString(36)}`,
    name,
    reading: String(input.reading || '').trim(),
    category: input.category || 'business',
    body: String(input.body || '').trim(),
    formats: (input.formats || ['choice']).filter((f) => FORMAT_IDS.includes(f)),
    traits: (input.traits || []).filter((t) => TRAIT_IDS.includes(t)),
    core: String(input.core || '').trim(),
    pitfall: String(input.pitfall || '').trim(),
    subjects: (input.subjects || [])
      .map((s) => (typeof s === 'string' ? { name: s.trim(), reading: '' } : { name: String(s.name || '').trim(), reading: String(s.reading || '').trim() }))
      .filter((s) => s.name),
    checkPoints: (input.checkPoints || []).map((c) => String(c).trim()).filter(Boolean),
    custom: true,
    updatedAt: Date.now(),
  };
}

/** 保存の前に見る。**空のまま作らせない**が、読みが無くても止めはしない（その他に出る） */
export function validateExam(exam) {
  const errors = [];
  if (!String(exam?.name || '').trim()) errors.push('試験名を入れてください');
  if (!(exam?.subjects || []).length) errors.push('科目を1つ以上入れてください');
  if (!(exam?.formats || []).length) errors.push('出題形式を1つ以上選んでください');
  return errors;
}

/** 読みが無い＝目次の「その他」に落ちる項目。入れ忘れを画面で見せるために使う */
export function missingReadings(exam) {
  const out = [];
  if (exam && !exam.reading) out.push(exam.name);
  for (const s of exam?.subjects || []) if (!s.reading) out.push(s.name);
  return out;
}

export function upsertExam(list = [], exam) {
  const rest = list.filter((e) => e.id !== exam.id);
  return [{ ...exam, updatedAt: Date.now() }, ...rest];
}

export function removeExam(list = [], id) {
  return (list || []).filter((e) => e.id !== id);
}

/** 同梱＋自作をまとめた一覧（自作を先に。自分のものが探しやすい） */
export function allExams(myExams = []) {
  return [...(myExams || []), ...EXAMS];
}

/** id から引く。同梱・自作のどちらでも同じ形で返る */
export function resolveExam(id, myExams = []) {
  return (myExams || []).find((e) => e.id === id) || examById(id);
}
