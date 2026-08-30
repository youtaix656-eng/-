// 計画書から「自分専用の対策アプリを Claude Code に作らせるための設計書」を組み立てる。
//
// ■ なぜ計画書と別にするのか ──────────────────────────
// 計画書は**人が読むもの**、設計書は**AIに読ませるもの**。層が違う。
// ただし **中身は必ず計画書から導く**（同じことを2か所に書かない）。
// 計画書を直したら設計書も自動で変わる、という関係を崩さないこと。
//
// ■ 決めていること ──────────────────────────────
// 1. **選んでいない勉強法の画面を設計書に書かない。** 画面が多い設計書を渡すと、
//    Claude Code は全部作ろうとして、どれも中途半端になる（実際に起きる失敗）。
//    画面は screensFor() の1か所だけで決める（設計書の文面に if を足さない）。
// 2. **完成条件（doneWhen）を必ず入れる。** 「決めただけ」で終わらせないため。
// 3. **やらないこと（スコープ外）を必ず入れる。** 書かないと機能が際限なく増える。
// 4. **問題データは設計書に貼らず、別ファイルとして渡す。**
//    設計書に何百問も貼ると読ませる量が跳ね上がり、肝心の設計が薄まる。
// 5. 認知特性が未回答なら「未回答」と書く（答えたことにしない）。

import { planMarkdown, weeklyShape } from './plan.js';
import { COPYRIGHT_NOTE } from './convert.js';
import { CHANNELS } from '../data/cognitiveQuestions.js';
import { methodById } from '../data/methods.js';
import { TRAIT_VOCABULARY } from '../data/exams.js';

/**
 * 画面の決め方の単一の正。
 * needs … 「これがあるなら要る」条件。method（選んだ勉強法）/ trait（試験の性格）/ channel（入り口）
 * base  … 条件に関係なく必ず作る画面
 */
export const SCREEN_RULES = [
  {
    id: 'home',
    title: 'ホーム',
    base: true,
    desc: '今日やること1つと、期限の来た復習の件数だけを出す。ここで迷わせない。',
  },
  {
    id: 'quiz',
    title: '一問一答',
    base: true,
    desc: '1問ずつ出して答え合わせ。答えを見る前に必ず自分の答えを選ばせる（思い出す練習の本体）。',
  },
  {
    id: 'review',
    title: '復習',
    needs: { method: ['spacing', 'retrieval'] },
    desc: '間違えた問題を、間隔をあけて出し直す。○が続いたら間隔を伸ばし、×なら短くする。',
  },
  {
    id: 'mixed',
    title: '混ぜて解く',
    needs: { method: ['interleave'] },
    desc: '複数の分野をまぜて出す。「どの型の問題か見分ける」練習の場。正答率が下がるのは想定内だと画面に書く。',
  },
  {
    id: 'audio',
    title: '音声学習',
    needs: { method: ['audio'], channel: ['auditory'] },
    desc: '問題→3秒あける→答え、の順で読み上げる。答えだけを流さない。ブラウザの読み上げ（SpeechSynthesis）を使う。',
  },
  {
    id: 'cards',
    title: 'カード・図',
    needs: { method: ['dualcode'], channel: ['visual'] },
    desc: '表に問い・裏に答えのカード。位置関係のあるものは SVG をその場で描く（画像ファイルを持たない）。',
  },
  {
    id: 'mock',
    title: '模試（時間を計って通す）',
    needs: { method: ['timedmock'], trait: ['speed'] },
    desc: '本番と同じ問題数・同じ時間で通す。終わったら分野別の正答率を出す。解き直しは翌日に促す。',
  },
  {
    id: 'writing',
    title: '記述の採点観点',
    needs: { trait: ['essay'] },
    desc: '模範解答を出すのではなく、「この観点が書けていたか」のチェックリストを出す。自分で○×を付ける。',
  },
  {
    id: 'steps',
    title: '実技の手順',
    needs: { trait: ['practical'] },
    desc: '手順を1ステップずつ表示し、口で言えたかを自分で確認する。時間も計る。',
  },
  {
    id: 'freshness',
    title: '数値・改正の見直し',
    needs: { trait: ['update', 'law'] },
    desc: '「※要確認」が付いた問題だけを集める。確かめた日を記録し、古いものに印を出す。**アプリが勝手に最新化しない**（できないので、できるふりをしない）。',
  },
  {
    id: 'timer',
    title: 'ポモドーロ（上部に常設）',
    needs: { method: ['pomodoro', 'buffer'] },
    desc: '画面の上に出しっぱなしにする。残り時間は「終わる時刻」から毎回引き算する（1秒ずつ減らすとタブを裏に回した時にズレる）。連続日数は出さない。',
  },
  {
    id: 'planner',
    title: '時間で計画する',
    needs: { method: ['buffer'] },
    desc: '今日使える分数を入れると、基礎タスクと余白（3分の2と3分の1）に割る。終わらなかった時は「無理な計画を立てた側」を直す文言にする。',
  },
  {
    id: 'settings',
    title: '設定',
    base: true,
    desc: 'テーマ・文字サイズ・データの書き出しと取り込み・全消去。保存は端末内だけだと明記する。',
  },
];

