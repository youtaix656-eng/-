// バックアップのファイルを読む。先頭の BOM や、メモ帳などで付いた余計な空白があっても読めるようにする。
export function parseBackupText(text) {
  const t = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!t) throw new Error('ファイルが空です');
  let data;
  try {
    data = JSON.parse(t);
  } catch (e) {
    throw new Error('バックアップのファイルではないようです（中身を読み取れませんでした）');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('バックアップのファイルではないようです');
  }
  const known = ['srs', 'history', 'questions', 'settings', 'memos'];
  if (!known.some((k) => k in data)) {
    throw new Error('このアプリのバックアップではないようです');
  }
  return data;
}

