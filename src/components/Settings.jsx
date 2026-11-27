import { useEffect, useRef, useState } from 'react';
import { importFile, exportCsv, exportJson, dedupeAgainst } from '../lib/importer.js';
import { canNativeSaveFile } from '../lib/nativeBridge.js';
import { flushNow } from '../lib/storage.js';
import { loadVoices, speak, cancelSpeech, isSpeechSupported, nativeTts } from '../lib/speech.js';
import {
  validateEmail,
  validatePassword,
  passwordProblems,
  makeAuthRecord,
  verifyPassword,
} from '../lib/auth.js';
import SyncQR from './SyncQR.jsx';
import SyncScan from './SyncScan.jsx';
import CloudBackup from './CloudBackup.jsx';
import VoiceClone from './VoiceClone.jsx';
import P2PTransfer from './P2PTransfer.jsx';
import FileBackupCard from './FileBackupCard.jsx';
import ErrorLogCard from './ErrorLogCard.jsx';
import MissTypeHistoryCard from './MissTypeHistoryCard.jsx';
import Diagnostics from './Diagnostics.jsx';
import { requestPersistent } from '../lib/storageHealth.js';
import SnapshotsCard from './SnapshotsCard.jsx';
import { daysUntil, formatExamDate } from '../lib/gamify.js';
import { DEFAULT_BASE_RATIO } from '../lib/bufferSession.js';
import { downloadFile } from '../lib/download.js';
import { exportHistoryCsv } from '../lib/historyExport.js';
import { reviewZeroLogToCsv } from '../lib/reviewZeroLog.js';
import { loadMissTypes } from '../lib/missTypes.js';
import { loadSelfKindCounts } from '../lib/starWeak.js';
import { PomodoroConfigFields } from './PomodoroConfigFields.jsx';

