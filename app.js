document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize the Map - Centered on Stavanger
    const map = L.map('map').setView([58.97, 5.73], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // 2. Define Industry Colors (The Ecosystem View)
    const industryColors = {
        'Energi': '#28a745',
        'Teknologi': '#007bff',
        'Bygg og Anlegg': '#fd7e14',
        'Handel og Service': '#6f42c1',
        'Helse og Sosial': '#dc3545',
        'Utdanning og Forskning': '#ffc107',
        'Annet': '#6c757d'
    };

    const defaultColor = '#007bff';
    let businessLayer = L.layerGroup().addTo(map);
    let markerClusterGroup = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true
    });
    
    let businesses = [];
    let currentView = 'density';
    let useclustering = true;

    // 4. Calculate company age in months
    function getCompanyAgeMonths(foundedDate) {
        const founded = new Date(foundedDate);
        const now = new Date();
        const months = (now.getFullYear() - founded.getFullYear()) * 12 + 
                      (now.getMonth() - founded.getMonth());
        return months;
    }

    // 5. Filter functions
    function passesFilters(biz) {
        // Age filter
        const ageFilter = document.getElementById('ageFilter').value;
        const ageMonths = getCompanyAgeMonths(biz.founded);
        
        if (ageFilter === 'new' && ageMonths > 6) return false;
        if (ageFilter === 'growth' && (ageMonths < 6 || ageMonths > 18)) return false;
        if (ageFilter === 'established' && ageMonths < 18) return false;

        // Industry filter
        const industryFilter = document.getElementById('industryFilter').value;
        
        if (industryFilter === 'exclude-annet' && biz.industry === 'Annet') return false;
        if (industryFilter === 'only-annet' && biz.industry !== 'Annet') return false;

        return true;
    }

    // 6. Update status display
    function updateStatus() {
        const total = businesses.length;
        const withCoords = businesses.filter(b => b.latitude && b.longitude).length;
        const filtered = businesses.filter(passesFilters).length;
        
        document.getElementById('status').innerHTML = `
            Total: ${total} | With location: ${withCoords} | Filtered: ${filtered}
        `;
    }

    // 7. Fetch and Process Data
    fetch('data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            businesses = data;
            console.log(`Loaded ${businesses.length} businesses.`);
            
            // Initial draw
            drawBusinesses('density');
            updateStatus();

            // 8. Handle Controls
            const densityBtn = document.getElementById('densityBtn');
            const ecosystemBtn = document.getElementById('ecosystemBtn');
            const ageFilter = document.getElementById('ageFilter');
            const industryFilter = document.getElementById('industryFilter');
            const clusterToggle = document.getElementById('clusterToggle');

            densityBtn.addEventListener('click', () => {
                currentView = 'density';
                drawBusinesses('density');
                densityBtn.classList.add('active');
                ecosystemBtn.classList.remove('active');
            });

            ecosystemBtn.addEventListener('click', () => {
                currentView = 'ecosystem';
                drawBusinesses('ecosystem');
                ecosystemBtn.classList.add('active');
                densityBtn.classList.remove('active');
            });

            ageFilter.addEventListener('change', () => {
                drawBusinesses(currentView);
                updateStatus();
            });

            industryFilter.addEventListener('change', () => {
                drawBusinesses(currentView);
                updateStatus();
            });

            clusterToggle.addEventListener('change', (e) => {
                useclustering = e.target.checked;
                drawBusinesses(currentView);
            });
        })
        .catch(error => {
            console.error('Error loading business data:', error);
            document.getElementById('title-card').innerHTML = `<h1>Error Loading Data</h1><p>Could not load business data. Please ensure 'data.json' is present and correctly formatted.</p>`;
        });

    function drawBusinesses(view) {
        // Clear existing layers
        businessLayer.clearLayers();
        markerClusterGroup.clearLayers();
        
        let drawnCount = 0;
        const markers = [];

        businesses.forEach(biz => {
            // Only draw if we have valid coordinates and passes filters
            if (biz.latitude && biz.longitude && passesFilters(biz)) {
                const color = view === 'ecosystem' ? 
                    (industryColors[biz.industry] || industryColors['Annet']) : 
                    defaultColor;
                
                const circle = L.circleMarker([biz.latitude, biz.longitude], {
                    radius: 5,
                    fillColor: color,
                    color: color,
                    weight: 1,
                    opacity: 0.7,
                    fillOpacity: 0.5
                });

                // Create the popup content
                const ageMonths = getCompanyAgeMonths(biz.founded);
                const ageText = ageMonths < 12 ? 
                    `${ageMonths} months old` : 
                    `${Math.floor(ageMonths / 12)} years old`;

                const popupContent = `
                    <b>${biz.name}</b><br>
                    <hr style="margin: 4px 0;">
                    <b>Industry:</b> ${biz.industry}<br>
                    <b>Size:</b> ${biz.employees}<br>
                    <b>Founded:</b> ${biz.founded} (${ageText})<br>
                    <b>Address:</b> ${biz.address}<br>
                    <small>Org. Nr: ${biz.org_number}</small>
                `;

                circle.bindPopup(popupContent);
                
                if (useclustering) {
                    markers.push(circle);
                } else {
                    circle.addTo(businessLayer);
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
        document.getElementById('title-card').innerHTML = `
            <h1>Stavanger Uncovered</h1>
            <p>Showing ${drawnCount} businesses in the Stavanger area.</p>
        `;
        
        updateStatus();
    }
});