/**
 * この人に要る画面だけを返す。**設計書の文面ではなくここで決める。**
 * @returns {Array} { id, title, desc, why }
 */
export function screensFor(plan) {
  const methodIds = new Set((plan?.methods || []).map((m) => m.id));
  const traitIds = new Set((plan?.exam?.traits || []));
  const channel = plan?.channel || null;

  const out = [];
  for (const rule of SCREEN_RULES) {
    if (rule.base) {
      out.push({ id: rule.id, title: rule.title, desc: rule.desc, why: '基本の画面' });
      continue;
    }
    const why = [];
    // **id をそのまま画面に出さない**（「spacing」ではなく勉強法の名前で言う）
    for (const m of rule.needs?.method || []) {
      if (methodIds.has(m)) why.push(`勉強法「${methodById(m)?.title || m}」を選んだから`);
    }
    for (const t of rule.needs?.trait || []) {
      if (traitIds.has(t)) why.push(`この試験が「${TRAIT_VOCABULARY[t]?.label || t}」だから`);
    }
    for (const c of rule.needs?.channel || []) {
      if (channel === c) why.push(`入り口が「${CHANNELS[c]?.label || c}」寄りだったから`);
    }
    if (why.length > 0) out.push({ id: rule.id, title: rule.title, desc: rule.desc, why: why.join(' / ') });
  }
  return out;
}

/** 作らない画面と、その理由（「今は要らない」を明示すると増設を防げる） */
export function skippedScreens(plan) {
  const kept = new Set(screensFor(plan).map((s) => s.id));
  return SCREEN_RULES.filter((r) => !r.base && !kept.has(r.id)).map((r) => ({ id: r.id, title: r.title }));
}

/** 完成条件。**読み取れる形（数えられる・押せる）でしか書かない** */
export function doneWhen(plan) {
  const screens = screensFor(plan);
  const out = [
    '`npm run build` が通る。',
    '`node --test test/*.test.mjs` が全部通る。',
    'ブラウザを閉じて開き直しても、解いた記録が残っている。',
    '通信を切った状態（機内モード）でも、全画面が動く。',
    `下部ナビから ${screens.map((s) => s.title).join('／')} のすべてに行ける。`,
  ];
  if (plan?.questionCount > 0) {
    out.push(`同梱した ${plan.questionCount} 問がすべて一問一答に出る（取り込み漏れが無い）。`);
  }
  const ids = new Set(screens.map((s) => s.id));
  if (ids.has('review')) out.push('間違えた問題が翌日以降に出直す（○が続くと間隔が伸びる）。');
  if (ids.has('audio')) out.push('音声学習で、答えの前に3秒の間があく。');
  if (ids.has('mock')) out.push('模試を時間切れまで放置すると、自動で採点まで進む。');
  if (ids.has('freshness')) out.push('「※要確認」の問題だけを一覧で出せる。');
  if (ids.has('timer')) out.push('タイマー動作中にタブを裏に回して戻しても、残り時間がズレない。');
  return out;
}

/** やらないこと。**書かないと機能が際限なく増える** */
export const OUT_OF_SCOPE = [
  'サーバーを持たない（ログイン・アカウント・課金を作らない）。',
  'アプリの中からAIのAPIを呼ばない（呼ぶなら別の段として後から足す）。',
  '外部のUIライブラリ・CSSフレームワーク・フォントを読み込まない（オフラインで完全に動かすため）。',
  '他人の過去問データを同梱して配布しない（著作権）。',
  '成績を外部へ送らない・共有機能を作らない。',
  '「あなたは合格できます」のような合否の予測を出さない（手元に無い基準が要るため）。',
];

