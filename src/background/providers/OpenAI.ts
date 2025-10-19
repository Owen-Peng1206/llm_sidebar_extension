import type { ProviderConfig } from '../storage';
/* ① 先從 Chrome Storage 讀取設定   */
const readConfig = (): Promise<ProviderConfig> =>
  new Promise(resolve => {
    chrome.storage.sync.get('providerConfig', data => {
      resolve(data.providerConfig as ProviderConfig);
    });
  });

export const openai = {
  id: 'openai',
  name: 'OpenAI',
  async sendPrompt(prompt: string) {
    const cfg = await readConfig();
    if (!cfg?.apiKey) {
      console.log('OpenAI API key is missing in providerConfig.');
      throw new Error('Missing API key – please set it in the options page.');
    }    
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100000); 
    const defaultRoot = 'https://api.openai.com/v1/';
    const apiRoot = cfg.baseURL?.trim() || defaultRoot;
    const cleanRoot = apiRoot.replace(/\/+$/, '');
    const url = cleanRoot.endsWith('/v1')
      ? `${cleanRoot}/chat/completions`
      : `${cleanRoot}/v1/chat/completions`;
    console.log('OpenAI request URL:', url);
    /* ④ 送出請求   */
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        /* ① model 必須是模型名稱 */
        model: cfg.model ?? 'gpt-4o',   // 建議: 'gpt-4o'、'gpt-3.5-turbo' 等
        messages: [{ role: 'user', content: prompt }],
        /* ② 可選參數：控制輸出 */
        // temperature: cfg.temperature ?? 0.7,   // 0~1，決定隨機度
        // max_tokens: cfg.maxTokens ?? 800,     // 最高 token 數（根據模型上限調整）
      },),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errBody = await response.text();
      console.log('OpenAI request failed:', response.status, errBody);
      throw new Error(`OpenAI error ${response.status}`);    
    }
    const json = await response.json();
    return json.choices[0].message.content;
  },
} as const;

