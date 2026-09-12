import { useMemo, useState } from 'react';
import { EFFECTS } from '../data/effects.js';
import { regionFullLabel } from '../data/bodyRegions.js';
import type { CareRecord, DateKey, EffectId, SymptomRecord } from '../types/index.js';
import { formatDateTime, todayKey } from '../lib/date.js';
import { linkableSymptoms } from '../lib/summary.js';

interface Props {
  initial?: CareRecord;
  /** 新規のとき、あらかじめ紐づける症状 */
  presetSymptomIds?: string[];
  symptoms: readonly SymptomRecord[];
  quickItems: readonly string[];
  onSave: (input: Omit<CareRecord, 'id' | 'at'>) => void;
  onCancel: () => void;
}

export function CareForm({ initial, presetSymptomIds, symptoms, quickItems, onSave, onCancel }: Props) {
  const [date, setDate] = useState<DateKey>(initial?.date ?? todayKey());
  const [picked, setPicked] = useState<string[]>(() => (initial ? quickItems.filter((q) => initial.content.includes(q)) : []));
  const [free, setFree] = useState(() => {
    if (!initial) return '';
    // 編集時：クイック項目に一致した語を除いた残りを自由記述へ
    let rest = initial.content;
    for (const q of quickItems) rest = rest.split(q).join('');
    return rest.replace(/^[、\s]+|[、\s]+$/g, '').replace(/、{2,}/g, '、');
  });
  const [effect, setEffect] = useState<EffectId | null>(initial?.effect ?? null);
  const [symptomIds, setSymptomIds] = useState<string[]>(initial?.symptomIds ?? presetSymptomIds ?? []);
  const [showAllSymptoms, setShowAllSymptoms] = useState(false);
  const [error, setError] = useState('');

  const candidates = useMemo(() => {
    const recent = linkableSymptoms(symptoms);
    if (showAllSymptoms) return [...symptoms].sort((a, b) => b.at - a.at);
    // 既に紐づいているものは期間外でも出す
    const ids = new Set(recent.map((s) => s.id));
    const extra = symptoms.filter((s) => symptomIds.includes(s.id) && !ids.has(s.id));
    return [...extra, ...recent];
  }, [symptoms, symptomIds, showAllSymptoms]);

  const toggle = (id: string) => setSymptomIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const togglePick = (q: string) => setPicked((cur) => (cur.includes(q) ? cur.filter((x) => x !== q) : [...cur, q]));

  const submit = () => {
    const content = [...picked, free.trim()].filter(Boolean).join('、');
    if (!content) return setError('ケア内容を選ぶか書いてください');
    if (!effect) return setError('効果の自己評価を選んでください');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('実施日を入れてください');
    setError('');
    onSave({ date, content, effect, symptomIds });
  };

  return (
    <div className="form">
      {initial && <p className="small">記録日時：{formatDateTime(initial.at)}</p>}
      <h3>1. 実施したケア</h3>
      <div className="chips">
        {quickItems.map((q) => (
          <button key={q} type="button" className={`chip${picked.includes(q) ? ' on' : ''}`} aria-pressed={picked.includes(q)} onClick={() => togglePick(q)}>
            {q}
          </button>
        ))}
      </div>
      <label className="field">
        <span>自由入力（部位・時間・回数など）</span>
        <textarea value={free} onChange={(e) => setFree(e.target.value)} rows={2} placeholder="例：ハムストリングスのストレッチ30秒×3、就寝前" />
      </label>

      <h3>2. 実施日</h3>
      <label className="field">
        <span>日付</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      <h3>3. 効果の自己評価</h3>
      <div className="chips" role="radiogroup" aria-label="効果の自己評価">
        {EFFECTS.map((e) => (
          <button key={e.id} type="button" role="radio" aria-checked={effect === e.id} className={`chip${effect === e.id ? ' on' : ''}`} onClick={() => setEffect(e.id)}>
            {e.mark} {e.label}
          </button>
        ))}
      </div>

      <h3>4. どの症状に対する対応策か（任意・複数可）</h3>
      {candidates.length === 0 ? (
        <p className="small">紐づけられる症状の記録がありません。先に症状を記録するか、紐づけ無しで保存できます。</p>
      ) : (
        <ul className="pick-list">
          {candidates.map((s) => (
            <li key={s.id}>
              <label>
                <input type="checkbox" checked={symptomIds.includes(s.id)} onChange={() => toggle(s.id)} />
                <span>
                  {regionFullLabel(s.regionId, s.side)} VAS {s.vas}
                  <small> {formatDateTime(s.at)}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {!showAllSymptoms && symptoms.length > candidates.length && (
        <button type="button" className="btn small-btn" onClick={() => setShowAllSymptoms(true)}>30日より前の症状も表示する</button>
      )}

      {error && <p className="error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={submit}>{initial ? '変更を保存' : 'この対応策を記録する'}</button>
        <button type="button" className="btn" onClick={onCancel}>キャンセル</button>
      </div>
    </div>
  );
}
