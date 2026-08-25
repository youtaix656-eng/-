// 権限・承認。
//
// 既定で社員が持つのは read と create だけ。
// 取り返しのつかない操作（送信・削除・公開・決済・重要データ変更）は
// **原則としてユーザー承認後に実行する**。
// 新しい道具を足すときは capabilities に宣言し、必要なら下の表に登録する。

export const PERMISSIONS = ['read', 'create', 'edit', 'send', 'delete', 'pay'];

export const DEFAULT_PERMISSIONS = { read: true, create: true, edit: false, send: false, delete: false, pay: false };

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
export function checkAction({ employee, action, settings = {} }) {
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

  // コストのかかる実行だけは、設定で自動承認にできる（少額のため）
  if (action === 'costly' && settings.autoApproveCost) {
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
