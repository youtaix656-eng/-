// 応答を1文字目から流して受け取る（項目26）。
//
// 完了まで待つと、長い成果物では数十秒なにも出ない。
// 途中の文字を渡せば、読み始められる時刻が大きく早まる。
// 3つのエンジンで形式が違うので、行の切り出しだけここで共通化する。

/**
 * SSE（text/event-stream）を1行ずつ読む。
 * @param {Response} res
 * @param {(data: string) => void} onLine  "data: " を外した中身
 */
export async function readSse(res, onLine) {
  const reader = res.body?.getReader();
  if (!reader) throw new Error('この環境では応答を流して受け取れません');
  const decoder = new TextDecoder();
  let buf = '';

  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    // 行の途中で切れることがあるので、最後の1行は次に持ち越す
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith(':')) continue;
      if (t.startsWith('data:')) onLine(t.slice(5).trim());
    }
  }
  if (buf.trim().startsWith('data:')) onLine(buf.trim().slice(5).trim());
}

/** 流れてくる文字を、画面の更新頻度に合わせて間引く。 */
export function throttleDelta(onDelta, ms = 90) {
  if (typeof onDelta !== 'function') return { push() {}, flush() {} };
  let buf = '';
  let last = 0;
  return {
    push(text) {
      buf += text;
      const now = Date.now();
      if (now - last >= ms) {
        last = now;
        const out = buf;
        buf = '';
        onDelta(out);
      }
    },
    flush() {
      if (buf) {
        onDelta(buf);
        buf = '';
      }
    },
  };
}

// ── 混雑・失敗の見分け（新項目24・25）──
//
// エンジンごとに文言は違っても、HTTP の状態番号は共通なので、ここで1回だけ扱う。
// **エンジン名で分岐しない**方針を守るため、判定はこの2つの関数だけに集める。

/**
 * 状態番号から「次に何をすればよいか」を1文で返す。
 *
 * 以前は英語のJSONがそのまま画面に出ていた。番号は分かっているのだから、
 * **止まった人が自分で戻れる形**にして出す。生の本文は detail に残す。
 */
export function failureAdvice(status) {
  if (status === 401 || status === 403) {
    return 'APIキーが受け付けられませんでした。設定でキーを入れ直してください（期限切れ・コピー漏れが多いです）。';
  }
  if (status === 429) return '呼び出しが多すぎます。少し時間をおいてからやり直してください。';
  if (status === 402) return 'エンジン側の残高・利用枠が足りないようです。契約状況を確認してください。';
  if (status === 400 || status === 422) {
    return '送った内容をエンジンが受け付けませんでした。依頼文を短くすると通ることがあります。';
  }
  if (status >= 500) return 'エンジン側が一時的に不調のようです。少し時間をおいてやり直してください。';
  if (!status) return 'エンジンに届きませんでした。電波・通信環境を確認してください。';
  return 'もう一度やり直してください。';
}

/** 応答から、状態番号つきのエラーを作る。 */
export function httpError(name, res, detail = '') {
  const e = new Error(`${name}：${failureAdvice(res.status)}（${res.status}）`);
  e.status = res.status;
  e.detail = String(detail).slice(0, 300); // 生の本文は残す（調べる時のため）
  const after = res.headers && typeof res.headers.get === 'function' ? res.headers.get('retry-after') : null;
  const sec = Number(after);
  if (Number.isFinite(sec) && sec > 0) e.retryAfterMs = Math.min(sec * 1000, 20000);
  return e;
}

/**
 * 「混んでいるだけ」か。
 *   429 …… 呼びすぎ
 *   503 …… 一時的に受けられない
 *   529 …… 過負荷（Anthropic）
 * これ以外（400・401 など）は、待っても直らないので繰り返さない。
 */
export function isBusyError(e) {
  const s = e && e.status;
  return s === 429 || s === 503 || s === 529;
}
