// Popup → content script 安全通訊
// 處理 "Receiving end does not exist" 錯誤（content script 尚未注入時）

async function safeSendMessage(tab, action) {
  try {
    await chrome.tabs.sendMessage(tab.id, { action });
  } catch (err) {
    if (err?.message?.includes('Receiving end does not exist')) {
      // 注入 content script 並重試一次
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
      await new Promise(r => setTimeout(r, 100)); // 等待 listener 掛載
      await chrome.tabs.sendMessage(tab.id, { action });
    } else {
      console.warn('[Extension] sendMessage failed:', err?.message);
    }
  }
}
