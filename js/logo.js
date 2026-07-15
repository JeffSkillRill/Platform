(function () {
  const assetRoot = new URL('../assets/brand/', document.currentScript.src);
  const sources = {
    color: {
      128: new URL('4prep-logo-color-128.png', assetRoot).href,
      512: new URL('4prep-logo-color-512.png', assetRoot).href,
    },
    white: {
      128: new URL('4prep-logo-white-128.png', assetRoot).href,
      512: new URL('4prep-logo-white-512.png', assetRoot).href,
    },
  };

  class FourPrepLogo extends HTMLElement {
    static get observedAttributes() {
      return ['size', 'variant', 'theme-aware'];
    }

    connectedCallback() {
      if (!this.image) {
        this.image = document.createElement('img');
        this.image.alt = '4Prep';
        this.image.decoding = 'async';
        this.image.draggable = false;
        this.replaceChildren(this.image);
      }

      this.render();
      this.observeTheme();
    }

    disconnectedCallback() {
      this.themeObserver?.disconnect();
      this.colorSchemeQuery?.removeEventListener?.('change', this.handleColorSchemeChange);
    }

    attributeChangedCallback() {
      if (this.isConnected) {
        this.render();
        this.observeTheme();
      }
    }

    get size() {
      const value = Number.parseInt(this.getAttribute('size') || '40', 10);
      return Number.isFinite(value) && value > 0 ? Math.min(value, 512) : 40;
    }

    get requestedVariant() {
      return this.getAttribute('variant') === 'white' ? 'white' : 'color';
    }

    get resolvedVariant() {
      if (!this.hasAttribute('theme-aware')) return this.requestedVariant;
      const explicitTheme = document.documentElement.dataset.theme;
      const dark = explicitTheme
        ? explicitTheme === 'dark'
        : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
      return dark ? 'white' : 'color';
    }

    render() {
      if (!this.image) return;
      const size = this.size;
      const variant = this.resolvedVariant;
      const sourceSize = size <= 128 ? 128 : 512;

      this.style.setProperty('--logo-size', `${size}px`);
      this.image.width = size;
      this.image.height = size;
      this.image.src = sources[variant][sourceSize];
      this.image.dataset.variant = variant;
    }

    observeTheme() {
      const needsTheme = this.hasAttribute('theme-aware');
      if (!needsTheme) {
        this.themeObserver?.disconnect();
        this.themeObserver = null;
        this.colorSchemeQuery?.removeEventListener?.('change', this.handleColorSchemeChange);
        this.colorSchemeQuery = null;
        return;
      }

      if (!this.themeObserver) {
        this.themeObserver = new MutationObserver(() => this.render());
        this.themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-theme'],
        });
      }

      if (!this.colorSchemeQuery) {
        this.colorSchemeQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
        this.handleColorSchemeChange = () => this.render();
        this.colorSchemeQuery?.addEventListener?.('change', this.handleColorSchemeChange);
      }
    }
  }

  if (!customElements.get('fourprep-logo')) {
    customElements.define('fourprep-logo', FourPrepLogo);
  }

  // Programmatic equivalent for pages that build UI in JavaScript:
  // Logo({ size: 40, variant: 'color', themeAware: true }).
  window.Logo = function Logo({ size = 40, variant = 'color', themeAware = false } = {}) {
    const logo = document.createElement('fourprep-logo');
    logo.setAttribute('size', size);
    logo.setAttribute('variant', variant === 'white' ? 'white' : 'color');
    if (themeAware) logo.setAttribute('theme-aware', '');
    return logo;
  };
}());
