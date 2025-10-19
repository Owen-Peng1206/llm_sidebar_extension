
import { ProviderConfig } from '../background/storage';
// 新增 LLM 提取函式
import { openai } from '../background/providers/OpenAI';
import { ollama } from '../background/providers/Ollama';
import { googlegemini } from '../background/providers/GoogleGemini';
/* ① 先從 Chrome Storage 讀取設定   */
const readConfig = (): Promise<ProviderConfig> =>
  new Promise(resolve => {
    chrome.storage.sync.get('providerConfig', data => {
      resolve(data.providerConfig as ProviderConfig);
    });
  });

/**
 * 透過 LLM 提取原始文字。此函式不會先使用 extractTextFromDOM，而是直接將 DOM 的 outerHTML
 * 送進 LLM，要求它回傳「主體內容」的純文字。
 *
 * @param root DOM 根節點，預設為 document.body。
 * @param provider 目前支援 'openai' 或 'ollama' 或 'googlegemini'。
 * @returns 主體文字，若 LLM 回傳失敗則回傳 null。
 */
export async function extractTextFromLLM(
  root: HTMLElement = document.body,
  // provider: 'openai' | 'ollama'| 'googlegemini' = 'ollama',
): Promise<string | null> {
  // 先取得整個元素的 outerHTML，作為 LLM 的輸入
  const html = root.outerHTML;

  // 設定 LLM prompt
  const prompt = `Extract the main text content from the following HTML and return it as plain text, with paragraphs separated by double newlines. Do not include any markup or comments. ${html}`;
  console.log('html:', html);
  const cfg = await readConfig();
  const provider = cfg.id;
  try {
    if (provider === 'ollama') {
      const content = await ollama.sendPrompt(prompt);
      return content ?? null;
    }    
    if (provider === 'openai') {
      const content = await openai.sendPrompt(prompt);
      return content ?? null;
    }
    if (provider === 'googlegemini') {
      const content = await googlegemini.sendPrompt(prompt);
      return content ?? null;
    }    
  } catch (err) {
    console.error('extractTextFromLLM error:', err);
    return null;
  }
  return null;
}
/**
 * Extracts the main content from a DOM element as plain text, filtering out irrelevant parts
 * like headers, footers, and navigation.
 *
 * This function prioritizes semantic elements like `<article>`, `<main>`, or `<section>` but falls
 * back to the provided root element. It automatically selects the container with the most
* text content to better identify the main body.
 *
 * @param root The root element to search within, defaulting to `document.body`.
 * @returns The extracted main content as a string, with paragraphs separated by double newlines.
 */
export function extractTextFromDOM(root: HTMLElement = document.body): string {
  // 1. Clone the root to avoid modifying the live DOM.
  const clone = root.cloneNode(true) as HTMLElement;

  // 2. Remove irrelevant elements like navigation, headers, footers, etc.
  clone
    .querySelectorAll('header, footer, nav, aside, script, style, noscript')
    .forEach(el => el.remove());

  // 3. Find the best candidate for the main content.
  // We look for common main content containers and pick the one with the most text.
  const candidates = Array.from(
    clone.querySelectorAll<HTMLElement>('article, main, section, #content, #main, .post, text')
  ).filter(el => el.innerText.trim().length > 100); // Filter out small elements

  const mainContentContainer =
    candidates.length > 0
      ? candidates.reduce((a, b) => (a.innerText.length > b.innerText.length ? a : b))
      : clone; // Fallback to the cleaned clone if no good candidate is found

  // 4. Extract text from paragraphs, headings, and list items within the main container.
  const texts = Array.from(mainContentContainer.querySelectorAll('p, h1, h2, h3, li'))
    .map(p => p.textContent?.trim() ?? '')
    .filter(Boolean); // Filter out empty strings

  // 5. Join with double newlines to preserve paragraph separation.
  return texts.join('\n\n');
}

export function extractSelectedText(): string {
  const selection = window.getSelection();
  if (!selection) return '';

  /* ────────────────────── DEBUG ────────────────────── */
  console.log('🗒️  Selection object:', selection);
  console.log('🗒️  selection.toString():', selection.toString());
  console.log(
    '🗒️  rangeCount:',
    selection.rangeCount,
    'isCollapsed:',
    selection.isCollapsed
  );
  if (selection.rangeCount) {
    const range = selection.getRangeAt(0);
    console.log('🗒️  Range boundaries:', {
      startContainer: range.startContainer,
      endContainer: range.endContainer,
    });
  }
  /* ───────────────────────────────────────────────────── */

  const ranges = Array.from(selection.getRangeAt(0).cloneContents().childNodes);
  return ranges
    .map(n => n.textContent?.trim() ?? '')
    .filter(t => t)
    .join('\n');
}
export function extractSelectedHtml(): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return '';

  // 把選取範圍複製成 DocumentFragment
  const fragment = sel.getRangeAt(0).cloneContents();

  // 把 fragment 放到一個臨時 <div> 裡，取 innerHTML
  const temp = document.createElement('div');
  temp.appendChild(fragment);

  return temp.innerHTML;   // 這裡就包含所有標籤與格式
}
export function extractSelectedFragment(): DocumentFragment | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  return sel.getRangeAt(0).cloneContents();
}
// export function extractSelectedHtmlFromRange(): string {
//   const sel = window.getSelection();
//   if (!sel || sel.rangeCount === 0) return '';

//   const range = sel.getRangeAt(0);
//   const container = document.createElement('div');
//   container.appendChild(range.cloneContents());
//   return container.innerHTML;
// }
/* --------------------------------------- */
// 1️⃣ 取得選取區域的原始 HTML（含標籤）
export function extractSelectedHtmlFromRange(): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return '';

  const range = sel.getRangeAt(0);
  const fragment = range.cloneContents();   // DocumentFragment

  const tmpDiv = document.createElement('div');
  tmpDiv.appendChild(fragment);
  return tmpDiv.innerHTML;  // 例: "<strong>Hello</strong> world"
}
/* --------------------------------------- */
// 3️⃣ 內容腳本內部：把翻譯文字替換到原選取區域，保留標籤
// 這個函式會在目標頁面執行，參數 `originalHtml` 是被選取區域原始的 HTML
export function replaceHtmlWithTranslation(originalHtml: string, translatedText: string): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);

  /* ① 把原始 HTML 轉成臨時節點，方便遍歷 */
  const template = document.createElement('div');
  template.innerHTML = originalHtml;
  const frag = template.firstChild as Node; // 只要第一個子節點即可，因為原始選取是一段

  /* ② 逐個 TextNode 取替換文字 */
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(frag, NodeFilter.SHOW_TEXT, null);
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  /* ③ 把翻譯字串分成同樣數量的片段（盡量保留原始長度） */
  const segs = translatedText.split(/(?<=\s)/); // 以空白分割，保留空格

  for (let i = 0; i < textNodes.length; i++) {
    const node = textNodes[i];
    node.textContent = segs[i] ?? translatedText; // 依序取，如果段數不足則全部放最後一個
  }

  /* ④ 把修改後的 frag 重新塞回選取區域 */
  range.deleteContents();
  range.insertNode(frag);

  /* ⑤ 清除舊選取，讓瀏覽器不再顯示選取狀態 */
  sel.removeAllRanges();
}