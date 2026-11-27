// Isolated ChatGPT Widget - Content Script
// Uses Shadow DOM only (no iframe) for complete CSS isolation without focus issues
// All chat logic merged into this file for guaranteed execution

(function () {
	'use strict';

	// Prevent multiple injections
	if (window.__chatgpt_widget_injected__) {
		return;
	}
	window.__chatgpt_widget_injected__ = true;

	// ============ CONFIGURATION ============
	const OPENAI_API_KEY = '';
	const MODEL_NAME = 'gpt-6.2-sol';
	const API_ENDPOINT = 'https://api.openai.com/v1/responses';
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
      width: 320px;
      height: 500px;
      background: #1a1a1f;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      border: 1px solid #3f3f46;
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
      padding: 8px 10px;
      cursor: move;
      user-select: none;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    #chat-title {
      font-weight: 600;
      font-size: 12px;
    }

    #header-buttons {
      display: flex;
      gap: 4px;
    }

    #minimize-button, #close-button {
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

    #minimize-button:hover, #close-button:hover {
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

	// Load highlight.js for syntax highlighting (load first)
	const highlightCSS = document.createElement('link');
	highlightCSS.rel = 'stylesheet';
	highlightCSS.href =
		'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';
	shadowRoot.appendChild(highlightCSS);

	// Load highlight.js into main page context
	const highlightJS = document.createElement('script');
	highlightJS.src = chrome.runtime.getURL('highlight.min.js');
	document.head.appendChild(highlightJS);

	// Load marked.js for Markdown parsing
	const markedJS = document.createElement('script');
	markedJS.src = chrome.runtime.getURL('marked.min.js');
	document.head.appendChild(markedJS);

	// Configure marked.js when both load
	Promise.all([
		new Promise((resolve) => {
			highlightJS.onload = resolve;
		}),
		new Promise((resolve) => {
			markedJS.onload = resolve;
		}),
	]).then(() => {
		if (window.marked) {
			window.marked.setOptions({
				breaks: true,
				gfm: true,
			});
		}
	});

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

	const minimizeButton = document.createElement('button');
	minimizeButton.id = 'minimize-button';
	minimizeButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12">
      <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
    </svg>
  `;
	minimizeButton.title = 'Minimize';

	const closeButton = document.createElement('button');
	closeButton.id = 'close-button';
	closeButton.innerHTML = '×';
	closeButton.title = 'Close & Clear';

	const headerButtons = document.createElement('div');
	headerButtons.id = 'header-buttons';
	headerButtons.appendChild(minimizeButton);
	headerButtons.appendChild(closeButton);

	header.appendChild(title);
	header.appendChild(headerButtons);

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
			messageInput.style.height =
				Math.min(messageInput.scrollHeight, 100) + 'px';
		}
	}

	async function handleSendMessage() {
		const message = messageInput.value.trim();
		if (!message || isProcessing) return;

		// Validate API key
		if (OPENAI_API_KEY === 'YOUR_API_KEY_HERE' || !OPENAI_API_KEY) {
			displayMessage(
				'system',
				'Error: Please configure your OpenAI API key in content.js',
			);
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
			content: message,
		});

		// Send to OpenAI
		await sendToOpenAI();
	}

	async function handleScreenshot() {
		if (isProcessing) return;

		try {
			// Capture screenshot directly using chrome API
			const response = await chrome.runtime.sendMessage({
				action: 'captureScreenshot',
			});

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
						text: `Analyze this algorithms/data structures question from the screenshot.

**MULTIPLE CHOICE QUESTION:**
- State ALL correct answer(s) - there may be more than one correct answer
- Format: "Answer: A, C" or "Answer: B" (letters only, comma-separated if multiple)
- Brief explanation of why each selected answer is correct

**OPEN-ENDED QUESTION:**
- Provide a clear, concise answer
- Include relevant algorithm/data structure concepts
- If code helps explain, include brief pseudocode or code snippet
- Mention time/space complexity if applicable

Keep responses concise and focused on the answer.`,
					},
					{
						type: 'input_image',
						image_url: response.dataUrl,
					},
				],
			});

			// Send to OpenAI (this function handles all state management)
			await sendToOpenAI();
		} catch (error) {
			displayMessage('system', `Error capturing screenshot: ${error.message}`);
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
					Authorization: `Bearer ${OPENAI_API_KEY}`,
				},
				body: JSON.stringify({
					reasoning: {
						effort: 'medium',
					},
					model: MODEL_NAME,
					input: conversationHistory,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(
					errorData.error?.message || `API Error: ${response.status}`,
				);
			}

			const data = await response.json();

			// Parse Responses API output structure
			let assistantMessage = '';
			let messageObj = null;
			if (data.output && Array.isArray(data.output)) {
				// Last message item is the final answer (earlier ones may be commentary)
				messageObj = data.output.findLast((item) => item.type === 'message');
				if (
					messageObj &&
					messageObj.content &&
					Array.isArray(messageObj.content)
				) {
					// Find the output_text item in content array
					const textObj = messageObj.content.find(
						(item) => item.type === 'output_text',
					);
					if (textObj && textObj.text) {
						assistantMessage = textObj.text;
					}
				}
			}

			// Add to conversation history; newer models expect `phase` echoed back on assistant turns
			conversationHistory.push({
				role: 'assistant',
				content: assistantMessage,
				...(messageObj?.phase && { phase: messageObj.phase }),
			});

			// Display assistant message
			displayMessage('assistant', assistantMessage);
		} catch (error) {
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
					// Silent fail
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

		// Apply syntax highlighting to code blocks
		if (role === 'assistant') {
			setTimeout(() => {
				if (window.hljs) {
					const codeBlocks = messageDiv.querySelectorAll('pre code');
					codeBlocks.forEach((block) => {
						try {
							window.hljs.highlightElement(block);
						} catch (e) {
							// Silent fail
						}
					});
				}
			}, 100);
		}
	}

	function formatMessage(text) {
		// Use marked.js for full Markdown support if available
		if (window.marked) {
			try {
				return window.marked.parse(text);
			} catch (e) {
				// Fall through to basic formatting
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

	// Minimize button - hide without clearing history
	minimizeButton.addEventListener('click', (e) => {
		e.stopPropagation();
		e.preventDefault();
		chatPanel.classList.remove('visible');
	});

	// Close button - hide and clear history
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
		if (
			e.target === closeButton ||
			e.target.closest('#close-button') ||
			e.target === minimizeButton ||
			e.target.closest('#minimize-button')
		) {
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
})();
