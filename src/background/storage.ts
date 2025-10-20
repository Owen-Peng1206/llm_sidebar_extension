export interface ProviderConfig {
  id: string;
  apiKey: string;
  baseURL?: string;
  model?: string;
  targetLang?: string; // Added target language preference
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
  return new Promise((resolve) => {
    chrome.storage.sync.get('providerConfig', data => {
      resolve((data as any).providerConfig || null);
    });
  });
}