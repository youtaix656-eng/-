// 席（役職 × ジャンル の中の通し番号）を数えるだけの小さな道具。
//
// 新項目04：ここを seed.js から切り出したのは、社員一覧・目次・ジャンル画面が
// 「席を数える」ためだけに seed.js（＝初期データの組み立て一式）を
// 起動時に読み込んでいたため。数えるのに初期データは要らない。

import { DEFAULT_GENRE_ID, DEFAULT_SEATS_PER_GENRE } from '../data/genres.js';

/** 「1つの組（役職×ジャンル）に3席」の初期値。定数ではない（増席できる）。 */
export const DEFAULT_SEATS_PER_ROLE = DEFAULT_SEATS_PER_GENRE;

/**
 * 新しく席を増やすときの席番号。**組（役職×ジャンル）の中で**空いている番号を返す。
 * 役職だけで数えると、別ジャンルの席が埋まっているせいで番号が飛んでしまう。
 */
export function nextSeat(employees, roleId, genreId = DEFAULT_GENRE_ID) {
  const used = employees
    .filter((e) => e.roleId === roleId && (e.genreId || DEFAULT_GENRE_ID) === genreId && !e.archivedAt)
    .map((e) => e.seat || 1);
  let seat = 1;
  while (used.includes(seat)) seat += 1;
  return seat;
}

/** その組（役職×ジャンル）に在籍している社員（席順）。 */
export function seatsOf(employees, roleId, genreId = DEFAULT_GENRE_ID) {
  return employees
    .filter((e) => e.roleId === roleId && (e.genreId || DEFAULT_GENRE_ID) === genreId && !e.archivedAt)
    .sort((a, b) => (a.seat || 1) - (b.seat || 1));
}

/** その組がいっぱいか（既定の3席まで埋まっているか）。 */
export function isGenreFull(employees, roleId, genreId, seatsPerGenre = DEFAULT_SEATS_PER_GENRE) {
  return seatsOf(employees, roleId, genreId).length >= seatsPerGenre;
}
