// 型パック——**売っているのはファイルではなく「毎回同じ結果が出る型」。**
//
// ノウハウを売る、ではない。**その型に流すと毎回出てくる結果**を売る。
// 手順書のファイルはそれを毎回出すための道具でしかないので、
// **結果の見本が付いていない型は、まだ売り物ではない。**
//
// もう1つの芯は「**自分が3回やったことしか売らない**」。
// 作るのが1時間で済むからこそ、試していないものが出回りやすい。
// ここは実際に回した記録から数える（自己申告にしない）。
//
// 決まりごと：
//  ・**AIを呼ばない。** 数えることと、文字を組み立てることだけ。
//  ・**結びつきは片方向だけ**（`task.kitId`。型の側に taskIds を持たない。
//    `deal.taskIds` が誰にも更新されなかった失敗を繰り返さない）。
//  ・**関門にしない。** 3回に足りなくても「それでも書き出す」は残す
//    （ただし書き出したファイルには「未検証」と必ず書く）。
//  ・**数えるのは成功だけ。** 失敗・中止・空の応答は回数に入れない。
//  ・**中身の質は担保できない。** 数えられるのは「3回回した」という事実だけで、
//    同じ相手・同じ題材で3回なら1回と大差ない。そこは人の判断として必ず残す。
//  ・**値段の表を持たない**（`paid.js` の値付けの段に渡すだけ）。
//  ・**書き出しに混ぜないもの**：APIキー・お客さんの氏名や連絡先・
//    社内の掲示板や社員の記憶（業務連絡であって商品ではない）。

import { newId } from './id.js';
import { parseSections } from './outline.js';

/** 売り物として出す前に、実際に回しておく回数。 */
export const MIN_RUNS = 3;

/** 同梱する結果の見本の数。 */
export const MIN_SAMPLES = 1;
export const MAX_SAMPLES = 3;
export const SAMPLE_LEN = 1200;

export const MAX_KITS = 20;

/**
 * 5つの売り方。**選ぶだけ**で、値段はここで決めない。
 *  handsOff … 作ったあと手が離れるか。②〜⑤は受注仕事なので、
 *             売れるほど自分の時間が減る（`offload.js` の考え方と同じ）。
 */
export const SELL_MODES = {
  guide: { name: '手順書を売る', handsOff: true, note: '型そのものを渡す。売れても手は増えない。' },
  service: { name: '代わりに作る', handsOff: false, note: '1件ごとに自分の時間を使う。単価は上げやすい。' },
  build: { name: '仕組みを納品する', handsOff: false, note: '相手の環境に入れて渡す。金額は大きいが重い。' },
  care: { name: 'そのあと面倒を見る', handsOff: false, note: '毎月入るが、止められない。続く費用と時間を先に見ること。' },
  teach: { name: '教える', handsOff: false, note: '人数ぶん時間がかかる。録画にすると手離れが良くなる。' },
};

const str = (v, n) => String(v || '').trim().slice(0, n);
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * 型パック1つ。**流れ（steps）と依頼文の型が無いものは型ではない。**
 */
