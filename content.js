// Content script for extracting page content using Readability

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractContent') {
    try {
      const content = extractPageContent();
      sendResponse({ success: true, content: content });
    } catch (error) {
      console.error('Error extracting content:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
});

function extractPageContent() {
  // Try to use Readability if available
  if (typeof Readability !== 'undefined') {
    try {
      const documentClone = document.cloneNode(true);
      const reader = new Readability(documentClone, {
        debug: false,
        maxElemsToParse: 0,
        nbTopCandidates: 5,
        charThreshold: 500,
        classesToPreserve: ['caption', 'emoji', 'hidden', 'sr-only']
      });
      
      const article = reader.parse();
      
      if (article && article.textContent) {
        return {
          title: article.title || document.title,
          content: article.textContent,
          url: window.location.href,
          domain: window.location.hostname,
          extractedAt: new Date().toISOString()
        };
      }
    } catch (readabilityError) {
      console.warn('Readability failed, falling back to basic extraction:', readabilityError);
    }
  } else {
    console.warn('Readability not available, using basic extraction');
  }
  
  // Fallback to basic content extraction
  return extractBasicContent();
}

function extractBasicContent() {
  // Fallback method when Readability fails
  const title = document.title;
  
  // Try to get main content from common selectors
  const contentSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '.post-content',
    '.entry-content',
    '.article-content',
    '#content',
    '#main'
  ];
  
  let content = '';
  let contentElement = null;
  
  for (const selector of contentSelectors) {
    contentElement = document.querySelector(selector);
    if (contentElement) {
      break;
    }
  }
  
  if (contentElement) {
    // Remove script and style elements
    const scripts = contentElement.querySelectorAll('script, style, noscript');
    scripts.forEach(el => el.remove());
    
    content = contentElement.textContent || contentElement.innerText;
  } else {
    // Last resort: get all text content
    const body = document.body.cloneNode(true);
    const scripts = body.querySelectorAll('script, style, noscript, nav, header, footer, aside');
    scripts.forEach(el => el.remove());
    content = body.textContent || body.innerText;
  }
  
  // Clean up the content
  content = content
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/\n\s*\n/g, '\n') // Remove empty lines
    .trim();
  
  return {
    title: title,
    content: content,
    url: window.location.href,
    domain: window.location.hostname,
    extractedAt: new Date().toISOString()
  };
}