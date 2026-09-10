// 呼吸法・瞑想のガイド。
//
// ⚠ 効き目を言い切らない：「◯◯が治る」「自律神経が整う」とは書かない
//    （確かめる手立てをこのアプリは持たない）。書くのは「どう動かすか」と
//    「やめどき」まで。やめどきは、やり方より前に置く。

export interface BreathPhase {
  /** 画面に出す指示 */
  label: string;
  seconds: number;
  /** 円が広がる／縮む／止まる */
  motion: 'in' | 'out' | 'hold';
}

export interface Practice {
  id: string;
  title: string;
  reading: string;
  /** 1周のながれ。空なら数えない瞑想 */
  phases: BreathPhase[];
  summary: string;
  /** 向かない場合・止めどき（必ず持たせる） */
  stop: string;
}

export const PRACTICES: Practice[] = [
  {
    id: 'box',
    title: 'ボックス呼吸（4-4-4-4）',
    reading: 'ぼっくすこきゅう',
    phases: [
      { label: '吸う', seconds: 4, motion: 'in' },
      { label: '止める', seconds: 4, motion: 'hold' },
      { label: '吐く', seconds: 4, motion: 'out' },
      { label: '止める', seconds: 4, motion: 'hold' },
    ],
    summary: '4つとも同じ長さで区切る、いちばん覚えやすい形。数えることに意識が向くので、考えが回っているときに使いやすい。',
    stop: '息を止めるところで苦しくなったら、止めずに吸う・吐くだけにする。ふらつく・頭が痛むときはすぐにやめて、ふつうの呼吸に戻す。',
  },
  {
    id: 'long-exhale',
    title: '吐く息を長くする（4-8）',
    reading: 'はくいきをながくする',
    phases: [
      { label: '吸う', seconds: 4, motion: 'in' },
      { label: '吐く', seconds: 8, motion: 'out' },
    ],
    summary: '止めるところが無いので、いちばん負担が軽い。衝動が来ているときは、まずこれで十分。',
    stop: '無理に長く吐かない。苦しければ 4-6、4-5 と短くしてよい。',
  },
  {
    id: '478',
    title: '4-7-8',
    reading: 'よんななはち',
    phases: [
      { label: '吸う', seconds: 4, motion: 'in' },
      { label: '止める', seconds: 7, motion: 'hold' },
      { label: '吐く', seconds: 8, motion: 'out' },
    ],
    summary: '止める時間が長いぶん、慣れないうちは苦しい。まずは2〜4周だけにしておく。',
    stop: '止めるのがつらい人・息苦しさが出やすい人には向かない。回数を増やすことを目標にしない。',
  },
  {
    id: 'nadi',
    title: 'ナディショーダナ（片鼻呼吸）',
    reading: 'なでぃしょーだな',
    phases: [
      { label: '左から吸う（右の鼻をふさぐ）', seconds: 4, motion: 'in' },
      { label: '右から吐く（左の鼻をふさぐ）', seconds: 6, motion: 'out' },
      { label: '右から吸う（左の鼻をふさぐ）', seconds: 4, motion: 'in' },
      { label: '左から吐く（右の鼻をふさぐ）', seconds: 6, motion: 'out' },
    ],
    summary: '指で片方の鼻をふさぎながら、左右を交互に使う。手を動かすので、体のほうへ意識が戻りやすい。',
    stop: '鼻がつまっているときは無理にやらない（口呼吸で代用しない。別の呼吸法に替える）。',
  },
  {
    id: 'silent',
    title: '数えない（ただ座る）',
    reading: 'かぞえない',
    phases: [],
    summary: '呼吸を操作しない。入ってくる息と出ていく息を、直そうとせずに眺めるだけ。うまくできたかは判定しない。',
    stop: 'つらい記憶が出てきて苦しくなったら、目を開けて中断してよい。続けることより中断できることのほうが大事。',
  },
];

export function practiceById(id: string): Practice {
  return PRACTICES.find((p) => p.id === id) ?? PRACTICES[0];
}
