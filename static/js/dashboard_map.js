// Build map on index page and place markers for all talukas using /suggest?q=
document.addEventListener('DOMContentLoaded', () => {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;

  const map = L.map(mapEl).setView([21.0, 78.0], 5);
  // expose main map and layers for other scripts to interact with
  window.MAIN_MAP = map;
  window.MAP_LAYERS = window.MAP_LAYERS || {};
  // Use a satellite basemap (Esri World Imagery) for a similar look to the reference image
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics'
  }).addTo(map);

  // Draw an India border. Prefer a precise GeoJSON if provided at static/geo/india.geojson,
  // Draw India state boundaries using a high-resolution GeoJSON (preferred file: static/geo/india_states.geojson)
  (function addIndiaStates(){
    const geoUrl = '/static/geo/india_states.geojson';
    fetch(geoUrl).then(r => {
      if (!r.ok) throw new Error('no geojson');
      return r.json();
    }).then(geo => {
      // style for white borders
      const stateStyle = { color: '#ffffff', weight: 1.5, fillOpacity: 0 };

      // create a geoJSON layer with proper options
      const statesLayer = L.geoJSON(geo, {
        style: stateStyle,
        smoothFactor: 0, // keep high resolution
        onEachFeature: function(feature, layer) {
          // hover highlight
          layer.on('mouseover', function(e){ layer.setStyle({ weight: 2.5 }); });
          layer.on('mouseout', function(e){ layer.setStyle(stateStyle); });
          // click navigates to dashboard for the state (uses state's name property)
          layer.on('click', function(e){
            const props = feature.properties || {};
            const name = (props.NAME_1 || props.NAME || props.name || props.STATE || props.ST_NM || props.NAME_2 || '').toString();
            if (name) {
              // navigate to dashboard; backend /search will try to match taluka/district by name
              window.location = '/dashboard?taluka=' + encodeURIComponent(name);
            }
          });
        }
      }).addTo(map);

      // add subtle dark halo underneath for contrast (drawn from same geo but heavier stroke)
      try {
        const halo = L.geoJSON(geo, { style: { color: 'rgba(0,0,0,0.45)', weight: 6, fillOpacity: 0 } }).addTo(map);
        halo.bringToBack();
      } catch (e) { /* ignore */ }

      // add labels for each state using centroid of its bounds
      try {
        const features = geo.features || [];
        features.forEach(feat => {
          const props = feat.properties || {};
          const name = (props.NAME_1 || props.NAME || props.name || props.STATE || props.ST_NM || props.NAME_2 || '').toString();
          if (!name) return;
          try {
            const single = L.geoJSON(feat);
            const bounds = single.getBounds();
            const center = bounds.getCenter();
            const icon = L.divIcon({
              className: 'state-label',
              html: `<div style="color:#ffffff; text-shadow: 0 0 6px rgba(0,0,0,0.9); font-weight:700; font-size:12px; pointer-events:none;">${name}</div>`,
              iconSize: null
            });
            L.marker(center, { icon: icon, interactive: false }).addTo(map);
          } catch (e) { /* ignore label placement errors */ }
        });
      } catch (e) { /* ignore */ }

      // fit and constrain map to India bounds
      try {
        const bounds = statesLayer.getBounds();
        map.fitBounds(bounds.pad(0.1));
        map.setMaxBounds(bounds.pad(0.2));
      } catch (e) {}

    }).catch(() => {
      // If no states geojson found, do nothing (avoid drawing bbox)
      console.warn('india_states.geojson not found - state boundaries not drawn');
    });
  })();

  fetch('/suggest?q=')
    .then(r => r.json())
    .then(list => {
      list.forEach(item => {
        // call search to get lat/lon and zone
        fetch('/search?taluka=' + encodeURIComponent(item.label))
          .then(r => r.json())
          .then(data => {
            const color = data.zone === 'Red Zone' ? 'red' : (data.zone === 'Orange Zone' ? 'orange' : 'green');
            // try to fetch polygon bounds
            fetch('/bounds?taluka=' + encodeURIComponent(item.label))
              .then(r2 => {
                if (!r2.ok) throw new Error('no bounds');
                return r2.json();
              })
              .then(geo => {
                const layer = L.geoJSON(geo, { style: { color: color, weight: 1.5, fillOpacity: 0.35 } }).addTo(map);
                layer.bindPopup(`<strong>${data.district} | ${data.taluka}</strong><br/>Zone: <span style='color:${color}'>${data.zone}</span><br/><a href='/dashboard?taluka=${encodeURIComponent(item.label)}'>Open dashboard</a>`);
                // store layer by label for later lookup
                try { window.MAP_LAYERS[item.label] = layer; } catch(e){}
              })
              .catch(() => {
                // skip adding point markers when polygon bounds are not available to avoid inaccurate pseudo-coordinates
                // optionally we could add a low-visibility marker; for now do nothing.
              });
          }).catch(()=>{});
      });
    });

  // Hook up GeoJSON upload control (dev-only). When user selects a file, POST to /upload_geo
  const geoInput = document.getElementById('geoUpload');
  const geoStatus = document.getElementById('geoStatus');
  if (geoInput) {
    geoInput.addEventListener('change', () => {
      const f = geoInput.files[0];
      if (!f) return;
      const fd = new FormData(); fd.append('geo', f);
      geoStatus.textContent = 'Uploading...';
      fetch('/upload_geo', { method: 'POST', body: fd })
        .then(r => r.json())
        .then(resp => {
          if (resp && resp.ok) {
            geoStatus.textContent = 'Uploaded. Refreshing map...';
            setTimeout(() => window.location.reload(), 800);
          } else {
            geoStatus.textContent = (resp.error || 'Upload failed');
          }
        }).catch(err => { geoStatus.textContent = 'Upload error'; });
    });
  }
});
