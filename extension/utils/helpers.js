// Atlas Helper - Shared Utilities

export function formatCurrency(amount) {
  return '$' + amount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

export function parseCurrency(text) {
  if (!text) return 0;
  const match = text.match(/\$?([\d,]+\.?\d*)/);
  return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
}

export function parseDate(dateStr) {
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function getStoreIcon(store) {
  const icons = {
    'Amazon': '📦', 'Walmart': '🛒', 'Target': '🎯', 'Best Buy': '💻',
    'Woot': '💸', 'eBay': '🔨', 'Costco': '🏢', 'Home Depot': '🔧',
    'Newegg': '💾', 'Wayfair': '🛋️', 'Etsy': '🎨', 'Chewy': '🐾'
  };
  return icons[store] || '🏪';
}
