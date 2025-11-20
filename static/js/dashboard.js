// Dashboard page: fetch /search?taluka=... and render charts + small map + zone card
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const talukaParam = params.get('taluka') || '';

  const titleEl = document.getElementById('title');
  const zoneBadge = document.getElementById('zoneBadge');
  const zoneText = document.getElementById('zoneText');
  const locationInfo = document.getElementById('locationInfo');

  // Expose handler so other scripts (search.js) can trigger rendering without reload
  window.handleTalukaData = function(data) {
    if (!data) return;
    titleEl.textContent = `${data.district} | ${data.taluka}`;
    const color = data.zone === 'Red Zone' ? 'bg-red-600' : (data.zone === 'Orange Zone' ? 'bg-orange-500' : 'bg-green-600');
    zoneBadge.className = `px-3 py-1 rounded text-white font-semibold ${color}`;
    zoneBadge.textContent = data.zone;

    const explanation = zoneExplanation(data.zone, data.slope);
    zoneText.textContent = explanation;

    locationInfo.innerHTML = `<div><strong>District:</strong> ${data.district}</div><div><strong>Taluka:</strong> ${data.taluka}</div><div><strong>Slope:</strong> ${data.slope.toFixed(4)}</div>`;

    renderNDVI(data.years, data.ndvi_values);
    renderGLCM(data.years, data.glcm);
    renderCluster(data.years, data.cluster);
    renderSmallMap(data.lat, data.lon, data.zone);
  };

  // Listen for custom events triggered by search suggestions
  window.addEventListener('talukaSelected', (ev) => {
    window.handleTalukaData(ev.detail);
  });

  // If page has taluka in query param, fetch on load
  if (talukaParam) {
    fetchAndHandle(talukaParam);
  } else {
    titleEl.textContent = 'Please search and select a taluka';
  }

  function fetchAndHandle(talukaParam) {
    fetch('/search?taluka=' + encodeURIComponent(talukaParam))
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(data => window.handleTalukaData(data))
      .catch(err => { titleEl.textContent = 'Taluka not found'; console.error(err); });
  }

  function zoneExplanation(zone, slope) {
    if (zone === 'Red Zone') return `High vegetation loss (slope=${slope.toFixed(4)}). Immediate attention recommended.`;
    if (zone === 'Orange Zone') return `Stable/slow change (slope=${slope.toFixed(4)}). Monitor regularly.`;
    return `Vegetation improving (slope=${slope.toFixed(4)}). Keep up conservation efforts.`;
  }

  function renderNDVI(years, ndvi) {
    const ctx = document.getElementById('ndviChart').getContext('2d');
    if (window._ndviChart) window._ndviChart.destroy();
    window._ndviChart = new Chart(ctx, {
      type: 'line',
      data: { labels: years, datasets: [{ label: 'NDVI', data: ndvi, borderColor: 'rgba(16,185,129,1)', backgroundColor: 'rgba(16,185,129,0.1)', tension:0.2 }] },
      options: { responsive:true }
    });
  }

  function renderGLCM(years, glcm) {
    const ctx = document.getElementById('glcmChart').getContext('2d');
    if (window._glcmChart) window._glcmChart.destroy();
    window._glcmChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: years,
        datasets: [
          { label: 'Contrast', data: glcm.contrast, backgroundColor: 'rgba(239,68,68,0.7)' },
          { label: 'Homogeneity', data: glcm.homogeneity, backgroundColor: 'rgba(34,197,94,0.7)' },
          { label: 'Energy', data: glcm.energy, backgroundColor: 'rgba(59,130,246,0.7)' }
        ]
      },
      options: { responsive: true, scales: { x:{ stacked: false }, y:{ beginAtZero:true } } }
    });
  }

  function renderCluster(years, cluster) {
    const ctx = document.getElementById('clusterChart').getContext('2d');
    if (window._clusterChart) window._clusterChart.destroy();
    const points = years.map((y, i) => ({ x: y, y: cluster[i] || 0 }));
    window._clusterChart = new Chart(ctx, {
      type: 'scatter',
      data: { datasets: [{ label: 'Cluster (by year)', data: points, backgroundColor: 'rgba(99,102,241,0.9)' }] },
      options: { scales: { x: { type: 'linear', position: 'bottom' } } }
    });
  }

  function renderSmallMap(lat, lon, zone) {
    const el = document.getElementById('mapSmall');
    el.innerHTML = '';
    const map = L.map(el).setView([lat, lon], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
    const color = zone === 'Red Zone' ? 'red' : (zone === 'Orange Zone' ? 'orange' : 'green');

    // Try to fetch polygon bounds for this taluka; if not available, fall back to circle marker
    const q = `taluka=${encodeURIComponent(titleEl.textContent)}`;
    fetch('/bounds?' + q)
      .then(r => {
        if (!r.ok) throw new Error('no bounds');
        return r.json();
      })
      .then(geo => {
        const layer = L.geoJSON(geo, { style: { color: color, weight: 2, fillOpacity: 0.3 } }).addTo(map);
        try { map.fitBounds(layer.getBounds()); } catch (e) { /* ignore */ }
      })
      .catch(() => {
        L.circleMarker([lat, lon], { radius:8, color: color, fillColor: color, fillOpacity:0.9 }).addTo(map);
      });
  }
});
