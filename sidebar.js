class GeminiSummarizer {
  constructor() {
    this.apiKey = '';
    this.model = 'gemini-2.5-flash-lite';
    this.currentPageContent = null;
    this.chatHistory = [];
    this.isDarkMode = false;
    this.isNativeSidePanel = typeof chrome !== 'undefined' && chrome.tabs;
    this.currentTabId = null;
    this.tabChats = new Map();
    this.currentOperation = null;
    
    this.initializeElements();
    this.loadSettings();
    this.setupEventListeners();
    this.initializeTheme();
    
    if (this.isNativeSidePanel) {
      this.initializeTabTracking();
      this.listenForChromeMessages();
    } else {
      this.currentTabTitle.textContent = "Selection Analysis";
      this.showInitialState();
    }
    
    this.listenForWindowMessages();
  }

  initializeElements() {
    this.settingsBtn = document.getElementById('settingsBtn');
    this.themeToggle = document.getElementById('themeToggle');
    this.settingsPanel = document.getElementById('settingsPanel');
    this.apiKeyInput = document.getElementById('apiKey');
    this.modelSelect = document.getElementById('model');
    this.summaryStrengthSelect = document.getElementById('summaryStrength');
    this.saveSettingsBtn = document.getElementById('saveSettings');
    this.cancelSettingsBtn = document.getElementById('cancelSettings');
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

  listenForWindowMessages() {
      window.addEventListener('message', (event) => {
          const request = event.data;
          if (request.action === 'performSelectionAction') {
              this.handleSelectionAction(request.task, request.selectedText);
          }
      });
  }

  listenForChromeMessages() {
      if (!this.isNativeSidePanel) return;
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
          if (request.action === 'updateTabStatus' && request.tabId === this.currentTabId) {
              this.setSummarizeButtonState(request.status === 'complete');
          }
      });
  }
  
  async handleSelectionAction(task, selectedText) {
    if (!this.apiKey) {
      this.showNotification('Please configure your API key in settings', 'error');
      this.toggleSettings();
      return;
    }

    let prompt = '';
    const taskLabel = task.replace('_selection', '').replace(/_/g, ' ');
    const userMessage = `<div class="markdown-content"><strong>${taskLabel.charAt(0).toUpperCase() + taskLabel.slice(1)}:</strong><blockquote>${selectedText}</blockquote></div>`;
    
    this.chatMessages.innerHTML = '';
    this.addMessageToChat(userMessage, 'user');
    this.showLoadingInChat();
    this.showChatInterface();
    
    switch (task) {
      case 'summarize_selection': prompt = `Please summarize the following text:\n\n"${selectedText}"`; break;
      case 'explain_selection': prompt = `Please explain the following text in a simple way:\n\n"${selectedText}"`; break;
      case 'translate_selection': prompt = `Please translate the following text to English:\n\n"${selectedText}"`; break;
    }
    
    try {
        const response = await this.callGeminiAPI(prompt, false);
        this.hideLoadingInChat();
        this.addMessageToChat(this.renderMarkdown(response), 'assistant');
    } catch (error) {
        this.hideLoadingInChat();
        this.addMessageToChat(`Sorry, I encountered an error: ${error.message}`, 'assistant');
    }
  }

  async loadSettings() {
    const result = await chrome.storage.sync.get(['apiKey', 'model', 'summaryStrength', 'theme']);
    this.apiKey = result.apiKey || '';
    this.model = result.model || 'gemini-2.5-flash-lite';
    this.isDarkMode = result.theme === 'dark';
    this.apiKeyInput.value = this.apiKey;
    this.modelSelect.value = this.model;
    this.summaryStrengthSelect.value = result.summaryStrength || 'short';
    this.updateTheme();
  }

  async saveSettings() {
    await chrome.storage.sync.set({
      apiKey: this.apiKeyInput.value.trim(),
      model: this.modelSelect.value,
      summaryStrength: this.summaryStrengthSelect.value,
      theme: this.isDarkMode ? 'dark' : 'light'
    });
    this.showNotification('Settings saved successfully!', 'success');
  }

  setupEventListeners() {
    this.settingsBtn.addEventListener('click', () => this.toggleSettings());
    this.saveSettingsBtn.addEventListener('click', () => this.handleSaveSettings());
    this.cancelSettingsBtn.addEventListener('click', () => this.toggleSettings());
    this.themeToggle.addEventListener('click', () => this.toggleTheme());
    this.summarizeBtn.addEventListener('click', () => this.summarizePage());
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
    });
    this.chatMessages.addEventListener('click', (e) => {
      if (e.target.classList.contains('question-btn')) this.askQuestion(e.target.textContent.trim());
      else if (e.target.id === 'summarizeBtnCenter' || e.target.closest('#summarizeBtnCenter')) this.summarizePage();
    });
    this.chatInput.addEventListener('input', () => {
      this.chatInput.style.height = 'auto';
      this.chatInput.style.height = (this.chatInput.scrollHeight) + 'px';
    });
  }

  initializeTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) this.isDarkMode = true;
    this.updateTheme();
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    this.updateTheme();
    this.saveSettings();
  }

  updateTheme() {
    const body = document.body, sunIcon = document.getElementById('sunIcon'), moonIcon = document.getElementById('moonIcon');
    if (this.isDarkMode) {
      body.setAttribute('data-theme', 'dark');
      sunIcon.style.display = 'none'; moonIcon.style.display = 'block';
    } else {
      body.setAttribute('data-theme', 'light');
      sunIcon.style.display = 'block'; moonIcon.style.display = 'none';
    }
  }

  toggleSettings() { this.settingsPanel.classList.toggle('hidden'); }

  async handleSaveSettings() {
    await this.saveSettings();
    this.apiKey = this.apiKeyInput.value.trim();
    this.model = this.modelSelect.value;
    this.toggleSettings();
  }

  async initializeTabTracking() {
    if (!this.isNativeSidePanel) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      this.currentTabId = tab.id;
      this.updateTabDetails(tab);
      this.setSummarizeButtonState(tab.status === 'complete');
      this.loadTabChat();
    }
  }
  
  updateTabDetails(tab) {
      const title = tab.title || tab.url;
      this.currentTabTitle.textContent = title.length > 40 ? title.substring(0, 40) + '...' : title;
      this.currentTabTitle.title = title;
      if (tab.favIconUrl && tab.favIconUrl.startsWith('http')) {
          this.tabFavicon.src = tab.favIconUrl; this.tabFavicon.style.display = 'block'; this.defaultFavicon.style.display = 'none';
      } else {
          this.tabFavicon.style.display = 'none'; this.defaultFavicon.style.display = 'block';
      }
  }
  
  loadTabChat() {
    this.chatMessages.innerHTML = '';
    if (this.currentTabId && this.tabChats.has(this.currentTabId)) {
      const tabChat = this.tabChats.get(this.currentTabId);
      this.chatHistory = tabChat.messages || [];
      this.currentPageContent = tabChat.pageContent || null;
      if (this.chatHistory.length > 0) {
        this.showChatInterface(); this.renderChatHistory();
      } else { this.showInitialState(); }
    } else {
      this.chatHistory = []; this.currentPageContent = null; this.showInitialState();
    }
  }

  saveTabChat() {
    if (this.currentTabId) this.tabChats.set(this.currentTabId, { messages: this.chatHistory, pageContent: this.currentPageContent });
  }

  async summarizePage() {
    if (!this.isNativeSidePanel || this.currentOperation) return;
    if (!this.apiKey) { this.showNotification('Please configure your API key in settings', 'error'); this.toggleSettings(); return; }
    
    this.currentOperation = 'summarize';
    this.setSummarizeButtonState(false); // Disable button
    this.showLoading();

    try {
      const response = await this.getPageContent();
      if (!response || !response.success) throw new Error(response?.error || 'Failed to extract page content');
      const pageContent = response.content;
      const summaryStrength = await this.getSummaryStrength();
      const summaryPrompt = getSummaryPrompt(summaryStrength, pageContent.title, pageContent.content);
      const summary = await this.callGeminiAPI(summaryPrompt, true);
      this.currentPageContent = pageContent; this.chatHistory = []; this.chatMessages.innerHTML = '';
      this.addMessageToChat(this.renderApiResponse(summary), 'assistant');
      this.saveTabChat();
      this.showChatInterface();
    } catch (error) {
      this.showNotification(`Error: ${error.message}`, 'error'); this.showInitialState();
    } finally {
      this.currentOperation = null;
      this.setSummarizeButtonState(true); // FIX: Re-enable button
    }
  }

  async getPageContent() { return new Promise(resolve => chrome.runtime.sendMessage({ action: 'getPageContent' }, r => resolve(r || { success: false, error: 'No response' }))); }

  async sendMessage() {
    const message = this.chatInput.value.trim();
    if (!message || !this.currentPageContent || this.currentOperation) return;
    
    this.currentOperation = 'chat';
    this.setSummarizeButtonState(false); // Disable button
    this.addMessageToChat(message, 'user');
    this.chatInput.value = ''; this.chatInput.style.height = 'auto'; this.setChatInputState(false);
    
    const contextPrompt = `Based on the webpage content, answer: "${message}"\n\nContent: ${this.currentPageContent.content}`;
    try {
      const response = await this.callGeminiAPI(contextPrompt);
      this.addMessageToChat(this.renderMarkdown(response), 'assistant');
    } catch (error) {
      this.addMessageToChat(`Sorry, error: ${error.message}`, 'assistant');
    } finally {
      this.setChatInputState(true);
      this.currentOperation = null;
      this.saveTabChat();
      this.setSummarizeButtonState(true); // FIX: Re-enable button
    }
  }

  async callGeminiAPI(prompt, requestJson = false) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'callGeminiAPI', prompt, apiKey: this.apiKey, model: this.model, requestJson },
        (response) => {
          if (response && response.success) resolve(response.data);
          else reject(new Error(response?.error || 'Unknown API error'));
        });
    });
  }
  
  renderMarkdown(text) { return (typeof marked !== 'undefined') ? marked.parse(text, { breaks: true, gfm: true }) : text.replace(/\n/g, '<br>'); }
  
  _renderMessage(message, sender, timestamp) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender} animate-fadeIn`;
    messageDiv.innerHTML = `<div class="message-content">${message}</div><div class="message-time">${new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
    this.chatMessages.appendChild(messageDiv);
  }

  addMessageToChat(message, sender) {
    const timestamp = new Date().toISOString();
    this.chatHistory.push({ message, sender, timestamp });
    this._renderMessage(message, sender, timestamp);
    this.scrollToBottom();
    if (this.isNativeSidePanel) this.updateHeaderButtonVisibility();
  }

  renderChatHistory() {
    this.chatMessages.innerHTML = '';
    this.chatHistory.forEach(chat => this._renderMessage(chat.message, chat.sender, chat.timestamp));
    if (this.isNativeSidePanel) this.updateHeaderButtonVisibility();
    this.scrollToBottom();
  }

  scrollToBottom() { this.chatMessages.scrollTop = this.chatMessages.scrollHeight; }

  updateHeaderButtonVisibility() {
    if (!this.isNativeSidePanel) { this.summarizeBtn.style.display = 'none'; return; }
    this.summarizeBtn.style.display = this.chatHistory.length > 0 ? 'inline-flex' : 'none';
  }

  setChatInputState(enabled) {
    this.chatInput.disabled = !enabled; this.sendBtn.disabled = !enabled;
  }

  setSummarizeButtonState(enabled) {
      if (!this.isNativeSidePanel) return;
      const btn = document.getElementById('summarizeBtnCenter');
      if (btn) btn.disabled = !enabled;
      this.summarizeBtn.disabled = !enabled;
  }

  showLoading() { this.chatInterface.classList.add('hidden'); this.loadingState.classList.remove('hidden'); }
  hideLoadingInChat() { const el = document.getElementById('chatLoading'); if (el) el.remove(); }
  showLoadingInChat() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'chatLoading';
    loadingDiv.innerHTML = `<div class="loading-spinner" style="width: 24px; height: 24px; margin: 16px auto;"></div>`;
    this.chatMessages.appendChild(loadingDiv);
    this.scrollToBottom();
  }

  showInitialState() {
    this.chatInterface.classList.remove('hidden'); this.loadingState.classList.add('hidden');
    this.setChatInputState(this.isNativeSidePanel);
    if (this.chatHistory.length === 0) {
      this.chatMessages.innerHTML = this.isNativeSidePanel ? `
        <div class="empty-chat">
          <div class="empty-chat-icon"><svg width="48" height="48" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg></div>
          <h3>Ready to Analyze</h3><p>Get started by summarizing this page</p>
          <button id="summarizeBtnCenter" class="btn btn-primary btn-large">Summarize Page</button>
        </div>` : `
        <div class="empty-chat">
          <h3>Selection Analysis</h3><p>Use the selection tools on any webpage to get started.</p>
        </div>`;
    }
    if (this.isNativeSidePanel) this.updateHeaderButtonVisibility();
  }

  showChatInterface() {
    this.chatInterface.classList.remove('hidden'); this.loadingState.classList.add('hidden'); this.setChatInputState(true);
  }

  showNotification(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `notification ${type} animate-fadeIn`; el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
  }

  askQuestion(question) {
    if (!this.currentPageContent) return;
    this.chatInput.value = question;
    this.sendMessage();
  }

  renderApiResponse(apiResponse) {
    try {
      let cleanResponse = apiResponse.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.substring(7, cleanResponse.length - 3).trim();
      } else if (cleanResponse.startsWith('```')) {
         cleanResponse = cleanResponse.substring(3, cleanResponse.length - 3).trim();
      }
      const data = JSON.parse(cleanResponse);
      let html = '<div class="structured-summary">';
      if (data.summary) html += this.renderMarkdown(data.summary);
      if (data.followUpQuestions && Array.isArray(data.followUpQuestions)) {
        const buttonsHtml = data.followUpQuestions.map(q => `<button class="question-btn">${q}</button>`).join('');
        html += `<div class="follow-up-questions"><h3>Follow-up Questions</h3><div class="question-buttons">${buttonsHtml}</div></div>`;
      }
      html += '</div>';
      return html;
    } catch (error) {
      console.error('Error parsing API JSON response:', error, 'Original response:', apiResponse);
      return this.renderMarkdown(apiResponse);
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