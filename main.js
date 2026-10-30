document.addEventListener('DOMContentLoaded', () => {
  // 1. Mobile Menu Functionality
  const burgerBtn = document.querySelector('.burger-btn');
  const overlay = document.querySelector('.mobile-overlay');
  const sheet = document.querySelector('.mobile-sheet');
  const mobileLinks = document.querySelectorAll('.mobile-nav a');

  function openMenu() {
    document.body.classList.add('menu-open');
    burgerBtn.setAttribute('aria-expanded', 'true');
    overlay.removeAttribute('hidden');
    sheet.removeAttribute('hidden');
  }

  function closeMenu() {
    document.body.classList.remove('menu-open');
    burgerBtn.setAttribute('aria-expanded', 'false');
    overlay.setAttribute('hidden', '');
    sheet.setAttribute('hidden', '');
  }

  if (burgerBtn) {
    burgerBtn.addEventListener('click', () => {
      const isOpen = document.body.classList.contains('menu-open');
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });
  }

  if (overlay) {
    overlay.addEventListener('click', closeMenu);
  }

  mobileLinks.forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.body.classList.contains('menu-open')) {
      closeMenu();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 720 && document.body.classList.contains('menu-open')) {
      closeMenu();
    }
  });

  // 2. Stats Count-up Animation with easeOutCubic
  const statCards = document.querySelectorAll('.stat-card');
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
  }

  function animateValue(elem, target, decimals, duration, delay) {
    if (prefersReduced) {
      elem.textContent = target.toFixed(decimals);
      return;
    }

    setTimeout(() => {
      let startTimestamp = null;

      function step(timestamp) {
        if (!startTimestamp) startTimestamp = timestamp;
        const elapsed = timestamp - startTimestamp;
        const progress = Math.min(elapsed / duration, 1);
        const currentVal = easeOutCubic(progress) * target;

        elem.textContent = currentVal.toFixed(decimals);

        if (progress < 1) {
          window.requestAnimationFrame(step);
        } else {
          elem.textContent = target.toFixed(decimals);
        }
      }

      window.requestAnimationFrame(step);
    }, delay);
  }

  let animated = false;
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !animated) {
          animated = true;
          statCards.forEach((card, i) => {
            const valElem = card.querySelector('.stat-val');
            if (!valElem) return;

            const target = parseFloat(valElem.getAttribute('data-target') || '0');
            const decimals = parseInt(valElem.getAttribute('data-decimals') || '0', 10);
            const duration = 1500 + i * 80;
            const delay = 480 + i * 90;

            animateValue(valElem, target, decimals, duration, delay);
          });
        }
      });
    },
    { threshold: 0.25 }
  );

  const footer = document.querySelector('.stats-footer');
  if (footer) {
    observer.observe(footer);
  }
});
