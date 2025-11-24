document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map', {zoomControl: false}).setView([58.97, 5.73], 12);
    L.control.zoom({position: 'topright'}).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

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
        zoomToBoundsOnClick: false
    });

    let businesses = [];
    let useclustering = true;
    let searchTimeout = null;

    function getCompanyAgeMonths(foundedDate) {
        const founded = new Date(foundedDate);
        const now = new Date();
        return (now.getFullYear() - founded.getFullYear()) * 12 + (now.getMonth() - founded.getMonth());
    }

    function passesFilters(biz) {
        if (!biz.latitude || !biz.longitude) return false;
        if (biz.status && biz.status !== 'Active') return false;

        const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
        if (searchTerm) {
            const searchableText = [biz.name || '', biz.address || '', biz.industry || '', biz.company_type || ''].join(' ').toLowerCase();
            if (!searchableText.includes(searchTerm)) return false;
        }

        const ageFilter = document.getElementById('ageFilter').value;
        const ageMonths = getCompanyAgeMonths(biz.founded);
        if (ageFilter === 'new' && ageMonths > 6) return false;
        if (ageFilter === 'growth' && (ageMonths < 6 || ageMonths > 18)) return false;
        if (ageFilter === 'young' && (ageMonths < 18 || ageMonths > 36)) return false;
        if (ageFilter === 'established' && ageMonths < 36) return false;

        const industryFilter = document.getElementById('industryFilter').value;
        if (industryFilter !== 'all' && biz.industry !== industryFilter) return false;

        const companyTypeFilter = document.getElementById('companyTypeFilter').value;
        if (companyTypeFilter !== 'all' && biz.company_type !== companyTypeFilter) return false;

        const areaFilter = document.getElementById('areaFilter').value;
        if (areaFilter !== 'all' && biz.municipality !== areaFilter) return false;

        return true;
    }

    function updateStatus() {
        // no-op
    }

    function populateFilters() {
        const industries = [...new Set(businesses.filter(b => b.industry && b.industry !== 'Annet').map(b => b.industry))].sort();
        const industrySelect = document.getElementById('industryFilter');
        industries.forEach((industry, idx) => {
            const option = document.createElement('option');
            option.value = industry;
            option.textContent = industry;
            industrySelect.appendChild(option);
            industryColors[industry] = industryColorPalette[idx % industryColorPalette.length];
        });

        const companyTypes = [...new Set(businesses.filter(b => b.company_type).map(b => b.company_type))].sort();
        const companyTypeSelect = document.getElementById('companyTypeFilter');
        companyTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            companyTypeSelect.appendChild(option);
        });

        const municipalities = [...new Set(businesses.filter(b => b.municipality).map(b => b.municipality))].sort();
        const areaSelect = document.getElementById('areaFilter');
        municipalities.forEach(municipality => {
            const option = document.createElement('option');
            option.value = municipality;
            option.textContent = municipality;
            areaSelect.appendChild(option);
        });
    }

    fetch('data_enriched.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            businesses = data;
            populateFilters();
            drawBusinesses();
            updateStatus();

            const searchInput = document.getElementById('searchInput');
            const ageFilter = document.getElementById('ageFilter');
            const industryFilter = document.getElementById('industryFilter');
            const companyTypeFilter = document.getElementById('companyTypeFilter');
            const areaFilter = document.getElementById('areaFilter');
            const clusterToggle = document.getElementById('clusterToggle');

            const redraw = () => { drawBusinesses(); updateStatus(); };
            searchInput.addEventListener('input', () => { clearTimeout(searchTimeout); searchTimeout = setTimeout(redraw, 500); });
            ageFilter.addEventListener('change', redraw);
            industryFilter.addEventListener('change', redraw);
            companyTypeFilter.addEventListener('change', redraw);
            areaFilter.addEventListener('change', redraw);
            clusterToggle.addEventListener('change', e => { useclustering = e.target.checked; drawBusinesses(); });
        })
        .catch(error => {
            console.error('Error loading business data:', error);
            document.getElementById('title-card').innerHTML = `
                <h1>Error Loading Data</h1>
                <p>Could not load business data. Please ensure 'data_enriched.json' is present.</p>
            `;
        });

    function drawBusinesses() {
        businessLayer.clearLayers();
        markerClusterGroup.clearLayers();

        let drawnCount = 0;
        const markers = [];

        businesses.forEach(biz => {
            if (!biz.latitude || !biz.longitude || !passesFilters(biz)) return;

            const color = industryColors[biz.industry] || '#6c757d';
            const ageMonths = getCompanyAgeMonths(biz.founded);
            const ageText = ageMonths < 12 ? `${ageMonths} months` : `${Math.floor(ageMonths / 12)} years`;

            const popupContent = `
                <div>
                    <b style="font-size: 14px;">${biz.name}</b><br>
                    <span class="company-badge">${biz.company_type || 'Unknown Type'}</span>
                    <hr style="margin: 8px 0;">
                    <b>Industry:</b> ${biz.industry || 'Not specified'}<br>
                    <b>Employees:</b> ${biz.employees || 'Unknown'}<br>
                    <b>Age:</b> ${ageText}<br>
                    <b>Status:</b> <span class="status-active">${biz.status || 'Unknown'}</span><br>
                    <b>Area:</b> ${biz.municipality || 'Unknown'}<br>
                    <b>Address:</b> ${biz.address}<br>
                    <small style="color: #999;">Org. Nr: ${biz.org_number}</small>
                </div>
            `;

            // SINGLE marker with label above pin
            const marker = L.marker([biz.latitude, biz.longitude], {
                icon: L.divIcon({
                    className: 'custom-label-icon',
                    html: `
                        <div style="text-align:center;">
                            <div class="marker-label" style="margin-bottom:4px;">${biz.name}</div>
                            <div style="width:10px;height:10px;background:${color};border-radius:50%;margin:0 auto;"></div>
                        </div>
                    `,
                    iconSize: [50, 30],
                    iconAnchor: [25, 30]
                }),
                interactive: true
            }).bindPopup(popupContent);

            markers.push(marker);
            drawnCount++;
        });

        if (useclustering && markers.length > 0) {
            markerClusterGroup.addLayers(markers);
            map.addLayer(markerClusterGroup);
        } else {
            markers.forEach(m => m.addTo(businessLayer));
            map.removeLayer(markerClusterGroup);
        }

        const activeCount = businesses.filter(b => b.status === 'Active').length;
        document.getElementById('title-card').innerHTML = `
            <h1>Stavanger Uncovered</h1>
            <p>Showing <b>${drawnCount.toLocaleString()}</b> active businesses from <b>${activeCount.toLocaleString()}</b> total.</p>
        `;
    }
});

