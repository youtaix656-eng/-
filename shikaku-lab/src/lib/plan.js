// 学習計画書の組み立て。**書き写さない**——すべて他のデータから導く。
//
// 決めていること:
// 1. **「合格に必要な時間」を書かない。** 書けるのは「確保できる時間」だけ
//    （手元に無い基準を持たない。schedule.js と同じ線）。
// 2. **答えていないことを埋めない。** 認知特性が未回答なら「未回答」と書く。
//    埋めると、答えたつもりになって二度と見直さない。
// 3. **確かめていないことを確かめたように書かない。** 試験日・合格基準は
//    「公式サイトで確認してください」の一覧として出し、確認済みの印は人が付ける。
// 4. 計画書は Markdown で書き出せる。この文章がそのまま lib/spec.js の材料になる
//    （同じ内容を2か所に持たない）。

import { resolveExam } from './myExam.js';
import { checkPointsOf, traitLines, formatLines, TRAIT_VOCABULARY } from '../data/exams.js';
import { buildSchedule, allocateSubjects, tightOptions, PHASE_ORDER } from './schedule.js';
import { profileOf, profileLine, channelOf, orderOf, isUnanswered } from './cognitive.js';
import { suggestMethods, methodById, METHODS } from '../data/methods.js';
import { DEFAULT_ANGLES_BY_FORMAT, ANGLE_MAP } from './convert.js';

/**
 * 状態から計画のもとを作る。画面も設計書もこの1つの結果を見る。
 * @returns {Object} 足りないものは null / 空配列で返す（勝手に埋めない）
 */
export function buildPlan(state = {}) {
  const s = state.settings || {};
  const exam = resolveExam(s.examId, state.myExams || []);
  const schedule = buildSchedule({
    examDate: s.examDate,
    weekdayMin: s.weekdayMin,
    weekendMin: s.weekendMin,
    ratio: s.phaseRatio,
  });
  const profile = isUnanswered(state.cognitive) ? null : profileOf(state.cognitive);
  const channel = channelOf(profile);
  const order = orderOf(profile);
  const traits = exam?.traits || [];
  const suggestions = suggestMethods(traits, channel, order);

  // 選んでいる勉強法。未選択なら「提案の上位5つ」を仮置きするが、
  // **仮置きであることを必ず一緒に返す**（選んだことにしない）。
  const chosenIds = (s.chosenMethods || []).filter((id) => methodById(id));
  const usingSuggested = chosenIds.length === 0;
  const methods = (usingSuggested ? suggestions.slice(0, 5).map((m) => m.id) : chosenIds)
    .map((id) => methodById(id))
    .filter(Boolean);

  const subjects = exam?.subjects || [];
  const allocation = schedule ? allocateSubjects(schedule, subjects, s.subjectWeights || {}) : [];
  const angles = (s.angles && s.angles.length ? s.angles : DEFAULT_ANGLES_BY_FORMAT[exam?.formats?.[0]] || ['core'])
    .map((id) => ANGLE_MAP[id])
    .filter(Boolean);

  const checkPoints = checkPointsOf(exam).map((text) => ({
    text,
    done: Boolean((s.checkedPoints || {})[text]),
  }));

  return {
    exam,
    schedule,
    profile,
    profileText: profile ? profileLine(profile) : '未回答',
    channel,
    order,
    traits: traitLines(exam),
    formats: formatLines(exam),
    suggestions,
    methods,
    usingSuggested,
    subjects,
    allocation,
    angles,
    checkPoints,
    tight: schedule ? tightOptions(schedule, subjects.length) : [],
    questionCount: (state.questions || []).length,
    createdAt: Date.now(),
  };
}

