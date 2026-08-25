// ChatGPT（OpenAI Chat Completions）。BYOK・ブラウザ直叩き。

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

export const openaiProvider = {
  id: 'openai',
  name: 'ChatGPT',
  needsKey: true,
  keyHelpUrl: 'https://platform.openai.com/api-keys',
  desc: '汎用。制作・発想の社員と相性が良い。',
  models: [
    { id: 'gpt-4o', label: 'GPT-4o（標準）', inputPer1M: 2.5, outputPer1M: 10, tier: 'mid' },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini（低コスト）', inputPer1M: 0.15, outputPer1M: 0.6, tier: 'low' },
  ],
  serverTools: {},
  supportsPdf: false,

  async run({ apiKey, model, system, messages, maxTokens = 4000, signal }) {
    if (!apiKey) throw new Error('ChatGPT の APIキーが設定されていません');

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        max_tokens: maxTokens,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          ...messages.map((m) => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : textOf(m.content),
          })),
        ],
      }),
      signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`ChatGPT 呼び出しに失敗しました（${res.status}）: ${detail.slice(0, 300)}`);
    }

    const json = await res.json();
    return {
      text: ((json.choices && json.choices[0] && json.choices[0].message.content) || '').trim(),
      citations: [],
      usage: {
        input: (json.usage && json.usage.prompt_tokens) || 0,
        output: (json.usage && json.usage.completion_tokens) || 0,
      },
    };
  },
};

function textOf(content) {
  if (!Array.isArray(content)) return String(content ?? '');
  return content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

export default openaiProvider;
