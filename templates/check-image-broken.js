// 圖片失效偵測 — 三步驟完整實作
// 避免 naturalWidth===0 的假陰性（伺服器回 200 但內容為 HTML 錯誤頁）

async function checkImageBroken(img) {
  // 1. 使用 getAttribute，不用 img.src
  //    img.src 會把空字串自動解析為當前頁面 URL → 造成假陰性
  const rawAttr = img.getAttribute('src');
  if (!rawAttr || rawAttr.trim() === '') return true;
  if (rawAttr.startsWith('data:')) return !(img.complete && img.naturalWidth > 0);

  // 2. 快速路徑：已載入並解碼完成
  if (img.complete && img.naturalWidth > 0) return false;

  // 3. Fetch 驗證 — 檢查 Content-Type，而非只看 status code
  try {
    let res = await fetch(img.src, { method: 'HEAD', cache: 'no-store' });
    // 部分伺服器對 HEAD 回 405；改用帶 Range 的 GET
    if (res.status === 405 || res.status === 501) {
      res = await fetch(img.src, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        cache: 'no-store',
      });
    }
    if (!res.ok && res.status !== 206) return true;
    // 伺服器可能回 200 + HTML 錯誤頁 — 確認 Content-Type 確實是圖片
    const ct = res.headers.get('content-type') ?? '';
    if (ct && !ct.toLowerCase().split(';')[0].trim().startsWith('image/')) return true;
    return !(img.complete && img.naturalWidth > 0);
  } catch {
    return true; // 網路錯誤 = 圖片失效
  }
}
