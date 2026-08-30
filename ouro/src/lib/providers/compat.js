// ローカルAI（OpenAI互換）。
//
// Ollama / LM Studio / llama.cpp など、**自分のパソコンの中で動くAI**へ
// つなぐための入口。話し方（API）は OpenAI と同じなので、宛先だけ差し替える。
//
// なぜ足すか：使い込むほど費用が効いてくる。要約・分類・整理のような
// 「重い頭がいらない仕事」まで課金モデルへ投げるのは、卵の殻をブルドーザーで
// 潰すようなもの。そこをローカルへ逃がせると月の上限に当たりにくくなる。
//
// **正直な制約**（画面にもそのまま書く）：
//  ・iPhone / iPad では使えない。Safari は https の画面から http://localhost への
//    通信を止めるうえ、そもそも端末にモデルが無い。
//  ・パソコンの Chrome / Firefox なら http://localhost へ出られる。
//  ・サーバー側で「このページからの通信を許す」設定が要る
//    （Ollama なら OLLAMA_ORIGINS）。
//  ・費用は 0 として数える（電気代はここでは扱わない）。

import { readSse, throttleDelta, httpError } from './stream.js';

/** 宛先の既定（Ollama の OpenAI 互換エンドポイント）。 */
export const DEFAULT_BASE_URL = 'http://localhost:11434/v1';
export const DEFAULT_MODEL = 'qwen3:8b';

export const compatProvider = {
  id: 'compat',
  name: 'ローカルAI（自分のPC）',
  needsKey: false,
  // 設定に宛先が入っている時だけ「使える」。
  // needsKey だけで見ると、宛先が空でも使えることになってしまう。
  isReady: (secrets, settings = {}) => Boolean(settings.compatBaseUrl),
  keyHelpUrl: 'https://ollama.com/download',
  desc: 'Ollama / LM Studio などに繋ぐ。費用は0。パソコンのChrome・Firefoxのみ。',
  freeTier: true,
  freeNote: '自分のPCの中で動くので費用は0ですが、iPhone・iPad では使えません。',
  // モデル名はサーバーごとに違うので、ここでは1つの器だけ持つ。
  // 実際に投げる名前は settings.compatModel（run の中で差し替える）。
  models: [{ id: 'local', label: '自分のPCのモデル', inputPer1M: 0, outputPer1M: 0, tier: 'mid' }],
  serverTools: {},
  supportsPdf: false,

  async run({ system, messages, maxTokens = 4000, signal, onDelta, settings = {} }) {
    const base = String(settings.compatBaseUrl || '').replace(/\/+$/, '');
    if (!base) throw new Error('ローカルAIの宛先（URL）が設定されていません');
    const model = settings.compatModel || DEFAULT_MODEL;

    let res;
    try {
      res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          ...(onDelta ? { stream: true } : {}),
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
    } catch (e) {
      // **ここで黙って諦めない。** つながらない理由はだいたい3つに絞れる。
      if (e && e.name === 'AbortError') throw e;
      const err = new Error(
        `ローカルAI（${base}）につながりませんでした。①そのアプリが起動しているか ②URLが合っているか ③このページからの通信を許す設定（Ollama なら OLLAMA_ORIGINS）を確かめてください。iPhone・iPad では使えません。`
      );
      err.detail = String((e && e.message) || e);
      throw err;
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw httpError('ローカルAI', res, detail);
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
      // **実際に投げたモデル名を返す。** 返さないと、記録が器の id（'local'）のままになり、
      // 「どのモデルで通ったか」が分からなくなる（エンジンの実績の表にも出ない）。
      return { ...out, model };
    }

    const json = await res.json();
    return {
      text: ((json.choices && json.choices[0] && json.choices[0].message.content) || '').trim(),
      citations: [],
      model,
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

export default compatProvider;
