// 3分の2バッファ術 — 河野ゆかり『「仕組み化」勉強法』の考え方を取り込んだ学習計画機能。
// 「やる気があるから勉強する」のではなく「勉強が始まる形になっているから、やる気があとからついてくる」。
// 学習予定時間を 基礎タスク:バッファ = 2:1 で自動分割し、基礎タスクが予定通り終わったかで
// バッファ枠の使い道（ご褒美復習／積み残し消化）を判定する。
//
// StudySession（参考実装のTS型をこのアプリのJSデータモデルに合わせたもの）：
//   { totalMinutes, baseTaskMinutes, bufferMinutes, baseTaskQuestionCount, bufferQuestionCount,
//     bufferUsage: 'review'|'catchup'|'unused', shiftContext?: 'work_day'|'off_day',
//     conditionScore?: number, managerReview?: { completed: boolean, note?: string } }
// このオブジェクトは Session.jsx の既存 `session`（学習セッションの続き位置）とは別に
// `session.buffer` として埋め込む。既存の一問一答・原問・音声学習・マインドマップの
// データ構造とは衝突しない。

// 基礎タスク:バッファ の既定比率（2:1）。設定画面から調整できるよう定数化する
// （settings.bufferBaseRatioPct が優先。未設定ならこの既定値を使う）。
export const DEFAULT_BASE_RATIO = 2 / 3;

// B. シフト連動型の配分調整。シフト情報が未連携の場合は常に標準配分（2:1）で動作する。
// off_day は「標準配分」を使うため、ここには含めない（baseRatioFor で standardRatio にフォールバック）。
export const SHIFT_BASE_RATIO = {
  work_day: 0.55, // 出勤日（深夜シフト後などの学習）：基礎タスク比率をやや下げる
};

// ジャンル（科目）別の想定解答時間（秒）。過去データが無い初回はこの値で概算する。
export const DEFAULT_ANSWER_SECONDS = {
  '解剖学': 40,
  '生理学': 40,
  '病理学概論': 35,
  '衛生学・公衆衛生学': 35,
  '関係法規': 30,
  '医療概論': 30,
  '臨床医学総論': 45,
  '臨床医学各論': 45,
  'リハビリテーション医学': 40,
  '東洋医学概論': 35,
  '経絡経穴概論': 35,
  '東洋医学臨床論': 45,
  'はり理論': 35,
  'きゅう理論': 35,
};
export const FALLBACK_ANSWER_SECONDS = 40;

// 解答間隔を平均する際、これより長い間隔は休憩・中断とみなして除外する
const MAX_GAP_MS = 5 * 60 * 1000;
// これ未満のサンプル数では信頼できないとみなし、デフォルト値にフォールバックする
const MIN_SAMPLES = 5;

// 過去の解答履歴（history の連続タイムスタンプの差）から、平均解答時間（秒）を推定する。
// サンプルが少なければ null を返す（呼び出し側でデフォルト値にフォールバックする）。
export function averageAnswerSeconds(history, subject) {
  const list = (subject && subject !== 'all' ? history.filter((h) => h.subject === subject) : history)
    .slice()
    .sort((a, b) => a.at - b.at);
  const deltas = [];
  for (let i = 1; i < list.length; i++) {
    const d = list[i].at - list[i - 1].at;
    if (d > 0 && d <= MAX_GAP_MS) deltas.push(d);
  }
  if (deltas.length < MIN_SAMPLES) return null;
  deltas.sort((a, b) => a - b);
  const mid = Math.floor(deltas.length / 2);
  const medianMs = deltas.length % 2 ? deltas[mid] : (deltas[mid - 1] + deltas[mid]) / 2;
  return Math.min(180, Math.max(5, Math.round(medianMs / 1000)));
}

// 実際に使う「1問あたりの想定解答時間（秒）」。過去データがあればそれを優先し、
// なければジャンル別デフォルト→全体デフォルトの順にフォールバックする。
export function estimatedAnswerSeconds(history, subject) {
  return (
    averageAnswerSeconds(history, subject) ??
    DEFAULT_ANSWER_SECONDS[subject] ??
    FALLBACK_ANSWER_SECONDS
  );
}

