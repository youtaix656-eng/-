// 総合問題（連問形式）
//
// 本番の総合問題は、1つの事例（症例）ストーリーに対して2〜3問が続く「連問」形式。
// 午前は臨床医学各論ベース、午後は東洋医学概論・経絡経穴概論・東洋医学臨床論の複合。
// 過去問を貼っていただき次第、実例をもとにこのファイルへバッチ追加していく
// （現時点では収録なし。過去問が届くまでは模擬試験側でベース科目から代替出題する）。
//
// スキーマ：
// {
//   id, subject: '総合問題', type: 'choice' | 'ox',
//   question, choices, answer, explanation, tags,
//   examSession: 'am' | 'pm',   // 午前／午後どちらの総合問題か
//   caseId: 'ig-xxxx',           // 同じ事例（連問）をまとめるキー
//   caseOrder: 1,                // 連問内の順番（1〜2/3）
//   caseStem: '「35歳の女性。…」', // 事例の共通ストーリー文（連問の最初の問題にのみ記載）
// }

export const INTEGRATED_VERSION = 0;

const integratedQuestions = [];

export default integratedQuestions;
