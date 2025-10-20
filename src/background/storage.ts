export interface ProviderConfig {
  id: string;
  apiKey: string;
  baseURL?: string;
  model?: string;
  targetLang?: string;
  skin?: 'dark' | 'light';
}
export async function saveProviderConfig(config: ProviderConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ providerConfig: config }, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve();
    });
  });
}



export async function loadProviderConfig(): Promise<ProviderConfig | null> {
  const { PROVIDER_ID, PROVIDER_API_KEY, PROVIDER_BASE_URL, PROVIDER_MODEL, PROVIDER_TARGET_LANG, PROVIDER_SKIN } = process.env;

  if (!PROVIDER_ID || !PROVIDER_API_KEY) {
    return null;
  }

  let skin: 'dark' | 'light' | undefined;
  if (PROVIDER_SKIN === 'dark' || PROVIDER_SKIN === 'light') {
    skin = PROVIDER_SKIN;
  }

  return {
    id: PROVIDER_ID,
    apiKey: PROVIDER_API_KEY,
    baseURL: PROVIDER_BASE_URL,
    model: PROVIDER_MODEL,
    targetLang: PROVIDER_TARGET_LANG,
    skin,
  };
}
