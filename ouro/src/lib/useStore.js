// アプリ全体の状態。保存・実行・監査の窓口をここ1つに集約する。
//
// 画面（components/*.jsx）は保存キーを直接触らない。必ずこのフック経由。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KEYS, load, loadMany, save, exportAll, importAll, flushNow, isPartial, onExternalChange,
  requestPersistent, adoptFullList,
} from './storage.js';
import * as perf from './perf.js';
import { afterPaint, whenIdle } from './idle.js';
import { makeSettings } from './defaults.js';

import {
  createTask,
  applyStepResult,
  nextGroup,
  assembleResult,
  retryFailed,
  redoFrom,
  flagTask as flagTaskFn,
  unflagTask,
  isFlagged,
  overRedoLimit,
  resetRedoCount,
  REDO_LIMIT,
  finalOutput,
  holdTask as holdTaskFn,
  resumeTask as resumeTaskFn,
  isRunnable,
} from './workflow.js';
import { runStep, distill, extractUrls } from './runtime.js';
import { createKnowledge, makeSource, markUsed, markVerified, orphanSourceIds } from './knowledge.js';
import { makeEntry, appendAudit, foldAudit, totalCost } from './audit.js';
import { decisionsFrom, decideDecision } from './decisions.js';
import { addNote, removeNote, notesOf } from './memory.js';
import { normalizeRules, addRule, removeRule } from './rules.js';
import { makeFunnel, normalizeFunnel } from './funnel.js';

// 朝会・会議の材料・相談・関係する仕事は、**押した時にだけ**要る。
// 起動時に読む量を増やさないよう、使う場所で読み込む（項目01と同じ考え方）。
const loadTeamwork = () =>
  Promise.all([
    import('./board.js'),
    import('./meeting.js'),
    import('./related.js'),
    import('./standup.js'),
    import('./briefing.js'),
    import('./consult.js'),
    import('./pitfalls.js'),
  ]).then(([board, meeting, related, standup, briefing, consult, pitfalls]) => ({
    ...board,
    ...meeting,
    ...related,
    ...standup,
    ...briefing,
    ...consult,
    ...pitfalls,
  }));
import { checkAction, addCost, spentThisMonthOf } from './permissions.js';
import { createDeal } from './revenue.js';
import { newId } from './id.js';
import { workflowById } from '../data/workflows.js';
import { providerById } from './providers/index.js';
import { makeGenre, DEFAULT_GENRE_ID } from '../data/genres.js';
import { loadCharacterDetails } from '../data/characters.js';
import { makeEvent } from './schedule.js';

// 新項目04：初期データの組み立て（seed.js）と社員プリセット（data/employees.js）は
// 「会社を作る」「社員を雇う」時にしか要らない。毎回の起動で読むのをやめ、
// 使う直前に読み込む。読み込みは1回だけ（Promise を使い回す）。
let rosterMod = null;
function loadRoster() {
  if (!rosterMod) {
    rosterMod = Promise.all([import('./seed.js'), import('../data/employees.js')])
      .then(([seed, employees]) => ({ ...seed, presetEmployee: employees.presetEmployee }))
      .catch((e) => {
        rosterMod = null; // 次に呼ばれた時にやり直せるようにする
        throw e;
      });
  }
  return rosterMod;
}

// 最初の画面（ホーム）を描くのに要るもの
const FIRST_KEYS = [
  KEYS.company, KEYS.settings, KEYS.employees, KEYS.tasks, KEYS.knowledge,
  KEYS.deals, KEYS.events, KEYS.genres, KEYS.approvals, KEYS.secrets,
  // 事業（実行中は1つだけ）。ホームの「今日やる1つ」がここから出るので後回しにできない。
  // 件数は多くても数十なので、最初のひと組に入れても起動は重くならない。
  KEYS.ventures,
  // 道具を切ってあるかどうかは**実行の判定に使う**ので、後回しにできない。
  // 読み込み前は空＝「全部使える」になり、切ったはずの道具が使われてしまう。
  // 数件しか無いので、最初のひと組に入れても起動は重くならない。
  KEYS.connections,
];
// 新項目09：起動時に読む操作履歴の件数。画面に出るのは最近のぶんだけなので、
// 全件（最大2000）を読まずに新しい方から400件だけ読む。
// 「すべて読み込む」を押した時と、畳む時だけ全件を読む。
export const AUDIT_PAGE = 400;

// 起動時に読む仕事の件数。1件が手順の本文をまるごと抱えるので、
// 全部読むと使い込むほど起動が遅くなる（実測 600件で 377ms → 962ms）。
// ホームに要るのは進行中のものと今日の完了だけ。古いものは仕事の一覧で読み足す。
export const TASK_PAGE = 120;

// 古い記録を畳む間隔（新項目08）。畳む対象は30日より古い記録なので、
// 起動のたびに確かめる必要はない。
const FOLD_EVERY_MS = 24 * 60 * 60 * 1000;

// 開くまで見えないもの（操作履歴は最大2000件あるので、必ず後回しにする）
const REST_KEYS = [
  KEYS.departments, KEYS.sources, KEYS.meetings, KEYS.audit,
  // 収益導線の数字。ホームは「詰まっている所」を1行出すだけなので後回しでよい。
  KEYS.funnel,
  // 社内掲示板。仕事の実行時に読むので、実行より前に揃っていればよい。
  KEYS.board,
  // つまずき集（役職別の失敗）。掲示板と同じく実行より前に揃っていればよい。
  KEYS.pitfalls,
  // 発信ログ。事業の画面とホームの「今日やる1つ」で使う。
  // **読み込みが済むまで「まだ出していない」と言い切らないこと**
  // （空配列のまま判定すると、出した日でも「未」と出る）。
  KEYS.posts,
];
const FIRST_FALLBACKS = Object.fromEntries(FIRST_KEYS.map((k) => [k, k === KEYS.company ? null : k === KEYS.settings || k === KEYS.secrets ? {} : []]));
// 収益導線だけは配列ではなくオブジェクト（週の数字をまとめて持つ）
const REST_FALLBACKS = Object.fromEntries(REST_KEYS.map((k) => [k, k === KEYS.funnel ? makeFunnel() : []]));

const EMPTY = {
  company: null,
  departments: [],
  employees: [],
  tasks: [],
  meetings: [],
  knowledge: [],
  sources: [],
  deals: [],
  approvals: [],
  audit: [],
  connections: [],
  genres: [],
  events: [],
  ventures: [],
  posts: [],
  funnel: makeFunnel(),
  pitfalls: [],
  board: [],
  settings: makeSettings(),
  secrets: {},
};

