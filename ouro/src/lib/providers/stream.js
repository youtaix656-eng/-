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
