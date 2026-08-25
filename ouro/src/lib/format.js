// 表示のための小さな整形ヘルパー。

export function relTime(ts, now = Date.now()) {
  if (!ts) return '—';
  const diff = now - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'たった今';
  if (min < 60) return `${min}分前`;
  const hour = Math.round(min / 60);
  if (hour < 24) return `${hour}時間前`;
  const day = Math.round(hour / 24);
  if (day < 30) return `${day}日前`;
  return new Date(ts).toLocaleDateString('ja-JP');
}

export function dateLabel(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
}

export function usd(n) {
  const v = Number(n) || 0;
  if (v === 0) return '$0';
  if (v < 0.01) return '$0.01未満';
  return `$${v.toFixed(2)}`;
}

export function truncate(text, n = 80) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

/** 見出し・箇条書き・強調だけの最小限の Markdown を表示用の行に分解する。 */
export function toBlocks(text = '') {
  const lines = String(text).replace(/\r/g, '').split('\n');
  const blocks = [];
  let list = null;

  const flush = () => {
    if (list) {
      blocks.push({ type: 'list', items: list });
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    const li = line.match(/^\s*[-*・]\s+(.*)$/);
    const ol = line.match(/^\s*(\d+)[.)]\s+(.*)$/);

    if (h) {
      flush();
      blocks.push({ type: 'heading', level: h[1].length, text: h[2] });
    } else if (li) {
      list = list || [];
      list.push(li[1]);
    } else if (ol) {
      list = list || [];
      list.push(`${ol[1]}. ${ol[2]}`);
    } else if (!line.trim()) {
      flush();
    } else {
      flush();
      blocks.push({ type: 'p', text: line });
    }
  }
  flush();
  return blocks;
}
