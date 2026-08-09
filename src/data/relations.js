// 概念間の型付き関係（#3）— 作り手が意図的に結ぶ知識のつながり（種）。
//   { from, to, type }。type は relations.js の RELATION_TYPES。随時追加していく。
//   from/to は正式名称（概念ID）で書く。

const RELATIONS = [
  // 対比（まぎらわしい）
  { from: '痛風', to: '偽痛風', type: 'contrast' },
  { from: '変形性関節症', to: '関節リウマチ', type: 'contrast' },
  { from: '神経根症', to: '脊髄症', type: 'contrast' },
  { from: '1型糖尿病', to: '2型糖尿病', type: 'contrast' },
  { from: '左心不全', to: '右心不全', type: 'contrast' },
  { from: '甲状腺機能亢進症', to: '甲状腺機能低下症', type: 'contrast' },
  // 原因→結果
  { from: 'ピロリン酸カルシウム', to: '偽痛風', type: 'causes' },
  { from: '尿酸', to: '痛風', type: 'causes' },
  { from: '発育性股関節形成不全', to: '変形性股関節症', type: 'causes' },
  { from: '黄色靱帯', to: '脊柱管狭窄症', type: 'causes' },
  // 治療・適応
  { from: 'ビタミンD', to: 'くる病', type: 'treats' },
  // 部位・位置
  { from: '痛風', to: '第一中足趾節関節', type: 'locatedAt' },
  { from: '偽痛風', to: '膝関節', type: 'locatedAt' },
];

export default RELATIONS;
