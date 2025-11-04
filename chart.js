import { db } from './firebase-config.js';
import { collection, query, where, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Global chart instance
let marketChart = null;

// Make sure Chart.js is loaded
if (typeof Chart === 'undefined') {
    console.error('Chart.js is not loaded! Please check the script inclusion order.');
}

// Initialize Chart
function initChart() {
  console.log('Initializing chart...');
  
  const chartPlaceholder = document.querySelector('.chart-placeholder');
  if (!chartPlaceholder) {
    console.error('Chart placeholder not found!');
    return null;
  }
  
  // Check if canvas already exists
  let canvas = document.getElementById('marketChart');
  if (!canvas) {
    // Create new canvas only if it doesn't exist
    chartPlaceholder.innerHTML = '<canvas id="marketChart"></canvas>';
    canvas = document.getElementById('marketChart');
  }
  
  if (!canvas) {
    console.error('Canvas element not created!');
    return null;
  }
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Could not get canvas context!');
    return null;
  }
  
  // Destroy existing chart instance if it exists
  if (marketChart) {
    marketChart.destroy();
  }
  
  marketChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Price (₹/kg)',
        data: [],
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: '#4CAF50',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverBackgroundColor: '#2d5016',
        pointHoverBorderColor: '#fff'
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
            font: {
              size: 14,
              weight: 'bold'
            },
            color: '#2d5016',
            padding: 15
          }
        },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(45, 80, 22, 0.95)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: '#4CAF50',
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: function(context) {
              return `Price: ₹${context.parsed.y} per kg`;
            }
          }
        }
      },
      scales: {
        x: {
          display: true,
          grid: {
            display: false
          },
          ticks: {
            font: {
              size: 12
            },
            color: '#666'
          }
        },
        y: {
          display: true,
          beginAtZero: false,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
            drawBorder: false
          },
          ticks: {
            font: {
              size: 12
            },
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
  
  return marketChart;
}

// Function to generate dummy data for testing
function generateDummyData(days = 30, filters = {}) {
  const data = [];
  const today = new Date();
  
  // Set base price based on commodity
  let basePrice = 60; // Default base price
  if (filters.commodity) {
    switch(filters.commodity.toLowerCase()) {
      case 'tomato':
        basePrice = 40;
        break;
      case 'onion':
        basePrice = 30;
        break;
      case 'potato':
        basePrice = 25;
        break;
    }
  }

  // Add some randomization to base price
  basePrice += Math.random() * 20;

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - (days - i));
    
    // Generate a price with some random variation
    const randomVariation = (Math.random() - 0.5) * 8;
    const price = basePrice + randomVariation;
    
    data.push({
      date: date.toISOString(),
      price: Math.round(price * 100) / 100,
      commodity: filters.commodity || 'Mixed Vegetables',
      location: filters.state || filters.district || 'All Regions'
    });
  }
  
  return data;
}

// Fetch data from Firestore and update chart
async function fetchAndUpdateChart(filters = {}) {
  let data = [];
  
  try {
    // Show loading state only if we're fetching from Firestore
    if (db) {
      showLoadingState();
    }
    
    // Try to fetch from Firestore
    try {
      // If there's no Firebase connection, throw error immediately
      if (!db) {
        throw new Error('Firebase not initialized');
      }

      // Build Firestore query
      let q = collection(db, "market_prices");
      const conditions = [];
      
      // Add filters
      if (filters.commodity) {
        conditions.push(where("commodity", "==", filters.commodity));
      }
      if (filters.state) {
        conditions.push(where("state", "==", filters.state));
      }
      if (filters.district) {
        conditions.push(where("district", "==", filters.district));
      }
      if (filters.market) {
        conditions.push(where("market", "==", filters.market));
      }
      if (filters.dateFrom) {
        conditions.push(where("date", ">=", filters.dateFrom));
      }
      
      // Apply conditions and sort by date
      if (conditions.length > 0) {
        q = query(q, ...conditions, orderBy("date", "asc"));
      } else {
        q = query(q, orderBy("date", "asc"));
      }
      
      // Fetch documents
      const querySnapshot = await getDocs(q);
      
      // Check if data exists
      if (querySnapshot.empty) {
        throw new Error('No data available');
      }
      
      // Extract data
      querySnapshot.forEach((doc) => {
        data.push({
          date: doc.data().date,
          price: doc.data().pricePerKg || doc.data().avgPrice || 0,
          commodity: doc.data().commodity,
          location: doc.data().state || doc.data().district
        });
      });
    } catch (firestoreError) {
      console.warn("Firestore fetch failed, using dummy data:", firestoreError);
      // Generate dummy data based on the selected filters
      data = generateDummyData(30, filters);
    }
    
    console.log('Market data:', data);
    
    // Always ensure we have data to display
    if (!data || data.length === 0) {
      data = generateDummyData(30, filters);
    }

    // Clear any loading state
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.remove();
    }

    // Update chart with data
    updateChartData(data, filters);
    
    // Calculate and show insight
    calculateInsight(data, filters);
    
  } catch (error) {
    console.error("Error fetching data:", error);
    // If error occurs, show dummy data instead of error state
    const dummyData = generateDummyData(30, filters);
    updateChartData(dummyData, filters);
    calculateInsight(dummyData, filters);
  }
}

