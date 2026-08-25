// アプリ全体の状態。保存・実行・監査の窓口をここ1つに集約する。
//
// 画面（components/*.jsx）は保存キーを直接触らない。必ずこのフック経由。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KEYS, load, save, exportAll, importAll } from './storage.js';
import { seedAll, makeEmployee, makeSettings, presetForNextSeat } from './seed.js';
import { createTask, applyStepResult, nextStep, assembleResult } from './workflow.js';
import { runStep, distill, extractUrls } from './runtime.js';
import { createKnowledge, makeSource, markUsed, markVerified } from './knowledge.js';
import { makeEntry, appendAudit } from './audit.js';
import { checkAction } from './permissions.js';
import { createDeal } from './revenue.js';
import { createMeeting, addRound, opinionPrompt, rebuttalPrompt, synthesisPrompt } from './meeting.js';
import { newId } from './id.js';
import { workflowById } from '../data/workflows.js';
import { providerById } from './providers/index.js';
import { makeGenre, DEFAULT_GENRE_ID } from '../data/genres.js';
import { makeEvent } from './schedule.js';

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
  // 実行系（runTask など）は setState の反映を待たずに続きを読む必要があるため、
  // 最新の状態を ref にも同期で持つ。**更新は必ず put/log を通すこと**
  // （直接 setState すると ref が古いままになり、作った直後の仕事が
  //  「見つからない」扱いになる）。
  const stateRef = useRef(state);

  // ---- 読み込み・設立 ----
  useEffect(() => {
    let alive = true;
    (async () => {
      const seeded = await load(KEYS.seeded, false);
      if (!seeded) {
        const fresh = seedAll();
        await save(KEYS.company, fresh.company);
        await save(KEYS.departments, fresh.departments);
        await save(KEYS.employees, fresh.employees);
        await save(KEYS.settings, fresh.settings);
        await save(KEYS.seeded, true);
      }
      // 保存データが壊れていても画面が真っ白にならないよう、配列は必ず配列にする
      const arr = async (key) => {
        const v = await load(key, []);
        return Array.isArray(v) ? v : [];
      };
      const next = {
        company: await load(KEYS.company, null),
        departments: await arr(KEYS.departments),
        employees: await arr(KEYS.employees),
        tasks: await arr(KEYS.tasks),
        meetings: await arr(KEYS.meetings),
        knowledge: await arr(KEYS.knowledge),
        sources: await arr(KEYS.sources),
        deals: await arr(KEYS.deals),
        approvals: await arr(KEYS.approvals),
        audit: await arr(KEYS.audit),
        connections: await arr(KEYS.connections),
        genres: await arr(KEYS.genres),
        events: await arr(KEYS.events),
        settings: { ...makeSettings(), ...(await load(KEYS.settings, {})) },
        secrets: (await load(KEYS.secrets, {})) || {},
      };
      if (alive) {
        stateRef.current = next;
        setState(next);
        setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 保存つきの更新。key に対応する値だけを書く。
  // ref を先に更新してから setState することで、同じ処理の中で続けて
  // stateRef.current を読んでも最新が返る。
  const put = useCallback((key, value) => {
    stateRef.current = { ...stateRef.current, [keyName(key)]: value };
    setState(stateRef.current);
    save(key, value);
  }, []);

  const log = useCallback((entry) => {
    const next = appendAudit(stateRef.current.audit, makeEntry(entry));
    stateRef.current = { ...stateRef.current, audit: next };
    setState(stateRef.current);
    save(KEYS.audit, next);
  }, []);

  // ---- 社員 ----
  const hireEmployee = useCallback(
    (preset) => {
      const emp = makeEmployee(preset);
      const next = [...stateRef.current.employees, emp];
      put(KEYS.employees, next);
      log({ actor: 'user', action: 'employeeHired', target: emp.name });
      return emp;
    },
    [put, log]
  );

  const hireIntoRole = useCallback(
    (roleId, genreId = DEFAULT_GENRE_ID) => {
      const s = stateRef.current;
      const preset = presetForNextSeat(s.employees, roleId, genreId, s.genres);
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
        });
      } catch (e) {
        result = { error: e.message || String(e) };
      }
      setBusy(null);

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

      // ① 意見
      mtg = { ...mtg, status: 'running', phase: 'opinion' };
      for (const emp of parts) {
        // eslint-disable-next-line no-await-in-loop
        const r = await ask(emp, opinionPrompt(mtg.topic, mtg.interventions));
        mtg = addRound(mtg, { phase: 'opinion', employeeId: emp.id, employeeName: emp.name, ...r });
        patchMeeting(mtg);
      }

      // ② 反論
      mtg = { ...mtg, phase: 'rebuttal' };
      for (const emp of parts) {
        const others = mtg.rounds.filter((r) => r.phase === 'opinion' && r.employeeId !== emp.id);
        // eslint-disable-next-line no-await-in-loop
        const r = await ask(emp, rebuttalPrompt(mtg.topic, others));
        mtg = addRound(mtg, { phase: 'rebuttal', employeeId: emp.id, employeeName: emp.name, ...r });
        patchMeeting(mtg);
      }

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

  const exportData = useCallback(() => exportAll(), []);
  const importData = useCallback(
    async (payload) => {
      const n = await importAll(payload);
      window.location.reload();
      return n;
    },
    []
  );

  return {
    ...state,
    ready,
    busy,
    activeEmployees,
    // 社員
    hireEmployee,
    hireIntoRole,
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
