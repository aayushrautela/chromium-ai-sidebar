// Background script for Gemini Page Summarizer extension

chrome.runtime.onInstalled.addListener(() => {
  console.log('Gemini Page Summarizer extension installed');
});

// Handle side panel opening
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    console.error('Error opening side panel:', error);
  }
});

// Listen for tab updates to enable/disable the summarize button
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status) {
        chrome.runtime.sendMessage({
            action: 'updateTabStatus',
            tabId: tabId,
            status: changeInfo.status
        }).catch(err => console.log('Error sending tab status message:', err));
    }
});

// Handle messages from content scripts and sidebar
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);
  
  if (request.action === 'getPageContent') {
    // Forward the request to the content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'extractContent' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending message to content script:', chrome.runtime.lastError);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse(response);
          }
        });
      } else {
        console.error('No active tab found');
        sendResponse({ success: false, error: 'No active tab found' });
      }
    });
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'callGeminiAPI') {
    console.log('Calling Gemini API with model:', request.model);
    callGeminiAPI(request.prompt, request.apiKey, request.model, request.requestJson)
      .then(response => {
        console.log('Gemini API success');
        sendResponse({ success: true, data: response });
      })
      .catch(error => {
        console.error('Gemini API error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
});

// Function to call Gemini API
async function callGeminiAPI(prompt, apiKey, model = 'gemini-2.5-flash-lite', requestJson = false) {
  if (!apiKey) {
    throw new Error('API key not provided');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    }
  };

  // Add JSON response format if requested
  if (requestJson) {
    requestBody.generationConfig.responseMimeType = "application/json";
  }

  try {
    console.log('Making request to Gemini API:', url);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log('Gemini API response received');
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
}