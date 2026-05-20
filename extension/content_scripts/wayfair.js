(function() {
  'use strict';
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scrapeOrder') {
      try {
        const orderData = extractWayfairOrderData();
        sendResponse({ success: true, data: orderData });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }
  });
  
  function extractWayfairOrderData() {
    if (!window.location.href.includes('wayfair.com/v/orders')) {
      throw new Error('Not on Wayfair order page');
    }
    
    const orderNumber = document.querySelector('.order-number')?.textContent?.trim() || 'Unknown';
    const orderDate = document.querySelector('.order-date')?.textContent?.trim() || new Date().toISOString();
    const items = [];
    document.querySelectorAll('.order-item').forEach(item => {
      const name = item.querySelector('.item-name')?.textContent?.trim();
      const qty = parseInt(item.querySelector('.item-qty')?.textContent) || 1;
      const price = parseCurrency(item.querySelector('.item-price')?.textContent);
      if (name) items.push({ name, quantity: qty, price });
    });
    const total = parseCurrency(document.querySelector('.order-total')?.textContent);
    
    return { orderNumber, orderDate: parseDate(orderDate), retailer: 'Wayfair', items, total, url: window.location.href };
  }
  
  function parseCurrency(text) { return text ? parseFloat(text.replace(/[^0-9.]/g, '')) || 0 : 0; }
  function parseDate(dateStr) { const date = new Date(dateStr); return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(); }
})();
