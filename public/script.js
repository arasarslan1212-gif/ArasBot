/* =====================================================
   ARAS AI PLATFORM - COMPLETE JAVASCRIPT
   Handles all interactions, animations, and API calls
   ===================================================== */


/* =====================================================
   1. DOM ELEMENTS
   ===================================================== */

// Sidebar elements
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const newChatBtn = document.getElementById('newChatBtn');
const chatHistory = document.getElementById('chatHistory');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// Main content elements
const welcomeScreen = document.getElementById('welcomeScreen');
const messagesContainer = document.getElementById('messagesContainer');
const conversationContainer = document.getElementById('conversationContainer');

// Input elements
const inputForm = document.getElementById('inputForm');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const voiceBtn = document.getElementById('voiceBtn');

// Settings modal
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const voiceOutputToggle = document.getElementById('voiceOutputToggle');
const themeSelect = document.getElementById('themeSelect');

// Suggestion cards
const suggestionCards = document.querySelectorAll('.suggestion-card');


/* =====================================================
   2. APPLICATION STATE
   ===================================================== */

let currentConversation = [];
let conversationHistory = [];
let isProcessing = false;
let voiceEnabled = false;
let recognition = null;
let currentSpeech = null;


/* =====================================================
   3. CONFIGURATION
   ===================================================== */

const CONFIG = {
  maxHistoryItems: 20,
  maxMessageLength: 4000,
  autoSaveDelay: 500,
  typingSpeed: 30,
};

// API endpoint (empty string = same domain for Vercel)
const API_URL = '';


/* =====================================================
   4. INITIALIZATION
   ===================================================== */

function init() {
  loadSettings();
  loadConversationHistory();
  setupEventListeners();
  setupVoiceRecognition();
  setupTextareaAutoResize();
  renderChatHistory();
  
  console.log('Aras AI Platform initialized ✓');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


/* =====================================================
   5. EVENT LISTENERS
   ===================================================== */

function setupEventListeners() {
  
  // Mobile menu toggle
  if (menuToggle) {
    menuToggle.addEventListener('click', toggleSidebar);
  }

  // New chat button
  if (newChatBtn) {
    newChatBtn.addEventListener('click', startNewChat);
  }

  // Clear history button
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', clearAllHistory);
  }

  // Settings modal
  if (settingsBtn) {
    settingsBtn.addEventListener('click', openSettings);
  }

  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', closeSettings);
  }

  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeSettings();
    });
  }

  // Voice settings
  if (voiceOutputToggle) {
    voiceOutputToggle.addEventListener('change', toggleVoiceOutput);
  }

  // Theme selector
  if (themeSelect) {
    themeSelect.addEventListener('change', changeTheme);
  }

  // Input form
  if (inputForm) {
    inputForm.addEventListener('submit', handleSubmit);
  }

  // Voice input button
  if (voiceBtn) {
    voiceBtn.addEventListener('click', toggleVoiceInput);
  }

  // Message input
  if (messageInput) {
    messageInput.addEventListener('input', handleInputChange);
    messageInput.addEventListener('keydown', handleKeyDown);
  }

  // Suggestion cards
  suggestionCards.forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.dataset.prompt;
      if (prompt) {
        messageInput.value = prompt;
        handleInputChange();
        messageInput.focus();
      }
    });
  });

  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.remove('active');
      }
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + K = New chat
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      startNewChat();
    }

    // Escape = Close modal
    if (e.key === 'Escape') {
      closeSettings();
    }
  });
}


/* =====================================================
   6. SIDEBAR FUNCTIONS
   ===================================================== */

function toggleSidebar() {
  sidebar.classList.toggle('active');
}

function startNewChat() {
  currentConversation = [];
  messagesContainer.innerHTML = '';
  welcomeScreen.classList.remove('hidden');
  messagesContainer.classList.add('hidden');
  messageInput.value = '';
  messageInput.focus();
  handleInputChange();
  
  if (window.innerWidth <= 768) {
    sidebar.classList.remove('active');
  }
}

function renderChatHistory() {
  if (!chatHistory) return;

  if (conversationHistory.length === 0) {
    chatHistory.innerHTML = `
      <div class="chat-history-empty">
        Your conversation history will appear here
      </div>
    `;
    return;
  }

  chatHistory.innerHTML = conversationHistory
    .slice(0, CONFIG.maxHistoryItems)
    .map((conv, index) => {
      const preview = conv.messages[0]?.text || 'New conversation';
      const truncated = preview.length > 50 
        ? preview.substring(0, 50) + '...' 
        : preview;
      
      return `
        <button 
          class="chat-history-item" 
          data-index="${index}"
          title="${escapeHtml(preview)}"
        >
          ${escapeHtml(truncated)}
        </button>
      `;
    })
    .join('');

  // Add click handlers
  chatHistory.querySelectorAll('.chat-history-item').forEach(item => {
    item.addEventListener('click', () => {
      loadConversation(parseInt(item.dataset.index));
    });
  });
}

