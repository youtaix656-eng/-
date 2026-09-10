// オフィスの様子——**録画ではなく、いまの状態から毎回描く。**
//
// 「AI社員が働いている映像」を持つと、実際には誰も動いていない時でも
// 動いて見えてしまう（いちばん質の悪い嘘になる）。だからここは
// **`lib/presence.js` が返す本物の在席だけ**を席と動きに変える。
// 動いて見える社員は、本当にその人の手順が走っている社員だけ。
//
// 決まりごと：
//  ・**AIを呼ばない・通信しない。** 仕事から導いた在席を並べるだけ（費用ゼロ）。
//  ・**画像・動画ファイルを持たない**（肖像と同じ線。その場でSVGを描く）。
//  ・**乱数を使わない。** 席の位置も揺れの位相も社員の id から決める——
//    乱数だと描き直すたびに全員が飛び跳ねて、動きが意味を持たなくなる。
//  ・**動きに意味を持たせる。** 状態ごとに違う動きにして、
//    「動いている＝AIが動いている」が画面のまま読めるようにする。
//  ・**時計を持たない。** 経過時間は呼ぶ側が渡す（テストで固定できるように）。

import { PRESENCE_STATES, presenceState } from './presence.js';

/** 1席ぶんの大きさ（SVGの座標系）。CSS ではなくここが単一の正。 */
export const SEAT_W = 96;
export const SEAT_H = 84;
/** 島（デスクのかたまり）の1列に並べる席数。 */
export const PER_ROW = 3;
/** 描く席の上限（多すぎると1画面で読めなくなる）。 */
export const MAX_SEATS = 60;

/**
 * 状態ごとの見え方。
 *  motion … CSS のアニメーション名に使う（`office-<motion>`）
 *  moving … 実際に手が動いているか。**ここが false のものを動かさない。**
 */
export const SEAT_LOOKS = {
  running: { motion: 'type', moving: true, label: '手を動かしています' },
  queued: { motion: 'wait', moving: false, label: '自分の番を待っています' },
  waiting: { motion: 'look', moving: false, label: 'あなたを待っています' },
  held: { motion: 'still', moving: false, label: '止めてあります' },
  stopped: { motion: 'still', moving: false, label: '途中で止まりました' },
  idle: { motion: 'breathe', moving: false, label: '手あきです' },
};

export function seatLook(state) {
  return SEAT_LOOKS[state] || SEAT_LOOKS.idle;
}

/** 社員 id から決まる 0〜1 の値（**乱数を使わない**ので、描き直しても同じ）。 */
export function phaseOf(id) {
  const s = String(id || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return (h % 1000) / 1000;
}

/**
 * オフィスの間取り。チームごとの島にして、島の中を席順に並べる。
 * @param {{employee:object, state:string, note:string, task:object|null}[]} rows buildPresence の結果
 * @param {object[]} groups ROLE_GROUPS（id・name）
 * @param {(roleId:string)=>string} groupOf 役職 → チーム
 * @returns {{islands:{id,name,seats:{...}[] ,cols:number,rows:number}[], counted:number, hidden:number}}
 */
export function officeLayout(rows = [], groups = [], groupOf = () => 'knowledge') {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r && r.employee);
  const shown = list.slice(0, MAX_SEATS);
  const byGroup = new Map(groups.map((g) => [g.id, []]));
  const other = [];
  for (const r of shown) {
    const gid = groupOf(r.employee.roleId);
    if (byGroup.has(gid)) byGroup.get(gid).push(r);
    else other.push(r);
  }

  const islands = [];
  const push = (id, name, members) => {
    if (!members.length) return;
    const cols = Math.min(PER_ROW, members.length);
    islands.push({
      id,
      name,
      cols,
      rows: Math.ceil(members.length / cols),
      seats: members.map((r, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const look = seatLook(r.state);
        return {
          id: r.employee.id,
          employee: r.employee,
          state: r.state,
          note: r.note || '',
          task: r.task || null,
          col,
          row,
          x: col * SEAT_W,
          y: row * SEAT_H,
          // 席の向き。島の中で向かい合わせにする（奇数列は反対を向く）
          facing: row % 2 === 0 ? 'down' : 'up',
          motion: look.motion,
          moving: look.moving,
          phase: phaseOf(r.employee.id),
        };
      }),
    });
  };
  for (const g of groups) push(g.id, g.name, byGroup.get(g.id) || []);
  push('other', 'そのほか', other);

  return { islands, counted: shown.length, hidden: Math.max(0, list.length - shown.length) };
}

/** 画面に出す1行。**動いている人がいない時に黙らない。** */
export function officeLine(rows = [], hydrated = true) {
  if (!hydrated) return '読み込み中です…';
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return 'まだ社員がいません。雇うと席に着きます。';
  const moving = list.filter((r) => seatLook(r.state).moving).length;
  if (moving === 0) {
    return `${list.length}人が席にいますが、いまAIが動いている人はいません`
      + '（この画面は録画ではないので、動いていない時は動きません）。';
  }
  return `${list.length}人のうち ${moving}人 がいま手を動かしています。`;
}

/** 状態ごとの人数を、並び順どおりに返す（画面の凡例に使う）。 */
export function officeLegend(rows = []) {
  const counts = {};
  for (const r of Array.isArray(rows) ? rows : []) counts[r.state] = (counts[r.state] || 0) + 1;
  return PRESENCE_STATES.map((s) => ({
    id: s.id,
    name: s.name,
    glyph: s.glyph,
    count: counts[s.id] || 0,
    moving: seatLook(s.id).moving,
  }));
}

/**
 * 席の下に出す1行（誰が何をしているか）。
 * **推測を書かない**——動いていない人に作業内容を書かない。
 */
export function seatCaption(seat) {
  if (!seat) return '';
  const look = seatLook(seat.state);
  if (seat.state === 'running' && seat.note) return seat.note;
  return look.label;
}

/**
 * 時計の針。**経過時間は呼ぶ側が渡す**（ここで Date.now() を読まない）。
 * 動いている手順の開始時刻から「何秒動いているか」を出すだけ。
 */
export function runningSeconds(seat, now = 0) {
  if (!seat || !seat.moving || !seat.task) return null;
  const step = (seat.task.steps || []).flat(2)
    .find((s) => s && s.employeeId === seat.id && s.status === 'running');
  const at = step && step.startedAt;
  if (!at || !now || now < at) return null;
  return Math.floor((now - at) / 1000);
}

export { presenceState };
