import { useRef, useState } from 'react';
import { cloneVoice, synthesizeSpeech, deleteVoice } from '../lib/voiceClone.js';

const SAMPLE_TEXT = 'これは試聴です。合谷は手陽明大腸経の原穴です。';

// ボイスクローン（BYOK・ElevenLabs）設定カード。
// このアプリは音声合成エンジンを同梱しないため、自分の声で読み上げたい場合のみ、
// ユーザー自身のElevenLabsアカウント・APIキーを使う（端末内保存方針の明示的な例外）。
// APIキーは settings とは別の secret ストレージに保存し、バックアップ/QR/クラウド同期には含めない
// （lib/storage.js の loadVoiceCloneSecret 参照）。
export default function VoiceClone({ settings, updateSettings, apiKey, onSaveApiKey, onToast }) {
  const voiceClone = settings.voiceClone || { enabled: false, voiceId: '', voiceName: '' };
  const [keyInput, setKeyInput] = useState(apiKey || '');
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const saveKey = () => {
    onSaveApiKey(keyInput.trim());
    onToast?.('APIキーを保存しました（この端末にのみ保存）');
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const doClone = async () => {
    if (!apiKey.trim()) {
      onToast?.('先にAPIキーを保存してください');
      return;
    }
    if (!file) {
      onToast?.('音声ファイルを選んでください');
      return;
    }
    setBusy(true);
    try {
      const { voiceId } = await cloneVoice({ apiKey, name, blob: file, fileName: file.name });
      updateSettings({ voiceClone: { enabled: true, voiceId, voiceName: name.trim() || 'マイボイス' } });
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      onToast?.('ボイスクローンを作成しました');
    } catch (e) {
      onToast?.(e.message || 'ボイスクローンの作成に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const doTest = async () => {
    if (!apiKey.trim() || !voiceClone.voiceId) return;
    setBusy(true);
    let url;
    try {
      const blob = await synthesizeSpeech({ apiKey, voiceId: voiceClone.voiceId, text: SAMPLE_TEXT });
      url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (e) {
      if (url) URL.revokeObjectURL(url);
      onToast?.(e.message || '試聴に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!confirm('このボイスクローンを削除しますか？（ElevenLabs側からも削除されます）')) return;
    setBusy(true);
    try {
      await deleteVoice({ apiKey, voiceId: voiceClone.voiceId });
    } catch (e) {
      onToast?.(e.message || '削除に失敗しました（ElevenLabs側）');
    } finally {
      updateSettings({ voiceClone: { enabled: false, voiceId: '', voiceName: '' } });
      setBusy(false);
      onToast?.('ボイスクローンを削除しました');
    }
  };

  return (
    <div className="card">
      <p className="inline-note" style={{ marginBottom: 10 }}>
        自分の声を音声学習の読み上げ声にできます（任意）。<strong>本人の声、または声の持ち主から
        明確な許可を得ている音声のみ</strong>登録してください。このアプリは音声合成エンジンを
        同梱しないため、ご自身の<strong>ElevenLabs</strong>アカウント・APIキーを使います
        （<a href="https://elevenlabs.io" target="_blank" rel="noreferrer">elevenlabs.io</a>、
        利用料はご自身の負担）。<strong>音声データ・APIキーはElevenLabsのサーバーへ送信されます</strong>
        （端末内保存方針の明示的な例外）。APIキーはこの端末にのみ保存し、バックアップ・QR・
        クラウド同期には含めません。
      </p>

      <div className="field">
        <label htmlFor="voiceclone-apikey">ElevenLabs APIキー</label>
        <input
          id="voiceclone-apikey"
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder="xi-api-key"
        />
      </div>
      <div className="btn-row" style={{ marginBottom: 14 }}>
        <button className="btn sm" onClick={saveKey}>💾 APIキーを保存</button>
      </div>

      {voiceClone.voiceId ? (
        <>
          <p className="inline-note">
            登録済み：<strong>{voiceClone.voiceName || 'マイボイス'}</strong>
          </p>
          <label className="switch-row" style={{ marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={!!voiceClone.enabled}
              onChange={(e) => updateSettings({ voiceClone: { ...voiceClone, enabled: e.target.checked } })}
            />
            <span>音声学習の読み上げにこの声を使う</span>
          </label>
          <div className="btn-row">
            <button className="btn sm" onClick={doTest} disabled={busy || !apiKey.trim()}>🔊 試聴する</button>
            <button className="btn sm danger" onClick={doDelete} disabled={busy}>🗑️ 削除</button>
          </div>
        </>
      ) : (
        <>
          <div className="field">
            <label htmlFor="voiceclone-name">名前（任意）</label>
            <input
              id="voiceclone-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="マイボイス"
            />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            onChange={handleFile}
            style={{ display: 'none' }}
          />
          <div className="btn-row">
            <button className="btn" onClick={() => fileRef.current?.click()}>
              📁 音声ファイルを選ぶ
            </button>
            <button className="btn primary" onClick={doClone} disabled={busy || !file}>
              🎙️ クローンを作成
            </button>
          </div>
          {file && <p className="inline-note" style={{ marginTop: 6 }}>選択中: {file.name}</p>}
          <p className="inline-note" style={{ marginTop: 8 }}>
            数十秒〜数分程度の、雑音の少ないご本人の発話音声を推奨します。
          </p>
        </>
      )}
    </div>
  );
}
