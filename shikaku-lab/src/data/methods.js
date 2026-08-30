// 勉強法カタログ — 「対策法・勉強法」の単一の正。
//
// ■ 決めていること ────────────────────────────────
// 1. **効果の目安には必ず出典を付ける。** 付けられないものは「※要確認」と書く。
//    「◯◯法は効果的です」と書くだけの教材が多いので、ここでは何を根拠にしているかを必ず出す。
// 2. **手元に無い基準を書かない。**「合格者の◯割がやっている」のような数字は持たない。
// 3. **効果が低いとされる方法も消さない。** みんなやっているし、やってしまう理由もある。
//    「なぜ効いた気がするのか」まで書いて、置き換え先を示すほうが役に立つ。
// 4. 相性（試験の性格 × 認知特性）は **提案であって決定ではない**。最後に選ぶのは人。
//
// 主な出典（効果の高い・中・低の区分）:
//   Dunlosky, Rawson, Marsh, Nathan, & Willingham (2013)
//   "Improving Students' Learning With Effective Learning Techniques:
//    Promising Directions From Cognitive and Educational Psychology"
//   Psychological Science in the Public Interest, 14(1), 4-58.
//   ※ この論文は学校教育の場面を中心に10の学習法を比較したもの。
//      資格試験そのものを対象にした比較ではないので、当てはめる時は自分で確かめること。

export const EFFECT_LEVELS = {
  high: { label: '効果が高いとされる', order: 0, icon: '◎' },
  mid: { label: '条件つきで効果がある', order: 1, icon: '○' },
  low: { label: '効果は低いとされる', order: 2, icon: '△' },
  unrated: { label: '比較の対象になっていない（※要確認）', order: 3, icon: '?' },
};

export const DUNLOSKY = 'Dunlosky ほか (2013) Psychological Science in the Public Interest 14(1)';

/**
 * forTraits … 試験の性格（exams.js の TRAIT_VOCABULARY のキー）との相性
 * forChannels … 認知特性の入り口（visual / verbal / auditory）との相性
 * forOrder … 進め方の好み（step=順番に一つずつ / whole=全体像から）との相性
 * 空配列＝「どの試験・どの人にも共通して勧められる」の意味。
 */
