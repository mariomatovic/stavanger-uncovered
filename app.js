document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize the Map - Centered on Stavanger
    // 1. Initialize the Map - Centered on Stavanger
    // Zoom controls are explicitly moved to the top-right corner to be next to the title card
    const map = L.map('map', {zoomControl: false}).setView([58.97, 5.73], 12);
    L.control.zoom({position: 'topright'}).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // 2. Color palette for different industries
    const industryColorPalette = [
        '#007bff', '#28a745', '#dc3545', '#ffc107', '#6f42c1', 
        '#fd7e14', '#20c997', '#e83e8c', '#17a2b8', '#6c757d'
    ];
    
    let industryColors = {};
    let businessLayer = L.layerGroup().addTo(map);
    let markerClusterGroup = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true
    });
    
    let businesses = [];
    let useclustering = true;
    let searchTimeout = null;

    // 3. Calculate company age in months
    function getCompanyAgeMonths(foundedDate) {
        const founded = new Date(foundedDate);
        const now = new Date();
        const months = (now.getFullYear() - founded.getFullYear()) * 12 + 
                      (now.getMonth() - founded.getMonth());
        return months;
    }

    // 4. Filter functions
    function passesFilters(biz) {
        // Only show active companies with valid coordinates
        if (!biz.latitude || !biz.longitude) return false;
        if (biz.status && biz.status !== 'Active') return false;

        // Search filter
        const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
        if (searchTerm) {
            const searchableText = [
                biz.name || '',
                biz.address || '',
                biz.industry || '',
                biz.company_type || ''
            ].join(' ').toLowerCase();
            
            if (!searchableText.includes(searchTerm)) return false;
        }

        // Age filter
        const ageFilter = document.getElementById('ageFilter').value;
        const ageMonths = getCompanyAgeMonths(biz.founded);
        
        if (ageFilter === 'new' && ageMonths > 6) return false;
        if (ageFilter === 'growth' && (ageMonths < 6 || ageMonths > 18)) return false;
        if (ageFilter === 'young' && (ageMonths < 18 || ageMonths > 36)) return false;
        if (ageFilter === 'established' && ageMonths < 36) return false;

        // Industry filter
        const industryFilter = document.getElementById('industryFilter').value;
        if (industryFilter !== 'all' && biz.industry !== industryFilter) return false;

        // Company type filter
        const companyTypeFilter = document.getElementById('companyTypeFilter').value;
        if (companyTypeFilter !== 'all' && biz.company_type !== companyTypeFilter) return false;

        // Area filter
        const areaFilter = document.getElementById('areaFilter').value;
        if (areaFilter !== 'all' && biz.municipality !== areaFilter) return false;

        return true;
    }

    // 5. Update status display (Removed as requested by user)
    function updateStatus() {
        // Function body is now empty as the status display was removed from the UI
    }

    // 6. Populate dynamic filters
    function populateFilters() {
        // Get unique industries (excluding null/empty)
        const industries = [...new Set(businesses
            .filter(b => b.industry && b.industry !== 'Annet')
            .map(b => b.industry))]
            .sort();
        
        const industrySelect = document.getElementById('industryFilter');
        industries.forEach(industry => {
            const option = document.createElement('option');
            option.value = industry;
            option.textContent = industry;
            industrySelect.appendChild(option);
        });

        // Assign colors to industries
        industries.forEach((industry, idx) => {
            industryColors[industry] = industryColorPalette[idx % industryColorPalette.length];
        });

        // Get unique company types
        const companyTypes = [...new Set(businesses
            .filter(b => b.company_type)
            .map(b => b.company_type))]
            .sort();
        
        const companyTypeSelect = document.getElementById('companyTypeFilter');
        companyTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            companyTypeSelect.appendChild(option);
        });

        // Get unique municipalities
        const municipalities = [...new Set(businesses
            .filter(b => b.municipality)
            .map(b => b.municipality))]
            .sort();
        
        const areaSelect = document.getElementById('areaFilter');
        municipalities.forEach(municipality => {
            const option = document.createElement('option');
            option.value = municipality;
            option.textContent = municipality;
            areaSelect.appendChild(option);
        });
    }

    // 7. Fetch and Process Data
    fetch('data_enriched.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            businesses = data;
            console.log(`Loaded ${businesses.length} businesses.`);
            
            // Populate dynamic filters
            populateFilters();
            
            // Initial draw
            drawBusinesses();
            updateStatus(); // This call is now a no-op

            // 8. Handle Controls
            const searchInput = document.getElementById('searchInput');
            const ageFilter = document.getElementById('ageFilter');
            const industryFilter = document.getElementById('industryFilter');
            const companyTypeFilter = document.getElementById('companyTypeFilter');
            const areaFilter = document.getElementById('areaFilter');
            const clusterToggle = document.getElementById('clusterToggle');

            // Search with debounce (wait 500ms after typing stops)
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    drawBusinesses();
                    // updateStatus() is now a no-op, but kept for structural integrity
                    updateStatus(); 
                }, 500);
            });

            ageFilter.addEventListener('change', () => {
                drawBusinesses();
                // updateStatus() is now a no-op, but kept for structural integrity
                updateStatus(); 
            });

            industryFilter.addEventListener('change', () => {
                drawBusinesses();
                // updateStatus() is now a no-op, but kept for structural integrity
                updateStatus(); 
            });

            companyTypeFilter.addEventListener('change', () => {
                drawBusinesses();
                // updateStatus() is now a no-op, but kept for structural integrity
                updateStatus(); 
            });

            areaFilter.addEventListener('change', () => {
                drawBusinesses();
                // updateStatus() is now a no-op, but kept for structural integrity
                updateStatus(); 
            });

            clusterToggle.addEventListener('change', (e) => {
                useclustering = e.target.checked;
                drawBusinesses();
            });
        })
        .catch(error => {
            console.error('Error loading business data:', error);
            document.getElementById('title-card').innerHTML = `
                <h1>Error Loading Data</h1>
                <p>Could not load business data. Please ensure 'data_enriched.json' is present.</p>
            `;
        });

    function drawBusinesses() {
        // Clear existing layers
        businessLayer.clearLayers();
        markerClusterGroup.clearLayers();
        
        let drawnCount = 0;
        const markers = [];

        businesses.forEach(biz => {
            // Only draw if we have valid coordinates and passes filters
            if (biz.latitude && biz.longitude && passesFilters(biz)) {
                // Get color based on industry
                const color = industryColors[biz.industry] || '#6c757d';
                
                // Custom label for business name (clickable)
const labelText = biz.name; // or: `${biz.name} - ${biz.company_type || ''}`

const customIcon = L.divIcon({
    className: 'custom-label-icon',
    html: `
        <div class="marker-label" style="
            background: white;
            border: 1px solid #333;
            border-radius: 4px;
            padding: 2px 4px;
            font-size: 11px;
            white-space: nowrap;
            cursor: pointer;
            transform: translate(-50%, -18px);
        ">
            ${labelText}
        </div>
    `,
    iconSize: [0, 0]
});

// Base pin (circle marker stays)
const marker = L.circleMarker([biz.latitude, biz.longitude], {
    radius: 5,
    fillColor: color,
    color: color,
    weight: 1,
    opacity: 0.7,
    fillOpacity: 0.5
});

marker.bindPopup(popupContent);

// Label marker (click opens same popup)
const labelMarker = L.marker([biz.latitude, biz.longitude], { icon: customIcon });
labelMarker.on('click', () => marker.openPopup());

// Add both to map or cluster
if (useclustering) {
    markers.push(marker, labelMarker);
} else {
    marker.addTo(businessLayer);
    labelMarker.addTo(businessLayer);
}

drawnCount++;

            }
        });
        
        // Add markers to cluster group if clustering is enabled
        if (useclustering && markers.length > 0) {
            markerClusterGroup.addLayers(markers);
            map.addLayer(markerClusterGroup);
        } else if (!useclustering) {
            map.removeLayer(markerClusterGroup);
        }
        
        // Update the title card
        const activeCount = businesses.filter(b => b.status === 'Active').length;
        document.getElementById('title-card').innerHTML = `
            <h1>Stavanger Uncovered</h1>
            <p>Showing <b>${drawnCount.toLocaleString()}</b> active businesses from <b>${activeCount.toLocaleString()}</b> total.</p>
        `;
        
        updateStatus(); // This call is now a no-op
    }
});


