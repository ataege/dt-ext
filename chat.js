// ChatGPT Chat Interface Logic
// OpenAI API Integration with Screenshot Support

// ============ CONFIGURATION ============
// TODO: Replace with your actual OpenAI API key
const OPENAI_API_KEY = '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';

// Model configuration - Change this when GPT-5.1 becomes available
// Current options: 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'
// For vision/screenshot support, use 'gpt-4o' or 'gpt-4-turbo' (with vision)
const MODEL_NAME = 'gpt-5.1-2025-11-13';

const API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
// =======================================

// Chat state
let conversationHistory = [];
let isProcessing = false;

// DOM elements (will be set by init function)
let messagesContainer;
let messageInput;
let sendBtn;
let screenshotBtn;
let loadingIndicator;

// Initialize function - called from content.js with element references
function initChatInterface(elements) {
  messagesContainer = elements.messagesContainer;
  messageInput = elements.messageInput;
  sendBtn = elements.sendBtn;
  screenshotBtn = elements.screenshotBtn;
  loadingIndicator = elements.loadingIndicator;

  setupEventListeners();
  autoResizeTextarea();

  console.log('ChatGPT chat interface initialized');
  console.log('Model:', MODEL_NAME);
  console.log('API Key configured:', OPENAI_API_KEY !== 'YOUR_API_KEY_HERE');
}

function setupEventListeners() {
  if (!sendBtn || !messageInput || !screenshotBtn) {
    console.error('Chat elements not found');
    return;
  }

  // Send button
  sendBtn.addEventListener('click', handleSendMessage);

  // Enter to send (Shift+Enter for new line)
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  // Auto-resize textarea
  messageInput.addEventListener('input', autoResizeTextarea);

  // Screenshot button
  screenshotBtn.addEventListener('click', handleScreenshot);
}

// Export init function
window.__chatgpt_init__ = initChatInterface;

function autoResizeTextarea() {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
}

async function handleSendMessage() {
  const message = messageInput.value.trim();
  if (!message || isProcessing) return;

  // Validate API key
  if (OPENAI_API_KEY === 'YOUR_API_KEY_HERE' || !OPENAI_API_KEY) {
    displayMessage('system', 'Error: Please configure your OpenAI API key in chat.js');
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
    isProcessing = true;
    loadingIndicator.style.display = 'flex';

    // Request screenshot via bridge function from content script
    if (!window.__chatgpt_captureScreenshot__) {
      throw new Error('Screenshot function not available');
    }

    const response = await window.__chatgpt_captureScreenshot__();

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
          text: 'Read the question displayed on the screen. Solve it and respond with the final answer followed by a brief explanation (1-2 sentences). Keep the explanation concise and relevant to how the answer was found.'
        },
        {
          type: 'image_url',
          image_url: {
            url: response.dataUrl
          }
        }
      ]
    });

    // Send to OpenAI
    await sendToOpenAI();

  } catch (error) {
    console.error('Screenshot error:', error);
    displayMessage('system', `Error capturing screenshot: ${error.message}`);
  } finally {
    isProcessing = false;
    loadingIndicator.style.display = 'none';
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

// Clear chat history function
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

// Export clear function for content script to call directly
window.__chatgpt_clearHistory__ = clearChatHistory;
