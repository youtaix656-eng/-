import { useEffect, useMemo, useState } from 'react';
import { qrMatrix } from '../lib/qr.js';
import { buildSyncPayload, encodeSync, syncUrl, SYNC_TTL_MS, HISTORY_SUMMARY_CUTOFF_MS } from '../lib/sync.js';
import { loadResumeState } from '../lib/storage.js';
import { splitIntoChunks } from '../lib/chunk.js';
import QRImage from './QRImage.jsx';

// 1枚のQRに載せるチャンクデータの目安文字数（URLのprefix・チャンクヘッダぶんの余裕を見た値）。
// QR誤り訂正レベルLの実用上限（約2,953バイト）には収まるが、900文字だと画面越しの
// カメラ撮影では読み取りにくいほど高密度（実測でモジュール1つ約2.9px）になっていたため、
// スキャンのしやすさを優先して抑えた（実測でモジュール1つ約4.6pxまで改善、枚数は増える）。
const CHUNK_DATA_LEN = 300;
const QR_SIZE = 320;

function fmtRemain(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  return `${m}:${ss}`;
}

// 進捗をQRで別端末へ受け渡し（サーバー不要・発行から5分間だけ有効）。
//   ・圧縮＋効率的な符号化（transferCodec）でまず縮める。
//   ・それでも1枚のQRに収まらない場合は自動でチャンク分割し、複数のQRを
//     一定間隔で自動的に切り替え表示する「アニメーションQR」にする
//     （手動での送り／一時停止も可能）。相手はSyncScanでカメラをかざし続けるだけでよい。
export default function SyncQR({ store, onToast }) {
  const { srs, history, memos, links, examResults, settings, bookmarks, session } = store;
  const [open, setOpen] = useState(false);
  const [withHistory, setWithHistory] = useState(true);
  const [summarizeHistory, setSummarizeHistory] = useState(false);
  const [issuedAt, setIssuedAt] = useState(0); // 発行時刻（再発行で更新）
  const [now, setNow] = useState(Date.now());
  const [building, setBuilding] = useState(false);
  const [chunks, setChunks] = useState(null); // string[] | null
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [intervalMs, setIntervalMs] = useState(1200);

  // 発行（＝いまの進捗でQR/URLを作り直し、5分の有効期限を張り直す）
  const issue = () => {
    setIssuedAt(Date.now());
    setNow(Date.now());
    setOpen(true);
  };

  // 有効期限のカウントダウン（1秒ごと）
  useEffect(() => {
    if (!open) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [open]);

  const remainMs = issuedAt ? SYNC_TTL_MS - (now - issuedAt) : 0;
  const expired = open && remainMs <= 0;

  // 圧縮・符号化・（必要なら）チャンク分割は非同期なので useEffect で組み立てる
  useEffect(() => {
    if (!open || !issuedAt) { setChunks(null); return; }
    let alive = true;
    setBuilding(true);
    setFrameIdx(0);
    (async () => {
      // quizProgress等（一問一答・復習・模試・音声の「続きから」）はReactのstoreに無いため、
      // IndexedDBから直接読む（bookmarks/sessionはstoreにあるのでそのまま使う）。
      const resumeState = await loadResumeState();
      if (!alive) return;
      const data = { srs, history, memos, links, examResults, settings, bookmarks, session, ...resumeState };
      const payload = buildSyncPayload(data, { includeHistory: withHistory, summarizeHistory });
      const encoded = await encodeSync(payload);
      if (!alive) return;
      // 常にチャンク形式（1枚で収まる場合は of=1 の1枚だけ）にして、読み取り側の処理を1本化する。
      const { parts } = splitIntoChunks(encoded, CHUNK_DATA_LEN);
      setChunks(parts.map((p) => syncUrl(p)));
      setBuilding(false);
    })();
    return () => { alive = false; };
    // issuedAt を依存に含めることで「再発行」時に焼き直す
  }, [open, issuedAt, withHistory, summarizeHistory, srs, history, memos, links, examResults, settings, bookmarks, session]);

  const multi = chunks && chunks.length > 1;
  const currentUrl = chunks ? chunks[frameIdx] : '';
  const matrix = useMemo(() => (currentUrl ? qrMatrix(currentUrl) : null), [currentUrl]);
  const tooBig = chunks && !matrix; // チャンクしても1枚のQRにすら収まらない極端なケース（通常は起こらない）

  // アニメーション（自動送り）
  useEffect(() => {
    if (!multi || !playing || expired || building) return undefined;
    const iv = setInterval(() => {
      setFrameIdx((i) => (i + 1) % chunks.length);
    }, intervalMs);
    return () => clearInterval(iv);
  }, [multi, playing, expired, building, chunks, intervalMs]);

  // カメラが使えない環境向け：現在表示中の枠（QRが出せない場合も含む）をテキストとしてコピーする。
  // 複数枚に分かれている場合は、この操作を枚数ぶん繰り返して相手に1つずつ貼り付けてもらう。
  const copyUrl = async () => {
    if (expired) {
      onToast?.('有効期限切れです。再発行してください');
      return;
    }
    try {
      await navigator.clipboard.writeText(currentUrl);
      onToast?.(
        multi
          ? `（${frameIdx + 1}/${chunks.length}枚目）をコピーしました。相手の端末に貼り付けて「取り込む」→ 次の枚も同じ手順で`
          : '受け渡しURLをコピーしました（5分間だけ有効）'
      );
    } catch (e) {
      onToast?.('コピーできませんでした');
    }
  };

  return (
    <div className="card">
      <p className="inline-note" style={{ marginBottom: 10 }}>
        いま端末にある学習の<strong>進捗・設定</strong>をQRコードにして、別の端末へ受け渡せます（サーバー不要）。
        別端末の<strong>カメラでこのQRを読み取る</strong>か、URLを開くと取り込めます。データが大きい時は自動で
        圧縮し、それでも収まらなければ<strong>QRを複数枚に分けて自動で連続表示</strong>します（読み取り側はかざし続けるだけでOK）。
        <br />
        🔒 <strong>安全のため、発行から5分を過ぎると使えなくなります</strong>（過ぎたら再発行してください）。
        <br />※ 問題データ本体や画像・音楽は含みません（容量のため）。
        <br />※ カメラが使えない環境では、QRの代わりに「受け渡しURLをコピー」でテキストとして送り、
        相手側の「URLを貼り付けて取り込む」に貼り付ける方法も使えます（複数枚の場合は1枚ずつ）。
      </p>
      {!open ? (
        <button className="btn primary" onClick={issue}>📱 QRコード／URLを発行（5分間有効）</button>
      ) : (
        <div>
          {building ? (
            <p className="inline-note">圧縮・準備中…</p>
          ) : tooBig ? (
            <div style={{ marginBottom: 10 }}>
              <div className="auth-error" style={{ marginBottom: 10 }}>
                データが大きすぎてQRとしては表示できませんでした。
                {withHistory ? '下の「解答履歴を含めない」をオフにするか、' : ''}
                下の「コピー」でテキストとして1枚ずつ送るか、「共有」ボタンやバックアップファイルでの移行をご利用ください。
              </div>
              {!expired && chunks && chunks.length > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <p className="inline-note">
                    <strong>{Math.round(((frameIdx + 1) / chunks.length) * 100)}%</strong>
                    （{chunks.length}個のテキストブロックに分割中・{frameIdx + 1}/{chunks.length}個目）
                  </p>
                  <div className="progress"><span style={{ width: `${((frameIdx + 1) / chunks.length) * 100}%` }} /></div>
                  <div className="btn-row" style={{ marginTop: 8, justifyContent: 'center' }}>
                    <button className="btn ghost sm" onClick={() => setFrameIdx((i) => (i - 1 + chunks.length) % chunks.length)}>◀ 前へ</button>
                    <button className="btn primary sm" onClick={copyUrl}>📋 この枠をコピー</button>
                    <button className="btn ghost sm" onClick={() => setFrameIdx((i) => (i + 1) % chunks.length)}>次へ ▶</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', marginBottom: 10, position: 'relative' }}>
              <QRImage matrix={matrix} dim={expired} size={QR_SIZE} />
              {expired && (
                <div
                  style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 10,
                  }}
                >
                  <div style={{ fontWeight: 800, color: 'var(--wrong, #c62828)' }}>⏱ 有効期限切れ</div>
                  <button className="btn primary sm" onClick={issue}>🔄 再発行する</button>
                </div>
              )}
              <div className="inline-note" style={{ marginTop: 6 }}>
                {expired ? (
                  <>発行から5分を過ぎました。再発行してください。</>
                ) : (
                  <>
                    {multi ? (
                      <>
                        <strong>{Math.round(((frameIdx + 1) / chunks.length) * 100)}%</strong>
                        （{frameIdx + 1}/{chunks.length}枚目・{chunks.length}枚のQRに分割中）
                        <br />相手のカメラをかざし続けると自動で読み取ります
                      </>
                    ) : (
                      <>別端末のカメラで読み取ってください</>
                    )}
                    <br />
                    <strong style={{ color: remainMs < 60 * 1000 ? 'var(--wrong, #c62828)' : 'inherit' }}>
                      残り有効時間 {fmtRemain(remainMs)}
                    </strong>
                  </>
                )}
              </div>
              {multi && !expired && (
                <div style={{ marginTop: 8 }}>
                  <div className="progress"><span style={{ width: `${((frameIdx + 1) / chunks.length) * 100}%` }} /></div>
                  <div className="btn-row" style={{ marginTop: 8, justifyContent: 'center' }}>
                    <button className="btn ghost sm" onClick={() => setFrameIdx((i) => (i - 1 + chunks.length) % chunks.length)}>◀ 前へ</button>
                    <button className="btn ghost sm" onClick={() => setPlaying((v) => !v)}>{playing ? '⏸ 一時停止' : '▶ 自動送りを再開'}</button>
                    <button className="btn ghost sm" onClick={() => setFrameIdx((i) => (i + 1) % chunks.length)}>次へ ▶</button>
                  </div>
                  <div className="btn-row" style={{ marginTop: 4, justifyContent: 'center' }}>
                    {[800, 1200, 2000].map((ms) => (
                      <button key={ms} className={`chip ${intervalMs === ms ? 'active' : ''}`} onClick={() => setIntervalMs(ms)}>
                        {(ms / 1000).toFixed(1)}秒間隔
                      </button>
                    ))}
                  </div>
                  <p className="inline-note" style={{ marginTop: 6 }}>
                    カメラが使えない場合は、下の「受け渡しURLをコピー」で今表示中の枚をテキストとしてコピーし、
                    相手に貼り付けてもらう方法も使えます（枚数ぶん繰り返します）。
                  </p>
                </div>
              )}
            </div>
          )}
          <label className="switch-row" style={{ marginTop: 4 }}>
            <input type="checkbox" checked={withHistory} onChange={(e) => setWithHistory(e.target.checked)} />
            <span>
              解答履歴も含める
              <small>オフにすると容量が減り、QRの枚数を減らせます（弱点分析の履歴は移りません）。</small>
            </span>
          </label>
          {withHistory && (
            <label className="switch-row" style={{ marginTop: 4 }}>
              <input type="checkbox" checked={summarizeHistory} onChange={(e) => setSummarizeHistory(e.target.checked)} />
              <span>
                古い履歴を要約して軽量化する
                <small>
                  直近{Math.round(HISTORY_SUMMARY_CUTOFF_MS / (24 * 60 * 60 * 1000))}日分はそのまま、それより前は
                  「日付・科目・正誤ごとの件数」に要約してQRの枚数を減らします（要約後は問題ごとの詳細は失われます）。
                </small>
              </span>
            </label>
          )}
          <div className="btn-row" style={{ marginTop: 10 }}>
            {!tooBig && !expired && (
              <button className="btn" onClick={copyUrl}>
                受け渡しURLをコピー{multi ? `（${frameIdx + 1}/${chunks.length}枚目）` : ''}
              </button>
            )}
            <button className="btn" onClick={issue}>🔄 再発行</button>
            <button className="btn ghost" onClick={() => setOpen(false)}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}
