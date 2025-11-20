// Isolated ChatGPT Widget - Content Script
// Uses Shadow DOM only (no iframe) for complete CSS isolation without focus issues
// All chat logic merged into this file for guaranteed execution

(function() {
  'use strict';

  // Prevent multiple injections
  if (window.__chatgpt_widget_injected__) {
    return;
  }
  window.__chatgpt_widget_injected__ = true;

  // ============ CONFIGURATION ============
  const OPENAI_API_KEY = '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';
  const MODEL_NAME = 'gpt-5.1-2025-11-13';
  const API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
  // =======================================

  // Chat state
  let conversationHistory = [];
  let isProcessing = false;

  // Create shadow host container
  const shadowHost = document.createElement('div');
  shadowHost.id = 'chatgpt-widget-shadow-host';

  // Attach shadow DOM (closed mode for maximum isolation)
  const shadowRoot = shadowHost.attachShadow({ mode: 'closed' });

  // Create widget container styles
  const widgetStyle = document.createElement('style');
  widgetStyle.textContent = `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    #widget-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      pointer-events: auto;
    }

    #toggle-button {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: rgba(102, 126, 234, 0.3);
      border: none;
      cursor: pointer;
      box-shadow: none;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, opacity 0.2s;
      pointer-events: auto;
      opacity: 0.4;
    }

    #toggle-button:hover {
      transform: scale(1.5);
      opacity: 0.8;
    }

    #toggle-button:active {
      transform: scale(1.2);
    }

    #toggle-button svg {
      display: none;
    }

    #chat-panel {
      position: absolute;
      bottom: 20px;
      right: 0;
      width: 280px;
      height: 400px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      display: none;
      flex-direction: column;
      overflow: hidden;
      pointer-events: auto;
    }

    #chat-panel.visible {
      display: flex;
    }

    #chat-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 10px 12px;
      cursor: move;
      user-select: none;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    #chat-title {
      font-weight: 600;
      font-size: 14px;
    }

    #close-button {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }

    #close-button:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    #chat-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
  `;

  shadowRoot.appendChild(widgetStyle);

  // Load chat styles
  const chatStyleLink = document.createElement('link');
  chatStyleLink.rel = 'stylesheet';
  chatStyleLink.href = chrome.runtime.getURL('styles.css');
  shadowRoot.appendChild(chatStyleLink);

  // Create widget container
  const container = document.createElement('div');
  container.id = 'widget-container';

  // Create toggle button
  const toggleButton = document.createElement('button');
  toggleButton.id = 'toggle-button';
  toggleButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
    </svg>
  `;
  toggleButton.title = 'Open ChatGPT Chat';

  // Create chat panel
  const chatPanel = document.createElement('div');
  chatPanel.id = 'chat-panel';

  // Create header
  const header = document.createElement('div');
  header.id = 'chat-header';

  const title = document.createElement('div');
  title.id = 'chat-title';
  title.textContent = 'ChatGPT Assistant';

  const closeButton = document.createElement('button');
  closeButton.id = 'close-button';
  closeButton.innerHTML = '×';
  closeButton.title = 'Close';

  header.appendChild(title);
  header.appendChild(closeButton);

  // Create chat content container
  const chatContent = document.createElement('div');
  chatContent.id = 'chat-content';
  chatContent.innerHTML = `
    <div id="chat-container">
      <div id="messages-container">
        <div class="message system-message">
          <div class="message-content">
            <strong>ChatGPT Assistant Ready</strong>
            <p>Ask me anything! Use the screenshot button to capture and analyze the current page.</p>
          </div>
        </div>
      </div>

      <div id="input-container">
        <button id="screenshot-btn" title="Capture Screenshot" aria-label="Capture Screenshot">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
          </svg>
        </button>

        <textarea
          id="message-input"
          placeholder="Type your message here..."
          rows="1"
        ></textarea>

        <button id="send-btn" title="Send Message" aria-label="Send Message">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>

      <div id="loading-indicator" style="display: none;">
        <div class="spinner"></div>
        <span>Thinking...</span>
      </div>
    </div>
  `;

  chatPanel.appendChild(header);
  chatPanel.appendChild(chatContent);

  container.appendChild(toggleButton);
  container.appendChild(chatPanel);
  shadowRoot.appendChild(container);

  // Query DOM elements from Shadow DOM
  const messagesContainer = shadowRoot.querySelector('#messages-container');
  const messageInput = shadowRoot.querySelector('#message-input');
  const sendBtn = shadowRoot.querySelector('#send-btn');
  const screenshotBtn = shadowRoot.querySelector('#screenshot-btn');
  const loadingIndicator = shadowRoot.querySelector('#loading-indicator');

  // ============ CHAT FUNCTIONS ============

  function autoResizeTextarea() {
    if (messageInput) {
      messageInput.style.height = 'auto';
      messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px';
    }
  }

  async function handleSendMessage() {
    const message = messageInput.value.trim();
    if (!message || isProcessing) return;

    // Validate API key
    if (OPENAI_API_KEY === 'YOUR_API_KEY_HERE' || !OPENAI_API_KEY) {
      displayMessage('system', 'Error: Please configure your OpenAI API key in content.js');
      return;
    }

    // Clear input
    messageInput.value = '';
    autoResizeTextarea();

    // Display user message
    displayMessage('user', message);

    // Add to conversation history
    conversationHistory.push({
      role: 'user',
      content: message
    });

    // Send to OpenAI
    await sendToOpenAI();
  }

  async function handleScreenshot() {
    if (isProcessing) return;

    try {
      // Capture screenshot directly using chrome API
      const response = await chrome.runtime.sendMessage({ action: 'captureScreenshot' });

      if (response.error) {
        displayMessage('system', `Screenshot error: ${response.error}`);
        return;
      }

      displayMessage('user', '📸 Screenshot captured', response.dataUrl);

      // Add to conversation history with image
      conversationHistory.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Solve the question in the screen, only respond with the result of the question.'
          },
          {
            type: 'image_url',
            image_url: {
              url: response.dataUrl
            }
          }
        ]
      });

      // Send to OpenAI (this function handles all state management)
      await sendToOpenAI();

    } catch (error) {
      console.error('Screenshot error:', error);
      displayMessage('system', `Error capturing screenshot: ${error.message}`);
      // Ensure button is re-enabled if screenshot capture fails
      screenshotBtn.disabled = false;
      sendBtn.disabled = false;
    }
  }

  async function sendToOpenAI() {
    isProcessing = true;
    loadingIndicator.style.display = 'flex';
    sendBtn.disabled = true;
    screenshotBtn.disabled = true;

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages: conversationHistory,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API Error: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage = data.choices[0].message.content;

      // Add to conversation history
      conversationHistory.push({
        role: 'assistant',
        content: assistantMessage
      });

      // Display assistant message
      displayMessage('assistant', assistantMessage);

    } catch (error) {
      console.error('OpenAI API Error:', error);
      displayMessage('system', `Error: ${error.message}`);
    } finally {
      isProcessing = false;
      loadingIndicator.style.display = 'none';
      sendBtn.disabled = false;
      screenshotBtn.disabled = false;
    }
  }

  function displayMessage(role, content, imageUrl = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // Add image if present
    if (imageUrl) {
      const img = document.createElement('img');
      img.src = imageUrl;
      img.className = 'message-image';
      img.alt = 'Screenshot';
      contentDiv.appendChild(img);
    }

    // Add text content
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';

    // Format markdown-style code blocks
    const formattedContent = formatMessage(content);
    textDiv.innerHTML = formattedContent;

    contentDiv.appendChild(textDiv);
    messageDiv.appendChild(contentDiv);

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function formatMessage(text) {
    // Basic markdown formatting
    let formatted = text
      // Code blocks
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Line breaks
      .replace(/\n/g, '<br>');

    return formatted;
  }

  function clearChatHistory() {
    // Reset conversation history
    conversationHistory = [];

    // Clear messages container
    messagesContainer.innerHTML = '';

    // Re-add welcome message
    const welcomeMessage = document.createElement('div');
    welcomeMessage.className = 'message system-message';
    welcomeMessage.innerHTML = `
      <div class="message-content">
        <strong>ChatGPT Assistant Ready</strong>
        <p>Ask me anything! Use the screenshot button to capture and analyze the current page.</p>
      </div>
    `;
    messagesContainer.appendChild(welcomeMessage);

    console.log('Chat history cleared');
  }

  // ============ EVENT LISTENERS ============

  // Send button
  if (sendBtn) {
    sendBtn.addEventListener('click', handleSendMessage);
  }

  // Enter to send (Shift+Enter for new line)
  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });

    // Auto-resize textarea
    messageInput.addEventListener('input', autoResizeTextarea);
  }

  // Screenshot button
  if (screenshotBtn) {
    screenshotBtn.addEventListener('click', handleScreenshot);
  }

  // Toggle functionality
  toggleButton.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    chatPanel.classList.add('visible');
  });

  // Close button
  closeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    clearChatHistory();
    chatPanel.classList.remove('visible');
  });

  // Dragging functionality
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;

  header.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    if (e.target === closeButton || e.target.closest('#close-button')) {
      return;
    }
    isDragging = true;
    const rect = chatPanel.getBoundingClientRect();
    initialX = e.clientX - rect.left;
    initialY = e.clientY - rect.top;
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      chatPanel.style.position = 'fixed';
      chatPanel.style.left = currentX + 'px';
      chatPanel.style.top = currentY + 'px';
      chatPanel.style.bottom = 'auto';
      chatPanel.style.right = 'auto';
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (isDragging) {
      e.stopPropagation();
      isDragging = false;
    }
  });

  // Append to page
  document.documentElement.appendChild(shadowHost);

  console.log('ChatGPT Widget injected successfully (Shadow DOM only - no blur issues)');
  console.log('Model:', MODEL_NAME);
  console.log('API Key configured:', OPENAI_API_KEY !== 'YOUR_API_KEY_HERE');
})();
