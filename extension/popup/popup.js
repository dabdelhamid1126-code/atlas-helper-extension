// Atlas Helper Popup - Main Logic

let currentOrder = null;
let syncHistory = [];
let atlasConfig = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadStats();
  await loadSyncHistory();
  await loadAtlasConfig();
  await checkCurrentTab();
  setupEventListeners();
});

async function loadStats() {
  try {
    const result = await chrome.storage.local.get(['syncHistory']);
    syncHistory = result.syncHistory || [];
    
    const totalOrders = syncHistory.length;
    const totalSpent = syncHistory.reduce((sum, order) => sum + (order.total || 0), 0);
    const uniqueStores = [...new Set(syncHistory.map(o => o.retailer))].length;
    
    document.getElementById('statOrders').textContent = totalOrders;
    document.getElementById('statSpent').textContent = formatCurrency(totalSpent);
    document.getElementById('statStores').textContent = uniqueStores;
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

async function loadSyncHistory() {
  try {
    const result = await chrome.storage.local.get(['syncHistory']);
    syncHistory = result.syncHistory || [];
    renderSyncHistory();
  } catch (error) {
    console.error('Error loading history:', error);
  }
}

function renderSyncHistory() {
  const container = document.getElementById('recentOrders');
  
  if (syncHistory.length === 0) {
    container.innerHTML = '<div class="empty-orders"><div class="empty-icon">📦</div>No orders yet. Visit an order page!</div>';
    return;
  }
  
  const recent = syncHistory.slice(-5).reverse();
  container.innerHTML = recent.map(order => `
    <div class="order-item">
      <div class="order-store-icon">${getStoreIcon(order.retailer)}</div>
      <div class="order-info">
        <div class="order-num">${order.orderNumber}</div>
        <div class="order-store-name">${order.retailer}</div>
      </div>
      <div class="order-price">${formatCurrency(order.total)}</div>
    </div>
  `).join('');
}

async function loadAtlasConfig() {
  try {
    const result = await chrome.storage.local.get(['atlasUrl', 'atlasToken']);
    atlasConfig = { url: result.atlasUrl, token: result.atlasToken };
    
    if (atlasConfig.url && atlasConfig.token) {
      document.getElementById('statusBadge').textContent = 'Connected';
      document.getElementById('statusBadge').className = 'status-badge status-connected';
      document.getElementById('atlasUrl').value = atlasConfig.url;
      document.getElementById('atlasToken').value = atlasConfig.token;
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
}

async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url) {
      setPageStatus('Idle', 'Unable to access this page');
      return;
    }
    
    const retailer = detectRetailer(tab.url);
    
    if (retailer) {
      setPageStatus(`${retailer} Order Page`, 'Click "Import Now" to import this order');
      showOrderBanner(retailer);
      
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeOrder' });
        if (response && response.success) {
          currentOrder = response.data;
          document.getElementById('orderBannerText').textContent = `Import ${retailer} order ${currentOrder.orderNumber}?`;
        }
      } catch (error) {
        console.log('Content script not available:', error);
      }
    } else {
      setPageStatus('Browse Mode', 'Visit an order page to import');
      hideOrderBanner();
    }
  } catch (error) {
    console.error('Error checking tab:', error);
    setPageStatus('Error', 'Could not access current tab');
  }
}

function detectRetailer(url) {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('amazon.com')) return 'Amazon';
  if (urlLower.includes('walmart.com')) return 'Walmart';
  if (urlLower.includes('target.com')) return 'Target';
  if (urlLower.includes('bestbuy.com')) return 'Best Buy';
  if (urlLower.includes('woot.com')) return 'Woot';
  if (urlLower.includes('ebay.com')) return 'eBay';
  if (urlLower.includes('costco.com')) return 'Costco';
  if (urlLower.includes('homedepot.com')) return 'Home Depot';
  if (urlLower.includes('newegg.com')) return 'Newegg';
  if (urlLower.includes('wayfair.com')) return 'Wayfair';
  if (urlLower.includes('etsy.com')) return 'Etsy';
  if (urlLower.includes('chewy.com')) return 'Chewy';
  return null;
}

function setPageStatus(status, hint) {
  document.getElementById('pageStatus').textContent = status;
  document.getElementById('pageHint').textContent = hint;
}

function showOrderBanner(retailer) {
  document.getElementById('orderBanner').classList.add('visible');
  document.getElementById('orderBanner').classList.remove('hidden');
}

function hideOrderBanner() {
  document.getElementById('orderBanner').classList.remove('visible');
  document.getElementById('orderBanner').classList.add('hidden');
}

