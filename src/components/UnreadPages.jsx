import { useState } from 'react';

// 読み取れないページ・問題の控え
// 問題集や参考書を取り込んだとき、うまく読み取れなかったページ／問題をメモしておく。
// 次回きちんと読み取れたら「読み取れた（消す）」で記録を消す。
export default function UnreadPages({ store, onToast, onOpenImport }) {
  const { unread, addUnread, removeUnread } = store;

  const [source, setSource] = useState('');
  const [page, setPage] = useState('');
  const [detail, setDetail] = useState('');

  const canAdd = source.trim() || page.trim() || detail.trim();

  const add = () => {
    if (!canAdd) return;
    addUnread({ source: source.trim(), page: page.trim(), detail: detail.trim() });
    setSource('');
    setPage('');
    setDetail('');
    onToast?.('読み取れないページを控えました');
  };

  const resolve = (id) => {
    removeUnread(id);
    onToast?.('読み取れたので控えを消しました');
  };

  // 資料名ごとにまとめて表示
  const groups = {};
  unread.forEach((u) => {
    const key = u.source || '（資料名なし）';
    if (!groups[key]) groups[key] = [];
    groups[key].push(u);
  });
  const groupNames = Object.keys(groups);

  return (
    <div className="view">
      <h2 className="view-title">読み取れないページ</h2>
      <p className="view-desc">
        問題集や参考書を取り込んだとき、うまく読み取れなかったページや問題をここに控えておきましょう。
        あとで読み取れたら「読み取れた」で記録を消せます。
      </p>

      {/* 追加フォーム */}
      <div className="card">
        <div className="section-label" style={{ marginTop: 0 }}>控えを追加</div>
        <div className="field">
          <label>資料名（問題集・参考書など）</label>
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="例）過去問題集2024、〇〇教科書"
          />
        </div>
        <div className="field">
          <label>ページ・問題番号</label>
          <input
            type="text"
            value={page}
            onChange={(e) => setPage(e.target.value)}
            placeholder="例）p.12〜15、第92回 問23"
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>メモ（読み取れなかった理由・内容など・任意）</label>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="例）図が潰れて読めない、影で文字が欠けた、手書きで認識できない など"
          />
        </div>
        <button className="btn primary block" style={{ marginTop: 12 }} onClick={add} disabled={!canAdd}>
          ＋ 控えに追加
        </button>
        {onOpenImport && (
          <button className="btn ghost sm block" style={{ marginTop: 8 }} onClick={onOpenImport}>
            📥 取り込み画面へ（再チャレンジ）
          </button>
        )}
      </div>

      {/* 一覧 */}
      {unread.length === 0 ? (
        <div className="empty">
          <div className="ico">📄</div>
          <p>読み取れないページの控えはありません。</p>
          <p className="inline-note">
            取り込みで読み取れなかったページがあれば、ここに控えておくと抜け漏れを防げます。
          </p>
        </div>
      ) : (
        <>
          <div className="section-label">控え一覧（{unread.length}件）</div>
          {groupNames.map((name) => (
            <div key={name} style={{ marginBottom: 14 }}>
              <div className="unread-group">{name}</div>
              {groups[name].map((u) => (
                <div className="list-item unread-item" key={u.id}>
                  <div className="unread-main">
                    {u.page && <div className="unread-page">📄 {u.page}</div>}
                    {u.detail && <div className="li-q">{u.detail}</div>}
                    <div className="li-stat">
                      控えた日：{new Date(u.at).toLocaleDateString('ja-JP')}
                    </div>
                  </div>
                  <button className="btn sm primary unread-done" onClick={() => resolve(u.id)}>
                    ✓ 読み取れた
                  </button>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