export function makeKit(data = {}) {
  const title = str(data.title, 60);
  if (!title) return null;
  const now = Date.now();
  return {
    id: data.id || newId('kit'),
    title,
    // 何が出てくるか（買う人がいちばん知りたいところ）
    outcome: str(data.outcome, 200),
    // 依頼文の型。これに流すと同じ結果が出る、という中身。
    request: str(data.request, 2000),
    // 手順（役職の並び。仕事から型にすると、その仕事の担当がそのまま入る）
    steps: (Array.isArray(data.steps) ? data.steps : []).map((s) => str(s, 40)).filter(Boolean).slice(0, 12),
    // 完成条件（`checks.js` と同じ書き方。1行ずつ）
    doneWhen: str(data.doneWhen, 600),
    // 使うときの注意・出典の決まりなど
    notes: str(data.notes, 1000),
    genreId: data.genreId || null,
    // 事業と片方向でだけ結ぶ（値付けの段は事業側の `pricing` を使う）
    ventureId: data.ventureId || null,
    sellMode: SELL_MODES[data.sellMode] ? data.sellMode : 'guide',
    // 結果の見本（実際に出た成果物の抜粋）
    samples: [],
    // 版。直したら上げる。売ったあとに「何が変わったか」を出せる。
    version: 1,
    changelog: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeKit(k) {
  if (!k || !k.id || !k.title) return null;
  return {
    id: k.id,
    title: str(k.title, 60),
    outcome: str(k.outcome, 200),
    request: str(k.request, 2000),
    steps: (Array.isArray(k.steps) ? k.steps : []).map((s) => str(s, 40)).filter(Boolean).slice(0, 12),
    doneWhen: str(k.doneWhen, 600),
    notes: str(k.notes, 1000),
    genreId: k.genreId || null,
    ventureId: k.ventureId || null,
    sellMode: SELL_MODES[k.sellMode] ? k.sellMode : 'guide',
    samples: (Array.isArray(k.samples) ? k.samples : [])
      .map((s) => (s && s.id ? {
        id: s.id,
        taskId: s.taskId || null,
        title: str(s.title, 80),
        excerpt: str(s.excerpt, SAMPLE_LEN),
        addedAt: s.addedAt || Date.now(),
      } : null))
      .filter((s) => s && s.excerpt)
      .slice(0, MAX_SAMPLES),
    version: Math.max(1, Math.round(num(k.version)) || 1),
    changelog: (Array.isArray(k.changelog) ? k.changelog : [])
      .map((c) => (c && c.at ? { at: c.at, version: num(c.version) || 1, note: str(c.note, 160) } : null))
      .filter(Boolean)
      .slice(0, 20),
    createdAt: k.createdAt || Date.now(),
    updatedAt: k.updatedAt || k.createdAt || Date.now(),
  };
}

export function normalizeKits(list) {
  return (Array.isArray(list) ? list : []).map(normalizeKit).filter(Boolean).slice(0, MAX_KITS);
}

/**
 * 終わった仕事から型をつくる。**すでに動いた実績がある形だけを型にする。**
 * 担当（steps）はその仕事で実際に動いた役職をそのまま使う——
 * 計画上の役職ではなく、動いたものが正。
 */
export function kitFromTask(task, extra = {}) {
  if (!task) return null;
  const steps = [...new Set(
    (task.steps || [])
      .flat(2)
      .filter((s) => s && s.roleId && s.kind !== 'check')
      .map((s) => s.roleId)
  )];
  return makeKit({
    title: extra.title || str(task.title, 60) || '無題の型',
    request: task.request || '',
    steps,
    doneWhen: (task.spec && task.spec.doneWhen) || '',
    genreId: task.genreId || null,
    ventureId: task.ventureId || null,
    ...extra,
  });
}

/**
 * その型で実際に回した仕事。**成功だけを数える。**
 * 結びつきは `task.kitId` の片方向だけ。
 */
export function runsOf(kit, tasks = []) {
  if (!kit) return [];
  return (Array.isArray(tasks) ? tasks : []).filter(
    (t) => t && t.kitId === kit.id && t.status === 'done' && !t.flagged
  );
}

/** 結果の見本を1つ作る。**④成果物の中だけ**を使う（項目133・134と同じ線）。 */
export function sampleFromTask(task, resultText = '') {
  if (!task) return null;
  const text = String(resultText || '');
  // `parseSections(x)` の直下に見出しは無い——`.sections.deliverable`。
  const parsed = parseSections(text);
  const body = (parsed && parsed.sections && parsed.sections.deliverable) || text;
  const excerpt = String(body || '').trim().slice(0, SAMPLE_LEN);
  if (!excerpt) return null;
  return {
    id: newId('smp'),
    taskId: task.id || null,
    title: str(task.title, 80) || '成果物',
    excerpt,
    addedAt: Date.now(),
  };
}

export function addSample(kit, sample) {
  const k = normalizeKit(kit);
  if (!k || !sample || !sample.excerpt) return k;
  return { ...k, samples: [sample, ...k.samples].slice(0, MAX_SAMPLES), updatedAt: Date.now() };
}

export function removeSample(kit, sampleId) {
  const k = normalizeKit(kit);
  if (!k) return k;
  return { ...k, samples: k.samples.filter((s) => s.id !== sampleId), updatedAt: Date.now() };
}

/** 版を上げる。**直した中身を1行残す**（残さないと、買った人に何が変わったか言えない）。 */
export function bumpVersion(kit, note) {
  const k = normalizeKit(kit);
  if (!k) return k;
  const version = k.version + 1;
  return {
    ...k,
    version,
    changelog: [{ at: Date.now(), version, note: str(note, 160) || '（内容を見直しました）' }, ...k.changelog].slice(0, 20),
    updatedAt: Date.now(),
  };
}

/**
 * 型ごとの手間。**②の芯——えぐいのは金額ではなく手間の少なさ。**
 * 数字は既存のもの（仕事の開始・終了と `totalCost`）から導くだけで、
 * 新しい計測は足さない。**実行していないものを0と書かない**（null）。
 */
export function kitEffort(kit, tasks = [], usdJpy = 155) {
  const runs = runsOf(kit, tasks);
  const timed = runs.filter((t) => t.startedAt && t.finishedAt && t.finishedAt > t.startedAt);
  const mins = timed.map((t) => (t.finishedAt - t.startedAt) / 60000).sort((a, b) => a - b);
  const median = mins.length
    ? (mins.length % 2 ? mins[(mins.length - 1) / 2] : (mins[mins.length / 2 - 1] + mins[mins.length / 2]) / 2)
    : null;
  const usd = runs.reduce((s, t) => s + (Number(t.totalCost) || 0), 0);
  return {
    runs: runs.length,
    timedRuns: timed.length,
    // 1回あたりの真ん中の所要（分）。測れた回が無ければ null（0分と書かない）。
    minutesPerRun: median === null ? null : Math.round(median * 10) / 10,
    usdTotal: usd,
    yenPerRun: runs.length ? Math.round((usd / runs.length) * (num(usdJpy) || 155)) : null,
  };
}

/**
 * 売り物として出せるか。**関門にはしない**——足りないものを並べるだけ。
 * @param {object} o { kit, tasks, rivalCount }
 *   rivalCount … 競合台帳の件数。**0件は「空いている」ではなく「まだ見ていない」**
 *   （`rivals.js` の項目161・`risk.js` の6問目と同じ線）。
 */
export function kitReady(kit, { tasks = [], rivalCount = 0 } = {}) {
  const k = normalizeKit(kit);
  const runs = runsOf(k, tasks).length;
  const reasons = [];
  if (!k) return { runs: 0, samples: 0, ready: false, reasons: ['型がありません'], notes: [] };

  if (runs < MIN_RUNS) reasons.push(`実際に回したのが ${runs} 回です（${MIN_RUNS} 回そろってから出すと事故が減ります）`);
  if (k.samples.length < MIN_SAMPLES) reasons.push('結果の見本が付いていません（買う人が欲しいのは手順ではなく、出てくる結果です）');
  if (!k.outcome) reasons.push('「何が出てくるか」が1行も書かれていません');
  if (!k.request.trim()) reasons.push('依頼文の型が空です');

  const notes = [];
  if (runs >= MIN_RUNS) {
    notes.push(
      `${runs} 回まわした記録はありますが、**中身の違う ${MIN_RUNS} 回かどうかは機械では見られません。**`
      + '同じ相手・同じ題材で3回なら、1回と大差ありません。'
    );
  }
  if (rivalCount === 0) {
    notes.push(
      '競合台帳が0件です。**0件は「空いている」ではなく「まだ見ていない」**です——'
      + '誰もやっていない理由が先にあることもあります。売る前に3件だけ見てみてください。'
    );
  }
  const mode = SELL_MODES[k.sellMode];
  if (mode && !mode.handsOff) {
    notes.push(`売り方が「${mode.name}」です。${mode.note}`);
  }
  return { runs, samples: k.samples.length, ready: reasons.length === 0, reasons, notes };
}

/** 画面に出す1行。**足りない時も黙らない。** */
export function kitLine(kit, tasks = []) {
  const k = normalizeKit(kit);
  if (!k) return '';
  const runs = runsOf(k, tasks).length;
  const parts = [`回した回数 ${runs}／${MIN_RUNS}`, `結果の見本 ${k.samples.length}件`, `第${k.version}版`];
  return parts.join(' ・ ');
}

export function kitsLine(kits, tasks = []) {
  const list = normalizeKits(kits);
  if (!list.length) return 'まだ型がありません。終わった仕事から「この流れを型にする」で作れます。';
  const sellable = list.filter((k) => kitReady(k, { tasks }).ready).length;
  return `型が ${list.length} 個、そのうち出せる状態は ${sellable} 個です。`;
}

/**
 * 売り物として書き出す（Markdown 1ファイル）。
 *
 * **混ぜないもの**：APIキー・お客さんの氏名や連絡先・社内の掲示板や社員の記憶。
 * 型が持っているのは「流れ・依頼文・完成条件・見本」だけなので、
 * ここでは型の中身しか出さない（会社のデータを拾いに行かない）。
 * **3回に足りなければ「未検証」と必ず書く**（黙って出せてしまうのがいちばん危ない）。
 */
export function exportKit(kit, { tasks = [], roleName = (id) => id, usdJpy = 155 } = {}) {
  const k = normalizeKit(kit);
  if (!k) return '';
  const ready = kitReady(k, { tasks });
  const effort = kitEffort(k, tasks, usdJpy);
  const out = [];

  out.push(`# ${k.title}`);
  out.push('');
  if (k.outcome) out.push(`**出てくるもの**：${k.outcome}`);
  out.push(`**版**：第${k.version}版`);
  out.push(`**売り方**：${SELL_MODES[k.sellMode].name}`);
  if (ready.runs < MIN_RUNS) {
    out.push('');
    out.push(`> ⚠ **未検証**：この型はまだ ${ready.runs} 回しか回していません（${MIN_RUNS} 回が目安）。`);
  } else {
    out.push(`**実際に回した回数**：${ready.runs} 回`);
  }
  if (effort.minutesPerRun !== null) {
    out.push(`**1回あたりの目安**：約${effort.minutesPerRun}分`
      + (effort.yenPerRun !== null ? ` ／ AI費用 約¥${effort.yenPerRun.toLocaleString('ja-JP')}` : ''));
  }

  out.push('');
  out.push('## 手順');
  if (k.steps.length) {
    k.steps.forEach((roleId, i) => out.push(`${i + 1}. ${roleName(roleId)}`));
  } else {
    out.push('（担当の並びは決めていません）');
  }

  out.push('');
  out.push('## 依頼文（このまま使えます）');
  out.push('```');
  out.push(k.request || '（未記入）');
  out.push('```');

  if (k.doneWhen.trim()) {
    out.push('');
    out.push('## 完成条件');
    for (const line of k.doneWhen.split('\n').map((l) => l.trim()).filter(Boolean)) out.push(`- ${line}`);
  }

  if (k.notes.trim()) {
    out.push('');
    out.push('## 使うときの注意');
    out.push(k.notes);
  }

  out.push('');
  out.push('## 出てくる結果の見本');
  if (k.samples.length) {
    for (const s of k.samples) {
      out.push('');
      out.push(`### ${s.title}`);
      out.push(s.excerpt);
    }
  } else {
    out.push('（見本がまだありません。**見本の無い型は売り物になりません**——'
      + '買う人が欲しいのは手順ではなく、そこから出てくる結果です。）');
  }

  if (k.changelog.length) {
    out.push('');
    out.push('## 変えたところ');
    for (const c of k.changelog) {
      out.push(`- 第${c.version}版：${c.note}`);
    }
  }
  return out.join('\n');
}
