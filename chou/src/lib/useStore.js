// 画面から使う状態のまとめ。保存は storage.js（端末内だけ）。
//
// 決めていること
//  - 外から来たもの（取り込み）は必ず `normalizeDays` を通してから state に入れる。
//  - 消したものは 20 秒だけ戻せる（`undo`）。**戻せる間も、端末には消した後の形で保存する**
//    （戻す用の控えを保存に混ぜない）。
//  - 保存できなかったことを黙らない（`saveFailed` を画面のいちばん上に出す）。

import { useCallback, useEffect, useRef, useState } from 'react';
import { load, save, clear, storageSize } from './storage.js';
import {
  emptyTocState,
  normalizeCandidates,
  acceptCandidate,
  rejectCandidate,
  undoLastTocAdditions,
  setVerified,
} from './tocCandidates.js';
import { emptyProbiotic, normalizeProbiotic } from './probiotic.js';
import { normalizeEliminations, normalizeElimination, canStart, running } from './elimination.js';
import { emptyDay, normalizeDays, normalizeDay, newId } from './days.js';
import { normalizePeriods, normalizePeriod } from './periods.js';
import { normalizeVisits, normalizeVisit } from './visits.js';
import { normalizeErrors, makeEntry, addEntry } from './errorLog.js';
import { todayKey, shiftKey } from './dates.js';

const EMPTY = {
  days: {},
  foodResults: {},
  // 見た目・読みやすさ。**既定はいまと同じ**（足した項目で見た目が勝手に変わらない）
  settings: { theme: 'auto', textSize: 'normal', reduceMotion: false, contrast: 'normal', speak: false, voiceInput: false },
  // 目次まわり。**候補は本体（userTerms）とは別に持つ**——「追加する」を押すまで目次に出さない
  ...emptyTocState(),
  // 整腸剤（飲んでいるもの1つ）と、調味料の棚おろし
  probiotic: emptyProbiotic(),
  seasonings: {},
  // ためしにやめてみた期間（小麦・乳製品など）。**同時に走るのは1件だけ**
  eliminations: [],
  // いつもと違う期間の印（旅行・薬が変わった…）。**印だけで、判定はしない**
  periods: [],
  // 通院の予定・聞きたいこと・受診のあと。**通知は鳴らさない**
  visits: [],
  // 端末内のエラー（外へ送らない）
  errors: [],
};

/** 消したものを戻せる時間 */
export const UNDO_MS = 20000;

function hydrate(raw) {
  return {
    days: normalizeDays(raw.days),
    foodResults: raw.foodResults && typeof raw.foodResults === 'object' ? { ...raw.foodResults } : {},
    settings: { ...EMPTY.settings, ...(raw.settings || {}) },
    tocCandidates: normalizeCandidates(raw.tocCandidates),
    userTerms: Array.isArray(raw.userTerms) ? raw.userTerms.filter((t) => t && t.id && t.title) : [],
    removedIds: Array.isArray(raw.removedIds) ? raw.removedIds.filter((id) => typeof id === 'string') : [],
    tocHistory: Array.isArray(raw.tocHistory) ? raw.tocHistory.filter((h) => h && h.id) : [],
    probiotic: normalizeProbiotic(raw.probiotic),
    seasonings: raw.seasonings && typeof raw.seasonings === 'object' ? { ...raw.seasonings } : {},
    eliminations: normalizeEliminations(raw.eliminations),
    periods: normalizePeriods(raw.periods),
    visits: normalizeVisits(raw.visits),
    errors: normalizeErrors(raw.errors),
  };
}

