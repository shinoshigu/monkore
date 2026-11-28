async function loadMoncolleCatalog() {
  if (location.protocol === 'file:') {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = './assets/data/characters.local.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error(moncolleLocale.t('characters.local.js を開けませんでした')));
      document.head.append(script);
    });
    return window.moncolleLocalCatalog;
  }

  const response = await fetch('./assets/data/characters.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('characters.json HTTP ' + response.status);
  return response.json();
}

(async () => {
  const status = document.getElementById('startup-status');
  try {
    const rules = createMoncolleCharacters(await loadMoncolleCatalog());
    initializeMoncolleStage(rules);
    initializeMoncolleImageImport(window.moncolleCalculator);
    document.getElementById('partyImageFile').disabled = false;
    status.hidden = true;
  } catch (error) {
    console.error(error);
    status.textContent = moncolleLocale.t('計算機を起動できませんでした。{0}', error.message);
  }
})();
