// アプリ全体の学習データを管理するカスタムフック
// 問題・SRS・履歴・メモ・設定を保持し、変更を IndexedDB に永続化する。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as storage from './storage.js';
import { applyGrade, applyAnswer, emptyState, isInReview, isDue, sortByPriority, GRADES } from './srs.js';
import sampleQuestions from '../data/sampleQuestions.js';

export function useStore() {
  const [loaded, setLoaded] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [srs, setSrs] = useState({});
  const [history, setHistory] = useState([]);
  const [memos, setMemos] = useState({});
  const [settings, setSettings] = useState(storage.DEFAULT_SETTINGS);

  // 初期ロード（IndexedDB）。旧 localStorage からの移行も行う。
  useEffect(() => {
    let alive = true;
    (async () => {
      await storage.migrateFromLocalStorage();
      const [q, s, h, m, cfg] = await Promise.all([
        storage.loadQuestions(),
        storage.loadSrs(),
        storage.loadHistory(),
        storage.loadMemos(),
        storage.loadSettings(),
      ]);
      if (!alive) return;
      if (q && q.length > 0) {
        setQuestions(q);
      } else {
        setQuestions(sampleQuestions);
        storage.saveQuestions(sampleQuestions);
      }
      setSrs(s || {});
      setHistory(h || []);
      setMemos(m || {});
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

  const replaceQuestions = useCallback((newQuestions) => setQuestions(newQuestions), []);
  const appendQuestions = useCallback(
    (newQuestions) => setQuestions((prev) => [...prev, ...newQuestions]),
    []
  );

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
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
    const [q, s, h, m, cfg] = await Promise.all([
      storage.loadQuestions(),
      storage.loadSrs(),
      storage.loadHistory(),
      storage.loadMemos(),
      storage.loadSettings(),
    ]);
    setQuestions(q || sampleQuestions);
    setSrs(s || {});
    setHistory(h || []);
    setMemos(m || {});
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
    settings,
    reviewQuestions,
    dueReviewQuestions,
    recordAnswer,
    setMemo,
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
