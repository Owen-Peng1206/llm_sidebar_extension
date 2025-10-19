import type { ProviderConfig } from '../storage';

/* ① 先從 Chrome Storage 讀取設定   */
const readConfig = (): Promise<ProviderConfig> =>
  new Promise(resolve => {
    chrome.storage.sync.get('providerConfig', data => {
      resolve(data.providerConfig as ProviderConfig);
    });
  });

export const ollama = {
  id: 'ollama',
  name: 'Ollama',
  async sendPrompt(prompt: string, options?: { streaming?: boolean }) {
    const cfg = await readConfig();
    const controller = new AbortController();
    // 100秒 timeout (100_000 ms)
    setTimeout(() => controller.abort(), 100000);
    // Default Ollama local URL
    const defaultRoot = 'http://localhost:11434';
    const apiRoot = cfg.baseURL?.trim() || defaultRoot;
    const cleanRoot = apiRoot.replace(/\/+$/, '');
    const url = `${cleanRoot}/api/chat`;
    console.log('Ollama request URL:', url);
    /* 送出請求 */
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: cfg.model ?? 'llama2',
        messages: [{ role: 'user', content: prompt }],
        // Normal (non‑streaming) response
        stream: false,
        think: false,
        // temperature: cfg.temperature ?? 0.7,
      }),
      signal: controller.signal,
    });
    // Non‑streaming: parse the JSON response directly
    const json = await response.json();
    const finalContent = json.message?.content ?? '';

    return finalContent;
  },
} as const;

