// 設定。AIエンジンのキー（BYOK）・AI Router・プラン・データの持ち出し。

import { useState } from 'react';
import { Card, Field, SectionTitle } from './ui.jsx';
import { PROVIDERS } from '../lib/providers/index.js';
import { PLANS } from '../data/plans.js';

export default function Settings({ store, toast }) {
  const [keys, setKeys] = useState(() => ({ ...store.secrets }));
  const [show, setShow] = useState({});

  const saveKey = (id) => {
    store.setSecret(id, (keys[id] || '').trim());
    toast(keys[id] ? `${id} のキーを保存しました` : 'キーを削除しました');
  };

  const doExport = async () => {
    const data = await store.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ouro-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('書き出しました（APIキーは含まれません）');
  };

  const doImport = async (file) => {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      await store.importData(payload);
    } catch (e) {
      toast(`取り込めませんでした：${e.message}`);
    }
  };

  return (
    <div className="screen fade-in">
      <Card glyph="✳" title="AIエンジン（キーはあなたのもの）">
        <p className="muted" style={{ marginTop: -6 }}>
          Ouro はサーバーを持ちません。あなたのAPIキーを端末内に保存し、
          ブラウザから直接エンジンを呼びます。キーは書き出し（バックアップ）にも含まれません。
          <br />
          <strong style={{ color: '#fff' }}>1つ登録すれば、社員全員が使えるようになります。</strong>
        </p>

        {PROVIDERS.filter((p) => p.needsKey).map((p) => (
          <div key={p.id} style={{ marginBottom: 16 }}>
            <Field
              label={`${p.name}${store.secrets[p.id] ? '（接続済み）' : ''}`}
              hint={p.desc}
            >
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="input"
                  type={show[p.id] ? 'text' : 'password'}
                  value={keys[p.id] || ''}
                  onChange={(e) => setKeys({ ...keys, [p.id]: e.target.value })}
                  placeholder={store.secrets[p.id] ? '登録済み（変更するときだけ入力）' : 'APIキーを貼り付け'}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="btn small"
                  onClick={() => setShow({ ...show, [p.id]: !show[p.id] })}
                >
                  {show[p.id] ? '隠す' : '表示'}
                </button>
              </div>
            </Field>
            <div className="btn-row" style={{ marginTop: -8 }}>
              <button type="button" className="btn small" onClick={() => saveKey(p.id)}>
                保存
              </button>
              {store.secrets[p.id] && (
                <button
                  type="button"
                  className="btn small ghost"
                  onClick={() => {
                    setKeys({ ...keys, [p.id]: '' });
                    store.setSecret(p.id, '');
                    toast('削除しました');
                  }}
                >
                  削除
                </button>
              )}
              {p.keyHelpUrl && (
                <a
                  href={p.keyHelpUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn small ghost"
                  style={{ textDecoration: 'none' }}
                >
                  キーを取りに行く ↗
                </a>
              )}
            </div>
            <div className="muted" style={{ marginTop: 4 }}>
              モデル：{p.models.map((m) => m.label).join('／')}
            </div>
          </div>
        ))}
      </Card>

      <Card glyph="⟳" title="AI Router">
        <Field label="どのモデルを使うか" hint="自動＝仕事の重さと必要な道具から選びます。手動＝各社員の希望どおりに。">
          <select
            className="select"
            value={store.settings.routerMode}
            onChange={(e) => store.updateSettings({ routerMode: e.target.value })}
          >
            <option value="auto">自動</option>
            <option value="manual">手動（社員の希望を優先）</option>
          </select>
        </Field>
        <Field label="1回の返答の上限（トークン）" hint="長い成果物が途中で切れるときは増やしてください。">
          <select
            className="select"
            value={store.settings.maxTokens}
            onChange={(e) => store.updateSettings({ maxTokens: Number(e.target.value) })}
          >
            <option value={2000}>2,000（短い・安い）</option>
            <option value={4000}>4,000</option>
            <option value={8000}>8,000（標準）</option>
            <option value={16000}>16,000（長い・高い）</option>
          </select>
        </Field>
      </Card>

      <Card glyph="⚙" title="会社">
        <Field label="会社名">
          <input
            className="input"
            value={store.company?.name || ''}
            onChange={(e) => store.updateCompany({ name: e.target.value })}
          />
        </Field>
        <Field label="プラン（道具の接続数の上限）">
          <select
            className="select"
            value={store.company?.planId || 'free'}
            onChange={(e) => store.updateCompany({ planId: e.target.value })}
          >
            {PLANS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}（道具{p.maxConnections}・社員{p.maxEmployees}）
              </option>
            ))}
          </select>
        </Field>
        <Field label="円換算に使うレート（1ドル＝）" hint="AI費用を円で見るための目安です。">
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={store.settings.usdJpy}
            onChange={(e) => store.updateSettings({ usdJpy: Number(e.target.value) || 155 })}
          />
        </Field>
      </Card>

      <SectionTitle>データ</SectionTitle>
      <Card glyph="▤" title="持ち出し・取り込み">
        <p className="muted" style={{ marginTop: -6 }}>
          すべてのデータは端末の中だけにあります。機種変更のときは書き出して移してください。
          <br />
          <strong style={{ color: '#fff' }}>APIキーは書き出しに含まれません</strong>（移した先で入れ直してください）。
        </p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={doExport}>
            書き出す
          </button>
          <label className="btn" style={{ cursor: 'pointer' }}>
            取り込む
            <input
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => doImport(e.target.files?.[0])}
            />
          </label>
        </div>
      </Card>

      <Card glyph="⊘" title="安全について">
        <p className="muted" style={{ marginTop: -6, marginBottom: 0 }}>
          ・APIキーはこの端末の IndexedDB にのみ保存され、Ouro のサーバーへは送られません
          （そもそもサーバーがありません）。
          <br />
          ・キーはあなたが呼び出すエンジン（Anthropic / OpenAI / Google）へ直接送られます。
          <br />
          ・共有端末では使わないでください。ブラウザのデータを消すとキーも消えます。
          <br />
          ・AI社員の操作はすべて操作履歴に残ります。
        </p>
      </Card>

      <div className="divider-glyph">✦</div>
      <p className="muted" style={{ textAlign: 'center' }}>
        Ouro — AIを使うのではなく、AIを雇う。
        <br />
        AIが働くほど、あなたの知識が資産になる。
      </p>
    </div>
  );
}
