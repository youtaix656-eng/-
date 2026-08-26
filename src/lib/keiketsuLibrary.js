// 経絡経穴の教科書材料（原文の置き場）— 検索・追加・削除のロジック。
//
// ここが持つのはユーザーが貼り付けた「原文（下書き）」であり、経穴の医療的事実そのもの
// ではない。実際の経穴データ（data/keiketsuCards.js）は、この原文を出典として
// Claudeが出典つきで手動整備する（このライブラリの原文を直接クイズ化する自動処理は持たない
// ＝ CLAUDE.md の「過去問PDFの内容を記憶で再現しない／文章そのものはコピーしない」方針と、
// 「データは直接ファイルを編集する」方針の両方を守るため）。

let seq = 0;
function makeId() {
  seq += 1;
  return `kl-${Date.now().toString(36)}-${seq}`;
}

// 新しいページ（原文）を作る。title・text は前後の空白を除く。
export function makePage({ title, text }) {
  const t = (title || '').trim();
  const body = (text || '').trim();
  return {
    id: makeId(),
    title: t || '（無題）',
    text: body,
    addedAt: Date.now(),
  };
}

export function addPage(pages, page) {
  return [...(pages || []), page];
}

export function removePage(pages, id) {
  return (pages || []).filter((p) => p.id !== id);
}

// クエリに一致する箇所の前後を切り出したスニペットを作る（一覧でのプレビュー用）。
export function snippetFor(text, query, radius = 40) {
  if (!text) return '';
  if (!query) return text.slice(0, radius * 2);
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

// title・text の部分一致で検索する（大文字小文字を区別しない）。空クエリは全件を返す。
export function searchPages(pages, query) {
  const q = (query || '').trim();
  if (!q) return pages || [];
  const ql = q.toLowerCase();
  return (pages || []).filter(
    (p) => p.title.toLowerCase().includes(ql) || p.text.toLowerCase().includes(ql)
  );
}

// ---- 検索用プロンプト（外部AIチャットへ貼り付けて使う・原文保護版） ----
// 保存した教科書材料を【本文】欄へ差し込んだ状態で書き出す。
// 「数字・専門用語を勝手に変えない／答えの後に本文と照合表を作る」ことを
// AI側に強制するための固定文言（テンプレート本体は変更しないこと＝この関数の目的そのもの）。
export const SEARCH_PROMPT_TEMPLATE = `【経絡経穴概論 検索プロンプト（鍼灸国家試験対応・原文保護版）】

あなたは鍼灸国家試験対策の経絡経穴概論アシスタントです。
以下の【本文】に書かれている範囲だけを情報源にして、正確に検索・回答してください。

■ 基本の厳守事項
1. 【本文】に書かれていないことは推測・記憶で補わない。該当箇所が無ければ
   「この範囲には記載がありません」と明言する（他の回・他の版の知識で埋めない）。
2. 経穴名は正式名称と読みを併記する（例：合谷（ごうこく）、LI4）。

■ 数字・原文を変えないための厳守事項（最重要）
3. 数字・単位（寸法・角度・年齢区分・回数など）は【本文】の表記を一字一句そのまま
   引用する。四捨五入・概算・単位変換・「約」を勝手に付け足す、のいずれも禁止。
   例：本文が「上3寸」なら「約3寸」「3寸前後」等に変えない。
4. 方向・関係を表す語（内側/外側、上/下、前/後、以上/以下/未満、より大きい/小さい、
   〜の原因/〜の結果、〜しなければ/〜すれば　等）は意味が反転しやすいため、
   要約せずそのままの語を使う。自信が持てない場合は要約せず原文をそのまま「」で引用する。
5. 専門用語・経穴名・経絡名・分類名（原穴/郄穴/五要穴 等）は言い換えない。
   一般的な説明文だけを自分の言葉でまとめてよく、数字・固有名詞・関係語には手を加えない。
6. 語呂合わせ等の創作的な文章表現はそのまま引用せず、事実だけを保って
   自分の言葉で言い換える（ただし数字・固有名詞は5と同じくそのまま）。

■ 回答の最後に必ず「照合表」を付ける（自己チェック）
7. 回答を書き終えたら、回答文中に登場する数字・専門用語・関係語をすべて洗い出し、
   それぞれが【本文】のどこにそのまま書かれているかを一覧にする。
   本文に見当たらない数字・語句が1つでもあれば、それは書いてはいけない情報なので、
   回答本文を修正してから出力する（照合表を都合よく作るのではなく、
   照合表で引っかかったら先に回答を直す）。

   照合表の形式:
   | 回答で使った数字・語句 | 本文中の該当箇所（そのまま引用） |
   |---|---|
   | 例）上3寸 | 「…内果尖の上3寸、脛骨内縁の後際。」 |

━━━━━━━━━━━━━━━━━━━━━━
【本文】
{{BODY}}

【質問】
（調べたい経穴名・経絡名・キーワードをここに書く）
`;

// pages（1件以上）を【本文】へ差し込んだプロンプト全文を返す。
export function buildSearchPrompt(pages) {
  const list = pages || [];
  const body = list.length
    ? list.map((p) => `# ${p.title}\n${p.text}`).join('\n\n')
    : '（教科書材料が未登録です）';
  return SEARCH_PROMPT_TEMPLATE.replace('{{BODY}}', body);
}
