document.addEventListener('DOMContentLoaded', () => {
  const productsBtn = document.getElementById('manageProductsBtn');
  if (productsBtn) {
    productsBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign('/products.html');
    }, true);
  }
});
