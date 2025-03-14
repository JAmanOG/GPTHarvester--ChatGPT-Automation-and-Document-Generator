// renderer.js
const { ipcRenderer } = require('electron');

// UI Element References
const questionInput = document.getElementById('questions-input');
const runBtn = document.getElementById('run-btn');
const loadQuestionsBtn = document.getElementById('load-questions-btn');
const saveQuestionsBtn = document.getElementById('save-questions-btn');
const statusText = document.getElementById('status-text');
const progressBar = document.getElementById('progress-bar-fill');
const progressPercentage = document.getElementById('progress-percentage');
const resultsContainer = document.getElementById('results-container');
const openWordBtn = document.getElementById('open-word-btn');
const openFolderBtn = document.getElementById('open-folder-btn');
const copyJsonBtn = document.getElementById('copy-json-btn');
const selectChromeBtn = document.getElementById('select-chrome-btn');
const chromePathInput = document.getElementById('chrome-path');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

let currentResults = [];

// Tab Navigation
tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const tabId = button.dataset.tab;
    
    // Update active tab button
    tabButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    // Show active tab content
    tabContents.forEach(content => content.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
  });
});

// Chrome Path Selection
selectChromeBtn.addEventListener('click', async () => {
  const chromePath = await ipcRenderer.invoke('select-chrome-path');
  if (chromePath) {
    chromePathInput.value = chromePath;
    localStorage.setItem('chromePath', chromePath);
  }
});

// Load saved chrome path
if (localStorage.getItem('chromePath')) {
  chromePathInput.value = localStorage.getItem('chromePath');
}

// Run automation
runBtn.addEventListener('click', async () => {
  const questions = questionInput.value.trim().split('\n')
    .filter(q => q.trim().length > 0);
  
  if (questions.length === 0) {
    alert('Please enter at least one question');
    return;
  }
  
  runBtn.disabled = true;
  statusText.textContent = 'Starting...';
  progressBar.style.width = '0%';
  progressPercentage.textContent = '0%';
  
  try {
    const result = await ipcRenderer.invoke('run-chatgpt-automation', questions, {
      chromePath: chromePathInput.value
    });
    
    if (result.success) {
      currentResults = result.results;
      displayResults(result.results);
      
      // Switch to results tab
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      document.querySelector('[data-tab="results-tab"]').classList.add('active');
      document.getElementById('results-tab').classList.add('active');
    } else {
      statusText.textContent = `Error: ${result.error}`;
    }
  } catch (error) {
    statusText.textContent = `Error: ${error.message}`;
  } finally {
    runBtn.disabled = false;
  }
});

ipcRenderer.on('automation-progress', (event, progress) => {
  statusText.textContent = progress.message;
  if (progress.progress !== undefined) {
    progressBar.style.width = `${progress.progress}%`;
    progressPercentage.textContent = `${progress.progress}%`;
  }
});

saveQuestionsBtn.addEventListener('click', async () => {
    const questions = questionInput.value.trim();
    if (!questions) {
      alert('Please enter questions to save');
      return;
    }
    
    const customPrompt = document.getElementById('custom-prompt');
    const setNameInput = document.getElementById('set-name-input');
    customPrompt.style.display = 'flex';
    setNameInput.focus();
    
    const saveQuestion = async (setName) => {
      if (!setName) return;
      
      const questionSets = JSON.parse(localStorage.getItem('questionSets') || '[]');
      questionSets.push({
        name: setName,
        questions: questions.split('\n').filter(q => q.trim())
      });
      
      localStorage.setItem('questionSets', JSON.stringify(questionSets));
      loadQuestionSets();
      
      statusText.textContent = "Saving questions...";
      
      const result = await ipcRenderer.invoke('save-questions', questionSets);
      if (result) {
        alert('Questions saved successfully!');
        statusText.textContent = "Questions saved successfully!";
      } else {
        alert('Failed to save questions to disk');
        statusText.textContent = "Failed to save questions";
      }
    };
    
    document.getElementById('confirm-save-btn').onclick = () => {
      customPrompt.style.display = 'none';
      saveQuestion(setNameInput.value);
    };
    
    document.getElementById('cancel-save-btn').onclick = () => {
      customPrompt.style.display = 'none';
    };
  });
    