function loadConversation(index) {
  const conv = conversationHistory[index];
  if (!conv) return;

  currentConversation = [...conv.messages];
  messagesContainer.innerHTML = '';
  welcomeScreen.classList.add('hidden');
  messagesContainer.classList.remove('hidden');

  conv.messages.forEach(msg => {
    appendMessage(msg.role, msg.text, false);
  });

  scrollToBottom();
  
  if (window.innerWidth <= 768) {
    sidebar.classList.remove('active');
  }
}

function clearAllHistory() {
  if (!confirm('Are you sure you want to clear all conversation history?')) {
    return;
  }

  conversationHistory = [];
  saveConversationHistory();
  renderChatHistory();
  startNewChat();
}


/* =====================================================
   7. MESSAGE HANDLING
   ===================================================== */

async function handleSubmit(e) {
  e.preventDefault();
  
  const text = messageInput.value.trim();
  
  if (!text || isProcessing) return;
  
  if (text.length > CONFIG.maxMessageLength) {
    showError('Message is too long. Please keep it under 4000 characters.');
    return;
  }

  // Clear input immediately
  messageInput.value = '';
  handleInputChange();
  autoResizeTextarea();

  // Hide welcome screen on first message
  if (currentConversation.length === 0) {
    welcomeScreen.classList.add('hidden');
    messagesContainer.classList.remove('hidden');
  }

  // Add user message
  appendMessage('user', text);
  currentConversation.push({ role: 'user', text });

  // Show typing indicator
  const typingId = showTypingIndicator();

  // Process message
  isProcessing = true;
  updateSendButton();

  try {
    const response = await sendToAPI(text);
    
    // Remove typing indicator
    removeTypingIndicator(typingId);

    // Add assistant response
    appendMessage('assistant', response);
    currentConversation.push({ role: 'assistant', text: response });

    // Save to history
    saveToHistory();

    // Speak response if enabled
    if (voiceEnabled) {
      speak(response);
    }

  } catch (error) {
    console.error('Error:', error);
    removeTypingIndicator(typingId);
    showError('Sorry, something went wrong. Please try again.');
  } finally {
    isProcessing = false;
    updateSendButton();
    messageInput.focus();
  }
}

function appendMessage(role, text, animate = true) {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${role}`;
  
  if (animate) {
    messageEl.style.opacity = '0';
  }

  const avatar = role === 'user' ? 'You' : 'A';
  const roleLabel = role === 'user' ? 'You' : 'Aras AI';

  messageEl.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content">
      <div class="message-role">${roleLabel}</div>
      <div class="message-text">${formatMessage(text)}</div>
    </div>
  `;

  messagesContainer.appendChild(messageEl);

  if (animate) {
    // Trigger animation
    setTimeout(() => {
      messageEl.style.opacity = '1';
    }, 10);
  }

  scrollToBottom();
  return messageEl;
}

function showTypingIndicator() {
  const id = 'typing-' + Date.now();
  const typingEl = document.createElement('div');
  typingEl.className = 'message assistant';
  typingEl.id = id;
  
  typingEl.innerHTML = `
    <div class="message-avatar">A</div>
    <div class="message-content">
      <div class="message-role">Aras AI</div>
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;

  messagesContainer.appendChild(typingEl);
  scrollToBottom();
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function showError(message) {
  const errorEl = document.createElement('div');
  errorEl.className = 'message assistant';
  
  errorEl.innerHTML = `
    <div class="message-avatar">A</div>
    <div class="message-content">
      <div class="message-role">Aras AI</div>
      <div class="message-error">${escapeHtml(message)}</div>
    </div>
  `;

  messagesContainer.appendChild(errorEl);
  scrollToBottom();
}

function formatMessage(text) {
  // Escape HTML
  let formatted = escapeHtml(text);
  
  // Convert markdown-style bold
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Convert line breaks
  formatted = formatted.replace(/\n/g, '<br>');
  
  return formatted;
}

function scrollToBottom() {
  const wrapper = document.querySelector('.conversation-wrapper');
  if (wrapper) {
    setTimeout(() => {
      wrapper.scrollTop = wrapper.scrollHeight;
    }, 100);
  }
}


/* =====================================================
   8. API COMMUNICATION
   ===================================================== */

async function sendToAPI(query) {
  try {
    const response = await fetch(`${API_URL}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Unknown error occurred');
    }

    return data.answer || 'I received your message but have no response.';

  } catch (error) {
    console.error('API Error:', error);
    throw new Error('Unable to connect to the AI service. Please try again.');
  }
}


/* =====================================================
   9. INPUT HANDLING
   ===================================================== */

function handleInputChange() {
  const text = messageInput.value.trim();
  sendBtn.disabled = !text || isProcessing;
  autoResizeTextarea();
}

