document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize the Map - Centered on Stavanger
    const map = L.map('map').setView([58.97, 5.73], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // 2. Define Industry Colors (The Ecosystem View)
    // Using the colors from the user's original code, but adding a few more for clarity
    const industryColors = {
        'Energi': '#28a745', // Green
        'Teknologi': '#007bff', // Blue
        'Bygg og Anlegg': '#fd7e14', // Orange
        'Handel og Service': '#6f42c1', // Purple
        'Helse og Sosial': '#dc3545', // Red
        'Utdanning og Forskning': '#ffc107', // Yellow
        'Annet': '#6c757d' // Grey
    };

    const defaultColor = '#007bff'; // Default blue for density view
    let businessLayer = L.layerGroup().addTo(map);
    let businesses = [];

    // 3. Fetch and Process Data
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

            // 4. Handle Controls
            const densityBtn = document.getElementById('densityBtn');
            const ecosystemBtn = document.getElementById('ecosystemBtn');

            densityBtn.addEventListener('click', () => {
                drawBusinesses('density');
                densityBtn.classList.add('active');
                ecosystemBtn.classList.remove('active');
            });

            ecosystemBtn.addEventListener('click', () => {
                drawBusinesses('ecosystem');
                ecosystemBtn.classList.add('active');
                densityBtn.classList.remove('active');
            });
        })
        .catch(error => {
            console.error('Error loading business data:', error);
            // Update the title card to show the error instead of an alert
            document.getElementById('title-card').innerHTML = `<h1>Error Loading Data</h1><p>Could not load business data. Please ensure 'data.json' is present and correctly formatted.</p>`;
        });

    function drawBusinesses(view) {
        businessLayer.clearLayers();
        let drawnCount = 0;

        businesses.forEach(biz => {
            // Only draw if we have valid coordinates
            if (biz.latitude && biz.longitude) {
                const color = view === 'ecosystem' ? (industryColors[biz.industry] || industryColors['Annet']) : defaultColor;
                
                const circle = L.circleMarker([biz.latitude, biz.longitude], {
                    radius: 4, // Slightly smaller radius for better density visualization
                    fillColor: color,
                    color: color,
                    weight: 1,
                    opacity: 0.6,
                    fillOpacity: 0.4
                }).addTo(businessLayer);

                // Create the popup content with all available data fields
                const popupContent = `
                    <b>${biz.name}</b><br>
                    <hr style="margin: 4px 0;">
                    <b>Industry:</b> ${biz.industry}<br>
                    <b>Size:</b> ${biz.employees}<br>
                    <b>Founded:</b> ${biz.founded}<br>
                    <small>Org. Nr: ${biz.org_number}</small>
                `;

                circle.bindPopup(popupContent);
                drawnCount++;
            }
        });
        
        // Update the title card with the count of drawn businesses
        document.getElementById('title-card').innerHTML = `
            <h1>Stavanger Uncovered</h1>
            <p>Showing ${drawnCount} businesses in the Stavanger area.</p>
        `;
    }
});