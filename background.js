// Background Service Worker
// Handles screenshot capture and other background tasks

console.log('ChatGPT Widget background service worker loaded');

// Listen for messages from content script / chat interface
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureScreenshot') {
    handleScreenshotCapture(sender.tab.id)
      .then(dataUrl => {
        sendResponse({ success: true, dataUrl: dataUrl });
      })
      .catch(error => {
        console.error('Screenshot capture error:', error);
        sendResponse({ success: false, error: error.message });
      });

    // Return true to indicate we'll send response asynchronously
    return true;
  }
});

async function handleScreenshotCapture(tabId) {
  try {
    // Capture the visible area of the current tab
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 100
    });

    if (!dataUrl) {
      throw new Error('Failed to capture screenshot');
    }

    console.log('Screenshot captured successfully');
    return dataUrl;

  } catch (error) {
    console.error('Error capturing screenshot:', error);
    throw new Error(`Screenshot capture failed: ${error.message}`);
  }
}

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('ChatGPT Widget extension installed');
  } else if (details.reason === 'update') {
    console.log('ChatGPT Widget extension updated');
  }
});

// Keep service worker alive (if needed)
chrome.runtime.onStartup.addListener(() => {
  console.log('ChatGPT Widget service worker started');
});
