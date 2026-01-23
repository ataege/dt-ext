// ChatGPT Chat Interface Logic
// OpenAI API Integration with Screenshot Support

// ============ CONFIGURATION ============
// TODO: Replace with your actual OpenAI API key
const OPENAI_API_KEY = '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';

// Model configuration - Using Responses API for better performance
// Current options: 'gpt-5.2-2025-12-11', 'gpt-5.1-2025-11-13', 'gpt-4o'
// For vision/screenshot support, use 'gpt-4o' or newer models
const MODEL_NAME = 'gpt-5.2-2025-12-11';

const API_ENDPOINT = 'https://api.openai.com/v1/responses';
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

    // Add to conversation history with image (Responses API format)
    conversationHistory.push({
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: 'Analyze this programming/algorithm question from the screenshot. Provide:\n1. A clear solution approach explained simply\n2. Complete working C++ code in student/beginner style:\n   - Use simple, readable variable names (not single letters)\n   - Add comments explaining the logic step-by-step\n   - Write straightforward code (not overly optimized)\n   - Make it look like a student wrote it naturally\n3. Time and space complexity analysis\n4. Key insights about the algorithm or data structure\n\nIMPORTANT: Write the code as if a student solving it for the first time would write - clear, simple, and well-commented, not professional/competitive programming style.'
        },
        {
          type: 'input_image',
          image_url: response.dataUrl
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
        reasoning: {
          effort: 'high'
        },
        model: MODEL_NAME,
        input: conversationHistory,
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `API Error: ${response.status}`);
    }

    const data = await response.json();

    // Parse Responses API output structure
    let assistantMessage = '';
    if (data.output && Array.isArray(data.output)) {
      // Find the message object in output array
      const messageObj = data.output.find(item => item.type === 'message');
      if (messageObj && messageObj.content && Array.isArray(messageObj.content)) {
        // Find the output_text item in content array
        const textObj = messageObj.content.find(item => item.type === 'output_text');
        if (textObj && textObj.text) {
          assistantMessage = textObj.text;
        }
      }
    }

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

  // Add copy button for assistant messages
  if (role === 'assistant') {
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.title = 'Copy message';
    copyButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
      </svg>
    `;

    copyButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(content);
        copyButton.classList.add('copied');
        copyButton.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        `;

        setTimeout(() => {
          copyButton.classList.remove('copied');
          copyButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
          `;
        }, 2000);
      } catch (error) {
        console.error('Failed to copy text:', error);
      }
    });

    contentDiv.appendChild(copyButton);
  }

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

  // Apply syntax highlighting manually to ensure it works
  if (role === 'assistant') {
    // Wait a bit for the DOM to be ready
    requestAnimationFrame(() => {
      if (window.hljs) {
        const codeBlocks = messageDiv.querySelectorAll('pre code');
        console.log('Found code blocks:', codeBlocks.length);
        codeBlocks.forEach((block, index) => {
          // Check if already highlighted
          if (!block.classList.contains('hljs')) {
            console.log(`Highlighting block ${index}:`, block.textContent.substring(0, 50));
            try {
              window.hljs.highlightElement(block);
              console.log(`Block ${index} highlighted successfully`);
            } catch (e) {
              console.error('Error highlighting block:', e);
            }
          }
        });
      } else {
        console.error('hljs not available');
      }
    });
  }
}

function formatMessage(text) {
  // Use marked.js for full Markdown support if available
  if (window.marked) {
    try {
      return window.marked.parse(text);
    } catch (e) {
      console.error('Markdown parsing error:', e);
    }
  }

  // Fallback to basic formatting if marked.js isn't loaded yet
  let formatted = text
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const language = lang ? ` class="language-${lang.toLowerCase()}"` : '';
      return `<pre><code${language}>${code.trim()}</code></pre>`;
    })
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
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