export const METHODS = [
  {
    id: 'retrieval',
    title: '思い出す練習（テスト形式で解く）',
    reading: 'おもいだすれんしゅう',
    effect: 'high',
    summary: '読み返すのではなく、閉じた状態で思い出す。思い出せたかどうかより「思い出そうとした」こと自体が記憶を強くする。',
    how: [
      '教材を閉じて、今の単元で言えることを白紙に書き出す',
      '答えを見る前に必ず一度は自分の答えを出す（当てずっぽうでもよい）',
      '間違えた所だけを翌日もう一度思い出す',
    ],
    caution: '「思い出せない＝向いていない」ではない。思い出せなかった問題こそ効いている。',
    source: DUNLOSKY,
    forTraits: ['memory', 'wide'],
    forChannels: [],
    forOrder: [],
  },
  {
    id: 'spacing',
    title: '分散学習（間隔をあけて繰り返す）',
    reading: 'ぶんさんがくしゅう',
    effect: 'high',
    summary: '同じ時間を使うなら、1日にまとめるより日をあけて分けたほうが残る。詰め込みは直後だけ強く、あとで急に落ちる。',
    how: [
      '1単元を1回で終わらせず、翌日・3日後・1週間後に短く戻る',
      '戻る時は読み返さず「思い出す練習」とセットにする',
      '間隔は厳密でなくてよい。開きすぎたと感じたら詰める',
    ],
    caution: '直前期に詰め込むこと自体は否定しない。ただし詰め込んだものは試験後に急速に消える。',
    source: DUNLOSKY,
    forTraits: ['memory', 'wide'],
    forChannels: [],
    forOrder: [],
  },
  {
    id: 'interleave',
    title: '交互練習（種類を混ぜて解く）',
    reading: 'こうごれんしゅう',
    effect: 'mid',
    summary: '同じ型ばかり続けて解くと、その場では正答率が上がるが「どの型か見分ける力」が育たない。本番は混ざって出る。',
    how: [
      '1つの分野を続けたあと、必ず別の分野を混ぜた小テストをする',
      '似ていて紛らわしい2つを、あえて並べて出す',
      '最初は正答率が下がる。それは失敗ではなく見分けの練習をしている状態',
    ],
    caution: '基礎が入る前から混ぜると、ただ難しいだけになる。1周目は分野ごとでよい。',
    source: DUNLOSKY,
    forTraits: ['case', 'wide'],
    forChannels: [],
    forOrder: ['whole'],
  },
  {
    id: 'elaborate',
    title: '「なぜそうなるのか」を自分に問う',
    reading: 'なぜそうなるのかをじぶんにとう',
    effect: 'mid',
    summary: '事実を覚えるとき「なぜこれが正しいのか」を一言で説明できるようにする。理由がつくと、忘れても再構成できる。',
    how: [
      '正解の選択肢に対して「なぜこれが正しいか」を1行で書く',
      '誤答の選択肢にも「なぜ違うか」を1行で書く',
      '説明できなければ、そこが分かっていない場所',
    ],
    caution: '知識がまったく無い分野では作り話になる。最低限のインプットの後に使う。',
    source: DUNLOSKY,
    forTraits: ['case', 'calc'],
    forChannels: ['verbal'],
    forOrder: [],
  },
  {
    id: 'selfexplain',
    title: '自己説明（解く手順を声に出す）',
    reading: 'じこせつめい',
    effect: 'mid',
    summary: '解きながら「今なにをしているか」を自分の言葉で言う。飛ばしている手順が自分で聞こえる。',
    how: [
      '計算問題は式を書くたびに「なぜこの式か」を言う',
      '事例問題は「この記述から何が読み取れるか」を先に言ってから選択肢を見る',
      '人がいなくてもよい。声に出すこと自体が効く',
    ],
    caution: '時間がかかるので全問には使えない。間違えた問題だけに絞る。',
    source: DUNLOSKY,
    forTraits: ['calc', 'case', 'practical'],
    forChannels: ['auditory', 'verbal'],
    forOrder: ['step'],
  },
  {
    id: 'example',
    title: '具体例で挟む',
    reading: 'ぐたいれいではさむ',
    effect: 'mid',
    summary: '抽象的な定義は、具体例を2つ以上つけると使える知識になる。1つだけだとその例にしか反応しなくなる。',
    how: [
      '定義を覚えたら、当てはまる例と当てはまらない例を1つずつ作る',
      '過去問で出た事例をそのまま例として貼る',
    ],
    caution: '自分で作った例が間違っていることがある。出典で確かめる。',
    source: DUNLOSKY,
    forTraits: ['case', 'law'],
    forChannels: ['visual', 'verbal'],
    forOrder: [],
  },
  {
    id: 'dualcode',
    title: '図と言葉の両方で持つ',
    reading: 'ずとことばのりょうほうでもつ',
    effect: 'mid',
    summary: '同じ内容を図（位置・流れ・表）と言葉の両方で持つと、片方を忘れてももう片方から戻れる。',
    how: [
      '解剖・回路・制度の流れなど、位置関係があるものは必ず自分で描く',
      '描いた図に言葉のラベルを入れる（図だけだと説明できない）',
      '表は「縦に何を並べるか」を決めてから作る',
    ],
    caution: 'きれいなノートを作ること自体は点にならない。描いたあと必ず閉じて再現する。',
    source: `${DUNLOSKY}（imagery の項）／二重符号化の考え方は Paivio による`,
    forTraits: ['memory', 'practical'],
    forChannels: ['visual'],
    forOrder: ['whole'],
  },
  {
    id: 'pastfirst',
    title: '過去問から始める',
    reading: 'かこもんからはじめる',
    effect: 'unrated',
    summary: 'テキストを読み終えてから過去問に入るのではなく、先に過去問を見て「何をどこまで問われるか」を知ってから読む。',
    how: [
      '着手した単元の過去問を、解けなくてもよいので先に見る',
      '問われ方（用語を答えるのか、判断させるのか）を確かめる',
      'そのうえでテキストの該当箇所だけ読む',
    ],
    caution: '効果を比べた研究として確認できていない（※要確認）。ただし「範囲が広い試験で全部を同じ濃さでやらない」ための現実的な方法。',
    source: '※要確認（このアプリの方針として置いているもの。比較研究の裏付けは確認できていません）',
    forTraits: ['wide', 'memory', 'update'],
    forChannels: [],
    forOrder: ['whole'],
  },
  {
    id: 'buffer',
    title: '3分の2バッファ術（基礎タスクと余白を分ける）',
    reading: 'さんぶんのにばっふぁじゅつ',
    effect: 'unrated',
    summary: '確保した時間を「必ずやる基礎タスク」と「余白」に分ける。終わらないのは本人のせいではなく、余白の無い計画のせい。',
    how: [
      '今日使える時間を決める（例：60分）',
      '3分の2を基礎タスクに、3分の1を余白にする',
      '基礎タスクが終わったら、余白はご褒美の復習か、積み残しの消化に使う',
      '終わらなかった時は「無理な計画を立てた側」を直す（自分を責めない）',
    ],
    caution: '効果を比べた研究として確認できていない（※要確認）。出典は書籍の考え方。',
    source: '河野ゆかり『「仕組み化」勉強法』の考え方（※効果の比較研究は確認していません）',
    forTraits: [],
    forChannels: [],
    forOrder: ['step'],
  },
  {
    id: 'pomodoro',
    title: 'ポモドーロ（区切って進める）',
    reading: 'ぽもどーろ',
    effect: 'unrated',
    summary: '25分やって5分休む、を1本と数える。「やる気が出たら始める」のではなく「始まる形にしてから、やる気が後から来る」。',
    how: [
      '上部のタイマーで1本始める。始める前に「この1本で何をやるか」だけ決める',
      '休憩では画面から目を離す（次の教材を開かない）',
      '4本ごとに長めに休む',
    ],
    caution: '効果を比べた研究として確認できていない（※要確認）。本数を競う道具にすると、中身が薄い1本が増える。',
    source: 'Francesco Cirillo による方法（※効果の比較研究は確認していません）',
    forTraits: ['wide'],
    forChannels: [],
    forOrder: ['step'],
  },
  {
    id: 'timedmock',
    title: '本番と同じ時間で通す',
    reading: 'ほんばんとおなじじかんでとおす',
    effect: 'unrated',
    summary: '知識があっても時間内に解けなければ点にならない。時間配分は知識とは別に練習が要る。',
    how: [
      '直前期を待たず、早い時期に1回は通しで解く',
      '「飛ばす判断」を練習する（分からない問題に何秒までかけるか決める）',
      '解き直しは当日ではなく翌日にする（思い出す練習になる）',
    ],
    caution: '通し演習は疲れるので本数を増やしにくい。増やすなら大問単位で時間を区切る。',
    source: '※要確認（時間配分そのものを比べた研究は確認していません）',
    forTraits: ['speed', 'calc', 'case'],
    forChannels: [],
    forOrder: [],
  },
  {
    id: 'audio',
    title: '音で入れる（読み上げ・聞き流し）',
    reading: 'おとでいれる',
    effect: 'unrated',
    summary: '移動中や手がふさがっている時間を使える。ただし聞くだけでは「思い出す練習」にならないので、問いの形にして聞く。',
    how: [
      '「問題→3秒あける→答え」の形で読み上げる（答えだけ流さない）',
      '聞いた後に1問でよいので口で答える',
      '苦手な分野だけを繰り返す',
    ],
    caution: '聞き流しだけで覚えた気になりやすい。必ず一度は自分で答える工程を挟む。',
    source: '※要確認（聞き流し単独の効果を比べた研究は確認していません）',
    forTraits: ['memory'],
    forChannels: ['auditory'],
    forOrder: [],
  },
  {
    id: 'summarize',
    title: 'まとめノートを作る',
    reading: 'まとめのーとをつくる',
    effect: 'low',
    summary: '作っている間は理解している感じが強いが、点への効果は低いとされる。写している時間が長いほど、思い出す練習の時間が減る。',
    how: [
      'どうしても作りたい時は「あとで自分に出す問題」の形で書く',
      '教材の文をそのまま写さず、閉じてから自分の言葉で書く',
    ],
    caution: '効果が低いとされるのは「作って読み返す」使い方。作ったものを問題として使うなら「思い出す練習」に変わる。',
    source: DUNLOSKY,
    forTraits: [],
    forChannels: ['verbal'],
    forOrder: ['step'],
  },
  {
    id: 'highlight',
    title: 'マーカーを引く・線を引く',
    reading: 'まーかーをひく',
    effect: 'low',
    summary: '手軽で達成感があるが、点への効果は低いとされる。引いた場所を「もう覚えた場所」と勘違いしやすい。',
    how: ['引くなら「あとで思い出す練習をする場所の印」として使い、引いて終わりにしない'],
    caution: '引くこと自体を否定しない。引いた後に何をするかで決まる。',
    source: DUNLOSKY,
    forTraits: [],
    forChannels: ['visual'],
    forOrder: [],
  },
  {
    id: 'reread',
    title: '読み返す',
    reading: 'よみかえす',
    effect: 'low',
    summary: '一番よく使われるが、効果は低いとされる。見覚えがあることを「思い出せる」と取り違えてしまう。',
    how: ['読み返す代わりに、閉じて思い出す。思い出せなかった所だけを読む'],
    caution: '1周目のインプットとしての読みは別。ここで言っているのは「2周目以降の読み返し」。',
    source: DUNLOSKY,
    forTraits: [],
    forChannels: [],
    forOrder: [],
  },
];

