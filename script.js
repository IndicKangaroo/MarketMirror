import { db } from './firebase-config.js';
import { collection, query, where, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Chart.js instance (global)
let priceChart = null;

// Initialize Chart.js
function initChart() {
  const ctx = document.querySelector('.chart-placeholder');
  
  // Remove placeholder text
  ctx.innerHTML = '<canvas id="priceChart"></canvas>';
  
  const canvas = document.getElementById('priceChart');
  
  priceChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Price (₹ per kg)',
        data: [],
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#4CAF50',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            font: { size: 14 },
            color: '#2d5016'
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(45, 80, 22, 0.9)',
          padding: 12,
          titleFont: { size: 14 },
          bodyFont: { size: 13 },
          callbacks: {
            label: function(context) {
              return `Price: ₹${context.parsed.y} per kg`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { size: 12 },
            color: '#666'
          }
        },
        y: {
          beginAtZero: false,
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          ticks: {
            font: { size: 12 },
            color: '#666',
            callback: function(value) {
              return '₹' + value;
            }
          }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    }
  });
}

// Fetch market data from Firestore
async function fetchMarketData(filters) {
  try {
    // Show loading state
    showLoading(true);
    
    // Build query
    let q = collection(db, "market_prices");
    const conditions = [];
    
    if (filters.commodity && filters.commodity !== "") {
      conditions.push(where("commodity", "==", filters.commodity));
    }
    
    if (filters.state && filters.state !== "") {
      conditions.push(where("state", "==", filters.state));
    }
    
    if (filters.district && filters.district !== "") {
      conditions.push(where("district", "==", filters.district));
    }
    
    if (filters.market && filters.market !== "") {
      conditions.push(where("market", "==", filters.market));
    }
    
    if (filters.dateFrom && filters.dateFrom !== "") {
      conditions.push(where("date", ">=", filters.dateFrom));
    }
    
    // Apply conditions and ordering
    if (conditions.length > 0) {
      q = query(q, ...conditions, orderBy("date", "asc"));
    } else {
      q = query(q, orderBy("date", "asc"));
    }
    
    // Execute query
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      showNoData();
      return;
    }
    
    // Extract and process data
    const data = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log('Fetched data:', data);
    
    // Update chart
    updateChart(data, filters);
    
    // Calculate and display insight
    calculateInsight(data, filters);
    
    showLoading(false);
    
  } catch (error) {
    console.error("Error fetching market data:", error);
    showError(error.message);
    showLoading(false);
  }
}

// Update Chart.js with new data
function updateChart(data, filters) {
  if (!priceChart) {
    initChart();
  }
  
  // Sort by date
  data.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Apply price sorting if needed
  const priceSort = filters.priceSort;
  
  // Format data for chart
  const labels = data.map(item => {
    const date = new Date(item.date);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  });
  
  const prices = data.map(item => item.pricePerKg || item.avgPrice || 0);
  
  // Update chart data
  priceChart.data.labels = labels;
  priceChart.data.datasets[0].data = prices;
  
  // Update chart label
  const commodity = filters.commodity || 'Market';
  const location = filters.state || filters.district || 'All Regions';
  priceChart.data.datasets[0].label = `${commodity} - ${location} (₹ per kg)`;
  
  // Refresh chart
  priceChart.update();
}

// Calculate and display insight
function calculateInsight(data, filters) {
  const insightElement = document.querySelector('.chart-info p');
  
  if (data.length < 2) {
    insightElement.innerHTML = '<strong>Insight:</strong> Insufficient data for trend analysis.';
    return;
  }
  
  // Get latest and 7 days ago prices
  const latestPrice = data[data.length - 1].pricePerKg || data[data.length - 1].avgPrice;
  const sevenDaysAgo = data.length >= 7 ? data[data.length - 7].pricePerKg || data[data.length - 7].avgPrice : data[0].pricePerKg || data[0].avgPrice;
  
  const priceChange = latestPrice - sevenDaysAgo;
  const percentChange = ((priceChange / sevenDaysAgo) * 100).toFixed(1);
  
  const direction = priceChange > 0 ? 'increased' : 'decreased';
  const absPercent = Math.abs(percentChange);
  
  const commodity = filters.commodity || 'Prices';
  const region = filters.state || 'the region';
  
  insightElement.innerHTML = `<strong>Insight:</strong> ${commodity} prices have ${direction} by ${absPercent}% this week in ${region}.`;
}

// Show loading state
function showLoading(isLoading) {
  const placeholder = document.querySelector('.chart-placeholder');
  
  if (isLoading) {
    placeholder.innerHTML = '<p style="text-align: center; padding: 100px; color: #4CAF50;">Loading market data...</p>';
  }
}

// Show no data message
function showNoData() {
  const placeholder = document.querySelector('.chart-placeholder');
  placeholder.innerHTML = '<p style="text-align: center; padding: 100px; color: #666;">No data available for selected filters. Please adjust your search criteria.</p>';
  
  const insightElement = document.querySelector('.chart-info p');
  insightElement.innerHTML = '<strong>Insight:</strong> No data to display.';
}

// Show error message
function showError(message) {
  const placeholder = document.querySelector('.chart-placeholder');
  placeholder.innerHTML = `<p style="text-align: center; padding: 100px; color: #d32f2f;">Error loading data: ${message}</p>`;
}

// Get filter values from HTML
function getFilterValues() {
  return {
    commodity: document.getElementById('commodity').value,
    state: document.getElementById('state').value,
    district: document.getElementById('district').value,
    market: document.getElementById('market').value,
    dateFrom: document.getElementById('dateFrom').value,
    priceSort: document.getElementById('price').value
  };
}

// Initialize app
function init() {
  console.log('MarketMirror Dashboard initialized');
  
  // Initialize empty chart
  initChart();
  
  // Load default data (last 30 days, all commodities)
  const defaultFilters = {
    commodity: '',
    state: '',
    district: '',
    market: '',
    dateFrom: '',
    priceSort: ''
  };
  
  // Fetch initial data
  fetchMarketData(defaultFilters);
  
  // Add event listener to GO button
  const goButton = document.querySelector('.filter-bar button');
  goButton.addEventListener('click', () => {
    const filters = getFilterValues();
    console.log('Filters applied:', filters);
    fetchMarketData(filters);
  });
  
  // Optional: Add event listeners to dropdowns for real-time updates
  const dropdowns = document.querySelectorAll('.filter-bar select');
  dropdowns.forEach(dropdown => {
    dropdown.addEventListener('change', () => {
      // Uncomment to enable auto-update on filter change
      // const filters = getFilterValues();
      // fetchMarketData(filters);
    });
  });
}

// Run on page load
document.addEventListener('DOMContentLoaded', init);