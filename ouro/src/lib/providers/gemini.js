// Gemini（Google Generative Language API）。BYOK・ブラウザ直叩き。

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const geminiProvider = {
  id: 'gemini',
  name: 'Gemini',
  needsKey: true,
  keyHelpUrl: 'https://aistudio.google.com/app/apikey',
  desc: '無料枠が使いやすい。まず動かしたいときの入口。',
  models: [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash（低コスト）', inputPer1M: 0.1, outputPer1M: 0.4, tier: 'low' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', inputPer1M: 1.25, outputPer1M: 5, tier: 'mid' },
  ],
  serverTools: {},
  supportsPdf: false,

  async run({ apiKey, model, system, messages, maxTokens = 4000, signal }) {
    if (!apiKey) throw new Error('Gemini の APIキーが設定されていません');
    const id = model || 'gemini-2.0-flash';

    const res = await fetch(`${BASE}/${encodeURIComponent(id)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: typeof m.content === 'string' ? m.content : textOf(m.content) }],
        })),
        generationConfig: { maxOutputTokens: maxTokens },
      }),
      signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Gemini 呼び出しに失敗しました（${res.status}）: ${detail.slice(0, 300)}`);
    }

    const json = await res.json();
    const parts =
      (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts) || [];
    return {
      text: parts.map((p) => p.text || '').join('\n').trim(),
      citations: [],
      usage: {
        input: (json.usageMetadata && json.usageMetadata.promptTokenCount) || 0,
        output: (json.usageMetadata && json.usageMetadata.candidatesTokenCount) || 0,
      },
    };
  },
};

function textOf(content) {
  if (!Array.isArray(content)) return String(content ?? '');
  return content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

export default geminiProvider;