// Update chart with fetched data
function updateChartData(data, filters) {
  // Initialize chart if not exists
  if (!marketChart) {
    marketChart = initChart();
  }
  
  if (!marketChart) {
    console.error('Failed to initialize or get chart instance');
    return;
  }
  
  // Format dates for labels
  const labels = data.map(item => {
    const date = new Date(item.date);
    return date.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short' 
    });
  });
  
  // Extract prices
  const prices = data.map(item => item.price);
  
  // Update chart label based on filters
  let chartLabel = 'Market Prices (₹/kg)';
  if (filters.commodity) {
    chartLabel = `${filters.commodity} Prices (₹/kg)`;
  }
  if (filters.state || filters.district) {
    const location = filters.district || filters.state;
    chartLabel += ` - ${location}`;
  }
  
  // Update chart data
  marketChart.data.labels = labels;
  marketChart.data.datasets[0].label = chartLabel;
  marketChart.data.datasets[0].data = prices;
  
  // Refresh chart
  marketChart.update();
}

// Calculate price change insight
function calculateInsight(data, filters) {
  const insightElement = document.querySelector('.chart-info p');
  
  if (data.length < 2) {
    insightElement.innerHTML = '<strong>Insight:</strong> Insufficient data for trend analysis.';
    return;
  }
  
  // Compare latest price with 7 days ago (or first available)
  const latestPrice = data[data.length - 1].price;
  const compareIndex = Math.max(0, data.length - 8);
  const comparePrice = data[compareIndex].price;
  
  const priceChange = latestPrice - comparePrice;
  const percentChange = ((priceChange / comparePrice) * 100).toFixed(1);
  
  const direction = priceChange >= 0 ? 'increased' : 'decreased';
  const absPercent = Math.abs(percentChange);
  
  // Build insight message
  const commodity = filters.commodity || 'Prices';
  const region = filters.state || filters.district || 'the region';
  
  insightElement.innerHTML = `<strong>Insight:</strong> ${commodity} prices have ${direction} by ${absPercent}% this week in ${region}.`;
}

// Loading state
function showLoadingState() {
  const placeholder = document.querySelector('.chart-placeholder');
  
  // Save the existing canvas if it exists
  const existingCanvas = document.getElementById('marketChart');
  const canvasHTML = existingCanvas ? existingCanvas.outerHTML : '';
  
  // Add loading overlay while preserving the canvas
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'loadingOverlay';
  loadingDiv.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.9);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  `;
  
  loadingDiv.innerHTML = `
    <div style="border: 4px solid #f3f3f3; border-top: 4px solid #4CAF50; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite;"></div>
    <p style="margin-top: 20px; color: #4CAF50; font-size: 16px;">Loading market data...</p>
  `;
  
  // Ensure placeholder has position relative for absolute positioning of overlay
  placeholder.style.position = 'relative';
  
  // Keep the canvas and add the loading overlay
  if (!existingCanvas) {
    placeholder.innerHTML = '<canvas id="marketChart"></canvas>';
  }
  placeholder.appendChild(loadingDiv);
}

// No data state
function showNoDataState() {
  const placeholder = document.querySelector('.chart-placeholder');
  placeholder.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; height: 400px; color: #666;">
      <div style="text-align: center;">
        <svg width="100" height="100" style="opacity: 0.3; margin-bottom: 20px;">
          <circle cx="50" cy="50" r="40" stroke="#4CAF50" stroke-width="3" fill="none"/>
          <line x1="35" y1="50" x2="65" y2="50" stroke="#4CAF50" stroke-width="3"/>
        </svg>
        <p style="font-size: 18px; margin: 0;">No data available</p>
        <p style="font-size: 14px; margin-top: 10px;">Please adjust your filters and try again</p>
      </div>
    </div>
  `;
  
  const insightElement = document.querySelector('.chart-info p');
  insightElement.innerHTML = '<strong>Insight:</strong> No data to display.';
}

// Error state
function showErrorState(message) {
  const placeholder = document.querySelector('.chart-placeholder');
  placeholder.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; height: 400px; color: #d32f2f;">
      <div style="text-align: center;">
        <p style="font-size: 18px; margin: 0;">⚠️ Error loading data</p>
        <p style="font-size: 14px; margin-top: 10px; color: #666;">${message}</p>
      </div>
    </div>
  `;
}

// Get filter values from form
function getFilters() {
  return {
    commodity: document.getElementById('commodity')?.value || '',
    state: document.getElementById('state')?.value || '',
    district: document.getElementById('district')?.value || '',
    market: document.getElementById('market')?.value || '',
    dateFrom: document.getElementById('dateFrom')?.value || '',
    priceSort: document.getElementById('price')?.value || ''
  };
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Chart.js initialization starting...');
  
  // Prepare the chart placeholder
  const chartPlaceholder = document.querySelector('.chart-placeholder');
  if (chartPlaceholder) {
    chartPlaceholder.innerHTML = '<canvas id="marketChart"></canvas>';
  }
  
  // Generate initial dummy data
  const initialData = generateDummyData(30);
  
  // Initialize chart
  marketChart = initChart();
  if (!marketChart) {
    console.error('Failed to initialize chart!');
    return;
  }
  
  // Update chart with initial dummy data
  updateChartData(initialData, {});
  
  // Add GO button event listener
  const goButton = document.querySelector('.filter-bar button');
  if (goButton) {
    goButton.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent any default form submission
      const filters = getFilters();
      console.log('Applying filters:', filters);
      fetchAndUpdateChart(filters);
    });
  } else {
    console.error('GO button not found in the document!');
  }
  
  // Calculate initial insight
  calculateInsight(initialData, {});
  
  // Try to fetch real data after showing dummy data
  try {
    await fetchAndUpdateChart();
  } catch (error) {
    console.warn('Failed to fetch initial data, keeping dummy data:', error);
  }
});

// Add CSS for loading spinner animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);