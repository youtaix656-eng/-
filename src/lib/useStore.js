// アプリ全体の学習データを管理するカスタムフック
// 問題・SRS・履歴・メモ・設定を保持し、変更を IndexedDB に永続化する。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as storage from './storage.js';
import { applyGrade, applyAnswer, emptyState, isInReview, isDue, sortByPriority, GRADES, normalize, MASTER_STREAK } from './srs.js';
import { dateKey, nextStreak } from './connect.js';
import { readSeedFromHash, readImportFromHash, clearSeedHash } from './noteshare.js';
import { decodeSync, syncToBackup, isSyncExpired } from './sync.js';
import { dedupeAgainst } from './importer.js';
import sampleQuestions from '../data/sampleQuestions.js';
import iryouQuestions from '../data/iryouQuestions.js';
import { SUBJECT_TAG_NAMES } from '../data/examScope.js';
// 各科目の問題データは動的import（コード分割）。起動時に main バンドルへ全部詰め込まず、
// 別チャンクとして並行取得する（バンドル縮小・科目ごとの差分キャッシュのため）。
const subjectDataModules = () =>
  Promise.all([
    import('../data/eiseiQuestions.js'),
    import('../data/houkiQuestions.js'),
    import('../data/anatQuestions.js'),
    import('../data/seiriQuestions.js'),
    import('../data/rinshoQuestions.js'),
    import('../data/zumondaiQuestions.js'),
    import('../data/rinkakuQuestions.js'),
    import('../data/rihaQuestions.js'),
    import('../data/toyoQuestions.js'),
    import('../data/keizetsuQuestions.js'),
    import('../data/hariQuestions.js'),
    import('../data/kyuQuestions.js'),
    import('../data/byoriQuestions.js'),
    import('../data/torinQuestions.js'),
    import('../data/integratedQuestions.js'),
  ]);
