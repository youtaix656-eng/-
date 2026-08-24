// 語呂合わせ一覧の組み立て（MnemonicNotebook.jsx・MnemonicQuiz.jsxで共用）。
//   kwMeta（keyword→{mnemonic, reading, subject}）から、実際に語呂合わせ本文が
//   登録されているものだけを抽出し、関連問題・科目を付与する。
//   ここでの定義がずれないよう、この関数を単一のソースとする。

import { clustersMap } from './audioplan.js';
import { TERM_READINGS } from './yomi.js';

export function buildMnemonicEntries(kwMeta, questions, links) {
  const clusters = clustersMap(questions, links);
  return Object.entries(kwMeta || {})
    .filter(([, v]) => v && v.mnemonic && v.mnemonic.trim())
    .map(([keyword, v]) => {
      const qs = clusters.get(keyword) || [];
      const reading = (v.reading && v.reading.trim()) || TERM_READINGS[keyword] || '';
      const subjects = new Set(qs.map((q) => q.subject).filter(Boolean));
      if (v.subject) subjects.add(v.subject);
      return {
        keyword,
        mnemonic: v.mnemonic,
        reading,
        count: qs.length,
        subjects: [...subjects],
      };
    })
    .sort((a, b) => a.keyword.localeCompare(b.keyword, 'ja'));
}