/** 計画が「作れる状態」か。足りないものを日本語で返す（関門にはしない） */
export function planGaps(plan) {
  const gaps = [];
  if (!plan?.exam) gaps.push({ id: 'exam', text: '受ける試験がまだ選ばれていません', view: 'exams' });
  if (!plan?.schedule) gaps.push({ id: 'date', text: '試験日がまだ入っていません', view: 'plan' });
  else if (plan.schedule.totalMinutes === 0) gaps.push({ id: 'time', text: '1日に確保できる時間がまだ0分です', view: 'plan' });
  if (!plan?.profile) gaps.push({ id: 'cognitive', text: '認知特性はまだ答えていません（答えなくても進めます）', view: 'plan', optional: true });
  if (plan?.usingSuggested) gaps.push({ id: 'methods', text: '勉強法がまだ選ばれていません（今は提案の上位を仮置きしています）', view: 'plan', optional: true });
  return gaps;
}

/** 週の回し方。フェーズと選んだ勉強法から導く（別に持たない） */
export function weeklyShape(plan) {
  if (!plan?.schedule) return [];
  const ids = new Set((plan.methods || []).map((m) => m.id));
  const rows = [];
  rows.push({ day: '平日（毎日）', body: `${plan.schedule.weekdayMin}分：新しい単元を1つ ＋ 前日の間違いを思い出す` });
  if (ids.has('interleave')) {
    rows.push({ day: '週の半ば1日', body: 'その週にやった分野を**混ぜて**解く日（見分ける練習）' });
  }
  rows.push({ day: '休日', body: `${plan.schedule.weekendMin}分：まとまった演習 ＋ その週の積み残し` });
  if (ids.has('timedmock')) {
    rows.push({ day: '月に1回', body: '本番と同じ時間で通しで解く（解き直しは翌日）' });
  }
  if (ids.has('spacing')) {
    rows.push({ day: '週末', body: '3日前・1週間前にやった所へ短く戻る（読み返さず思い出す）' });
  }
  return rows;
}

