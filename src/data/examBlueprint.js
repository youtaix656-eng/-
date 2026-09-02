// 模擬試験「午前」「午後」の科目別出題数（本番同形式）。
// ユーザー指定の配分に基づく固定値。
// ⚠️ 実際の出題数・配点は年度により変わる場合があります。
//
// 最終確認日・出典：未確認（ユーザー指定の配分をそのまま採用）。公式資料
// （厚生労働省 実施要項／公益財団法人 東洋療法研修試験財団）で配分比率が
// 確認でき次第、この日付・出典を書き換えること（#2・#4）。数値そのものを
// 手元に無い基準で断定しないという方針上、確認前の数値へ「正しい」という
// 印象を与えないよう、このコメントを削除せずに残す。
// 総合問題（連問）の出題数（AM8問・PM10問）・fallbackSubjects（AM=臨床医学各論、
// PM=東洋医学概論/経絡経穴概論/東洋医学臨床論）も同様に未確認（#5・#7・#9）。
// 変更する時は必ずtest/examBlueprint.test.mjs（合計が90問かの機械チェック）と
// このコメントの両方を直すこと（#10。片方だけ直すと再びズレる）。

// 午前：専門基礎科目（90問）
export const EXAM_BLUEPRINT_AM = {
  session: 'am',
  label: '午前',
  totalCount: 90,
  minutes: 100,
  slots: [
    { subject: '解剖学', count: 9 },
    { subject: '生理学', count: 9 },
    { subject: '病理学概論', count: 6 },
    { subject: '衛生学・公衆衛生学', count: 6 },
    { subject: '関係法規', count: 4 },
    { subject: '医療概論', count: 4, excludeTags: ['医学史'] },
    { subject: '臨床医学総論', count: 10 },
    { subject: '臨床医学各論', count: 22 },
    { subject: 'リハビリテーション医学', count: 12 },
    {
      subject: '総合問題',
      count: 8,
      integrated: true,
      integratedSession: 'am',
      fallbackSubjects: ['臨床医学各論'],
      note: '総合問題（臨床医学各論ベース）',
    },
  ],
};

// 午後：専門科目（90問）
export const EXAM_BLUEPRINT_PM = {
  session: 'pm',
  label: '午後',
  totalCount: 90,
  minutes: 100,
  slots: [
    { subject: '東洋医学概論', count: 16 },
    { subject: '経絡経穴概論', count: 20 },
    { subject: '東洋医学臨床論', count: 24 },
    { subject: 'はり理論', count: 10 },
    { subject: 'きゅう理論', count: 10 },
    {
      subject: '総合問題',
      count: 10,
      integrated: true,
      integratedSession: 'pm',
      fallbackSubjects: ['東洋医学概論', '経絡経穴概論', '東洋医学臨床論'],
      note: '総合問題（東洋医学概論・経絡経穴概論・東洋医学臨床論の複合）',
    },
  ],
};

export const EXAM_BLUEPRINTS = [EXAM_BLUEPRINT_AM, EXAM_BLUEPRINT_PM];
