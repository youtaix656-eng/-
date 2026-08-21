// 症状スキーマ（汎用）— 企画書 改善策 #6
//
// 腰痛だけでなく、肩こり・膝痛など他症状を追加しても「作り直し」にならないよう、
// 症状を1つのオブジェクト（SymptomModule）で表現する。腰痛は lowBack.js が
// このスキーマに沿って定義したインスタンス。新症状を足す時は同じ形で
// 別ファイルを作り symptoms.js に登録するだけでよい。
//
//   SymptomModule = {
//     id, name, version,
//     fields:   [Field]        入力項目（質問）
//     patterns: [Pattern]      推定される原因パターン（inference.js が採点）
//     redFlags: [RedFlag]      安全トリアージ（triage.js が判定）
//   }
//
//   Field = {
//     id, label, type: 'single'|'multi'|'scale'|'bool',
//     required?, help?, step,             step = 入力ウィザードの画面グループ
//     options: [{ value, label, tags: ['group:name', ...], note? }]
//     min?, max?                          type:'scale' のみ
//   }
//
// タグは「群:値」の文字列に統一する（例 'aggr:flexion'）。
// パターン／レッドフラグ／施術方針はすべてタグだけを見て判定するため、
// 入力UIを変えてもロジック側を書き換えずに済む。

/** タグ群の定義（表示名は結果画面の説明にも使う） */
export const TAG_GROUPS = {
  region: '部位',
  quality: '痛みの性質',
  onset: '発症のしかた',
  duration: '経過',
  trigger: 'きっかけ',
  aggr: '悪化する動作・姿勢',
  relief: '楽になる動作・姿勢',
  neuro: '神経症状',
  history: '既往歴',
  special: '要配慮対象',
  sys: '全身症状',
  work: '生活・仕事',
};

/** 使用してよいタグの一覧（タイプミス検出用。validateSymptom が参照する） */
export const TAG_VOCABULARY = {
  region: ['lumbar_center', 'lumbar_side', 'lumbosacral', 'sacroiliac', 'buttock', 'groin', 'thigh_post', 'leg_lateral', 'lower_leg', 'foot', 'flank'],
  quality: ['dull', 'sharp', 'burning', 'numb', 'heavy', 'throbbing', 'cramp', 'stiff'],
  onset: ['sudden', 'gradual', 'after_trauma', 'unknown', 'first_episode'],
  duration: ['acute', 'subacute', 'chronic', 'recurrent'],
  trigger: ['lifting', 'twisting', 'sitting_long', 'standing_long', 'sports', 'childcare', 'desk_work', 'driving', 'unknown'],
  aggr: ['flexion', 'extension', 'rotation', 'sitting', 'standing', 'walking', 'transition', 'morning', 'evening', 'cough', 'none'],
  relief: ['rest', 'flexion', 'walking', 'heat', 'position_change', 'none'],
  neuro: ['radiating_below_knee', 'radiating_above_knee', 'numbness', 'weakness', 'claudication', 'none'],
  history: ['cancer', 'steroid', 'osteoporosis', 'dvt', 'spine_surgery', 'disc_herniation', 'fracture', 'diabetes', 'infection_recent', 'none'],
  special: ['pregnancy', 'postpartum', 'elderly', 'minor', 'athlete', 'none'],
  sys: ['fever', 'weight_loss', 'night_pain', 'rest_pain', 'bladder_bowel', 'saddle_anesthesia', 'abdominal_pulsatile', 'malaise', 'progressive_weakness', 'none'],
  work: ['desk', 'standing_work', 'heavy_labor', 'driving_long', 'childcare', 'none'],
};

export const FIELD_TYPES = ['single', 'multi', 'scale', 'bool'];

/** 'aggr:flexion' → { group:'aggr', value:'flexion' } */
export function parseTag(tag) {
  const i = String(tag).indexOf(':');
  if (i < 0) return { group: '', value: String(tag) };
  return { group: tag.slice(0, i), value: tag.slice(i + 1) };
}

export function isKnownTag(tag) {
  const { group, value } = parseTag(tag);
  const list = TAG_VOCABULARY[group];
  return Array.isArray(list) && list.includes(value);
}

/**
 * 症状モジュールの自己検査。開発時／テストで使う（本番UIでは呼ばない）。
 * 返り値は問題点の配列（空なら健全）。
 */
export function validateSymptom(symptom) {
  const errors = [];
  const push = (msg) => errors.push(msg);
  if (!symptom || typeof symptom !== 'object') return ['症状モジュールがオブジェクトではありません'];
  for (const key of ['id', 'name', 'version']) {
    if (symptom[key] === undefined) push(`必須プロパティ ${key} がありません`);
  }
  const fieldIds = new Set();
  for (const f of symptom.fields || []) {
    if (!f.id) push('field に id がありません');
    if (fieldIds.has(f.id)) push(`field id が重複: ${f.id}`);
    fieldIds.add(f.id);
    if (!FIELD_TYPES.includes(f.type)) push(`field ${f.id}: 未知の type「${f.type}」`);
    if (f.type === 'scale') {
      if (typeof f.min !== 'number' || typeof f.max !== 'number') push(`field ${f.id}: scale には min/max が必要`);
    } else {
      if (!Array.isArray(f.options) || f.options.length === 0) push(`field ${f.id}: options が空`);
      const values = new Set();
      for (const o of f.options || []) {
        if (values.has(o.value)) push(`field ${f.id}: option value 重複「${o.value}」`);
        values.add(o.value);
        for (const t of o.tags || []) {
          if (!isKnownTag(t)) push(`field ${f.id} / ${o.value}: 未知のタグ「${t}」`);
        }
      }
    }
  }
  const patternIds = new Set();
  for (const p of symptom.patterns || []) {
    if (patternIds.has(p.id)) push(`pattern id が重複: ${p.id}`);
    patternIds.add(p.id);
    if (!p.name) push(`pattern ${p.id}: name がありません`);
    for (const rule of [...(p.evidence || []), ...(p.against || [])]) {
      if (!Array.isArray(rule.tags) || rule.tags.length === 0) push(`pattern ${p.id}: rule の tags が空`);
      for (const t of rule.tags || []) {
        if (!isKnownTag(t)) push(`pattern ${p.id}: 未知のタグ「${t}」`);
      }
      if (typeof rule.weight !== 'number') push(`pattern ${p.id}: rule の weight が数値ではありません`);
    }
  }
  const flagIds = new Set();
  for (const rf of symptom.redFlags || []) {
    if (flagIds.has(rf.id)) push(`redFlag id が重複: ${rf.id}`);
    flagIds.add(rf.id);
    if (!['emergency', 'urgent', 'caution'].includes(rf.severity)) push(`redFlag ${rf.id}: 未知の severity「${rf.severity}」`);
    for (const t of rf.tags || []) {
      if (!isKnownTag(t)) push(`redFlag ${rf.id}: 未知のタグ「${t}」`);
    }
  }
  return errors;
}
