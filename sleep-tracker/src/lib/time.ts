// 時刻(HH:mm)まわりのユーティリティ。日またぎ・夜勤の「25:00」表記に対応。

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function fromMinutes(totalMin: number): string {
  const m = ((totalMin % 1440) + 1440) % 1440;
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// 範囲の長さ（分）。end <= start は日をまたいだとみなす。
// start/end が未入力の場合は 0 として扱う（丸1日と誤集計しないため）。
export function rangeMinutes(range: { start: string; end: string }): number {
  if (!range.start || !range.end) return 0;
  const s = toMinutes(range.start);
  const e = toMinutes(range.end);
  return e > s ? e - s : 1440 - s + e;
}

export function minutesToHoursLabel(min: number): string {
  return (Math.round((min / 60) * 10) / 10).toFixed(1);
}

// 深夜またぎ直後の時刻を「25:00」のように表記する（夜勤者向け）。
// baseHHMM からの経過分 elapsedMin が半日未満で日をまたいだ場合のみ延長表記にする。
export function formatShiftClock(baseHHMM: string, elapsedMin: number): string {
  const baseMin = toMinutes(baseHHMM);
  const abs = baseMin + elapsedMin;
  if (elapsedMin < 12 * 60 && abs >= 1440) {
    const hh = Math.floor(abs / 60);
    const mm = abs % 60;
    return `${hh}:${String(mm).padStart(2, '0')}`;
  }
  return fromMinutes(abs);
}

export function todayISODate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isoToHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()} (${w})`;
}
