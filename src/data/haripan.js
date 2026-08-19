// ハリオ先生 — このアプリのAIマスコット（鍼灸師）。
// 性格：無口だが面倒見がいい／見た目に反して優しい。口癖『身体はウソつかねぇ』。
// 話し方：短くぶっきらぼう。casual masculine（〜だ／〜な／〜ぜ／〜てやる／…）。
//         照れ隠しで褒める。ツボ・鍼・お灸・冷え・休養のたとえを使う。
// 決めゼリフ：「悪いとこ、ほぐしてやるよ。」

import { daysUntil } from '../lib/gamify.js';
import { phaseForDate } from './roadmapPhases.js';

export const MASCOT_NAME = 'ハリオ先生';

const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// 状況に応じた「ひとこと」を1つ返す。
// ctx: { examDate, dueCount, streak, historyLen, weakTag, riskCount, streakBreakReasonLabel,
//        nextTaskText, latestExam, mood, hour }
export function haripanMessage(ctx = {}) {
  const list = haripanMessages(ctx);
  return list[Math.floor(Math.random() * list.length)];
}

// 候補一覧（「次のひとこと」で切り替え）
export function haripanMessages(ctx = {}) {
  const {
    examDate, dueCount = 0, streak = 0, historyLen = 0,
    weakTag = null, riskCount = 0, streakBreakReasonLabel = null,
    nextTaskText = null, latestExam = null, mood = null,
    hour = new Date().getHours(),
  } = ctx;
  const left = daysUntil(examDate);
  const ph = phaseForDate(todayStr());
  const msgs = [];

  // はじめての人
  if (historyLen === 0) {
    msgs.push('よう。……ハリオだ。まずは1問いってみろ。身体はウソつかねぇ。勉強も同じ、やった分は必ず返る。');
    msgs.push('気楽にいけ。わしがついてる。まずは「学習」を40問だ。');
  }

  // カウントダウン
  if (left != null && left >= 0) {
    if (left > 120) msgs.push(`本番まであと${left}日。……焦んな。淡々とやりゃいい。`);
    else if (left > 30) msgs.push(`あと${left}日か。ここが踏ん張りどきだ。復習を厚めにいくぞ。`);
    else if (left > 14) msgs.push(`あと${left}日。新しいのはもう増やすな。△✕の穴を、ふさぐぞ。`);
    else if (left > 1) msgs.push(`${left}日前だ。間違いノートと総ざらいに集中しろ。……睡眠も勉強のうちだ。`);
    else if (left === 1) msgs.push('明日、本番だな。今夜は詰め込むな。……ちゃんと寝ろ。持ち物も確認しとけ。');
    else msgs.push('今日だ。わかるやつから確実にな。実力は出せる。……いってこい。');
  }

  // 今日の復習
  if (dueCount > 0) {
    msgs.push(`復習が${dueCount}問たまってる。悪いとこ、ほぐしてやるよ。○5回連続で、そいつはお前のもんだ。`);
  } else if (historyLen > 0) {
    msgs.push('復習は片づいたか。……上出来だ。');
  }

  // 連続日数（照れ隠しで褒める）
  if (streak >= 7) msgs.push(`${streak}日連続か。……偉いぞ。続けるやつが、受かるやつだ。`);
  else if (streak >= 3) msgs.push(`${streak}日続いてるな。その調子だ。`);
  else if (streak === 0 && historyLen > 0) msgs.push('しばらく空いたな。……気にすんな。また1問からだ。');

  // フェーズ助言
  if (ph) {
    if (ph.id === 'p1') msgs.push('今は全部を一周する時期だ。正答率は気にすんな。わからんとこを、炙り出せ。');
    if (ph.id === 'p3') msgs.push('仕上げの11月だ。模試で6割、2回続けば合格実力だぞ。');
    if (ph.id === 'c2') msgs.push('△✕だけに絞れ。新規はもういい。穴をふさぐことに集中しろ。');
  }

  // 弱点タグ・忘却リスク（詳しくは「分析」カードへ）
  if (weakTag) msgs.push(`最近「${weakTag}」でよく詰まってるな。……そこ、集中的にほぐすか？`);
  if (riskCount > 0) msgs.push(`忘れかけてる問題が${riskCount}問あるぞ。放っておくと消えちまう。`);

  // きのう出来なかった理由を踏まえて（責めずに、また今日から）
  if (streakBreakReasonLabel) {
    msgs.push(`きのうは『${streakBreakReasonLabel}』だったんだってな。……気にすんな。今日は無理せず1問からいくぞ。`);
  }

  // 明日の最初の1タスク（決めてあれば代わりに読み上げる）
  if (nextTaskText) {
    msgs.push(`お前が決めてた次の1つ、『${nextTaskText}』。……やる時間だぞ。`);
  }

  // 模試の結果（今日受けたものがあれば）
  if (latestExam) {
    const pct = Math.round(latestExam.scorePct || 0);
    msgs.push(
      latestExam.passed
        ? `今日の模試、${pct}%か。……上出来だ。合格ラインは超えてるぞ。`
        : `今日の模試、${pct}%だったな。……気にすんな。伸びしろだ、次で埋めろ。`
    );
  }

  // 今日の調子
  if (mood === 'tired') msgs.push('しんどい日は、無理すんな。今日は少なめでいい。……続けることの方が大事だ。');
  else if (mood === 'good') msgs.push('調子いいらしいな。……せっかくだ、1問多くいっとくか。');

  // 時間帯
  if (hour < 6) msgs.push('こんな時間まで……無理すんなよ。寝るのも勉強のうちだ。');
  else if (hour < 10) msgs.push('朝からえらいな。……1日、いい流れで始めろ。');
  else if (hour >= 23) msgs.push('遅いな。……あと少しで切り上げろ。明日にも回せる。');

  // 汎用
  msgs.push('身体はウソつかねぇ。勉強も同じだ。ごまかしはきかねぇが、やった分は必ず返る。');
  msgs.push('わからんは、伸びしろだ。堂々と間違えて、直しゃいい。');
  msgs.push('……冷えは万病のもと。休憩でちゃんと温まれよ。');
  msgs.push('休むのも実力のうちだ。無理すんな。');

  return msgs;
}

// リマインド通知用の一言
export function haripanReminder(examDate) {
  const left = daysUntil(examDate);
  const tail = left != null && left >= 0 ? `本番まであと${left}日だ。` : '';
  return `よう、ハリオだ。${tail}今日も一問からいくぞ。`;
}