// B. 基礎タスク比率の算出。シフト情報が未連携（shiftContext未指定）なら常に標準比率。
// 標準比率は既定2:1だが、設定画面（settings.bufferBaseRatioPct）で調整できる
// （standardRatio に渡す。ハードコーディングしない）。
// 体調スコア（0-100、任意。Session.jsxは「今日の調子」をlib/mood.jsのmoodToConditionScoreで
// 変換して渡す）があれば、その日のコンディションに応じて±5%の範囲でゆるく微調整する
// （下限40%・上限80%でクランプ）。
export function baseRatioFor({ shiftContext, conditionScore, baseRatio, standardRatio } = {}) {
  if (baseRatio != null) return baseRatio;
  const std = standardRatio ?? DEFAULT_BASE_RATIO;
  let ratio = shiftContext ? (SHIFT_BASE_RATIO[shiftContext] ?? std) : std;
  if (conditionScore != null) {
    const adj = ((conditionScore - 50) / 50) * 0.05;
    ratio = Math.min(0.8, Math.max(0.4, ratio + adj));
  }
  return ratio;
}

// A. セッション設計時の自動計算：学習予定時間（分）→ 基礎タスク／バッファへの自動分割。
export function planStudySession({
  totalMinutes,
  subject = 'all',
  history = [],
  shiftContext = null,
  conditionScore = null,
  baseRatio = null,
  standardRatio = null,
}) {
  const ratio = baseRatioFor({ shiftContext, conditionScore, baseRatio, standardRatio });
  const baseTaskMinutes = Math.max(1, Math.round(totalMinutes * ratio));
  const bufferMinutes = Math.max(0, totalMinutes - baseTaskMinutes);
  const secPerQuestion = estimatedAnswerSeconds(history, subject);
  const baseTaskQuestionCount = Math.max(1, Math.round((baseTaskMinutes * 60) / secPerQuestion));
  const bufferQuestionCount = Math.max(0, Math.round((bufferMinutes * 60) / secPerQuestion));
  return {
    totalMinutes,
    baseTaskMinutes,
    bufferMinutes,
    baseTaskQuestionCount,
    bufferQuestionCount,
    secPerQuestion,
    ratio,
    bufferUsage: 'unused',
    ...(shiftContext ? { shiftContext } : {}),
    ...(conditionScore != null ? { conditionScore } : {}),
  };
}

// C. 振り返り結果からバッファ枠の用途を自動判定する。
//   予定通り完了 → 'review'（ご褒美復習）／ 未達 → 'catchup'（積み残し消化）
// 「悪いのは実行役ではなく、無理な計画を立てたマネージャー」という前提のため、
// この関数自体もユーザーを評価・非難する値は一切返さない（用途の判定のみ）。
export function resolveBufferUsage(completed) {
  return completed ? 'review' : 'catchup';
}

export function bufferUsageLabel(usage) {
  // 'review'は「まだ間違えた問題を確認する軽めの復習」であり、得意分野を確認するもの
  // ではない（実装はreviewPoolFor＝通常の復習対象プールをそのまま使う）。文言と実装を
  // 一致させる。
  if (usage === 'review') return 'ご褒美復習（気楽に取り組む復習）';
  if (usage === 'catchup') return '積み残し消化（未完了問題の続き）';
  return '';
}

// マネージャービュー（振り返り）のひとこと。自己否定を招かないトーンに統一する。
export function managerReviewMessage(completed) {
  return completed
    ? '基礎タスク、予定通り完了です。おつかれさまでした。ここからはバッファ枠、好きに使ってください。'
    : '基礎タスクは今回、時間内には終わりませんでした。……大丈夫、悪いのは計画を立てたマネージャーです。バッファ枠で続きを消化しましょう。';
}
