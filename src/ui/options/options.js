const form = document.getElementById('settingsForm');
const statusel = document.getElementById('status');
const providerInput = document.getElementById('provider');
const apiKeyInput = document.getElementById('apiKey');
const baseURLInput = document.getElementById('baseURL');
const modelInput = document.getElementById('model');
const targetLangSelect = document.getElementById('targetLang');
const saveBtn = document.getElementById('saveBtn');

async function populate() {
  const config = await new Promise((resolve) => {
    chrome.storage.sync.get('providerConfig', (data) => {
      resolve(data.providerConfig || null);
    });
  });

  if (!config) return;
  providerInput.value = config.id || '';
  apiKeyInput.value = config.apiKey || '';
  baseURLInput.value = config.baseURL || '';
  modelInput.value = config.model || '';
  targetLangSelect.value = config.targetLang || '';
  const skinRadio = document.querySelector(`input[name="skin"][value="${config.skin || 'dark'}"]`);
  if (skinRadio) skinRadio.checked = true;
}

saveBtn.addEventListener('click', async () => {
  const config = {
    id: providerInput.value,
    apiKey: apiKeyInput.value,
    baseURL: baseURLInput.value,
    model: modelInput.value,
    targetLang: targetLangSelect ? targetLangSelect.value : '',
    skin: document.querySelector('input[name="skin"]:checked').value
  };
  try {
    await new Promise((resolve, reject) => {
      chrome.storage.sync.set({ providerConfig: config }, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });
    statusel.textContent = '✔︎ Saved';
    statusel.style.color = 'green';
  } catch (e) {
    statusel.textContent = '❌ Failed';
    statusel.style.color = 'red';
  }
});

populate();