export function useStore() {
  const [state, setState] = useState(EMPTY);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(null); // { taskId } | { meetingId }
  // 項目26・27：実行中の担当と、いま流れてきている途中の文字。
  // 保存はしない（1文字ごとに書くと保存が跳ねる）。画面表示だけに使う。
  const [live, setLive] = useState(null); // { taskId, stepId, employeeName, text }
  // 実行系（runTask など）は setState の反映を待たずに続きを読む必要があるため、
  // 最新の状態を ref にも同期で持つ。**更新は必ず put/log を通すこと**
  // （直接 setState すると ref が古いままになり、作った直後の仕事が
  //  「見つからない」扱いになる）。
  const stateRef = useRef(state);

  // ---- 読み込み・設立 ----
  //
  // 起動を速くするため2段階に分ける（項目03・05）。
  //   ① ホームに要るものだけ読んで、すぐ描く
  //   ② 残り（操作履歴・出典など、開くまで見えないもの）を後から追いつかせる
  // ②の最中にユーザーが触ったキーは touchedRef に入るので、上書きしない。

  const touchedRef = useRef(new Set());
  // 2段階読み込みの「まだ読めていない」時間帯を表す。
  // この間に REST_KEYS を保存すると、まだ空の配列でディスクを上書きしてしまい、
  // 保存済みの操作履歴などが丸ごと消える。読み終わるまで保存を止める。
  const hydratedRef = useRef(false);
  // その時間帯に積まれた操作履歴（追記しかしないので、あとから足せる）
  const preAuditRef = useRef([]);
  // 古い記録を畳む処理（新項目08）は1回の起動につき1度だけ
  const foldedRef = useRef(false);
  // いま走っているAI実行の中止スイッチ（新項目20）
  const abortRef = useRef(null);
  // 会議の実行は decideApproval より後で定義されるので、ref 経由で呼ぶ
  // （承認したその場で会議を始めるため）
  const runMeetingRef = useRef(() => {});

  useEffect(() => {
    let alive = true;
    perf.mark('boot');

    const asArray = (v) => (Array.isArray(v) ? v : []);

    (async () => {
      const seeded = await load(KEYS.seeded, false);

      // ── 初回：storage を往復せず、その場で会社を作って即描画する ──
      // 以前は「保存してから読み直す」形だったため、18人の生成と13キーの
      // 書き込みが1フレームに集中して414ms固まっていた。
      if (!seeded) {
        // サーバーを持たず端末の中だけにデータがあるので、
        // 「容量が足りない時に消さないでほしい」とブラウザに頼んでおく。
        // 断られても動作には影響しないので、結果は待たない。
        requestPersistent().catch(() => {});
        const { seedAll } = await loadRoster();
        if (!alive) return;
        const fresh = seedAll();
        const next = {
          ...EMPTY,
          company: fresh.company,
          departments: fresh.departments,
          employees: fresh.employees,
          settings: fresh.settings,
        };
        if (!alive) return;
        // 初回はディスクに何も無いので、読み込み待ちの状態は無い
        hydratedRef.current = true;
        stateRef.current = next;
        setState(next);
        setReady(true);
        perf.measure('boot', 'boot');
        // 保存は描画のあと、空き時間に回す（storage.js がまとめて書く）
        save(KEYS.company, fresh.company);
        save(KEYS.departments, fresh.departments);
        save(KEYS.employees, fresh.employees);
        save(KEYS.settings, fresh.settings);
        save(KEYS.seeded, true);
        return;
      }

      // ── 2回目以降：まず最初の画面に要るものだけ ──
      const first = await loadMany(FIRST_KEYS, FIRST_FALLBACKS, { [KEYS.tasks]: TASK_PAGE });
      if (!alive) return;
      // **FIRST_KEYS から作ること。** ここを手書きの一覧にしていたせいで、
      // 新しいキー（事業）を FIRST_KEYS に足しても読み込まれず、
      // 作った事業が再起動のたびに消えた（実際に踏んだ）。
      // 特別扱いが要るのは会社・設定・APIキーの3つだけ。
      const next = { ...EMPTY };
      for (const key of FIRST_KEYS) {
        if (key === KEYS.company) next.company = migrateCompany(first[key]);
        else if (key === KEYS.settings) next.settings = { ...makeSettings(), ...(first[key] || {}) };
        else if (key === KEYS.secrets) next.secrets = first[key] || {};
        else next[keyName(key)] = asArray(first[key]);
      }
      stateRef.current = next;
      setState(next);
      setReady(true);
      perf.measure('boot', 'boot');

      // 項目28：前回、実行中のまま閉じられた仕事は「待機」に戻す。
      // running のままだと、戻ってきても永遠に回り続けているように見える。
      const revived = next.tasks.map((t) =>
        (t.steps || []).some((x) => x.status === 'running')
          ? {
              ...t,
              status: 'queued',
              steps: t.steps.map((x) =>
                x.status === 'running' ? { ...x, status: 'pending', startedAt: null } : x
              ),
            }
          : t
      );
      if (revived.some((t, i) => t !== next.tasks[i])) {
        // **新しいオブジェクトを作ること。** 同じ参照のまま setState すると
        // React が「変化なし」と判断して描き直さず、実行中の表示が残る。
        const fixed = { ...stateRef.current, tasks: revived };
        stateRef.current = fixed;
        setState(fixed);
        save(KEYS.tasks, revived);
      }

      // ── 残りを追いつかせる ──
      // 新項目06：最初の画面を描き終えて、手が空いてから読む。
      // ここを詰めて走らせると、起動直後に触った時だけ固まって見える。
      await afterPaint();
      await whenIdle(1500);
      if (!alive) return;
      const rest = await loadMany(REST_KEYS, REST_FALLBACKS, { [KEYS.audit]: AUDIT_PAGE });
      if (!alive) return;
      const merged = { ...stateRef.current };
      for (const key of REST_KEYS) {
        if (key === KEYS.audit) {
          // 履歴は追記しかしないので、読み込んだぶんに「待っていたぶん」を足す。
          // 単純に上書きすると、この間の操作が記録から消える。
          let audit = asArray(rest[key]);
          for (const e of preAuditRef.current) audit = appendAudit(audit, e);
          merged.audit = audit;
          continue;
        }
        // ②の最中に触られたキーは、読み込んだ古い値で上書きしない
        if (touchedRef.current.has(key)) continue;
        // **収益導線だけは配列ではなくオブジェクト。**
        // ここで asArray に通すと、起動のたびに空配列で上書きされ、
        // 次に数字を1件入れた時点で、これまでの週が全部消える。
        if (key === KEYS.funnel) {
          merged.funnel = normalizeFunnel(rest[key]);
          continue;
        }
        merged[keyName(key)] = asArray(rest[key]);
      }
      hydratedRef.current = true;
      stateRef.current = merged;
      setState(merged);

      // 待たせていたぶんをここで保存する
      if (preAuditRef.current.length) {
        save(KEYS.audit, merged.audit, 'low');
        preAuditRef.current = [];
      }
      for (const key of REST_KEYS) {
        if (key !== KEYS.audit && touchedRef.current.has(key)) {
          save(key, stateRef.current[keyName(key)]);
        }
      }

      // 新項目08：手が空いたら、古い記録を日ごとに1件へ畳む。
      // 畳むには全件が要るので、ここでだけ全部読む（起動の速さには影響しない）。
      //
      // **毎回の起動では走らせない。** 走らせると、せっかく新しい400件だけ読んだのに
      // 数秒後に全件を読み直すことになり、ページングの意味が無くなる。
      // 1日に1度で十分（畳む対象は30日より古い記録なので、急ぐ理由が無い）。
      const lastFold = Number(stateRef.current.settings?.lastAuditFold) || 0;
      const dueForFold = Date.now() - lastFold > FOLD_EVERY_MS;
      if (!foldedRef.current && dueForFold && isPartial(KEYS.audit)) {
        foldedRef.current = true;
        await whenIdle(6000);
        if (!alive) return;
        try {
          await flushNow(); // 古い配列が後から書かれて消えるのを防ぐ
          const full = await load(KEYS.audit, [], 0, false);
          if (!alive) return;
          // 全件を読んでいる最中に積まれた記録は、まだディスクに無いことがある。
          // 読んだぶんに、手元にしか無いものを足してから畳む。
          const onDisk = new Set(full.map((e) => e && e.id));
          const merging = [...full, ...stateRef.current.audit.filter((e) => e && !onDisk.has(e.id))].sort(
            (a, b) => (a.at || 0) - (b.at || 0)
          );
          const { list, folded } = foldAudit(merging);
          // **畳めた／畳めなかったに関わらず、必ず手元を全件に合わせる。**
          // ここで全件を読んだ時点で「一部だけ読み込み」の印が外れるので、
          // 手元が400件のままだと、次に記録を1件足した瞬間に
          // 「残り1600件は消された」と判断されてディスクから消える。
          const withAudit = { ...stateRef.current, audit: list };
          stateRef.current = withAudit;
          setState(withAudit);
          // 手元が全件になったあとで印を外す（順番が逆だと読んでいない分が消える）
          adoptFullList(KEYS.audit, list);
          if (folded > 0) save(KEYS.audit, list, 'low');
          // 次に畳むのは1日後
          const settings = { ...stateRef.current.settings, lastAuditFold: Date.now() };
          stateRef.current = { ...stateRef.current, settings };
          setState(stateRef.current);
          save(KEYS.settings, settings, 'low');
        } catch {
          /* 畳めなくても動作には支障がないので黙って諦める */
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // ── 新項目12：他のタブでの保存を取り込む ──
  //
  // 同じ端末で2つ開いていると、片方で雇った社員がもう片方に出ない。
  // 変わったキーの名前だけが届くので、こちらで読み直して画面に反映する。
  // **読み直した結果を保存し返さない**（往復して書き合いになるため）。
  useEffect(() => {
    const stop = onExternalChange(async (keys) => {
      if (!hydratedRef.current) return; // まだ読み込み中は触らない
      for (const key of keys) {
        if (key === KEYS.secrets || key === KEYS.seeded) continue; // APIキーは持ち回らない
        const name = keyName(key);
        if (!name || !(name in stateRef.current)) continue;
        try {
          // eslint-disable-next-line no-await-in-loop
          const value = await load(key, undefined, key === KEYS.audit ? AUDIT_PAGE : 0);
          if (value === undefined) continue;
          stateRef.current = { ...stateRef.current, [name]: value };
          setState(stateRef.current);
        } catch {
          /* 読めなければそのまま（次の操作で追いつく） */
        }
      }
    });
    return stop;
  }, []);

  /**
   * 今月のAI費用（USD）。上限の判定に使う。
   * **操作履歴から数え直さない。** 履歴は起動時に新しい400件しか読まないので、
   * 数え直すと実際より小さく出て、上限が効かなくなる。設定に積み上げた値を使う。
   */
  const spentThisMonth = useCallback(() => spentThisMonthOf(stateRef.current.settings), []);

  // 保存つきの更新。key に対応する値だけを書く。
  // ref を先に更新してから setState することで、同じ処理の中で続けて
  // stateRef.current を読んでも最新が返る。
  const put = useCallback((key, value) => {
    touchedRef.current.add(key);
    stateRef.current = { ...stateRef.current, [keyName(key)]: value };
    setState(stateRef.current);
    // まだ読み込めていないキーは保存しない（空の配列で上書きしないため）
    if (!hydratedRef.current && REST_KEYS.includes(key)) return;
    save(key, value);
  }, []);

  const log = useCallback((entry) => {
    touchedRef.current.add(KEYS.audit);
    const made = makeEntry(entry);
    // 一部だけ読み込んでいる間は畳まない（畳んだ元がディスクに残ってしまうため）
    const next = appendAudit(stateRef.current.audit, made, { fold: !isPartial(KEYS.audit) });
    // 費用は履歴と別に積み上げる（履歴は一部しか読まないので数え直せない）
    const settings = made.cost > 0 ? addCost(stateRef.current.settings, made.cost) : stateRef.current.settings;
    stateRef.current = { ...stateRef.current, audit: next, settings };
    setState(stateRef.current);
    if (made.cost > 0) save(KEYS.settings, settings, 'low');
    // 読み込みが終わる前は保存を待つ。ここで書くと、まだ空の履歴で
    // 保存済みの履歴を消してしまう。読み終わってから足す。
    if (!hydratedRef.current) {
      preAuditRef.current.push(made);
      return;
    }
    // 新項目07：記録として積むだけなので急がない。まとめて書く。
    save(KEYS.audit, next, 'low');
  }, []);

  // ---- 社内掲示板（社員どうしの共通記憶）----
  //
  // **30日で消える。** 溜めるためではなく「新しいものだけが見える」ための場所。
  // 保存の前に必ず古いものを落とす（放っておくと読まれない掲示板になる）。
  const addBoardPost = useCallback(async (post) => {
    const { makePost, addPost, prunePosts } = await loadTeamwork();
    const made = makePost(post);
    if (!made.text) return null;
    const next = prunePosts(addPost(stateRef.current.board, made));
    stateRef.current = { ...stateRef.current, board: next };
    setState(stateRef.current);
    touchedRef.current.add(KEYS.board);
    // 読み込みが済むまで保存しない（空の配列で上書きしないため）
    if (hydratedRef.current) save(KEYS.board, next, 'low');
    return made;
  }, []);

  const removeBoardPost = useCallback(async (id) => {
    const { removePost } = await loadTeamwork();
    const next = removePost(stateRef.current.board, id);
    stateRef.current = { ...stateRef.current, board: next };
    setState(stateRef.current);
    touchedRef.current.add(KEYS.board);
    if (hydratedRef.current) save(KEYS.board, next, 'low');
    return next;
  }, []);

  /**
   * つまずき集に1件足す（新規・AIを呼ばない）。
   * 失敗した手順から自動で呼ばれるほか、画面から手でも足せる。
   */
  const addPitfallEntry = useCallback(async (item) => {
    const { makePitfall, addPitfall } = await loadTeamwork();
    const made = item && item.id ? item : makePitfall(item || {});
    if (!made.text) return null;
    const next = addPitfall(stateRef.current.pitfalls, made);
    stateRef.current = { ...stateRef.current, pitfalls: next };
    setState(stateRef.current);
    touchedRef.current.add(KEYS.pitfalls);
    if (hydratedRef.current) save(KEYS.pitfalls, next, 'low');
    return made;
  }, []);

  const removePitfallEntry = useCallback(async (id) => {
    const { removePitfall } = await loadTeamwork();
    const next = removePitfall(stateRef.current.pitfalls, id);
    stateRef.current = { ...stateRef.current, pitfalls: next };
    setState(stateRef.current);
    touchedRef.current.add(KEYS.pitfalls);
    if (hydratedRef.current) save(KEYS.pitfalls, next, 'low');
    return next;
  }, []);

  /** 失敗した手順を、つまずき集へ回す。 */
  const recordPitfall = useCallback(
    async (step, task, employee) => {
      const { fromFailedStep } = await loadTeamwork();
      // 役職名は表示のためだけなので、ここで取りに行く
      // （useStore が data/roles.js を抱えると起動時に読む量が増える）。
      const { roleById } = await import('../data/roles.js');
      const role = roleById(step.roleId);
      const made = fromFailedStep(
        { ...step, employeeName: (employee && employee.name) || step.employeeName },
        task,
        role ? role.name : ''
      );
      if (!made) return null;
      return addPitfallEntry(made);
    },
    [addPitfallEntry]
  );

  /**
   * 操作履歴を全部読み込む（新項目09）。
   * 起動時は新しい400件だけなので、古いぶんを見たい時にこれを呼ぶ。
   */
  /** 古い仕事も全部読み込む（新規）。起動時は新しい120件だけ読んでいる。 */
  const loadAllTasks = useCallback(async () => {
    // **先に書き残しを片付ける。**
    // save() は「呼んだ時点の配列」を持って待つ。全件を手元に入れたあとで
    // その古い配列（一部だけ）が書き込まれると、読んでいない分が消える
    // （実際に 300件 → 120件 になった）。印が付いているうちに書き切らせる。
    await flushNow();
    // track:false で読む（この時点では「一部だけ」の印を外さない）
    const full = await load(KEYS.tasks, [], 0, false);
    // **手元にあるものを優先する。** 読んでいる間も実行は進んでいて、
    // ディスク側は1つ前の状態のことがある。古い方で上書きすると、
    // いま書き込まれた手順の結果が巻き戻る。
    const mine = new Map(stateRef.current.tasks.filter(Boolean).map((t) => [t.id, t]));
    const merged = [
      ...stateRef.current.tasks.filter(Boolean),
      ...full.filter((t) => t && !mine.has(t.id)),
    ];
    stateRef.current = { ...stateRef.current, tasks: merged };
    setState(stateRef.current);
    // 手元が全件になった**あと**で印を外す（順番を逆にすると読んでいない分が消える）
    adoptFullList(KEYS.tasks, merged);
    return merged.length;
  }, []);

  const loadAllAudit = useCallback(async () => {
    await flushNow(); // 古い配列が後から書かれて消えるのを防ぐ（上と同じ理由）
    const full = await load(KEYS.audit, [], 0, false);
    const onDisk = new Set(full.map((e) => e && e.id));
    const merged = [...full, ...stateRef.current.audit.filter((e) => e && !onDisk.has(e.id))].sort(
      (a, b) => (a.at || 0) - (b.at || 0)
    );
    stateRef.current = { ...stateRef.current, audit: merged };
    setState(stateRef.current);
    adoptFullList(KEYS.audit, merged);
    return merged.length;
  }, []);

  // ---- 社員 ----
  const hireEmployee = useCallback(
    async (preset) => {
      const { makeEmployee } = await loadRoster();
      const emp = makeEmployee(preset);
      const next = [...stateRef.current.employees, emp];
      put(KEYS.employees, next);
      log({ actor: 'user', action: 'employeeHired', target: emp.name });
      return emp;
    },
    [put, log]
  );

  // 新項目03：人物像・書き方は別ファイルなので、雇う前に読み込みを待つ。
  // 起動後の空き時間にも読んであるので、通常この await は即座に返る。
  const hireIntoRole = useCallback(
    async (roleId, genreId = DEFAULT_GENRE_ID) => {
      const [{ presetForNextSeat }] = await Promise.all([
        loadRoster(),
        loadCharacterDetails().catch(() => {}),
      ]);
      const s = stateRef.current;
      const preset = presetForNextSeat(s.employees, roleId, genreId, s.genres);
      return preset ? hireEmployee(preset) : null;
    },
    [hireEmployee]
  );

  /** 名前つきのキャラクター（会社チーム①〜⑩）を雇う。既に在籍していれば何もしない。 */
  const hireCharacter = useCallback(
    async (roleId, seat) => {
      const [{ presetEmployee }] = await Promise.all([
        loadRoster(),
        loadCharacterDetails().catch(() => {}),
      ]);
      const s = stateRef.current;
      const already = s.employees.find(
        (e) =>
          e.roleId === roleId &&
          e.seat === seat &&
          (e.genreId || DEFAULT_GENRE_ID) === DEFAULT_GENRE_ID &&
          !e.archivedAt
      );
      if (already) return already;
      const preset = presetEmployee(roleId, seat, DEFAULT_GENRE_ID, s.genres);
      return preset ? hireEmployee(preset) : null;
    },
    [hireEmployee]
  );

  // ── ジャンル ──
  const addGenre = useCallback(
    ({ name, reading, glyph, desc }) => {
      const genre = makeGenre({ name, reading, glyph, desc });
      put(KEYS.genres, [...stateRef.current.genres, genre]);
      log({ actor: 'user', action: 'genreAdded', target: genre.name });
      return genre;
    },
    [put, log]
  );

  const removeGenre = useCallback(
    (genreId) => {
      const s = stateRef.current;
      // そのジャンルに社員が残っているうちは消させない（所属が迷子になるため）
      if (s.employees.some((e) => e.genreId === genreId && !e.archivedAt)) {
        throw new Error('このジャンルにはまだ社員がいます。先に休職にしてください');
      }
      put(KEYS.genres, s.genres.filter((g) => g.id !== genreId));
    },
    [put]
  );

  // ── カレンダーの予定 ──
  const addEvent = useCallback(
    (data) => {
      const ev = makeEvent(data);
      put(KEYS.events, [...stateRef.current.events, ev]);
      return ev;
    },
    [put]
  );

  const updateEvent = useCallback(
    (id, patch) => {
      put(KEYS.events, stateRef.current.events.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    },
    [put]
  );

  const removeEvent = useCallback(
    (id) => put(KEYS.events, stateRef.current.events.filter((e) => e.id !== id)),
    [put]
  );

  const updateEmployee = useCallback(
    (id, patch) => {
      const next = stateRef.current.employees.map((e) => (e.id === id ? { ...e, ...patch } : e));
      put(KEYS.employees, next);
    },
    [put]
  );

  /**
   * 社員を育てる（新規）。「次からはこうして」を1行だけ覚えさせる。
   * 次にその社員が動くとき、buildContext が必ず読む。
   */
  const teachEmployee = useCallback(
    (employeeId, text, taskId = null) => {
      const emp = stateRef.current.employees.find((e) => e.id === employeeId);
      if (!emp || !String(text || '').trim()) return null;
      const notes = addNote(emp, text, taskId);
      updateEmployee(employeeId, { memory: { ...(emp.memory || {}), notes } });
      log({ actor: 'user', action: 'employeeTaught', target: emp.name, detail: String(text).slice(0, 120) });
      return notes;
    },
    [updateEmployee, log]
  );

  const forgetEmployeeNote = useCallback(
    (employeeId, noteId) => {
      const emp = stateRef.current.employees.find((e) => e.id === employeeId);
      if (!emp) return null;
      const notes = removeNote(emp, noteId);
      updateEmployee(employeeId, { memory: { ...(emp.memory || {}), notes } });
      return notes;
    },
    [updateEmployee]
  );

  /** 会社のルール（CLAUDE.md にあたるもの）。消せない決まりは触らない。 */
  const updateRules = useCallback(
    (patch) => {
      const co = stateRef.current.company;
      if (!co) return null;
      const rules = { ...normalizeRules(co.rules), ...patch, updatedAt: Date.now() };
      put(KEYS.company, { ...co, rules });
      return rules;
    },
    [put]
  );

  const addCompanyRule = useCallback(
    (text) => {
      const co = stateRef.current.company;
      if (!co) return null;
      const rules = addRule(co.rules, text);
      put(KEYS.company, { ...co, rules });
      log({ actor: 'user', action: 'ruleAdded', target: String(text).slice(0, 120) });
      return rules;
    },
    [put, log]
  );

  const removeCompanyRule = useCallback(
    (text) => {
      const co = stateRef.current.company;
      if (!co) return null;
      const rules = removeRule(co.rules, text);
      put(KEYS.company, { ...co, rules });
      return rules;
    },
    [put]
  );

  /** 収益導線：今週の数字を入れる／消す（新規）。端末内だけに残る。 */
  // 週の数字を書く処理は導線の画面でしか要らないので、押した時に読む
  // （起動時に読む量を増やさないため）。
  const putFunnelEntry = useCallback(
    async (entry) => {
      const { putEntry } = await import('./funnelInput.js');
      const next = putEntry(stateRef.current.funnel, entry);
      put(KEYS.funnel, next);
      log({ actor: 'user', action: 'funnelEntry', target: new Date(entry.weekStart || Date.now()).toLocaleDateString('ja-JP') });
      return next;
    },
    [put, log]
  );

  const removeFunnelEntry = useCallback(
    async (id) => {
      const { removeEntry } = await import('./funnelInput.js');
      const next = removeEntry(stateRef.current.funnel, id);
      put(KEYS.funnel, next);
      return next;
    },
    [put]
  );

  const renameFunnelStage = useCallback(
    (stageId, name) => {
      const cur = stateRef.current.funnel || makeFunnel();
      const labels = { ...(cur.labels || {}) };
      const clean = String(name || '').trim().slice(0, 20);
      if (clean) labels[stageId] = clean;
      else delete labels[stageId];
      put(KEYS.funnel, { ...cur, labels, updatedAt: Date.now() });
    },
    [put]
  );

  // ---- 事業（ベンチャー）と発信ログ ----
  //
  // **どちらも動的 import で読む。** 起動時に読む量を増やさないため
  // （venture.js は revenue.js を使うので、静的に書くと最初のひと束に混ざる）。
  // 呼び出し側は await しなくてよい（画面の更新は put が行う）。

  const addVenture = useCallback(
    async (data) => {
      const { makeVenture, canStart } = await import('./venture.js');
      const made = makeVenture(data);
      // 「実行中」で作ろうとした時も、選択と集中の錠を通す
      if (made.state === 'running' && !canStart(stateRef.current.ventures, made.id).ok) {
        made.state = 'idea';
        made.startedAt = null;
      }
      put(KEYS.ventures, [made, ...stateRef.current.ventures]);
      log({ actor: 'user', action: 'ventureCreated', target: made.title });
      return made;
    },
    [put, log]
  );

  const updateVenture = useCallback(
    (id, patch) => {
      put(
        KEYS.ventures,
        stateRef.current.ventures.map((v) => (v.id === id ? { ...v, ...patch, id: v.id, updatedAt: Date.now() } : v))
      );
    },
    [put]
  );

  const removeVenture = useCallback(
    (id) => {
      const v = stateRef.current.ventures.find((x) => x.id === id);
      put(KEYS.ventures, stateRef.current.ventures.filter((x) => x.id !== id));
      if (v) log({ actor: 'user', action: 'ventureRemoved', target: v.title });
    },
    [put, log]
  );

  /**
   * 状態を変える。**「実行中」にできるのは1つだけ**（選択と集中）。
   * すでに別の事業が実行中なら、勝手に入れ替えずに断る
   * （どちらを休止にするかは人が決めること）。
   * @returns {{ok:boolean, blocker:object|null}}
   */
  const setVentureState = useCallback(
    async (id, state) => {
      const { canStart } = await import('./venture.js');
      if (state === 'running') {
        const check = canStart(stateRef.current.ventures, id);
        if (!check.ok) return check;
      }
      const now = Date.now();
      put(
        KEYS.ventures,
        stateRef.current.ventures.map((v) => {
          if (v.id !== id) return v;
          // 実行中にした時だけ日数を数え始める（休止から戻した時は続きから）
          const startedAt = state === 'running' ? v.startedAt || now : v.startedAt;
          return { ...v, state, startedAt, updatedAt: now };
        })
      );
      log({ actor: 'user', action: 'ventureState', target: state });
      return { ok: true, blocker: null };
    },
    [put, log]
  );

  /** 撤退・継続の判断（続ける／やめる／延長）。AIは呼ばない。 */
  const decideVenture = useCallback(
    async (id, decision, extraDays = 14) => {
      const { applyDecision } = await import('./verdict.js');
      const cur = stateRef.current.ventures.find((v) => v.id === id);
      if (!cur) return null;
      const next = applyDecision(cur, decision, extraDays);
      put(KEYS.ventures, stateRef.current.ventures.map((v) => (v.id === id ? next : v)));
      log({ actor: 'user', action: 'ventureDecision', target: `${cur.title}／${decision}` });
      return next;
    },
    [put, log]
  );

  const addSharePost = useCallback(
    async (data) => {
      const posts = await import('./posts.js');
      const made = posts.makePost(data);
      put(KEYS.posts, posts.addPost(stateRef.current.posts, made));
      log({ actor: 'user', action: 'postLogged', target: posts.channelName(made.channel) });
      return made;
    },
    [put, log]
  );

  const removeSharePost = useCallback(
    async (id) => {
      const { removePost } = await import('./posts.js');
      put(KEYS.posts, removePost(stateRef.current.posts, id));
    },
    [put]
  );

  const archiveEmployee = useCallback(
    (id) => {
      const emp = stateRef.current.employees.find((e) => e.id === id);
      updateEmployee(id, { archivedAt: Date.now() });
      if (emp) log({ actor: 'user', action: 'employeeArchived', target: emp.name });
    },
    [updateEmployee, log]
  );

  const activeEmployees = useMemo(
    () => state.employees.filter((e) => !e.archivedAt),
    [state.employees]
  );

  /**
   * 役職から担当を1人選ぶ。仕事の少ない席を優先（3人に均等に回るように）。
   * ジャンルが指定されていれば、その分野の社員を優先し、いなければ汎用へ落とす。
   */
  const assignFor = useCallback((roleId, genreId = null) => {
    const all = stateRef.current.employees.filter((e) => e.roleId === roleId && !e.archivedAt);
    if (!all.length) return null;
    const byLoad = (list) =>
      [...list].sort(
        (a, b) => (a.stats?.tasks || 0) - (b.stats?.tasks || 0) || (a.seat || 1) - (b.seat || 1)
      )[0];

    if (genreId) {
      const sameGenre = all.filter((e) => (e.genreId || DEFAULT_GENRE_ID) === genreId);
      if (sameGenre.length) return byLoad(sameGenre);
    }
    const general = all.filter((e) => (e.genreId || DEFAULT_GENRE_ID) === DEFAULT_GENRE_ID);
    return byLoad(general.length ? general : all);
  }, []);

  // ---- 仕事 ----
  const newTask = useCallback(
    ({
      request,
      workflowId = null,
      employeeId = null,
      dealId = null,
      ventureId = null,
      context = '',
      genreId = null,
      dueAt = null,
      deliverableSpec = '',
      doneWhen = '',
      materials = '',
      constraints = '',
    }) => {
      let forceRoles = null;
      if (employeeId) {
        const emp = stateRef.current.employees.find((e) => e.id === employeeId);
        if (emp) forceRoles = [emp.roleId];
      } else if (workflowId) {
        const wf = workflowById(workflowId);
        if (wf && wf.steps.length) forceRoles = wf.steps;
      }

      const task = createTask({
        request,
        forceRoles,
        dealId,
        ventureId,
        context,
        dueAt,
        deliverableSpec,
        doneWhen,
        materials,
        constraints,
        assign: (roleId, i) => {
          if (employeeId && i === 0) {
            return stateRef.current.employees.find((e) => e.id === employeeId) || assignFor(roleId, genreId);
          }
          return assignFor(roleId, genreId);
        },
      });

      const next = [task, ...stateRef.current.tasks];
      put(KEYS.tasks, next);
      log({ actor: 'user', action: 'taskCreated', target: task.title });
      return task;
    },
    [put, log, assignFor]
  );

  const patchTask = useCallback(
    (task) => {
      const next = stateRef.current.tasks.map((t) => (t.id === task.id ? task : t));
      put(KEYS.tasks, next);
      return task;
    },
    [put]
  );

  /**
   * 台帳で人が手で持つ3つ（期限・次の対応・保留理由）を書き換える（新規）。
   * 台帳は仕事から導くビューなので、書き込み先は必ず仕事の側になる。
   */
  const setTaskMeta = useCallback(
    (taskId, patch = {}) => {
      const task = stateRef.current.tasks.find((t) => t.id === taskId);
      if (!task) return null;
      const next = { ...task };
      if ('dueAt' in patch) next.dueAt = patch.dueAt || null;
      if ('nextAction' in patch) next.nextAction = String(patch.nextAction || '').slice(0, 120);
      if ('holdReason' in patch) next.holdReason = String(patch.holdReason || '').slice(0, 200);
      return patchTask(next);
    },
    [patchTask]
  );

  /** 保留にする／解く（新規）。 */
  const holdTask = useCallback(
    (taskId, reason = '') => {
      const task = stateRef.current.tasks.find((t) => t.id === taskId);
      if (!task) return null;
      const next = holdTaskFn(task, reason);
      if (next === task) return task;
      log({ actor: 'user', action: 'taskHeld', target: task.title, detail: reason });
      return patchTask(next);
    },
    [patchTask, log]
  );

  const resumeTask = useCallback(
    (taskId) => {
      const task = stateRef.current.tasks.find((t) => t.id === taskId);
      if (!task) return null;
      // 印のせいで止めた仕事は、ここからは解かない（印を外す方から解く）。
      // ここで解けてしまうと、印が付いたまま提出物の画面が戻ってくる。
      if (isFlagged(task)) return task;
      const next = resumeTaskFn(task);
      if (next === task) return task;
      log({ actor: 'user', action: 'taskResumed', target: task.title });
      return patchTask(next);
    },
    [patchTask, log]
  );

  /**
   * 社内への共有を1行書く（新規）。共有しないと台帳で「完了」にならない。
   * `waive` を true にすると「この仕事は共有なしでよい」と決められる
   * （押しても何も起きない行き止まりを作らないため、逃げ道は必ず残す）。
   */
  const shareTask = useCallback(
    async (taskId, text, waive = false) => {
      const task = stateRef.current.tasks.find((t) => t.id === taskId);
      if (!task) return null;
      // 外へ出せないと印を付けた仕事は、共有もしない（掲示板へ戻してしまうため）
      if (isFlagged(task)) return task;
      const line = String(text || '').trim();
      if (!waive && !line) return task;
      if (line) {
        const step = [...(task.steps || [])].reverse().find((x) => x.employeeId && x.kind !== 'check');
        await addBoardPost({
          text: line,
          kind: 'share',
          employeeId: step ? step.employeeId : null,
          employeeName: step ? step.employeeName || '' : '',
          roleId: step ? step.roleId : null,
          taskId,
        });
      }
      return patchTask({ ...task, shared: line || task.shared || '', shareWaived: Boolean(waive) });
    },
    [patchTask, addBoardPost]
  );

  /** 「あなたの判断が要ること」を1件決める（新規）。 */
  const decideTask = useCallback(
    (taskId, decisionId, state, note = '') => {
      const task = stateRef.current.tasks.find((t) => t.id === taskId);
      if (!task) return null;
      const next = decideDecision(task, decisionId, state, note);
      const item = (next.decisions || []).find((d) => d.id === decisionId);
      log({
        actor: 'user',
        action: state === 'approved' ? 'decisionApproved' : 'decisionRejected',
        target: task.title,
        detail: item ? item.text : '',
      });
      return patchTask(next);
    },
    [patchTask, log]
  );

  /**
   * 次の「かたまり」を実行する（新項目22）。
   *
   * 同じ group の手順は互いの結果を要らないので、同時に走らせる。
   * 指定の無い仕事では必ず1件だけなので、これまでと同じ動きになる。
   * 承認が要るときは approvals に積んで止まる。
   */
  const runNextStep = useCallback(
    async (taskId) => {
      const s = stateRef.current;
      const task = s.tasks.find((t) => t.id === taskId);
      if (!task) return null;
      const group = nextGroup(task);
      if (!group.length) return null;

      // 担当を先に全員そろえる。1人でも欠けていたら、その手順を失敗として返す。
      const assigned = [];
      for (const step of group) {
        const employee =
          s.employees.find((e) => e.id === step.employeeId) ||
          s.employees.find((e) => e.roleId === step.roleId && !e.archivedAt);
        if (!employee) {
          return patchTask(
            applyStepResult(task, step.id, { error: `${step.roleId} の担当社員がいません` })
          );
        }
        assigned.push({ step, employee });
      }

      // 課金の発生する実行は既定で承認を通す（かたまりの中で1人でも要れば止まる）
      const willCost = Object.keys(s.secrets).length > 0;
      if (willCost && !task.costApproved) {
        for (const { step, employee } of assigned) {
          const check = checkAction({
            employee,
            action: 'costly',
            settings: s.settings,
            spentThisMonth: spentThisMonth(),
          });
          if (!check.needsApproval) continue;
          const approval = {
            id: newId('apv'),
            taskId: task.id,
            employeeId: employee.id,
            action: 'costly',
            label: `${employee.name} が「${task.title}」を実行します（APIの利用料が発生します）`,
            risk: check.risk,
            status: 'pending',
            createdAt: Date.now(),
          };
          put(KEYS.approvals, [approval, ...s.approvals]);
          log({ actor: employee.id, action: 'approvalRequested', target: task.title });
          return patchTask({ ...task, status: 'awaiting_approval' });
        }
      }

      // 実行中に印をつける
      const runningIds = new Set(group.map((x) => x.id));
      patchTask({
        ...task,
        status: 'running',
        startedAt: task.startedAt || Date.now(),
        steps: task.steps.map((x) =>
          runningIds.has(x.id) ? { ...x, status: 'running', startedAt: Date.now() } : x
        ),
      });
      setBusy({ taskId });
      // 途中の文字は「いま1人だけ」を出す。同時に走っている時は先頭の担当を映す。
      setLive({ taskId, stepId: group[0].id, employeeName: assigned[0].employee.name, text: '' });

      // 新項目20：中止できるようにする。画面を離れた・やめた時に実際に止める。
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      abortRef.current = controller;

      // 社員どうしの共通記憶（掲示板）と、関係する仕事。
      // どちらも AI を呼ばずに作れるので、1つのかたまりにつき1回だけ組み立てる。
      const tw = await loadTeamwork();
      const boardText = tw.boardPrompt(s.board, { exceptTaskId: task.id });
      const relatedText = tw.relatedPrompt(tw.relatedTasks(task, s.tasks));

      const results = await Promise.all(
        assigned.map(async ({ step, employee }) => {
          perf.mark(`run:${step.id}`);
          try {
            const r = await runStep({
              employee,
              company: s.company,
              task,
              step,
              knowledgeList: s.knowledge,
              inherited: step.input,
              secrets: s.secrets,
              settings: s.settings,
              connections: s.connections,
              boardText,
              relatedText,
              // 同じ役職で過去に起きたつまずき（新しい3件だけ）
              pitfallText: tw.pitfallPrompt(s.pitfalls, step.roleId),
              signal: controller ? controller.signal : undefined,
              // 受け取った先から画面へ出す。ここでは保存しない。
              onDelta: (piece) =>
                setLive((cur) =>
                  cur && cur.stepId === step.id ? { ...cur, text: cur.text + piece } : cur
                ),
            });
            perf.measure(`run:${step.id}`, 'run');
            return { step, employee, result: r };
          } catch (e) {
            perf.measure(`run:${step.id}`, 'run');
            const aborted = e && (e.name === 'AbortError' || (controller && controller.signal.aborted));
            return {
              step,
              employee,
              result: { error: aborted ? '中止しました' : e.message || String(e), aborted },
            };
          }
        })
      );

      abortRef.current = null;
      setBusy(null);
      setLive(null);

      let updated = stateRef.current.tasks.find((t) => t.id === taskId) || task;
      for (const { step, employee, result } of results) {
        updated = applyStepResult(updated, step.id, result, stateRef.current.settings.handoffMode || 'compact');
        log({
          actor: employee.id,
          action: result.error ? 'stepFailed' : 'stepRun',
          target: task.title,
          detail:
            result.error ||
            `${result.providerName || 'ローカル'} / ${result.model || '—'}${result.cached ? '（前回と同じ内容）' : ''}`,
          cost: result.cost || 0,
        });

        // 社員の実績を更新
        updateEmployee(employee.id, {
          stats: {
            ...(employee.stats || {}),
            tasks: (employee.stats?.tasks || 0) + 1,
            tokens:
              (employee.stats?.tokens || 0) + ((result.usage?.input || 0) + (result.usage?.output || 0)),
            costUsd: (employee.stats?.costUsd || 0) + (result.cost || 0),
            lastActiveAt: Date.now(),
          },
        });

        // 使った知識に「使われた」印をつける（循環を数えるため）
        if (result.usedKnowledgeIds?.length) {
          const used = new Set(result.usedKnowledgeIds);
          put(
            KEYS.knowledge,
            stateRef.current.knowledge.map((k) => (used.has(k.id) ? markUsed(k) : k))
          );
        }
      }
      // 完了したら「他の人が知っておくべきこと」を1行だけ掲示板へ回す（AI費用ゼロ）。
      // 拾えなければ何も出さない——中身の無い掲示は、読まれない掲示板を作るだけ。
      let sharedLine = updated.shared || '';
      for (const { step, employee, result } of results) {
        if (result.error || step.kind === 'check') continue;
        // 外へ出せないと印を付けた仕事の中身は、掲示板にも回さない
        if (isFlagged(updated)) continue;
        const line = tw.extractShare(result.text);
        if (!line) continue;
        sharedLine = sharedLine || line;
        addBoardPost({
          text: line,
          kind: 'share',
          employeeId: employee.id,
          employeeName: employee.name,
          roleId: employee.roleId,
          taskId: task.id,
        });
      }
      if (sharedLine !== updated.shared) updated = { ...updated, shared: sharedLine };
      // この仕組みが動いている状態で終わった、という印。
      // 印の無い（＝昔の）仕事に共有を求めない（lib/ledger.js の needsShare）。
      if (updated.status === 'done' && !updated.shareAsked) updated = { ...updated, shareAsked: true };

      // 失敗した手順は「つまずき集」へ回す（役職ごと・AI費用ゼロ）。
      // 仕事は起動時に新しい120件しか読まないので、ここへ移さないと
      // 失敗は古い仕事ごと視界から消えて、同じことを繰り返す。
      for (const { step, employee, result } of results) {
        if (!result.error) continue;
        // **やめた（中止）は失敗ではない。** 貯めると「中止しました」が
        // その役職のつまずきとして、以後ずっとプロンプトに入り続ける。
        if (result.aborted) continue;
        // **エラーは result 側にある。** ここの step は実行前の写しなので
        // step.error はまだ null（そのまま渡すと、つまずきが1件も貯まらない）。
        recordPitfall({ ...step, error: result.error }, updated, employee);
      }

      // 完了したら、提出物の③から「あなたの判断が要ること」を拾う（新規）。
      // AIをもう一度呼ばないので費用はかからない。拾えなければ空のまま。
      if (updated.status === 'done' && !(updated.decisions || []).length) {
        // **assembleResult から拾わない。** 全手順を連ねた文なので、
        // 途中の手順の見出しや担当者名を「判断が要ること」として拾ってしまう。
        const found = decisionsFrom(finalOutput(updated));
        if (found.length) updated = { ...updated, decisions: found };
      }
      patchTask(updated);

      // 完了したら成果を知識にする（＝ウロボロスの循環）。
      // ただし **AIが動いていない「仕事の型」は自動で知識にしない。**
      // キーを入れる前に何度か試すたびに中身の無い知識が積まれ、
      // 件数・成長のグラフ・関連度の判定を薄めてしまうため。
      // 型そのものは仕事の中に残るので、必要なら結果画面から手で知識にできる。
      // 印の付いた仕事は知識にしない（加害的な文章を共通記憶にしない）
      if (updated.status === 'done' && !isFlagged(updated)) {
        // **完成条件の確認（kind:'check'）を「成果」として扱わない。**
        // 確認の手順は ○× の並びを返すだけなので、これを元に知識を作ると
        // 担当も出典も来歴も、確認役のものになってしまう。
        const made = results.filter((r) => r.step.kind !== 'check');
        const last = made[made.length - 1];
        if (last && !last.result.offline) {
          await saveResultAsKnowledge(updated, last.employee, last.result);
        }
      }

      return updated;
    },
    [put, log, patchTask, updateEmployee, spentThisMonth]
  );

  /** 実行中の仕事をやめる（新項目20）。 */
  const cancelRun = useCallback(() => {
    const c = abortRef.current;
    if (!c) return false;
    c.abort();
    abortRef.current = null;
    return true;
  }, []);

  /**
   * 仕事の成果を、あとから手で知識にする（新規）。
   * AI未接続の「仕事の型」は自動保存しないので、その受け皿。
   */
  const saveTaskAsKnowledgeRef = useRef(null);
  const saveTaskAsKnowledge = useCallback((taskId) => {
    const fn = saveTaskAsKnowledgeRef.current;
    return fn ? fn(taskId) : null;
  }, []);

  /** 仕事の成果を会社の知識として保存する。出典を必ず残す。 */
  const saveResultAsKnowledge = useCallback(
    async (task, employee, lastResult = {}) => {
      const text = assembleResult(task);
      if (!text.trim()) return null;

      const s = stateRef.current;
      const newSources = [];

      // 検索で得た URL と、本文中の URL を出典にする
      const urls = [
        ...(lastResult.citations || []).map((c) => ({ url: c.url, title: c.title })),
        ...extractUrls(text).map((u) => ({ url: u, title: u })),
      ];
      const seen = new Set();
      for (const u of urls.slice(0, 12)) {
        if (!u.url || seen.has(u.url)) continue;
        seen.add(u.url);
        newSources.push(makeSource({ type: 'web', title: u.title, url: u.url, addedBy: employee.id, trust: 50 }));
      }
      // ユーザーの指示そのものも出典として残す
      newSources.push(
        makeSource({ type: 'user', title: 'オーナーの依頼', excerpt: task.request, addedBy: 'user', trust: 70 })
      );

      const { title, summary } = distill(text, task.title);
      const { knowledge, extraSources } = createKnowledge({
        title,
        summary,
        body: text,
        category: categoryForRole(employee.roleId),
        tags: tagsFrom(task.request),
        // ローカル社員（AI未接続）の成果は AI生成ではない
        origin: lastResult.offline ? 'template' : 'ai',
        sourceIds: newSources.map((x) => x.id),
        taskId: task.id,
        employeeId: employee.id,
        departmentId: employee.departmentId,
        providerName: lastResult.providerName,
      });

      const allSources = [...newSources, ...extraSources];
      put(KEYS.sources, [...allSources, ...s.sources]);
      put(KEYS.knowledge, [knowledge, ...s.knowledge]);
      patchTask({
        ...task,
        // 本文はここに持たない（知識の body と手順の出力に既にある）。
        // 参照だけを残し、表示は assembleResult(task) で組み立てる。
        result: { ...task.result, knowledgeIds: [knowledge.id], sourceIds: allSources.map((x) => x.id) },
      });
      log({ actor: employee.id, action: 'knowledgeCreated', target: knowledge.title });
      return knowledge;
    },
    [put, log, patchTask]
  );

  // 手で知識にする経路（saveResultAsKnowledge の定義より前で公開したいので ref に載せる）
  saveTaskAsKnowledgeRef.current = (taskId) => {
    const t = stateRef.current.tasks.find((x) => x.id === taskId);
    if (!t) return null;
    // 外へ出せないと印を付けた仕事は、手でも知識にできない
    if (isFlagged(t)) return null;
    // 確認の手順は成果ではないので、担当としても選ばない
    const step = [...(t.steps || [])].reverse().find((x) => x.status === 'done' && x.output && x.kind !== 'check');
    if (!step) return null;
    const emp = stateRef.current.employees.find((e) => e.id === step.employeeId) || {
      id: 'user',
      name: step.employeeName || '担当',
      roleId: step.roleId,
    };
    // 型は AI が動いていないので、来歴は 'template' のままにする
    return saveResultAsKnowledge(t, emp, {
      offline: Boolean(step.offline),
      providerName: step.providerName,
    });
  };

  /** 最後まで一気に走らせる。 */
  const runTask = useCallback(
    async (taskId) => {
      for (let i = 0; i < 8; i += 1) {
        const t = stateRef.current.tasks.find((x) => x.id === taskId);
        // 保留（on_hold）も動かさない。保留は「今は寝かせる」という宣言なので、
        // 続きを実行するボタンやリトライから勝手に走り出してはいけない。
        if (!t || !isRunnable(t) || !nextGroup(t).length || t.status === 'awaiting_approval' || t.status === 'failed') break;
        // eslint-disable-next-line no-await-in-loop
        const after = await runNextStep(taskId);
        if (!after || after.status === 'awaiting_approval' || after.status === 'failed') break;
      }
      return stateRef.current.tasks.find((x) => x.id === taskId) || null;
    },
    [runNextStep]
  );

  /**
   * 失敗した手順をやり直す（新規）。
   * これまでは失敗すると行き止まりで、画面のボタンを押しても何も起きなかった。
   */
  const retryTask = useCallback(
    async (taskId, stepId = null) => {
      const t = stateRef.current.tasks.find((x) => x.id === taskId);
      if (!t) return null;
      const revived = retryFailed(t, stepId);
      if (revived === t) return t;
      patchTask(revived);
      return runTask(taskId);
    },
    [patchTask, runTask]
  );

  const deleteTask = useCallback(
    (id) => put(KEYS.tasks, stateRef.current.tasks.filter((t) => t.id !== id)),
    [put]
  );

  // 1回だけAIを呼ぶもの（相談・引き継ぎの確認）の実体。
  // 定義順の都合で ref に載せる（decideApproval より後ろで代入する）。
  const runConsultRef = useRef(async () => null);
  // askOnce も定義順の都合で ref に載せる（朝会から呼ぶため）
  const askOnceRef = useRef(async () => null);

  // ---- 承認 ----
  const decideApproval = useCallback(
    async (id, ok) => {
      const s = stateRef.current;
      const apv = s.approvals.find((a) => a.id === id);
      if (!apv) return;
      put(
        KEYS.approvals,
        s.approvals.map((a) => (a.id === id ? { ...a, status: ok ? 'granted' : 'denied', decidedAt: Date.now() } : a))
      );
      log({ actor: 'user', action: ok ? 'approvalGranted' : 'approvalDenied', target: apv.label });

      // 1回だけ呼ぶもの（相談・引き継ぎの確認）。
      // 仕事・会議と同じく、費用の出る実行は必ずここを通す。
      if (apv.consult) {
        if (ok) await runConsultRef.current(apv.consult);
        return;
      }

      // 会議の承認（仕事と同じ扱い）。
      // **patchMeeting / runMeeting をここで直接呼ばないこと。**
      // どちらもこの関数より後ろで定義されるので、依存配列に書いた時点で
      // 「初期化前の変数にアクセスした」で起動が落ちる（実際に落とした）。
      if (apv.meetingId) {
        const mtg = s.meetings.find((m) => m.id === apv.meetingId);
        if (!mtg) return;
        const next = { ...mtg, costApproved: ok, status: ok ? 'queued' : 'cancelled' };
        put(KEYS.meetings, s.meetings.map((m) => (m.id === mtg.id ? next : m)));
        if (ok) await runMeetingRef.current(mtg.id);
        return;
      }

      const task = s.tasks.find((t) => t.id === apv.taskId);
      if (!task) return;
      if (ok) {
        // 保留のまま承認された時は、承認を「進めてよい」の合図として保留を解く。
        // ここで保留を残すと、承認したのに何も起きない行き止まりになる。
        patchTask({ ...task, costApproved: true, status: 'running', holdReason: '', heldAt: null });
        await runTask(task.id);
      } else {
        patchTask({ ...task, status: 'cancelled' });
      }
    },
    [put, log, patchTask, runTask]
  );

  // ---- 知識 ----
  const addKnowledge = useCallback(
    ({ knowledge, source }) => {
      const s = stateRef.current;
      if (source) put(KEYS.sources, [source, ...s.sources]);
      put(KEYS.knowledge, [knowledge, ...s.knowledge]);
      log({ actor: 'user', action: 'knowledgeCreated', target: knowledge.title });
      return knowledge;
    },
    [put, log]
  );

  const updateKnowledge = useCallback(
    (id, patch) => {
      put(
        KEYS.knowledge,
        stateRef.current.knowledge.map((k) => (k.id === id ? { ...k, ...patch, updatedAt: Date.now() } : k))
      );
    },
    [put]
  );

  const verifyKnowledge = useCallback(
    (id, by) => {
      put(
        KEYS.knowledge,
        stateRef.current.knowledge.map((k) => (k.id === id ? markVerified(k, { by }) : k))
      );
      log({ actor: by || 'user', action: 'knowledgeUpdated', target: id, detail: '検証済みにした' });
    },
    [put, log]
  );

  const deleteKnowledge = useCallback(
    (id) => {
      const s = stateRef.current;
      const k = s.knowledge.find((x) => x.id === id);
      const rest = s.knowledge.filter((x) => x.id !== id);
      put(KEYS.knowledge, rest);

      // その知識**だけ**が参照していた出典を一緒に消す。
      // 残しておくと、どの画面にも出ないまま増え続ける（1回の仕事で最大13件）。
      // 他の知識がまだ参照しているものは残す。
      const orphans = new Set(orphanSourceIds(k, rest));
      if (orphans.size) {
        put(KEYS.sources, s.sources.filter((src) => !orphans.has(src.id)));
      }
      log({ actor: 'user', action: 'knowledgeDeleted', target: k ? k.title : id });
    },
    [put, log]
  );

  // ---- 案件 ----
  const addDeal = useCallback(
    (data) => {
      const deal = createDeal(data);
      put(KEYS.deals, [deal, ...stateRef.current.deals]);
      log({ actor: 'user', action: 'dealChanged', target: deal.title, detail: '新規' });
      return deal;
    },
    [put, log]
  );

  const updateDeal = useCallback(
    (id, patch) => {
      put(
        KEYS.deals,
        stateRef.current.deals.map((d) =>
          d.id === id
            ? {
                ...d,
                ...patch,
                updatedAt: Date.now(),
                paidAt: patch.status === 'paid' ? d.paidAt || Date.now() : d.paidAt,
              }
            : d
        )
      );
    },
    [put]
  );

  const deleteDeal = useCallback(
    (id) => put(KEYS.deals, stateRef.current.deals.filter((d) => d.id !== id)),
    [put]
  );

  // ---- AI会議 ----
  const startMeeting = useCallback(
    async ({ topic, employeeIds, kind = 'free' }) => {
      const s = stateRef.current;
      const emps = s.employees.filter((e) => employeeIds.includes(e.id));
      // 事前配布：台帳・収益導線・掲示板から材料を作って全員に配る（AI費用ゼロ）。
      const { buildBriefing, createMeeting } = await loadTeamwork();
      const materials = buildBriefing({
        tasks: s.tasks,
        deals: s.deals,
        funnel: s.funnel,
        board: s.board,
        requireShare: s.settings.requireShare !== false,
      });
      const mtg = createMeeting({ topic, employees: emps, materials, kind });
      put(KEYS.meetings, [mtg, ...s.meetings]);
      log({ actor: 'user', action: 'meetingHeld', target: topic });
      return mtg;
    },
    [put, log]
  );

  /** 週次レビュー会（議題と「答え方」が決まっている会議）。 */
  const startWeeklyReview = useCallback(
    async (employeeIds) => {
      const { weeklyTopic } = await loadTeamwork();
      return startMeeting({ topic: weeklyTopic(), employeeIds, kind: 'weekly' });
    },
    [startMeeting]
  );

  const patchMeeting = useCallback(
    (mtg) => put(KEYS.meetings, stateRef.current.meetings.map((m) => (m.id === mtg.id ? mtg : m))),
    [put]
  );

  const runMeeting = useCallback(
    async (meetingId) => {
      const s = stateRef.current;
      let mtg = s.meetings.find((m) => m.id === meetingId);
      if (!mtg) return null;
      const parts = s.employees.filter((e) => mtg.participantIds.includes(e.id));

      // 会議は Ouro でいちばん費用の出る操作（意見＋反論＋統合で人数×2＋1回）。
      // **仕事と同じく、必ず1度ユーザー承認を通す。**
      // ここを飛ばしていたため、高い方だけが素通りしていた。
      const { estimatedCalls } = await loadTeamwork();
      const willCost = Object.keys(s.secrets).length > 0;
      if (willCost && !mtg.costApproved) {
        const chairFor = parts.find((e) => e.id === mtg.chairId) || parts[0];
        const check = checkAction({
          employee: chairFor || { name: '議長' },
          action: 'costly',
          settings: s.settings,
          spentThisMonth: spentThisMonth(),
        });
        if (check.needsApproval) {
          const approval = {
            id: newId('apv'),
            meetingId: mtg.id,
            employeeId: chairFor ? chairFor.id : null,
            action: 'costly',
            label: `${parts.length}人でAI会議を開きます（AIを約${estimatedCalls(parts.length)}回呼びます）：${mtg.topic}`,
            risk: check.risk,
            status: 'pending',
            createdAt: Date.now(),
          };
          put(KEYS.approvals, [approval, ...s.approvals]);
          log({ actor: 'user', action: 'approvalRequested', target: mtg.topic });
          mtg = { ...mtg, status: 'awaiting_approval' };
          patchMeeting(mtg);
          return mtg;
        }
      }

      setBusy({ meetingId });
      // 会議も途中でやめられるようにする（仕事と同じ中断スイッチを使う）
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      abortRef.current = controller;

      const { weeklyPrompt, opinionPrompt, rebuttalPrompt, synthesisPrompt, addRound, meetingTakeaways } = await loadTeamwork();

      const ask = async (employee, prompt) => {
        const pseudoTask = { request: mtg.topic, title: mtg.topic, context: '' };
        try {
          const r = await runStep({
            employee,
            company: s.company,
            task: pseudoTask,
            step: { instruction: prompt, needs: [] },
            knowledgeList: s.knowledge,
            secrets: s.secrets,
            settings: s.settings,
            connections: s.connections,
            signal: controller ? controller.signal : undefined,
          });
          return { text: r.text, providerId: r.providerId, model: r.model, cost: r.cost };
        } catch (e) {
          return { text: `（発言できませんでした：${e.message}）`, cost: 0 };
        }
      };

      // ① 意見 — 全員が独立して考えるので**同時に**走らせる（項目29）。
      // 1人ずつ順番に呼ぶと、5人なら5倍待つことになる。
      mtg = { ...mtg, status: 'running', phase: 'opinion' };
      patchMeeting(mtg);
      const opinions = await Promise.all(
        parts.map((emp) =>
          ask(emp, opinionPrompt(mtg.topic, mtg.interventions, mtg.materials, mtg.kind === 'weekly' ? weeklyPrompt() : '')).then((r) => ({ emp, r }))
        )
      );
      for (const { emp, r } of opinions) {
        mtg = addRound(mtg, { phase: 'opinion', employeeId: emp.id, employeeName: emp.name, ...r });
      }
      patchMeeting(mtg);

      // ② 反論 — 各自が「自分以外の意見」を読むだけなので、これも同時でよい。
      mtg = { ...mtg, phase: 'rebuttal' };
      patchMeeting(mtg);
      const opinionRounds = mtg.rounds.filter((r) => r.phase === 'opinion');
      const rebuttals = await Promise.all(
        parts.map((emp) =>
          ask(emp, rebuttalPrompt(mtg.topic, opinionRounds.filter((r) => r.employeeId !== emp.id), mtg.materials))
            .then((r) => ({ emp, r }))
        )
      );
      for (const { emp, r } of rebuttals) {
        mtg = addRound(mtg, { phase: 'rebuttal', employeeId: emp.id, employeeName: emp.name, ...r });
      }
      patchMeeting(mtg);

      // ③ 統合（議長）
      mtg = { ...mtg, phase: 'synthesis' };
      const chair = parts.find((e) => e.id === mtg.chairId) || parts[0];
      if (chair) {
        const r = await ask(chair, synthesisPrompt(mtg.topic, mtg.rounds, mtg.interventions, mtg.materials));
        mtg = addRound(mtg, { phase: 'synthesis', employeeId: chair.id, employeeName: chair.name, ...r });
        mtg = { ...mtg, conclusion: r.text };
      }

      const stopped = controller ? controller.signal.aborted : false;
      mtg = { ...mtg, status: stopped ? 'cancelled' : 'done', finishedAt: Date.now() };
      patchMeeting(mtg);
      abortRef.current = null;
      setBusy(null);
      log({
        actor: chair ? chair.id : 'user',
        action: 'meetingHeld',
        target: mtg.topic,
        detail: '結論を出した',
        cost: mtg.totalCost,
      });

      // **会議の結論を会議の中で閉じさせない。**
      // 決まったことを掲示板へ回すと、次に動く社員が読む（AI費用ゼロ）。
      if (!stopped) {
        for (const line of meetingTakeaways(mtg)) {
          addBoardPost({
            text: line,
            kind: 'meeting',
            employeeId: chair ? chair.id : null,
            employeeName: chair ? chair.name : '議長',
            roleId: chair ? chair.roleId : null,
          });
        }
      }
      return mtg;
    },
    [patchMeeting, log, put, spentThisMonth, addBoardPost]
  );

  // 承認画面から会議を始められるようにしておく（定義順の都合で ref に載せる）
  runMeetingRef.current = runMeeting;


  // ---- 設定・接続・キー ----
  const updateSettings = useCallback(
    (patch) => put(KEYS.settings, { ...stateRef.current.settings, ...patch }),
    [put]
  );

  const setSecret = useCallback(
    (providerId, key) => {
      const next = { ...stateRef.current.secrets };
      if (key) next[providerId] = key;
      else delete next[providerId];
      put(KEYS.secrets, next);
    },
    [put]
  );

  const toggleConnection = useCallback(
    (toolId, enabled) => {
      const s = stateRef.current;
      const exists = s.connections.find((c) => c.toolId === toolId);
      const next = exists
        ? s.connections.map((c) => (c.toolId === toolId ? { ...c, enabled } : c))
        : [...s.connections, { toolId, enabled, connectedAt: Date.now() }];
      put(KEYS.connections, next);
      log({ actor: 'user', action: 'connectionChanged', target: toolId, detail: enabled ? '接続' : '解除' });
    },
    [put, log]
  );

  const updateCompany = useCallback(
    (patch) => put(KEYS.company, { ...stateRef.current.company, ...patch }),
    [put]
  );

  // ---- 朝会（AIを呼ばない）----
  //
  // **人数ぶんAIを呼ばない。** 18人いれば18回になり、会議より高くつく。
  // 中身は仕事から機械的に作る＝費用ゼロ。まとめの一言だけ書記1人に頼める。
  const holdStandup = useCallback(
    async ({ withSummary = false } = {}) => {
      const s = stateRef.current;
      const { buildStandup, standupSummaryPrompt } = await loadTeamwork();
      const standup = buildStandup({ tasks: s.tasks, employees: s.employees.filter((e) => !e.archivedAt) });
      updateSettings({ lastStandupAt: Date.now() });
      log({ actor: 'user', action: 'standupHeld', target: `${standup.counts.people}人ぶん` });
      if (!withSummary) return { standup, summary: '' };

      // 書記役（オーガナイザー → いなければ誰でも1人）に1回だけ頼む
      const scribe =
        s.employees.find((e) => !e.archivedAt && e.roleId === 'organizer') ||
        s.employees.find((e) => !e.archivedAt) ||
        null;
      if (!scribe) return { standup, summary: '' };
      // **askOnce を通すこと。** 直に runConsultRef を呼ぶと、
      // 費用の出る実行なのに承認も今月の上限も効かない。
      const res = await askOnceRef.current({
        employeeId: scribe.id,
        prompt: standupSummaryPrompt(standup),
        kind: 'standup',
        label: `${scribe.name} が今日の朝会をまとめます（AIを1回呼びます）`,
      });
      return { standup, summary: res && res.text ? res.text : '', queued: Boolean(res && res.queued) };
    },
    [updateSettings, log]
  );

  // ---- 1回だけAIを呼ぶ（相談・引き継ぎの確認）----
  //
  // 会議は「人数×2＋1回」でいちばん高い。会議を開くほどではない場面のために、
  // **1回だけ**呼ぶ道を用意する。費用の出る実行なので、仕事・会議と同じ承認を通す。
  const askOnce = useCallback(
    async ({ employeeId, prompt, kind = 'consult', taskId = null, stepId = null, label = '', question = '' }) => {
      const s = stateRef.current;
      const employee = s.employees.find((e) => e.id === employeeId);
      if (!employee) return null;
      const payload = { employeeId, prompt, kind, taskId, stepId, label, question };

      const willCost = Object.keys(s.secrets).length > 0;
      if (willCost) {
        const check = checkAction({
          employee,
          action: 'costly',
          settings: s.settings,
          spentThisMonth: spentThisMonth(),
        });
        if (check.needsApproval) {
          const approval = {
            id: newId('apv'),
            taskId,
            employeeId,
            action: 'costly',
            label: label || `${employee.name} に1つ聞きます（AIを1回呼びます）`,
            risk: check.risk,
            status: 'pending',
            createdAt: Date.now(),
            consult: payload,
          };
          put(KEYS.approvals, [approval, ...s.approvals]);
          log({ actor: employeeId, action: 'approvalRequested', target: approval.label });
          return { queued: true, approvalId: approval.id };
        }
      }
      return runConsultRef.current(payload);
    },
    [put, log, spentThisMonth]
  );
  askOnceRef.current = askOnce;

  // 実体。承認を通ったあと（または承認が要らないとき）にここへ来る。
  runConsultRef.current = async ({ employeeId, prompt, kind, taskId, stepId, question }) => {
    const s = stateRef.current;
    const employee = s.employees.find((e) => e.id === employeeId);
    if (!employee) return null;
    setBusy({ taskId: taskId || null, consult: true });
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    abortRef.current = controller;
    let res;
    try {
      res = await runStep({
        employee,
        company: s.company,
        task: { request: question || prompt, title: question || '相談', context: '', spec: {} },
        step: { instruction: prompt, needs: [] },
        knowledgeList: s.knowledge,
        secrets: s.secrets,
        settings: s.settings,
        connections: s.connections,
        boardText: (await loadTeamwork()).boardPrompt(s.board, { exceptTaskId: taskId }),
        signal: controller ? controller.signal : undefined,
      });
    } catch (e) {
      res = { text: '', error: e.message || String(e), cost: 0 };
    }
    abortRef.current = null;
    setBusy(null);

    log({
      actor: employee.id,
      action: res.error ? 'stepFailed' : 'consultAnswered',
      target: question || kind,
      detail: res.error || `${res.providerName || 'ローカル'} / ${res.model || '—'}`,
      cost: res.cost || 0,
    });
    if (res.error) return { text: '', error: res.error };

    const { trimAnswer } = await loadTeamwork();
    const text = kind === 'consult' ? trimAnswer(res.text) : res.text;

    if (kind === 'consult') {
      addBoardPost({
        text: `${question ? `${question} → ` : ''}${text}`.slice(0, 200),
        kind: 'consult',
        employeeId: employee.id,
        employeeName: employee.name,
        roleId: employee.roleId,
        taskId,
      });
    }
    if (kind === 'standup') {
      addBoardPost({
        text,
        kind: 'share',
        employeeId: employee.id,
        employeeName: employee.name,
        roleId: employee.roleId,
      });
    }
    if ((kind === 'gap' || kind === 'supplement') && taskId && stepId) {
      const { isNothing } = await loadTeamwork();
      const task = stateRef.current.tasks.find((t) => t.id === taskId);
      if (task) {
        const steps = (task.steps || []).map((x) =>
          x.id === stepId
            ? kind === 'gap'
              ? // **「なし」を足りないものとして持たない。**
                // 持つと「補ってもらう」が出てしまい、要らない1回ぶん課金される。
                { ...x, gap: isNothing(text) ? '' : text, gapChecked: true, gapAt: Date.now() }
              : // 補ってもらった材料は、受け手の入力の末尾に足す（元の材料は消さない）
                { ...x, input: `${x.input || ''}\n\n## 追加で補われた材料\n${text}`.trim(), supplement: text }
            : x
        );
        patchTask({ ...task, steps });
      }
    }
    return { text, cost: res.cost || 0 };
  };

  /** 他の担当に3行だけ聞く（会議を開くほどではない時）。 */
  const consultEmployee = useCallback(
    async ({ employeeId, question, taskId = null }) => {
      const s = stateRef.current;
      const employee = s.employees.find((e) => e.id === employeeId);
      if (!employee || !String(question || '').trim()) return null;
      const { buildBriefing, consultPrompt } = await loadTeamwork();
      const brief = buildBriefing({
        tasks: s.tasks,
        deals: s.deals,
        funnel: s.funnel,
        board: s.board,
        requireShare: s.settings.requireShare !== false,
      });
      return askOnce({
        employeeId,
        prompt: consultPrompt(question, brief),
        kind: 'consult',
        taskId,
        question: String(question).slice(0, 200),
        label: `${employee.name} に1つ聞きます（AIを1回呼びます）`,
      });
    },
    [askOnce]
  );

  /** 引き継ぎ会：受け取った側に「足りない材料」を聞く（1回）。 */
  const askHandoffGap = useCallback(
    async (taskId, stepId) => {
      const s = stateRef.current;
      const { gapPrompt } = await loadTeamwork();
      const task = s.tasks.find((t) => t.id === taskId);
      const step = task && (task.steps || []).find((x) => x.id === stepId);
      if (!task || !step || !step.employeeId) return null;
      const emp = s.employees.find((e) => e.id === step.employeeId);
      return askOnce({
        employeeId: step.employeeId,
        prompt: gapPrompt(step.instruction, step.input),
        kind: 'gap',
        taskId,
        stepId,
        label: `${emp ? emp.name : '担当'} に「材料が足りているか」を聞きます（AIを1回呼びます）`,
      });
    },
    [askOnce]
  );

  /**
   * この成果物は外へ出せない、と印を付ける（新規）。
   * 印を付けたものは知識にも掲示板にも入らず、仕事は保留になる。
   */
  const flagTask = useCallback(
    async (taskId, reason) => {
      const s = stateRef.current;
      const task = s.tasks.find((t) => t.id === taskId);
      if (!task) return null;

      // **印を付けるだけでは足りない。** 実行が終わった時点で、成果は既に
      // 知識と掲示板に入っている。ここで実際に取り除かないと、
      // 「知識にも掲示板にも入りません」という画面の説明が嘘になる。
      const rest = s.knowledge.filter((k) => k.taskId !== taskId);
      if (rest.length !== s.knowledge.length) {
        const gone = s.knowledge.filter((k) => k.taskId === taskId);
        put(KEYS.knowledge, rest);
        // その知識だけが参照していた出典も一緒に消す（deleteKnowledge と同じ扱い）
        const orphans = new Set(gone.flatMap((k) => orphanSourceIds(k, rest)));
        if (orphans.size) put(KEYS.sources, s.sources.filter((src) => !orphans.has(src.id)));
      }
      const board = (s.board || []).filter((post) => post.taskId !== taskId);
      if (board.length !== (s.board || []).length) {
        stateRef.current = { ...stateRef.current, board };
        setState(stateRef.current);
        touchedRef.current.add(KEYS.board);
        if (hydratedRef.current) save(KEYS.board, board, 'low');
      }

      const next = flagTaskFn(task, reason);
      log({ actor: 'user', action: 'taskFlagged', target: task.title, detail: String(reason || '').slice(0, 120) });
      // 共有の1行も取り下げる（掲示板から消したので、手元にも残さない）
      return patchTask({ ...next, shared: '', shareWaived: true });
    },
    [patchTask, log, put]
  );

  const unflagTaskAction = useCallback(
    (taskId) => {
      const task = stateRef.current.tasks.find((t) => t.id === taskId);
      if (!task) return null;
      return patchTask(unflagTask(task));
    },
    [patchTask]
  );

  /** やり直しの回数を数え直す（「それでもやり直す」）。 */
  const allowMoreRedo = useCallback(
    (taskId) => {
      const task = stateRef.current.tasks.find((t) => t.id === taskId);
      if (!task) return null;
      return patchTask(resetRedoCount(task));
    },
    [patchTask]
  );

  /** その手順からやり直す（補った材料を活かすため）。 */
  const redoStep = useCallback(
    async (taskId, stepId) => {
      const task = stateRef.current.tasks.find((t) => t.id === taskId);
      if (!task) return null;
      // **際限のない差し戻しは型として持たない。** 上限に達したら、
      // 続ける前に人が見る（「それでもやり直す」で抜けられる）。
      if (overRedoLimit(task)) return { blocked: true, redoLimit: REDO_LIMIT };
      const next = redoFrom(task, stepId);
      if (next === task) return task;
      patchTask(next);
      log({ actor: 'user', action: 'taskRetried', target: task.title, detail: 'この手順からやり直し' });
      return runTask(taskId);
    },
    [patchTask, log, runTask]
  );

  /**
   * 会議の結論を知識にする（新規）。
   * これまで結論は会議の中で閉じていて、次の仕事で誰も使わなかった。
   * 出典は会議そのもの（AI生成ではなく、社内で出た結論だと分かるようにする）。
   */
  const saveMeetingAsKnowledge = useCallback(
    (meetingId) => {
      const s = stateRef.current;
      const mtg = s.meetings.find((m) => m.id === meetingId);
      if (!mtg || !String(mtg.conclusion || '').trim()) return null;
      const chair = s.employees.find((e) => e.id === mtg.chairId) || s.employees[0] || null;
      const source = makeSource({
        type: 'meeting',
        title: `社内会議「${mtg.topic}」`,
        excerpt: `${new Date(mtg.createdAt).toLocaleDateString('ja-JP')}／参加 ${mtg.participantIds.length}人`,
        addedBy: chair ? chair.id : 'user',
        trust: 50,
      });
      // **createKnowledge は { knowledge, extraSources } を返す。**
      // 直に受け取ると id が undefined になり、開いた先で「知識が見つかりません」になる。
      const { title, summary } = distill(mtg.conclusion, `会議の結論：${mtg.topic}`);
      const { knowledge } = createKnowledge({
        title: title || `会議の結論：${mtg.topic}`.slice(0, 80),
        summary,
        body: mtg.conclusion,
        category: '戦略',
        tags: [],
        origin: 'meeting',
        sourceIds: [source.id],
        employeeId: chair ? chair.id : null,
        departmentId: chair ? chair.departmentId : null,
      });
      put(KEYS.sources, [source, ...s.sources]);
      put(KEYS.knowledge, [knowledge, ...s.knowledge]);
      put(KEYS.meetings, s.meetings.map((m) => (m.id === mtg.id ? { ...m, knowledgeId: knowledge.id } : m)));
      log({ actor: chair ? chair.id : 'user', action: 'knowledgeCreated', target: knowledge.title });
      return knowledge;
    },
    [put, log]
  );

  /** 引き継ぎ会：渡した側に補ってもらう（1回）。 */
  const supplementHandoff = useCallback(
    async (taskId, stepId) => {
      const s = stateRef.current;
      const { supplementPrompt } = await loadTeamwork();
      const task = s.tasks.find((t) => t.id === taskId);
      const steps = task ? task.steps || [] : [];
      const idx = steps.findIndex((x) => x.id === stepId);
      const step = idx >= 0 ? steps[idx] : null;
      if (!task || !step || !step.gap) return null;
      // 渡した側＝この手順より前で、出力を出している最後の手順
      const giver = [...steps.slice(0, idx)].reverse().find((x) => x.output && x.employeeId);
      if (!giver) return null;
      const emp = s.employees.find((e) => e.id === giver.employeeId);
      return askOnce({
        employeeId: giver.employeeId,
        prompt: supplementPrompt(step.gap, giver.output),
        kind: 'supplement',
        taskId,
        stepId,
        label: `${emp ? emp.name : '前の担当'} に足りない材料を補ってもらいます（AIを1回呼びます）`,
      });
    },
    [askOnce]
  );

  /**
   * 書き出す。
   * @param {boolean} recordDate 書き出した日を覚えるか。
   *   取り込み直前の保険で書き出す時は false にする。true のままだと
   *   「取り込む前の設定」の保存が待ち行列に残り、取り込み後の離脱時に
   *   それが書かれて、取り込んだ設定を巻き戻してしまう。
   */
  const exportData = useCallback(async (recordDate = true) => {
    await flushNow(); // 書き残しをバックアップに含めるため
    const out = await exportAll();
    if (recordDate) {
      const settings = { ...stateRef.current.settings, lastExportAt: Date.now() };
      stateRef.current = { ...stateRef.current, settings };
      setState(stateRef.current);
      save(KEYS.settings, settings);
    }
    return out;
  }, []);
  const importData = useCallback(async (payload) => {
    const n = await importAll(payload);
    window.location.reload();
    return n;
  }, []);

  return {
    ...state,
    ready,
    busy,
    live,
    activeEmployees,
    // 社員
    cancelRun,
    saveTaskAsKnowledge,
    loadAllTasks,
    tasksPartial: isPartial(KEYS.tasks),
    loadAllAudit,
    auditPartial: isPartial(KEYS.audit),
    hireEmployee,
    hireIntoRole,
    hireCharacter,
    updateEmployee,
    archiveEmployee,
    assignFor,
    // ジャンル
    addGenre,
    removeGenre,
    // カレンダー
    addEvent,
    updateEvent,
    removeEvent,
    // 仕事
    newTask,
    runTask,
    runNextStep,
    retryTask,
    deleteTask,
    patchTask,
    setTaskMeta,
    shareTask,
    flagTask,
    unflagTask: unflagTaskAction,
    allowMoreRedo,
    teachEmployee,
    forgetEmployeeNote,
    putFunnelEntry,
    removeFunnelEntry,
    renameFunnelStage,
    // 事業・発信ログ
    addVenture,
    updateVenture,
    removeVenture,
    setVentureState,
    decideVenture,
    addSharePost,
    removeSharePost,
    // 読み込みが済んだか（発信ログなど REST を「無い」と言い切ってよいか）
    hydrated: hydratedRef.current,
    updateRules,
    addCompanyRule,
    removeCompanyRule,
    holdTask,
    resumeTask,
    decideTask,
    // 承認
    decideApproval,
    // 知識
    addKnowledge,
    updateKnowledge,
    verifyKnowledge,
    deleteKnowledge,
    // 案件
    addDeal,
    updateDeal,
    deleteDeal,
    // 会議
    startMeeting,
    startWeeklyReview,
    holdStandup,
    consultEmployee,
    askHandoffGap,
    supplementHandoff,
    saveMeetingAsKnowledge,
    redoStep,
    addBoardPost,
    addPitfallEntry,
    removePitfallEntry,
    removeBoardPost,
    runMeeting,
    patchMeeting,
    // 設定
    updateSettings,
    updateCompany,
    setSecret,
    toggleConnection,
    exportData,
    importData,
  };
}

function keyName(key) {
  return String(key).replace(/^ouro:/, '');
}

/**
 * 保存済みの会社データを、いまの項目名にそろえる。
 *
 * 席数の項目は seatsPerRole → seatsPerGenre に統一した
 * （数え方は「役職 × ジャンル の中」なので、こちらが正しい）。
 * 古い名前のまま保存されている端末を読んでも席数が消えないようにする。
 */
function migrateCompany(company) {
  if (!company) return null;
  if (company.seatsPerGenre != null) return company;
  if (company.seatsPerRole != null) {
    const { seatsPerRole, ...rest } = company;
    return { ...rest, seatsPerGenre: seatsPerRole };
  }
  return company;
}

function categoryForRole(roleId) {
  return (
    {
      researcher: '調査',
      analyzer: '分析',
      creator: '制作物',
      reviewer: '検証',
      strategist: '戦略',
      mentor: '学習',
    }[roleId] || 'その他'
  );
}

function tagsFrom(request = '') {
  return String(request)
    .split(/[\s、。,.\n「」（）()【】・:：]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && w.length <= 12)
    .slice(0, 5);
}