function handleKeyDown(e) {
  // Submit on Enter (without Shift)
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) {
      handleSubmit(e);
    }
  }
}

function updateSendButton() {
  sendBtn.disabled = isProcessing || !messageInput.value.trim();
}

function setupTextareaAutoResize() {
  if (!messageInput) return;

  messageInput.addEventListener('input', autoResizeTextarea);
  autoResizeTextarea();
}

function autoResizeTextarea() {
  if (!messageInput) return;

  messageInput.style.height = 'auto';
  const newHeight = Math.min(messageInput.scrollHeight, 200);
  messageInput.style.height = newHeight + 'px';
}


/* =====================================================
   10. VOICE RECOGNITION
   ===================================================== */

function setupVoiceRecognition() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    if (voiceBtn) voiceBtn.style.display = 'none';
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    voiceBtn.classList.add('listening');
  };

  recognition.onend = () => {
    voiceBtn.classList.remove('listening');
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    messageInput.value = transcript;
    handleInputChange();
    messageInput.focus();
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    voiceBtn.classList.remove('listening');
  };
}

function toggleVoiceInput() {
  if (!recognition) return;

  if (voiceBtn.classList.contains('listening')) {
    recognition.stop();
  } else {
    recognition.start();
  }
}


/* =====================================================
   11. VOICE OUTPUT (TEXT-TO-SPEECH)
   ===================================================== */

function speak(text) {
  if (!voiceEnabled || !('speechSynthesis' in window)) return;

  // Stop any ongoing speech
  stopSpeaking();

  // Clean text for speaking
  const cleanText = text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\*\*/g, '')     // Remove markdown bold
    .substring(0, 500);       // Limit length

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'en-US';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  currentSpeech = utterance;
  window.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  currentSpeech = null;
}

function toggleVoiceOutput() {
  voiceEnabled = voiceOutputToggle.checked;
  saveSettings();

  if (!voiceEnabled) {
    stopSpeaking();
  }
}


/* =====================================================
   12. SETTINGS
   ===================================================== */

function loadSettings() {
  try {
    const saved = localStorage.getItem('arasAISettings');
    if (saved) {
      const settings = JSON.parse(saved);
      
      voiceEnabled = settings.voiceEnabled || false;
      
      if (voiceOutputToggle) {
        voiceOutputToggle.checked = voiceEnabled;
      }

      if (themeSelect && settings.theme) {
        themeSelect.value = settings.theme;
        applyTheme(settings.theme);
      }
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

function saveSettings() {
  try {
    const settings = {
      voiceEnabled,
      theme: themeSelect?.value || 'light'
    };
    localStorage.setItem('arasAISettings', JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

function openSettings() {
  if (settingsModal) {
    settingsModal.classList.add('active');
  }
}

function closeSettings() {
  if (settingsModal) {
    settingsModal.classList.remove('active');
  }
}

function changeTheme() {
  const theme = themeSelect.value;
  applyTheme(theme);
  saveSettings();
}

function applyTheme(theme) {
  // Theme switching logic - placeholder for future dark mode
  document.documentElement.setAttribute('data-theme', theme);
}


/* =====================================================
   13. CONVERSATION HISTORY (LOCAL STORAGE)
   ===================================================== */

function loadConversationHistory() {
  try {
    const saved = localStorage.getItem('arasAIHistory');
    if (saved) {
      conversationHistory = JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading history:', error);
    conversationHistory = [];
  }
}

function saveConversationHistory() {
  try {
    localStorage.setItem('arasAIHistory', JSON.stringify(conversationHistory));
  } catch (error) {
    console.error('Error saving history:', error);
  }
}

function saveToHistory() {
  if (currentConversation.length === 0) return;

  // Create conversation object
  const conversation = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    messages: [...currentConversation]
  };

  // Add to beginning of history
  conversationHistory.unshift(conversation);

  // Limit history size
  if (conversationHistory.length > CONFIG.maxHistoryItems) {
    conversationHistory = conversationHistory.slice(0, CONFIG.maxHistoryItems);
  }

  // Save to localStorage
  saveConversationHistory();

  // Re-render history
  renderChatHistory();
}


/* =====================================================
   14. UTILITY FUNCTIONS
   ===================================================== */

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}


/* =====================================================
   15. ERROR HANDLING & DEBUGGING
   ===================================================== */

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});


/* =====================================================
   16. PERFORMANCE OPTIMIZATIONS
   ===================================================== */

// Debounced auto-save
const debouncedSave = debounce(saveToHistory, CONFIG.autoSaveDelay);

// Intersection Observer for lazy loading (future enhancement)
const observerOptions = {
  root: null,
  rootMargin: '50px',
  threshold: 0.1
};

// Export for debugging (development only)
window.ArasAI = {
  currentConversation,
  conversationHistory
};
