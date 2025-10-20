import { chunkText } from '../utils/chunk';
import {
  extractTextFromDOM,
  extractSelectedText,
  extractSelectedHtmlFromRange,
} from '../utils/extract';
import { openai } from './providers/OpenAI';
import { ollama } from './providers/Ollama';
import { googlegemini } from './providers/GoogleGemini';
import type { ProviderConfig } from './storage';

async function getProviderConfig(): Promise<ProviderConfig | null> {
  return new Promise((resolve) => {
    chrome.storage.sync.get('providerConfig', (data) => {
      const cfg = data.providerConfig as ProviderConfig | undefined;
      resolve(cfg || null);
    });
  });
}

function buildPrompt(type: string, text: string, lang?: string) {
  switch (type) {
    case 'SUMMARISE':  
      return `Please extract the main content from the following webpage and answer in ${lang || 'Traditional Chinese'}, and then provide a concise summary of the content.:\n\n${text}`;
    case 'TRANSLATE':
      return `Translate into ${lang || 'Traditional Chinese'}:\n\n${text}`;
    case 'TRANSLATE_SELECT_INNER':
      return `keep the original HTML format. do not add extra text. don not add markdown tag. Translate the following content to ${lang || 'Traditional Chinese'}:\n\n${text}`;
    case 'REWRITE':
      return `Rewrite the following content in a more formal tone:\n\n${text}`;
    case 'EXTRACT_CONTENT':
      return `Please answer in ${lang || 'Traditional Chinese'}. Please extract the main content from the following webpage, ignoring navigation, ads, sidebars, and other boilerplate, and then provide a concise summary of that content:\n\n${text}`;
    case 'YOUTUBE_SUMMARIZE':
      return `Please extract the main content from the following YouTube video (title, description, subtitles) and provide a summary in Traditional Chinese, including excerpts and descriptions of each key paragraph mentioned in the video.:\n\n${text}`;
    case 'CHAT':
      return text;          
    default:
      return text;
  }
}

async function processText(raw: string) {
  const cfg = await getProviderConfig();
  if (!cfg) return;

  const providers: Record<
    string,
    { sendPrompt: (prompt: string, options?: { streaming?: boolean }) => Promise<string> }
  > = {
    openai,
    ollama,
    googlegemini,
  };

  const provider = providers[cfg.id?.toLowerCase()];
  if (!provider) return;

  const chunks = chunkText(raw);
  const combinedPrompt = chunks.join('\n');

  const result = await provider.sendPrompt(combinedPrompt, { streaming: true });

  chrome.runtime.sendMessage({ type: 'MODEL_RESPONSE', data: result });
}

async function translatePrompt(prompt: string): Promise<string> {
  const cfg = await getProviderConfig();
  if (!cfg) return '';
  const providers: Record<
    string,
    { sendPrompt: (prompt: string, options?: { streaming?: boolean }) => Promise<string> }
  > = {
    openai,
    ollama,
    googlegemini,
  };
  const provider = providers[cfg.id?.toLowerCase()];
  if (!provider) return '';
  const chunks = chunkText(prompt);
  const combinedPrompt = chunks.join('\n');
  const result = await provider.sendPrompt(combinedPrompt, { streaming: false });
  return result;
}

chrome.runtime.onInstalled.addListener(() => {
  (chrome as any).sidePanel.setOptions({
    path: 'src/ui/sidebar/index.html',
  });

  chrome.contextMenus.create({
    id: 'summarise_page',
    title: 'Summarise Page',
    contexts: ['page'],
  });
  chrome.contextMenus.create({
    id: 'translate_page',
    title: 'Translate Page',
    contexts: ['page'],
  });
  chrome.contextMenus.create({
    id: 'translate_select_text',
    title: 'Translate Selected Text',
    contexts: ['selection'],
  });
});

