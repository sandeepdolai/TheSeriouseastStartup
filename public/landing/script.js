(() => {
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  // Mobile navigation
  const menuToggle = $('.menu-toggle');
  const mobileMenu = $('.mobile-menu');
  menuToggle?.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') !== 'true';
    menuToggle.setAttribute('aria-expanded', String(open));
    mobileMenu?.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
  });
  $$('.mobile-menu a').forEach(link => link.addEventListener('click', () => {
    menuToggle?.setAttribute('aria-expanded', 'false');
    mobileMenu?.classList.remove('open');
    document.body.classList.remove('menu-open');
  }));

  // Accessible interactive demo modal
  const demoModal = $('#demo-modal');
  let previouslyFocused = null;
  const openDemo = () => {
    if (!demoModal) return;
    previouslyFocused = document.activeElement;
    demoModal.classList.add('open');
    demoModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    $('[data-close-demo]', demoModal)?.focus();
  };
  const closeDemo = () => {
    if (!demoModal?.classList.contains('open')) return;
    demoModal.classList.remove('open');
    demoModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    const returnFocus = previouslyFocused;
    previouslyFocused = null;
    if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
  };
  $('#watch-demo')?.addEventListener('click', openDemo);
  $$('[data-close-demo]').forEach(el => el.addEventListener('click', closeDemo));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeDemo();
      menuToggle?.setAttribute('aria-expanded', 'false');
      mobileMenu?.classList.remove('open');
      document.body.classList.remove('menu-open');
    }
    if (event.key === 'Tab' && demoModal?.classList.contains('open')) {
      const focusable = $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', demoModal)
        .filter(element => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  // Theme preview buttons
  const descriptions = {
    minimal: 'A quiet, minimal style with room for your words and photos.',
    playful: 'A warm, expressive look for a personal digital gift.',
    neon: 'Bold accents for a playful, eye-catching creation.'
  };
  $$('.theme-button').forEach(button => button.addEventListener('click', () => {
    const theme = button.dataset.theme || 'minimal';
    $$('.theme-button').forEach(item => item.classList.toggle('selected', item === button));
    document.body.dataset.theme = theme;
    const description = $('#theme-description');
    if (description) description.textContent = descriptions[theme] || descriptions.minimal;
  }));

  // Build the illustrative creation activity grid deterministically.
  $$('.heatmap').forEach((grid, gridIndex) => {
    const total = grid.classList.contains('small-heatmap') ? 65 : 175;
    const activeCount = grid.classList.contains('small-heatmap') ? 23 : 61;
    for (let i = 0; i < total; i += 1) {
      const cell = document.createElement('i');
      const score = (i * 37 + gridIndex * 29 + (i % 7) * 11) % 100;
      if (score < (activeCount / total) * 100) cell.className = score < 10 ? 'hot' : score < 24 ? 'warm' : 'mid';
      grid.appendChild(cell);
    }
  });

  // The product panels are illustrative previews, not controls for a separate utility app.

  // Close the demo when jumping to another section from its action.
  $$('[data-close-demo][href]').forEach(link => link.addEventListener('click', closeDemo));
})();