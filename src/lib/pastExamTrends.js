// 鍼灸過去問題の傾向分析 — 「感覚」ではなく、収録済みの過去問データ（round・tags・genre）を
// 実際に集計して頻出テーマ・頻出キーワードを導く。Home.jsx の「鍼灸過去問題の傾向と対策」から使う。
//
// 過去問1問ごとに「原問×1＋一問一答×4」で教材化する方針上、原問（round が設定されている問題）
// だけを集計対象にする。一問一答の派生問題は round を持たないため、実際の出題回数を
// 水増ししない（＝「同じ過去問から4問作った」ことと「4回出題された」ことを混同しない）。

import { effectiveTags } from './query.js';
import { roundKey } from './round.js';
import { normalize, MASTER_STREAK } from './srs.js';

// 医療概論だけは genre（出題基準カテゴリ）を持たない設計（過去の変更でtagsへ折り込み済み。
// 音声学習のジャンル検索でも医療概論だけ q.genre を使わない、というCLAUDE.md記載の仕様と同じ線）。
// そのため genreFrequency 等の「頻出ジャンル」集計から医療概論だけが丸ごと抜け落ちていた
// （Aランク○率の判定にも使われるため、医療概論の問題が一度もAランク判定に入らない状態だった）。
// tags には元々「大項目」「中項目」の名称がキーワードと一緒に含まれているので、
// データファイルを変更せず、既知の出題基準（examScope.jsのoutline）と照合して
// tags から大項目｜中項目を復元する。復元できない場合は今までどおり集計対象から外す
// （当てずっぽうな分類はしない）。
const IRYOU_OUTLINE = {
  '現代の医療と社会': ['医療と社会', '医療従事者', '医療・福祉施設', '医療経済'],
  '社会保障制度': ['医療保険のしくみ', '公費負担医療', '介護サービス行政'],
  '医療倫理': ['医療の倫理', '医療倫理教育', '施術者としての倫理'],
};
function iryouGenreFromTags(tags) {
  const set = new Set(tags || []);
  for (const [dai, mids] of Object.entries(IRYOU_OUTLINE)) {
    if (!set.has(dai)) continue;
    const mid = mids.find((m) => set.has(m));
    if (mid) return `${dai}｜${mid}`;
  }
  return null;
}
// 問題1件のジャンル（大項目｜中項目）。genreがあればそのまま、無くて医療概論ならtagsから復元する。
export function genreOf(q) {
  if (q.genre) return q.genre;
  if (q.subject === '医療概論') return iryouGenreFromTags(q.tags);
  return null;
}

export function pastExamQuestions(questions) {
  return questions.filter((q) => q.round != null);
}

// 収録概況：総数・対象科目数・対象になっている回の一覧（新しい順）
export function overview(questions) {
  const past = pastExamQuestions(questions);
  const subjects = new Set(past.map((q) => q.subject).filter(Boolean));
  const rounds = Array.from(new Set(past.map((q) => roundKey(q.round)).filter(Boolean))).sort(
    (a, b) => Number(b) - Number(a)
  );
  return { total: past.length, subjectCount: subjects.size, rounds };
}

// 科目別の収録数
export function subjectBreakdown(questions) {
  const past = pastExamQuestions(questions);
  const map = new Map();
  for (const q of past) {
    const s = q.subject || 'その他';
    if (!map.has(s)) map.set(s, 0);
    map.set(s, map.get(s) + 1);
  }
  return Array.from(map.entries())
    .map(([subject, count]) => ({ subject, count }))
    .sort((a, b) => b.count - a.count);
}

// 頻出ジャンル（大項目｜中項目）：同じジャンルが複数の回にわたって出題されているほど
// 「頻出テーマ」として優先度が高いとみなす（roundsフィールドで実際の出題回を確認できる）。
export function genreFrequency(questions, { limit = 15, subject = null } = {}) {
  const past = pastExamQuestions(questions).filter((q) => !subject || q.subject === subject);
  const map = new Map(); // key: subject|genre -> { subject, genre, count, rounds:Set, questionIds:[] }
  for (const q of past) {
    const genre = genreOf(q);
    if (!genre) continue;
    const key = `${q.subject}|${genre}`;
    if (!map.has(key)) map.set(key, { subject: q.subject, genre, count: 0, rounds: new Set(), questionIds: [] });
    const entry = map.get(key);
    entry.count += 1;
    const rk = roundKey(q.round);
    if (rk) entry.rounds.add(rk);
    entry.questionIds.push(q.id);
  }
  return Array.from(map.values())
    .map((e) => ({
      subject: e.subject,
      genre: e.genre,
      count: e.count,
      roundCount: e.rounds.size,
      rounds: Array.from(e.rounds).sort((a, b) => Number(b) - Number(a)),
      questionIds: e.questionIds,
    }))
    .sort((a, b) => b.roundCount - a.roundCount || b.count - a.count)
    .slice(0, limit);
}

