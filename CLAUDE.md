# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome extension that embeds a ChatGPT chat interface on any webpage with complete isolation from the host page. The extension integrates directly with OpenAI's API and includes screenshot capture functionality for visual analysis.

**Key Feature**: Complete isolation using Shadow DOM to prevent interference with host page JavaScript, events, and layout.

## Development Commands

### Loading the Extension
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `test-ext` folder
4. Reload the extension after making changes

### Testing Changes
After modifying any files:
1. Go to `chrome://extensions/`
2. Click the reload icon for this extension
3. Refresh any open webpages where you want to test the widget

## Architecture

### Component Structure

The extension uses a **three-layer architecture**:

1. **background.js** (Service Worker)
   - Handles screenshot capture via `chrome.tabs.captureVisibleTab`
   - Responds to `captureScreenshot` messages from content script
   - Runs persistently in the background

2. **content.js** (Content Script)
   - Injected into all webpages (`<all_urls>`)
   - Creates Shadow DOM (closed mode) for complete CSS/JS isolation
   - Contains all chat UI logic and OpenAI API integration
   - Manages conversation state and message history
   - Lines 15-16: OpenAI API key and model configuration

3. **chat.html + chat.js** (Legacy/Reference)
   - These files exist but are NOT currently used by the extension
   - The chat logic has been merged directly into content.js
   - Kept for reference or future refactoring

### Isolation Strategy

The extension achieves complete isolation through:

- **Shadow DOM (closed mode)**: Prevents CSS leakage and style conflicts (content.js:29)
- **Event capture prevention**: All events stop propagation at shadow boundary
- **No iframe**: Previous versions used iframes, but current implementation uses Shadow DOM only to avoid focus/blur issues
- **Single element injection**: Only one `shadowHost` element added to the host page (content.js:25-26)

### Key Implementation Details

**Chat Message Flow:**
1. User types message → `handleSendMessage()` (content.js:246)
2. Message added to `conversationHistory` array (content.js:264-267)
3. `sendToOpenAI()` makes API call to OpenAI Responses API (content.js:316-363)
   - Sends conversation history via `input` parameter
   - Parses response using `output_text` field
4. Response displayed via `displayMessage()` (content.js:365-431)

**Screenshot Flow:**
1. User clicks camera button → `handleScreenshot()` (content.js:273)
2. Message sent to background script via `chrome.runtime.sendMessage`
3. Background script captures tab via `chrome.tabs.captureVisibleTab` (background.js:26-29)
4. Data URL returned and added to conversation with vision prompt (content.js:288-302)
5. OpenAI API called with image included in message content

**Widget Positioning:**
- Toggle button: Bottom-right corner, 10px circle with low opacity (content.js:42-68)
- Chat panel: 280px × 400px, draggable via header (content.js:78-91)
- Drag implementation: mousedown/mousemove/mouseup events (content.js:474-511)

### State Management

All state is maintained in content.js:
- `conversationHistory`: Array of message objects in OpenAI format (content.js:21)
- `isProcessing`: Boolean flag to prevent concurrent API calls (content.js:22)
- Chat history cleared when closing panel via `clearChatHistory()` (content.js:412-431)

### API Configuration

Located at the top of content.js (lines 14-18):
- `OPENAI_API_KEY`: Empty string in the repo; paste your own key locally and never commit it (empty key shows a config error in the widget)
- `MODEL_NAME`: Currently set to 'gpt-6.2-sol' (supports image input; 'gpt-6.2-astra' is the pricier flagship alternative). GPT-5.1 is deprecated (shutdown Apr 1, 2027)
- `API_ENDPOINT`: OpenAI Responses API endpoint (`/v1/responses`)

**Note**: The extension now uses the **Responses API** instead of Chat Completions. This provides better performance, improved cache utilization, and built-in support for tools like web search and code interpreter.