function setupEventListeners() {
  document.getElementById('importNowBtn').addEventListener('click', handleImportNow);
  document.getElementById('dismissBtn').addEventListener('click', () => hideOrderBanner());
  document.getElementById('importByIdBtn').addEventListener('click', handleImportById);
  document.getElementById('exportBtn').addEventListener('click', handleExportCSV);
  document.getElementById('clearBtn').addEventListener('click', handleClearData);
  document.getElementById('openAtlasBtn').addEventListener('click', () => {
    if (atlasConfig?.url) chrome.tabs.create({ url: atlasConfig.url });
    else showStatus('Please connect to Atlas first', 'error');
  });
  document.getElementById('connectBtn').addEventListener('click', handleConnectAtlas);
}

async function handleImportNow() {
  if (!currentOrder) {
    showStatus('No order data available. Refresh the page.', 'error');
    return;
  }
  
  showStatus('Importing order...', 'loading');
  
  try {
    syncHistory.push({ ...currentOrder, importedAt: new Date().toISOString() });
    await chrome.storage.local.set({ syncHistory });
    
    if (atlasConfig?.url && atlasConfig?.token) {
      await sendToAtlas(currentOrder);
    }
    
    await loadStats();
    await loadSyncHistory();
    
    showStatus('✓ Order imported!', 'success');
    hideOrderBanner();
    
    chrome.runtime.sendMessage({ action: 'orderImported', order: currentOrder });
  } catch (error) {
    console.error('Import error:', error);
    showStatus('Import failed: ' + error.message, 'error');
  }
}

async function handleImportById() {
  const store = document.getElementById('storeSelect').value;
  const orderNumber = document.getElementById('orderInput').value.trim();
  
  if (!orderNumber) {
    showStatus('Please enter an order number', 'error');
    return;
  }
  
  showStatus('Importing ' + store + ' order...', 'loading');
  
  try {
    const mockOrder = { orderNumber, retailer: store, orderDate: new Date().toISOString(), total: 0, items: [] };
    syncHistory.push({ ...mockOrder, importedAt: new Date().toISOString() });
    await chrome.storage.local.set({ syncHistory });
    await loadStats();
    await loadSyncHistory();
    
    showStatus('✓ Order imported!', 'success');
    document.getElementById('orderInput').value = '';
  } catch (error) {
    showStatus('Import failed: ' + error.message, 'error');
  }
}

function handleExportCSV() {
  if (syncHistory.length === 0) {
    showStatus('No orders to export', 'error');
    return;
  }
  
  const headers = ['Order Number', 'Retailer', 'Date', 'Total', 'Items'];
  const rows = syncHistory.map(order => [
    order.orderNumber,
    order.retailer,
    new Date(order.orderDate).toLocaleDateString(),
    order.total.toFixed(2),
    order.items?.length || 0
  ]);
  
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'atlas-orders-export.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showStatus('✓ Exported ' + syncHistory.length + ' orders', 'success');
}

function handleClearData() {
  if (!confirm('Clear all imported orders?')) return;
  
  chrome.storage.local.set({ syncHistory: [] });
  syncHistory = [];
  loadStats();
  loadSyncHistory();
  showStatus('✓ All data cleared', 'success');
}

async function handleConnectAtlas() {
  const url = document.getElementById('atlasUrl').value.trim();
  const token = document.getElementById('atlasToken').value.trim();
  
  if (!url || !token) {
    showStatus('Please enter both URL and token', 'error');
    return;
  }
  
  showStatus('Connecting to Atlas...', 'loading');
  
  try {
    await chrome.storage.local.set({ atlasUrl: url, atlasToken: token });
    atlasConfig = { url, token };
    
    document.getElementById('statusBadge').textContent = 'Connected';
    document.getElementById('statusBadge').className = 'status-badge status-connected';
    
    showStatus('✓ Connected to Atlas!', 'success');
  } catch (error) {
    showStatus('Connection failed: ' + error.message, 'error');
  }
}

async function sendToAtlas(order) {
  if (!atlasConfig?.url || !atlasConfig?.token) return;
  
  const response = await fetch(`${atlasConfig.url}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${atlasConfig.token}`
    },
    body: JSON.stringify(order)
  });
  
  if (!response.ok) throw new Error('Atlas API error: ' + response.status);
  return await response.json();
}

function showStatus(message, type = 'loading') {
  const el = document.getElementById('statusMsg');
  el.textContent = message;
  el.className = `status-msg visible status-${type}`;
  setTimeout(() => el.classList.remove('visible'), 5000);
}

function formatCurrency(amount) {
  return '$' + amount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

function getStoreIcon(store) {
  const icons = {
    'Amazon': '📦', 'Walmart': '🛒', 'Target': '🎯', 'Best Buy': '💻',
    'Woot': '💸', 'eBay': '🔨', 'Costco': '🏢', 'Home Depot': '🔧',
    'Newegg': '💾', 'Wayfair': '🛋️', 'Etsy': '🎨', 'Chewy': '🐾'
  };
  return icons[store] || '🏪';
}
