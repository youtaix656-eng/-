import { useState } from 'react';
import { BodyMap } from './BodyMap.js';
import { VasInput } from './VasInput.js';
import { regionById, regionFullLabel, SIDE_LABELS } from '../data/bodyRegions.js';
import { TIMINGS } from '../data/timings.js';
import type { Side, SymptomRecord, TimingId, Vas } from '../types/index.js';
import { formatDateTime } from '../lib/date.js';

interface Props {
  /** 編集するとき。無ければ新規 */
  initial?: SymptomRecord;
  onSave: (input: Omit<SymptomRecord, 'id' | 'at'>) => void;
  onCancel: () => void;
}

export function SymptomForm({ initial, onSave, onCancel }: Props) {
  const [regionId, setRegionId] = useState<string | null>(initial?.regionId ?? null);
  const [side, setSide] = useState<Side>(initial?.side ?? null);
  const [vas, setVas] = useState<Vas | null>(initial?.vas ?? null);
  const [timing, setTiming] = useState<TimingId>(initial?.timing ?? 'working');
  const [timingOther, setTimingOther] = useState(initial?.timingOther ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [error, setError] = useState('');

  const region = regionId ? regionById(regionId) : undefined;

  const pickRegion = (id: string) => {
    setRegionId(id);
    const r = regionById(id);
    // 左右のある部位をタップしたら、タップした側を初期値にする（両側へは手で変える）
    if (r?.side) setSide(r.side);
    else setSide(null);
  };

  const submit = () => {
    if (!regionId) return setError('体の図で部位をタップしてください');
    if (vas == null) return setError('痛みの強さ（0〜10）を選んでください');
    if (timing === 'other' && !timingOther.trim()) return setError('「その他」のタイミングを書いてください');
    setError('');
    onSave({ regionId, side, vas, timing, timingOther: timing === 'other' ? timingOther.trim() : '', note: note.trim() });
  };

  return (
    <div className="form">
      {initial && <p className="small">記録日時：{formatDateTime(initial.at)}（日時は変えられません）</p>}
      <h3>1. 部位（図をタップ）</h3>
      <BodyMap selectedId={regionId} onSelect={pickRegion} />
      <p className="picked">{region ? `選択中：${regionFullLabel(region.id, side)}` : '未選択'}</p>

      {region?.side && (
        <>
          <h3>2. 左右</h3>
          <div className="chips" role="radiogroup" aria-label="左右の別">
            {(['left', 'right', 'both'] as const).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={side === s} className={`chip${side === s ? ' on' : ''}`} onClick={() => setSide(s)}>
                {SIDE_LABELS[s]}
              </button>
            ))}
          </div>
        </>
      )}

      <h3>{region?.side ? '3' : '2'}. 痛みの強さ（VAS）</h3>
      <VasInput value={vas} onChange={setVas} />

      <h3>{region?.side ? '4' : '3'}. 発生タイミング</h3>
      <div className="chips" role="radiogroup" aria-label="発生タイミング">
        {TIMINGS.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={timing === t.id} className={`chip${timing === t.id ? ' on' : ''}`} onClick={() => setTiming(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {timing === 'other' && (
        <label className="field">
          <span>その他（自由記述）</span>
          <input value={timingOther} onChange={(e) => setTimingOther(e.target.value)} placeholder="例：運転後、荷物を持ち上げた直後" />
        </label>
      )}

      <h3>{region?.side ? '5' : '4'}. 専門用語メモ（任意）</h3>
      <label className="field">
        <span>所見・性状など</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="例：Tinel様所見あり、棘上筋に硬結、しびれ伴う" />
      </label>

      {error && <p className="error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={submit}>{initial ? '変更を保存' : 'この症状を記録する'}</button>
        <button type="button" className="btn" onClick={onCancel}>キャンセル</button>
      </div>
    </div>
  );
}
