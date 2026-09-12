import type { RepeatKind, ScheduleType } from '../types/index.js';

export const SCHEDULE_TYPES: { id: ScheduleType; label: string }[] = [
  { id: 'work', label: '勤務' },
  { id: 'school', label: '学校' },
  { id: 'other', label: 'その他' },
];

export const REPEAT_KINDS: { id: RepeatKind; label: string; note: string }[] = [
  { id: 'none', label: 'なし', note: 'その日だけ' },
  { id: 'daily', label: '毎日', note: 'その日から毎日' },
  { id: 'weekdays', label: '平日', note: 'その日から月〜金' },
  { id: 'weekly', label: '毎週', note: 'その日から同じ曜日' },
];

export function scheduleTypeLabel(id: ScheduleType): string {
  return SCHEDULE_TYPES.find((t) => t.id === id)?.label ?? 'その他';
}

export function repeatLabel(id: RepeatKind): string {
  return REPEAT_KINDS.find((r) => r.id === id)?.label ?? 'なし';
}
