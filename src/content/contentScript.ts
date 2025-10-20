import { loadProviderConfig, saveProviderConfig } from '../background/storage';

function getYouTubeVideoInfo() {
  const title = document.title || '';
  const descEl = document.querySelector('yt-formatted-string#description');
  const description = descEl ? descEl.textContent?.trim() || '' : '';
  let transcript = '';
  try {
    const transcriptNodes = document.querySelectorAll('ytd-transcript-text-renderer');
    if (transcriptNodes.length) {
      transcript = Array.from(transcriptNodes)
        .map((node: Element) => node.textContent?.trim() || '')
        .join('\n');
    }
  } catch (_) {}
  return { title, description, transcript };
}

const btn = document.createElement('button');
btn.style.position = 'fixed';
btn.textContent = 'LLM';
btn.style.zIndex = '99999';
btn.style.padding = '8px 12px';
btn.style.background = 'rgba(255, 255, 255, 0.38)';
btn.style.color = '#f70c0cff';
btn.style.border = 'none';
btn.style.borderRadius = '4px';
btn.style.cursor = 'pointer';

const savedPos = window.localStorage.getItem('llmBtnPos');
if (savedPos) {
  const { left, top } = JSON.parse(savedPos);
  btn.style.left = left;
  btn.style.top = top;
} else {
  btn.style.left = '15px';
  btn.style.top = 'calc(100% - 45px)';
}

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let btnStartLeft = 0;
let btnStartTop = 0;
btn.addEventListener('mousedown', (e) => {
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  btnStartLeft = parseInt(btn.style.left || '0', 10);
  btnStartTop = parseInt(btn.style.top || '0', 10);
  e.preventDefault();
});

function onMouseMove(e: MouseEvent) {
  if (!isDragging) return;
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;
  btn.style.left = `${btnStartLeft + dx}px`;
  btn.style.top = `${btnStartTop + dy}px`;
}

function onMouseUp() {
  if (!isDragging) return;
  isDragging = false;
  window.localStorage.setItem('llmBtnPos', JSON.stringify({ left: btn.style.left, top: btn.style.top }));
}

window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mouseup', onMouseUp);

btn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
  const isYouTube = window.location.host.includes('youtube.com') && /\/watch\b/.test(window.location.pathname);
  if (isYouTube) {
    const videoInfo = getYouTubeVideoInfo();
    chrome.runtime.sendMessage({ type: 'YOUTUBE_SUMMARIZE', payload: videoInfo });
  }else{
    chrome.runtime.sendMessage({ type: 'EXTRACT_CONTENT' });
  }  
});

document.body.appendChild(btn);

const SETTINGS_MODAL_ID = 'llm-sidebar-settings-modal';

function createModal() {
  if (document.getElementById(SETTINGS_MODAL_ID)) return;

  fetch(chrome.runtime.getURL('src/ui/options/optionsTemplate.html'))
    .then(res => res.text())
    .then(html => {
      const modalContainer = document.createElement('div');
      modalContainer.id = SETTINGS_MODAL_ID;
      modalContainer.style.position = 'fixed';
      modalContainer.style.top = '0';
      modalContainer.style.left = '0';
      modalContainer.style.right = '0';
      modalContainer.style.bottom = '0';
      modalContainer.style.display = 'flex';
      modalContainer.style.alignItems = 'center';
      modalContainer.style.justifyContent = 'center';
      modalContainer.style.background = 'rgba(0,0,0,0.4)';
      modalContainer.innerHTML = html;

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL('src/ui/options/options.css');
      modalContainer.appendChild(link);

      modalContainer.querySelector('.close-btn')?.addEventListener('click', () => {
        modalContainer.remove();
      });

      modalContainer.querySelector('#saveBtn')?.addEventListener('click', async () => {
        const newConfig = {
          id: (modalContainer.querySelector('#provider') as HTMLSelectElement)?.value,
          apiKey: (modalContainer.querySelector('#apiKey') as HTMLInputElement)?.value,
          baseURL: (modalContainer.querySelector('#baseURL') as HTMLInputElement)?.value,
          model: (modalContainer.querySelector('#model') as HTMLInputElement)?.value,
          targetLang: (modalContainer.querySelector('#targetlang') as HTMLInputElement)?.value,
        };
        await saveProviderConfig(newConfig);
        const status = modalContainer.querySelector('#status');
        status!.textContent = '✔︎ Saved';
      });

      document.body.appendChild(modalContainer);
    })
    .catch(err => console.error('modal template load error', err));
}

window.addEventListener('message', (e) => {
  if (e.data?.type === 'SHOW_SETTINGS') createModal();
});

const openOptionsBtn = document.getElementById('open-options');
if (openOptionsBtn) {
  openOptionsBtn.addEventListener('click', () => {
    window.postMessage({ type: 'OPEN_OPTIONS' }, '*');
  });
}