export function useStore() {
  const [state, setState] = useState(() => hydrate(load(EMPTY)));
  const [saveFailed, setSaveFailed] = useState(false);
  const [undo, setUndo] = useState(null);
  const first = useRef(true);
  const undoTimer = useRef(null);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaveFailed(!save(state));
  }, [state]);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const offerUndo = useCallback((label, restore) => {
    clearTimeout(undoTimer.current);
    setUndo({ id: newId('u'), label, restore });
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  }, []);

  const clearUndo = useCallback(() => {
    clearTimeout(undoTimer.current);
    setUndo(null);
  }, []);

  const runUndo = useCallback(() => {
    setUndo((cur) => {
      if (cur) cur.restore();
      return null;
    });
    clearTimeout(undoTimer.current);
  }, []);

  /** 1日の記録を書き換える。`patch` は値でも関数でもよい */
  const updateDay = useCallback((date, patch) => {
    setState((prev) => {
      const before = prev.days[date] || emptyDay(date);
      const changed = typeof patch === 'function' ? patch(before) : { ...before, ...patch };
      const next = normalizeDay({ ...changed, date, updatedAt: Date.now() });
      if (!next) return prev;
      return { ...prev, days: { ...prev.days, [date]: next } };
    });
  }, []);

  const addStool = useCallback(
    (date, stool) => {
      updateDay(date, (day) => ({ ...day, stools: [...day.stools, { id: newId('s'), ...stool }] }));
    },
    [updateDay],
  );

  const updateStool = useCallback(
    (date, id, patch) => {
      updateDay(date, (day) => ({
        ...day,
        stools: day.stools.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      }));
    },
    [updateDay],
  );

  const removeStool = useCallback(
    (date, id) => {
      let removed = null;
      updateDay(date, (day) => {
        removed = day.stools.find((s) => s.id === id) || null;
        return { ...day, stools: day.stools.filter((s) => s.id !== id) };
      });
      if (removed) {
        const back = removed;
        offerUndo('お通じの記録を1件消しました', () =>
          updateDay(date, (day) => ({ ...day, stools: [...day.stools, back] })),
        );
      }
    },
    [updateDay, offerUndo],
  );

  const addMeal = useCallback(
    (date, meal) => {
      updateDay(date, (day) => ({ ...day, meals: [...day.meals, { id: newId('m'), ...meal }] }));
    },
    [updateDay],
  );

  /** たべものの時刻・中身をあとから直す（お通じと同じように直せるようにする） */
  const updateMeal = useCallback(
    (date, id, patch) => {
      updateDay(date, (day) => ({
        ...day,
        meals: day.meals.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      }));
    },
    [updateDay],
  );

  /**
   * 前の日をひな形にする（提案4）。**自動では入れない**——押した時だけ、
   * 段の項目だけを写す。お通じ・たべもの・ひとことは日ごとに違うので写さない。
   */
  const copyPreviousDay = useCallback(
    (date) => {
      const prevKey = shiftKey(date, -1);
      const prev = state.days[prevKey];
      if (!prev) return false;
      updateDay(date, (day) => ({
        ...day,
        belly: day.belly || prev.belly,
        pain: day.pain || prev.pain,
        bloat: day.bloat || prev.bloat,
        stress: day.stress || prev.stress,
        exercise: day.exercise || prev.exercise,
        sleep: day.sleep || prev.sleep,
        posture: day.posture || prev.posture,
        water: day.water || prev.water,
      }));
      return true;
    },
    [state.days, updateDay],
  );

  const removeMeal = useCallback(
    (date, id) => {
      let removed = null;
      updateDay(date, (day) => {
        removed = day.meals.find((m) => m.id === id) || null;
        return { ...day, meals: day.meals.filter((m) => m.id !== id) };
      });
      if (removed) {
        const back = removed;
        offerUndo('たべもののメモを1件消しました', () =>
          updateDay(date, (day) => ({ ...day, meals: [...day.meals, back] })),
        );
      }
    },
    [updateDay, offerUndo],
  );

  const removeDay = useCallback(
    (date) => {
      setState((prev) => {
        const back = prev.days[date];
        if (!back) return prev;
        const days = { ...prev.days };
        delete days[date];
        offerUndo('1日ぶんの記録を消しました', () =>
          setState((cur) => ({ ...cur, days: { ...cur.days, [date]: back } })),
        );
        return { ...prev, days };
      });
    },
    [offerUndo],
  );

  const setFoodResult = useCallback((name, result) => {
    setState((prev) => {
      const next = { ...prev.foodResults };
      if (!result || next[name] === result) delete next[name];
      else next[name] = result;
      return { ...prev, foodResults: next };
    });
  }, []);

  /** 飲んでいる整腸剤（1つだけ）。**効いたかは記録しない**——残すのは何をいつから、まで */
  const setProbiotic = useCallback((patch) => {
    setState((prev) => ({ ...prev, probiotic: normalizeProbiotic({ ...prev.probiotic, ...patch }) }));
  }, []);

  /**
   * ためしにやめてみるのを始める。**2つ同時には始めない**——どちらが効いたのか
   * 分からなくなるため。断るだけで、**勝手に入れ替えない**（`canStart` を見て返す）。
   */
  const startElimination = useCallback((targetId, startedOn) => {
    const check = canStart(state.eliminations, targetId);
    if (!check.ok) return check;
    const entry = normalizeElimination({ targetId, startedOn: startedOn || todayKey() });
    if (!entry) return { ok: false, reason: '始める日が正しくありません。' };
    setState((prev) => ({ ...prev, eliminations: [...prev.eliminations, entry] }));
    return { ok: true, reason: '' };
  }, [state.eliminations]);

  /** 終える。**採点しない**——終えた日とひとことだけを残す */
  const endElimination = useCallback((id, endedOn, note) => {
    setState((prev) => ({
      ...prev,
      eliminations: prev.eliminations.map((e) =>
        e.id === id
          ? normalizeElimination({ ...e, endedOn: endedOn || todayKey(), note: note === undefined ? e.note : note })
          : e,
      ).filter(Boolean),
    }));
  }, []);

  /** 消す（作った記録は必ず消せるようにする） */
  const removeElimination = useCallback((id) => {
    setState((prev) => ({ ...prev, eliminations: prev.eliminations.filter((e) => e.id !== id) }));
  }, []);

  /** 調味料の棚おろし。**採点しない**——押した本人の答えを残すだけ */
  const setSeasoning = useCallback((id, choice) => {
    setState((prev) => {
      const next = { ...prev.seasonings };
      if (!choice || next[id] === choice) delete next[id];
      else next[id] = choice;
      return { ...prev, seasonings: next };
    });
  }, []);

  const setSettings = useCallback((patch) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  }, []);

  /** 候補を足す。**合図が3つのどれかでなければ `makeCandidate` が null を返すので、ここへは来ない** */
  const addTocCandidate = useCallback((candidate) => {
    if (!candidate) return false;
    setState((prev) => ({ ...prev, tocCandidates: [...prev.tocCandidates, candidate] }));
    return true;
  }, []);

  /** 「追加する／削除する」。**押した時に初めて**4つの確かめを通して本体へ入れる */
  // **`setState` の更新関数の中で結果を組み立てない**——更新関数は次の描き直しの時に走るので、
  // 返り値（入れられたか・理由）が呼び出し側へ届かない。いま描かれている state から作る。
  const acceptTocCandidate = useCallback(
    (id) => {
      const result = acceptCandidate(state, id);
      if (result.ok) setState(result.state);
      return result;
    },
    [state],
  );

  /** 「しない」。**本体には何も残さない**（履歴にだけ見送りとして残る） */
  const rejectTocCandidate = useCallback(
    (id) => {
      const result = rejectCandidate(state, id);
      if (result.ok) setState(result.state);
      return result;
    },
    [state],
  );

  const undoTocAdditions = useCallback(
    (n = 1) => {
      const result = undoLastTocAdditions(state, n);
      if (result.ok) setState(result.state);
      return result;
    },
    [state],
  );

  /** 説明を「確かめた」にする。**人が押した時だけ**（byUser が無ければ何も変わらない） */
  const markTermVerified = useCallback(
    (entryId) => {
      const result = setVerified(state, entryId, { byUser: true });
      if (result.ok) setState(result.state);
      return result;
    },
    [state],
  );

  // ── いつもと違う期間の印（提案6）。**印だけで、症状の理由を決めない** ──
  const addPeriod = useCallback((raw) => {
    const entry = normalizePeriod({ ...raw, id: newId('p') });
    if (!entry) return false;
    setState((prev) => ({ ...prev, periods: normalizePeriods([...prev.periods, entry]) }));
    return true;
  }, []);

  const updatePeriod = useCallback((id, patch) => {
    setState((prev) => ({
      ...prev,
      periods: normalizePeriods(prev.periods.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    }));
  }, []);

  const removePeriod = useCallback(
    (id) => {
      setState((prev) => {
        const back = prev.periods.find((p) => p.id === id);
        if (!back) return prev;
        offerUndo('いつもと違う期間の印を1件消しました', () =>
          setState((cur) => ({ ...cur, periods: normalizePeriods([...cur.periods, back]) })),
        );
        return { ...prev, periods: prev.periods.filter((p) => p.id !== id) };
      });
    },
    [offerUndo],
  );

  // ── 通院（提案14〜16）。**通知は鳴らさない**（サーバーを持たないので約束できない） ──
  const addVisit = useCallback((raw) => {
    const entry = normalizeVisit({ ...raw, id: newId('v') });
    if (!entry) return false;
    setState((prev) => ({ ...prev, visits: normalizeVisits([...prev.visits, entry]) }));
    return true;
  }, []);

  const updateVisit = useCallback((id, patch) => {
    setState((prev) => ({
      ...prev,
      visits: normalizeVisits(
        prev.visits.map((v) => (v.id === id ? { ...v, ...(typeof patch === 'function' ? patch(v) : patch) } : v)),
      ),
    }));
  }, []);

  const removeVisit = useCallback(
    (id) => {
      setState((prev) => {
        const back = prev.visits.find((v) => v.id === id);
        if (!back) return prev;
        offerUndo('通院の記録を1件消しました', () =>
          setState((cur) => ({ ...cur, visits: normalizeVisits([...cur.visits, back]) })),
        );
        return { ...prev, visits: prev.visits.filter((v) => v.id !== id) };
      });
    },
    [offerUndo],
  );

  /** 聞きたいこと。**採点も並べ替えもしない**（書いた順のまま） */
  const addQuestion = useCallback(
    (visitId, text) => {
      updateVisit(visitId, (v) => ({
        ...v,
        questions: [...v.questions, { id: newId('q'), text, asked: false }],
      }));
    },
    [updateVisit],
  );

  const toggleQuestion = useCallback(
    (visitId, questionId) => {
      updateVisit(visitId, (v) => ({
        ...v,
        questions: v.questions.map((q) => (q.id === questionId ? { ...q, asked: !q.asked } : q)),
      }));
    },
    [updateVisit],
  );

  const removeQuestion = useCallback(
    (visitId, questionId) => {
      updateVisit(visitId, (v) => ({ ...v, questions: v.questions.filter((q) => q.id !== questionId) }));
    },
    [updateVisit],
  );

  // ── 端末内のエラー（外へ送らない） ──
  const logError = useCallback((where, error) => {
    const entry = makeEntry({
      where,
      message: error && error.message ? error.message : String(error || ''),
      detail: error && error.stack ? String(error.stack).split('\n').slice(1, 3).join(' ') : '',
    });
    if (!entry) return;
    setState((prev) => ({ ...prev, errors: addEntry(prev.errors, entry) }));
  }, []);

  const clearErrors = useCallback(() => {
    setState((prev) => ({ ...prev, errors: [] }));
  }, []);

  const clearAll = useCallback(() => {
    clear();
    setState(hydrate(EMPTY));
    clearUndo();
  }, [clearUndo]);

  /** 書き出し。取り込みと同じ形（この端末の中身そのまま） */
  const exportAll = useCallback(
    () => ({
      app: 'chou',
      version: 1,
      exportedOn: todayKey(),
      days: state.days,
      foodResults: state.foodResults,
      settings: state.settings,
      userTerms: state.userTerms,
      removedIds: state.removedIds,
      probiotic: state.probiotic,
      seasonings: state.seasonings,
      eliminations: state.eliminations,
      periods: state.periods,
      visits: state.visits,
    }),
    [state],
  );

  /** 取り込み。**今あるものは消さない**（同じ日は、あとから直したほうを残す） */
  const importAll = useCallback((raw) => {
    if (!raw || typeof raw !== 'object') return { ok: false, added: 0, updated: 0 };
    const incoming = normalizeDays(raw.days);
    let added = 0;
    let updated = 0;
    setState((prev) => {
      const days = { ...prev.days };
      for (const key of Object.keys(incoming)) {
        const mine = days[key];
        if (!mine) {
          days[key] = incoming[key];
          added += 1;
        } else if ((incoming[key].updatedAt || 0) > (mine.updatedAt || 0)) {
          days[key] = incoming[key];
          updated += 1;
        }
      }
      return {
        ...prev,
        days,
        foodResults: { ...prev.foodResults, ...(raw.foodResults || {}) },
        userTerms: [
          ...prev.userTerms,
          ...(Array.isArray(raw.userTerms) ? raw.userTerms : []).filter(
            (t) => t && t.id && !prev.userTerms.some((mine) => mine.id === t.id),
          ),
        ],
        removedIds: [...new Set([...prev.removedIds, ...(Array.isArray(raw.removedIds) ? raw.removedIds : [])])],
        // **今あるものを消さない**——同じ id はこちらを残す
        periods: normalizePeriods([
          ...prev.periods,
          ...normalizePeriods(raw.periods).filter((p) => !prev.periods.some((mine) => mine.id === p.id)),
        ]),
        visits: normalizeVisits([
          ...prev.visits,
          ...normalizeVisits(raw.visits).filter((v) => !prev.visits.some((mine) => mine.id === v.id)),
        ]),
      };
    });
    return { ok: true, added, updated };
  }, []);

  return {
    ...state,
    saveFailed,
    undo,
    runUndo,
    clearUndo,
    updateDay,
    addStool,
    updateStool,
    removeStool,
    addMeal,
    updateMeal,
    removeMeal,
    copyPreviousDay,
    removeDay,
    setFoodResult,
    setSettings,
    setProbiotic,
    setSeasoning,
    startElimination,
    endElimination,
    removeElimination,
    addPeriod,
    updatePeriod,
    removePeriod,
    addVisit,
    updateVisit,
    removeVisit,
    addQuestion,
    toggleQuestion,
    removeQuestion,
    logError,
    clearErrors,
    runningElimination: running(state.eliminations),
    addTocCandidate,
    acceptTocCandidate,
    rejectTocCandidate,
    undoTocAdditions,
    markTermVerified,
    clearAll,
    exportAll,
    importAll,
    storageSize,
  };
}
