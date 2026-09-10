document.addEventListener('DOMContentLoaded', () => {
  const legacyTargets = [document.getElementById('openLegacyBtn'), document.getElementById('legacyStockLink')].filter(Boolean);
  legacyTargets.forEach((el) => {
    el.onclick = (event) => {
      event?.preventDefault?.();
      window.location.href = '/index.html';
    };
  });
});
