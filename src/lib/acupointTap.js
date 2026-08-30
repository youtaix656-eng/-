// 経穴の体表イラスト学習（④）— タップで位置⇄名前。
// 座標は src/data/figures.jsx に埋め込まれた印（既存・レビュー済みの図問題で使われている
// 位置）と同じものを単一のソースとしてここに持つ。新しい経穴を追加する時は、まず
// figures.jsx に図（印つき・印なしの2版）を追加してから、ここに座標を登録すること
// （正確性優先。位置が確認できていない経穴を勝手に座標化しない）。

export const ACUPOINT_TAP_POINTS = [
  {
    id: 'goukoku',
    name: '合谷',
    yomi: 'ごうこく',
    figureKey: 'hand-goukoku',
    blankFigureKey: 'hand-goukoku-blank',
    viewBox: '0 0 240 200',
    cx: 98,
    cy: 92,
    hint: '手背、第1・第2中手骨間のくぼみ',
  },
  {
    id: 'sanri',
    name: '足三里',
    yomi: 'あしさんり',
    figureKey: 'leg-sanri',
    blankFigureKey: 'leg-sanri-blank',
    viewBox: '0 0 240 210',
    cx: 132,
    cy: 104,
    hint: '下腿前面、犢鼻の下・脛骨稜の外方',
  },
];

// タップ判定の許容半径（UI上の使いやすさのための目安。取穴の医学的な基準ではない）
export const HIT_TOLERANCE = 20;

export function isHit(tapX, tapY, point, tolerance = HIT_TOLERANCE) {
  const dx = tapX - point.cx;
  const dy = tapY - point.cy;
  return Math.sqrt(dx * dx + dy * dy) <= tolerance;
}

// クリック位置(px, コンテナ基準)をSVGのviewBox座標に変換する
// （コンテナのaspect-ratioをviewBoxに合わせて描画している前提。レターボックスは考慮しない）
export function toViewBoxCoords(clientX, clientY, rect, viewBox) {
  const [, , vbW, vbH] = viewBox.split(' ').map(Number);
  const scaleX = vbW / rect.width;
  const scaleY = vbH / rect.height;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

// 4択の選択肢（正解＋ダミー）を作る。ダミーは他の経穴名から無作為に選ぶ
export function buildChoices(correctName, allNames, count = 4, rng = Math.random) {
  const pool = allNames.filter((n) => n !== correctName);
  const shuffled = [...pool].sort(() => rng() - 0.5);
  const distractors = shuffled.slice(0, Math.max(0, count - 1));
  const choices = [correctName, ...distractors];
  return choices.sort(() => rng() - 0.5);
}
