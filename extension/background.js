// Atlas Helper - Background Service Worker
let syncHistory = [];
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrapeOrder') {
    chrome.tabs.sendMessage(sender.tab.id, request)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  return true;
});