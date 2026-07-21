// アプリ全体の学習データを管理するカスタムフック
// 問題・SRS・履歴・メモ・設定を保持し、変更を IndexedDB に永続化する。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as storage from './storage.js';
import { applyGrade, applyAnswer, emptyState, isInReview, isDue, sortByPriority, GRADES } from './srs.js';
import { dateKey, nextStreak } from './connect.js';
import { readSeedFromHash, readImportFromHash, clearSeedHash } from './noteshare.js';
import { dedupeAgainst } from './importer.js';
import sampleQuestions from '../data/sampleQuestions.js';
import DEFAULT_EXAM_CONTENT from '../data/examContentScaffold.js';

function newNoteId() {
  return `sn-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
}
// 既存メモと重複しないものだけ返す（category+title+body で判定）
function mergeSelfNotes(existing, incoming) {
  const key = (n) => `${n.category || ''}|${n.title || ''}|${n.body || ''}`;
  const seen = new Set(existing.map(key));
  const add = [];
  for (const n of incoming) {
    const k = key(n);
    if (seen.has(k)) continue;
    seen.add(k);
    add.push({ id: newNoteId(), at: Date.now(), category: '', title: '', body: '', ...n });
  }
  return add;
}

export function useStore() {
  const [loaded, setLoaded] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [srs, setSrs] = useState({});
  const [history, setHistory] = useState([]);
  const [memos, setMemos] = useState({});
  const [links, setLinks] = useState({});
  const [schedule, setSchedule] = useState([]);
  const [venues, setVenues] = useState([]);
  const [examContent, setExamContent] = useState(DEFAULT_EXAM_CONTENT);
  const [selfNotes, setSelfNotes] = useState([]);
  const [kwMeta, setKwMeta] = useState({});
  const [userDict, setUserDict] = useState([]);
  const [seedToast, setSeedToast] = useState(0); // 体験談の取り込み件数
  const [importedToast, setImportedToast] = useState(0); // 問題の取り込み件数
  const [settings, setSettings] = useState(storage.DEFAULT_SETTINGS);

  // 初期ロード（IndexedDB）。旧 localStorage からの移行も行う。
  useEffect(() => {
    let alive = true;
    (async () => {
      await storage.migrateFromLocalStorage();
      const [q, s, h, m, lk, sch, vn, ec, sn, km, ud, cfg] = await Promise.all([
        storage.loadQuestions(),
        storage.loadSrs(),
        storage.loadHistory(),
        storage.loadMemos(),
        storage.loadLinks(),
        storage.loadSchedule(),
        storage.loadVenues(),
        storage.loadExamContent(),
        storage.loadSelfNotes(),
        storage.loadKwMeta(),
        storage.loadUserDict(),
        storage.loadSettings(),
      ]);
      if (!alive) return;
      let baseQuestions = q && q.length > 0 ? q : sampleQuestions;
      // チャットから投げた問題の取り込みリンク（#import=...）を端末に反映
      const importSeed = readImportFromHash();
      if (importSeed) {
        const withIds = importSeed.map((x, i) => ({
          id: x.id || `imp-${Date.now().toString(36)}-${i}`,
          ...x,
        }));
        const { unique } = dedupeAgainst(withIds, baseQuestions);
        if (unique.length) {
          baseQuestions = [...baseQuestions, ...unique];
          setImportedToast(unique.length);
        }
        clearSeedHash();
      }
      setQuestions(baseQuestions);
      if (!(q && q.length > 0) || importSeed) storage.saveQuestions(baseQuestions);
      setSrs(s || {});
      setHistory(h || []);
      setMemos(m || {});
      setLinks(lk || {});
      setSchedule(sch || []);
      setVenues(vn || []);
      setExamContent(ec && ec.length ? ec : DEFAULT_EXAM_CONTENT);

      // 端末だけに取り込む「体調メモ」の種（#notes=...）を反映
      const base = sn || [];
      const seed = readSeedFromHash();
      if (seed) {
        const add = mergeSelfNotes(base, seed);
        const next = [...base, ...add];
        setSelfNotes(next);
        storage.saveSelfNotes(next);
        clearSeedHash();
        if (add.length) setSeedToast(add.length);
      } else {
        setSelfNotes(base);
      }
      setKwMeta(km || {});
      setUserDict(ud || []);

      setSettings(cfg);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 永続化（初期ロード完了後のみ）
  const persist = useRef(false);
  useEffect(() => {
    persist.current = loaded;
  }, [loaded]);

  useEffect(() => {
    if (persist.current) storage.saveQuestions(questions);
  }, [questions]);
  useEffect(() => {
    if (persist.current) storage.saveSrs(srs);
  }, [srs]);
  useEffect(() => {
    if (persist.current) storage.saveHistory(history);
  }, [history]);
  useEffect(() => {
    if (persist.current) storage.saveMemos(memos);
  }, [memos]);
  useEffect(() => {
    if (persist.current) storage.saveLinks(links);
  }, [links]);
  useEffect(() => {
    if (persist.current) storage.saveSchedule(schedule);
  }, [schedule]);
  useEffect(() => {
    if (persist.current) storage.saveVenues(venues);
  }, [venues]);
  useEffect(() => {
    if (persist.current) storage.saveExamContent(examContent);
  }, [examContent]);
  useEffect(() => {
    if (persist.current) storage.saveSelfNotes(selfNotes);
  }, [selfNotes]);
  useEffect(() => {
    if (persist.current) storage.saveKwMeta(kwMeta);
  }, [kwMeta]);
  useEffect(() => {
    if (persist.current) storage.saveUserDict(userDict);
  }, [userDict]);
  useEffect(() => {
    if (persist.current) storage.saveSettings(settings);
  }, [settings]);

  // 解答を記録（grade 省略時は正誤から自動判定）
  const recordAnswer = useCallback((question, correct, grade) => {
    const now = Date.now();
    setSrs((prev) => ({
      ...prev,
      [question.id]:
        grade != null
          ? applyGrade(prev[question.id], grade, now)
          : applyAnswer(prev[question.id], correct, now),
    }));
    setHistory((prev) => [
      ...prev,
      { questionId: question.id, subject: question.subject, correct, at: now },
    ]);
    // バックアップ促し用のカウンタ
    setSettings((prev) => ({
      ...prev,
      answersSinceBackup: (prev.answersSinceBackup || 0) + 1,
    }));
  }, []);

  const setMemo = useCallback((questionId, text) => {
    setMemos((prev) => {
      const next = { ...prev };
      if (text && text.trim()) next[questionId] = text;
      else delete next[questionId];
      return next;
    });
  }, []);

  // 連結リンクの更新（patch: { keywords?, note?, related? }）
  const setLink = useCallback((questionId, patch) => {
    setLinks((prev) => {
      const cur = prev[questionId] || { keywords: [], note: '', related: [] };
      const next = { ...cur, ...patch };
      // 空になったら削除
      const isEmpty =
        (!next.keywords || next.keywords.length === 0) &&
        (!next.note || !next.note.trim()) &&
        (!next.related || next.related.length === 0);
      const out = { ...prev };
      if (isEmpty) delete out[questionId];
      else out[questionId] = next;
      return out;
    });
  }, []);

  // 「今日の1問」を深掘りした記録（ストリーク更新）
  const markDeepDive = useCallback(() => {
    setSettings((prev) => {
      const today = dateKey();
      if (prev.lastDeepDive === today) return prev; // 同日2回目は変化なし
      return {
        ...prev,
        deepDiveStreak: nextStreak(prev.lastDeepDive, prev.deepDiveStreak, today),
        lastDeepDive: today,
      };
    });
  }, []);

  const replaceQuestions = useCallback((newQuestions) => setQuestions(newQuestions), []);
  const appendQuestions = useCallback(
    (newQuestions) => setQuestions((prev) => [...prev, ...newQuestions]),
    []
  );

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  // 体調メモを重複なく追加（貼り付け取り込みなどから）
  const addSelfNotes = useCallback((incoming) => {
    setSelfNotes((prev) => {
      const add = mergeSelfNotes(prev, incoming);
      return add.length ? [...prev, ...add] : prev;
    });
  }, []);
  const clearSeedToast = useCallback(() => setSeedToast(0), []);
  const clearImportedToast = useCallback(() => setImportedToast(0), []);

  // キーワードのメタ（語呂合わせ）を更新
  const setKeywordMeta = useCallback((keyword, patch) => {
    setKwMeta((prev) => {
      const cur = prev[keyword] || { mnemonic: '' };
      const next = { ...cur, ...patch };
      const empty = !next.mnemonic;
      const out = { ...prev };
      if (empty) delete out[keyword];
      else out[keyword] = next;
      return out;
    });
  }, []);

  // キーワードの改名／統合（from を to に置き換える）。tags と links の両方を更新。
  const renameKeyword = useCallback((from, to) => {
    const f = String(from || '').trim();
    const t = String(to || '').trim();
    if (!f || !t || f === t) return;
    const repl = (arr) => Array.from(new Set((arr || []).map((k) => (k === f ? t : k))));
    setQuestions((prev) =>
      prev.map((q) => (q.tags && q.tags.includes(f) ? { ...q, tags: repl(q.tags) } : q))
    );
    setLinks((prev) => {
      const out = {};
      for (const [qid, l] of Object.entries(prev)) {
        out[qid] = l.keywords && l.keywords.includes(f) ? { ...l, keywords: repl(l.keywords) } : l;
      }
      return out;
    });
    setKwMeta((prev) => {
      if (!prev[f]) return prev;
      const out = { ...prev };
      const mnemonic = (prev[t]?.mnemonic || prev[f]?.mnemonic || '').trim();
      delete out[f];
      if (mnemonic) out[t] = { mnemonic };
      return out;
    });
  }, []);

  // 自動タグ付けの一括適用（plan: [{ id, add:[kw] }]）
  const bulkTag = useCallback((plan) => {
    if (!plan || plan.length === 0) return;
    const byId = new Map(plan.map((p) => [p.id, p.add]));
    setLinks((prev) => {
      const out = { ...prev };
      for (const [qid, add] of byId) {
        const cur = out[qid] || { keywords: [], note: '', related: [] };
        const kws = Array.from(new Set([...(cur.keywords || []), ...add]));
        out[qid] = { ...cur, keywords: kws };
      }
      return out;
    });
  }, []);

  // ユーザー辞書に用語を追加
  const addUserTerm = useCallback((term) => {
    const t = String(term || '').trim();
    if (!t) return;
    setUserDict((prev) => (prev.includes(t) ? prev : [...prev, t]));
  }, []);

  const resetProgress = useCallback(() => {
    storage.resetProgress();
    setSrs({});
    setHistory([]);
  }, []);

  const restoreSamples = useCallback(() => {
    storage.saveQuestions(sampleQuestions);
    setQuestions(sampleQuestions);
  }, []);

  // バックアップ実行後にカウンタをリセット
  const markBackedUp = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      answersSinceBackup: 0,
      lastAutoBackup: Date.now(),
    }));
  }, []);

  // バックアップから全復元し、state に反映
  const importBackup = useCallback(async (data) => {
    await storage.importAll(data);
    const [q, s, h, m, lk, sch, vn, ec, sn, km, cfg] = await Promise.all([
      storage.loadQuestions(),
      storage.loadSrs(),
      storage.loadHistory(),
      storage.loadMemos(),
      storage.loadLinks(),
      storage.loadSchedule(),
      storage.loadVenues(),
      storage.loadExamContent(),
      storage.loadSelfNotes(),
      storage.loadKwMeta(),
      storage.loadSettings(),
    ]);
    setQuestions(q || sampleQuestions);
    setSrs(s || {});
    setHistory(h || []);
    setMemos(m || {});
    setLinks(lk || {});
    setSchedule(sch || []);
    setVenues(vn || []);
    setExamContent(ec && ec.length ? ec : DEFAULT_EXAM_CONTENT);
    setSelfNotes(sn || []);
    setKwMeta(km || {});
    setUserDict(ud || []);
    setSettings(cfg);
  }, []);

  const reviewQuestions = useMemo(
    () => questions.filter((q) => isInReview(srs[q.id])),
    [questions, srs]
  );

  const dueReviewQuestions = useMemo(() => {
    const inReview = reviewQuestions;
    const due = inReview.filter((q) => isDue(srs[q.id]));
    const pool = due.length > 0 ? due : inReview;
    return sortByPriority(pool, srs);
  }, [reviewQuestions, srs]);

  return {
    loaded,
    questions,
    srs,
    history,
    memos,
    links,
    schedule,
    setSchedule,
    venues,
    setVenues,
    examContent,
    setExamContent,
    selfNotes,
    setSelfNotes,
    addSelfNotes,
    kwMeta,
    setKeywordMeta,
    renameKeyword,
    bulkTag,
    userDict,
    addUserTerm,
    seedToast,
    clearSeedToast,
    importedToast,
    clearImportedToast,
    settings,
    reviewQuestions,
    dueReviewQuestions,
    recordAnswer,
    setMemo,
    setLink,
    markDeepDive,
    replaceQuestions,
    appendQuestions,
    updateSettings,
    resetProgress,
    restoreSamples,
    markBackedUp,
    importBackup,
    emptyState,
    GRADES,
  };
}
