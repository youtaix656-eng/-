// ローカル社員（AIエンジン未接続でも動く既定のプロバイダ）。
//
// これは AI ではない。規則ベースで「仕事の型」を組み立てるだけのもの。
// APIキーが1つも無い状態でも Ouro の全画面・全フロー（依頼 → ハンドオフ →
// 知識化 → 案件）を最後まで試せるようにするために置いている。
// 出力には必ず「AI未接続」の断りを入れ、AIが考えた結果だと誤解させない。

const FRAMES = {
  researcher: {
    heading: '調査の型',
    lines: [
      '① 何を確かめたいのか（問いを1文で）',
      '② 一次情報になりうる場所（公式サイト／統計／論文／当事者の発信）',
      '③ 二次情報（解説記事・動画）— 一次情報に当たれたかを必ず記録',
      '④ 集めた情報の日付（古い情報ほど疑う）',
      '⑤ まだ分かっていないこと',
    ],
  },
  analyzer: {
    heading: '分析の型',
    lines: [
      '① 事実として確定していること',
      '② 解釈・推測にすぎないこと',
      '③ 共通している点',
      '④ 食い違っている点（どちらが新しいか）',
      '⑤ 因果と相関の切り分け',
    ],
  },
  creator: {
    heading: '制作の型',
    lines: [
      '① 読み手は誰か（その人の今の困りごと）',
      '② 読み終えた後にしてほしい行動',
      '③ 見出しの並び（3〜5本）',
      '④ 最初の3行（ここで読むか決まる）',
      '⑤ 使ってはいけない表現・守るべき事実',
    ],
  },
  reviewer: {
    heading: '検証の型',
    lines: [
      '① 出典がある主張／無い主張の仕分け',
      '② 数字の単位・年度・母数の確認',
      '③ 断定しすぎている箇所',
      '④ 取り返しのつかない誤り（安全・お金・健康）',
      '⑤ 直すべき順番',
    ],
  },
  strategist: {
    heading: '戦略の型',
    lines: [
      '① 今の手持ち（時間・お金・スキル・人脈）',
      '② 選択肢を3つまで',
      '③ それぞれの初期費用と最短で成果が出るまでの日数',
      '④ 失敗したときに失うもの',
      '⑤ 今日やる1つ',
    ],
  },
  mentor: {
    heading: '学習の型',
    lines: [
      '① いま出来ること／出来ないことの線引き',
      '② 次の1段だけの目標（所要15分）',
      '③ できたと判定する方法',
      '④ つまずいたときの戻り方',
      '⑤ 次に復習する日',
    ],
  },
};

const DEFAULT_FRAME = {
  heading: '仕事の型',
  lines: [
    '① 依頼をひと言で言い換える',
    '② 完成の条件',
    '③ 手順（3つまで）',
    '④ 分からないので確認が要ること',
  ],
};

export const localProvider = {
  id: 'local',
  name: 'ローカル社員（AI未接続）',
  needsKey: false,
  models: [{ id: 'frame', label: '仕事の型', inputPer1M: 0, outputPer1M: 0 }],
  keyHelpUrl: null,
  desc: 'APIキーが無くても動く。AIではなく、仕事の型（チェックリスト）を組み立てる。',

  async run({ messages, meta = {}, onDelta }) {
    // meta が無い経路（テスト等）ではメッセージ本文から依頼を拾う
    const last = [...(messages || [])].reverse().find((m) => m.role === 'user');
    const request = meta.request || (last && typeof last.content === 'string' ? last.content : '') || '';
    const frame = FRAMES[meta.roleId] || DEFAULT_FRAME;

    const text = [
      '⚠ AIエンジン未接続のため、ローカル社員が「仕事の型」だけを組み立てました。',
      '設定 → AIエンジン でキーを1つ登録すると、この社員が実際に考えます。',
      '',
      `### ${frame.heading}`,
      `依頼：${trim(request, 160)}`,
      meta.instruction ? `担当：${trim(meta.instruction, 120)}` : '',
      meta.inheritedFrom ? `前の担当（${meta.inheritedFrom}）から引き継ぎ済み` : '',
      '',
      '### 埋めるべき項目',
      ...frame.lines,
      '',
      '上の項目を自分の言葉で埋めるだけでも、依頼は前に進みます。',
    ]
      .filter((l) => l !== '')
      .join('\n');

    // AI未接続でも見え方をそろえる（一気に出さず数回に分けて渡す）
    if (typeof onDelta === 'function') {
      const chunks = text.match(/[\s\S]{1,120}/g) || [text];
      for (const c of chunks) onDelta(c);
    }

    return {
      text,
      usage: { input: 0, output: 0 },
      offline: true,
    };
  },
};

function trim(text, n) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t || '（なし）';
}

export default localProvider;
