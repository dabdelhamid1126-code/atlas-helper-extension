// Atlas Helper - Background Service Worker

let syncHistory = [];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received:', request);
  
  if (request.action === 'scrapeOrder') {
    chrome.tabs.sendMessage(sender.tab.id, request)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'orderImported') {
    syncHistory.push({
      ...request.order,
      importedAt: new Date().toISOString()
    });
    chrome.storage.local.set({ syncHistory }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'getSyncHistory') {
    chrome.storage.local.get(['syncHistory'])
      .then(result => sendResponse({ history: result.syncHistory || [] }));
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ syncHistory: [] });
});
