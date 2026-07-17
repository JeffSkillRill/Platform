(function () {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const skeletonStates = new WeakMap();
  const animatedContainers = new WeakSet();
  const buttonStates = new WeakMap();
  const modalTimers = new WeakMap();
  let pageTarget = null;

  document.documentElement.classList.add('sat-animations');

  function resolveElement(target) {
    return typeof target === 'string' ? document.querySelector(target) : target;
  }

  function skeletonShape(widthClass = '') {
    return `<span class="sat-skeleton-line ${widthClass}" aria-hidden="true"></span>`;
  }

  function skeletonTemplate(type, options) {
    const count = Math.max(1, Number(options.count) || (type === 'stat' ? 1 : 3));
    if (type === 'table-row') {
      const columns = Math.max(1, Number(options.columns) || 5);
      return Array.from({ length: count }, () => `
        <tr class="sat-skeleton-table-row" data-sat-skeleton="true" aria-hidden="true">
          ${Array.from({ length: columns }, (_, index) => `<td>${skeletonShape(index === 0 ? 'is-medium' : index === columns - 1 ? 'is-short' : '')}</td>`).join('')}
        </tr>`).join('');
    }
    if (type === 'list-item') {
      return `<div class="sat-skeleton-stack" data-sat-skeleton="true" aria-hidden="true">${Array.from({ length: count }, () => `
        <div class="sat-skeleton-list-item">
          <span class="sat-skeleton-dot"></span>
          <span class="sat-skeleton-copy">${skeletonShape('is-title')}${skeletonShape('is-medium')}</span>
          <span class="sat-skeleton-block"></span>
        </div>`).join('')}</div>`;
    }
    if (type === 'stat') {
      return `<div class="sat-skeleton-stat" data-sat-skeleton="true" aria-hidden="true">
        ${skeletonShape('is-medium')}${skeletonShape('is-title')}${skeletonShape('is-short')}
      </div>`;
    }
    return `<div class="sat-skeleton-stack" data-sat-skeleton="true" aria-hidden="true">${Array.from({ length: count }, () => `
      <div class="sat-skeleton-card">
        ${skeletonShape('is-title')}${skeletonShape()}${skeletonShape('is-medium')}
      </div>`).join('')}</div>`;
  }

  function animateItems(container, type) {
    if (animatedContainers.has(container)) return;
    animatedContainers.add(container);
    if (type === 'stat') return;
    let items = [];
    if (container.matches('tbody')) items = Array.from(container.children);
    else if (type === 'card') {
      items = Array.from(container.querySelectorAll(':scope > .card, :scope > article, :scope > .test-card, :scope > .class-card'));
      if (!items.length) items = Array.from(container.querySelectorAll('.card, .breakdown-card, .test-card, .class-card'));
    }
    else items = Array.from(container.children);
    if (items.length === 1 && items[0].children.length > 1) {
      const nested = items[0].querySelectorAll(':scope > .card, :scope > .list-row, :scope > .word-admin-row, :scope > .lb-row');
      if (nested.length) items = Array.from(nested);
    }
    items.slice(0, 11).forEach((item, index) => {
      const delay = Math.min(index * 40, 400);
      item.style.setProperty('--sat-stagger-delay', `${delay}ms`);
      item.classList.add('sat-stagger-item');
      window.setTimeout(() => {
        item.classList.remove('sat-stagger-item');
        item.style.removeProperty('--sat-stagger-delay');
      }, 240 + delay);
    });
  }

  function reveal(target, options = {}) {
    const container = resolveElement(target);
    if (!container) return;
    const state = skeletonStates.get(container);
    if (state?.observer) state.observer.disconnect();
    container.querySelectorAll('[data-sat-skeleton="true"], .sat-skeleton-layer').forEach((node) => node.remove());
    container.classList.remove('sat-skeleton-overlay-host');
    container.removeAttribute('aria-busy');
    const type = options.type || state?.type || container.dataset.skeleton || 'list-item';
    const pageIsEntering = container.closest('.sat-page-target')?.classList.contains('sat-page-enter-active');
    if (pageIsEntering) {
      animatedContainers.add(container);
    } else {
      container.classList.add('sat-content-reveal');
      window.setTimeout(() => container.classList.remove('sat-content-reveal'), 220);
      animateItems(container, type);
    }
    skeletonStates.delete(container);
  }

  function skeleton(target, type = 'card', options = {}) {
    const container = resolveElement(target);
    if (!container || skeletonStates.has(container)) return null;
    const config = typeof options === 'number' ? { count: options } : options;
    const overlay = config.overlay === true || container.dataset.skeletonMode === 'overlay';
    const html = skeletonTemplate(type, config);
    container.setAttribute('aria-busy', 'true');

    if (overlay) {
      container.classList.add('sat-skeleton-overlay-host');
      const layer = document.createElement('div');
      layer.className = 'sat-skeleton-layer';
      layer.innerHTML = html;
      container.prepend(layer);
    } else {
      container.innerHTML = html;
    }

    const observer = new MutationObserver((records) => {
      const layer = container.querySelector(':scope > .sat-skeleton-layer');
      const changedOutsideLayer = overlay && records.some((record) => !layer?.contains(record.target));
      if (!container.querySelector('[data-sat-skeleton="true"]') || changedOutsideLayer) {
        reveal(container, { type });
      }
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    skeletonStates.set(container, { observer, type, overlay });
    return container;
  }

  function markSkeletonReady(target) {
    const container = resolveElement(target);
    if (!container) return;
    container.dataset.skeletonReady = 'true';
    reveal(container);
    delete container.dataset.skeletonReady;
  }

  function setButtonLoading(target, loading, label = 'Working') {
    const button = resolveElement(target);
    if (!button) return;
    if (loading) {
      if (buttonStates.has(button)) return;
      buttonStates.set(button, {
        html: button.innerHTML,
        disabled: button.disabled,
        minWidth: button.style.minWidth,
      });
      button.style.minWidth = `${Math.ceil(button.getBoundingClientRect().width)}px`;
      button.disabled = true;
      button.classList.add('btn-loading');
      button.setAttribute('aria-busy', 'true');
      button.innerHTML = `<span class="sat-button-spinner" aria-hidden="true"></span><span class="sat-sr-only">${String(label).replace(/[&<>"']/g, '')}</span>`;
      return;
    }
    const state = buttonStates.get(button);
    if (!state) return;
    button.innerHTML = state.html;
    button.disabled = state.disabled;
    button.style.minWidth = state.minWidth;
    button.classList.remove('btn-loading');
    button.removeAttribute('aria-busy');
    buttonStates.delete(button);
  }

  async function withButtonLoading(target, task, label) {
    setButtonLoading(target, true, label);
    try {
      return await task();
    } finally {
      setButtonLoading(target, false);
    }
  }

  function showLoader(label = 'Loading…', options = {}) {
    const delay = Number(options.delay ?? 150);
    let overlay = null;
    let hidden = false;
    const timer = window.setTimeout(() => {
      if (hidden) return;
      overlay = document.createElement('div');
      overlay.className = 'sat-loader-overlay';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'polite');
      overlay.innerHTML = `<div class="sat-loader-card"><span class="sat-loader-spinner" aria-hidden="true"></span><span>${String(label).replace(/[&<>"']/g, '')}</span></div>`;
      document.body.appendChild(overlay);
      window.requestAnimationFrame(() => overlay?.classList.add('is-visible'));
    }, Math.max(0, delay));

    return {
      hide() {
        if (hidden) return;
        hidden = true;
        window.clearTimeout(timer);
        if (!overlay) return;
        overlay.classList.remove('is-visible');
        overlay.classList.add('is-hiding');
        window.setTimeout(() => overlay?.remove(), reducedMotion.matches ? 0 : 150);
      },
    };
  }

  function openModal(target) {
    const modal = resolveElement(target);
    if (!modal) return;
    const pending = modalTimers.get(modal);
    if (pending) {
      window.clearTimeout(pending.timer);
      modal.removeEventListener('animationend', pending.onEnd);
      modalTimers.delete(modal);
    }
    modal.classList.remove('is-closing');
    if (modal.style.display === 'none') modal.style.display = 'flex';
    modal.classList.add('open');
  }

  function closeModal(target) {
    const modal = resolveElement(target);
    if (!modal) return;
    const pending = modalTimers.get(modal);
    if (pending) {
      window.clearTimeout(pending.timer);
      modal.removeEventListener('animationend', pending.onEnd);
      modalTimers.delete(modal);
    }
    if (reducedMotion.matches || !modal.classList.contains('open')) {
      modal.classList.remove('open', 'is-closing');
      if (modal.id.startsWith('modal-')) modal.style.display = 'none';
      return;
    }
    modal.classList.add('is-closing');
    const finish = () => {
      const state = modalTimers.get(modal);
      if (state) {
        window.clearTimeout(state.timer);
        modal.removeEventListener('animationend', state.onEnd);
      }
      modal.classList.remove('open', 'is-closing');
      if (modal.id.startsWith('modal-')) modal.style.display = 'none';
      modalTimers.delete(modal);
    };
    const onEnd = (event) => {
      if (event.target === modal) finish();
    };
    modal.addEventListener('animationend', onEnd);
    const timer = window.setTimeout(finish, 220);
    modalTimers.set(modal, { timer, onEnd });
  }

  function showToast(target, duration = 2800) {
    const toast = resolveElement(target);
    if (!toast) return;
    window.clearTimeout(Number(toast.dataset.satToastTimer) || 0);
    toast.classList.add('show');
    const timer = window.setTimeout(() => {
      toast.classList.remove('show');
      delete toast.dataset.satToastTimer;
    }, duration);
    toast.dataset.satToastTimer = String(timer);
  }

  function animateSwap(target) {
    const element = resolveElement(target);
    if (!element || reducedMotion.matches) return;
    if (typeof element.animate === 'function') {
      element.animate(
        [
          { opacity: 0.55, transform: 'translate3d(0, 4px, 0)' },
          { opacity: 1, transform: 'translate3d(0, 0, 0)' },
        ],
        { duration: 150, easing: 'ease-out' }
      );
      return;
    }
    element.classList.remove('sat-question-enter');
    window.requestAnimationFrame(() => element.classList.add('sat-question-enter'));
    window.setTimeout(() => element.classList.remove('sat-question-enter'), 170);
  }

  function getPageTarget() {
    return document.querySelector('[data-page-transition-target], main, .main, body > .content, .wrapper, body > .card, #questionArea');
  }

  function initializeSkeletons() {
    document.querySelectorAll('[data-skeleton]').forEach((container) => {
      skeleton(container, container.dataset.skeleton || 'card', {
        count: Number(container.dataset.skeletonCount) || undefined,
        columns: Number(container.dataset.skeletonColumns) || undefined,
        overlay: container.dataset.skeletonMode === 'overlay',
      });
    });
  }

  function clearPageEntranceAfterAnimation(target) {
    if (!target) return;
    const onEnd = (event) => {
      if (event.target !== target || event.animationName !== 'sat-page-enter') return;
      target.classList.remove('sat-page-enter-active');
      target.removeEventListener('animationend', onEnd);
    };
    target.addEventListener('animationend', onEnd);
  }

  function initializePage() {
    initializeSkeletons();
    pageTarget = getPageTarget();
    if (pageTarget) {
      pageTarget.classList.add('sat-page-target');
      if (!reducedMotion.matches) {
        pageTarget.classList.add('sat-page-enter-pending');
        window.requestAnimationFrame(() => {
          pageTarget?.classList.remove('sat-page-enter-pending');
          pageTarget?.classList.add('sat-page-enter-active');
          clearPageEntranceAfterAnimation(pageTarget);
        });
      }
    }
    document.documentElement.classList.add('sat-page-ready');
  }

  document.addEventListener('DOMContentLoaded', initializePage, { once: true });
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    pageTarget = pageTarget || getPageTarget();
    pageTarget?.classList.remove('sat-page-enter-pending');
    pageTarget?.classList.add('sat-page-enter-active');
    clearPageEntranceAfterAnimation(pageTarget);
    document.documentElement.classList.add('sat-page-ready');
  });

  window.satAnimations = {
    prefersReducedMotion: () => reducedMotion.matches,
    skeleton,
    reveal,
    markSkeletonReady,
    setButtonLoading,
    withButtonLoading,
    showLoader,
    openModal,
    closeModal,
    showToast,
    animateSwap,
  };
  window.satSkeleton = skeleton;
  window.satReveal = reveal;
  window.satSetButtonLoading = setButtonLoading;
  window.satShowLoader = showLoader;
}());