/**
 * Claude Code に貼る設計書（Markdown）。
 * 計画書の本文をそのまま添付して、設計の根拠を一緒に渡す。
 */
export function specMarkdown(plan, state = {}) {
  if (!plan) return '';
  const exam = plan.exam;
  const name = exam?.name || '（試験名）';
  const appName = `${name} 対策アプリ`;
  const screens = screensFor(plan);
  const skipped = skippedScreens(plan);
  const L = [];

  L.push(`# 依頼：「${appName}」を作ってください`);
  L.push('');
  L.push('私は資格試験の受験者です。市販の教材ではなく、自分の弱点と勉強法に合わせた対策アプリが欲しいです。');
  L.push('下の設計書のとおりに作ってください。**書いていない機能は作らないでください**（あとで足します）。');
  L.push('');
  L.push('---');
  L.push('');

  L.push('## 0. 先に確認してほしいこと');
  L.push('- この設計書で分からない所があれば、作り始める前に質問してください。');
  L.push('- 勝手に機能を足さないでください。「6. 作らないもの」に書いたものは作らないでください。');
  L.push('- 医療・法令の内容には手を入れないでください（正誤の判断は私がします）。');
  L.push('');

  L.push('## 1. 何を作るか');
  L.push(`- アプリ名：**${appName}**`);
  L.push(`- 使う人：私1人（${name}の受験者）`);
  L.push('- 動く場所：スマホのブラウザ。オフラインでも全画面が動くこと。');
  L.push('- 保存先：**端末の中だけ**（localStorage）。外へ送らない。');
  if (plan.schedule) {
    L.push(`- 試験日：${plan.schedule.examDate}（残り${plan.schedule.days}日）。この期間で使い切る前提の道具です。`);
  }
  L.push('');

  L.push('## 2. 技術の決まり');
  L.push('- Vite + React（**JSX。TypeScript は使わない**）。');
  L.push('- **外部ランタイム依存を入れない**（react / react-dom 以外の実行時ライブラリを使わない）。');
  L.push('  UIライブラリ・状態管理・日付ライブラリ・チャートライブラリも入れない。CSSは自分で書く。');
  L.push('- 状態は `useSyncExternalStore` を使った小さな自作ストア1つにまとめる（`src/lib/useStore.js`）。');
  L.push('- 保存は `src/lib/storage.js` に閉じ込め、**このファイルはネットワークに触れない**（不変条件）。');
  L.push('  localStorage が使えない環境でも落ちないように、メモリへの退避を持つ。');
  L.push('- `vite.config.js` は `base: \'./\'`（サブパス配信でも動くように）。');
  L.push('- 日付は `new Date(\'YYYY-MM-DD\')` で読まない・`toISOString()` で書かない（UTCに直って前日になる）。');
  L.push('  自前の `parseDate` / `formatDate` を作る。');
  L.push('- 正規表現に後読み（lookbehind）を使わない（古い Safari で構文エラーになり、画面が丸ごと出なくなる）。');
  L.push('');

  L.push('## 3. データの形');
  L.push('問題は次の形です。**この形を変えないでください**（別のアプリから書き出したものを取り込むため）。');
  L.push('');
  L.push('```js');
  L.push('/** 1問 */');
  L.push('{');
  L.push('  id: string,');
  L.push('  subject: string,      // 科目');
  L.push('  genre: string,        // ジャンル（大項目｜中項目）。空でよい');
  L.push("  type: 'choice' | 'ox',");
  L.push('  question: string,');
  L.push('  choices: string[],    // choice は2つ以上、ox は2つ');
  L.push('  answer: number,       // **0から数える**');
  L.push('  explanation: string,');
  L.push('  tags: string[],       // 正式名称でそろえる');
  L.push("  angle: string,        // 'original' か core/define/distract/check/apply/compare");
  L.push('  needsCheck: boolean,  // 「※要確認」が付いているか');
  L.push('  round: string,        // 「第34回」など。空でよい');
  L.push('}');
  L.push('```');
  L.push('');
  L.push('- 問題データは `src/data/questions.json` として別に渡します。設計書には貼りません。');
  L.push('- 起動時に読み込み、**同じ問題文のものは取り込まない**（正規化して比べる。空白・記号・全角半角の揺れを吸収する）。');
  L.push('- 解答の記録は `{ questionId, correct, at }` の配列で持つ。');
  L.push('');

  L.push('## 4. 画面');
  L.push('下部のナビからこれらに行けるようにしてください。**この一覧に無い画面は作らないでください。**');
  L.push('');
  L.push('| 画面 | 中身 | なぜ要るか |');
  L.push('|---|---|---|');
  for (const s of screens) L.push(`| **${s.title}** | ${s.desc} | ${s.why} |`);
  L.push('');
  if (skipped.length) {
    L.push(`※ 今回は作りません：${skipped.map((s) => s.title).join('／')}（必要になったら私から頼みます）`);
    L.push('');
  }

  L.push('### 画面をまたぐ決まり');
  L.push('- 文字は大きめ・タップ領域は広め（スマホで片手で使う）。');
  L.push('- ダークモードに切り替えられる。色はCSS変数でまとめる。');
  L.push('- **押しても何も起きないボタンを出さない**（できない時はボタンごと出さない）。');
  L.push('- **連続日数を主役にしない**（1日休んだだけで開かなくなるため）。出すなら通算の日数と件数。');
  L.push('- 長い一覧を全件描画しない（検索欄＋先頭◯件の打ち切り。仮想化ライブラリは入れない）。');
  L.push('');

  L.push('## 5. 私の勉強のしかた（この設計の根拠）');
  L.push(`- 認知特性（自己申告・診断ではありません）：${plan.profileText}`);
  L.push('- 使う勉強法：');
  for (const m of plan.methods) L.push(`  - **${m.title}** … ${m.summary}`);
  const shape = weeklyShape(plan);
  if (shape.length) {
    L.push('- 1週間の型：');
    for (const r of shape) L.push(`  - ${r.day}：${r.body}`);
  }
  L.push('');

  L.push('## 6. 作らないもの');
  for (const o of OUT_OF_SCOPE) L.push(`- ${o}`);
  L.push('');

  L.push('## 7. 作る順番');
  L.push('1. 骨組み（Vite + React、下部ナビ、ストア、保存）と `settings` 画面。ここで一度ビルドを通す。');
  L.push('2. 問題データの読み込みと **一問一答**。ここまでで実際に1問解けるようにする。');
  const rest = screens.filter((s) => !['home', 'quiz', 'settings'].includes(s.id));
  rest.forEach((s, i) => L.push(`${i + 3}. **${s.title}**`));
  L.push(`${rest.length + 3}. **ホーム**（今日やること1つ＋復習の件数）。最後に作る——他の画面が出そろわないと、何を出すか決まらないため。`);
  L.push('');

  L.push('## 8. テスト（必ず作ってください）');
  L.push('`node --test test/*.test.mjs` で動く、外部ライブラリ無しのテストにしてください。');
  L.push('- 問題データの検査：`answer` が `choices` の範囲内にある（**0始まりの取り違えがいちばん多い**）。');
  L.push('- `type` が `ox` の問題は選択肢がちょうど2つ。`choice` は2つ以上。');
  L.push('- `question` と `explanation` が空でない。');
  L.push('- 同じ問題文の問題が2つ無い（正規化して比べる）。');
  L.push('- 保存 → 読み込みで、記録が同じ形で戻る。');
  L.push('- 日付の関数が、時刻帯をまたいでも前日にならない。');
  const ids = new Set(screens.map((s) => s.id));
  if (ids.has('review')) L.push('- 復習の間隔：○が続くと伸び、×で短くなる（境目の値も試す）。');
  if (ids.has('timer')) L.push('- タイマー：残り時間が「終わる時刻」から計算されている（時刻を進めて確かめる）。');
  L.push('');

  L.push('## 9. これで完成（完成条件）');
  L.push('全部に○が付いたら完成です。**読み取れないものは○にしないでください。**');
  for (const d of doneWhen(plan)) L.push(`- [ ] ${d}`);
  L.push('');

  L.push('## 10. 気をつけてほしいこと');
  for (const c of COPYRIGHT_NOTE) L.push(`- ${c}`);
  L.push('- 毎年変わる数値と法改正があります。**アプリが自動で最新にできるふりをしないでください。**');
  L.push('  できるのは「※要確認の問題を集めて、確かめた日を記録する」ところまでです。');
  L.push('- 合否の予測や「あと◯時間で受かります」は出さないでください（手元に無い基準が要るため）。');
  L.push('');

  L.push('---');
  L.push('');
  L.push('## 付録：もとになった学習計画書');
  L.push('（設計の根拠です。矛盾があればこちらを正としてください。）');
  L.push('');
  L.push(planMarkdown(plan, state));
  return L.join('\n');
}
