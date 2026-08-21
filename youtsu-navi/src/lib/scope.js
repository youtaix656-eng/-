// 資格別の業務範囲による出し分け — 企画書 改善策 #4
//
// 施術方針カード（approach）は modality を宣言している。設定で選んだ資格の
// allowed に含まれていなければ「範囲外」として警告し、既定では折りたたむ。
//
// ※ここでの判定は一般的な整理であり、実務上の可否は通知・自治体・保険者の
//   解釈によって異なる（すべて ※要確認）。最終判断は施術者本人が行う。

import { LICENSE_MAP, MODALITIES } from '../data/licenses.js';

/** 資格を持っていても、実施にあたって注意が要る手段への注記 */
const CAUTION_NOTES = {
  seitai: {
    manual: 'あん摩・マッサージ・指圧にあたる行為は無免許では行えません（※要確認：手技の呼称ではなく実質で判断されます）。リラクゼーション目的の範囲を超えないよう注意してください。',
    exercise: '運動指導は可能ですが、「治療」「矯正」など医行為と誤認される説明は避けてください。',
  },
  judo: {
    manual: '慢性の腰痛への手技は療養費の対象外（自費）になる場合があります（※要確認）。',
  },
  shinkyu: {
    acupuncture: '感染対策（single use・清潔操作）とリスク部位の把握を前提にしてください。',
    moxa: '熱傷リスク。感覚鈍麻・糖尿病・高齢の方には特に慎重に。',
  },
  anma: {
    physical: '温熱・寒冷の使用は熱傷・凍傷に注意してください。',
  },
};

export const STATUS = {
  ok: { key: 'ok', label: '範囲内' },
  caution: { key: 'caution', label: '注意' },
  out: { key: 'out', label: '業務範囲外の可能性' },
};

/** approach 1件について、選択中の資格から見た可否を判定する */
export function evaluateApproach(approach, licenseId) {
  const license = LICENSE_MAP[licenseId];
  const modality = approach.modality;
  const modalityLabel = MODALITIES[modality] || modality;
  if (!license) {
    return { status: 'caution', note: '資格が未設定です。設定画面から選択すると、業務範囲に応じた警告が出せます。', modalityLabel };
  }
  if (!license.allowed.includes(modality)) {
    return {
      status: 'out',
      note: `${license.name}の業務範囲には「${modalityLabel}」は含まれない整理です（※要確認）。該当免許を併せて保有している場合を除き、実施しないでください。`,
      modalityLabel,
    };
  }
  const note = (CAUTION_NOTES[licenseId] || {})[modality];
  if (note) return { status: 'caution', note, modalityLabel };
  return { status: 'ok', note: '', modalityLabel };
}

/** 施術方針の配列に判定結果を付けて返す（範囲外も情報としては残す） */
export function annotateApproaches(approaches = [], licenseId) {
  return approaches.map((a) => ({ ...a, scope: evaluateApproach(a, licenseId) }));
}

export function splitByScope(approaches = [], licenseId) {
  const annotated = annotateApproaches(approaches, licenseId);
  return {
    inScope: annotated.filter((a) => a.scope.status !== 'out'),
    outOfScope: annotated.filter((a) => a.scope.status === 'out'),
  };
}

export { MODALITIES };
