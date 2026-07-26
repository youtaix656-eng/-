// 端末内ログイン（アプリロック）用のユーティリティ。
//
// ※ これはサーバー認証ではなく「この端末の中だけ」の簡易ロックです。
//    入力値はこの端末に保存され、外部へ送信されません。パスワード・秘密の
//    質問の答えは平文では持たず、ソルト付きハッシュ（SHA-256）にして保存します。
//    端末やブラウザのデータを消すと解除できなくなる場合があります。

// ---- 入力ルール ----
export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

// パスワード：アルファベット4文字以上 かつ 数字4文字以上
export function validatePassword(pw) {
  const s = String(pw || '');
  const letters = (s.match(/[A-Za-z]/g) || []).length;
  const digits = (s.match(/[0-9]/g) || []).length;
  return letters >= 4 && digits >= 4;
}
export function passwordProblems(pw) {
  const s = String(pw || '');
  const letters = (s.match(/[A-Za-z]/g) || []).length;
  const digits = (s.match(/[0-9]/g) || []).length;
  const msgs = [];
  if (letters < 4) msgs.push(`アルファベットがあと${4 - letters}文字必要です`);
  if (digits < 4) msgs.push(`数字があと${4 - digits}文字必要です`);
  return msgs;
}

// ---- ハッシュ ----
function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randSalt() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return toHex(a.buffer);
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// SHA-256（secure context 以外や未対応環境では簡易ハッシュにフォールバック）
export async function hashWithSalt(text, salt) {
  const data = `${salt}:${text}`;
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
      return 'sha256$' + toHex(buf);
    }
  } catch (e) {
    /* フォールバックへ */
  }
  // フォールバック（FNV-1a 32bit を複数ラウンド）
  let h = 2166136261 >>> 0;
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < data.length; i++) {
      h ^= data.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
  }
  return 'fnv$' + h.toString(16);
}

// 認証レコードを作成
export async function makeAuthRecord({ email, password, question, answer }) {
  const salt = randSalt();
  const ansSalt = randSalt();
  const passHash = await hashWithSalt(password, salt);
  const ansHash = await hashWithSalt(normalizeAnswer(answer), ansSalt);
  return {
    email: String(email).trim(),
    salt,
    passHash,
    question: String(question || '').trim(),
    ansSalt,
    ansHash,
    updatedAt: Date.now(),
  };
}

// 秘密の質問の答えは大文字小文字・前後空白を無視して照合
export function normalizeAnswer(a) {
  return String(a || '').trim().toLowerCase();
}

export async function verifyPassword(auth, password) {
  if (!auth) return false;
  const h = await hashWithSalt(password, auth.salt);
  return h === auth.passHash;
}
export async function verifyAnswer(auth, answer) {
  if (!auth) return false;
  const h = await hashWithSalt(normalizeAnswer(answer), auth.ansSalt);
  return h === auth.ansHash;
}
export function emailMatches(auth, email) {
  if (!auth) return false;
  return String(email || '').trim().toLowerCase() === String(auth.email || '').toLowerCase();
}
