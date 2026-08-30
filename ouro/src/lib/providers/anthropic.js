// Claude（Anthropic Messages API）。
//
// ブラウザから直接呼ぶため anthropic-dangerous-direct-browser-access が要る。
// キーはユーザー自身のものを端末内（ouro:secrets）に置く BYOK 方式。
// サーバーを持たないので運用費はゼロ。

import { readSse, throttleDelta, httpError } from './stream.js';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

export const anthropicProvider = {
  id: 'anthropic',
  name: 'Claude',
  needsKey: true,
  keyHelpUrl: 'https://console.anthropic.com/settings/keys',
  desc: 'Web検索・PDF読み取りに対応。調査系の社員と相性が良い。',
  models: [
    { id: 'claude-opus-5', label: 'Opus 5（最上位）', inputPer1M: 5, outputPer1M: 25, tier: 'high' },
    { id: 'claude-sonnet-5', label: 'Sonnet 5（標準）', inputPer1M: 2, outputPer1M: 10, tier: 'mid' },
    { id: 'claude-haiku-4-5', label: 'Haiku 4.5（低コスト）', inputPer1M: 1, outputPer1M: 5, tier: 'low' },
  ],
  // このプロバイダだけが使えるサーバーツール
  serverTools: {
    web: { type: 'web_search_20260209', name: 'web_search' },
    webfetch: { type: 'web_fetch_20260209', name: 'web_fetch' },
  },
  supportsPdf: true,

  async run({ apiKey, model, system, messages, tools = [], maxTokens = 8000, signal, onDelta }) {
    if (!apiKey) throw new Error('Claude の APIキーが設定されていません');

    const body = {
      model: model || 'claude-opus-5',
      max_tokens: maxTokens,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    };
    if (tools.length) body.tools = tools;
    // 受け取った先から画面へ出す（項目26）
    if (onDelta) body.stream = true;

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      // 状態番号を残す（混んでいるだけなら runtime.js が1度だけやり直す／新項目24）
      throw httpError('Claude', res, detail);
    }

    if (onDelta) return runStreaming(res, onDelta);

    const json = await res.json();
    const text = (json.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    // 検索した URL を出典として拾う
    const citations = [];
    for (const block of json.content || []) {
      if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        for (const r of block.content) {
          if (r && r.url) citations.push({ url: r.url, title: r.title || r.url });
        }
      }
    }

    return {
      text,
      citations,
      refused: json.stop_reason === 'refusal',
      usage: {
        input: (json.usage && json.usage.input_tokens) || 0,
        output: (json.usage && json.usage.output_tokens) || 0,
      },
    };
  },
};

/** 流しながら受け取る。出典（検索結果のURL）も途中で拾う。 */
async function runStreaming(res, onDelta) {
  const out = { text: '', citations: [], usage: { input: 0, output: 0 }, refused: false };
  const sink = throttleDelta(onDelta);

  await readSse(res, (data) => {
    if (data === '[DONE]') return;
    let ev;
    try {
      ev = JSON.parse(data);
    } catch {
      return;
    }
    if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
      out.text += ev.delta.text;
      sink.push(ev.delta.text);
    } else if (ev.type === 'content_block_start' && ev.content_block?.type === 'text') {
      // 文章のかたまりが分かれて届くことがある（検索結果を挟んだ時など）。
      // まとめ受けは join('\n') しているので、流し受けでも同じように改行を入れる。
      if (out.text) {
        out.text += '\n';
        sink.push('\n');
      }
    } else if (ev.type === 'content_block_start' && ev.content_block?.type === 'web_search_tool_result') {
      for (const r of ev.content_block.content || []) {
        if (r && r.url) out.citations.push({ url: r.url, title: r.title || r.url });
      }
    } else if (ev.type === 'message_start' && ev.message?.usage) {
      out.usage.input = ev.message.usage.input_tokens || 0;
    } else if (ev.type === 'message_delta') {
      if (ev.usage?.output_tokens) out.usage.output = ev.usage.output_tokens;
      if (ev.delta?.stop_reason === 'refusal') out.refused = true;
    }
  });

  sink.flush();
  out.text = out.text.trim();
  return out;
}

export default anthropicProvider;
