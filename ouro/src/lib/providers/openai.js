// ChatGPT（OpenAI Chat Completions）。BYOK・ブラウザ直叩き。

import { readSse, throttleDelta, httpError } from './stream.js';

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

  async run({ apiKey, model, system, messages, maxTokens = 4000, signal, onDelta }) {
    if (!apiKey) throw new Error('ChatGPT の APIキーが設定されていません');

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        max_tokens: maxTokens,
        ...(onDelta ? { stream: true, stream_options: { include_usage: true } } : {}),
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
      // 状態番号を残す（混んでいるだけなら runtime.js が1度だけやり直す／新項目24）
      throw httpError('ChatGPT', res, detail);
    }

    if (onDelta) {
      const out = { text: '', citations: [], usage: { input: 0, output: 0 } };
      const sink = throttleDelta(onDelta);
      await readSse(res, (data) => {
        if (data === '[DONE]') return;
        let ev;
        try {
          ev = JSON.parse(data);
        } catch {
          return;
        }
        const piece = ev.choices?.[0]?.delta?.content;
        if (piece) {
          out.text += piece;
          sink.push(piece);
        }
        if (ev.usage) {
          out.usage.input = ev.usage.prompt_tokens || 0;
          out.usage.output = ev.usage.completion_tokens || 0;
        }
      });
      sink.flush();
      out.text = out.text.trim();
      return out;
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
