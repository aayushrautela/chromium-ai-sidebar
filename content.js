// --- Globals ---
let iframePanel;
let selectionToolbar;
let resizeHandle;
let isResizing = false;
const DEFAULT_PANEL_WIDTH = 360;
let currentPanelWidth = DEFAULT_PANEL_WIDTH;

// --- Iframe & Page Manipulation ---
function createIframePanel() {
    if (document.getElementById('gemini-iframe-panel')) return;
    iframePanel = document.createElement('iframe');
    iframePanel.id = 'gemini-iframe-panel';
    iframePanel.src = chrome.runtime.getURL('sidebar.html');
    Object.assign(iframePanel.style, {
        position: 'fixed', top: '0', right: '0', width: `${currentPanelWidth}px`, height: '100%',
        border: 'none', zIndex: '2147483647', display: 'none', boxShadow: '-2px 0 15px rgba(0,0,0,0.2)',
        transition: 'transform 0.3s ease-in-out', transform: 'translateX(100%)'
    });
    document.body.appendChild(iframePanel);

    resizeHandle = document.createElement('div');
    resizeHandle.id = 'gemini-resize-handle';
    Object.assign(resizeHandle.style, {
        position: 'fixed', top: '0', right: `${currentPanelWidth}px`, width: '8px', height: '100%',
        cursor: 'ew-resize', zIndex: '2147483647', display: 'none', transform: 'translateX(100%)'
    });
    document.body.appendChild(resizeHandle);
    resizeHandle.addEventListener('mousedown', initResize);
}

function showIframePanel() {
    if (!iframePanel) createIframePanel();
    iframePanel.style.display = 'block';
    resizeHandle.style.display = 'block';
    setTimeout(() => {
        iframePanel.style.transform = 'translateX(0)';
        resizeHandle.style.transform = 'translateX(0)';
        resizeHandle.style.right = `${currentPanelWidth - 4}px`;
    }, 10);
    document.documentElement.style.width = `calc(100% - ${currentPanelWidth}px)`;
    document.documentElement.style.transition = 'width 0.3s ease-in-out';
}

function hideIframePanel() {
    if (!iframePanel) return;
    iframePanel.style.transform = 'translateX(100%)';
    resizeHandle.style.transform = 'translateX(100%)';
    document.documentElement.style.width = '100%';
    setTimeout(() => {
        iframePanel.style.display = 'none';
        resizeHandle.style.display = 'none';
    }, 300);
}

function toggleIframePanel() {
    if (!iframePanel || iframePanel.style.display === 'none' || iframePanel.style.transform === 'translateX(100%)') {
        showIframePanel();
    } else {
        hideIframePanel();
    }
}

// --- Resizing Logic ---
function initResize(e) {
    isResizing = true;
    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResize);
    document.body.style.userSelect = 'none';
    iframePanel.style.pointerEvents = 'none';
}

function doResize(e) {
    if (!isResizing) return;
    let newWidth = window.innerWidth - e.clientX;
    if (newWidth < 300) newWidth = 300;
    if (newWidth > 800) newWidth = 800;
    currentPanelWidth = newWidth;
    iframePanel.style.width = `${currentPanelWidth}px`;
    resizeHandle.style.right = `${currentPanelWidth - 4}px`;
    document.documentElement.style.width = `calc(100% - ${currentPanelWidth}px)`;
}

function stopResize() {
    isResizing = false;
    window.removeEventListener('mousemove', doResize);
    window.removeEventListener('mouseup', stopResize);
    document.body.style.userSelect = 'auto';
    iframePanel.style.pointerEvents = 'auto';
    chrome.storage.local.set({ 'geminiPanelWidth': currentPanelWidth });
}