export const METHOD_MAP = Object.fromEntries(METHODS.map((m) => [m.id, m]));

export function methodById(id) {
  return METHOD_MAP[id] || null;
}

/** 効果の順（高→中→低→未確認）に並べる */
export function sortedMethods(list = METHODS) {
  return [...list].sort(
    (a, b) => EFFECT_LEVELS[a.effect].order - EFFECT_LEVELS[b.effect].order || a.reading.localeCompare(b.reading, 'ja'),
  );
}

/**
 * 提案：試験の性格 × 認知特性から、相性のよい勉強法を並べる。
 * **決定ではなく提案**。効果が低いとされるものは提案に混ぜない（探せば見られる）。
 *
 * @param {string[]} traits    試験の性格（exams.js の traits）
 * @param {string|null} channel 認知特性の入り口（visual/verbal/auditory）。未回答なら null
 * @param {string|null} order   進め方の好み（step/whole）。未回答なら null
 */
export function suggestMethods(traits = [], channel = null, order = null) {
  const scored = METHODS.filter((m) => m.effect !== 'low').map((m) => {
    let score = 0;
    const reasons = [];
    // 効果の裏づけがあるものを土台にする（相性より先に効くため点を厚くする）
    if (m.effect === 'high') score += 3;
    if (m.effect === 'mid') score += 2;
    for (const t of m.forTraits) {
      if (traits.includes(t)) {
        score += 2;
        reasons.push(`この試験の「${t}」に効く`);
      }
    }
    if (channel && m.forChannels.includes(channel)) {
      score += 2;
      reasons.push('答えた入り口と合う');
    }
    if (order && m.forOrder.includes(order)) {
      score += 1;
      reasons.push('答えた進め方と合う');
    }
    return { ...m, score, reasons };
  });
  return scored.sort((a, b) => b.score - a.score || a.reading.localeCompare(b.reading, 'ja'));
}
