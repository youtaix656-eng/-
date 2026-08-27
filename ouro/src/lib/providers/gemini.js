// Gemini（Google Generative Language API）。BYOK・ブラウザ直叩き。

import { readSse, throttleDelta, httpError } from './stream.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const geminiProvider = {
  id: 'gemini',
  name: 'Gemini',
  needsKey: true,
  keyHelpUrl: 'https://aistudio.google.com/app/apikey',
  desc: '無料枠が使いやすい。まず動かしたいときの入口。',
  // **お金をかけずに社員を動かせる唯一の口。**
  // 画面はこの印を見て「無料で始められます」と先に出す
  // （3つ並べるだけでは、どれが0円で始められるか分からない）。
  freeTier: true,
  freeNote: 'Google AI Studio でキーを作ると無料枠で使えます（クレジットカード不要）。まずはここから。Flash 系は無料枠があり、Pro は有料のみです。',
  // モデルの並びは Google 側で入れ替わる。**古い id を置いたままにしない**——
  // 2026-08-27 に確かめたところ、新しく作ったキーでは 1.5 / 2.0 / 2.5 系が
  // すべて 404（「新しいプロジェクトでは使えません」）になっていた。
  // 料金は https://ai.google.dev/gemini-api/docs/pricing（2026-08-27 確認・USD / 100万トークン）。
  // ※要確認：料金は変わるので、年に一度は見直すこと。
  models: [
    { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite（無料枠あり・最安）', inputPer1M: 0.25, outputPer1M: 1.5, tier: 'low' },
    { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash（無料枠あり）', inputPer1M: 0.75, outputPer1M: 3.75, tier: 'mid' },
    // Pro には**無料枠が無い**。無料のキーだと 429（枠切れ）になるので、
    // runtime.js が同じエンジンの下のモデルへ自動で落とす。
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro（無料枠なし・有料のみ）', inputPer1M: 2, outputPer1M: 12, tier: 'high' },
  ],
  serverTools: {},
  supportsPdf: false,

  async run({ apiKey, model, system, messages, maxTokens = 4000, signal, onDelta }) {
    if (!apiKey) throw new Error('Gemini の APIキーが設定されていません');
    const id = model || 'gemini-3.1-flash-lite';
    const method = onDelta ? 'streamGenerateContent?alt=sse' : 'generateContent';

    const res = await fetch(`${BASE}/${encodeURIComponent(id)}:${method}`, {
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
      // 状態番号を残す（混んでいるだけなら runtime.js が1度だけやり直す／新項目24）
      throw httpError('Gemini', res, detail);
    }

    if (onDelta) {
      const out = { text: '', citations: [], usage: { input: 0, output: 0 } };
      const sink = throttleDelta(onDelta);
      await readSse(res, (data) => {
        let ev;
        try {
          ev = JSON.parse(data);
        } catch {
          return;
        }
        for (const part of ev.candidates?.[0]?.content?.parts || []) {
          if (part.text) {
            out.text += part.text;
            sink.push(part.text);
          }
        }
        if (ev.usageMetadata) {
          out.usage.input = ev.usageMetadata.promptTokenCount || 0;
          out.usage.output = ev.usageMetadata.candidatesTokenCount || 0;
        }
      });
      sink.flush();
      out.text = out.text.trim();
      return out;
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