**Responses API Key Differences:**
- Uses `input` parameter instead of `messages` in requests (content.js:365)
- Uses `reasoning.effort: "medium"` (gpt-6.2 accepts low/medium/high/xhigh/max; `none` is rejected)
- Complex response structure with `output` array containing multiple objects (content.js:376-388):
  - `output` array may contain `reasoning` and `message` objects
  - Text extracted from the last message item: `output.findLast(type='message').content.find(type='output_text').text`
  - The message's `phase` (`commentary`/`final_answer`) is echoed back on the assistant history entry, as OpenAI requires for newer models
- Uses different content types: `input_text` and `input_image` instead of `text` and `image_url` (content.js:292-297)
- Image URL format: `image_url: "data:image/png;base64,..."` (string) instead of `image_url: { url: "..." }` (object)
- Supported content types: `input_text`, `input_image`, `output_text`, `refusal`, `input_file`, `computer_screenshot`, `summary_text`
- Supports server-side conversation state via `previous_response_id` (not currently implemented)
- 3% improvement in model intelligence for reasoning models vs Chat Completions
- 40-80% better cache utilization
- Reasoning tokens tracked separately in `usage.output_tokens_details.reasoning_tokens`

## File Structure

```
test-ext/
├── manifest.json       # Extension configuration (Manifest V3)
├── content.js          # Main logic: Shadow DOM + chat + API integration
├── background.js       # Service worker for screenshot capture
├── styles.css          # Chat interface styles (loaded into Shadow DOM)
├── chat.html           # [UNUSED] Legacy chat interface
├── chat.js             # [UNUSED] Legacy chat logic
└── README.md           # User-facing documentation
```

## Important Notes

### Security
- `OPENAI_API_KEY` in content.js:15 is committed as an empty string; never commit a real key
- Extension has `<all_urls>` permission to work on all websites
- Screenshot capability requires `activeTab` and `tabs` permissions

### Preventing Multiple Injections
The extension uses a global flag to prevent duplicate injections:
```javascript
if (window.__chatgpt_widget_injected__) return;
window.__chatgpt_widget_injected__ = true;
```
(content.js:9-12)

### Message Formatting

**Full Markdown Support** via marked.js (v11.1.1) in `formatMessage()` (content.js:477-499):

The extension now supports complete GitHub Flavored Markdown (GFM):

**Text Formatting:**
- Bold: `**text**` or `__text__`
- Italic: `*text*` or `_text_`
- Strikethrough: `~~text~~`
- Inline code: `` `code` ``

**Headers:**
- H1-H6: `# Header` through `###### Header`
- H1 and H2 have bottom borders for visual separation

**Lists:**
- Unordered: `- item` or `* item`
- Ordered: `1. item`
- Nested lists supported
- Task lists: `- [ ]` and `- [x]`

**Links and Images:**
- Links: `[text](url)`
- Images: `![alt](url)`
- Automatic URL detection

**Code:**
- Code blocks: ` ```language\ncode\n``` `
- Inline code with `.inline-code` class
- 190+ languages supported with syntax highlighting

**Other Elements:**
- Blockquotes: `> quote`
- Horizontal rules: `---` or `***`
- Tables with headers and alternating row colors
- Line breaks with `breaks: true` option

**Syntax Highlighting Integration:**
- Uses highlight.js (v11.9.0) via marked.js highlight callback (content.js:167-174)
- GitHub Dark theme (content.js:154-157)
- Integrated during Markdown parsing for optimal performance
- Automatic language detection for code blocks

**Styling:**
- Comprehensive CSS for all Markdown elements (styles.css:215-359)
- Professional typography and spacing
- Purple theme for links matching widget colors
- Responsive tables and images

### Current Model Configuration
The extension is configured to use 'gpt-6.2-sol' which requires:
- Valid OpenAI API key with access to this model
- Screenshot analysis uses vision capabilities
- No `temperature` is sent; reasoning effort controls response quality
