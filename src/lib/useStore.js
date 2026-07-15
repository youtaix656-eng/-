// アプリ全体の学習データを管理するカスタムフック
// 問題・SRS・履歴・メモ・設定を保持し、変更を localStorage に永続化する。

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as storage from './storage.js';
import { applyAnswer, emptyState, isInReview, isDue, sortByPriority } from './srs.js';
import sampleQuestions from '../data/sampleQuestions.js';

export function useStore() {
  const [questions, setQuestions] = useState(() => {
    const saved = storage.loadQuestions();
    if (saved && saved.length > 0) return saved;
    // 初回はサンプル問題を投入
    storage.saveQuestions(sampleQuestions);
    return sampleQuestions;
  });
  const [srs, setSrs] = useState(() => storage.loadSrs());
  const [history, setHistory] = useState(() => storage.loadHistory());
  const [memos, setMemos] = useState(() => storage.loadMemos());
  const [settings, setSettings] = useState(() => storage.loadSettings());

  // 永続化（副作用のみ。effect が値を返すと React が cleanup と誤認するため波括弧で包む）
  useEffect(() => {
    storage.saveQuestions(questions);
  }, [questions]);
  useEffect(() => {
    storage.saveSrs(srs);
  }, [srs]);
  useEffect(() => {
    storage.saveHistory(history);
  }, [history]);
  useEffect(() => {
    storage.saveMemos(memos);
  }, [memos]);
  useEffect(() => {
    storage.saveSettings(settings);
  }, [settings]);

  // 解答を記録する（履歴とSRSを更新）
  const recordAnswer = useCallback((question, correct) => {
    const now = Date.now();
    setSrs((prev) => ({
      ...prev,
      [question.id]: applyAnswer(prev[question.id], correct, now),
    }));
    setHistory((prev) => [
      ...prev,
      { questionId: question.id, subject: question.subject, correct, at: now },
    ]);
  }, []);

  // メモの保存
  const setMemo = useCallback((questionId, text) => {
    setMemos((prev) => {
      const next = { ...prev };
      if (text && text.trim()) next[questionId] = text;
      else delete next[questionId];
      return next;
    });
  }, []);

  // 問題データの置き換え / 追加
  const replaceQuestions = useCallback((newQuestions) => {
    setQuestions(newQuestions);
  }, []);
  const appendQuestions = useCallback((newQuestions) => {
    setQuestions((prev) => [...prev, ...newQuestions]);
  }, []);

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

  // 「間違えた問題（復習対象）」のリスト
  const reviewQuestions = useMemo(() => {
    return questions.filter((q) => isInReview(srs[q.id]));
  }, [questions, srs]);

  // いま出題すべき復習問題（期限到来のものを優先度順に）
  const dueReviewQuestions = useMemo(() => {
    const inReview = reviewQuestions;
    const due = inReview.filter((q) => isDue(srs[q.id]));
    const pool = due.length > 0 ? due : inReview;
    return sortByPriority(pool, srs);
  }, [reviewQuestions, srs]);

  return {
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
    emptyState,
  };
}
