// アプリ全体の状態。保存・実行・監査の窓口をここ1つに集約する。
//
// 画面（components/*.jsx）は保存キーを直接触らない。必ずこのフック経由。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KEYS, load, loadMany, save, exportAll, importAll, flushNow, isPartial, onExternalChange,
} from './storage.js';
import * as perf from './perf.js';
import { afterPaint, whenIdle } from './idle.js';
import { makeSettings } from './defaults.js';
import { createTask, applyStepResult, nextStep, assembleResult } from './workflow.js';
import { runStep, distill, extractUrls } from './runtime.js';
import { createKnowledge, makeSource, markUsed, markVerified } from './knowledge.js';
import { makeEntry, appendAudit, foldAudit } from './audit.js';
import { checkAction } from './permissions.js';
import { createDeal } from './revenue.js';
import { createMeeting, addRound, opinionPrompt, rebuttalPrompt, synthesisPrompt } from './meeting.js';
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
];
// 新項目09：起動時に読む操作履歴の件数。画面に出るのは最近のぶんだけなので、
// 全件（最大2000）を読まずに新しい方から400件だけ読む。
// 「すべて読み込む」を押した時と、畳む時だけ全件を読む。
export const AUDIT_PAGE = 400;

// 開くまで見えないもの（操作履歴は最大2000件あるので、必ず後回しにする）
const REST_KEYS = [
  KEYS.departments, KEYS.sources, KEYS.meetings, KEYS.audit, KEYS.connections,
];
const FIRST_FALLBACKS = Object.fromEntries(FIRST_KEYS.map((k) => [k, k === KEYS.company ? null : k === KEYS.settings || k === KEYS.secrets ? {} : []]));
const REST_FALLBACKS = Object.fromEntries(REST_KEYS.map((k) => [k, []]));

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
      const first = await loadMany(FIRST_KEYS, FIRST_FALLBACKS);
      if (!alive) return;
      const next = {
        ...EMPTY,
        company: first[KEYS.company] || null,
        employees: asArray(first[KEYS.employees]),
        tasks: asArray(first[KEYS.tasks]),
        knowledge: asArray(first[KEYS.knowledge]),
        deals: asArray(first[KEYS.deals]),
        events: asArray(first[KEYS.events]),
        genres: asArray(first[KEYS.genres]),
        approvals: asArray(first[KEYS.approvals]),
        settings: { ...makeSettings(), ...(first[KEYS.settings] || {}) },
        secrets: first[KEYS.secrets] || {},
      };
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
      // 1回の起動につき1度だけ、たまっている時だけ走る。
      if (!foldedRef.current && isPartial(KEYS.audit)) {
        foldedRef.current = true;
        await whenIdle(6000);
        if (!alive) return;
        try {
          const full = await load(KEYS.audit, []);
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
          if (folded > 0) save(KEYS.audit, list, 'low');
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
    const next = appendAudit(stateRef.current.audit, made);
    stateRef.current = { ...stateRef.current, audit: next };
    setState(stateRef.current);
    // 読み込みが終わる前は保存を待つ。ここで書くと、まだ空の履歴で
    // 保存済みの履歴を消してしまう。読み終わってから足す。
    if (!hydratedRef.current) {
      preAuditRef.current.push(made);
      return;
    }
    // 新項目07：記録として積むだけなので急がない。まとめて書く。
    save(KEYS.audit, next, 'low');
  }, []);

  /**
   * 操作履歴を全部読み込む（新項目09）。
   * 起動時は新しい400件だけなので、古いぶんを見たい時にこれを呼ぶ。
   */
  const loadAllAudit = useCallback(async () => {
    const full = await load(KEYS.audit, []);
    const onDisk = new Set(full.map((e) => e && e.id));
    const merged = [...full, ...stateRef.current.audit.filter((e) => e && !onDisk.has(e.id))].sort(
      (a, b) => (a.at || 0) - (b.at || 0)
    );
    stateRef.current = { ...stateRef.current, audit: merged };
    setState(stateRef.current);
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
    ({ request, workflowId = null, employeeId = null, dealId = null, context = '', genreId = null }) => {
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
        context,
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

  /** 1ステップ実行する。承認が要るときは approvals に積んで止まる。 */
  const runNextStep = useCallback(
    async (taskId) => {
      const s = stateRef.current;
      const task = s.tasks.find((t) => t.id === taskId);
      if (!task) return null;
      const step = nextStep(task);
      if (!step) return null;

      const employee =
        s.employees.find((e) => e.id === step.employeeId) ||
        s.employees.find((e) => e.roleId === step.roleId && !e.archivedAt);
      if (!employee) {
        return patchTask(
          applyStepResult(task, step.id, { error: `${step.roleId} の担当社員がいません` })
        );
      }

      // 課金の発生する実行は既定で承認を通す
      const provider = providerById(employee.providerPref) || null;
      const willCost = Object.keys(s.secrets).length > 0;
      if (willCost) {
        const check = checkAction({ employee, action: 'costly', settings: s.settings });
        if (check.needsApproval && !task.costApproved) {
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
      patchTask({
        ...task,
        status: 'running',
        startedAt: task.startedAt || Date.now(),
        steps: task.steps.map((x) => (x.id === step.id ? { ...x, status: 'running', startedAt: Date.now() } : x)),
      });
      setBusy({ taskId });
      setLive({ taskId, stepId: step.id, employeeName: employee.name, text: '' });
      perf.mark(`run:${step.id}`);

      let result;
      try {
        result = await runStep({
          employee,
          company: s.company,
          task,
          step,
          knowledgeList: s.knowledge,
          inherited: step.input,
          secrets: s.secrets,
          settings: s.settings,
          // 受け取った先から画面へ出す。ここでは保存しない。
          onDelta: (piece) =>
            setLive((cur) =>
              cur && cur.stepId === step.id ? { ...cur, text: cur.text + piece } : cur
            ),
        });
      } catch (e) {
        result = { error: e.message || String(e) };
      }
      perf.measure(`run:${step.id}`, 'run');
      setBusy(null);
      setLive(null);

      const current = stateRef.current.tasks.find((t) => t.id === taskId) || task;
      const updated = applyStepResult(current, step.id, result);
      patchTask(updated);

      log({
        actor: employee.id,
        action: result.error ? 'stepFailed' : 'stepRun',
        target: task.title,
        detail: result.error || `${result.providerName || 'ローカル'} / ${result.model || '—'}`,
        cost: result.cost || 0,
      });

      // 社員の実績を更新
      updateEmployee(employee.id, {
        stats: {
          ...(employee.stats || {}),
          tasks: (employee.stats?.tasks || 0) + 1,
          tokens: (employee.stats?.tokens || 0) + ((result.usage?.input || 0) + (result.usage?.output || 0)),
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

      // 完了したら成果を知識にする（＝ウロボロスの循環）
      if (updated.status === 'done') {
        await saveResultAsKnowledge(updated, employee, result);
      }

      return updated;
    },
    [put, log, patchTask, updateEmployee]
  );

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
        origin: 'ai',
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
        result: { ...task.result, text, knowledgeIds: [knowledge.id], sourceIds: allSources.map((x) => x.id) },
      });
      log({ actor: employee.id, action: 'knowledgeCreated', target: knowledge.title });
      return knowledge;
    },
    [put, log, patchTask]
  );

  /** 最後まで一気に走らせる。 */
  const runTask = useCallback(
    async (taskId) => {
      for (let i = 0; i < 8; i += 1) {
        const t = stateRef.current.tasks.find((x) => x.id === taskId);
        if (!t || !nextStep(t) || t.status === 'awaiting_approval' || t.status === 'failed') break;
        // eslint-disable-next-line no-await-in-loop
        const after = await runNextStep(taskId);
        if (!after || after.status === 'awaiting_approval' || after.status === 'failed') break;
      }
      return stateRef.current.tasks.find((x) => x.id === taskId) || null;
    },
    [runNextStep]
  );

  const deleteTask = useCallback(
    (id) => put(KEYS.tasks, stateRef.current.tasks.filter((t) => t.id !== id)),
    [put]
  );

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

      const task = s.tasks.find((t) => t.id === apv.taskId);
      if (!task) return;
      if (ok) {
        patchTask({ ...task, costApproved: true, status: 'running' });
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
      const k = stateRef.current.knowledge.find((x) => x.id === id);
      put(KEYS.knowledge, stateRef.current.knowledge.filter((x) => x.id !== id));
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
    ({ topic, employeeIds }) => {
      const emps = stateRef.current.employees.filter((e) => employeeIds.includes(e.id));
      const mtg = createMeeting({ topic, employees: emps });
      put(KEYS.meetings, [mtg, ...stateRef.current.meetings]);
      log({ actor: 'user', action: 'meetingHeld', target: topic });
      return mtg;
    },
    [put, log]
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
      setBusy({ meetingId });

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
          ask(emp, opinionPrompt(mtg.topic, mtg.interventions)).then((r) => ({ emp, r }))
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
          ask(emp, rebuttalPrompt(mtg.topic, opinionRounds.filter((r) => r.employeeId !== emp.id)))
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
        const r = await ask(chair, synthesisPrompt(mtg.topic, mtg.rounds, mtg.interventions));
        mtg = addRound(mtg, { phase: 'synthesis', employeeId: chair.id, employeeName: chair.name, ...r });
        mtg = { ...mtg, conclusion: r.text };
      }

      mtg = { ...mtg, status: 'done', finishedAt: Date.now() };
      patchMeeting(mtg);
      setBusy(null);
      log({
        actor: chair ? chair.id : 'user',
        action: 'meetingHeld',
        target: mtg.topic,
        detail: '結論を出した',
        cost: mtg.totalCost,
      });
      return mtg;
    },
    [patchMeeting, log]
  );

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

  const exportData = useCallback(async () => {
    await flushNow(); // 書き残しをバックアップに含めるため
    return exportAll();
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
    deleteTask,
    patchTask,
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
