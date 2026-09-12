// イヤホン接続の検知（できる範囲で）。
//
// ⚠ Web には「イヤホンが刺さっているか」を直接教える API が無い。
//    できるのは enumerateDevices() の音声出力の名前を見ることだけで、
//    ・名前が読めるのはマイク許可のあとで、Chrome 系の端末に限られる
//    ・iOS Safari は音声出力を列挙しない
//    ・有線イヤホンは名前が変わらないことが多い
//    ——なので「見つかった」時だけ自動で通し、見つからない時は本人の確認に任せる。
//    できないことをできるふりに書かない（画面にもそう書く）。

export type HeadphoneStatus = 'connected' | 'unknown';

const HEADPHONE_WORDS = [
  'headphone',
  'headset',
  'earphone',
  'earbud',
  'airpod',
  'bluetooth',
  'イヤホン',
  'イヤフォン',
  'ヘッドホン',
  'ヘッドフォン',
  'ヘッドセット',
  'hands-free',
  'handsfree',
];

/** 音声出力の名前の一覧から判定する（純粋関数） */
export function classifyOutputs(labels: string[]): HeadphoneStatus {
  for (const raw of labels) {
    const label = (raw || '').toLowerCase();
    if (!label) continue;
    if (HEADPHONE_WORDS.some((w) => label.includes(w))) return 'connected';
  }
  return 'unknown';
}

export function canEnumerate(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function';
}

/** 今の状態を調べる。調べられない端末では 'unknown' */
export async function detectHeadphones(): Promise<HeadphoneStatus> {
  if (!canEnumerate()) return 'unknown';
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const labels = devices.filter((d) => d.kind === 'audiooutput').map((d) => d.label);
    return classifyOutputs(labels);
  } catch {
    return 'unknown';
  }
}

/** 抜き差しを見張る。戻り値で解除する */
export function watchDevices(onChange: () => void): () => void {
  if (!canEnumerate() || typeof navigator.mediaDevices.addEventListener !== 'function') return () => {};
  navigator.mediaDevices.addEventListener('devicechange', onChange);
  return () => navigator.mediaDevices.removeEventListener('devicechange', onChange);
}

/** 音を出してよいか。自動で分かった時か、本人が確認した時だけ */
export function audioAllowed(status: HeadphoneStatus, confirmed: boolean): boolean {
  return status === 'connected' || confirmed;
}
