// 鍼灸国家試験（はり師・きゅう師）の出題範囲（試験科目）
//
// 全13科目。午前＝専門基礎科目（西洋医学・関係法規など）、
// 午後＝専門科目（東洋医学・各理論）に大別される。
//
// ⚠️ 問題数・配点・合格点・時間割は年度により変わります。最新の正式情報は
//    運営団体「公益財団法人 東洋療法研修試験財団」の公式発表でご確認ください。
//
// 出典: 厚生労働省 はり師・きゅう師国家試験 実施要項 ／
//       公益財団法人 東洋療法研修試験財団 公式情報

export const EXAM_SESSIONS = {
  am: { id: 'am', label: '午前', note: '専門基礎科目（西洋医学・関係法規 など）' },
  pm: { id: 'pm', label: '午後', note: '専門科目（東洋医学・各理論）' },
};

// 各科目: session（午前/午後）, category, aliases（アプリ内の科目名の揺れを吸収）
export const EXAM_SUBJECTS = [
  // ---- 午前：専門基礎科目 ----
  {
    id: 'iryou',
    name: '医療概論',
    note: '医学史を除く',
    session: 'am',
    category: '専門基礎',
    // 国家試験出題基準（大項目→中項目）。出典：徹底攻略！はり師きゅう師用 医療概論 p.2〜11。
    outline: [
      {
        no: '1',
        title: '現代の医療と社会',
        items: [
          { mark: 'A', name: '医療と社会' },
          { mark: 'B', name: '医療従事者' },
          { mark: 'C', name: '医療・福祉施設' },
          { mark: 'D', name: '医療経済' },
        ],
      },
      {
        no: '2',
        title: '社会保障制度',
        items: [
          { mark: 'A', name: '医療保険のしくみ' },
          { mark: 'B', name: '公費負担医療' },
          { mark: 'C', name: '介護サービス行政' },
        ],
      },
      {
        no: '3',
        title: '医療倫理',
        items: [
          { mark: 'A', name: '医療の倫理', note: '出題なし' },
          { mark: 'B', name: '医療倫理教育', note: '医療者と患者および社会の倫理' },
          { mark: 'C', name: '施術者としての倫理' },
        ],
      },
    ],
  },
  { id: 'eisei', name: '衛生学・公衆衛生学', session: 'am', category: '専門基礎' },
  { id: 'houki', name: '関係法規', session: 'am', category: '専門基礎' },
  { id: 'kaibou', name: '解剖学', session: 'am', category: '専門基礎' },
  { id: 'seiri', name: '生理学', session: 'am', category: '専門基礎' },
  { id: 'byori', name: '病理学概論', session: 'am', category: '専門基礎', aliases: ['病理学'] },
  { id: 'rinshou_sou', name: '臨床医学総論', session: 'am', category: '専門基礎' },
  { id: 'rinshou_kaku', name: '臨床医学各論', session: 'am', category: '専門基礎' },
  { id: 'reha', name: 'リハビリテーション医学', session: 'am', category: '専門基礎' },
  // ---- 午後：専門科目 ----
  { id: 'toyo_gairon', name: '東洋医学概論', session: 'pm', category: '専門' },
  { id: 'keiraku', name: '経絡経穴概論', session: 'pm', category: '専門' },
  { id: 'toyo_rinshou', name: '東洋医学臨床論', session: 'pm', category: '専門' },
  {
    id: 'hari_kyu',
    name: 'はり理論 または きゅう理論',
    note: '受験資格に応じて選択',
    session: 'pm',
    category: '専門',
    aliases: ['はり理論', 'きゅう理論', 'はりきゅう理論', 'はり・きゅう理論'],
  },
];

// 合格基準（例年、総得点の約60%）。正確な点数は年度により異なる。
export const EXAM_INFO = {
  totalSubjects: 13,
  passRate: 0.6, // 合格ライン（総得点の約6割）
  passNote: '合格基準は例年おおむね総得点の60%（例：170点満点中102点）。年度により問題数・合格点は変動します。',
  format: '午前・午後の筆記（マークシート方式）',
  source: '厚生労働省 実施要項／公益財団法人 東洋療法研修試験財団',
};

// 音声学習・タグ用の科目タグ一覧（はり理論・きゅう理論は分割して扱う）
export const SUBJECT_TAG_NAMES = [
  '医療概論',
  '衛生学・公衆衛生学',
  '関係法規',
  '解剖学',
  '生理学',
  '病理学概論',
  '臨床医学総論',
  '臨床医学各論',
  'リハビリテーション医学',
  '東洋医学概論',
  '経絡経穴概論',
  '東洋医学臨床論',
  'はり理論',
  'きゅう理論',
];

// 科目名の一致判定（アプリ内の科目名の揺れを吸収）
function normalizeName(s) {
  return String(s || '').replace(/\s+/g, '').replace(/[・･]/g, '').toLowerCase();
}

// 問題の科目文字列から、付与すべき「科目タグ」を返す（該当なしは null）
export function subjectTagFor(subject) {
  const s = String(subject || '').trim();
  if (!s) return null;
  if (SUBJECT_TAG_NAMES.includes(s)) return s;
  const n = normalizeName(s);
  if (n.includes('はり') || n.includes('鍼')) return 'はり理論';
  if (n.includes('きゅう') || n.includes('灸')) return 'きゅう理論';
  const hit = SUBJECT_TAG_NAMES.find((name) => {
    const nn = normalizeName(name);
    return n === nn || n.includes(nn) || nn.includes(n);
  });
  return hit || null;
}
export function subjectMatches(questionSubject, examSubject) {
  const q = normalizeName(questionSubject);
  if (!q) return false;
  const names = [examSubject.name, ...(examSubject.aliases || [])].map(normalizeName);
  return names.some((n) => q === n || q.includes(n) || n.includes(q));
}

// 各試験科目について、アプリ内の収録数・正解数・正答率を集計
export function scopeCoverage(questions, history) {
  // 履歴を questionId → question にひも付けるため、まず question の subject を引く
  const qById = Object.fromEntries(questions.map((x) => [x.id, x]));
  return EXAM_SUBJECTS.map((subj) => {
    const inBank = questions.filter((x) => subjectMatches(x.subject, subj));
    const bankIds = new Set(inBank.map((x) => x.id));
    let answered = 0;
    let correct = 0;
    history.forEach((h) => {
      const belongs = bankIds.has(h.questionId) ||
        (qById[h.questionId] == null && subjectMatches(h.subject, subj));
      if (belongs) {
        answered += 1;
        if (h.correct) correct += 1;
      }
    });
    return {
      subject: subj,
      count: inBank.length,
      answered,
      correct,
      accuracy: answered > 0 ? correct / answered : null,
    };
  });
}
