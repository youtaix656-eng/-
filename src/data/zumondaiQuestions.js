// 図問題（#2）のサンプル。図（figureキー）を見て答える四択。
// figure は src/data/figures.js のキー。起動時に ZUMONDAI_VERSION で増分反映。
export const ZUMONDAI_VERSION = 1;

const zumondaiQuestions = [
  {
    id: 'zu-spine-b',
    subject: '解剖学',
    type: 'choice',
    figure: 'spine',
    genre: '運動器系｜脊柱',
    question: '図のBが示す部位（胸椎）の椎骨の数はどれか。',
    choices: ['7個', '12個', '5個', '1個'],
    answer: 1,
    explanation:
      '脊柱は上（頭側）から頸椎7・胸椎12・腰椎5・仙椎5（癒合して仙骨）・尾椎3〜5。Bは胸椎で12個。胸椎は肋骨と関節をつくる。',
    tags: ['脊柱', '胸椎', '椎骨', '図問題'],
    deck: '図問題',
  },
  {
    id: 'zu-spine-a',
    subject: '解剖学',
    type: 'choice',
    figure: 'spine',
    genre: '運動器系｜脊柱',
    question: '図のAが示す部位（頸椎）の椎骨の数はどれか。',
    choices: ['5個', '7個', '12個', '8個'],
    answer: 1,
    explanation:
      'Aは最上部の頸椎で椎骨は7個。ただし頸神経は8対（椎骨より1対多い）で、数の取り違えに注意。',
    tags: ['脊柱', '頸椎', '椎骨', '頸神経', '図問題'],
    deck: '図問題',
  },
  {
    id: 'zu-heart-ventricle',
    subject: '解剖学',
    type: 'choice',
    figure: 'heart',
    genre: '循環器系｜心臓',
    question: '図のウ・エのように、心臓の下方にある部屋を何というか。',
    choices: ['心房', '心室', '心耳', '心尖'],
    answer: 1,
    explanation:
      '心臓は上方に左右の心房、下方に左右の心室がある。心室は血液を送り出すポンプで、壁は心房より厚い（特に左心室）。',
    tags: ['心臓', '心室', '心房', '図問題'],
    deck: '図問題',
  },
  {
    id: 'zu-hand-goukoku',
    subject: '経絡経穴概論',
    type: 'choice',
    figure: 'hand-goukoku',
    genre: '要穴｜四総穴',
    question: '図に●で示す、第1・第2中手骨間のくぼみにある経穴はどれか。',
    choices: ['合谷', '曲池', '太淵', '陽渓'],
    answer: 0,
    explanation:
      '合谷（手陽明大腸経の原穴）は第1・第2中手骨間、第2中手骨中点の橈側。四総穴では「面口は合谷」。頭・顔・口の症状に用いる。',
    tags: ['合谷', '大腸経', '原穴', '四総穴', '図問題'],
    deck: '図問題',
  },
  {
    id: 'zu-leg-sanri',
    subject: '経絡経穴概論',
    type: 'choice',
    figure: 'leg-sanri',
    genre: '要穴｜四総穴',
    question: '図に●で示す、犢鼻（膝眼）の下・脛骨稜の外方にある経穴はどれか。',
    choices: ['陰陵泉', '足三里', '陽陵泉', '三陰交'],
    answer: 1,
    explanation:
      '足三里（足陽明胃経）は犢鼻の下3寸、脛骨稜の外方1寸、前脛骨筋上。四総穴では「肚腹は足三里」。胃腸症状の要穴。',
    tags: ['足三里', '胃経', '四総穴', '図問題'],
    deck: '図問題',
  },
];

export default zumondaiQuestions;
