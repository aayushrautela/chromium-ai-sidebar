// Background script for Gemini Page Summarizer extension

chrome.runtime.onInstalled.addListener(() => {
  console.log('Gemini Page Summarizer extension installed');
});

// When the user clicks the action button, send a message to the content script
// to toggle the custom iframe panel.
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { action: "toggleIframePanel" });
});

// Handle messages from content scripts and sidebar
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageContent') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'extractContent' }, (response) => {
          sendResponse(response || { success: false, error: 'No response from content script' });
        });
      } else {
        sendResponse({ success: false, error: 'No active tab found' });
      }
    });
    return true;
  }
  
  // This listener now only handles direct API calls from the sidebar
  if (request.action === 'callGeminiAPI') {
    callGeminiAPI(request.prompt, request.apiKey, request.model, request.requestJson)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function callGeminiAPI(prompt, apiKey, model = 'gemini-2.5-flash-lite', requestJson = false) {
  if (!apiKey) throw new Error('API key not provided');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 2048 }
    })
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
  }
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}