(chrome as any).sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: string) => console.error(error));

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  try {
    await (chrome as any).sidePanel.open({ tabId: tab.id });
  } catch (err) {
    console.error('[background] sidePanel open error:', err);
  }
  const cfg = await getProviderConfig();
  if (!cfg) return '';
  const targetlang = cfg.targetLang;
  
  if (info.menuItemId === 'translate_select_text') {
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id! },
        func: extractSelectedHtmlFromRange,
      },
      async (selResults) => {
        const selectedText = selResults?.[0]?.result ?? '';
        if (!selectedText) return;
        console.log('[background] selectedText:', selectedText);
        const prompt = buildPrompt('TRANSLATE_SELECT_INNER', selectedText, targetlang);
        const translated = await translatePrompt(prompt);
        if (!translated) return;
        chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          func: (translatedText: string) => {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const fragment = range.createContextualFragment(translatedText);
            range.insertNode(fragment);
            sel.collapseToEnd();
          },
          args: [translated],
        });
      }
    );
    return;
  }

  const type =
    info.menuItemId === 'summarise_page'
      ? 'SUMMARISE'
      : info.menuItemId === 'translate_page'
      ? 'TRANSLATE'
      : undefined;

  // const lang = type === 'TRANSLATE' ? 'zh-TW' : undefined;

  if (!type) return;

  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id! },
      func: extractSelectedText,
    },
    async (selResults) => {
      let pageText = selResults?.[0]?.result ?? '';
      if (!pageText) {
        const fullResults = await new Promise<
          chrome.scripting.InjectionResult<string>[] | undefined
        >((resolve) => {
          chrome.scripting.executeScript(
            {
              target: { tabId: tab.id! },
              func: extractTextFromDOM,
              args: [],
            },
            resolve
          );
        });
        pageText = fullResults?.[0]?.result ?? '';
      }
      const prompt = buildPrompt(type, pageText, targetlang);
      processText(prompt);
    }
  );
});

chrome.runtime.onMessage.addListener(async (msg, _sender, sendResponse) => {
  if (
    msg.type === 'OPEN_SIDE_PANEL' ||
    msg.type === 'EXTRACT_CONTENT' ||
    msg.type === 'SUMMARISE' ||
    msg.type === 'TRANSLATE' ||
    msg.type === 'CHAT'
  ) {
    let pageText = '';

    if (msg.type === 'OPEN_SIDE_PANEL') {
      if (_sender.tab?.id) {
        try {
          await (chrome as any).sidePanel.open({ tabId: _sender.tab.id });
        } catch (err) {
          console.error('[background] sidePanel open error:', err);
        }
      }
      return true;
    }
    const cfg = await getProviderConfig();
    const targetLang = msg.payload?.targetLang ?? cfg?.targetLang ?? 'zh-TW';
    if (msg.payload?.customText) {
      pageText = msg.payload.customText;
    } else {
      const [tab] = await new Promise<chrome.tabs.Tab[]>((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, resolve);
      });

      if (tab?.id) {
        const results = await new Promise<chrome.scripting.InjectionResult<string>[]>(resolve => {
            chrome.scripting.executeScript(
              {
                target: { tabId: tab.id! },
                func: extractTextFromDOM,
                args: [],
              },
              resolve
            );
        });
        pageText = results?.[0]?.result ?? '';
      }
    }

    if (!pageText) {
      console.warn('No page text extracted for message type:', msg.type);
    }
    const prompt = buildPrompt(msg.type, pageText, targetLang);
    processText(prompt);
  }

  if (msg.type === 'YOUTUBE_SUMMARIZE') {
    const cfg = await getProviderConfig();
    const targetLang = cfg?.targetLang ?? 'zh-TW';
    const { title, description, transcript } = msg.payload || {};
    const combined = `${title}\n\n${description}\n\n${transcript}`;
    const prompt = buildPrompt('YOUTUBE_SUMMARIZE', combined, targetLang);
    processText(prompt);    
  }

  return true;
});

chrome.action.onClicked.addListener((tab) => {
  if (!tab?.id) return;
  chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: () => {
      window.postMessage({ type: 'SHOW_SETTINGS' }, '*');
    },
  });
  chrome.runtime.openOptionsPage();  
});