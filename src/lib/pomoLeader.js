// 複数タブでポモドーロを同時に開いていた時の「幹事タブ」判定（純粋ロジック・単体テスト可能）。
//
// 背景：フェーズ終了の検知（advanceState）と、それに伴う統計記録（appendPomoLog）・
// 通知・効果音は、これまで各タブが独立したsetIntervalで判定していた。同じアプリを
// 2つのタブで開いて両方とも実行中だと、どちらも同時に「フェーズが終わった」と検知し、
// 勉強時間の統計が2重に記録されたり、通知・効果音が2回ずつ鳴ったりしてしまう。
//
// これを避けるため、タブどうしがBroadcastChannelで短い間隔（HELLO_INTERVAL_MS）ごとに
// 「生きています」と知らせ合い（hello）、生存しているタブの中から1つだけを「幹事」に選ぶ。
// 幹事だけがフェーズ終了時の統計記録・通知・保存を行い、それ以外のタブは幹事からの
// 状態共有（broadcastされるstateメッセージ）を受け取って表示を合わせるだけにする。
//
// 選び方：画面が見えている（visible）タブがいれば、その中から最小のtabId。
// 誰も見えていなければ、生きている全タブの中から最小のtabId（背面のタブしかない状況でも
// 誰かが必ず処理を続けられるようにするため）。単一タブしかない場合は常に自分が幹事になる。

export const STALE_MS = 9000; // このミリ秒より前のhelloは「もういない」とみなす

export function makeTabId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// peers: Map<tabId, { at: number, visible: boolean }>
export function pruneStalePeers(peers, now, staleMs = STALE_MS) {
  const next = new Map();
  for (const [id, info] of peers) {
    if (info && now - info.at <= staleMs) next.set(id, info);
  }
  return next;
}

export function computeLeaderId(peers) {
  const visibleIds = [];
  const allIds = [];
  for (const [id, info] of peers) {
    allIds.push(id);
    if (info && info.visible) visibleIds.push(id);
  }
  const pool = visibleIds.length > 0 ? visibleIds : allIds;
  if (pool.length === 0) return null;
  return pool.slice().sort()[0];
}

export function isLeader(peers, selfId, now, staleMs = STALE_MS) {
  const pruned = pruneStalePeers(peers, now, staleMs);
  return computeLeaderId(pruned) === selfId;
}
