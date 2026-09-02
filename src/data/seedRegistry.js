// 収録データバンクの一覧と版番号（マイグレーション／版管理の単一ソース）。
//   起動時のシード投入は useStore.js が各 *_VERSION フラグで管理している。
//   ここはその全体像を1か所に集約し、CI（validate-content）やレポートで参照する。
//   新しい科目バンクを足したら、ここにも1行追加する。

import sampleQuestions from './sampleQuestions.js';
import iryouQuestions from './iryouQuestions.js';
import eiseiQuestions, { EISEI_VERSION } from './eiseiQuestions.js';
import houkiQuestions, { HOUKI_VERSION } from './houkiQuestions.js';
import anatQuestions, { ANAT_VERSION } from './anatQuestions.js';
import seiriQuestions, { SEIRI_VERSION } from './seiriQuestions.js';
import rinshoQuestions, { RINSHO_VERSION } from './rinshoQuestions.js';
import rinkakuQuestions, { RINKAKU_VERSION } from './rinkakuQuestions.js';
import zumondaiQuestions, { ZUMONDAI_VERSION } from './zumondaiQuestions.js';
import byoriQuestions, { BYORI_VERSION } from './byoriQuestions.js';
import rihaQuestions, { RIHA_VERSION } from './rihaQuestions.js';
import toyoQuestions, { TOYO_VERSION } from './toyoQuestions.js';
import keizetsuQuestions, { KEIRAKU_VERSION } from './keizetsuQuestions.js';
import torinQuestions, { TORIN_VERSION } from './torinQuestions.js';
import hariQuestions, { HARI_VERSION } from './hariQuestions.js';
import kyuQuestions, { KYU_VERSION } from './kyuQuestions.js';

// name: 表示名 / questions: データ / version: シード版（null=版管理なし）/ flag: cfg 上のフラグ名
export const SEED_BANKS = [
  { name: 'サンプル', questions: sampleQuestions, version: null, flag: null },
  { name: '医療概論（同梱）', questions: iryouQuestions, version: null, flag: 'iryouSeeded' },
  { name: '衛生学・公衆衛生学', questions: eiseiQuestions, version: EISEI_VERSION, flag: 'eiseiVersion' },
  { name: '関係法規', questions: houkiQuestions, version: HOUKI_VERSION, flag: 'houkiVersion' },
  { name: '解剖学', questions: anatQuestions, version: ANAT_VERSION, flag: 'anatVersion' },
  { name: '生理学', questions: seiriQuestions, version: SEIRI_VERSION, flag: 'seiriVersion' },
  { name: '病理学概論', questions: byoriQuestions, version: BYORI_VERSION, flag: 'byoriVersion' },
  { name: '臨床医学総論', questions: rinshoQuestions, version: RINSHO_VERSION, flag: 'rinshoVersion' },
  { name: '臨床医学各論', questions: rinkakuQuestions, version: RINKAKU_VERSION, flag: 'rinkakuVersion' },
  { name: 'リハビリテーション医学', questions: rihaQuestions, version: RIHA_VERSION, flag: 'rihaVersion' },
  { name: '東洋医学概論', questions: toyoQuestions, version: TOYO_VERSION, flag: 'toyoVersion' },
  { name: '経絡経穴概論', questions: keizetsuQuestions, version: KEIRAKU_VERSION, flag: 'keirakuVersion' },
  { name: '東洋医学臨床論', questions: torinQuestions, version: TORIN_VERSION, flag: 'torinVersion' },
  { name: 'はり理論', questions: hariQuestions, version: HARI_VERSION, flag: 'hariVersion' },
  { name: 'きゅう理論', questions: kyuQuestions, version: KYU_VERSION, flag: 'kyuVersion' },
  { name: '図問題', questions: zumondaiQuestions, version: ZUMONDAI_VERSION, flag: 'zumondaiVersion' },
];

// シード対象の全問題を1本に連結（サンプルはフォールバック用途なので除く）。
export function allSeedQuestions() {
  return SEED_BANKS.filter((b) => b.flag).flatMap((b) => b.questions);
}
