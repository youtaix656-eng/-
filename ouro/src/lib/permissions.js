// 権限・承認。
//
// 既定で社員が持つのは read と create だけ。
// 取り返しのつかない操作（送信・削除・公開・決済・重要データ変更）は
// **原則としてユーザー承認後に実行する**。
// 新しい道具を足すときは capabilities に宣言し、必要なら下の表に登録する。

export const PERMISSIONS = ['read', 'create', 'edit', 'send', 'delete', 'pay'];

export const DEFAULT_PERMISSIONS = { read: true, create: true, edit: false, send: false, delete: false, pay: false };

// ── 今月のAI費用の上限（新規）──
//
// 「毎回の確認を省く」を入れると承認が飛ぶが、**それでも上限だけは効かせる**。
// 上限に達したら自動承認を止めて確認へ戻すので、気づかないうちに増え続けない。
// 0 を入れると上限なし（自分で決めた人だけが外せる）。
export const DEFAULT_MONTHLY_CAP_USD = 5;

export function monthlyCap(settings = {}) {
  const v = Number(settings.monthlyCapUsd);
  return Number.isFinite(v) && v >= 0 ? v : DEFAULT_MONTHLY_CAP_USD;
}

export function overMonthlyCap(settings = {}, spentThisMonth = 0) {
  const cap = monthlyCap(settings);
  if (cap <= 0) return false; // 0 ＝ 上限なし
  return Number(spentThisMonth) >= cap;
}

/** その月の始まり（ミリ秒）。 */
export function monthStart(now = Date.now()) {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/** 'YYYY-MM'。月が変わったかを見るのに使う。 */
export function monthKey(now = Date.now()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 費用を積み上げた設定を返す（新規）。
 * 月が変わったら今月ぶんを0に戻す。合計は戻さない。
 */
export function addCost(settings = {}, usd = 0, now = Date.now()) {
  const amount = Number(usd) || 0;
  if (amount <= 0) return settings;
  const key = monthKey(now);
  const sameMonth = settings.costMonth === key;
  return {
    ...settings,
    costTotalUsd: (Number(settings.costTotalUsd) || 0) + amount,
    costMonth: key,
    costMonthUsd: (sameMonth ? Number(settings.costMonthUsd) || 0 : 0) + amount,
  };
}

/** 今月これまでに使った額（月が変わっていれば0）。 */
export function spentThisMonthOf(settings = {}, now = Date.now()) {
  return settings.costMonth === monthKey(now) ? Number(settings.costMonthUsd) || 0 : 0;
}

// 「この操作は必ず人間の承認を通す」表。risk は表示の強さに使う。
export const REQUIRE_APPROVAL = {
  send: { label: 'メール・メッセージの送信', risk: 'high' },
  delete: { label: 'データの削除', risk: 'high' },
  pay: { label: '購入・決済', risk: 'high' },
  publish: { label: '外部への公開', risk: 'high' },
  externalWrite: { label: '外部サービスへの書き込み', risk: 'medium' },
  costly: { label: 'コストのかかる実行', risk: 'low' },
};

/** 社員がその操作を持っているか。 */
export function hasPermission(employee, permission) {
  const p = employee.permissions || DEFAULT_PERMISSIONS;
  return Boolean(p[permission]);
}

/**
 * 実行してよいか判定する。
 * @returns {{allowed:boolean, needsApproval:boolean, reason:string, risk:string}}
 */
export function checkAction({ employee, action, settings = {}, spentThisMonth = 0 }) {
  const rule = REQUIRE_APPROVAL[action];

  if (!rule) {
    // 表に無い操作は権限だけで判定（read / create / edit）
    const ok = hasPermission(employee, action) || action === 'read';
    return {
      allowed: ok,
      needsApproval: false,
      reason: ok ? '' : `${employee.name} に「${action}」の権限がありません`,
      risk: 'none',
    };
  }

  // 権限そのものが無ければ承認以前に実行できない
  const permKey = action === 'publish' || action === 'externalWrite' ? 'edit' : action;
  if (PERMISSIONS.includes(permKey) && !hasPermission(employee, permKey)) {
    return {
      allowed: false,
      needsApproval: false,
      reason: `${employee.name} に「${rule.label}」の権限がありません`,
      risk: rule.risk,
    };
  }

  // コストのかかる実行だけは、設定で自動承認にできる（少額のため）。
  // ただし **今月の上限に近づいたら、自動承認でも必ず確認へ戻す**。
  // 自動承認を入れた瞬間に歯止めが無くなる状態を作らないため。
  if (action === 'costly' && settings.autoApproveCost) {
    if (overMonthlyCap(settings, spentThisMonth)) {
      return {
        allowed: true,
        needsApproval: true,
        reason: `今月のAI費用の上限（$${monthlyCap(settings)}）に達しています`,
        risk: 'high',
      };
    }
    return { allowed: true, needsApproval: false, reason: '設定で自動承認', risk: rule.risk };
  }

  return { allowed: true, needsApproval: true, reason: rule.label, risk: rule.risk };
}

/** 自動実行してよい社員か（autoRun ＋ 危険な権限を持たないこと）。 */
export function canAutoRun(employee) {
  if (!employee.autoRun) return false;
  return !['send', 'delete', 'pay'].some((p) => hasPermission(employee, p));
}

export function permissionLabel(p) {
  return (
    {
      read: '閲覧',
      create: '作成',
      edit: '編集',
      send: '送信',
      delete: '削除',
      pay: '支払い',
    }[p] || p
  );
}
