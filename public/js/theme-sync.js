(() => {
  function apply() {
    let prefs = {};
    try { prefs = JSON.parse(localStorage.getItem('estoque-v2-prefs') || '{}'); } catch {}
    const choice = prefs.theme || 'dark';
    const theme = choice === 'system'
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : choice;
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
  }
  apply();
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply); } catch {}
  window.addEventListener('storage', e => { if (e.key === 'estoque-v2-prefs') apply(); });
})();
