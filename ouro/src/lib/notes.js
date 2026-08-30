// 社員の記憶（改善ログ）——**この社員にだけ効かせたいこと**。
//
// ここは長いあいだ「読むだけ」だった。会社全体の決まりは `lib/rules.js`
// （company.rules）、こちらは社員1人ぶん、と分けている。
//
// **`memory.js` から切り出してあるのは起動を軽くするため。** 起動時に要るのは
// この読み書きだけで、材料を組み立てる `buildContext`（＋囲いの仕組み）は
// 実行のときにしか要らない。`memory.js` からも再輸出しているので、
// これまでの読み込み方は変わらない。

export const MAX_NOTES = 20;
export const MAX_NOTE_LEN = 120;

export function makeNote(text, taskId = null) {
  return {
    id: `note_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    text: String(text || '').trim().slice(0, MAX_NOTE_LEN),
    at: Date.now(),
    taskId,
  };
}

/** 社員の記憶に1行足した結果を返す（社員そのものは変えない）。 */
export function addNote(employee, text, taskId = null) {
  const note = makeNote(text, taskId);
  if (!note.text) return notesOf(employee);
  const cur = notesOf(employee).filter((n) => (n.text || n) !== note.text);
  // 古いものから落とす。プロンプトに入るのは末尾5件（buildContext）。
  return [...cur, note].slice(-MAX_NOTES);
}

export function removeNote(employee, noteId) {
  return notesOf(employee).filter((n) => n.id !== noteId);
}

export function notesOf(employee) {
  const notes = (employee && employee.memory && employee.memory.notes) || [];
  // 古い形（ただの文字列）にも id を付けて返すが、**呼ぶたびに変えてはいけない**。
  // 変わると「忘れさせる」が一致せず何も起きないし、画面も毎回描き直しになる。
  // 位置と中身から決まる id にする。
  return notes.filter(Boolean).map((n, i) => (typeof n === 'string' ? { id: `legacy_${i}`, text: n, at: 0, taskId: null } : n));
}
