// Home page interactive image modal and preview
document.addEventListener('DOMContentLoaded', () => {
  const img = document.getElementById('homeSnapshot');
  if (!img) return;

  // If the snapshot image is broken or missing, hide snapshot visuals (no placeholder text)
  function hideSnapshotElements() {
    // hide the image and any floating badge; do not inject placeholders
    img.style.display = 'none';
    const badge = document.getElementById('snapshotBadge');
    if (badge) badge.style.display = 'none';
    // remove any previously created placeholder if present (cleanup from older runs)
    const existing = document.getElementById('snapshotPlaceholder');
    if (existing) existing.remove();
  }

  // attach handlers for image load error / missing file
  img.addEventListener('error', () => {
    hideSnapshotElements();
  });
  // If already failed to load (cache), check naturalWidth
  if (img.complete && img.naturalWidth === 0) {
    hideSnapshotElements();
  }

  // When the image successfully loads, ensure the badge is visible and remove placeholder if present
  img.addEventListener('load', () => {
    const badge = document.getElementById('snapshotBadge');
    if (badge) badge.style.display = '';
    const ph = document.getElementById('snapshotPlaceholder');
    if (ph) ph.remove();
    img.style.display = '';
  });

  // create modal container
  const modal = document.createElement('div');
  modal.id = 'snapshotModal';
  // include 'flex' so items-center/justify-center work when visible
  modal.className = 'fixed inset-0 bg-black/50 hidden flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="modal-panel bg-white rounded-lg w-11/12 md:w-3/4 lg:w-1/2 p-4 shadow-lg max-h-[85vh] overflow-auto">
      <div class="flex justify-between items-start">
        <h3 class="text-lg font-semibold text-green-700">Snapshot Preview</h3>
        <button id="closeModal" class="text-gray-600 hover:text-gray-900">&times;</button>
      </div>
      <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="text-sm text-gray-600">Search Taluka</label>
          <input id="modalSearch" class="w-full p-2 border rounded mt-1" placeholder="Type taluka or district" />
          <div id="modalSuggestions" class="mt-2 max-h-40 overflow-auto"></div>
        </div>
        <div>
          <div id="previewInfo" class="p-2 bg-gray-50 rounded h-full flex flex-col">
            <div id="previewZone" class="font-semibold text-sm"></div>
            <canvas id="previewChart" class="mt-2" height="160"></canvas>
            <div class="mt-2 flex items-center gap-2">
              <button id="openFull" class="px-3 py-1 bg-green-600 text-white rounded">Open full dashboard</button>
              <button id="panMap" class="px-3 py-1 bg-blue-600 text-white rounded">Pan to map</button>
            </div>
            <!-- area snapshot below buttons -->
            <div class="mt-3">
              <img id="modalSnapshotImg" src="/static/images/Screenshot.png" alt="snapshot" class="w-full object-cover rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // handle missing modal snapshot image by hiding it (no placeholder)
  const modalImg = modal.querySelector('#modalSnapshotImg');
  if (modalImg) {
    modalImg.addEventListener('error', () => {
      modalImg.style.display = 'none';
    });
    if (modalImg.complete && modalImg.naturalWidth === 0) {
      modalImg.dispatchEvent(new Event('error'));
    }
  }

  const closeModal = modal.querySelector('#closeModal');
  closeModal.addEventListener('click', () => {
    modal.classList.add('hidden');
    // restore main map visibility when modal closes
    const mainMap = document.getElementById('map');
    if (mainMap) mainMap.style.visibility = '';
  });

  img.addEventListener('click', () => {
    modal.classList.remove('hidden');
    document.getElementById('modalSearch').focus();
    // hide the main map while the modal is open to prevent visual overlap
    const mainMap = document.getElementById('map');
    if (mainMap) mainMap.style.visibility = 'hidden';
  });

  // Suggestions and preview
  const modalSearch = modal.querySelector('#modalSearch');
  const modalSuggestions = modal.querySelector('#modalSuggestions');
  const previewZone = modal.querySelector('#previewZone');
  const openFull = modal.querySelector('#openFull');
  const previewCtx = modal.querySelector('#previewChart').getContext('2d');
  let previewChart = null;
  let lastData = null;

  modalSearch.addEventListener('input', () => {
    const q = modalSearch.value.trim();
    fetch('/suggest?q=' + encodeURIComponent(q))
      .then(r => r.json())
      .then(list => {
        modalSuggestions.innerHTML = '';
        list.slice(0,10).forEach(item => {
          const el = document.createElement('div');
          el.className = 'p-2 border-b hover:bg-gray-100 cursor-pointer';
          el.textContent = item.label;
          el.addEventListener('click', () => {
            // fetch preview data
            fetch('/search?taluka=' + encodeURIComponent(item.label))
              .then(r => r.json())
              .then(data => {
                lastData = data;
                previewZone.innerHTML = `<div class=\"px-2 py-1 rounded text-white font-semibold ${data.zone === 'Red Zone' ? 'bg-red-600' : (data.zone === 'Orange Zone' ? 'bg-orange-500' : 'bg-green-600')}\">${data.zone}</div><div class=\"text-sm text-gray-600 mt-1\">Slope: ${data.slope.toFixed(4)}</div><div class=\"text-sm text-gray-600\">${data.district} | ${data.taluka}</div>`;
                renderPreviewChart(data.years, data.ndvi_values);
              });
          });
          modalSuggestions.appendChild(el);
        });
      });
  });

  function renderPreviewChart(years, ndvi) {
    if (previewChart) { previewChart.destroy(); previewChart = null; }
    previewChart = new Chart(previewCtx, {
      type: 'line',
      data: { labels: years, datasets: [{ label: 'NDVI', data: ndvi, borderColor: 'rgba(16,185,129,1)', backgroundColor: 'rgba(16,185,129,0.1)', tension:0.2 }] },
      options: { responsive: true, maintainAspectRatio:false }
    });
  }

  openFull.addEventListener('click', () => {
    if (!lastData) return;
    // navigate to dashboard and pass taluka param
    const label = encodeURIComponent(lastData.district + ' | ' + lastData.taluka);
    window.location = '/dashboard?taluka=' + label;
  });

  // Pan to map button - if MAIN_MAP and MAP_LAYERS exist, pan/fit and open popup
  const panBtn = modal.querySelector('#panMap');
  panBtn.addEventListener('click', () => {
    if (!lastData) return;
    const key = lastData.district + ' | ' + lastData.taluka;
    try {
      const layer = window.MAP_LAYERS && window.MAP_LAYERS[key];
      if (layer) {
        if (layer.getBounds) {
          window.MAIN_MAP.fitBounds(layer.getBounds());
        } else if (layer.getLatLng) {
          window.MAIN_MAP.setView(layer.getLatLng(), 12);
        } else if (layer.getLatLngs) {
          // try to compute center
          const b = layer.getBounds(); window.MAIN_MAP.fitBounds(b);
        }
        // open popup if available
        if (layer.openPopup) layer.openPopup();
      } else if (window.MAIN_MAP) {
        // fallback: pan to lat/lon returned by data
        window.MAIN_MAP.setView([lastData.lat, lastData.lon], 11);
      }
    } catch (e) { console.warn('pan map failed', e); }
  });

});
