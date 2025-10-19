import type { ProviderConfig } from '../storage';

// Read config from Chrome storage
const readConfig = (): Promise<ProviderConfig> =>
  new Promise((resolve) => {
    chrome.storage.sync.get('providerConfig', (data) => {
      resolve((data as any).providerConfig as ProviderConfig);
    });
  });

export const googlegemini = {
  id: 'googlegemini',
  name: 'Google Gemini',
  async sendPrompt(prompt: string, options?: { streaming?: boolean }): Promise<string> {
    const cfg = await readConfig();
    if (!cfg?.apiKey) {
      console.error('Google Gemini API key is missing.');
      throw new Error('Missing API key – set it in the options page.');
    }
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100000); // 100s timeout

    const defaultRoot = 'https://generativelanguage.googleapis.com/v1beta/';
    const apiRoot = defaultRoot;
    const cleanRoot = apiRoot.replace(/\/+$/, '');
    // Ensure model name is included; if not, default to 'gemini-2.5-flash'
    const modelName = cfg.model?.replace(/^models\//, '') || 'gemini-2.5-flash';
    const url = `${cleanRoot}/models/${modelName}:generateContent`;

    const body = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': `${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Google Gemini request failed:', response.status, errText);
      throw new Error(`Gemini error ${response.status}`);
    }

    const json = await response.json();
    // The Gemini API returns content in json.candidates[0].content.parts[0].text
    const firstCandidate = json?.candidates?.[0];
    const firstPart = firstCandidate?.content?.parts?.[0];
    const text = firstPart?.text ?? '';
    return text;
  },
} as const;
