(function() {
  'use strict';
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scrapeOrder') {
      try {
        const orderData = extractAmazonOrderData();
        sendResponse({ success: true, data: orderData });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }
  });
  
  function extractAmazonOrderData() {
    if (!window.location.href.includes('/gp/your-orders/order-details')) {
      throw new Error('Not on Amazon order page');
    }
    
    const orderNumberMatch = window.location.href.match(/orderID=([^&]+)/) ||
                             document.querySelector('.your-order-id')?.textContent?.match(/#(\d{3}-\d{7}-\d{7})/);
    const orderNumber = orderNumberMatch?.[1] || 'Unknown';
    
    const orderDateElement = document.querySelector('.od-order-date .od-order-date-data');
    const orderDate = orderDateElement?.textContent?.trim() || new Date().toISOString();
    
    const items = [];
    const itemElements = document.querySelectorAll('.od-item-view');
    itemElements.forEach(item => {
      const name = item.querySelector('.od-item-title-link')?.textContent?.trim();
      const qty = parseInt(item.querySelector('.od-item-qty')?.textContent?.match(/\d+/)?.[0]) || 1;
      const price = parseCurrency(item.querySelector('.od-item-price')?.textContent);
      if (name) items.push({ name, quantity: qty, price });
    });
    
    const totalElement = document.querySelector('.od-subtotal .od-value') ||
                        document.querySelector('.od-order-total .od-value');
    const total = parseCurrency(totalElement?.textContent);
    
    return { orderNumber, orderDate: parseDate(orderDate), retailer: 'Amazon', items, total, url: window.location.href };
  }
  
  function parseCurrency(text) {
    if (!text) return 0;
    const match = text.match(/\$?([\d,]+\.?\d*)/);
    return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
  }
  
  function parseDate(dateStr) {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }
})();
