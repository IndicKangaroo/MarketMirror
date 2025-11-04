import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Map styles to match site theme
const mapStyles = [
  {
    "featureType": "all",
    "elementType": "geometry",
    "stylers": [{"color": "#f5f5f5"}]
  },
  {
    "featureType": "all",
    "elementType": "labels.text.fill",
    "stylers": [{"color": "#2d5016"}]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{"color": "#e8f5e9"}]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [{"color": "#e8f5e9"}]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{"color": "#ffffff"}]
  }
];

// Custom marker icons
const markerIcons = {
  major: {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: '#4b753b',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 10
  },
  local: {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: '#66bb6a',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 8
  }
};

// InfoWindow template
function createInfoWindowContent(mandi) {
  return `
    <div style="padding: 12px; max-width: 200px;">
      <h3 style="margin: 0 0 8px; color: #2d5016; font-size: 16px;">${mandi.name}</h3>
      <div style="margin: 8px 0; padding: 8px; background: #f8f9fa; border-radius: 4px;">
        <strong style="color: #4b753b;">${mandi.commodity}</strong>
        <div style="font-size: 18px; color: #2d5016; margin-top: 4px;">
          ₹${mandi.price}/kg
        </div>
      </div>
      ${mandi.address ? `<p style="margin: 8px 0 0; color: #666; font-size: 12px;">${mandi.address}</p>` : ''}
    </div>
  `;
}

// Initialize map and load data
window.initMap = async function() {
  // Show loading state
  const mapElement = document.getElementById("mandiMap");
  mapElement.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f8f9fa;">
      <div style="text-align: center;">
        <div style="border: 4px solid #f3f3f3; border-top: 4px solid #4CAF50; border-radius: 50%; width: 40px; height: 40px; margin: 0 auto; animation: spin 1s linear infinite;"></div>
        <p style="margin-top: 16px; color: #4b753b;">Loading market locations...</p>
      </div>
    </div>
  `;

  try {
    // Initialize the map
    const map = new google.maps.Map(mapElement, {
      center: { lat: 22.9734, lng: 78.6569 }, // India center
      zoom: 5,
      styles: mapStyles,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_BOTTOM
      }
    });

    // Create marker clusters for better performance
    const markerCluster = new markerClusterer.MarkerClusterer({ map });
    const markers = [];
    let activeInfoWindow = null;

    // Fetch mandi data from Firestore
    const querySnapshot = await getDocs(collection(db, "mandiData"));
    
    if (querySnapshot.empty) {
      throw new Error('No mandi locations found');
    }

    querySnapshot.forEach((doc) => {
      const mandi = doc.data();

      // Validate location data
      if (!mandi.latitude || !mandi.longitude) {
        console.warn(`Invalid location data for mandi: ${mandi.name}`);
        return;
      }

      // Create marker
      const marker = new google.maps.Marker({
        position: { lat: mandi.latitude, lng: mandi.longitude },
        title: mandi.name,
        icon: markerIcons[mandi.type || 'local']
      });

      // Create info window
      const infoWindow = new google.maps.InfoWindow({
        content: createInfoWindowContent(mandi),
        maxWidth: 250
      });

      // Add click listener
      marker.addListener("click", () => {
        // Close active info window
        if (activeInfoWindow) {
          activeInfoWindow.close();
        }
        infoWindow.open(map, marker);
        activeInfoWindow = infoWindow;
      });

      markers.push(marker);
    });

    // Add markers to cluster
    markerCluster.addMarkers(markers);

    // Add cluster styling
    markerCluster.setStyles([
      {
        textColor: '#ffffff',
        textSize: 14,
        height: 40,
        width: 40,
        backgroundPosition: 'center',
        backgroundColor: '#4b753b'
      }
    ]);

  } catch (error) {
    console.error('Error initializing map:', error);
    mapElement.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f8f9fa;">
        <div style="text-align: center; color: #d32f2f; padding: 20px;">
          <p style="margin: 0;">⚠️ Error loading market locations</p>
          <p style="margin-top: 8px; font-size: 14px; color: #666;">${error.message}</p>
        </div>
      </div>
    `;
  }
};

// Add loading spinner animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);
