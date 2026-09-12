import { useMemo, useState } from 'react';
import { regionFullLabel, regionGroups, regionLabel } from '../data/bodyRegions.js';
import { timingLabel } from '../data/timings.js';
import { effectDef } from '../data/effects.js';
import type { CareRecord, SymptomRecord } from '../types/index.js';
import { filterSymptoms, sortSymptoms, caresForSymptom, type SymptomSort } from '../lib/filters.js';
import { formatDate, formatDateTime } from '../lib/date.js';

interface Props {
  symptoms: readonly SymptomRecord[];
  cares: readonly CareRecord[];
  onEdit: (s: SymptomRecord) => void;
  onRemove: (id: string) => void;
  onAddCare: (symptomId: string) => void;
}

export function SymptomList({ symptoms, cares, onEdit, onRemove, onAddCare }: Props) {
  const [group, setGroup] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [minVas, setMinVas] = useState(0);
  const [text, setText] = useState('');
  const [sort, setSort] = useState<SymptomSort>('newest');
  const [open, setOpen] = useState<string | null>(null);
  const groups = useMemo(() => regionGroups(), []);

  const shown = useMemo(() => {
    const g = groups.find((x) => x.key === group);
    const list = filterSymptoms(symptoms, { regionIds: g?.ids, from, to, minVas, text }, regionLabel);
    return sortSymptoms(list, sort);
  }, [symptoms, groups, group, from, to, minVas, text, sort]);

  const confirmRemove = (s: SymptomRecord) => {
    if (window.confirm(`${formatDateTime(s.at)} の「${regionFullLabel(s.regionId, s.side)} VAS ${s.vas}」を削除しますか？\n紐づいている対応策は残ります（紐づけだけ外れます）。`)) onRemove(s.id);
  };

  return (
    <div>
      <details className="card flat filters">
        <summary>絞り込み・並び替え（{shown.length} 件／全 {symptoms.length} 件）</summary>
        <div className="filter-grid">
          <label className="field">
            <span>部位</span>
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="">すべて</option>
              {groups.map((g) => (
                <option key={g.key} value={g.key}>{g.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>並び順</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SymptomSort)}>
              <option value="newest">新しい順</option>
              <option value="oldest">古い順</option>
              <option value="vas_desc">強い順（VAS）</option>
            </select>
          </label>
          <label className="field">
            <span>開始日</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>終了日</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="field">
            <span>VAS {minVas} 以上</span>
            <input type="range" min={0} max={10} value={minVas} onChange={(e) => setMinVas(Number(e.target.value))} />
          </label>
          <label className="field">
            <span>メモ・部位名で探す</span>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="例：硬結、しびれ" />
          </label>
        </div>
      </details>

      {shown.length === 0 && <p className="small">該当する記録はありません。</p>}
      <ul className="list">
        {shown.map((s) => {
          const linked = caresForSymptom(cares, s.id);
          const isOpen = open === s.id;
          return (
            <li key={s.id} className="list-item">
              <button type="button" className="row-head" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen}>
                <span className="vas-badge" aria-label={`VAS ${s.vas}`}>{s.vas}</span>
                <span className="row-main">
                  <strong>{regionFullLabel(s.regionId, s.side)}</strong>
                  <small>{formatDateTime(s.at)} ・ {timingLabel(s.timing, s.timingOther)}</small>
                </span>
                <span className="row-tail">{linked.length > 0 ? `対応策 ${linked.length}` : ''}</span>
              </button>
              {isOpen && (
                <div className="row-body">
                  {s.note ? <p className="quote">{s.note}</p> : <p className="small">メモなし</p>}
                  {linked.length > 0 && (
                    <div>
                      <p className="small">この症状に試した対応策</p>
                      <ul className="sub-list">
                        {linked.map((c) => (
                          <li key={c.id}>
                            <span className={`eff eff-${c.effect}`}>{effectDef(c.effect).mark} {effectDef(c.effect).label}</span> {formatDate(c.date)} {c.content}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="btn-row">
                    <button type="button" className="btn small-btn primary" onClick={() => onAddCare(s.id)}>この症状に対応策を記録</button>
                    <button type="button" className="btn small-btn" onClick={() => onEdit(s)}>編集</button>
                    <button type="button" className="btn small-btn danger" onClick={() => confirmRemove(s)}>削除</button>
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
