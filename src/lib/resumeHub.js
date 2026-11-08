// アプリを開いた時に「前回の続きから」を1機能だけ、4項目（①科目名・②ジャンル名・
// ③キーワード名・④残り◯問）で確認するダイアログ（App.jsx）向けの単一の正。
// 学習(10・60・300・900)（store.session）・一問一答（quizProgress）・模試（examProgress）・
// 復習（reviewProgress）・音声学習×連結学習（audioProgress）の5つの保存済み進捗から、
// 最後に触れていた（タイムスタンプが最も新しい）ものを1つだけ選ぶ。
//
// 科目名・ジャンル名・キーワード名は、音声学習だけは実際に選んでいた検索条件
// （filterSubject/filterGenre/filterKeyword）をそのまま使う。残り4つ（学習・一問一答・
// 模試・復習）はその情報を保存していないため（模試は科目配分の出題のため単一科目の概念が
// 無く、学習・一問一答もsession.subject/p.subjectが「all」の場合は特定の科目名にならない）、
// 代わりに「次に出る問題」自体のsubject/genre/tagsから持つ（実在する次の問題の正式な科目名
// ＝`examScope.js`のSUBJECT_TAG_NAMESと同じ表記であり、作り話にはならない）。
// いずれも無ければ「なし」と正直に返す（呼び出し側が表示）。

export const RESUME_FEATURES = {
  session: { view: 'session', title: '学習(10・60・300・900)' },
  quiz: { view: 'quiz', title: '一問一答' },
  exam: { view: 'exam', title: '模試' },
  review: { view: 'review', title: '復習' },
  audio: { view: 'audio', title: '音声学習×連結学習' },
};

function questionInfo(questions, id) {
  const q = (questions || []).find((x) => x && x.id === id);
  if (!q) return { subject: null, genre: null, keyword: null };
  const subject = q.subject || null;
  const genre = q.genre || null;
  const keyword = (Array.isArray(q.tags) && q.tags.length > 0 && q.tags[0]) || null;
  return { subject, genre, keyword };
}

function sessionCandidate(session, questions) {
  if (!session || !Array.isArray(session.ids) || session.ids.length === 0) return null;
  if (!(typeof session.pos === 'number' && typeof session.target === 'number')) return null;
  if (!(session.pos < session.target)) return null; // 完了済み（行き止まり）は対象外
  const remaining = session.target - session.pos;
  if (remaining <= 0) return null;
  const nextId = session.ids[Math.min(session.pos, session.ids.length - 1)];
  const { subject, genre, keyword } = questionInfo(questions, nextId);
  return { key: 'session', ...RESUME_FEATURES.session, subject, genre, keyword, remaining, at: session.startedAt || 0 };
}

function quizCandidate(p, questions) {
  if (!p || !Array.isArray(p.ids) || p.ids.length === 0) return null;
  const idx = p.idx || 0;
  if (idx >= p.ids.length) return null;
  const remaining = p.ids.length - idx;
  const { subject, genre, keyword } = questionInfo(questions, p.ids[idx]);
  return { key: 'quiz', ...RESUME_FEATURES.quiz, subject, genre, keyword, remaining, at: p.at || 0 };
}

function examCandidate(p, questions) {
  if (!p || !Array.isArray(p.ids) || p.ids.length === 0) return null;
  // 午前+午後 通しモードの午後フェーズ中は、保存されているidsが午後の90問だけなので
  // 午前ぶん（amSnapshot）を足して180問中の通算位置を出す（Home.jsxの既存ロジックと同じ）。
  const amDone = p.fullPhase === 'pm' && p.amSnapshot?.order?.length ? p.amSnapshot.order.length : 0;
  const idx = (p.idx || 0) + amDone;
  const len = p.ids.length + amDone;
  if (idx >= len) return null;
  const remaining = len - idx;
  const { subject, genre, keyword } = questionInfo(questions, p.ids[p.idx || 0]);
  return { key: 'exam', ...RESUME_FEATURES.exam, subject, genre, keyword, remaining, at: p.at || 0 };
}

function reviewCandidate(p, questions) {
  if (!p || !Array.isArray(p.ids) || p.ids.length === 0) return null;
  const idx = p.idx || 0;
  if (idx >= p.ids.length) return null;
  const remaining = p.ids.length - idx;
  const { subject, genre, keyword } = questionInfo(questions, p.ids[idx]);
  return { key: 'review', ...RESUME_FEATURES.review, subject, genre, keyword, remaining, at: p.at || 0 };
}

function audioCandidate(p) {
  if (!p || typeof p.index !== 'number' || typeof p.total !== 'number' || p.total <= 0) return null;
  const remaining = p.total - p.index;
  if (remaining <= 0) return null;
  return {
    key: 'audio', ...RESUME_FEATURES.audio,
    subject: p.subject || null, genre: p.genre || null, keyword: p.keyword || null,
    remaining, at: p.at || 0, round: p.round || null,
  };
}

// session: store.session／quizProgress・examProgress・reviewProgress・audioProgress:
// それぞれstorage.jsのloadQuizProgress/loadExamProgress/loadReviewProgress/loadAudioProgressの戻り値。
export function pickTopResumeCandidate({ session, quizProgress, examProgress, reviewProgress, audioProgress, questions }) {
  const candidates = [
    sessionCandidate(session, questions),
    quizCandidate(quizProgress, questions),
    examCandidate(examProgress, questions),
    reviewCandidate(reviewProgress, questions),
    audioCandidate(audioProgress),
  ].filter(Boolean);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (b.at || 0) - (a.at || 0));
  return candidates[0];
}
