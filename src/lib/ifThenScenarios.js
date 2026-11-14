// 「もし〜なら」の逆シナリオ（正常の作用→障害されたときの所見）。
// 教科書的に確立している神経障害の代表的な所見のみを収録（手元に無い基準は作らない）。
// キーワード（タグ）に一致した時だけ読み上げに使う（AudioMode.jsxのifThenOn）。

export const IF_THEN_SCENARIOS = [
  { keyword: '橈骨神経', text: 'もし橈骨神経が障害されたら、下垂手（手関節・手指が伸展できない）が起こります。' },
  { keyword: '尺骨神経', text: 'もし尺骨神経が障害されたら、鷲手（第4・5指が伸びたまま曲がらない変形）が起こります。' },
  { keyword: '正中神経', text: 'もし正中神経が障害されたら、猿手（母指球が萎縮し母指対立ができなくなる）が起こります。' },
  { keyword: '腓骨神経', text: 'もし腓骨神経（総腓骨神経）が障害されたら、下垂足（足関節の背屈ができず足先が垂れる）が起こります。' },
  { keyword: '脛骨神経', text: 'もし脛骨神経が障害されたら、足関節の底屈ができなくなります。' },
  { keyword: '動眼神経', text: 'もし動眼神経が障害されたら、眼瞼下垂・外斜視・散瞳が起こります。' },
  { keyword: '顔面神経', text: 'もし顔面神経が障害されたら、同側の表情筋麻痺（額のしわが寄らない・閉眼不可）が起こります。' },
  { keyword: '反回神経', text: 'もし反回神経が障害されたら、嗄声（声がれ）が起こります。' },
  { keyword: '交感神経', text: '交感神経は、戦うときにたくさん光を入れて周りを見たいために瞳孔を開きます。' },
  { keyword: '副交感神経', text: '副交感神経は、休んでいるときに瞳孔を小さくし消化を進めます。' },
];

// 問題のタグ（effectiveTags）の中で最初にマッチしたシナリオを1つだけ返す。
export function findIfThenScenario(tags) {
  if (!Array.isArray(tags) || !tags.length) return null;
  for (const tag of tags) {
    const hit = IF_THEN_SCENARIOS.find((s) => tag.includes(s.keyword) || s.keyword.includes(tag));
    if (hit) return hit;
  }
  return null;
}
