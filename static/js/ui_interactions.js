// UI interactions: sidebar toggle, simple ripple effect helper, and suggestion keyboard nav
document.addEventListener('DOMContentLoaded', () => {
  // sidebar toggle for small screens
  const menuToggle = document.getElementById('menu-toggle');
  const aside = document.querySelector('aside');
  if (menuToggle && aside) {
    menuToggle.addEventListener('click', () => {
      // toggle showing the sidebar on mobile
      if (aside.classList.contains('hidden')) {
        aside.classList.remove('hidden');
        aside.classList.add('block');
      } else {
        aside.classList.add('hidden');
        aside.classList.remove('block');
      }
    });
  }

  // add ripple class behavior to .ripple elements
  document.querySelectorAll('.ripple').forEach(btn => {
    btn.addEventListener('click', function (e) {
      const circle = document.createElement('span');
      const d = Math.max(btn.clientWidth, btn.clientHeight);
      circle.style.width = circle.style.height = d + 'px';
      circle.style.left = e.clientX - btn.getBoundingClientRect().left - d/2 + 'px';
      circle.style.top = e.clientY - btn.getBoundingClientRect().top - d/2 + 'px';
      circle.style.position = 'absolute';
      circle.style.borderRadius = '50%';
      circle.style.background = 'rgba(255,255,255,0.24)';
      circle.style.transform = 'scale(0)';
      circle.style.transition = 'transform 600ms ease-out, opacity 600ms ease-out';
      circle.className = 'ripple-circle';
      btn.appendChild(circle);
      requestAnimationFrame(() => circle.style.transform = 'scale(6)');
      setTimeout(() => { circle.style.opacity = '0'; }, 500);
      setTimeout(() => { circle.remove(); }, 800);
    });
  });

  // keyboard navigation for suggestions (simple) - for header suggestions only
  const search = document.getElementById('searchBox');
  const suggestions = document.getElementById('suggestions');
  if (search && suggestions) {
    let idx = -1;
    search.addEventListener('keydown', (e) => {
      const items = suggestions.querySelectorAll('.suggest-item');
      if (!items.length) return;
      if (e.key === 'ArrowDown') { idx = Math.min(items.length-1, idx+1); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { idx = Math.max(0, idx-1); e.preventDefault(); }
      else if (e.key === 'Enter') { if (idx >=0 && items[idx]) items[idx].click(); }
      items.forEach((it,i)=> it.classList.toggle('active', i===idx));
    });
  }
});
