import { useState } from 'react';
import {
  validateEmail,
  validatePassword,
  passwordProblems,
  makeAuthRecord,
  verifyPassword,
  verifyAnswer,
  emailMatches,
  hashWithSalt,
  randSalt,
} from '../lib/auth.js';

// アプリのログイン画面（端末内ロック）。
// mode='setup'：初回設定（ID＝メール, パスワード, 秘密の質問）。スキップ可。
// mode='login'：ログイン。パスワードを忘れたら秘密の質問で再設定。
export default function AuthGate({ mode, auth, onSetAuth, onUnlock, onSkip }) {
  const isSetup = mode === 'setup';
  const [view, setView] = useState(isSetup ? 'setup' : 'login'); // setup | login | forgot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // setup fields
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  // login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPw, setLoginPw] = useState('');

  // forgot fields
  const [forgotAns, setForgotAns] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');

  const pwProblems = passwordProblems(pw);

  const doSetup = async () => {
    setError('');
    if (!validateEmail(email)) return setError('メールアドレスの形式が正しくありません。');
    if (!validatePassword(pw)) return setError('パスワードは' + pwProblems.join('、') + '。');
    if (pw !== pw2) return setError('確認用パスワードが一致しません。');
    if (!question.trim()) return setError('秘密の質問を入力してください。');
    if (!answer.trim()) return setError('秘密の質問の答えを入力してください。');
    setBusy(true);
    const record = await makeAuthRecord({ email, password: pw, question, answer });
    onSetAuth(record);
    setBusy(false);
    onUnlock();
  };

  const doLogin = async () => {
    setError('');
    if (!emailMatches(auth, loginEmail)) return setError('メールアドレスが違います。');
    setBusy(true);
    const ok = await verifyPassword(auth, loginPw);
    setBusy(false);
    if (!ok) return setError('パスワードが違います。');
    onUnlock();
  };

  const doReset = async () => {
    setError('');
    setBusy(true);
    const ok = await verifyAnswer(auth, forgotAns);
    if (!ok) {
      setBusy(false);
      return setError('秘密の質問の答えが違います。');
    }
    if (!validatePassword(newPw)) {
      setBusy(false);
      return setError('新しいパスワードは' + passwordProblems(newPw).join('、') + '。');
    }
    if (newPw !== newPw2) {
      setBusy(false);
      return setError('確認用パスワードが一致しません。');
    }
    const salt = randSalt();
    const passHash = await hashWithSalt(newPw, salt);
    onSetAuth({ ...auth, salt, passHash, updatedAt: Date.now() });
    setBusy(false);
    onUnlock();
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">🩺</div>
        <h1 className="auth-title">鍼灸国試 対策アプリ</h1>

        {view === 'setup' && (
          <>
            <p className="auth-sub">ログイン情報を設定します（この端末の中だけに保存され、外部には送信されません）。</p>
            <label className="auth-field">
              <span>ログインID（メールアドレス）</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="username" />
            </label>
            <label className="auth-field">
              <span>パスワード（アルファベット4文字以上＋数字4文字以上）</span>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="例）study2024" autoComplete="new-password" />
              {pw && pwProblems.length > 0 && <small className="auth-hint bad">{pwProblems.join('、')}</small>}
              {pw && pwProblems.length === 0 && <small className="auth-hint ok">OK：条件を満たしています</small>}
            </label>
            <label className="auth-field">
              <span>パスワード（確認）</span>
              <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
            </label>
            <label className="auth-field">
              <span>秘密の質問（パスワードを忘れたとき用）</span>
              <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="例）初めて飼ったペットの名前は？" />
            </label>
            <label className="auth-field">
              <span>秘密の質問の答え</span>
              <input type="text" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="答え（大文字小文字は区別しません）" />
            </label>
            {error && <div className="auth-error">{error}</div>}
            <button className="btn primary block lg" onClick={doSetup} disabled={busy}>
              設定して始める
            </button>
            <button className="btn ghost block" style={{ marginTop: 8 }} onClick={onSkip} disabled={busy}>
              あとで設定する（スキップ）
            </button>
            <p className="auth-note">
              ※ サーバー認証ではなく端末内のロックです。ブラウザのデータを消すと解除できなくなる場合があります。バックアップの保存をおすすめします。
            </p>
          </>
        )}

        {view === 'login' && (
          <>
            <p className="auth-sub">ログインしてください。</p>
            <label className="auth-field">
              <span>ログインID（メールアドレス）</span>
              <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="you@example.com" autoComplete="username"
                onKeyDown={(e) => e.key === 'Enter' && doLogin()} />
            </label>
            <label className="auth-field">
              <span>パスワード</span>
              <input type="password" value={loginPw} onChange={(e) => setLoginPw(e.target.value)} autoComplete="current-password"
                onKeyDown={(e) => e.key === 'Enter' && doLogin()} />
            </label>
            {error && <div className="auth-error">{error}</div>}
            <button className="btn primary block lg" onClick={doLogin} disabled={busy}>ログイン</button>
            <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => { setError(''); setView('forgot'); }} disabled={busy}>
              パスワードを忘れた
            </button>
          </>
        )}

        {view === 'forgot' && (
          <>
            <p className="auth-sub">秘密の質問に答えて、新しいパスワードを設定します。</p>
            <div className="auth-question">❓ {auth?.question || '（設定された質問）'}</div>
            <label className="auth-field">
              <span>答え</span>
              <input type="text" value={forgotAns} onChange={(e) => setForgotAns(e.target.value)} />
            </label>
            <label className="auth-field">
              <span>新しいパスワード（アルファベット4＋数字4以上）</span>
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
            </label>
            <label className="auth-field">
              <span>新しいパスワード（確認）</span>
              <input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} autoComplete="new-password" />
            </label>
            {error && <div className="auth-error">{error}</div>}
            <button className="btn primary block lg" onClick={doReset} disabled={busy}>パスワードを再設定してログイン</button>
            <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => { setError(''); setView('login'); }} disabled={busy}>
              戻る
            </button>
          </>
        )}
      </div>
    </div>
  );
}
