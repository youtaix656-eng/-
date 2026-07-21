// 画像ファイル（カメラ撮影・写真）を、端末内保存に適したサイズへ縮小して
// data URI（JPEG）に変換する。IndexedDB の肥大化を防ぐため長辺を制限する。

const DEFAULT_MAX_DIM = 1280;
const DEFAULT_QUALITY = 0.72;

export function isImageFile(file) {
  return !!file && /^image\//.test(file.type || '');
}

// File → 縮小済み JPEG の data URI
export async function fileToDataUrl(file, maxDim = DEFAULT_MAX_DIM, quality = DEFAULT_QUALITY) {
  if (!isImageFile(file)) throw new Error('画像ファイルではありません');

  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    r.readAsDataURL(file);
  });

  // 画像を読み込んでサイズを確認
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('画像を開けませんでした'));
    i.src = dataUrl;
  });

  const { width, height } = img;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  // 縮小不要でキャンバスが使えない環境なら、元の data URI をそのまま返す
  if (scale >= 1 && !/^data:image\/(heic|heif)/i.test(dataUrl)) {
    // 大きすぎない場合はそのまま（ただし極端に大きいものは再エンコード）
    if (dataUrl.length < 900 * 1024) return dataUrl;
  }

  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  try {
    return canvas.toDataURL('image/jpeg', quality);
  } catch (e) {
    return dataUrl;
  }
}
