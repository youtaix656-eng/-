// PIN ロック。
//
// ⚠ 正直に書くこと（画面にも README にも）：
//   ①**生体認証（指紋・顔）は使えない**。ブラウザからは WebAuthn が要るうえ、
//     鍵の置き場所を用意できないので、このアプリでは対応しない。
//     「生体認証対応」と書かない（できないことをできるふりにしない）。
//   ②これは**のぞき見よけ**であって暗号化ではない。端末の中の保存データは、
//     開発者ツール等からは読める。本当に見られたくないものは書かない。
//   ③PIN を忘れたら開けない。**その場合は消してやり直すしかない**ことを
//     ロック画面自身に書き、消す導線もそこに置く（行き止まりを作らない）。

const SALT = 'kundalini-tracker/v1';

/** 端末が SHA-256 を使えるか（http:// で開いた場合など、使えない環境がある） */
export function canUseStrongHash(): boolean {
  return typeof globalThis.crypto?.subtle?.digest === 'function';
}

/** 使えない端末向けの、ごく単純な畳み込み（暗号ではない。平文を残さないためだけ） */
export function weakHash(pin: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const text = SALT + pin;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c + i, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export async function hashPin(pin: string): Promise<{ hash: string; kind: 'sha256' | 'fallback' }> {
  if (canUseStrongHash()) {
    const bytes = new TextEncoder().encode(SALT + pin);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return { hash, kind: 'sha256' };
  }
  return { hash: weakHash(pin), kind: 'fallback' };
}

export async function verifyPin(pin: string, hash: string | null, kind: 'sha256' | 'fallback' | null): Promise<boolean> {
  if (!hash) return true; // ロック未設定
  if (kind === 'fallback') return weakHash(pin) === hash;
  const made = await hashPin(pin);
  // 設定した端末と別の方式になった場合も、もう片方で照合できるようにする
  return made.hash === hash || weakHash(pin) === hash;
}

export const PIN_MIN = 4;
export const PIN_MAX = 8;

/** 入力チェック（数字のみ・4〜8桁）。エラーは日本語の文で返す */
export function validatePin(pin: string): string | null {
  if (!/^[0-9]+$/.test(pin)) return '数字だけで入力してください。';
  if (pin.length < PIN_MIN || pin.length > PIN_MAX) return `${PIN_MIN}〜${PIN_MAX}桁で入力してください。`;
  return null;
}
