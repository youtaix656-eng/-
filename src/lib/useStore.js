// アプリ全体の学習データを管理するカスタムフック
// 問題・SRS・履歴・メモ・設定を保持し、変更を IndexedDB に永続化する。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as storage from './storage.js';
import { applyGrade, applyAnswer, emptyState, isInReview, isDue, sortByPriority, GRADES } from './srs.js';
import { dateKey, nextStreak } from './connect.js';
import { readSeedFromHash, readImportFromHash, clearSeedHash } from './noteshare.js';
import { decodeSync, syncToBackup, isSyncExpired } from './sync.js';
import { dedupeAgainst } from './importer.js';
import sampleQuestions from '../data/sampleQuestions.js';
import iryouQuestions from '../data/iryouQuestions.js';
import eiseiQuestions, { EISEI_VERSION } from '../data/eiseiQuestions.js';
import houkiQuestions, { HOUKI_VERSION } from '../data/houkiQuestions.js';
import anatQuestions, { ANAT_VERSION } from '../data/anatQuestions.js';
import seiriQuestions, { SEIRI_VERSION } from '../data/seiriQuestions.js';
import rinshoQuestions, { RINSHO_VERSION } from '../data/rinshoQuestions.js';
import zumondaiQuestions, { ZUMONDAI_VERSION } from '../data/zumondaiQuestions.js';
import rinkakuQuestions, { RINKAKU_VERSION } from '../data/rinkakuQuestions.js';
import rihaQuestions, { RIHA_VERSION } from '../data/rihaQuestions.js';
import toyoQuestions, { TOYO_VERSION } from '../data/toyoQuestions.js';
import { SUBJECT_TAG_NAMES } from '../data/examScope.js';
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
  const [bookmarks, setBookmarks] = useState({}); // ブックマーク（後で見直す）
  const [links, setLinks] = useState({});
  const [schedule, setSchedule] = useState([]);
  const [venues, setVenues] = useState([]);
  const [examContent, setExamContent] = useState(DEFAULT_EXAM_CONTENT);
  const [selfNotes, setSelfNotes] = useState([]);
  const [kwMeta, setKwMeta] = useState({});
  const [userDict, setUserDict] = useState([]);
  const [session, setSessionState] = useState(null); // 学習セッション（60/300/900）
  const [unread, setUnreadState] = useState([]); // 読み取れなかったページ・問題の控え
  const [auth, setAuthState] = useState(null); // 端末内ログイン鍵
  const [examResults, setExamResultsState] = useState([]); // 模試の結果履歴
  const [activity, setActivityState] = useState([]); // 直近の閲覧履歴（ホーム右上）
  const [numberOverrides, setNumberOverridesState] = useState({}); // 数値ファクトの上書き（毎年更新）
  const [seedToast, setSeedToast] = useState(0); // 体験談の取り込み件数
  const [importedToast, setImportedToast] = useState(0); // 問題の取り込み件数
  const [syncToast, setSyncToast] = useState(0); // 別端末からの進捗取り込み
  const [settings, setSettings] = useState(storage.DEFAULT_SETTINGS);

  // 初期ロード（IndexedDB）。旧 localStorage からの移行も行う。
  useEffect(() => {
    let alive = true;
    (async () => {
      await storage.migrateFromLocalStorage();
      // 別端末からの進捗取り込み（QR/URL の #sync=…）。読み込み前に反映する。
      try {
        const hash = window.location.hash || '';
        const mSync = hash.match(/[#&]sync=([^&]+)/);
        if (mSync) {
          const payload = decodeSync(decodeURIComponent(mSync[1]));
          if (isSyncExpired(payload)) {
            // 発行から5分を過ぎた受け渡しは安全のため取り込まない
            window.alert(
              'この受け渡しリンク／QRコードは発行から5分以上経過したため使えません（安全のため）。\n受け渡し元でもう一度発行してください。'
            );
          } else {
            const ok = window.confirm(
              '別端末の学習データ（進捗・設定）を取り込みます。この端末の進捗は上書きされます。よろしいですか？'
            );
            if (ok) {
              await storage.importAll(syncToBackup(payload));
              if (alive) setSyncToast(1);
            }
          }
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      } catch (e) {
        /* 無効な sync データは無視 */
      }
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
      const ss = await storage.loadSession();
      const ur = await storage.loadUnread();
      const au = await storage.loadAuth();
      const er = await storage.loadExamResults();
      const act = await storage.loadActivity();
      const numOv = await storage.loadNumberOverrides();
      if (!alive) return;
      let baseQuestions = q && q.length > 0 ? q : sampleQuestions;
      let mutated = false; // 保存が必要な変更が入ったか
      // アプリ同梱の医療概論 一問一答（92問）を初回だけ問題バンクへ取り込む。
      // 既存ユーザーにも1回だけ追加され、削除しても再追加されないよう cfg にフラグを持つ。
      if (!cfg.iryouSeeded) {
        const { unique } = dedupeAgainst(iryouQuestions, baseQuestions);
        if (unique.length) baseQuestions = [...baseQuestions, ...unique];
        cfg.iryouSeeded = true;
        mutated = true;
      }
      // 同梱の衛生学・公衆衛生学（バッチ方式・増分）。EISEI_VERSION が上がるたびに未収録分を追加。
      if ((cfg.eiseiVersion || 0) < EISEI_VERSION) {
        const { unique } = dedupeAgainst(eiseiQuestions, baseQuestions);
        if (unique.length) baseQuestions = [...baseQuestions, ...unique];
        cfg.eiseiVersion = EISEI_VERSION;
        mutated = true;
      }
      // 同梱の関係法規（バッチ方式・増分）。HOUKI_VERSION が上がるたびに未収録分を追加。
      if ((cfg.houkiVersion || 0) < HOUKI_VERSION) {
        const { unique } = dedupeAgainst(houkiQuestions, baseQuestions);
        if (unique.length) baseQuestions = [...baseQuestions, ...unique];
        cfg.houkiVersion = HOUKI_VERSION;
        mutated = true;
      }
      // 同梱の解剖学（バッチ方式・増分）。ANAT_VERSION が上がるたびに未収録分を追加。
      if ((cfg.anatVersion || 0) < ANAT_VERSION) {
        const { unique } = dedupeAgainst(anatQuestions, baseQuestions);
        if (unique.length) baseQuestions = [...baseQuestions, ...unique];
        cfg.anatVersion = ANAT_VERSION;
        mutated = true;
      }
      // 同梱の生理学（バッチ方式・増分）。SEIRI_VERSION が上がるたびに未収録分を追加。
      if ((cfg.seiriVersion || 0) < SEIRI_VERSION) {
        const { unique } = dedupeAgainst(seiriQuestions, baseQuestions);
        if (unique.length) baseQuestions = [...baseQuestions, ...unique];
        cfg.seiriVersion = SEIRI_VERSION;
        mutated = true;
      }
      // 同梱の臨床医学総論（バッチ方式・増分）。RINSHO_VERSION が上がるたびに未収録分を追加。
      if ((cfg.rinshoVersion || 0) < RINSHO_VERSION) {
        const { unique } = dedupeAgainst(rinshoQuestions, baseQuestions);
        if (unique.length) baseQuestions = [...baseQuestions, ...unique];
        cfg.rinshoVersion = RINSHO_VERSION;
        mutated = true;
      }
      // 同梱の図問題（図を見て答える四択）。ZUMONDAI_VERSION が上がるたびに未収録分を追加。
      if ((cfg.zumondaiVersion || 0) < ZUMONDAI_VERSION) {
        const { unique } = dedupeAgainst(zumondaiQuestions, baseQuestions);
        if (unique.length) baseQuestions = [...baseQuestions, ...unique];
        cfg.zumondaiVersion = ZUMONDAI_VERSION;
        mutated = true;
      }
      // 同梱の臨床医学各論（バッチ方式・増分）。RINKAKU_VERSION が上がるたびに未収録分を追加。
      if ((cfg.rinkakuVersion || 0) < RINKAKU_VERSION) {
        const { unique } = dedupeAgainst(rinkakuQuestions, baseQuestions);
        if (unique.length) baseQuestions = [...baseQuestions, ...unique];
        cfg.rinkakuVersion = RINKAKU_VERSION;
        mutated = true;
      }
      // 同梱のリハビリテーション医学（バッチ方式・増分）。RIHA_VERSION が上がるたびに未収録分を追加。
      if ((cfg.rihaVersion || 0) < RIHA_VERSION) {
        const { unique } = dedupeAgainst(rihaQuestions, baseQuestions);
        if (unique.length) baseQuestions = [...baseQuestions, ...unique];
        cfg.rihaVersion = RIHA_VERSION;
        mutated = true;
      }
      // 同梱の東洋医学概論（バッチ方式・増分）。TOYO_VERSION が上がるたびに未収録分を追加。
      if ((cfg.toyoVersion || 0) < TOYO_VERSION) {
        const { unique } = dedupeAgainst(toyoQuestions, baseQuestions);
        if (unique.length) baseQuestions = [...baseQuestions, ...unique];
        cfg.toyoVersion = TOYO_VERSION;
        mutated = true;
      }
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
      // 【変更】医療概論の genre（出題基準カテゴリ）は廃止し、tags（キーワード）へ折り込む。初回のみ。
      // 他科目（衛生学など）の genre はジャンル絞り込みに使うため折り込まない。
      if (!cfg.genreFolded) {
        baseQuestions = baseQuestions.map((qq) => {
          if (!qq.genre || qq.subject !== '医療概論') return qq;
          const parts = String(qq.genre).split('｜').filter(Boolean);
          const tags = Array.from(new Set([...(qq.tags || []), ...parts]));
          const { genre, ...rest } = qq;
          return { ...rest, tags };
        });
        cfg.genreFolded = true;
        mutated = true;
      }
      // 【取り消し】以前に各問題へ自動付与していた「科目タグ」を取り除く（仕様変更）。
      // 科目での絞り込みは検索フィルタ（科目名）で行うため、tags には入れない。初回のみ。
      if (!cfg.subjectTagsCleaned) {
        const SUB = new Set(SUBJECT_TAG_NAMES);
        baseQuestions = baseQuestions.map((qq) => {
          if (!qq.tags || !qq.tags.some((t) => SUB.has(t))) return qq;
          const tags = qq.tags.filter((t) => !SUB.has(t));
          const out = { ...qq };
          if (tags.length) out.tags = tags;
          else delete out.tags;
          return out;
        });
        cfg.subjectTagsCleaned = true;
        mutated = true;
      }
      setQuestions(baseQuestions);
      if (!(q && q.length > 0) || importSeed || mutated) storage.saveQuestions(baseQuestions);
      if (mutated) storage.saveSettings(cfg);
      setSrs(s || {});
      setHistory(h || []);
      setMemos(m || {});
      storage.loadBookmarks().then((bm) => { if (alive) setBookmarks(bm || {}); });
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
      setSessionState(ss || null);
      setUnreadState(ur || []);
      setAuthState(au || null);
      setExamResultsState(er || []);
      setActivityState(Array.isArray(act) ? act : []);
      setNumberOverridesState(numOv && typeof numOv === 'object' ? numOv : {});
      setKwMeta(km || {});
      // 【取り消し】用語辞書に登録していた科目名を取り除く
      let dict = (ud || []).filter((t) => !SUBJECT_TAG_NAMES.includes(t));
      if (dict.length !== (ud || []).length) storage.saveUserDict(dict);
      setUserDict(dict);

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
    if (persist.current) storage.saveBookmarks(bookmarks);
  }, [bookmarks]);
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
    if (persist.current) storage.saveUnread(unread);
  }, [unread]);
  useEffect(() => {
    if (persist.current) storage.saveActivity(activity);
  }, [activity]);
  useEffect(() => {
    if (persist.current) storage.saveNumberOverrides(numberOverrides);
  }, [numberOverrides]);
  useEffect(() => {
    if (persist.current) storage.saveSettings(settings);
  }, [settings]);

  // 読み取れなかったページ・問題の控え（追加・削除）
  const addUnread = useCallback((entry) => {
    setUnreadState((cur) => [
      { id: `ur-${Date.now().toString(36)}`, at: Date.now(), ...entry },
      ...cur,
    ]);
  }, []);
  const removeUnread = useCallback((id) => {
    setUnreadState((cur) => cur.filter((x) => x.id !== id));
  }, []);

  // 直近の閲覧履歴を記録（新しい順・最大50件）。
  // 直前と同じ画面＋ジャンルの連続は1件にまとめる（時刻だけ更新）。
  const ACTIVITY_MAX = 50;
  const logActivity = useCallback((entry) => {
    if (!entry || !entry.view) return;
    setActivityState((cur) => {
      const at = Date.now();
      const top = cur[0];
      if (top && top.view === entry.view && (top.genre || '') === (entry.genre || '') && (top.title || '') === (entry.title || '')) {
        // 同じ内容の連続 → 先頭の時刻だけ更新
        const next = [...cur];
        next[0] = { ...top, at };
        return next;
      }
      const rec = {
        id: `ac-${at.toString(36)}-${Math.floor(Math.random() * 1e4)}`,
        at,
        view: entry.view,
        title: entry.title || '',
        genre: entry.genre || '',
        subject: entry.subject || '',
        keyword: entry.keyword || '',
      };
      return [rec, ...cur].slice(0, ACTIVITY_MAX);
    });
  }, []);
  const clearActivity = useCallback(() => setActivityState([]), []);

  // 数値ファクトの上書き（毎年変わる数値を全科目まとめて更新するための単一窓口）
  const setNumberOverride = useCallback((id, patch) => {
    if (!id) return;
    setNumberOverridesState((cur) => ({
      ...cur,
      [id]: { ...(cur[id] || {}), ...patch, updatedAt: Date.now() },
    }));
  }, []);
  const clearNumberOverride = useCallback((id) => {
    setNumberOverridesState((cur) => {
      if (!(id in cur)) return cur;
      const next = { ...cur };
      delete next[id];
      return next;
    });
  }, []);
  const clearAllNumberOverrides = useCallback(() => setNumberOverridesState({}), []);

  // ログイン鍵（端末内）の保存・削除。即時に IndexedDB へ書き込む。
  const setAuth = useCallback((record) => {
    setAuthState(record);
    storage.saveAuth(record);
  }, []);
  const clearAuth = useCallback(() => {
    setAuthState(null);
    storage.clearAuth();
  }, []);

  // 模試の結果を保存（新しいものを先頭に、最大100件）
  const addExamResult = useCallback((result) => {
    setExamResultsState((cur) => {
      const next = [{ id: `ex-${Date.now().toString(36)}`, at: Date.now(), ...result }, ...cur].slice(0, 100);
      storage.saveExamResults(next);
      return next;
    });
  }, []);

  // 解答を記録（grade 省略時は正誤から自動判定）
  const recordAnswer = useCallback((question, correct, grade, source) => {
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
      // source: 'review' なら復習由来（復習専用の到達集計に使う）
      { questionId: question.id, subject: question.subject, correct, at: now, ...(source ? { source } : {}) },
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

  // ブックマークの切り替え（後で見直す）
  const toggleBookmark = useCallback((questionId) => {
    setBookmarks((prev) => {
      const next = { ...prev };
      if (next[questionId]) delete next[questionId];
      else next[questionId] = Date.now();
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

  // 学習セッション（60/300/900）: 変更は即保存し、リロードで続きから復帰できるようにする
  const startSession = useCallback((s) => {
    setSessionState(s);
    storage.saveSession(s);
  }, []);
  const updateSession = useCallback((patch) => {
    setSessionState((prev) => {
      const next = prev ? { ...prev, ...patch } : patch;
      storage.saveSession(next);
      return next;
    });
  }, []);
  const clearSession = useCallback(() => {
    setSessionState(null);
    storage.clearSession();
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
  const clearSyncToast = useCallback(() => setSyncToast(0), []);

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
    storage.loadBookmarks().then((bm) => setBookmarks(bm || {}));
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
    bookmarks,
    toggleBookmark,
    links,
    session,
    startSession,
    updateSession,
    clearSession,
    unread,
    addUnread,
    removeUnread,
    auth,
    setAuth,
    clearAuth,
    examResults,
    addExamResult,
    activity,
    logActivity,
    clearActivity,
    numberOverrides,
    setNumberOverride,
    clearNumberOverride,
    clearAllNumberOverrides,
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
    syncToast,
    clearSyncToast,
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
