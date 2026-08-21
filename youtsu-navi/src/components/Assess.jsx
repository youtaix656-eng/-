import React, { useMemo, useState } from 'react';
import { actions } from '../lib/useStore.js';
import { collectTags, missingFields } from '../lib/tags.js';
import { triage } from '../lib/triage.js';

/** 選択肢の排他制御（「当てはまるものはない」を選んだら他を外す、など） */
function toggleMulti(field, current, option) {
  const set = new Set(current || []);
  const exclusives = (field.options || []).filter((o) => o.exclusive).map((o) => o.value);
  if (set.has(option.value)) {
    set.delete(option.value);
  } else {
    set.add(option.value);
    if (option.exclusive) {
      for (const v of [...set]) if (v !== option.value) set.delete(v);
    } else {
      for (const v of exclusives) set.delete(v);
    }
  }
  return [...set];
}

function OptionButton({ option, pressed, onClick, multi }) {
  return (
    <button
      type="button"
      className={`option${option.alarm ? ' alarm' : ''}`}
      aria-pressed={pressed}
      onClick={onClick}
    >
      <span className="mark" aria-hidden="true">{pressed ? (multi ? '✓' : '●') : ''}</span>
      <span>
        {option.label}
        {option.note && <span className="muted small" style={{ display: 'block' }}>{option.note}</span>}
      </span>
    </button>
  );
}

function Field({ field, value, onChange }) {
  if (field.type === 'scale') {
    const current = typeof value === 'number' ? value : null;
    return (
      <div className="card">
        <h3>{field.label}</h3>
        {field.help && <p className="muted small">{field.help}</p>}
        <div className="scale-value">{current === null ? '—' : current}</div>
        <div className="scale-grid">
          {Array.from({ length: field.max - field.min + 1 }, (_, i) => i + field.min).map((n) => (
            <button key={n} type="button" aria-pressed={current === n} onClick={() => onChange(n)}>
              {n}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const multi = field.type === 'multi';
  const selected = multi ? value || [] : value;
  return (
    <div className="card">
      <h3>{field.label}</h3>
      {field.help && <p className="muted small">{field.help}</p>}
      {multi && <p className="small muted">複数選択できます</p>}
      <div className="options">
        {field.options.map((o) => (
          <OptionButton
            key={o.value}
            option={o}
            multi={multi}
            pressed={multi ? selected.includes(o.value) : selected === o.value}
            onClick={() => onChange(multi ? toggleMulti(field, selected, o) : o.value)}
          />
        ))}
      </div>
    </div>
  );
}

/** 症状入力ウィザード（企画書 第4部①の入力部分） */
export default function Assess({ state, symptom, go }) {
  const draft = state.draft && state.draft.symptomId === symptom.id ? state.draft : null;
  const [answers, setAnswers] = useState(draft ? draft.answers : {});
  const [stepIndex, setStepIndex] = useState(draft ? draft.stepIndex || 0 : 0);

  const steps = symptom.steps;
  const step = steps[stepIndex];
  const fields = useMemo(() => symptom.fields.filter((f) => f.step === step.id), [symptom, step]);
  const tags = useMemo(() => collectTags(symptom, answers), [symptom, answers]);
  const live = useMemo(() => triage(tags, symptom.redFlags), [tags, symptom]);
  const missing = missingFields(symptom, answers, step.id);

  const update = (fieldId, value) => {
    const next = { ...answers, [fieldId]: value };
    setAnswers(next);
    actions.saveDraft({ symptomId: symptom.id, answers: next, stepIndex });
  };

  const goStep = (nextIndex) => {
    setStepIndex(nextIndex);
    actions.saveDraft({ symptomId: symptom.id, answers, stepIndex: nextIndex });
    window.scrollTo(0, 0);
  };

  const finish = () => {
    const remaining = missingFields(symptom, answers);
    if (remaining.length) {
      const first = steps.findIndex((s) => s.id === remaining[0].step);
      goStep(first < 0 ? 0 : first);
      return;
    }
    actions.saveResult({ at: Date.now(), symptomId: symptom.id, answers, tags });
    actions.clearDraft();
    go('result');
  };

  const isLast = stepIndex === steps.length - 1;

  return (
    <div className="page">
      <div className="progress" aria-hidden="true">
        {steps.map((s, i) => (
          <i key={s.id} className={i <= stepIndex ? 'done' : ''} />
        ))}
      </div>
      <div>
        <p className="section-title">
          ステップ {stepIndex + 1} / {steps.length}
        </p>
        <h2 style={{ margin: '4px 0 6px' }}>{step.title}</h2>
        <p className="muted small">{step.lead}</p>
      </div>

      {/* 入力中でも緊急のレッドフラグはその場で知らせる */}
      {live.level === 'stop' && (
        <div className="alert danger" role="alert">
          <h2>⛔ 緊急の可能性があります</h2>
          <p className="alert-body">
            施術は行わず、直ちに医療機関の受診（状況により救急要請）をすすめてください。
          </p>
          <button type="button" className="btn danger" onClick={finish} disabled={missingFields(symptom, answers).length > 0}>
            トリアージ結果を見る
          </button>
        </div>
      )}

      {fields.map((f) => (
        <Field key={f.id} field={f} value={answers[f.id]} onChange={(v) => update(f.id, v)} />
      ))}

      {missing.length > 0 && (
        <p className="notice-inline">未入力：{missing.map((f) => f.label).join('、')}</p>
      )}

      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <button
          type="button"
          className="btn secondary"
          onClick={() => (stepIndex === 0 ? go('home') : goStep(stepIndex - 1))}
        >
          {stepIndex === 0 ? 'ホーム' : '戻る'}
        </button>
        <button type="button" className="btn" disabled={missing.length > 0} onClick={() => (isLast ? finish() : goStep(stepIndex + 1))}>
          {isLast ? '結果を見る' : '次へ'}
        </button>
      </div>
    </div>
  );
}