// 頻出キーワード（tags∪連結キーワード）：複数の回にまたがって登場するタグほど優先度が高い。
export function tagFrequency(questions, links, { limit = 20, subject = null } = {}) {
  const past = pastExamQuestions(questions).filter((q) => !subject || q.subject === subject);
  const map = new Map(); // tag -> { tag, count, rounds:Set, questionIds:[] }
  for (const q of past) {
    const rk = roundKey(q.round);
    for (const tag of effectiveTags(q, links)) {
      if (!map.has(tag)) map.set(tag, { tag, count: 0, rounds: new Set(), questionIds: [] });
      const entry = map.get(tag);
      entry.count += 1;
      if (rk) entry.rounds.add(rk);
      entry.questionIds.push(q.id);
    }
  }
  return Array.from(map.values())
    .map((e) => ({ tag: e.tag, count: e.count, roundCount: e.rounds.size, rounds: Array.from(e.rounds).sort((a, b) => Number(b) - Number(a)), questionIds: e.questionIds }))
    .sort((a, b) => b.roundCount - a.roundCount || b.count - a.count)
    .slice(0, limit);
}

// 科目ごとの「頻出度スコア」：頻出ジャンル上位の合計出題回数を科目別に集計し、
// どの科目が特に「繰り返し同じテーマが出る＝対策の費用対効果が高い」かを見る目安にする。
export function subjectPriority(questions, { limit = 8 } = {}) {
  const genres = genreFrequency(questions, { limit: 9999 });
  const map = new Map();
  for (const g of genres) {
    if (g.roundCount < 2) continue; // 複数回出ているテーマのみを「頻出」とみなす
    if (!map.has(g.subject)) map.set(g.subject, { subject: g.subject, repeatedGenreCount: 0, topGenres: [] });
    const entry = map.get(g.subject);
    entry.repeatedGenreCount += 1;
    if (entry.topGenres.length < 3) entry.topGenres.push(g.genre);
  }
  return Array.from(map.values())
    .sort((a, b) => b.repeatedGenreCount - a.repeatedGenreCount)
    .slice(0, limit);
}

// A/B/Cランク（頻出度による優先度ラベル）の定義。
// 「同じジャンルが何回の過去問にまたがって出ているか」を、そのままランクの基準に使う
// （genreFrequencyのroundCountと同じ物差し。手元に無い「配点」の推定はしない）。
export const RANK_DEFS = [
  { id: 'A', label: 'Aランク（3回以上出題）', hint: '絶対に落とせないテーマ' },
  { id: 'B', label: 'Bランク（2回出題）', hint: 'できれば押さえたいテーマ' },
  { id: 'C', label: 'Cランク（1回のみ出題）', hint: '余裕があれば手を伸ばすテーマ' },
];

function rankIdFor(roundCount) {
  if (roundCount >= 3) return 'A';
  if (roundCount === 2) return 'B';
  return 'C';
}

// A/B/Cランク別の内訳＋達成率（○率＝現在マスター済みの割合）。
// ジャンルが無い過去問（genre未設定）はランク付けの対象外にする（曖昧な推測をしないため）。
export function rankBreakdown(questions, srs, { subject = null } = {}) {
  const genres = genreFrequency(questions, { limit: 9999, subject });
  const buckets = { A: new Set(), B: new Set(), C: new Set() };
  for (const g of genres) {
    const rid = rankIdFor(g.roundCount);
    for (const id of g.questionIds) buckets[rid].add(id);
  }
  return RANK_DEFS.map((def) => {
    const ids = buckets[def.id];
    const total = ids.size;
    let mastered = 0;
    for (const id of ids) {
      if ((normalize((srs || {})[id]).correctStreak || 0) >= MASTER_STREAK) mastered += 1;
    }
    return { ...def, total, mastered, rate: total > 0 ? mastered / total : null, questionIds: Array.from(ids) };
  });
}
