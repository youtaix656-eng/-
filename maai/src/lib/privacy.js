// 貼った文面に混ざった個人情報を見つけて伏せる。
//
// 守ること:
//   1. **伏せ字で桁数を数えられるようにしない。** 「090-●●●●-●●●●」のように
//      文字数を残すと、別々の番号が形で見分けられてしまう。置き換えるのは
//      〔電話番号〕のような**中身の分かる短い札**にする。
//   2. **見つけた中身を返さない。** 何が見つかったかを画面に出すために本人の
//      電話番号をそのまま返したら、伏せる意味がない。返すのは種類と位置だけ。
//   3. **後読み（lookbehind）を使わない**（古い Safari で読み込みごと落ちる）。
//   4. **止めない。** 個人情報があっても入力は妨げず、保存するときに既定で伏せる。
//      誤検知で書けなくなるほうが害が大きい。

export const PERSONAL_KINDS = [
  {
    id: 'email',
    label: 'メールアドレス',
    token: '〔メール〕',
    // ローカル部＋@＋ドメイン。後読みなし。
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  },
  {
    id: 'url',
    label: 'リンク',
    token: '〔リンク〕',
    pattern: /https?:\/\/[^\s、。」』）)]+/g,
  },
  {
    id: 'phone',
    label: '電話番号',
    token: '〔電話番号〕',
    // 0から始まる9〜10桁（区切りは - ( ) と空白を許す）
    pattern: /0\d{1,4}[-(\s]?\d{1,4}[-)\s]?\d{3,4}/g,
  },
  {
    id: 'account',
    label: '長い数字の並び',
    token: '〔番号〕',
    // カード番号・口座番号のような 11 桁以上の並び（電話番号のあとに見る）
    pattern: /\d[\d\s-]{9,}\d/g,
  },
];

/**
 * 個人情報らしき箇所を探す。**中身は返さない**（種類と位置だけ）。
 * @returns {Array<{kind:string, label:string, start:number, end:number}>}
 */
export function findPersonal(text) {
  const raw = String(text == null ? '' : text);
  const found = [];
  for (const kind of PERSONAL_KINDS) {
    const re = new RegExp(kind.pattern.source, 'g');
    let m = re.exec(raw);
    while (m) {
      found.push({ kind: kind.id, label: kind.label, start: m.index, end: m.index + m[0].length });
      m = re.exec(raw);
    }
  }
  // 先に見つけた種類を優先し、重なった後ろの検出は落とす（電話番号が「長い数字」に二重に当たる）
  found.sort((a, b) => a.start - b.start || a.end - b.end);
  const out = [];
  for (const f of found) {
    const last = out[out.length - 1];
    if (last && f.start < last.end) continue;
    out.push(f);
  }
  return out;
}

/** 種類ごとの件数（画面に「電話番号が1つ」と出すため。中身は出さない） */
export function summarizePersonal(text) {
  const counts = new Map();
  for (const f of findPersonal(text)) counts.set(f.label, (counts.get(f.label) || 0) + 1);
  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

/**
 * 個人情報を札に置き換える。**桁数を残さない。**
 * @returns {string}
 */
export function mask(text) {
  const raw = String(text == null ? '' : text);
  const spots = findPersonal(raw);
  if (spots.length === 0) return raw;
  const tokenOf = Object.fromEntries(PERSONAL_KINDS.map((k) => [k.id, k.token]));
  let out = '';
  let at = 0;
  for (const s of spots) {
    out += raw.slice(at, s.start) + (tokenOf[s.kind] || '〔伏せました〕');
    at = s.end;
  }
  return out + raw.slice(at);
}

/** 伏せる必要があるか（保存前の確認に使う） */
export function hasPersonal(text) {
  return findPersonal(text).length > 0;
}
