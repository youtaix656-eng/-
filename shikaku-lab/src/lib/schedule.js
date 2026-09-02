// 試験日からの逆算。**「◯時間やれば受かる」は出さない**。
//
// 決めていること:
// 1. 出すのは「確保できる時間」だけ。必要な時間は人によって違いすぎるので、
//    合格に必要な時間の目安（手元に無い基準）をアプリが決めない。
// 2. **日付は `new Date('YYYY-MM-DD')` で読まない**（UTCとして読まれて前日になる）。
//    書き出す時も `toISOString()` を使わない（同じ理由で日本時間の午前0時が前日になる）。
// 3. 期間が足りない時は「無理です」と言わずに、**削る候補**を出す（行き止まりにしない）。
// 4. フェーズの比率はハードコーディングせず、設定から変えられる。

/** 'YYYY-MM-DD' を端末の時刻帯の 0時 として読む */
export function parseDate(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || '').trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date を 'YYYY-MM-DD' に（toISOString を使わない） */
export function formatDate(date) {
  if (!date) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

const DAY = 24 * 60 * 60 * 1000;

/** 残り日数（当日を1日と数える）。過去なら 0 */
export function daysUntil(examDate, from = new Date()) {
  const target = typeof examDate === 'string' ? parseDate(examDate) : examDate;
  if (!target) return null;
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.max(0, Math.round((b - a) / DAY) + 1);
}

/** 残り日数のうち、平日／休日がそれぞれ何日か（土日を休日として数える） */
export function splitDays(examDate, from = new Date()) {
  const total = daysUntil(examDate, from);
  if (total == null) return null;
  let weekday = 0;
  let weekend = 0;
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < total; i += 1) {
    const dow = cursor.getDay();
    if (dow === 0 || dow === 6) weekend += 1;
    else weekday += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return { total, weekday, weekend };
}

/** フェーズの既定の比率。合計が 100 でなくても内部で正規化する */
export const DEFAULT_PHASE_RATIO = { input: 40, drill: 40, finish: 20 };

export const PHASE_META = {
  input: {
    id: 'input',
    label: 'インプット期',
    reading: 'いんぷっとき',
    aim: '全体像をつかみ、問われ方を知る',
    dos: ['出題範囲の目次を先に読む', '単元ごとに過去問を先に見てからテキストへ戻る', '分からない所は印だけ付けて先へ進む'],
    donts: ['1周目から完璧に理解しようとする', 'ノートを清書する'],
  },
  drill: {
    id: 'drill',
    label: '演習期',
    reading: 'えんしゅうき',
    aim: '思い出す練習の回数を積む。間違いの型を知る',
    dos: ['閉じた状態で解く', '間違えた問題に理由（勘違い／知識不足／うっかり）を付ける', '分野を混ぜて解く日を作る'],
    donts: ['解説を読んで分かった気になる', '正答率の高い分野ばかり解く'],
  },
  finish: {
    id: 'finish',
    label: '仕上げ期',
    reading: 'しあげき',
    aim: '本番と同じ時間で通し、数値・改正点を最新にする',
    dos: ['通しで時間を計って解く', '毎年変わる数値・法改正を最後にまとめて更新する', '間違いノートだけを回す'],
    donts: ['新しい教材に手を出す', '当日の朝に初見の分野を始める'],
  },
};

export const PHASE_ORDER = ['input', 'drill', 'finish'];

/**
 * 逆算の本体。
 * @param {Object} input
 *   examDate   'YYYY-MM-DD'
 *   weekdayMin 平日に確保できる分
 *   weekendMin 休日に確保できる分
 *   ratio      { input, drill, finish }（省略時は既定）
 *   from       起点（省略時は今日）
 * @returns {Object|null} 期日が読めなければ null（**読めない日付で勝手に今日を入れない**）
 */
export function buildSchedule({ examDate, weekdayMin = 0, weekendMin = 0, ratio, from = new Date() } = {}) {
  const split = splitDays(examDate, from);
  if (!split) return null;
  const wd = Math.max(0, Number(weekdayMin) || 0);
  const we = Math.max(0, Number(weekendMin) || 0);
  const totalMin = split.weekday * wd + split.weekend * we;
  const weeks = Math.max(0, Math.round((split.total / 7) * 10) / 10);

  const r = { ...DEFAULT_PHASE_RATIO, ...(ratio || {}) };
  const sum = PHASE_ORDER.reduce((s, k) => s + Math.max(0, Number(r[k]) || 0), 0);
  const phases = PHASE_ORDER.map((id) => {
    const share = sum > 0 ? Math.max(0, Number(r[id]) || 0) / sum : 0;
    return {
      ...PHASE_META[id],
      share,
      days: Math.round(split.total * share),
      minutes: Math.round(totalMin * share),
    };
  });

  // 端数で合計がズレるので、最後のフェーズで吸収する（合計が合わないと数字を信じてもらえない）
  const dayDiff = split.total - phases.reduce((s, p) => s + p.days, 0);
  const minDiff = totalMin - phases.reduce((s, p) => s + p.minutes, 0);
  if (phases.length > 0) {
    phases[phases.length - 1].days += dayDiff;
    phases[phases.length - 1].minutes += minDiff;
  }

  // フェーズの日付の区切り（開始日と終了日）
  let cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (const p of phases) {
    p.startDate = formatDate(cursor);
    const end = new Date(cursor);
    end.setDate(end.getDate() + Math.max(0, p.days - 1));
    p.endDate = formatDate(end);
    cursor = new Date(end);
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    examDate,
    from: formatDate(from),
    days: split.total,
    weekdayDays: split.weekday,
    weekendDays: split.weekend,
    weeks,
    weekdayMin: wd,
    weekendMin: we,
    totalMinutes: totalMin,
    totalHours: Math.round((totalMin / 60) * 10) / 10,
    weeklyMinutes: Math.round(wd * 5 + we * 2),
    phases,
  };
}

/**
 * 科目の割り振り。重みが無ければ均等。
 * **「この科目に何時間必要か」は決めない**——決めるのは「確保した時間をどう分けるか」だけ。
 */
export function allocateSubjects(schedule, subjects = [], weights = {}) {
  if (!schedule || subjects.length === 0) return [];
  const list = subjects.map((s) => ({
    name: s.name || String(s),
    reading: s.reading || '',
    weight: Math.max(0, Number(weights[s.name || s]) ?? 1),
  }));
  const sum = list.reduce((acc, s) => acc + s.weight, 0);
  if (sum <= 0) return list.map((s) => ({ ...s, minutes: 0, share: 0 }));
  return list.map((s) => ({
    ...s,
    share: s.weight / sum,
    minutes: Math.round(schedule.totalMinutes * (s.weight / sum)),
  }));
}

/**
 * 期間が短いときに「削る候補」を出す。**「間に合いません」とだけ言わない**。
 * どれを削るかを決めるのは人なので、候補と、その代わりに失うものを並べる。
 */
export function tightOptions(schedule, subjectCount = 0) {
  if (!schedule) return [];
  const out = [];
  const perSubject = subjectCount > 0 ? Math.round(schedule.totalMinutes / subjectCount) : 0;
  if (schedule.days > 0 && schedule.days <= 30) {
    out.push({
      title: '1周目の「全部を理解する」をやめる',
      detail: '過去問で問われた所だけに絞り、出ていない所は印を付けて飛ばす。落とすのは「網羅」で、拾うのは「頻出」。',
    });
  }
  if (schedule.totalMinutes > 0 && perSubject > 0 && perSubject < 300) {
    out.push({
      title: '科目に順位を付ける',
      detail: `今の確保時間だと1科目あたり約${Math.round(perSubject / 60)}時間しか回らない。配点の大きい科目に寄せて、残りは基準点だけ狙う。`,
    });
  }
  if (schedule.weekdayMin === 0) {
    out.push({
      title: '平日に10分でも置く',
      detail: '休日だけの計画は、休日が1回つぶれると丸ごと崩れる。平日は「思い出す練習を5問だけ」で十分。',
    });
  }
  if (schedule.phases?.[2]?.days != null && schedule.phases[2].days < 7) {
    out.push({
      title: '仕上げ期を1週間は残す',
      detail: '通しで解く時間と、毎年変わる数値・改正点を直す時間が要る。ここを削ると本番で時間が足りなくなる。',
    });
  }
  return out;
}
