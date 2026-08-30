// 総合問題（連問）専用のカバー状況（⑩）— examBlueprint.jsの目標出題数（午前8問・午後10問）に対して、
// 実際に収録できている総合問題（questionsのsubject==='総合問題'）の数・事例(caseId)数を集計する。
// CoverageMap.jsx（科目単位の網羅マップ）とは別に、総合問題だけを対象にした専用ビュー。

export function integratedCoverage(questions, blueprints) {
  const integrated = questions.filter((q) => q.subject === '総合問題');
  const bySession = blueprints.map((bp) => {
    const slot = bp.slots.find((s) => s.integrated);
    const qs = integrated.filter((q) => q.examSession === bp.session);
    const caseIds = new Set(qs.map((q) => q.caseId).filter(Boolean));
    return {
      session: bp.session,
      label: bp.label,
      note: slot?.note || '',
      targetCount: slot?.count || 0,
      collectedCount: qs.length,
      caseCount: caseIds.size,
    };
  });
  const totalTarget = bySession.reduce((a, b) => a + b.targetCount, 0);
  const totalCollected = bySession.reduce((a, b) => a + b.collectedCount, 0);
  return { bySession, totalTarget, totalCollected };
}
