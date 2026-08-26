// ボイスクローン（BYOK・ElevenLabs）
//
// このアプリは音声合成エンジンを同梱しない（外部ランタイム依存なし・端末内保存が方針のため）。
// 「自分の声で読み上げたい」場合のみ、ユーザー自身のElevenLabsアカウント・APIキーを使い、
// このモジュールがブラウザから直接ElevenLabsのAPIを呼ぶ（BYOK＝Bring Your Own Key）。
// 音声データ・APIキーはElevenLabsのサーバーへ送信される＝端末内保存方針の明示的な例外。
// 呼び出しはこの用途（クローン作成・試聴・読み上げ・削除）のみに限定する。

const API_BASE = 'https://api.elevenlabs.io/v1';

async function readErrorMessage(res) {
  try {
    const data = await res.json();
    const detail = data?.detail;
    if (typeof detail === 'string') return detail;
    if (detail?.message) return detail.message;
    return JSON.stringify(data);
  } catch (e) {
    return `${res.status} ${res.statusText}`;
  }
}

// 声のクローンを作成する。blob は音声ファイル（wav/mp3/webm等）。
// 戻り値: { voiceId }
export async function cloneVoice({ apiKey, name, blob, fileName = 'voice-sample.wav' }) {
  if (!apiKey) throw new Error('APIキーが未設定です');
  if (!blob) throw new Error('音声ファイルが選択されていません');
  const form = new FormData();
  form.append('name', (name || '').trim() || 'マイボイス');
  form.append('files', blob, fileName);
  const res = await fetch(`${API_BASE}/voices/add`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
  });
  if (!res.ok) throw new Error(`ボイスクローンの作成に失敗しました（${await readErrorMessage(res)}）`);
  const data = await res.json();
  if (!data.voice_id) throw new Error('ボイスクローンの作成に失敗しました（voice_idが返されませんでした）');
  return { voiceId: data.voice_id };
}

// テキストをクローン音声で読み上げた音声（mp3）を取得する。戻り値: Blob
export async function synthesizeSpeech({ apiKey, voiceId, text, modelId = 'eleven_multilingual_v2' }) {
  if (!apiKey) throw new Error('APIキーが未設定です');
  if (!voiceId) throw new Error('ボイスIDが未設定です');
  if (!text || !text.trim()) throw new Error('読み上げるテキストがありません');
  const res = await fetch(`${API_BASE}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({ text, model_id: modelId }),
  });
  if (!res.ok) throw new Error(`音声の生成に失敗しました（${await readErrorMessage(res)}）`);
  return res.blob();
}

// クローンした声をElevenLabs側から削除する。
export async function deleteVoice({ apiKey, voiceId }) {
  if (!apiKey || !voiceId) return;
  const res = await fetch(`${API_BASE}/voices/${voiceId}`, {
    method: 'DELETE',
    headers: { 'xi-api-key': apiKey },
  });
  if (!res.ok) throw new Error(`ボイスの削除に失敗しました（${await readErrorMessage(res)}）`);
}
