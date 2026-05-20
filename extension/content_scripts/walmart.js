(function() {
  'use strict';
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scrapeOrder') {
      try {
        const orderData = extractWalmartOrderData();
        sendResponse({ success: true, data: orderData });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }
  });
  
  function extractWalmartOrderData() {
    if (!window.location.href.includes('/account/order-details')) {
      throw new Error('Not on Walmart order page');
    }
    
    const orderNumber = document.querySelector('[data-automation="order-number"]')?.textContent?.trim() || 'Unknown';
    const orderDate = document.querySelector('[data-automation="order-date"]')?.textContent?.trim() || new Date().toISOString();
    const items = [];
    document.querySelectorAll('[data-automation="item-row"]').forEach(item => {
      const name = item.querySelector('[data-automation="item-name"]')?.textContent?.trim();
      const qty = parseInt(item.querySelector('[data-automation="item-qty"]')?.textContent) || 1;
      const price = parseCurrency(item.querySelector('[data-automation="item-price"]')?.textContent);
      if (name) items.push({ name, quantity: qty, price });
    });
    const total = parseCurrency(document.querySelector('[data-automation="order-total"]')?.textContent);
    
    return { orderNumber, orderDate: parseDate(orderDate), retailer: 'Walmart', items, total, url: window.location.href };
  }
  
  function parseCurrency(text) { return text ? parseFloat(text.replace(/[^0-9.]/g, '')) || 0 : 0; }
  function parseDate(dateStr) { const date = new Date(dateStr); return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(); }
})();
