const pageName = document.body?.dataset.page || 'unknown';
console.info(`Encrypted demo page loaded: ${pageName}`);

async function loadFeatureJson() {
  const status = document.getElementById('json-status');
  const list = document.getElementById('feature-list');
  if (!status || !list) return;

  try {
    const response = await fetch('/assets/data/features.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    status.textContent = `Loaded ${data.features.length} features from encrypted JSON.`;
    status.className = 'status-ok';

    for (const feature of data.features) {
      const item = document.createElement('li');
      item.textContent = `${feature.name}: ${feature.coverage}`;
      list.appendChild(item);
    }
  } catch (error) {
    status.textContent = `JSON load failed: ${error.message}`;
    status.className = 'status-warn';
  }
}

async function checkMissingResource() {
  const status = document.getElementById('missing-status');
  if (!status) return;

  try {
    const response = await fetch('/assets/data/missing.json', { cache: 'no-store' });
    status.textContent = response.ok
      ? 'Unexpectedly found missing.json.'
      : `Missing resource returned HTTP ${response.status}, as expected.`;
    status.className = response.ok ? 'status-warn' : 'status-ok';
  } catch (error) {
    status.textContent = `Missing resource failed with network error: ${error.message}`;
    status.className = 'status-warn';
  }
}

loadFeatureJson();
checkMissingResource();
