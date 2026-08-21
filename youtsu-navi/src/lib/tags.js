// 入力（answers）→ タグ集合への変換。
// answers = { [fieldId]: string | string[] | number }
// パターン推定・トリアージ・要配慮チェックはすべてこのタグだけを見る。

/** 選択された option を（fieldId順に）列挙する */
export function selectedOptions(symptom, answers = {}) {
  const out = [];
  for (const field of symptom.fields || []) {
    const value = answers[field.id];
    if (value === undefined || value === null) continue;
    if (field.type === 'scale') continue;
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      const opt = (field.options || []).find((o) => o.value === v);
      if (opt) out.push({ field, option: opt });
    }
  }
  return out;
}

/** 立っているタグの配列（重複なし） */
export function collectTags(symptom, answers = {}) {
  const set = new Set();
  for (const { option } of selectedOptions(symptom, answers)) {
    for (const t of option.tags || []) set.add(t);
  }
  return [...set];
}

/** 入力サマリー（結果画面・カルテ用の読める形） */
export function summarize(symptom, answers = {}) {
  const rows = [];
  for (const field of symptom.fields || []) {
    const value = answers[field.id];
    if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) continue;
    if (field.type === 'scale') {
      rows.push({ label: field.label, text: `${value} / ${field.max}` });
      continue;
    }
    const values = Array.isArray(value) ? value : [value];
    const labels = values
      .map((v) => (field.options || []).find((o) => o.value === v))
      .filter(Boolean)
      .map((o) => o.label);
    if (labels.length) rows.push({ label: field.label, text: labels.join('、') });
  }
  return rows;
}

/** 必須項目が埋まっているか（ステップ単位のバリデーション） */
export function missingFields(symptom, answers = {}, stepId = null) {
  return (symptom.fields || [])
    .filter((f) => f.required)
    .filter((f) => (stepId ? f.step === stepId : true))
    .filter((f) => {
      const v = answers[f.id];
      if (f.type === 'scale') return typeof v !== 'number';
      if (Array.isArray(v)) return v.length === 0;
      return v === undefined || v === null || v === '';
    });
}
