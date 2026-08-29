// 出典 — 型カタログ（tactics.js）が sourceIds で参照する。
//
// 約束（このアプリでいちばん壊れやすいところ）:
//   1. **URL を持たない。** 検索できない状態でそれらしいURLを書くと、
//      「出典があるように見えて実は無い」という、いちばん質の悪い嘘になる。
//      書名・発表者・年で特定できる形にし、確かめたい人が自分で辿れるようにする。
//   2. 確かでないものは `check: true`（画面に「※要確認」と出る）。
//      隠すのではなく、確かめていないことを見えるようにする。
//   3. 「◯％の人が」のような**手元に無い数字を持たない**。
//      型の説明に効き目の大きさを書かない（それは実験の条件次第で変わる）。

export const SOURCES = [
  {
    id: 'cialdini_influence',
    tocTitle: '影響力の武器（Cialdini）',
    reading: 'えいきょうりょくのぶき',
    title: 'Influence: The Psychology of Persuasion（邦訳『影響力の武器』）',
    author: 'Robert B. Cialdini',
    year: 1984,
    kind: '書籍',
    note: '返報性・一貫性・社会的証明・権威・好意・希少性の6原理。この分野の古典で、多くの型の出どころ。',
  },
  {
    id: 'freedman_fraser_1966',
    tocTitle: 'フット・イン・ザ・ドアの実験',
    reading: 'ふっといんざどあのじっけん',
    title: 'Compliance without pressure: The foot-in-the-door technique',
    author: 'Freedman, J. L. & Fraser, S. C.',
    year: 1966,
    kind: '論文',
    note: '小さな頼みを引き受けた人は、あとの大きな頼みも引き受けやすくなる、を示した実験。',
  },
  {
    id: 'cialdini_1975_ditf',
    tocTitle: 'ドア・イン・ザ・フェイスの実験',
    reading: 'どあいんざふぇいすのじっけん',
    title: 'Reciprocal concessions procedure for inducing compliance',
    author: 'Cialdini, R. B. ほか',
    year: 1975,
    kind: '論文',
    note: '大きな要求を断らせてから小さな要求を出すと通りやすくなる、を示した実験。',
  },
  {
    id: 'cialdini_1978_lowball',
    tocTitle: 'ローボールの実験',
    reading: 'ろーぼーるのじっけん',
    title: 'Low-ball procedure for producing compliance',
    author: 'Cialdini, R. B. ほか',
    year: 1978,
    kind: '論文',
    note: 'いったん承諾させてから条件を悪くしても、承諾が維持されやすい、を示した実験。',
  },
  {
    id: 'asch_1951',
    tocTitle: 'アッシュの同調実験',
    reading: 'あっしゅのどうちょうじっけん',
    title: 'Effects of group pressure upon the modification and distortion of judgments',
    author: 'Asch, S. E.',
    year: 1951,
    kind: '論文',
    note: '明らかに違う答えでも、周りが揃っていると合わせてしまうことがある。',
  },
  {
    id: 'milgram_1963',
    tocTitle: 'ミルグラムの服従実験',
    reading: 'みるぐらむのふくじゅうじっけん',
    title: 'Behavioral study of obedience',
    author: 'Milgram, S.',
    year: 1963,
    kind: '論文',
    note: '権威のある人の指示だと、自分の判断より指示を優先してしまうことがある。',
  },
  {
    id: 'kahneman_tversky_1979',
    tocTitle: 'プロスペクト理論',
    reading: 'ぷろすぺくとりろん',
    title: 'Prospect theory: An analysis of decision under risk',
    author: 'Kahneman, D. & Tversky, A.',
    year: 1979,
    kind: '論文',
    note: '同じ大きさなら、得より損のほうが強く感じられる。「損しますよ」が効く理由。',
  },
  {
    id: 'arkes_blumer_1985',
    tocTitle: 'サンクコスト効果',
    reading: 'さんくこすとこうか',
    title: 'The psychology of sunk cost',
    author: 'Arkes, H. R. & Blumer, C.',
    year: 1985,
    kind: '論文',
    note: 'すでに払った分が惜しくて、割に合わない選択を続けてしまう。',
  },
  {
    id: 'loftus_palmer_1974',
    tocTitle: '誘導質問と記憶の実験',
    reading: 'ゆうどうしつもんときおくのじっけん',
    title: 'Reconstruction of automobile destruction',
    author: 'Loftus, E. F. & Palmer, J. C.',
    year: 1974,
    kind: '論文',
    note: '質問の言い回しだけで、思い出す内容そのものが変わることがある。',
  },
  {
    id: 'forer_1949',
    tocTitle: 'バーナム効果',
    reading: 'ばーなむこうか',
    title: 'The fallacy of personal validation',
    author: 'Forer, B. R.',
    year: 1949,
    kind: '論文',
    note: '誰にでも当てはまる言葉を「自分のことだ」と感じてしまう。',
  },
  {
    id: 'ferster_skinner_1957',
    tocTitle: '断続的な強化',
    reading: 'だんぞくてきなきょうか',
    title: 'Schedules of Reinforcement',
    author: 'Ferster, C. B. & Skinner, B. F.',
    year: 1957,
    kind: '書籍',
    note: 'たまにしか報われない方が、かえって行動が続いてしまう。',
  },
  {
    id: 'tokushoho',
    tocTitle: '特定商取引法（クーリング・オフ）',
    reading: 'とくていしょうとりひきほう',
    title: '特定商取引に関する法律（訪問販売・電話勧誘販売などのクーリング・オフ制度）',
    author: '消費者庁',
    year: null,
    kind: '法令・公的制度',
    note: '訪問販売・電話勧誘販売などは、契約後でも一定期間内なら書面で無条件に解約できる制度がある。対象の取引・期間は制度によって違うので、必ず公式の案内で確認する。',
    check: true,
  },
  {
    id: 'shohisha_hotline',
    tocTitle: '消費者ホットライン188',
    reading: 'しょうひしゃほっとらいんいちはちはち',
    title: '消費者ホットライン「188（いやや）」',
    author: '国民生活センター・消費者庁',
    year: null,
    kind: '相談窓口',
    note: '契約や勧誘のもめごとを、最寄りの消費生活センターにつないでくれる番号。',
    check: true,
  },
  {
    id: 'keisatsu_9110',
    tocTitle: '警察相談専用電話#9110',
    reading: 'けいさつそうだんせんようでんわしゃーぷきゅういちいちまる',
    title: '警察相談専用電話「#9110」',
    author: '警察庁',
    year: null,
    kind: '相談窓口',
    note: '事件・事故の急を要しない相談の窓口。緊急のときは110番。',
    check: true,
  },
  {
    id: 'dv_soudan_plus',
    tocTitle: 'DV相談＋（プラス）',
    reading: 'でぃーぶいそうだんぷらす',
    title: 'DV相談＋（プラス）',
    author: '内閣府',
    year: null,
    kind: '相談窓口',
    note: '家庭内での暴力・支配についての相談窓口。電話のほかメール・チャットもある。',
    check: true,
  },
];

export const SOURCE_MAP = Object.fromEntries(SOURCES.map((s) => [s.id, s]));

/** 出典 id の配列 → 出典オブジェクトの配列（未定義の id は落とさず null で返さない＝テストで検出する） */
export function sourcesOf(ids = []) {
  return ids.map((id) => SOURCE_MAP[id]).filter(Boolean);
}
