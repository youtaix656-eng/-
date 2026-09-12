import { useMemo, useState } from 'react';
import { EFFECTS, effectDef } from '../data/effects.js';
import { regionFullLabel } from '../data/bodyRegions.js';
import type { CareRecord, EffectId, SymptomRecord } from '../types/index.js';
import { filterCares, sortCares, type CareSort } from '../lib/filters.js';
import { formatDate, formatDateTime } from '../lib/date.js';

interface Props {
  cares: readonly CareRecord[];
  symptoms: readonly SymptomRecord[];
  onEdit: (c: CareRecord) => void;
  onRemove: (id: string) => void;
}

export function CareList({ cares, symptoms, onEdit, onRemove }: Props) {
  const [effects, setEffects] = useState<EffectId[]>([]);
  const [text, setText] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<CareSort>('effect');
  const [open, setOpen] = useState<string | null>(null);

  const symptomById = useMemo(() => new Map(symptoms.map((s) => [s.id, s])), [symptoms]);
  const shown = useMemo(() => sortCares(filterCares(cares, { effects, text, from, to }), sort), [cares, effects, text, from, to, sort]);

  const toggleEffect = (id: EffectId) => setEffects((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const confirmRemove = (c: CareRecord) => {
    if (window.confirm(`${formatDate(c.date)} の「${c.content}」を削除しますか？`)) onRemove(c.id);
  };

  return (
    <div>
      <details className="card flat filters">
        <summary>絞り込み・並び替え（{shown.length} 件／全 {cares.length} 件）</summary>
        <div className="chips" aria-label="効果で絞る">
          {EFFECTS.map((e) => (
            <button key={e.id} type="button" className={`chip${effects.includes(e.id) ? ' on' : ''}`} aria-pressed={effects.includes(e.id)} onClick={() => toggleEffect(e.id)}>
              {e.mark} {e.label}
            </button>
          ))}
        </div>
        <div className="filter-grid">
          <label className="field">
            <span>並び順</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as CareSort)}>
              <option value="effect">効果があった順</option>
              <option value="newest">新しい順</option>
              <option value="oldest">古い順</option>
            </select>
          </label>
          <label className="field">
            <span>内容で探す</span>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="例：ストレッチ" />
          </label>
          <label className="field">
            <span>開始日</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>終了日</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      </details>

      {shown.length === 0 && <p className="small">該当する記録はありません。</p>}
      <ul className="list">
        {shown.map((c) => {
          const isOpen = open === c.id;
          const linked = c.symptomIds.map((id) => symptomById.get(id)).filter((s): s is SymptomRecord => !!s);
          return (
            <li key={c.id} className="list-item">
              <button type="button" className="row-head" onClick={() => setOpen(isOpen ? null : c.id)} aria-expanded={isOpen}>
                <span className={`eff eff-${c.effect}`}>{effectDef(c.effect).mark}</span>
                <span className="row-main">
                  <strong>{c.content}</strong>
                  <small>{formatDate(c.date)} ・ {effectDef(c.effect).label}{linked.length ? ` ・ 症状 ${linked.length} 件` : ''}</small>
                </span>
              </button>
              {isOpen && (
                <div className="row-body">
                  {linked.length > 0 ? (
                    <ul className="sub-list">
                      {linked.map((s) => (
                        <li key={s.id}>{regionFullLabel(s.regionId, s.side)} VAS {s.vas}（{formatDateTime(s.at)}）</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="small">症状の紐づけなし</p>
                  )}
                  <div className="btn-row">
                    <button type="button" className="btn small-btn" onClick={() => onEdit(c)}>編集</button>
                    <button type="button" className="btn small-btn danger" onClick={() => confirmRemove(c)}>削除</button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