/** 計画書の Markdown。**画面もこの関数の出力を見せる**（同じ本文を2か所に持たない） */
export function planMarkdown(plan, state = {}) {
  if (!plan) return '';
  const L = [];
  const exam = plan.exam;
  L.push(`# 学習計画書：${exam?.name || '（試験が未選択）'}`);
  L.push('');
  L.push(`作成日：${new Date(plan.createdAt).toLocaleDateString('ja-JP')}　／　作成：資格ラボ`);
  L.push('');
  L.push('> この計画書の数字は「確保できる時間」です。**合格に必要な時間ではありません**（人によって違いすぎるため、アプリ側では決めていません）。');
  L.push('');

  L.push('## 1. 受ける試験');
  if (exam) {
    L.push(`- 試験：**${exam.name}**${exam.body ? `（実施：${exam.body}）` : ''}`);
    if (plan.formats.length) L.push(`- 出題形式：${plan.formats.map((f) => f.label).join(' / ')}`);
    if (exam.core) L.push(`- 対策の芯：${exam.core}`);
    if (exam.pitfall) L.push(`- つまずきやすい所：${exam.pitfall}`);
    if (plan.traits.length) {
      L.push('- この試験の性格（※このアプリの見立てで、公式の分類ではありません）：');
      for (const t of plan.traits) L.push(`  - **${t.label}** … ${t.hint}`);
    }
  } else {
    L.push('- （まだ試験が選ばれていません）');
  }
  L.push('');

  L.push('## 2. 先に自分で確かめること');
  L.push('毎年変わるものと制度で変わるものは、アプリに書いてありません。公式サイトで確認してください。');
  L.push('');
  for (const c of plan.checkPoints) L.push(`- [${c.done ? 'x' : ' '}] ${c.text}`);
  L.push('');

  L.push('## 3. 期間の逆算');
  if (plan.schedule) {
    const sc = plan.schedule;
    L.push(`- 試験日：${sc.examDate}（残り **${sc.days}日** ＝ 約${sc.weeks}週）`);
    L.push(`- 内訳：平日${sc.weekdayDays}日 × ${sc.weekdayMin}分／休日${sc.weekendDays}日 × ${sc.weekendMin}分`);
    L.push(`- **確保できる時間の合計：約${sc.totalHours}時間**（週あたり約${Math.round(sc.weeklyMinutes / 60 * 10) / 10}時間）`);
    L.push('');
    L.push('| フェーズ | 期間 | 日数 | 確保時間 | ねらい |');
    L.push('|---|---|---|---|---|');
    for (const p of sc.phases) {
      L.push(`| ${p.label} | ${p.startDate}〜${p.endDate} | ${p.days}日 | 約${Math.round(p.minutes / 60)}時間 | ${p.aim} |`);
    }
    L.push('');
    for (const p of sc.phases) {
      L.push(`### ${p.label}`);
      L.push('やること：');
      for (const d of p.dos) L.push(`- ${d}`);
      L.push('この時期にやらないこと：');
      for (const d of p.donts) L.push(`- ${d}`);
      L.push('');
    }
  } else {
    L.push('- （試験日が未入力のため逆算できません）');
    L.push('');
  }

  if (plan.tight.length) {
    L.push('### 時間が足りないときに削る候補');
    L.push('※ 何を削るかを決めるのはあなたです。削ると何を失うかも書いてあります。');
    for (const t of plan.tight) L.push(`- **${t.title}** … ${t.detail}`);
    L.push('');
  }

  L.push('## 4. 科目の割り振り');
  if (plan.allocation.length) {
    L.push('※ 確保した時間の分け方であって、各科目に必要な時間ではありません。');
    L.push('');
    L.push('| 科目 | 割合 | 確保時間 |');
    L.push('|---|---|---|');
    for (const a of plan.allocation) {
      L.push(`| ${a.name} | ${Math.round(a.share * 100)}% | 約${Math.round(a.minutes / 60)}時間 |`);
    }
  } else {
    L.push('- （科目が未設定です）');
  }
  L.push('');

  L.push('## 5. 認知特性（自己申告）');
  L.push('> これは診断ではありません。学習の入口を選ぶためのメモです。合わなければ変えてください。');
  L.push('');
  L.push(`- ${plan.profileText}`);
  L.push('');

  L.push('## 6. 使う勉強法');
  if (plan.usingSuggested) {
    L.push('※ まだ自分で選んでいないので、**提案の上位を仮に置いています**。アプリで選び直してください。');
    L.push('');
  }
  for (const m of plan.methods) {
    L.push(`### ${m.title}`);
    L.push(`- ${m.summary}`);
    for (const h of m.how) L.push(`  - ${h}`);
    L.push(`- 気をつけること：${m.caution}`);
    L.push(`- 出典：${m.source}`);
    L.push('');
  }
  const lows = METHODS.filter((m) => m.effect === 'low');
  L.push('### 置き換えたいもの（効果が低いとされる方法）');
  for (const m of lows) L.push(`- **${m.title}** … ${m.summary}（→ ${m.how[0]}）`);
  L.push('');

  L.push('## 7. 1週間の型');
  const shape = weeklyShape(plan);
  if (shape.length) {
    L.push('| いつ | やること |');
    L.push('|---|---|');
    for (const r of shape) L.push(`| ${r.day} | ${r.body} |`);
  } else {
    L.push('- （試験日と確保時間を入れると出ます）');
  }
  L.push('');

  L.push('## 8. 過去問をAIで教材に変える方針');
  L.push(`- 収録済み：**${plan.questionCount}問**`);
  if (plan.angles.length) {
    L.push('- 1問の過去問から作る角度：');
    for (const a of plan.angles) L.push(`  - **${a.label}** … ${a.desc}`);
  }
  L.push('- AIに出典（URL）を推測で書かせない。確認できないものは「※要確認」を付ける。');
  L.push('- 取り込んだあと、必ず人が「答えの位置・医療/法令の正確さ・重複・形式」を見る。');
  L.push('');

  L.push('## 9. 見直しの約束');
  L.push('- 毎年変わる数値・法改正は、仕上げ期にまとめて更新する。');
  L.push('- 「※要確認」が付いた問題は、公式で確かめるまで暗記しない。');
  L.push('- この計画書は途中で変えてよい。変えたら日付を入れ直す。');
  if (state.notes) {
    L.push('');
    L.push('## 10. 自分のメモ');
    L.push(String(state.notes));
  }
  L.push('');
  return L.join('\n');
}