function loadQuestionSets() {
  const questionSetSelect = document.getElementById('question-sets');
  questionSetSelect.innerHTML = '';
  
  const questionSets = JSON.parse(localStorage.getItem('questionSets') || '[]');
  
  questionSets.forEach((set, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = `${set.name} (${set.questions.length} questions)`;
    questionSetSelect.appendChild(option);
  });
}

document.getElementById('load-set-btn').addEventListener('click', () => {
  const questionSetSelect = document.getElementById('question-sets');
  const selectedIndex = questionSetSelect.value;
  
  if (selectedIndex !== null && selectedIndex !== '') {
    const questionSets = JSON.parse(localStorage.getItem('questionSets') || '[]');
    if (questionSets[selectedIndex]) {
      questionInput.value = questionSets[selectedIndex].questions.join('\n');
    }
  } else {
    alert('Please select a question set first');
  }
});

document.getElementById('delete-set-btn').addEventListener('click', async () => {
  const questionSetSelect = document.getElementById('question-sets');
  const selectedIndex = questionSetSelect.value;
  
  if (selectedIndex !== null && selectedIndex !== '') {
    if (confirm('Are you sure you want to delete this question set?')) {
      const questionSets = JSON.parse(localStorage.getItem('questionSets') || '[]');
      questionSets.splice(selectedIndex, 1);
      localStorage.setItem('questionSets', JSON.stringify(questionSets));
      loadQuestionSets();
      
      await ipcRenderer.invoke('save-questions', questionSets);
    }
  } else {
    alert('Please select a question set first');
  }
});

loadQuestionsBtn.addEventListener('click', async () => {
  const questionSets = await ipcRenderer.invoke('load-saved-questions');
  if (questionSets && questionSets.length > 0) {
    localStorage.setItem('questionSets', JSON.stringify(questionSets));
    loadQuestionSets();
    alert('Question sets loaded successfully');
  } else {
    alert('No saved question sets found');
  }
});

openFolderBtn.addEventListener('click', () => {
  ipcRenderer.invoke('open-results-folder');
});

openWordBtn.addEventListener('click', () => {
  ipcRenderer.invoke('open-results-folder');
});

copyJsonBtn.addEventListener('click', () => {
  if (currentResults.length > 0) {
    navigator.clipboard.writeText(JSON.stringify(currentResults, null, 2));
    alert('Results copied to clipboard as JSON');
  } else {
    alert('No results available to copy');
  }
});

function displayResults(results) {
  resultsContainer.innerHTML = '';
  
  results.forEach((result, index) => {
    const resultCard = document.createElement('div');
    resultCard.className = 'result-card';
    
    const questionEl = document.createElement('div');
    questionEl.className = 'result-question';
    questionEl.textContent = `Question ${index + 1}: ${result.question}`;
    
    const responseEl = document.createElement('div');
    responseEl.className = 'result-response';
    responseEl.textContent = result.response;
    
    resultCard.appendChild(questionEl);
    resultCard.appendChild(responseEl);
    resultsContainer.appendChild(resultCard);
  });
}

document.getElementById('setup-profile-btn').addEventListener('click', async () => {
    try {
      const setupBtn = document.getElementById('setup-profile-btn');
      setupBtn.disabled = true;
      setupBtn.textContent = 'Setting up profile...';
      
      const chromePath = document.getElementById('chrome-path').value;
      
      await ipcRenderer.invoke('setup-chrome-profile', chromePath);
      
      setupBtn.disabled = false;
      setupBtn.textContent = 'Setup Chrome Profile';
      
      alert('Chrome profile has been set up successfully. Please log in to ChatGPT when the browser window opens.');
    } catch (error) {
      alert('Failed to set up Chrome profile: ' + error.message);
    }
});


loadQuestionSets();