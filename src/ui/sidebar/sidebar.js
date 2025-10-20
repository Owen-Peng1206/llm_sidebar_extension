import MarkdownIt from 'markdown-it';

const skinLink = document.getElementById('themeStyles');

async function applySkin() {
  const config = await new Promise((resolve) => {
    chrome.storage.sync.get('providerConfig', (data) => resolve(data.providerConfig || {}));
  });
  const skin = config.skin || 'dark';
  if (skin === 'light') {
    skinLink.href = 'light.css';
  } else {
    skinLink.href = 'dark.css';
  }
}

// Apply theme after DOM ready
document.addEventListener('DOMContentLoaded', () => applySkin());

const providerInfo = document.getElementById('providerInfo');
const responseArea = document.getElementById('responseArea');
const summariseBtn = document.getElementById('summariseBtn');
const translateBtn = document.getElementById('translateBtn');
const chatBtn = document.getElementById('chatBtn');
const saveBtn = document.getElementById('saveBtn');
const promptText = document.getElementById('promptText');
const clearBtn = document.getElementById('clearBtn');

const md = new MarkdownIt();

let config = null;
chrome.storage.sync.get('providerConfig', (data) => {
  config = data.providerConfig;
  if (config) providerInfo.textContent = `Model Provider: ${config.id}`;
});

function loadChatHistory() {
  const history = localStorage.getItem('chatHistory');
  if (history) {
    let chatHistory;
    try {
      chatHistory = JSON.parse(history);
    } catch (e) {
      console.error('Failed to parse chatHistory:', e);
      localStorage.removeItem('chatHistory');
      return;
    }
    if (Array.isArray(chatHistory)) {
      chatHistory.forEach((message) => {
        displayMessage(message.role, message.content, message.timestamp, false);
      });
    }
  }
}

function saveChatHistory(role, content) {
  const history = localStorage.getItem('chatHistory');
  let chatHistory = [];
  if (history) {
    chatHistory = JSON.parse(history);
  }
  const timestamp = new Date().toISOString();
  chatHistory.push({ role, content, timestamp });
  localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
  return timestamp;
}

function displayMessage(role, content, timestamp = new Date().toISOString(), save = true) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add(role === 'user' ? 'user-message' : 'assistant-message');
  messageDiv.innerHTML = md.render(content);

  const timestampSpan = document.createElement('span');
  timestampSpan.classList.add('timestamp');
  timestampSpan.textContent = new Date(timestamp).toLocaleString();
  messageDiv.appendChild(timestampSpan);

  responseArea.appendChild(messageDiv);

  messageDiv.scrollIntoView({ behavior: 'auto', block: 'start' });
  responseArea.scrollTop = responseArea.scrollHeight;

  if (save) {
    saveChatHistory(role, content);
  }
}

const send = (msg) => {
  chrome.runtime.sendMessage(msg);
};

summariseBtn.addEventListener('click', () => send({ type: 'SUMMARISE' }));

const customDialog = document.createElement('div');
customDialog.style.display = 'none';
customDialog.style.position = 'fixed';
customDialog.style.top = '10%';
customDialog.style.left = '50%';
customDialog.style.transform = 'translateX(-50%)';
customDialog.style.backgroundColor = '#fff';
customDialog.style.padding = '10px';
customDialog.style.border = '1px solid #ccc';
customDialog.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';

const textarea = document.createElement('textarea');
textarea.style.width = '300px';
textarea.style.height = '100px';
customDialog.appendChild(textarea);

const sendBtn = document.createElement('button');
sendBtn.textContent = 'Send';
sendBtn.style.marginTop = '10px';
customDialog.appendChild(sendBtn);

document.body.appendChild(customDialog);

translateBtn.addEventListener('click', () => {
  customDialog.style.display = 'block';
});

sendBtn.addEventListener('click', () => {
  const customText = textarea.value.trim();
  const payload = { lang: 'zh-TW' };
  if (customText) payload.customText = customText;
  send({ type: 'TRANSLATE', payload });
  customDialog.style.display = 'none';
  textarea.value = '';
});

function sendChat() {
  const prompt = promptText.textContent.trim();
  if (!prompt) return;
  const timestamp = saveChatHistory('user', prompt);
  displayMessage('user', prompt, timestamp, false);
  send({ type: 'CHAT', payload: { customText: prompt } });
  promptText.textContent = '';
}
chatBtn.addEventListener('click', sendChat);
promptText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
});

saveBtn.addEventListener('click', () => {
  const markdownParts = [];
  let prevRole = null;
  Array.from(responseArea.children).forEach((message) => {
      const role = message.classList.contains('user-message') ? 'user' : 'assistant';
      const content = message.querySelector('.markdown-body')?.innerHTML || message.innerHTML;
      const timestamp = message.querySelector('.timestamp')?.textContent || '';
    let header = `<br> **${role}`;
    if (role !== prevRole) {
      header += ` (${timestamp})`;
      prevRole = role;
    }
    header += `:**`;
    markdownParts.push(`${header}\n${content}\n\n<br>`);
  });
  const markdownContent = markdownParts.join('\n\n');
  const blob = new Blob([markdownContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'llm-response.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

clearBtn.addEventListener('click', () => {
  responseArea.innerHTML = '';
  localStorage.removeItem('chatHistory');
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'MODEL_RESPONSE') {
    const timestamp = saveChatHistory('assistant', msg.data);
    displayMessage('assistant', msg.data, timestamp, false);
  }
});

loadChatHistory();