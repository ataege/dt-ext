# ChatGPT Isolated Chat Widget - Chrome Extension

A non-intrusive Chrome extension that embeds a ChatGPT chat interface on any webpage with complete isolation from the host page's JavaScript, events, and layout.

## Features

✨ **Complete Isolation**: Uses Shadow DOM and iframe to prevent any interference with the host page
🎯 **Non-Intrusive**: No blur, focusout, or document events triggered on the host page
💬 **ChatGPT Integration**: Direct integration with OpenAI's API (GPT-4o with vision support)
📸 **Screenshot Capture**: Capture and analyze the current page with a single click
🎨 **Beautiful UI**: Modern, draggable bottom-right corner widget
⚡ **Zero Conflicts**: Isolated from all webpage scripts and styles

## Installation

### 1. Get Your OpenAI API Key

1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the API key (you won't be able to see it again!)

### 2. Configure the Extension

1. Open `chat.js` in a text editor
2. Find line 7: `const OPENAI_API_KEY = 'YOUR_API_KEY_HERE';`
3. Replace `YOUR_API_KEY_HERE` with your actual API key
4. Save the file

**Example:**
```javascript
const OPENAI_API_KEY = 'sk-proj-abcdefghijklmnopqrstuvwxyz123456789';
```

### 3. Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select the `test-ext` folder
5. The extension should now appear in your extensions list

## Usage

### Opening the Chat

1. Navigate to any webpage
2. Look for the purple circular button in the bottom-right corner
3. Click the button to open the chat panel

### Chatting with ChatGPT

1. Type your message in the input field at the bottom
2. Press Enter or click the send button (arrow icon)
3. ChatGPT will respond in the conversation

**Keyboard Shortcuts:**
- `Enter` - Send message
- `Shift + Enter` - New line in message

### Screenshot Feature

1. Click the green camera button (left side of input)
2. The extension will capture the visible portion of the current page
3. The screenshot is automatically sent to ChatGPT with the prompt:
   *"I've captured a screenshot of the current webpage. Please analyze it and tell me what you see."*
4. ChatGPT will analyze the image and respond

### Moving the Chat Panel

- Click and hold the purple header bar
- Drag the panel anywhere on the screen
- Release to drop it in place

### Closing the Chat

- Click the "×" button in the top-right of the chat panel

## File Structure

```
test-ext/
├── manifest.json       # Extension configuration
├── content.js          # Injects isolated UI container
├── background.js       # Service worker for screenshots
├── chat.html           # Chat interface (loaded in iframe)
├── chat.js             # Chat logic & OpenAI API integration
├── styles.css          # Isolated styling
└── README.md           # This file
```

## Technical Details

### Isolation Techniques

1. **Shadow DOM (Closed Mode)**
   - Complete CSS isolation
   - No style leakage in either direction
   - Host page styles don't affect the widget

2. **Event Capture Prevention**
   - All events stop propagation at the shadow boundary
   - No blur, focus, or mouse events reach the host page
   - `pointer-events` managed carefully

3. **iframe Sandboxing**
   - Chat interface runs in a sandboxed iframe
   - Complete JavaScript isolation
   - `allow-scripts allow-same-origin` permissions only

4. **Minimal DOM Impact**
   - Only one element added to host page (shadow host)
   - No modification of existing page structure
   - No global variable pollution

### Model Configuration

The extension is currently configured to use **GPT-4o**, which supports:
- Text conversations
- Vision/image analysis
- Screenshot understanding

To change the model, edit `chat.js` line 12:
```javascript
const MODEL_NAME = 'gpt-4o';  // or 'gpt-4-turbo', 'gpt-3.5-turbo', etc.
```

**Note:** If GPT-5.1 becomes available, simply update this line to:
```javascript
const MODEL_NAME = 'gpt-5.1';
```

### API Costs

⚠️ **Important**: This extension uses OpenAI's paid API. Costs depend on:
- Model used (GPT-4o is more expensive than GPT-3.5-turbo)
- Message length
- Number of messages
- Screenshot analysis (vision features cost more)

Check [OpenAI's pricing page](https://openai.com/pricing) for current rates.

## Troubleshooting

### "Error: Please configure your OpenAI API key"
- Your API key is not set correctly in `chat.js`
- Make sure you replaced `YOUR_API_KEY_HERE` with your actual key
- Ensure there are no extra spaces or quotes

### "API Error: 401"
- Your API key is invalid or expired
- Generate a new key from OpenAI's dashboard

### "API Error: 429"
- You've exceeded your rate limit
- Wait a few minutes and try again
- Check your OpenAI account billing

### Screenshot not working
- Make sure you've granted the extension permission to capture tabs
- Try refreshing the page and reopening the extension
- Check the Chrome console for error messages

### Chat button not appearing
- Refresh the page (F5)
- Check if the extension is enabled in `chrome://extensions/`
- Look in the browser console for errors (F12 → Console)

## Security Notes

### API Key Storage

Currently, the API key is hardcoded in `chat.js` for personal use. This means:

✅ **Safe for personal use** (extension not distributed)
❌ **Not safe for distribution** (others can extract your key)

If you plan to share this extension:
1. Remove the hardcoded API key
2. Implement a settings page where users enter their own key
3. Store keys securely using `chrome.storage.local`

### Permissions

The extension requests these permissions:
- `activeTab` - To inject the chat widget on the current page
- `scripting` - To run content scripts
- `storage` - For future settings storage
- `<all_urls>` - To work on all websites

## Customization

### Changing Widget Position

Edit `content.js` line 60-61:
```javascript
bottom: 20px;  // Distance from bottom
right: 20px;   // Distance from right
```

### Changing Widget Size

Edit `content.js` line 118-119:
```javascript
width: 400px;   // Panel width
height: 600px;  // Panel height
```

### Changing Colors

Edit the gradient colors in `content.js` and `styles.css`:
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

Replace `#667eea` and `#764ba2` with your preferred colors.

## License

This project is provided as-is for personal use and educational purposes.

## Support

For issues with:
- **OpenAI API**: Visit [OpenAI Help](https://help.openai.com/)
- **Extension bugs**: Check the browser console (F12) for error messages

## Changelog

### Version 1.0.0
- Initial release
- Shadow DOM isolation
- GPT-4o integration
- Screenshot capture
- Draggable interface
- Zero host page interference
