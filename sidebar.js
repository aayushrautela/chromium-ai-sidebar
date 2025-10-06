// Enhanced Sidebar JavaScript for Gemini Page Summarizer with Tab Tracking and Animations

class GeminiSummarizer {
  constructor() {
    this.apiKey = '';
    this.model = 'gemini-2.5-flash-lite';
    this.currentPageContent = null;
    this.chatHistory = [];
    this.isDarkMode = false;
    this.currentTabId = null;
    this.tabChats = new Map(); // Store chats per tab
    this.ongoingOperations = new Map(); // Track ongoing operations per tab
    this.currentOperation = null; // Track current operation
    
    this.initializeElements();
    this.loadSettings();
    this.setupEventListeners();
    this.initializeTheme();
    this.initializeTabTracking();
    this.initializeTabSwitching();
    this.listenForTabStatus();
  }

  initializeElements() {
    // Main elements
    this.settingsBtn = document.getElementById('settingsBtn');
    this.themeToggle = document.getElementById('themeToggle');
    this.settingsPanel = document.getElementById('settingsPanel');
    this.apiKeyInput = document.getElementById('apiKey');
    this.modelSelect = document.getElementById('model');
    this.summaryStrengthSelect = document.getElementById('summaryStrength');
    this.saveSettingsBtn = document.getElementById('saveSettings');
    this.cancelSettingsBtn = document.getElementById('cancelSettings');
    
    // Content elements
    this.chatInterface = document.getElementById('chatInterface');
    this.loadingState = document.getElementById('loadingState');
    this.summarizeBtn = document.getElementById('summarizeBtn');
    this.chatMessages = document.getElementById('chatMessages');
    this.chatInput = document.getElementById('chatInput');
    this.sendBtn = document.getElementById('sendBtn');
    this.currentTabTitle = document.getElementById('currentTabTitle');
    this.tabFavicon = document.getElementById('tabFavicon');
    this.defaultFavicon = document.getElementById('defaultFavicon');
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['apiKey', 'model', 'summaryStrength', 'theme']);
      this.apiKey = result.apiKey || '';
      this.model = result.model || 'gemini-2.5-flash-lite';
      this.isDarkMode = result.theme === 'dark';
      
