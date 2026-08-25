// AI社員の肖像（線画アバター）のパーツ定義。
//
// 外部の画像を持たず、SVGの線画をその場で描く。理由：
//   - 外部ランタイム依存を増やさない（リポジトリ全体の方針）
//   - オフラインで動く／読み込みが軽い
//   - 黒背景・白線というOuroの世界観にそのまま乗る
//
// **人種・民族を顔立ちで描き分けることはしない。** 数十本の線でそれをやると
// 必ず戯画になるため、見分けは髪型・装い・紋章でつける。
// キャラクターの出身は profile の文章として持たせ、絵には持ち込まない。

export const HAIR_STYLES = [
  'long', 'bob', 'short', 'buzz', 'bun', 'braid',
  'curls', 'wave', 'pony', 'locs', 'crop', 'topknot',
  'sidepart', 'layered', 'halfup',
];

export const GLASSES = [null, 'round', 'square'];
export const EXTRAS = [null, 'earring', 'headband', 'scarf', 'tie', 'stud'];
export const COLLARS = ['round', 'v', 'shirt', 'coat'];

/** 肖像のパラメータを整える（知らない値は既定へ倒す）。 */
export function normalizePortrait(p = {}) {
  return {
    hair: HAIR_STYLES.includes(p.hair) ? p.hair : 'short',
    glasses: GLASSES.includes(p.glasses) ? p.glasses : null,
    extra: EXTRAS.includes(p.extra) ? p.extra : null,
    collar: COLLARS.includes(p.collar) ? p.collar : 'round',
  };
}

// 文字列から安定した数値を作る（同じ社員なら毎回同じ絵になる）。
function hashOf(text = '') {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * 社員の肖像パラメータ。
 * 明示されていれば（キャラクター設定・雇用時の指定）それを使い、
 * 無ければ名前から決める（既に雇っている社員にも絵がつくように）。
 */
export function portraitFor(employee = {}) {
  if (employee.portrait) return normalizePortrait(employee.portrait);

  const seed = hashOf(`${employee.roleId || ''}:${employee.seat || 1}:${employee.name || ''}`);
  return {
    hair: HAIR_STYLES[seed % HAIR_STYLES.length],
    glasses: GLASSES[Math.floor(seed / 7) % GLASSES.length],
    extra: EXTRAS[Math.floor(seed / 13) % EXTRAS.length],
    collar: COLLARS[Math.floor(seed / 29) % COLLARS.length],
  };
}
