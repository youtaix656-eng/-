// 合格ロードマップのフェーズ（日付範囲＋色）。カレンダーの色分けに使う。
// 本日 令和8年7月28日 → 令和9年2月28日(日) 本番。

export const ROADMAP_PHASES = [
  { id: 'p0', no: '0', label: '土台づくり', start: '2026-07-28', end: '2026-08-10', color: '#3f9db0' },
  { id: 'p1', no: '1', label: '全範囲1周', start: '2026-08-11', end: '2026-09-30', color: '#4a86d8' },
  { id: 'p2', no: '2', label: '弱点つぶし', start: '2026-10-01', end: '2026-10-31', color: '#8a6fd4' },
  { id: 'p3', no: '3', label: '仕上げ（合格実力）', start: '2026-11-01', end: '2026-11-30', color: '#3aa878' },
  { id: 'p4', no: '4', label: '維持・上積み', start: '2026-12-01', end: '2027-01-31', color: '#48b0b8' },
  { id: 'c3', no: '直前3週', label: '総仕上げ', start: '2027-02-01', end: '2027-02-07', color: '#d8a640' },
  { id: 'c2', no: '直前2週', label: '△✕だけに絞る', start: '2027-02-08', end: '2027-02-21', color: '#e08a3c' },
  { id: 'c1', no: '直前1週', label: '確認・調整', start: '2027-02-22', end: '2027-02-27', color: '#e0715f' },
  { id: 'day', no: '本番', label: '国家試験 本番', start: '2027-02-28', end: '2027-02-28', color: '#e0463c' },
];

// 日付文字列(YYYY-MM-DD)が属するフェーズを返す（なければ null）
export function phaseForDate(dateStr) {
  return ROADMAP_PHASES.find((p) => dateStr >= p.start && dateStr <= p.end) || null;
}

// 指定の年月(0始まりmonth)に重なるフェーズ一覧
export function phasesInMonth(year, month) {
  const pad = (n) => String(n).padStart(2, '0');
  const first = `${year}-${pad(month + 1)}-01`;
  const last = `${year}-${pad(month + 1)}-31`;
  return ROADMAP_PHASES.filter((p) => p.start <= last && p.end >= first);
}
