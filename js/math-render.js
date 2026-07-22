(function () {
  const delimiters = [
    { left: '$$', right: '$$', display: true },
    { left: '$', right: '$', display: false },
  ];

  function renderMathIn(element) {
    if (!element || typeof window.renderMathInElement !== 'function') return element;

    try {
      window.renderMathInElement(element, {
        delimiters,
        throwOnError: false,
        trust: false,
      });
    } catch (error) {
      // Keep the escaped source visible if the renderer itself cannot run.
      console.warn('Could not render math in this element.', error);
    }

    return element;
  }

  window.renderMathIn = renderMathIn;
}());
