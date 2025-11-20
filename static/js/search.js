// Handles search box, suggestions and navigation
document.addEventListener('DOMContentLoaded', () => {
  // Support both header search and map-embedded search.
  const headerBox = document.getElementById('searchBox');
  const headerSuggestions = document.getElementById('suggestions');
  const mapBox = document.getElementById('mapSearchBox');
  const mapSuggestions = document.getElementById('mapSuggestions');

  // helper to get a primary current value (map search preferred when present)
  function getPrimaryValue() {
    if (mapBox && mapBox.value.trim()) return mapBox.value.trim();
    if (headerBox && headerBox.value.trim()) return headerBox.value.trim();
    return '';
  }

  // utility to set value on all search inputs
  function setAllSearchValues(val) {
    [headerBox, mapBox].forEach(b => { if (b) b.value = val; });
  }

  // attach handlers to a given pair of box+suggestions
  function attachHandlers(box, suggestionsEl) {
    if (!box || !suggestionsEl) return;
    let timer = null;
    box.addEventListener('input', () => {
      const q = box.value.trim();
      clearTimeout(timer);
      timer = setTimeout(() => fetchSuggestions(q, suggestionsEl), 250);
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = box.value.trim();
        if (val) window.location = '/dashboard?taluka=' + encodeURIComponent(val);
      }
    });
  }

  function fetchSuggestions(q, suggestionsEl) {
    if (!q && q !== '') return;
    fetch('/suggest?q=' + encodeURIComponent(q))
      .then(r => r.json())
      .then(list => {
        suggestionsEl.innerHTML = '';
        if (!list || list.length === 0) { suggestionsEl.classList.add('hidden'); return; }
        list.forEach(item => {
          const el = document.createElement('div');
          el.className = 'p-2 hover:bg-gray-100 cursor-pointer bg-white';
          el.textContent = item.label;
          el.addEventListener('click', () => {
            // set both search inputs so UI stays in sync
            setAllSearchValues(item.label);
            suggestionsEl.classList.add('hidden');
            // If on dashboard, fetch data and dispatch event to render inline
            if (window.location.pathname.startsWith('/dashboard')) {
              fetch('/search?taluka=' + encodeURIComponent(item.label))
                .then(r => r.json())
                .then(data => {
                  const ev = new CustomEvent('talukaSelected', { detail: data });
                  window.dispatchEvent(ev);
                })
                .catch(err => console.error('search fetch failed', err));
            } else {
              window.location = '/dashboard?taluka=' + encodeURIComponent(item.label);
            }
          });
          suggestionsEl.appendChild(el);
        });
        suggestionsEl.classList.remove('hidden');
      });
  }

  // Attach to header and map search (if present)
  attachHandlers(headerBox, headerSuggestions);
  attachHandlers(mapBox, mapSuggestions);

  // Open Dashboard quick button behaviour (index page)
  const openBtn = document.getElementById('open-dashboard');
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      const val = getPrimaryValue();
      if (val) {
        window.location = '/dashboard?taluka=' + encodeURIComponent(val);
      } else {
        window.location = '/dashboard';
      }
    });
  }
});
