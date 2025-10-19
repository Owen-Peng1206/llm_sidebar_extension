const form   = document.getElementById('settingsForm');
const statusel = document.getElementById('status');
const providerInput = document.getElementById('provider');
const apiKeyInput   = document.getElementById('apiKey');
const baseURLInput  = document.getElementById('baseURL');
const modelInput    = document.getElementById('model');
const saveBtn       = document.getElementById('saveBtn');

async function populate() {
  const config = await new Promise((resolve) => {
    chrome.storage.sync.get('providerConfig', (data) => {
      resolve(data.providerConfig || null);
    });
  });

  if (!config) return;
  providerInput.value = config.id || '';
  apiKeyInput.value   = config.apiKey || '';
  baseURLInput.value  = config.baseURL || '';
  modelInput.value    = config.model || '';
}

saveBtn.addEventListener('click', async () => {
  const config = {
    id: providerInput.value,
    apiKey:   apiKeyInput.value,
    baseURL:  baseURLInput.value,
    model:    modelInput.value
  };
  try {
    await new Promise((resolve, reject) => {
      chrome.storage.sync.set({ providerConfig: config }, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });
    statusel.textContent = '✔︎ Saved';
    statusel.style.color  = 'green';
  } catch (e) {
    statusel.textContent = '❌ Failed';
    statusel.style.color  = 'red';
  }
});

populate();