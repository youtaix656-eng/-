// 責任の所在の明確化 — 企画書 改善策 #7
//
// 初回起動時と、提案結果を表示するたびに同意を求め、同意履歴をログとして残す。
// 文言を変えた時は CONSENT_VERSION を上げる（上げると再同意を求める）。

export const CONSENT_VERSION = '1.0.0';

export const CONSENT_TEXT = {
  title: 'ご利用にあたっての同意',
  lead: '本アプリは、有資格者の判断を補助するための参考情報を提示するツールです。',
  items: [
    '本アプリは医療機器ではなく、診断を行うものではありません。表示される「推定パターン」「％」は診断名・診断確率ではなく、入力内容からの目安です。',
    '最終的な施術の可否・内容・強度の判断は、施術者本人が行うものとします。',
    'レッドフラグ（危険信号）の判定は、見落としを完全に防ぐものではありません。該当がなくても、施術中の変化には常に注意してください。',
    '各資格の業務範囲に関する表示は一般的な整理であり、実務上の可否は関係法令・通知・自治体の解釈によります（※要確認）。',
    'お客様の状態に不安がある場合は、施術より医療機関の受診を優先してください。',
    '入力したデータは、この端末の中にのみ保存されます（外部送信は行いません）。',
  ],
  agree: '上記に同意して利用する',
};

/** 結果画面に毎回出す短い確認文（企画書：提案結果表示画面にも同意画面を設置） */
export const RESULT_NOTICE =
  'この提案は参考情報です。診断ではありません。最終的な施術判断は施術者ご自身の責任で行ってください。';

export function makeConsentRecord({ version = CONSENT_VERSION, licenseId = null, kind = 'initial', at = Date.now() } = {}) {
  return { id: `${at}-${Math.random().toString(36).slice(2, 8)}`, at, version, licenseId, kind };
}

/** 現在の同意が有効か（未同意 or 版が上がっていれば false） */
export function isConsentValid(consent) {
  return Boolean(consent && consent.version === CONSENT_VERSION && consent.agreedAt);
}
