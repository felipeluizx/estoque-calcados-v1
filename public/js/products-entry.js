(() => {
  const goProducts = (event) => {
    const target = event?.target?.closest?.('#manageProductsBtn');
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    window.location.href = '/products.html';
  };

  // Captura no documento antes que o roteador SPA transforme o clique em #produtos.
  document.addEventListener('click', goProducts, true);

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('manageProductsBtn');
    if (!btn) return;
    btn.removeAttribute('data-page');
    btn.removeAttribute('data-target-page');
    btn.onclick = null;
    btn.setAttribute('type', 'button');
  });
})();