      this.apiKeyInput.value = this.apiKey;
      this.modelSelect.value = this.model;
      this.summaryStrengthSelect.value = result.summaryStrength || 'short';
      this.updateTheme();
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.sync.set({
        apiKey: this.apiKey,
        model: this.model,
        summaryStrength: this.summaryStrengthSelect.value,
        theme: this.isDarkMode ? 'dark' : 'light'
      });
      this.showNotification('Settings saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showNotification('Error saving settings', 'error');
    }
  }

  setupEventListeners() {
    // Settings
    this.settingsBtn.addEventListener('click', () => this.toggleSettings());
    this.saveSettingsBtn.addEventListener('click', () => this.handleSaveSettings());
    this.cancelSettingsBtn.addEventListener('click', () => this.toggleSettings());
    
    // Theme toggle
    this.themeToggle.addEventListener('click', () => this.toggleTheme());
    
    // Main actions
    this.summarizeBtn.addEventListener('click', () => this.summarizePage());
    
    // Chat
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Event delegation for question buttons and center summarize button
    this.chatMessages.addEventListener('click', (e) => {
      if (e.target.classList.contains('question-btn')) {
        const question = e.target.textContent.trim();
        this.askQuestion(question);
      } else if (e.target.id === 'summarizeBtnCenter' || e.target.closest('#summarizeBtnCenter')) {
        this.summarizePage();
      }
    });

    // Dynamic textarea height
    this.chatInput.addEventListener('input', () => {
      this.chatInput.style.height = 'auto';
      this.chatInput.style.height = (this.chatInput.scrollHeight) + 'px';
    });
  }

  initializeTheme() {
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      this.isDarkMode = true;
    }
    this.updateTheme();
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    this.updateTheme();
    this.saveSettings();
  }

  updateTheme() {
    const body = document.body;
    const sunIcon = document.getElementById('sunIcon');
    const moonIcon = document.getElementById('moonIcon');
    
    if (this.isDarkMode) {
      body.setAttribute('data-theme', 'dark');
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
    } else {
      body.setAttribute('data-theme', 'light');
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
    }
  }

  toggleSettings() {
    this.settingsPanel.classList.toggle('hidden');
  }

  async handleSaveSettings() {
    this.apiKey = this.apiKeyInput.value.trim();
    this.model = this.modelSelect.value;
    
    if (!this.apiKey) {
      this.showNotification('Please enter an API key', 'error');
      return;
    }
    
    await this.saveSettings();
    this.toggleSettings();
  }

  async initializeTabTracking() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        this.currentTabId = tab.id;
        this.updateTabDetails(tab);
        this.setSummarizeButtonState(tab.status === 'complete');
        this.loadTabChat();
      }
    } catch (error) {
      console.error('Error getting current tab:', error);
    }
  }

  initializeTabSwitching() {
    chrome.tabs.onActivated.addListener(activeInfo => {
      if (this.currentTabId !== activeInfo.tabId) {
        if (this.currentTabId) {
          this.saveTabChat();
        }
        this.cancelOngoingOperations();
        this.clearCurrentTabContent();
        chrome.tabs.get(activeInfo.tabId, (tab) => {
          if (tab) {
            this.currentTabId = tab.id;
            this.updateTabDetails(tab);
            this.setSummarizeButtonState(tab.status === 'complete');
            this.loadTabChat();
          }
        });
      }
    });
  }

  listenForTabStatus() {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
          if (request.action === 'updateTabStatus' && request.tabId === this.currentTabId) {
              this.setSummarizeButtonState(request.status === 'complete');
          }
      });
  }

  updateTabDetails(tab) {
      if (!tab) return;
  
      // Update title
      const title = tab.title || tab.url;
      this.currentTabTitle.textContent = title.length > 40 ? title.substring(0, 40) + '...' : title;
      this.currentTabTitle.title = title; // Set full title on hover
  
      // Update favicon
      if (tab.favIconUrl && tab.favIconUrl.startsWith('http')) {
          this.tabFavicon.src = tab.favIconUrl;
          this.tabFavicon.style.display = 'block';
          this.defaultFavicon.style.display = 'none';
      } else {
          this.tabFavicon.style.display = 'none';
          this.defaultFavicon.style.display = 'block';
      }
  }

  cancelOngoingOperations() {
    if (this.currentOperation) {
      this.currentOperation = null;
    }
    if (this.currentTabId && this.ongoingOperations.has(this.currentTabId)) {
      this.ongoingOperations.delete(this.currentTabId);
    }
    this.currentPageContent = null;
    this.hideLoadingInChat();
    this.showChatInterface();
  }

  startOperation(operationType) {
    this.currentOperation = { type: operationType, tabId: this.currentTabId };
    if (this.currentTabId) {
      this.ongoingOperations.set(this.currentTabId, operationType);
    }
  }

  completeOperation() {
    if (this.currentTabId) {
      this.ongoingOperations.delete(this.currentTabId);
    }
    this.currentOperation = null;
  }

  clearCurrentTabContent() {
    this.currentPageContent = null;
    this.chatMessages.innerHTML = '';
  }

  loadTabChat() {
    this.chatMessages.innerHTML = '';
    if (this.currentTabId && this.tabChats.has(this.currentTabId)) {
      const tabChat = this.tabChats.get(this.currentTabId);
      this.chatHistory = tabChat.messages || [];
      this.currentPageContent = tabChat.pageContent || null;
      
      if (this.chatHistory.length > 0) {
        this.showChatInterface();
        this.renderChatHistory();
      } else {
        this.chatHistory = [];
        this.currentPageContent = null;
        this.showInitialState();
      }
    } else {
      this.chatHistory = [];
      this.currentPageContent = null;
      this.showInitialState();
    }
  }

  saveTabChat() {
    if (this.currentTabId) {
      this.tabChats.set(this.currentTabId, {
        messages: this.chatHistory,
        pageContent: this.currentPageContent
      });
    }
  }

  async summarizePage() {
    const operationTabId = this.currentTabId;
    if (!this.apiKey) {
      this.showNotification('Please configure your API key in settings', 'error');
      this.toggleSettings();
      return;
    }
    if (this.currentOperation) {
      this.showNotification('Please wait for the current operation to complete', 'error');
      return;
    }
    this.startOperation('summarize');
    this.showLoading();
    try {
      const response = await this.getPageContent();
      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to extract page content');
      }
      const pageContent = response.content;
      const summaryStrength = await this.getSummaryStrength();
      const summaryPrompt = this.getSummaryPrompt(summaryStrength)
        .replace(/{title}/g, pageContent.title)
        .replace(/{content}/g, pageContent.content)
        .replace(/{url}/g, pageContent.url || '');
      const summary = await this.callGeminiAPI(summaryPrompt, true);
      if (this.currentTabId !== operationTabId) {
        const targetTabChat = this.tabChats.get(operationTabId) || { messages: [], pageContent: null };
        targetTabChat.messages = [];
        targetTabChat.pageContent = pageContent;
        targetTabChat.messages.push({ message: this.renderStructuredSummary(summary), sender: 'assistant', timestamp: new Date().toISOString() });
        this.tabChats.set(operationTabId, targetTabChat);
      } else {
        this.currentPageContent = pageContent;
        this.chatHistory = [];
        this.chatMessages.innerHTML = '';
        this.addMessageToChat(this.renderStructuredSummary(summary), 'assistant');
        this.saveTabChat();
        this.showChatInterface();
      }
    } catch (error) {
      console.error('Error summarizing page:', error);
      this.showNotification(`Error: ${error.message}`, 'error');
      if (this.currentTabId === operationTabId) {
        this.showInitialState();
      }
    } finally {
      this.completeOperation();
    }
  }

  async getPageContent() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getPageContent' }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response || { success: false, error: 'No response received' });
        }
      });
    });
  }

  async sendMessage() {
    const operationTabId = this.currentTabId;
    const message = this.chatInput.value.trim();
    const pageContentForPrompt = this.currentPageContent;
    if (!message || !pageContentForPrompt) return;
    if (this.currentOperation) {
      this.showNotification('Please wait for the current operation to complete', 'error');
      return;
    }
    this.startOperation('chat');
    this.addMessageToChat(message, 'user');
    this.chatInput.value = '';
    this.chatInput.style.height = 'auto'; // Reset height
    this.setChatInputState(false);
    const contextPrompt = `Based on the following webpage content, please answer the user's question: "${message}"\n\nWebpage Content: ${pageContentForPrompt.content}`;
    try {
      const response = await this.callGeminiAPI(contextPrompt);
      if (this.currentTabId !== operationTabId) {
        const targetTabChat = this.tabChats.get(operationTabId);
        if (targetTabChat) {
          targetTabChat.messages.push({ message: this.renderMarkdown(response), sender: 'assistant', timestamp: new Date().toISOString() });
          this.tabChats.set(operationTabId, targetTabChat);
        }
      } else {
        this.addMessageToChat(this.renderMarkdown(response), 'assistant');
        this.saveTabChat();
      }
    } catch (error) {
      const errorMessage = `Sorry, I encountered an error: ${error.message}`;
      if (this.currentTabId !== operationTabId) {
        const targetTabChat = this.tabChats.get(operationTabId);
        if (targetTabChat) {
          targetTabChat.messages.push({ message: errorMessage, sender: 'assistant', timestamp: new Date().toISOString() });
          this.tabChats.set(operationTabId, targetTabChat);
        }
      } else {
        this.addMessageToChat(errorMessage, 'assistant');
        this.saveTabChat();
      }
    } finally {
      if (this.currentTabId === operationTabId) {
        this.setChatInputState(true);
      }
      this.completeOperation();
    }
  }

  async callGeminiAPI(prompt, requestJson = false) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'callGeminiAPI', prompt, apiKey: this.apiKey, model: this.model, requestJson
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response?.error || 'Unknown error'));
        }
      });
    });
  }

  renderMarkdown(text) {
    if (typeof marked !== 'undefined') {
      return marked.parse(text, { breaks: true, gfm: true });
    }
    return text.replace(/\n/g, '<br>');
  }
  
  _renderMessage(message, sender, timestamp) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender} animate-fadeIn`;
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = message;
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timeDiv);
    this.chatMessages.appendChild(messageDiv);
  }

  addMessageToChat(message, sender) {
    const timestamp = new Date().toISOString();
    this.chatHistory.push({ message, sender, timestamp });
    this._renderMessage(message, sender, timestamp);
    this.scrollToBottom();
    this.updateHeaderButtonVisibility();
  }

  renderChatHistory() {
    this.chatMessages.innerHTML = '';
    this.chatHistory.forEach(chat => {
      this._renderMessage(chat.message, chat.sender, chat.timestamp);
    });
    this.updateHeaderButtonVisibility();
    this.scrollToBottom();
  }

  scrollToBottom() {
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  updateHeaderButtonVisibility() {
    const hasMessages = this.chatHistory.length > 0;
    const hasEmptyChat = this.chatMessages.querySelector('.empty-chat');
    if (hasMessages && !hasEmptyChat) {
      this.summarizeBtn.classList.add('show');
    } else {
      this.summarizeBtn.classList.remove('show');
    }
  }

  setChatInputState(enabled) {
    this.chatInput.disabled = !enabled;
    this.sendBtn.disabled = !enabled;
  }

  setSummarizeButtonState(enabled) {
      const summarizeBtnCenter = document.getElementById('summarizeBtnCenter');
      if (summarizeBtnCenter) {
          summarizeBtnCenter.disabled = !enabled;
      }
      this.summarizeBtn.disabled = !enabled;
  }

  showLoading() {
    this.chatInterface.classList.add('hidden');
    this.loadingState.classList.remove('hidden');
  }

  showLoadingInChat() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'chatLoading';
    loadingDiv.innerHTML = `<div class="loading-spinner" style="width: 24px; height: 24px; margin: 16px auto;"></div>`;
    this.chatMessages.appendChild(loadingDiv);
    this.scrollToBottom();
  }

  hideLoadingInChat() {
    const loadingDiv = document.getElementById('chatLoading');
    if (loadingDiv) {
      loadingDiv.remove();
    }
  }

  showInitialState() {
    this.chatInterface.classList.remove('hidden');
    this.loadingState.classList.add('hidden');
    this.setChatInputState(true);
    if (this.chatHistory.length === 0) {
      this.chatMessages.innerHTML = `
        <div class="empty-chat">
          <div class="empty-chat-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
            </svg>
          </div>
          <h3>Ready to Analyze</h3>
          <p>Get started by summarizing this page</p>
          <button id="summarizeBtnCenter" class="btn btn-primary btn-large">
            <svg class="btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm-2.25 10a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm11 2a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM12 8.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM13.75 4a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5ZM6 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm12.5-2.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5ZM19 18a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/>
            </svg>
            Summarize Page
          </button>
        </div>`;
    }
    this.updateHeaderButtonVisibility();
  }

  showChatInterface() {
    this.chatInterface.classList.remove('hidden');
    this.loadingState.classList.add('hidden');
    this.setChatInputState(true);
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type} animate-slideIn`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.classList.add('animate-slideOut');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  askQuestion(question) {
    if (!this.currentPageContent) return;
    this.chatInput.value = question;
    this.sendMessage();
  }

  getSummaryPrompt(strength) {
    const basePrompt = `Your task is to create a concise, scannable summary.
Rules:
No filler: Do not use any introductory phrases. Start directly with the "Main Idea".
Be brief: Every word counts. Use the shortest possible phrasing.
Return your response as valid JSON in the following structure:
{
  "mainIdea": "A single sentence, 20 words max",
  "summary": [
    "Critical point 1 - short paragraph of 2-3 lines",
    "Critical point 2 - short paragraph of 2-3 lines", 
    "Critical point 3 - short paragraph of 2-3 lines"
  ],
  "conclusion": "A single phrase or very short sentence, 15 words max",
  "followUpQuestions": [
    "Question 1?",
    "Question 2?"
  ]
}
Webpage Content to Analyze:
Title: {title}
Content:
{content}`;
    switch (strength) {
      case 'short':
        return basePrompt.replace(/short paragraph of 2-3 lines/g, 'brief sentence of 1-2 lines').replace(/20 words max/g, '25 words max').replace(/15 words max/g, '20 words max');
      case 'medium':
        return basePrompt.replace(/short paragraph of 2-3 lines/g, 'detailed paragraph of 4-5 lines').replace(/20 words max/g, '35 words max').replace(/15 words max/g, '30 words max');
      case 'full':
        return basePrompt.replace(/short paragraph of 2-3 lines/g, 'comprehensive paragraph of 6-8 lines').replace(/20 words max/g, '45 words max').replace(/15 words max/g, '40 words max');
      default:
        return basePrompt;
    }
  }

  renderStructuredSummary(summaryData) {
    try {
      const data = JSON.parse(summaryData);
      let html = '<div class="structured-summary">';
      if (data.mainIdea) html += `<h3 class="text-lg font-semibold mt-3 mb-2">Main Idea</h3><p class="mb-2">${data.mainIdea}</p>`;
      if (data.summary && Array.isArray(data.summary)) {
        html += `<h3 class="text-lg font-semibold mt-3 mb-2">Summary</h3><ul class="list-disc">${data.summary.map(point => `<li class="mb-1">${point}</li>`).join('')}</ul>`;
      }
      if (data.conclusion) html += `<h3 class="text-lg font-semibold mt-3 mb-2">Conclusion</h3><p class="mb-2">${data.conclusion}</p>`;
      if (data.followUpQuestions && Array.isArray(data.followUpQuestions)) {
        const buttonsHtml = data.followUpQuestions.map(q => `<button class="question-btn">${q}</button>`).join('');
        html += `<div class="follow-up-questions"><h3 class="text-lg font-semibold mt-3 mb-2">Follow-up Questions</h3><div class="question-buttons">${buttonsHtml}</div></div>`;
      }
      html += '</div>';
      return html;
    } catch (error) {
      console.error('Error parsing structured summary:', error);
      return this.renderMarkdown(summaryData);
    }
  }

  async getSummaryStrength() {
    const { summaryStrength } = await chrome.storage.sync.get('summaryStrength');
    return summaryStrength || 'medium';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.geminiSummarizer = new GeminiSummarizer();
});