// 設定・問題データ管理画面
export default function Settings({ store, onToast, onOpenOcr, importText, onConsumeImportText, onNavigate }) {
  const {
    questions,
    history,
    settings,
    updateSettings,
    replaceQuestions,
    appendQuestions,
    resetProgress,
    restoreSamples,
    markBackedUp,
    importBackup,
    summarizeOldHistory,
    voiceCloneApiKey,
    saveVoiceCloneApiKey,
    reviewZeroLog,
  } = store;

  const HISTORY_SUMMARY_CUTOFF_DAYS = 90;
  const doSummarizeOldHistory = () => {
    if (
      !confirm(
        `解答履歴のうち直近${HISTORY_SUMMARY_CUTOFF_DAYS}日より前の分を、「日付・科目・正誤ごとの件数」にまとめて軽量化します。` +
          '要約後は、古い方の履歴について1問ごとの詳細（どの問題を間違えたか等）には戻せません。よろしいですか？'
      )
    ) return;
    const { before, after } = summarizeOldHistory();
    onToast?.(
      before === after
        ? '要約できる古い履歴はありませんでした（直近90日以内のみ）'
        : `解答履歴を${before}件→${after}件に軽量化しました`
    );
  };

  // 書き出しの結果を必ず知らせる（アプリ版ではどこに保存されたかも）
  const saveFile = async (content, filename, mime) => {
    const r = await downloadFile(content, filename, mime);
    if (!r.ok) onToast(`保存できませんでした（${r.error}）`);
    else onToast(r.native ? `「${r.location}」に ${filename} を保存しました` : `${filename} を保存しました`);
  };
  const reloadSoon = async () => {
    await flushNow();
    setTimeout(() => { try { window.location.reload(); } catch (e) { /* noop */ } }, 1200);
  };

  const fileRef = useRef(null);
  const [importMode, setImportMode] = useState('append'); // append | replace
  const [preview, setPreview] = useState(null); // { questions, errors, warnings, fileName }
  const [voices, setVoices] = useState([]);
  // 声の一覧は少し遅れて届く。届く前に「日本語の音声が見つかりませんでした」と出していた
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [deckName, setDeckName] = useState(''); // 取り込み先ファイル（デッキ）名
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  useEffect(() => {
    loadVoices().then((vs) => {
      setVoices(vs.filter((v) => v.lang && v.lang.startsWith('ja')));
      setVoicesLoaded(true);
    });
  }, []);

  // 取り込みハブ/OCR から渡されたテキストをプレビューに流し込む（形式は内容から自動判定）
  useEffect(() => {
    if (importText) {
      const result = importFile(importText, '');
      setPreview({ ...result, fileName: '取り込みデータ' });
      setImportMode('append');
      onConsumeImportText?.();
    }
  }, [importText]); // eslint-disable-line react-hooks/exhaustive-deps

  // アプリ全体のバックアップ（学習記録つき）を、ここ（問題の取り込み）で選んでしまった時。
  // そのまま取り込むと、問題が二重に入るだけで学習記録は戻らない。
  const looksLikeBackup = (text) => {
    try {
      const d = JSON.parse(String(text).replace(/^\uFEFF/, ''));
      return !!d && !Array.isArray(d) && typeof d === 'object' && ('srs' in d || 'history' in d || 'settings' in d);
    } catch (e) {
      return false;
    }
  };
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let text;
    try {
      text = await file.text();
    } catch (err) {
      onToast('ファイルを読み込めませんでした');
      return;
    }
    if (looksLikeBackup(text)) {
      setPreview(null);
      onToast('これは学習データのバックアップです。上の「バックアップと復元」の「復元（読み込み）」から読み込んでください');
      return;
    }
    const result = importFile(text, file.name);
    setPreview({ ...result, fileName: file.name });
  };

  const confirmImport = () => {
    if (!preview || preview.questions.length === 0) return;
    // 取り込み先ファイル名が指定されていれば全問に付与（未指定の既存デッキは尊重）
    const qs = deckName.trim()
      ? preview.questions.map((q) => ({ ...q, deck: q.deck || deckName.trim() }))
      : preview.questions;
    if (importMode === 'replace') {
      // ファイルの中で同じ問題文・同じidが重なっていても二重にしない（追加の時と同じ扱い）
      const { unique } = dedupeAgainst(qs, []);
      const seenIds = new Set();
      const list = unique.map((q, i) => {
        if (q.id && !seenIds.has(q.id)) { seenIds.add(q.id); return q; }
        let id = `imp-${Date.now().toString(36)}-${i}`;
        while (seenIds.has(id)) id += 'x';
        seenIds.add(id);
        return { ...q, id };
      });
      if (!confirm(`今ある${questions.length}問をすべて消して、この${list.length}問に置き換えます。よろしいですか？`)) return;
      replaceQuestions(list);
      onToast(list.length < qs.length
        ? `${list.length}問に置き換えました（ファイルの中で重なっていた${qs.length - list.length}問は1つにまとめました）`
        : `${list.length}問に置き換えました`);
    } else {
      // 同じ問題文は入れない（同じファイルを2回取り込むと全部二重になっていた）。
      // 問題文は違うのにidがぶつかるものは、学習記録が混ざらないようidを付け直す。
      const { unique, duplicates } = dedupeAgainst(qs, questions);
      const usedIds = new Set(questions.map((q) => q.id));
      const fresh = unique.map((q, i) => {
        if (q.id && !usedIds.has(q.id)) { usedIds.add(q.id); return q; }
        let id = `imp-${Date.now().toString(36)}-${i}`;
        while (usedIds.has(id)) id += 'x';
        usedIds.add(id);
        return { ...q, id };
      });
      if (fresh.length === 0) {
        onToast(`${duplicates.length}問すべてが取り込み済みでした（追加はありません）`);
        setPreview(null);
        return;
      }
      appendQuestions(fresh);
      onToast(duplicates.length
        ? `${fresh.length}問を追加しました（取り込み済みの${duplicates.length}問は飛ばしました）`
        : `${fresh.length}問を追加しました`);
    }
    setPreview(null);
    setPasteText('');
  };

  const importPaste = () => {
    if (!pasteText.trim()) return;
    if (looksLikeBackup(pasteText)) {
      onToast('これは学習データのバックアップです。「バックアップと復元」の「復元（読み込み）」から読み込んでください');
      return;
    }
    // 形式は中身から判定する（以前は「[」始まりだけをJSON扱いにしていて、{…} のJSONがCSVとして読まれていた）
    const result = importFile(pasteText, '');
    setPreview({ ...result, fileName: '貼り付けデータ' });
    setPasteOpen(false);
  };

  const sampleCsv = `科目,問題文,選択肢,正解,解説
経絡経穴概論,合谷穴が属する経絡はどれか。,手の陽明大腸経|手の太陰肺経|手の少陰心経|手の厥陰心包経,1,合谷は手の陽明大腸経の原穴。
東洋医学概論,督脈は身体前正中線を上行する。,,×,督脈は後正中線を上行する。前正中線は任脈。`;

  return (
    <div className="view">
      <h2 className="view-title">設定・問題データ管理</h2>

      {/* ===== ログイン（端末内ロック） ===== */}
      <div className="section-label" style={{ marginTop: 0 }}>ログイン設定</div>
      <LoginSettings store={store} onToast={onToast} />

      {/* ===== 試験日・学習リマインド ===== */}
      <div className="section-label">試験日・学習リマインド</div>
      <div className="card">
        <div className="field">
          <label htmlFor="settings-exam-date">試験日</label>
          <input
            id="settings-exam-date"
            type="date"
            value={settings.examDate || ''}
            onChange={(e) => updateSettings({ examDate: e.target.value })}
          />
          {settings.examDate && (
            // アプリ版の日付の欄には「消す」が無い端末があるので、消すボタンを置く
            <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => updateSettings({ examDate: '' })}>
              ✕ 試験日を消す
            </button>
          )}
          {settings.examDate && daysUntil(settings.examDate) != null && (
            <div className="hint">
              {daysUntil(settings.examDate) >= 0
                ? `試験日まで残り ${daysUntil(settings.examDate)} 日（${formatExamDate(settings.examDate)}）`
                : `試験日（${formatExamDate(settings.examDate)}）は過ぎています`}
            </div>
          )}
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>今日の目標（問題数）</label>
          <div className="chip-row" style={{ marginBottom: 0 }}>
            {[60, 100, 200, 300, 500].map((g) => (
              <button
                key={g}
                className={`chip ${(settings.dailyGoal ?? 300) === g ? 'active' : ''}`}
                onClick={() => updateSettings({ dailyGoal: g })}
              >
                {g}問
              </button>
            ))}
          </div>
          <div className="hint">ハリオ先生の「今日の進捗」表示（ホーム画面）で使う1日のノルマです。</div>
        </div>
        <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
          <label htmlFor="settings-buffer-ratio">基礎タスクの比率（3分の2バッファ術）</label>
          <div className="range-row">
            <input
              id="settings-buffer-ratio"
              type="range"
              min="40"
              max="80"
              step="5"
              value={Math.round((settings.bufferBaseRatioPct ?? Math.round(DEFAULT_BASE_RATIO * 100)))}
              onChange={(e) => updateSettings({ bufferBaseRatioPct: Number(e.target.value) })}
            />
            <span className="range-val">
              基礎{Math.round(settings.bufferBaseRatioPct ?? Math.round(DEFAULT_BASE_RATIO * 100))}% / バッファ{100 - Math.round(settings.bufferBaseRatioPct ?? Math.round(DEFAULT_BASE_RATIO * 100))}%
            </span>
          </div>
          <div className="hint">
            学習（10・60・300・900）の「時間で計画する」で使う配分です。既定は2:1（基礎67%）。
            「今日の調子」がしんどい日はこの比率を少しゆるめに、元気な日は少しきつめに自動調整します
            （±5%の範囲）。勤務シフト連携は未対応のため、この比率が基準になります。
          </div>
        </div>
        <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
          <label htmlFor="settings-srs-pace">復習の間隔ペース</label>
          <div className="range-row">
            <input
              id="settings-srs-pace"
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.srsPaceMultiplier ?? 1}
              onChange={(e) => updateSettings({ srsPaceMultiplier: Number(e.target.value) })}
            />
            <span className="range-val">
              ×{(settings.srsPaceMultiplier ?? 1).toFixed(1)}{Math.abs((settings.srsPaceMultiplier ?? 1) - 1) < 0.01 ? '（標準）' : ''}
            </span>
          </div>
          <div className="hint">
            ○（完璧）が続いた時の次回間隔に掛ける倍率です。大きくするほど間隔が伸びてゆっくり回り、
            小さくするほど短い間隔で頻繁に復習します。誤答・△・✕の後の約20分後リセットは変わりません。
          </div>
        </div>
        <label className="switch-row" style={{ marginTop: 6 }}>
          <input
            type="checkbox"
            checked={!!(settings.reminder && settings.reminder.enabled)}
            onChange={(e) => {
              const on = e.target.checked;
              updateSettings({ reminder: { time: '07:00', ...(settings.reminder || {}), enabled: on } });
              if (!on) return;
              // 端末の通知が出せない時は黙らない（アプリ内のお知らせと読み上げは出る）
              if (typeof Notification === 'undefined') {
                onToast('この端末・アプリでは端末の通知が使えません。時刻を過ぎて開いた時に、画面のお知らせと声で伝えます');
              } else if (Notification.permission === 'denied') {
                onToast('通知が「ブロック」になっています。端末の設定で許可すると通知も出ます（画面のお知らせは出ます）');
              } else if (Notification.permission === 'default') {
                Notification.requestPermission().then((r) => {
                  if (r !== 'granted') onToast('通知は許可されませんでした。画面のお知らせと声で伝えます');
                }).catch(() => {});
              }
            }}
          />
          <span>
            毎日のリマインド通知
            <small>指定した時刻以降にアプリを開くと「学習しよう」の通知でお知らせします。</small>
          </span>
        </label>
        {settings.reminder && settings.reminder.enabled && (
          <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
            <label>通知する時刻（朝など）</label>
            <input
              type="time"
              value={(settings.reminder && settings.reminder.time) || '07:00'}
              onChange={(e) =>
                updateSettings({ reminder: { ...(settings.reminder || {}), time: e.target.value } })
              }
            />
            <div className="hint">
              ※ Webアプリのため、アプリ（タブ）を開いた時に通知します。完全な常時バックグラウンド通知はOSの仕様上できません。
            </div>
          </div>
        )}
        {/* 盲目の受験生からの改善提案#19：夜勤・交代勤務向けの勤務明けリマインド。
            本人が設定した勤務終了時刻だけを使う（勤務形態の自動判定はしない）。 */}
        <label className="switch-row" style={{ marginTop: 10 }}>
          <input
            type="checkbox"
            checked={!!(settings.shiftReminder && settings.shiftReminder.enabled)}
            onChange={(e) => updateSettings({
              // 画面に出している08:00も一緒に残す（以前は時刻を一度触らないと保存されず、一度も知らせなかった）
              shiftReminder: { afterTime: '08:00', ...(settings.shiftReminder || {}), enabled: e.target.checked },
            })}
          />
          <span>
            夜勤・交代勤務の勤務明けリマインド
            <small>勤務終了時刻から90分以内にアプリを開いていると、その回に1度だけ「勤務明け復習」をお知らせします（毎日のリマインドがオフでも出ます。日付をまたぐ時刻も使えます）。</small>
          </span>
        </label>
        {settings.shiftReminder && settings.shiftReminder.enabled && (
          <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
            <label>勤務終了時刻</label>
            <input
              type="time"
              value={(settings.shiftReminder && settings.shiftReminder.afterTime) || '08:00'}
              onChange={(e) => updateSettings({ shiftReminder: { ...(settings.shiftReminder || {}), afterTime: e.target.value } })}
            />
          </div>
        )}
      </div>

      {/* ===== アクセシビリティ ===== */}
      <div className="section-label">アクセシビリティ</div>
      <div className="card">
        <label className="section-label" style={{ marginTop: 0 }}>文字の大きさ</label>
        <div className="chip-row">
          {[
            { v: 1, label: '標準' },
            { v: 1.15, label: '大きめ' },
            { v: 1.3, label: '特大' },
          ].map((opt) => (
            <button
              key={opt.v}
              className={`chip ${(settings.a11y?.fontScale ?? 1) === opt.v ? 'active' : ''}`}
              onClick={() => updateSettings({ a11y: { ...(settings.a11y || {}), fontScale: opt.v } })}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="hint" style={{ marginBottom: 10 }}>
          画面全体を拡大表示します（ブラウザ・端末によっては効果が無い場合があります）。
        </div>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={!!settings.a11y?.reduceMotion}
            onChange={(e) => updateSettings({ a11y: { ...(settings.a11y || {}), reduceMotion: e.target.checked } })}
          />
          <span>
            アニメーションを減らす
            <small>画面切り替え・演出のアニメーションを最小限にします。</small>
          </span>
        </label>
        <label className="switch-row" style={{ marginTop: 6 }}>
          <input
            type="checkbox"
            checked={!!settings.a11y?.highContrast}
            onChange={(e) => updateSettings({ a11y: { ...(settings.a11y || {}), highContrast: e.target.checked } })}
          />
          <span>
            コントラストを上げる
            <small>薄いグレーの文字・枠線を白に近づけて見やすくします。</small>
          </span>
        </label>
      </div>

      {/* ===== QRで別端末へ受け渡し ===== */}
      <div className="section-label">QRで別端末へ受け渡し</div>
      <SyncQR store={store} onToast={onToast} />
      <SyncScan onToast={onToast} />
      <P2PTransfer store={store} onToast={onToast} />

      {/* ===== ポモドーロタイマー ===== */}
      <div className="section-label">ポモドーロタイマー（画面上部）</div>
      <div className="card">
        <label className="switch-row">
          <input
            type="checkbox"
            checked={!!(settings.pomodoro && settings.pomodoro.enabled)}
            onChange={(e) => {
              updateSettings({ pomodoro: { ...(settings.pomodoro || {}), enabled: e.target.checked, updatedAt: Date.now() } });
              // 消えにくいストレージへの格上げは、ユーザー操作を起点に依頼すると通りやすい。
              // ONにする操作自体がその起点として自然なので、ここで一度だけ依頼する。
              if (e.target.checked) requestPersistent().catch(() => {});
            }}
          />
          <span>
            画面上部にポモドーロタイマーを表示
            <small>オフの間もここで分数などを調整できます（表示中はバーの ⚙ からも同じ設定に入れます）。</small>
          </span>
        </label>
        <div style={{ marginTop: 10 }}>
          <PomodoroConfigFields
            cfg={settings.pomodoro || {}}
            setCfg={(patch) => updateSettings({ pomodoro: { ...(settings.pomodoro || {}), ...patch, updatedAt: Date.now() } })}
            onToast={onToast}
          />
        </div>
      </div>

      {/* ===== バックアップと復元（端末間の持ち運び） ===== */}
      <div className="section-label">
        バックアップと復元
      </div>
      {onNavigate && (
        <button className="btn ghost sm" style={{ marginBottom: 8 }} onClick={() => onNavigate('migrationguide')}>
          🧭 データ量に応じたおすすめの移行方法を見る（機種変更ガイド）
        </button>
      )}
      <FileBackupCard
        settings={settings}
        updateSettings={updateSettings}
        markBackedUp={markBackedUp}
        importBackup={importBackup}
        onToast={onToast}
      />

      {/* ===== クラウド連携（Googleドライブ・任意／プライバシー方針の例外） ===== */}
      <div className="section-label">クラウドバックアップ（Googleドライブ・任意）</div>
      <CloudBackup
        settings={settings}
        updateSettings={updateSettings}
        onToast={onToast}
        importBackup={importBackup}
        cloudSyncStatus={store.cloudSyncStatus}
        syncCloudNow={store.syncCloudNow}
        cloudAuthPaused={store.cloudAuthPaused}
        clearCloudAuthPause={store.clearCloudAuthPause}
      />

      {/* ===== ボイスクローン（BYOK・任意／プライバシー方針の例外） ===== */}
      <div className="section-label">🎤 音声学習の声（ボイスクローン・任意）</div>
      <VoiceClone
        settings={settings}
        updateSettings={updateSettings}
        apiKey={voiceCloneApiKey}
        onSaveApiKey={saveVoiceCloneApiKey}
        onToast={onToast}
      />

      {/* ===== 問題データのインポート ===== */}
      <div className="section-label">問題データのインポート</div>
      <div className="card">
        <p className="inline-note" style={{ marginBottom: 12 }}>
          CSV または JSON 形式の問題を取り込めます。項目は
          <span className="mono">科目 / 問題文 / 選択肢 / 正解 / 解説</span>（任意で
          <span className="mono">画像</span>）。
        </p>

        <div className="chip-row">
          <button
            className={`chip ${importMode === 'append' ? 'active' : ''}`}
            onClick={() => setImportMode('append')}
          >
            既存に追加
          </button>
          <button
            className={`chip ${importMode === 'replace' ? 'active' : ''}`}
            onClick={() => setImportMode('replace')}
          >
            全て置き換え
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept={canNativeSaveFile() ? undefined : '.csv,.json,.txt,text/csv,application/json,text/plain'}
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        <div className="field" style={{ marginTop: 10, marginBottom: 8 }}>
          <label>取り込み先ファイル名（任意）</label>
          <input
            type="text"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            placeholder="例）2027過去問・医療概論 など"
          />
          <div className="hint">名前を付けると、その名前のファイルにまとめて出題ビルダーで絞り込めます。</div>
        </div>

        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => fileRef.current?.click()}>
            📁 ファイル
          </button>
          <button className="btn" onClick={() => setPasteOpen((v) => !v)}>
            📝 文章を貼付
          </button>
          <button className="btn" onClick={onOpenOcr}>
            📷 写真OCR
          </button>
        </div>

        {pasteOpen && (
          <div style={{ marginTop: 10 }}>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'CSV や JSON を貼り付け\n例）科目,問題文,選択肢,正解,解説'}
              style={{ minHeight: 120 }}
            />
            <button className="btn primary block sm" style={{ marginTop: 8 }} onClick={importPaste}>
              貼り付けた内容を読み込む
            </button>
          </div>
        )}

        {preview && (
          <div style={{ marginTop: 14 }}>
            {preview.questions.length === 0 && (
              <button className="btn ghost sm" style={{ marginBottom: 8 }} onClick={() => setPreview(null)}>
                ✕ この結果を閉じる
              </button>
            )}
            <div className="explanation">
              <span className="label">読み込み結果：{preview.fileName}</span>
              取り込み可能：<strong>{preview.questions.length}問</strong>
              {preview.errors.length > 0 && (
                <div style={{ color: 'var(--wrong)', marginTop: 6, fontSize: 13 }}>
                  取り込めなかった行：{preview.errors.length}件
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {preview.errors.slice(0, 5).map((er, i) => (
                      <li key={i}>{er}</li>
                    ))}
                    {preview.errors.length > 5 && <li>ほか{preview.errors.length - 5}件…</li>}
                  </ul>
                </div>
              )}
              {preview.warnings && preview.warnings.length > 0 && (
                <div style={{ color: 'var(--warn)', marginTop: 8, fontSize: 13 }}>
                  ⚠️ 確認事項：{preview.warnings.length}件
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {preview.warnings.slice(0, 6).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                    {preview.warnings.length > 6 && (
                      <li>ほか{preview.warnings.length - 6}件…</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
            {preview.questions.length > 0 && (
              <div className="btn-row" style={{ marginTop: 10 }}>
                <button className="btn" onClick={() => setPreview(null)}>
                  やめる
                </button>
                <button className="btn accent" onClick={confirmImport}>
                  {importMode === 'replace' ? 'この内容で置き換える' : 'この内容を追加する'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== フォーマット説明 ===== */}
      <details className="card" style={{ padding: '14px 18px' }}>
        <summary style={{ fontWeight: 700, cursor: 'pointer', color: 'var(--navy)' }}>
          CSV / JSON フォーマットの書き方
        </summary>
        <div style={{ marginTop: 10 }}>
          <p className="inline-note">
            <strong>選択肢</strong>は半角パイプ <span className="mono">|</span> で区切ります。
            空欄にすると ○×（正誤）問題になります。<br />
            <strong>正解</strong>は 選択肢の番号（国試は1〜5）、○×なら
            <span className="mono">○</span> / <span className="mono">×</span> で指定します。<br />
            <strong>画像</strong>列（任意）に画像URLやデータURIを入れると、経穴図などの
            図表問題に対応できます。
          </p>
          <div className="inline-note" style={{ marginTop: 6 }}>CSV 例：</div>
          <code className="block">{sampleCsv}</code>
        </div>
      </details>

      {/* ===== 問題データのエクスポート ===== */}
      <div className="section-label">問題データの書き出し</div>
      <div className="card">
        <p className="inline-note" style={{ marginBottom: 10 }}>
          現在の{questions.length}問を CSV / JSON で書き出せます（問題データのみ）。
        </p>
        <div className="btn-row">
          <button
            className="btn"
            onClick={() => saveFile(exportCsv(questions), 'shinkyu_questions.csv', 'text/csv')}
          >
            CSVで保存
          </button>
          <button
            className="btn"
            onClick={() =>
              saveFile(exportJson(questions), 'shinkyu_questions.json', 'application/json')
            }
          >
            JSONで保存
          </button>
        </div>
      </div>

      {/* ===== 学習ログのエクスポート（②） ===== */}
      <div className="section-label">学習ログの書き出し</div>
      <div className="card">
        <p className="inline-note" style={{ marginBottom: 10 }}>
          自分の解答履歴（{history.length}件）をCSVで書き出せます。表計算ソフトでの独自分析に。
        </p>
        <button
          className="btn"
          onClick={async () => {
            const [missTypes, selfKindCounts] = await Promise.all([loadMissTypes(), loadSelfKindCounts()]);
            saveFile(exportHistoryCsv(history, questions, { missTypes, selfKindCounts }), 'shinkyu_history.csv', 'text/csv');
          }}
          disabled={history.length === 0}
        >
          解答履歴をCSVで保存
        </button>
        {history.length === 0 && <div className="hint">まだ解答の記録がありません。</div>}
        {/* #29：復習を毎日ゼロに戻せた日のログをCSVで書き出す */}
        <button
          className="btn"
          style={{ marginTop: 8 }}
          onClick={() => saveFile(reviewZeroLogToCsv(reviewZeroLog), 'shinkyu_review_zero_log.csv', 'text/csv')}
          disabled={Object.keys(reviewZeroLog || {}).length === 0}
        >
          復習ゼロ達成ログをCSVで保存
        </button>
      </div>

      <div className="section-label">解答履歴の軽量化（任意）</div>
      <div className="card">
        <p className="inline-note" style={{ marginBottom: 10 }}>
          解答履歴（現在{history.length}件）は追記され続けるため、端末のストレージが気になる場合は、
          直近{HISTORY_SUMMARY_CUTOFF_DAYS}日より前の分を「日付・科目・正誤ごとの件数」に要約して
          軽量化できます。直近{HISTORY_SUMMARY_CUTOFF_DAYS}日分と、要約後の件数はそのまま残ります。
          <br />※ 要約すると、古い方の履歴は1問ごとの詳細（どの問題だったか）が失われます。
          先に上のCSV書き出しで控えを残すことをおすすめします。
        </p>
        <button className="btn" onClick={doSummarizeOldHistory}>🗜️ 古い履歴を要約して軽量化する</button>
      </div>

      {/* ===== 音声設定 ===== */}
      <div className="section-label">音声設定</div>
      <div className="card">
        <div className="field">
          <label htmlFor="settings-speech-rate">読み上げ速度</label>
          <div className="range-row">
            <input
              id="settings-speech-rate"
              type="range"
              min="0.5"
              max="2"
              step="0.05"
              value={Number(settings.speechRate) || 1}
              onChange={(e) => updateSettings({ speechRate: Number(e.target.value) })}
            />
            <span className="range-val">{(Number(settings.speechRate) || 1).toFixed(2)}×</span>
          </div>
        </div>

        <div className="field">
          <label htmlFor="settings-gap-seconds">問題文と正解の「間」</label>
          <div className="range-row">
            <input
              id="settings-gap-seconds"
              type="range"
              min="0"
              max="10"
              step="1"
              value={settings.gapSeconds}
              onChange={(e) => updateSettings({ gapSeconds: Number(e.target.value) })}
            />
            <span className="range-val">{settings.gapSeconds}秒</span>
          </div>
        </div>

        {/* 音声学習の画面にある「次の問題まで待つ時間」をここからも変えられるように（以前はこの画面に無かった） */}
        <div className="field">
          <label htmlFor="settings-next-gap">解答・解説のあと、次の問題までの間</label>
          <div className="range-row">
            <input
              id="settings-next-gap"
              type="range"
              min="0"
              max="15"
              step="1"
              value={settings.nextGapSeconds ?? 1}
              onChange={(e) => updateSettings({ nextGapSeconds: Number(e.target.value) })}
            />
            <span className="range-val">{settings.nextGapSeconds ?? 1}秒</span>
          </div>
        </div>

        {/* 声のプリセットで変わった声の高さを、ここから戻せるように（以前はこの画面に無かった） */}
        <div className="field">
          <label htmlFor="settings-speech-pitch">声の高さ</label>
          <div className="range-row">
            <input
              id="settings-speech-pitch"
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={Number(settings.speechPitch) || 1}
              onChange={(e) => updateSettings({ speechPitch: Number(e.target.value), voicePreset: '' })}
            />
            <span className="range-val">
              {(Number(settings.speechPitch) || 1).toFixed(2)}{Math.abs((Number(settings.speechPitch) || 1) - 1) < 0.01 ? '（標準）' : ''}
            </span>
          </div>
        </div>

        {voices.length > 0 && (
          <div className="field" style={{ marginBottom: 0 }}>
            <label>音声（ボイス）</label>
            <select
              value={settings.voiceURI || ''}
              // 自分で声を選んだら、音声学習の「声のプリセット」の印は外す（別の声なのにプリセットが選ばれたままに見えていた）
              onChange={(e) => updateSettings({ voiceURI: e.target.value, voicePreset: '' })}
            >
              <option value="">既定の日本語音声</option>
              {/* 別の端末で選んだ声がこの端末に無い時（バックアップから戻した等）。黙って別の声に見せない */}
              {settings.voiceURI && !voices.some((v) => v.voiceURI === settings.voiceURI) && (
                <option value={settings.voiceURI}>（この端末に無い声：既定の声で読みます）</option>
              )}
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {isSpeechSupported() && (
          <button
            className="btn ghost sm"
            style={{ marginTop: 10 }}
            onClick={() => {
              cancelSpeech();
              const voice = voices.find((v) => v.voiceURI === settings.voiceURI) || null;
              speak('この速さと声で読み上げます。', {
                rate: Number(settings.speechRate) || 1,
                pitch: Number(settings.speechPitch) || 1,
                voice,
              }).catch(() => {});
            }}
          >
            🔊 この設定で試し聞き
          </button>
        )}
        {voicesLoaded && voices.length === 0 && (
          <p className="inline-note" style={{ marginBottom: 0 }}>
            {nativeTts()
              ? 'アプリ版は端末の読み上げ（ユーザー補助 → テキスト読み上げ）の声で読みます。声はそちらで選んでください。'
              : '日本語の音声が見つかりませんでした。端末の設定で日本語の音声合成データを追加すると、より自然に読み上げられます。'}
          </p>
        )}
      </div>

      {/* ===== データ管理 ===== */}
      <div className="section-label">データ管理</div>
      <div className="card">
        <button
          className="btn block"
          onClick={async () => {
            if (!confirm('問題データを、アプリに入っている問題（全科目）に戻します。自分で取り込んだ問題は消えます。学習の記録は残ります。よろしいですか？')) return;
            await restoreSamples();
            onToast('同梱の問題に戻しています。画面を読み込み直します…');
            reloadSoon();
          }}
        >
          問題データを同梱の問題に戻す
        </button>
        <button
          className="btn danger block"
          style={{ marginTop: 10 }}
          onClick={async () => {
            if (!confirm(
              '学習の進捗をすべて消去します（解答の記録・復習の予定・経穴カードの復習の予定・誤答理由・先送り・続きからの位置・音声学習の記録）。\n' +
              '問題データ・メモ・ブックマーク・語呂合わせ・模試の結果・設定は残ります。\n' +
              '消したものは戻せません。先に「バックアップを保存」をおすすめします。よろしいですか？'
            )) return;
            await resetProgress();
            onToast('学習の進捗をリセットしました。画面を読み込み直します…');
            reloadSoon();
          }}
        >
          学習の進捗をリセット
        </button>
        <p className="inline-note" style={{ marginTop: 10 }}>
          データはこの端末の中（IndexedDB）に保存されます。外へ送るのは、自分で使った時の「Googleドライブ連携」「ボイスクローン」・天気（地域の位置）・YouTubeの曲・音声認識（声の操作・声で解答）だけで、その機能に必要なものに限ります。
        </p>
      </div>

      <SnapshotsCard onToast={onToast} />
      <Diagnostics store={store} onToast={onToast} />
      <ErrorLogCard onToast={onToast} />
      <MissTypeHistoryCard onToast={onToast} />
    </div>
  );
}

// ログイン設定（新規設定・変更・解除）。端末内のみ。
function LoginSettings({ store, onToast }) {
  const { auth, setAuth, clearAuth } = store;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const [email, setEmail] = useState(auth?.email || '');
  const [curPw, setCurPw] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [question, setQuestion] = useState(auth?.question || '');
  const [answer, setAnswer] = useState('');

  const has = !!auth;

  const save = async () => {
    setMsg('');
    if (!validateEmail(email)) return setMsg('メールアドレスの形式が正しくありません。');
    // 変更時は現在のパスワード確認（パスワードを変える／解除しない場合も本人確認）
    if (has) {
      const ok = await verifyPassword(auth, curPw);
      if (!ok) return setMsg('現在のパスワードが違います。');
    }
    // パスワード：新規は必須。変更時は空なら据え置き。
    let newPw = pw;
    if (!has || pw || pw2) {
      if (!validatePassword(pw)) return setMsg('パスワードは' + passwordProblems(pw).join('、') + '。');
      if (pw !== pw2) return setMsg('確認用パスワードが一致しません。');
    } else {
      newPw = null; // 据え置き
    }
    const q = question.trim();
    if (!q) return setMsg('秘密の質問を入力してください。');
    if (!has && !answer.trim()) return setMsg('秘密の質問の答えを入力してください。');
    // 質問だけ変えて答えを空欄のままにすると、新しい質問に古い答えが残り、忘れた時に入れなくなる
    if (has && q !== (auth.question || '').trim() && !answer.trim()) {
      return setMsg('秘密の質問を変える時は、新しい答えも入力してください。');
    }
    // 答え：新規は必須、変更時は空なら据え置き
    setBusy(true);
    try {
    if (!has) {
      const rec = await makeAuthRecord({ email, password: newPw, question: q, answer });
      setAuth(rec);
    } else {
      // 既存を土台に更新
      let rec = { ...auth, email: email.trim(), question: q, updatedAt: Date.now() };
      if (newPw) {
        const full = await makeAuthRecord({ email, password: newPw, question: q, answer: answer || 'x' });
        rec.salt = full.salt;
        rec.passHash = full.passHash;
      }
      if (answer.trim()) {
        const full = await makeAuthRecord({ email, password: newPw || 'aaaa1111', question: q, answer });
        rec.ansSalt = full.ansSalt;
        rec.ansHash = full.ansHash;
      }
      setAuth(rec);
    }
    } catch (e) {
      setBusy(false);
      return setMsg(`保存できませんでした（${(e && e.message) || '不明なエラー'}）。`);
    }
    setBusy(false);
    setCurPw(''); setPw(''); setPw2(''); setAnswer('');
    setOpen(false);
    onToast?.(has ? 'ログイン情報を変更しました' : 'ログインを設定しました（この端末では今は開いたままにします）');
  };

  const remove = async () => {
    setMsg('');
    if (has) {
      const ok = await verifyPassword(auth, curPw);
      if (!ok) return setMsg('解除するには現在のパスワードを入力してください。');
    }
    clearAuth();
    // App.jsxのUNLOCK_KEYと同じキー・同じストレージ（localStorage、2026-11-12変更）。
    try { localStorage.setItem('shinkyu:unlocked', '1'); } catch (e) { /* noop */ }
    setCurPw('');
    setOpen(false);
    onToast?.('ログインを解除しました');
  };

  return (
    <div className="card">
      <p className="inline-note" style={{ marginBottom: 10 }}>
        {has
          ? `設定済み（ID：${auth.email}）。ログインID・パスワード・秘密の質問を変更できます。`
          : 'ログインID（メール）・パスワード・秘密の質問を設定すると、次回からログインが必要になります。'}
        <br />※ サーバー認証ではなく端末内のロックです。外部には送信されません。
      </p>
      {!open ? (
        <button className="btn primary" onClick={() => {
          // 開くたびに今の設定から入れ直す（復元などで変わった後に古い内容が残っていた）
          setEmail(auth?.email || '');
          setQuestion(auth?.question || '');
          setCurPw(''); setPw(''); setPw2(''); setAnswer('');
          setOpen(true); setMsg('');
        }}>
          {has ? '🔒 ログイン情報を変更' : '🔒 ログインを設定'}
        </button>
      ) : (
        <div>
          <div className="field">
            <label>ログインID（メールアドレス）</label>
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          {has && (
            <div className="field">
              <label>現在のパスワード（本人確認）</label>
              <input type="password" autoComplete="current-password" value={curPw} onChange={(e) => setCurPw(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label>{has ? '新しいパスワード（変えない場合は空欄）' : 'パスワード（アルファベット4＋数字4以上）'}</label>
            {/* 新しいパスワードの欄にブラウザが保存済みのパスワードを自動で入れると、確認欄と食い違って保存できなかった */}
            <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="例）study2024" />
          </div>
          <div className="field">
            <label>パスワード（確認）</label>
            <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
          <div className="field">
            <label>秘密の質問</label>
            <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="例）初めて飼ったペットの名前は？" />
          </div>
          <div className="field">
            <label>{has ? '秘密の質問の答え（変えない場合は空欄）' : '秘密の質問の答え'}</label>
            <input type="text" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="答え（大文字小文字は区別しません）" />
          </div>
          {msg && <div className="auth-error" style={{ marginBottom: 10 }}>{msg}</div>}
          <div className="btn-row">
            <button className="btn primary" onClick={save} disabled={busy}>{has ? '変更を保存' : '設定する'}</button>
            <button className="btn ghost" onClick={() => { setOpen(false); setMsg(''); }} disabled={busy}>キャンセル</button>
          </div>
          {has && (
            <button className="btn ghost sm block" style={{ marginTop: 10 }} onClick={remove} disabled={busy}>
              ログインを解除する（現在のパスワードが必要）
            </button>
          )}
        </div>
      )}
    </div>
  );
}