// --- Toolbar Logic ---
function createSelectionToolbar() {
    if (document.getElementById('ai-selection-toolbar')) return;
    selectionToolbar = document.createElement('div');
    selectionToolbar.id = 'ai-selection-toolbar';
    Object.assign(selectionToolbar.style, {
        position: 'absolute', zIndex: '2147483647', backgroundColor: '#333', color: 'white',
        borderRadius: '8px', padding: '5px 10px', boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
        fontFamily: 'sans-serif', fontSize: '14px', display: 'none', gap: '8px'
    });
    selectionToolbar.innerHTML = `<button data-action="summarize_selection">Summarize</button><button data-action="explain_selection">Explain</button><button data-action="translate_selection">Translate</button>`;
    selectionToolbar.querySelectorAll('button').forEach(btn => Object.assign(btn.style, { background: '#555', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer' }));
    document.body.appendChild(selectionToolbar);
}

function showToolbar() {
    if (!selectionToolbar) return;
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || selection.isCollapsed) {
        hideToolbar();
        return;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
        selectionToolbar.style.display = 'flex';
        let top = window.scrollY + rect.top - selectionToolbar.offsetHeight - 10;
        let left = window.scrollX + rect.left + (rect.width - selectionToolbar.offsetWidth) / 2;
        if (top < window.scrollY) top = window.scrollY + rect.bottom + 10;
        if (left < 0) left = 5;
        if (left + selectionToolbar.offsetWidth > window.innerWidth) left = window.innerWidth - selectionToolbar.offsetWidth - 5;
        selectionToolbar.style.top = `${top}px`;
        selectionToolbar.style.left = `${left}px`;
    } else {
        hideToolbar();
    }
}

function hideToolbar() {
    if (selectionToolbar) selectionToolbar.style.display = 'none';
}

// --- Message Handling & Event Listeners ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleIframePanel") {
        toggleIframePanel();
    } else if (request.action === 'extractContent') {
        sendResponse({ success: true, content: extractPageContent() });
    }
});

(async () => {
    const data = await chrome.storage.local.get('geminiPanelWidth');
    if (data.geminiPanelWidth) currentPanelWidth = data.geminiPanelWidth;
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        createIframePanel();
        createSelectionToolbar();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            createIframePanel();
            createSelectionToolbar();
        });
    }
})();

// On toolbar click, send message to the sidebar iframe
document.addEventListener('click', (e) => {
    if (e.target.matches('#ai-selection-toolbar button')) {
        const action = e.target.dataset.action;
        const selectedText = window.getSelection().toString().trim();
        if (action && selectedText) {
            showIframePanel();
            if (iframePanel.contentWindow) {
                iframePanel.contentWindow.postMessage({ action: 'performSelectionAction', task: action, selectedText: selectedText }, '*');
            }
        }
    }
});


// FIX: Use mouseup to reliably show the toolbar
document.addEventListener('mouseup', (e) => {
    // Don't show toolbar if we are resizing or clicking on the toolbar itself
    if (isResizing || (selectionToolbar && selectionToolbar.contains(e.target))) {
        return;
    }
    
    // Use a small delay to allow the browser to finalize the selection
    setTimeout(() => {
        const selectionText = window.getSelection().toString().trim();
        if (selectionText.length > 10) {
            showToolbar();
        } else {
            hideToolbar();
        }
    }, 10);
});

// Hide toolbar when starting a new selection
document.addEventListener('mousedown', (e) => {
    // Don't hide if we are clicking on the toolbar or starting a resize
    if ((selectionToolbar && selectionToolbar.contains(e.target)) || (resizeHandle && resizeHandle.contains(e.target))) {
        return;
    }
    hideToolbar();
}, { capture: true });


// --- Page Content Extraction Logic ---
function extractPageContent() {
  if (typeof Readability !== 'undefined') {
    try {
      const article = new Readability(document.cloneNode(true)).parse();
      if (article && article.textContent) return { title: article.title, content: article.textContent };
    } catch (e) { console.warn('Readability failed, falling back.', e); }
  }
  return { title: document.title, content: document.body.innerText };
}