// 既に配信済みの問題データの内容を訂正するための小さな上書き層。
//
// `dedupeAgainst`（src/lib/importer.js）は問題文（question）の一致で重複判定するため、
// 問題文を変えずに choices／explanation／tags／figure 等だけを直す訂正は、バッチ増分方式
// （<X>_VERSION）の「新規追加」ルートには乗らない——既にその問題を保存済みの端末には
// 届かない（増分方式は追加専用で、既存内容の上書き経路を持たないため）。
// この関数は起動のたびに該当idの問題へパッチを重ねることで、保存済みの端末にも
// 訂正を届ける。
//
// 使うのは「問題文はそのままで内容だけを直したい」訂正だけ。問題文そのものを直す場合は
// 通常の増分ルートで対応できる（文言が変われば新規として追加される）ため、ここには入れない。
export const QUESTION_PATCHES = {
  // 2026-09-03：選択肢②が別問題（頭竅陰・足竅陰）の正解をそのまま流用した無関係な
  // 誤答になっていた（手五里・足五里と胆経は無関係）。経脈を入れ替えた引っかけに直した。
  'kk-keiraku-a7c': {
    choices: [
      '手五里＝手の陽明大腸経／足五里＝足の厥陰肝経',
      '手五里＝足の厥陰肝経／足五里＝手の陽明大腸経',
      '手五里＝手の少陽三焦経／足五里＝足の陽明胃経',
      'ともに手の陽明大腸経',
    ],
    explanation:
      '手五里は手の陽明大腸経、足五里は足の厥陰肝経に所属し、表裏関係ではない。②は経脈を入れ替えた引っかけ、④は同名穴だからと同じ経脈に属すると誤認させる引っかけ。',
  },
  // 2026-09-03：投球動作4局面の模式図（figures.jsxのpitching-phases）を追加。
  'tk-toukyu-hiji-followthrough-1': {
    figure: 'pitching-phases',
  },
};

export function applyQuestionPatches(questions) {
  if (!Array.isArray(questions) || questions.length === 0) return questions;
  let changed = false;
  const patched = questions.map((q) => {
    const patch = q && QUESTION_PATCHES[q.id];
    if (!patch) return q;
    changed = true;
    return { ...q, ...patch };
  });
  return changed ? patched : questions;
}