import DEFAULT_EXAM_CONTENT from '../data/examContentScaffold.js';
import { DEFAULT_MNEMONICS, DEFAULT_MNEMONICS_VERSION, LEGACY_MNEMONIC_KEYS_V1 } from '../data/defaultMnemonics.js';

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
  const [cloudAutoSyncToast, setCloudAutoSyncToast] = useState(0); // クラウド自動同期で他端末の進捗を取り込んだ回数
  const [cloudSyncStatus, setCloudSyncStatus] = useState(null); // { ok, at, pulled, error } | null（CloudBackup.jsxの状態表示用）

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
          const payload = await decodeSync(decodeURIComponent(mSync[1]));
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
      // IndexedDB読み込みと並行して、科目データのチャンクも取得を始める（ネットワークとDBを同時に進める）。
      const subjectDataPromise = subjectDataModules();
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
      const [
        { default: eiseiQuestions, EISEI_VERSION },
        { default: houkiQuestions, HOUKI_VERSION },
        { default: anatQuestions, ANAT_VERSION },
        { default: seiriQuestions, SEIRI_VERSION },
        { default: rinshoQuestions, RINSHO_VERSION },
        { default: zumondaiQuestions, ZUMONDAI_VERSION },
        { default: rinkakuQuestions, RINKAKU_VERSION },
        { default: rihaQuestions, RIHA_VERSION },
        { default: toyoQuestions, TOYO_VERSION },
        { default: keizetsuQuestions, KEIRAKU_VERSION },
        { default: hariQuestions, HARI_VERSION },
        { default: kyuQuestions, KYU_VERSION },
        { default: byoriQuestions, BYORI_VERSION },
        { default: torinQuestions, TORIN_VERSION },
        { default: integratedQuestions, INTEGRATED_VERSION },
      ] = await subjectDataPromise;
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
      // 同梱の経絡経穴概論（バッチ方式・増分）。KEIRAKU_VERSION が上がるたびに未収録分を追加。
      if ((cfg.keirakuVersion || 0) < KEIRAKU_VERSION) {
        const { unique } = dedupeAgainst(keizetsuQuestions, baseQuestions);
        if (unique.length) baseQuestions = [...baseQuestions, ...unique];
        cfg.keirakuVersion = KEIRAKU_VERSION;
        mutated = true;
      }
      // 同梱のはり理論（バッチ方式・増分）。HARI_VERSION が上がるたびに未収録分を追加。
      if ((cfg.hariVersion || 0) < HARI_VERSION) {
        const { unique } = dedupeAgainst(hariQuestions, baseQuestions);
        if (unique.length) baseQuestions = [...baseQuestions, ...unique];
        cfg.hariVersion = HARI_VERSION;
        mutated = true;
      }
      // 同梱のきゅう理論（バッチ方式・増分）。KYU_VERSION が上がるたびに未収録分を追加。
      if ((cfg.kyuVersion || 0) < KYU_VERSION) {
        const { unique } = dedupeAgainst(kyuQuestions, baseQuestions);
        if (unique.length) baseQuestions = [...baseQuestions, ...unique];
        cfg.kyuVersion = KYU_VERSION;
        mutated = true;
      }
      // 同梱の病理学概論（バッチ方式・増分）。BYORI_VERSION が上がるたびに未収録分を追加。
      if ((cfg.byoriVersion || 0) < BYORI_VERSION) {
        const { unique } = dedupeAgainst(byoriQuestions, baseQuestions);
        if (unique.length) baseQuestions = [...baseQuestions, ...unique];
        cfg.byoriVersion = BYORI_VERSION;
        mutated = true;
      }
      // 同梱の東洋医学臨床論（バッチ方式・増分）。TORIN_VERSION が上がるたびに未収録分を追加。
      if ((cfg.torinVersion || 0) < TORIN_VERSION) {
        const { unique } = dedupeAgainst(torinQuestions, baseQuestions);
        if (unique.length) baseQuestions = [...baseQuestions, ...unique];
        cfg.torinVersion = TORIN_VERSION;
        mutated = true;
      }
      // 同梱の総合問題（連問形式・バッチ方式・増分）。INTEGRATED_VERSION が上がるたびに未収録分を追加。
      if ((cfg.integratedVersion || 0) < INTEGRATED_VERSION) {
        const { unique } = dedupeAgainst(integratedQuestions, baseQuestions);
        if (unique.length) baseQuestions = [...baseQuestions, ...unique];
        cfg.integratedVersion = INTEGRATED_VERSION;
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
      // 同梱の語呂合わせ（バッチ方式・増分）。DEFAULT_MNEMONICS_VERSION が上がるたびに
      // 未登録のキーワードだけ追加（既存ユーザーが編集・削除したものは上書きしない）。
      let baseKwMeta = km || {};
      if ((cfg.mnemonicsVersion || 0) < DEFAULT_MNEMONICS_VERSION) {
        const merged = { ...baseKwMeta };
        let changed = false;
        // v1→v2：経穴横並びを1本の長文からセンテンスごとの個別登録に作り直したため、
        // 旧キー（長文版）は削除してから新しい個別キーを追加する。
        if ((cfg.mnemonicsVersion || 0) < 2) {
          for (const oldKey of LEGACY_MNEMONIC_KEYS_V1) {
            if (merged[oldKey]) {
              delete merged[oldKey];
              changed = true;
            }
          }
        }
        for (const d of DEFAULT_MNEMONICS) {
          if (!merged[d.keyword] || !merged[d.keyword].mnemonic) {
            merged[d.keyword] = { mnemonic: d.mnemonic, reading: d.reading, ...(d.subject ? { subject: d.subject } : {}) };
            changed = true;
          }
        }
        if (changed) {
          baseKwMeta = merged;
          storage.saveKwMeta(baseKwMeta);
        }
        cfg.mnemonicsVersion = DEFAULT_MNEMONICS_VERSION;
        mutated = true;
      }
      setKwMeta(baseKwMeta);
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

  // ==== クラウド自動同期（Googleドライブ・任意、設定でONの場合のみ） ====
  // アプリを開いた時と、進捗（srs/history/memos/links/examResults）が変わった数秒後に、
  // 同意画面を出さずに（サイレント認証で）クラウドの最新版を確認し、
  // lib/progressMerge.js のマージ規則で統合してから書き戻す。単純な「新しい方で上書き」
  // だと片方の端末の進捗が消えることがあるため、種類ごとに適したマージを使う。
  // googleDrive.js・progressMerge.js は実際に使う時だけ動的import（未使用ユーザーの
  // バンドルを増やさないため）。サイレント認証・通信の失敗は静かに諦める（ユーザー操作を妨げない）。
  const cloudSyncBusy = useRef(false);
  // 実際の同期処理本体（自動同期のデバウンス後・手動の「今すぐ同期」ボタンの両方から呼ぶ）。
  // silent=trueは自動同期用（同意画面を出さず、失敗しても静かに諦める）。
  // silent=falseは手動トリガー用（初回は同意画面が出てよい）。
  // 戻り値は { skipped: true } （busy中・クライアントID未設定で何もしなかった）か
  // 完了時はundefined。呼び出し側（手動「今すぐ同期」ボタン）はskippedを見て、
  // 「進行中の別の同期と重なって今回は何もしなかった」のを「同期に成功した」と
  // 誤表示しないようにする（バックグラウンドの自動トリガーが増えたことで、手動ボタンを
  // 押した瞬間に別の同期が進行中というケースが実際に起こりうるようになったため）。
  const runCloudSync = useCallback(async (silent) => {
    if (cloudSyncBusy.current) return { skipped: true, reason: 'busy' };
    const clientId = settings.googleDriveClientId;
    if (!clientId) return { skipped: true, reason: 'no-client-id' };
    cloudSyncBusy.current = true;
    try {
      const [gd, pm, meta] = await Promise.all([
        import('./googleDrive.js'),
        import('./progressMerge.js'),
        storage.loadSyncMeta(),
      ]);
      const token = await gd.requestAccessToken(clientId, { silent });
      const remoteText = await gd.downloadBackup(token, gd.SYNC_FILENAME);
      // quizProgress等（一問一答・模試・復習・音声の「続きから」）はReactのstoreに無いため、
      // IndexedDBから直接読む（sessionはstoreにあるのでそのまま使う）。ユーザー指定により、
      // 「別端末で今まさに進行中の活動を裏で上書きしかねない」という理由であえて対象外に
      // していたが、常に最新の状態に同期する方針を優先してここに含めることにした
      // （マージは各自身のタイムスタンプで新しい方を丸ごと採用＝mergeResumeState参照）。
      const resumeState = await storage.loadResumeState();
      const localSnapshot = { srs, history, memos, links, examResults, settings, bookmarks, ...resumeState, session };
      let merged = localSnapshot;
      let pulled = false;
      if (remoteText) {
        const remote = JSON.parse(remoteText);
        merged = pm.mergeProgress(localSnapshot, remote.data || {}, {
          localUpdatedAt: meta.updatedAt || 0,
          remoteUpdatedAt: (remote.meta && remote.meta.updatedAt) || 0,
        });
        // 件数だけの比較だと、既存の問題IDのlastAnswered/dueだけが他端末で更新された
        // ケース（件数は変わらず値だけ変わる、実運用で最も多いパターン）を「変化なし」と
        // 誤判定し、マージ結果をローカルへ反映し損ねてしまう（progressMerge.jsのバグ修正参照）。
        pulled = pm.progressChanged(localSnapshot, merged);
      }
      const newUpdatedAt = Date.now();
      await gd.uploadBackup(token, JSON.stringify({ meta: { updatedAt: newUpdatedAt }, data: merged }), gd.SYNC_FILENAME);
      await storage.saveSyncMeta({ updatedAt: newUpdatedAt });
      if (pulled) {
        setSrs(merged.srs);
        setHistory(merged.history);
        setMemos(merged.memos);
        setLinks(merged.links);
        setExamResultsState(merged.examResults);
        setBookmarks(merged.bookmarks);
        setSessionState(merged.session);
        await Promise.all([
          storage.saveSession(merged.session),
          storage.saveQuizProgress(merged.quizProgress),
          storage.saveExamProgress(merged.examProgress),
          storage.saveReviewProgress(merged.reviewProgress),
          storage.saveAudioProgress(merged.audioProgress),
        ]);
        setCloudAutoSyncToast((n) => n + 1);
      }
      if (JSON.stringify(merged.settings) !== JSON.stringify(localSnapshot.settings)) {
        setSettings(merged.settings);
      }
      setCloudSyncStatus({ ok: true, at: newUpdatedAt, pulled });
    } catch (e) {
      const gd = await import('./googleDrive.js').catch(() => null);
      const needsRelogin = gd && gd.isSilentAuthError(e);
      setCloudSyncStatus({ ok: false, at: Date.now(), error: e && e.message, needsRelogin });
      throw e;
    } finally {
      cloudSyncBusy.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, srs, history, memos, links, examResults, bookmarks, session]);

  // 「常に最新の状態」の各種自動トリガーが共有する間引き用の最終実行時刻。
  // 起動時同期もここに登録することで、起動直後にfocus/visibilitychangeが偶発的に
  // 発火しても（一部ブラウザは初回表示時にfocusイベントを出すことがある）、
  // 直後に無駄なもう1回の同期が連続しないようにする。
  const lastBgSyncRef = useRef(0);
  const didInitialSyncRef = useRef(false);

  // データ変更をきっかけにした同期（連打での通信を避けるため、変更が落ち着くのを待ってから）。
  // loaded直後の"初回"はここでは動かさない（下の起動時同期が別途・待たずに担当する）。
  useEffect(() => {
    if (!loaded) return undefined;
    if (!settings.googleDriveAutoSync || !settings.googleDriveClientId) return undefined;
    if (!didInitialSyncRef.current) return undefined; // 初回は起動時同期に任せる（二重発火防止）
    const timer = setTimeout(() => { runCloudSync(true).catch(() => {}); }, 5000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, settings.googleDriveAutoSync, settings.googleDriveClientId, srs, history, memos, links, examResults, bookmarks, session]);

  // ①起動時（URLを開いた・ホーム画面から起動した直後）は、上のデバウンスを待たず
  // ほぼ即座に同期を試みる（「開いたらすぐ最新化する」という体感を優先）。
  // ⑥失敗した場合（起動直後は回線がまだ安定していないことがある）は15秒後に1回だけ
  // 自動で再試行する（無限リトライはしない＝失敗が続く環境で通信を送り続けない）。
  useEffect(() => {
    if (!loaded) return undefined;
    if (!settings.googleDriveAutoSync || !settings.googleDriveClientId) return undefined;
    if (didInitialSyncRef.current) return undefined;
    didInitialSyncRef.current = true;
    let alive = true;
    let retryTimer = null;
    const timer = setTimeout(() => {
      lastBgSyncRef.current = Date.now();
      runCloudSync(true).catch(() => {
        if (!alive) return;
        retryTimer = setTimeout(() => {
          if (!alive) return;
          lastBgSyncRef.current = Date.now();
          runCloudSync(true).catch(() => {});
        }, 15000);
      });
    }, 300);
    return () => { alive = false; clearTimeout(timer); if (retryTimer) clearTimeout(retryTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, settings.googleDriveAutoSync, settings.googleDriveClientId]);

  // 「🔄 今すぐ同期」ボタン用（CloudBackup.jsx）。自動同期のデバウンス（最大5秒）を
  // 待たずに、設定を変えた直後や動作確認をしたい時にその場で同期できる。
  const syncCloudNow = useCallback(() => runCloudSync(false), [runCloudSync]);

  // runCloudSyncは解答するたび等、頻繁に変わるsrs/history等に依存しているため参照が
  // 毎回変わる。下のイベントリスナー登録・setIntervalの依存にrunCloudSyncを直接使うと、
  // 学習中（＝データが変わるたび）にリスナーの解除→再登録とsetIntervalの再作成が
  // 繰り返されてしまい、④の5分間隔が実質リセットされ続けて発火しない・不要なchurnが
  // 起きるバグがあった。常に最新のrunCloudSyncを参照しつつ、リスナー登録自体は
  // データの変化と無関係に安定させるため、refに逃がす。
  const runCloudSyncRef = useRef(runCloudSync);
  useEffect(() => { runCloudSyncRef.current = runCloudSync; }, [runCloudSync]);

  // 「常に最新の状態」に近づけるため、ローカルの変更を待つだけでなく、他端末での更新も
  // 積極的に拾いに行く。②タブに戻ってきた時（他の端末で進めてから、この端末に戻ってきた
  // 場面が典型）③オフラインから復帰した時④開いたままの端末でも取りこぼさないよう
  // 一定間隔（5分）で、それぞれ自動で1回同期する。短時間に何度も発火しても連打に
  // ならないよう、共通の間引き（1分）を通す。
  const triggerBackgroundSync = useCallback(() => {
    if (!settings.googleDriveAutoSync || !settings.googleDriveClientId) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    const BG_SYNC_MIN_INTERVAL_MS = 60_000;
    const now = Date.now();
    if (now - lastBgSyncRef.current < BG_SYNC_MIN_INTERVAL_MS) return;
    lastBgSyncRef.current = now;
    runCloudSyncRef.current(true).catch(() => {});
  }, [settings.googleDriveAutoSync, settings.googleDriveClientId]);

  useEffect(() => {
    if (!loaded) return undefined;
    if (typeof document === 'undefined' || typeof window === 'undefined') return undefined;
    document.addEventListener('visibilitychange', triggerBackgroundSync);
    window.addEventListener('focus', triggerBackgroundSync);
    window.addEventListener('online', triggerBackgroundSync);
    const interval = setInterval(triggerBackgroundSync, 5 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', triggerBackgroundSync);
      window.removeEventListener('focus', triggerBackgroundSync);
      window.removeEventListener('online', triggerBackgroundSync);
      clearInterval(interval);
    };
  }, [loaded, triggerBackgroundSync]);

  // ⑤バックグラウンドへ退避する直前（他アプリに切り替える・タブを閉じる等）にも、
  // ローカルの最新の変更を一度プッシュしておく。次に開いた別端末が、待たされずに
  // この端末の最新状態を受け取れるようにするため（間引きは共通のcloudSyncBusyのみ＝
  // 退避の合図は取りこぼしたくないので上の1分間引きは適用しない）。
  // ここも同じ理由でrunCloudSyncRef経由にし、データが変わるたびのリスナー再登録を避ける。
  useEffect(() => {
    if (!loaded) return undefined;
    if (typeof document === 'undefined') return undefined;
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return;
      if (!settings.googleDriveAutoSync || !settings.googleDriveClientId) return;
      runCloudSyncRef.current(true).catch(() => {});
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, settings.googleDriveAutoSync, settings.googleDriveClientId]);

  const clearCloudAutoSyncToast = useCallback(() => setCloudAutoSyncToast(0), []);

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
  const recordAnswer = useCallback((question, correct, grade, source, selfKind) => {
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
      // selfKind: 自己採点の種類（'maru'|'sankaku'|'batsu'）。○△✕を区別する自己採点UIからのみ付与
      { questionId: question.id, subject: question.subject, correct, at: now, ...(source ? { source } : {}), ...(selfKind ? { selfKind } : {}) },
    ]);
    // バックアップ促し用のカウンタ
    setSettings((prev) => ({
      ...prev,
      answersSinceBackup: (prev.answersSinceBackup || 0) + 1,
    }));
  }, []);

  // 復習リストから手動で外す（○5回連続＝マスターと同じ状態にする。誤登録・簡単すぎる問題対策）
  const removeFromReview = useCallback((questionId) => {
    setSrs((prev) => ({
      ...prev,
      [questionId]: { ...normalize(prev[questionId]), correctStreak: MASTER_STREAK, lastAnswered: Date.now() },
    }));
  }, []);

  // この問題だけ次回期限を指定ミリ秒だけ先送りする（スヌーズ・誤答理由別の間隔調整で共用）
  const setNextDue = useCallback((questionId, delayMs) => {
    setSrs((prev) => ({
      ...prev,
      [questionId]: { ...normalize(prev[questionId]), due: Date.now() + delayMs },
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
    cloudAutoSyncToast,
    clearCloudAutoSyncToast,
    cloudSyncStatus,
    syncCloudNow,
    settings,
    reviewQuestions,
    dueReviewQuestions,
    recordAnswer,
    removeFromReview,
    setNextDue,
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
