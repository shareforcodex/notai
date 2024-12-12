const API_BASE_URL = "https://notai.suisuy.workers.dev";
let currentUser = {
  userId: localStorage.getItem("userId"),
  credentials: localStorage.getItem("credentials"),
};

class NotionEditor {
  constructor() {
    // Initialize core editor elements with error checking
    const editor = document.getElementById("editor");

    // Initialize last pointer position
    this.lastPointerPosition = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    // Listen for pointer down events to update the last position
    document.addEventListener('pointerdown', (e) => {
        this.lastPointerPosition = { x: e.clientX, y: e.clientY };
    });
    const sourceView = document.getElementById("sourceView");
    const toolbar = document.querySelector(".toolbar");
    const aiToolbar = document.getElementById("aiToolbar");
    
    // Verify required elements exist
    if (!editor || !sourceView || !toolbar || !aiToolbar) {
      console.error("Required editor elements not found");
      return;
    }

    showSpinner() {
        const spinner = document.getElementById('loadingSpinner');
        if (!spinner) return;

        // Position the spinner at the last pointer-down location
        let x = this.lastPointerPosition.x;
        let y = this.lastPointerPosition.y;
        const spinnerSize = 40; // Assuming spinner width and height are 40px

        // Adjust position to keep spinner within viewport
        if (x + spinnerSize > window.innerWidth) {
            x = window.innerWidth - spinnerSize - 10; // 10px padding
        }
        if (y + spinnerSize > window.innerHeight) {
            y = window.innerHeight - spinnerSize - 10; // 10px padding
        }

        spinner.style.left = `${x}px`;
        spinner.style.top = `${y}px`;
        spinner.style.display = 'block';

        // Automatically hide the spinner after 5 seconds
        this.spinnerTimeout = setTimeout(() => {
            this.hideSpinner();
        }, 5000);
    }

    hideSpinner() {
        const spinner = document.getElementById('loadingSpinner');
        if (!spinner) return;

        spinner.style.display = 'none';

        // Clear the timeout if the spinner is hidden manually
        if (this.spinnerTimeout) {
            clearTimeout(this.spinnerTimeout);
            this.spinnerTimeout = null;
        }
    }

    // Assign verified elements
    this.editor = editor;
    this.sourceView = sourceView; 
    this.toolbar = toolbar;
    this.aiToolbar = aiToolbar;
    this.currentNoteTitle = "";
    this.lastSavedContent = "";
    this.aiSettings = {
      prompts: {
        ask: "Answer this question: {text}",
        correct: "Correct any grammar or spelling errors in this text: {text}",
        translate: "Translate this text to English: {text}"
      },
      customTools: []
    };
    this.loadUserConfig();
    this.setupEventListeners();
    this.setupAIToolbar();
    this.setupAISettings();
    this.setupTableOfContents();
    this.setupCommentSystem();
    this.updateAIToolbar(); // Load custom AI buttons

    // Add title auto-save
    const titleElement = document.getElementById("noteTitle");
    titleElement.addEventListener("input", () => this.scheduleAutoSave());
    this.currentBlock = null;
    this.content = ""; // Store markdown content
    this.isSourceView = false;
    this.isEditable = false;
    this.autoSaveTimeout = null;

    // Ensure white-space is preserved
    this.editor.style.whiteSpace = 'pre-wrap';
    this.sourceView.style.whiteSpace = 'pre-wrap';

    // Initialize content and check auth
    this.updateContent();

    this.checkAuthAndLoadNotes();
    this.loadFolders();
  }

  async apiRequest(method, endpoint, body = null, isAIRequest = false) {
        // Show the spinner before making the request
        this.showSpinner();

        const headers = {
            "Content-Type": "application/json",
        };

    if (currentUser.userId && currentUser.credentials) {
      headers["Authorization"] = `Basic ${currentUser.credentials}`;
    }

    try {
      const url = isAIRequest
        ? "https://gmapi.suisuy.workers.dev/corsproxy?q=https://models.inference.ai.azure.com/chat/completions"
        : `${API_BASE_URL}${endpoint}`;

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
      });

            const data = await response.json();

            // Hide the spinner after the request completes
            this.hideSpinner();

            return data;
        } catch (error) {
            console.error("API Error:", error);
            this.hideSpinner(); // Ensure spinner is hidden on error
            return { error: "Network error" };
        }
    }

  // Convert newline characters to <br> tags
  convertNewlinesToBreaks(text) {
    return text.replace(/\n/g, '<br>');
  }

  // Convert HTML to Markdown
  htmlToMarkdown(html) {
    // Basic HTML to MD conversion
    let md = html;
    // Headers
    md = md.replace(/<h1>(.*?)<\/h1>/gi, "# $1\n");
    md = md.replace(/<h2>(.*?)<\/h2>/gi, "## $1\n");
    md = md.replace(/<h3>(.*?)<\/h3>/gi, "### $1\n");
    // Bold
    md = md.replace(/<strong>(.*?)<\/strong>/gi, "**$1**");
    // Italic
    md = md.replace(/<em>(.*?)<\/em>/gi, "*$1*");
    // Links
    md = md.replace(/<a href="(.*?)">(.*?)<\/a>/gi, "[$2]($1)");
    // Images
    md = md.replace(/<img src="(.*?)".*?>/gi, "![]($1)");
    // Lists
    md = md.replace(/<ul>(.*?)<\/ul>/gi, "$1\n");
    md = md.replace(/<ol>(.*?)<\/ol>/gi, "$1\n");
    md = md.replace(/<li>(.*?)<\/li>/gi, "- $1\n");
    // Paragraphs
    md = md.replace(/<p>(.*?)<\/p>/gi, "$1\n\n");
    // Clean up
    md = md.replace(/&nbsp;/g, " ");
    return md.trim();
  }

  // Update markdown content
  updateContent() {
    this.content = this.htmlToMarkdown(this.editor.innerHTML);
    if (this.sourceView) {
      this.sourceView.textContent = this.content;
    }
  }

  // Insert content into the editor, converting newlines to <br>
  insertContent(text) {
    this.editor.innerHTML += this.convertNewlinesToBreaks(text);
  }

  toggleEditable() {
    this.isEditable = !this.isEditable;
    this.editor.contentEditable = this.isEditable;
    document.getElementById("noteTitle").contentEditable = this.isEditable;
    
    // Update button icon
    const button = document.getElementById("toggleEditableBtn");
    const icon = button.querySelector("i");
    if (this.isEditable) {
      icon.className = "fas fa-lock-open";
      button.title = "Lock Editor";
    } else {
      icon.className = "fas fa-lock";
      button.title = "Unlock Editor";
    }
  }

  toggleSourceView() {
    this.isSourceView = !this.isSourceView;
    const sourceView = this.sourceView;
    const editor = this.editor;

    if (this.isSourceView) {
        // Switching to source view
        this.updateContent();  // Convert current HTML to markdown
        sourceView.value = editor.innerHTML;  // Show HTML source
        editor.style.display = "none";
        sourceView.style.display = "block";

        // Add input event listener to sync changes
        sourceView.addEventListener('input', () => {
            editor.innerHTML = sourceView.value;
            this.scheduleAutoSave();
        });
    } else {
        // Switching back to editor view
        editor.innerHTML = sourceView.value;  // Apply source changes to editor
        editor.style.display = "block";
        sourceView.style.display = "none";
        this.updateContent();  // Update markdown content
        this.scheduleAutoSave();
    }
  }

  setupAIToolbar() {
    // Load saved model preferences
    const savedModels = JSON.parse(localStorage.getItem('aiModelPreferences') || '{}');
    
    // Set initial button texts and values
    ['modelBtn1', 'modelBtn2', 'modelBtn3'].forEach((btnId, index) => {
      const btn = document.getElementById(btnId);
      const modelValue = savedModels[`model${index + 1}`] || (index === 0 ? 'gpt-4o' : 'none');
      btn.textContent = this.getModelDisplayName(modelValue);
      btn.setAttribute('data-selected-value', modelValue);
    });

    // Handle custom dropdowns
    document.querySelectorAll('.custom-dropdown').forEach((dropdown, index) => {
      const btn = dropdown.querySelector('.model-select-btn');
      const options = dropdown.querySelector('.model-options');
      
      // Toggle dropdown
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close all other dropdowns
        document.querySelectorAll('.model-options').forEach(opt => {
          if (opt !== options) opt.classList.remove('show');
        });
        options.classList.toggle('show');
      });

      // Handle option selection
      options.querySelectorAll('button').forEach(option => {
        option.addEventListener('click', (e) => {
          e.stopPropagation();
          const value = option.dataset.value;
          const displayName = option.textContent;
          btn.textContent = displayName;
          btn.setAttribute('data-selected-value', value);
          options.classList.remove('show');

          // Save preference
          const preferences = JSON.parse(localStorage.getItem('aiModelPreferences') || '{}');
          preferences[`model${index + 1}`] = value;
          localStorage.setItem('aiModelPreferences', JSON.stringify(preferences));
        });
      });
    });

    // Close dropdowns when clicking outside, but not the AI toolbar itself
    document.addEventListener('click', (e) => {
      // Don't close if clicking inside the AI toolbar
      if (!this.aiToolbar.contains(e.target)) {
        document.querySelectorAll('.model-options').forEach(opt => {
          opt.classList.remove('show');
        });
      }
    });

    // Handle selection changes
    this.setupSelectionHandler();

    // Handle AI action buttons
    this.aiToolbar.querySelectorAll("button[data-ai-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.dataset.aiAction;
        const selectedText = window.getSelection().toString().trim();
        
        // Hide toolbar only when clicking action buttons
        this.aiToolbar.style.display = 'none';

        // Only process action if there's selected text
        if (selectedText) {
          await this.handleAIAction(action, selectedText);
        }
      });
    });
  }

  // Helper function to get display name for model
  getModelDisplayName(value) {
    const modelNames = {
        'gpt-4o': 'GPT-4O',
        'gpt-4o-mini': 'GPT-4O Mini',
        'Meta-Llama-3.1-405B-Instruct': 'Llama 3.1 405B',
        'Llama-3.2-90B-Vision-Instruct': 'Llama 3.2 90B',
        'Mistral-large': 'Mistral Large',
        'none': 'No Model'
    };
    return modelNames[value] || value;
  }

  setupSelectionHandler() {
    // Remove any existing listener
    document.removeEventListener("selectionchange", this.selectionChangeHandler);
    
    // Create the handler
    this.selectionChangeHandler = () => {
        const selection = window.getSelection();
        if (!selection.isCollapsed && selection.toString().trim()) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            
            // Get toolbar dimensions
            const toolbarWidth = this.aiToolbar.offsetWidth || 300; // Fallback width if not yet rendered
            const toolbarHeight = this.aiToolbar.offsetHeight || 150; // Fallback height
            
            // Calculate initial position - center the toolbar on the selection
            let leftPosition = rect.left + (rect.width / 2) - (toolbarWidth / 2);
            let topPosition = rect.bottom + window.scrollY + 30;  // 30px below pointer
            
            // Ensure left position stays within window bounds
            const maxLeft = window.innerWidth - toolbarWidth - 20; // 20px padding from right
            const minLeft = 20; // 20px padding from left
            
            // Clamp the position between min and max bounds
            leftPosition = Math.min(Math.max(leftPosition, minLeft), maxLeft);
            
            // Check bottom boundary
            if (topPosition + toolbarHeight > window.innerHeight + window.scrollY) {
                // Place above the selection if it would overflow bottom
                topPosition = rect.top + window.scrollY - toolbarHeight - 10;
            }
            
            // Apply the position
            this.aiToolbar.style.display = 'block';
            this.aiToolbar.style.top = `${topPosition}px`;
            this.aiToolbar.style.left = `${leftPosition}px`;
        } else {
            // Hide toolbar completely when no selection
            this.aiToolbar.style.display = 'none';
            this.aiToolbar.classList.remove("visible");
        }
    };

    // Add the listener
    document.addEventListener("selectionchange", this.selectionChangeHandler);
  }

  async handleAIAction(action, text) {
    // Check if text has less than 3 words
    const wordCount = text.trim().split(/\s+/).length;
    const useComment = wordCount < 3;

    let prompt = "";
    if (this.aiSettings.prompts[action]) {
        prompt = this.aiSettings.prompts[action].replace('{text}', text);
    } else {
        // Handle custom tools
        const customTool = this.aiSettings.customTools.find(tool => tool.id === action);
        if (customTool) {
            prompt = customTool.prompt.replace('{text}', text);
        }
    }

    // Get selected models from buttons
    const model1 = document.getElementById("modelBtn1").getAttribute('data-selected-value') || 'gpt-4o';
    const model2 = document.getElementById("modelBtn2").getAttribute('data-selected-value') || 'none';
    const model3 = document.getElementById("modelBtn3").getAttribute('data-selected-value') || 'none';
    
    // Build array of selected models (excluding "none")
    const selectedModels = [];
    if (model1 !== "none") selectedModels.push(model1);
    if (model2 !== "none") selectedModels.push(model2);
    if (model3 !== "none") selectedModels.push(model3);
    
    if (selectedModels.length === 0) {
        alert("Please select at least one AI model");
        return;
    }

    try {
        // Hide AI toolbar immediately
        this.aiToolbar.style.display = 'none';
        this.aiToolbar.classList.remove("visible");

        // Get the current block where selection is  
        let selection = window.getSelection();
        let currentBlock = selection.anchorNode.parentElement.closest(".block");
        const range = selection.getRangeAt(0);
        let commentedSpan = null;

        if (useComment) {
            // Create span for the selected text
            commentedSpan = document.createElement("span");
            commentedSpan.className = "commented-text";
            range.surroundContents(commentedSpan);
        }

        // Make parallel requests to selected models
        const requests = selectedModels.map(modelName => 
            this.apiRequest(
                "POST",
                "",
                {
                    messages: [
                        {
                            role: "system",
                            content: "You are a helpful assistant.",
                        },
                        {
                            role: "user",
                            content: prompt,
                        },
                    ],
                    model: modelName,
                    temperature: 0.7,
                    max_tokens: 3999,
                    top_p: 1,
                },
                true
            )
        );

        // Keep track of completed responses
        let completedResponses = 0;
        const totalResponses = selectedModels.length;

        // Process each request as it completes
        requests.forEach((request, index) => {
            const modelName = selectedModels[index];
            
            request.then(response => {
                if (response.error) {
                    // Handle rate limit or other API errors
                    const errorMessage = response.error.code === "RateLimitReached" 
                        ? `Rate limit reached for ${modelName}. Please try again later.`
                        : `Error with ${modelName}: ${response.error.message || 'Unknown error'}`;
                    this.showToast(errorMessage);
                    completedResponses++;
                    if (completedResponses === totalResponses) {
                        this.saveNote(true);
                    }
                    return;
                }

                if (response.choices && response.choices[0]) {
                    const aiResponse = response.choices[0].message.content;

                    if (useComment) {
                        // Add this response to the comment
                        const currentComment = commentedSpan.getAttribute("data-comment") || "";
                        const newResponse = `[${modelName}]:\n${aiResponse}\n\n`;
                        const updatedComment = currentComment ? currentComment + newResponse + '---\n' : newResponse;
                        commentedSpan.setAttribute("data-comment", updatedComment);

                        // Show or update tooltip for all responses
                        const tooltip = document.getElementById('commentTooltip');
                        if (index === 0 || tooltip.style.display === 'block') {
                            this.showCommentTooltip(commentedSpan, updatedComment);
                        }
                    } else {
                        // Create a new block for longer responses
                        const block = document.createElement("div");
                        block.className = "block";
                        block.innerHTML = `<h2> ${action} (${modelName})</h2>${marked.parse(aiResponse)}`;

                        // Add blank line before new block
                        const blankLine = document.createElement("div");
                        blankLine.innerHTML = "<br>";

                       
                        // Insert blank line and block
                        if (currentBlock) {
                            currentBlock.after(blankLine);
                            blankLine.after(block);
                        } else {
                            this.editor.appendChild(blankLine);
                            this.editor.appendChild(block);
                        }
                        currentBlock=block;
                    }

                    // Increment completed responses counter
                    completedResponses++;

                    // If all responses are complete, save the note
                    if (completedResponses === totalResponses) {
                        this.saveNote(true);
                    }
                }
            }).catch(error => {
                console.error(`Error with ${modelName} request:`, error);
                this.showToast(`Error with ${modelName}: ${error.message || 'Network error'}`);
                completedResponses++;
                if (completedResponses === totalResponses) {
                    this.saveNote(true);
                }
            });
        });
    } catch(e) {
        console.error(e);
    }
}

  setupAISettings() {
    const modal = document.getElementById('aiSettingsModal');
    const aiSettingsBtn = document.getElementById('aiSettingsBtn');
    const closeBtn = modal.querySelector('.close');
    const saveBtn = document.getElementById('saveSettings');
    const addCustomToolBtn = document.getElementById('addCustomTool');
    
    // Load current settings
    document.getElementById('askPrompt').value = this.aiSettings.prompts.ask;
    document.getElementById('correctPrompt').value = this.aiSettings.prompts.correct;
    document.getElementById('translatePrompt').value = this.aiSettings.prompts.translate;
    
    this.renderCustomTools();

    // Event listeners
    aiSettingsBtn.onclick = () => {
      // Update values from current settings when opening modal
      document.getElementById('askPrompt').value = this.aiSettings.prompts.ask;
      document.getElementById('correctPrompt').value = this.aiSettings.prompts.correct;
      document.getElementById('translatePrompt').value = this.aiSettings.prompts.translate;
      this.renderCustomTools();
      modal.style.display = "block";
    };
    closeBtn.onclick = () => modal.style.display = "none";
    window.onclick = (e) => {
      if (e.target === modal) modal.style.display = "none";
    };

    addCustomToolBtn.onclick = () => this.addCustomTool();
    
    saveBtn.onclick = () => {
      this.saveAISettings();
      modal.style.display = "none";
      this.updateAIToolbar();
    };
  }

  renderCustomTools() {
    const container = document.getElementById('customTools');
    container.innerHTML = '';
    
    this.aiSettings.customTools.forEach((tool, index) => {
      const toolDiv = document.createElement('div');
      toolDiv.className = 'custom-tool';
      toolDiv.innerHTML = `
        <input type="text" class="tool-name" placeholder="Tool Name" value="${tool.name}">
        <input type="text" class="tool-prompt" placeholder="Prompt Template" value="${tool.prompt}">
        <button class="remove-tool" data-index="${index}"><i class="fas fa-trash"></i></button>
      `;
      
      toolDiv.querySelector('.remove-tool').onclick = () => {
        this.aiSettings.customTools.splice(index, 1);
        this.renderCustomTools();
      };
      
      container.appendChild(toolDiv);
    });
  }

  addCustomTool() {
    this.aiSettings.customTools.push({
      id: 'custom_' + Date.now(),
      name: '',
      prompt: ''
    });
    this.renderCustomTools();
  }

  async loadUserConfig() {
    try {
      const config = await this.apiRequest("GET", "/users/config");
      if (config && !config.error) {
        // Parse the config if it's a string
        const parsedConfig =  JSON.parse(config.config);
        // Update aiSettings with config values or defaults
        this.aiSettings = {
          prompts: parsedConfig.prompts || {
            ask: "Answer this question: {text}",
            correct: "Correct any grammar or spelling errors in this text: {text}",
            translate: "Translate this text to English: {text}"
          },
          customTools: parsedConfig.customTools || []
        };
      console.log("load config, pasedconfig",parsedConfig,"this.aisettings ",this,this.aiSettings);

      }

      this.updateAIToolbar();
    } catch (error) {
      console.error("Error loading user config:", error);
    }
  }

  async saveAISettings() {
    // Prepare the config object
    const config = {
      prompts: {
        ask: document.getElementById('askPrompt').value,
        correct: document.getElementById('correctPrompt').value,
        translate: document.getElementById('translatePrompt').value
      },
      customTools: Array.from(document.querySelectorAll('.custom-tool')).map((toolDiv, index) => ({
        id: this.aiSettings.customTools[index]?.id || 'custom_' + Date.now(),
        name: toolDiv.querySelector('.tool-name').value,
        prompt: toolDiv.querySelector('.tool-prompt').value
      }))
    };
    
    try {
      await this.apiRequest("POST", "/users/config", {config: JSON.stringify(config)});
      // Update local settings after successful save
      this.aiSettings = config;
    } catch (error) {
      console.error("Error saving user config:", error);
      alert("Failed to save settings to server");
    }
  }

  updateAIToolbar() {
    const actionsContainer = this.aiToolbar.querySelector('.ai-actions');
    actionsContainer.innerHTML = `
      <button data-ai-action="ask"><i class="fas fa-question-circle"></i> Ask</button>
      <button data-ai-action="correct"><i class="fas fa-check-circle"></i> Correct</button>
      <button data-ai-action="translate"><i class="fas fa-language"></i> Translate</button>
    `;
    
    // Add custom tool buttons
    this.aiSettings.customTools.forEach(tool => {
      if (tool.name) {
        const button = document.createElement('button');
        button.setAttribute('data-ai-action', tool.id);
        button.innerHTML = `<i class="fas fa-magic"></i> ${tool.name}`;
        actionsContainer.appendChild(button);
      }
    });

    // Rebind click events
    actionsContainer.querySelectorAll('button').forEach(button => {
      button.addEventListener('click', async () => {
        const action = button.dataset.aiAction;
        const selectedText = window.getSelection().toString().trim();
        this.aiToolbar.style.display = 'none';

        await this.handleAIAction(action, selectedText);
      });
    });
  }

  setupCommentSystem() {
    const tooltip = document.getElementById('commentTooltip');
    let currentCommentElement = null;
    let isEditing = false;
    
    // Handle clicking on commented text
    this.editor.addEventListener('click', (e) => {
      const target = e.target;
      if (target.classList.contains('commented-text')) {
        const comment = target.getAttribute('data-comment');
        if (comment) {
          currentCommentElement = target;
          this.showCommentTooltip(target, comment);
        }
      } else {
        // Hide tooltip when clicking anywhere else
        const tooltip = document.getElementById('commentTooltip');
        tooltip.style.display = 'none';
        currentCommentElement = null;
      }
    });

    // Handle close button click
    tooltip.querySelector('.close-tooltip')?.addEventListener('click', () => {
      tooltip.style.display = 'none';
      currentCommentElement = null;
    });

    // Handle comment editing
    tooltip.addEventListener('click', (e) => {
      if (e.target.classList.contains('edit-comment')) {
        isEditing = true;
        this.editComment(currentCommentElement);
      } else if (e.target.classList.contains('delete-comment')) {
        this.deleteComment(currentCommentElement);
        tooltip.style.display = 'none';
      }
    });
  }

  showCommentTooltip(element, comment) {
    const tooltip = document.getElementById('commentTooltip');
    tooltip.innerHTML = `
      <div class="tooltip-header">
        <div class="comment-actions">
          <button class="edit-comment">Edit</button>
          <button class="delete-comment">Delete</button>
          <button class="close-tooltip">Close</button>
          </div>
        
      </div>
      <div class="comment-content">${comment}</div>
    `;

    // Reattach close button event listener
    tooltip.querySelector('.close-tooltip').addEventListener('click', () => {
      tooltip.style.display = 'none';
      currentCommentElement = null;
    });
    
    // Position the tooltip
    tooltip.style.display = 'block';
  }

  editComment(element) {
    const tooltip = document.getElementById('commentTooltip');
    const currentComment = element.getAttribute('data-comment');
    
    tooltip.innerHTML = `
      <textarea class="comment-edit-input" rows="3">${currentComment}</textarea>
      <div class="comment-actions">
        <button class="save-comment">Save</button>
        <button class="cancel-comment">Cancel</button>
      </div>
    `;

    const input = tooltip.querySelector('.comment-edit-input');
    input.focus();
    input.select();

    const saveBtn = tooltip.querySelector('.save-comment');
    const cancelBtn = tooltip.querySelector('.cancel-comment');

    const handleSave = () => {
      const newComment = input.value.trim();
      if (newComment) {
        element.setAttribute('data-comment', newComment);
        this.showCommentTooltip(element, newComment);
        this.scheduleAutoSave();
      }
    };

    const handleCancel = () => {
      this.showCommentTooltip(element, currentComment);
    };

    saveBtn.addEventListener('click', handleSave);
    cancelBtn.addEventListener('click', handleCancel);

    // Handle Enter key to save
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleSave();
      }
    });

    // Handle Escape key to cancel
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    });
  }

  deleteComment(element) {
    const confirmDelete = prompt('Type "yes" to confirm deleting this comment:');
    if (confirmDelete && confirmDelete.toLowerCase() === 'yes') {
      const text = element.textContent;
      const textNode = document.createTextNode(text);
      element.parentNode.replaceChild(textNode, element);
      this.scheduleAutoSave();
    }
  }

  addComment() {
    const selection = window.getSelection();
    if (!selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const comment = prompt('Enter your comment:');
      
      if (comment) {
        const span = document.createElement('span');
        span.className = 'commented-text';
        span.setAttribute('data-comment', comment);
        
        range.surroundContents(span);
        this.scheduleAutoSave();
      }
    } else {
      alert('Please select some text to comment on');
    }
  }

  // Get text from current block and all context above it
  getBlockContext() {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    
    // Handle text nodes by getting their parent element
    const startElement = range.startContainer.nodeType === Node.TEXT_NODE ? 
                        range.startContainer.parentElement : 
                        range.startContainer;
    
    let currentBlock = startElement.closest('.block');
    
    if (!currentBlock) {
        // If no block is selected, get the last block
        const blocks = this.editor.querySelectorAll('.block');
        currentBlock = blocks[blocks.length - 1];
    }

    if (!currentBlock) {
        return null;
    }

    // Get all preceding text for context
    let context = [];
    let allBlocks = Array.from(this.editor.querySelectorAll('.block'));
    let currentBlockIndex = allBlocks.indexOf(currentBlock);
    
    // Get all blocks up to the current one
    for (let i = 0; i <= currentBlockIndex; i++) {
        const block = allBlocks[i];
        // Skip empty blocks and only include text content
        const blockText = block.textContent.trim();
        if (blockText) {
            context.push(blockText);
        }
    }

    return {
        currentText: currentBlock.textContent.trim(),
        contextText: context.join('\n\n')
    };
  }

  async handleQuickAsk() {
    const context = this.getBlockContext();
    if (!context) {
      alert('Please select or create a block first');
      return;
    }

    // Get selected models from buttons
    const model1 = document.getElementById("modelBtn1").getAttribute('data-selected-value') || 'gpt-4o';
    const model2 = document.getElementById("modelBtn2").getAttribute('data-selected-value') || 'none';
    const model3 = document.getElementById("modelBtn3").getAttribute('data-selected-value') || 'none';
    
    // Build array of selected models (excluding "none")
    const selectedModels = [];
    if (model1 !== "none") selectedModels.push(model1);
    if (model2 !== "none") selectedModels.push(model2);
    if (model3 !== "none") selectedModels.push(model3);
    
    if (selectedModels.length === 0) {
      alert("Please select at least one AI model");
      return;
    }

    // Make parallel requests to selected models
    const requests = selectedModels.map(modelName => 
      this.apiRequest(
        "POST",
        "",
        {
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant. Use the context provided to give relevant answers.",
            },
            {
              role: "user",
              content: `Context:\n${context.contextText}\n\nQuestion/Text:\n${context.currentText}`,
            },
          ],
          model: modelName,
          temperature: 0.7,
          max_tokens: 3999,
          top_p: 1,
        },
        true
      )
    );

    try {
      // Get the current block where selection is
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      let currentBlock;
      if (range.startContainer.nodeType === Node.TEXT_NODE) {
        currentBlock = range.startContainer.parentElement.closest('.block');
      } else {
        currentBlock = range.startContainer.closest('.block');
      }

      // Process each request
      requests.forEach((request, index) => {
        const modelName = selectedModels[index];
        
        request.then(response => {
          if (response.error) {
            // Handle rate limit or other API errors
            const errorMessage = response.error.code === "RateLimitReached" 
                ? `Rate limit reached for ${modelName}. Please try again later.`
                : `Error with ${modelName}: ${response.error.message || 'Unknown error'}`;
            this.showToast(errorMessage);
            return;
          }

          if (response.choices && response.choices[0]) {
            const aiResponse = response.choices[0].message.content;
            
            // Create new block for this model's response with h2 header
            const block = document.createElement("div");
            block.className = "block";
            block.innerHTML = `<h2>AI Response (${modelName})</h2>${marked.parse(aiResponse)}`;
            
            // Add blank line before new block
            const blankLine = document.createElement("div");
            blankLine.innerHTML = "<br>";
            
            // Find the last AI response block for this quick ask
            let lastResponseBlock = currentBlock;
            let nextBlock = currentBlock.nextElementSibling;
            
            // // Keep going until we find a block that's not an AI response
            // while (nextBlock) {
            //     if (nextBlock.querySelector('h2')?.textContent.includes('AI Response')) {
            //         lastResponseBlock = nextBlock;
            //         nextBlock = nextBlock.nextElementSibling;
            //     } else {
            //         break;
            //     }
            // }
            
            // Insert blank line and block
            if (lastResponseBlock) {
                lastResponseBlock.after(blankLine);
                blankLine.after(block);
            } else {
                this.editor.appendChild(blankLine);
                this.editor.appendChild(block);
            }
            currentBlock=nextBlock;
          }
        }).catch(error => {
          console.error(`Error with ${modelName} request:`, error);
          this.showToast(`Error with ${modelName}: ${error.message || 'Network error'}`);
        });
      });
    } catch (error) {
      console.error('Quick Ask error:', error);
      this.showToast('Error getting AI responses');
    }
  }

  setupEventListeners() {
    // Quick Ask button 
    document.querySelectorAll('#quickAskBtn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.handleQuickAsk();
      }); 
    });

    // Sidebar toggle
    document
      .getElementById("toggleSidebar")
      .addEventListener("click", () => this.toggleSidebar());

    // New page button
    document
      .getElementById("newPageBtn")
      .addEventListener("click", () => this.createNewNote());

    // New folder button and related events
    document
      .getElementById("newFolderBtn")
      .addEventListener("click", () => this.showNewFolderInput());

    document
      .getElementById("createFolderBtn")
      .addEventListener("click", () => this.createFolder());

    document
      .getElementById("cancelFolderBtn")
      .addEventListener("click", () => this.hideNewFolderInput());

    document
      .getElementById("newFolderInput")
      .addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.createFolder();
        } else if (e.key === "Escape") {
          this.hideNewFolderInput();
        }
      });

    // Media insert buttons
    document
      .getElementById("insertImage")
      .addEventListener("click", () => this.insertMedia("image"));
    document
      .getElementById("insertAudio")
      .addEventListener("click", () => this.insertMedia("audio"));
    document
      .getElementById("insertVideo")
      .addEventListener("click", () => this.insertMedia("video"));
    document
      .getElementById("insertIframe")
      .addEventListener("click", () => this.insertIframe());

    // Add comment button handler
    document
      .getElementById("addComment")
      .addEventListener("click", () => this.addComment());

    // Format buttons
    document
      .querySelectorAll(".formatting-tools button[data-command]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const command = button.dataset.command;
          if (command.startsWith('h')) {
            // Handle heading commands
            this.formatBlock(command);
          } else {
            this.executeCommand(command);
          }
        });
      });

    

    // Text color
    document.getElementById("textColor").addEventListener("input", (e) => {
      document.execCommand("foreColor", false, e.target.value);
    });

    // Background color
    document.getElementById("bgColor").addEventListener("input", (e) => {
      document.execCommand("hiliteColor", false, e.target.value);
    });

    // Add block button
    document.getElementById("addBlockBtn").addEventListener("click", () => {
      this.addNewBlock();
    });

    // View source button
    document.getElementById("viewSourceBtn").addEventListener("click", () => {
      this.toggleSourceView();
    });

    // Toggle editable button
    document.getElementById("toggleEditableBtn").addEventListener("click", () => {
      this.toggleEditable();
    });

    // Save button
    document.getElementById("saveNoteBtn").addEventListener("click", () => {
      this.saveNote();
    });

    // Auto-save on content changes
    this.editor.addEventListener("input", () => {
      this.scheduleAutoSave();
      this.updateTableOfContents();
    });

    this.editor.addEventListener("paste", () => {
      this.scheduleAutoSave();
    });

    // Handle keyboard shortcuts
    this.editor.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        if (e.shiftKey) {
          // Insert a single line break
          document.execCommand('insertLineBreak', false, null);
          e.preventDefault();
        } else {
          // Insert a line break (instead of a new paragraph)
          document.execCommand('insertLineBreak', false, null);
          e.preventDefault();
        }
      }
      if (e.key === "/" && !e.shiftKey) {
        this.showBlockMenu(e);
      }
      // Add Ctrl+Enter handler for quick ask
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();  // Prevent default behavior
        this.handleQuickAsk();
      }

      // Detect '# ' to convert to H1
      if (e.key === " " || e.key === "Enter") {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        const node = selection.anchorNode;
        if (!node) return;

        // Get text before the cursor
        const textBeforeCursor = node.textContent.slice(0, range.endOffset);

        // Check if the line starts with '# '
        const hashMatch = textBeforeCursor.match(/^(#)\s$/);
        if (hashMatch) {
            e.preventDefault(); // Prevent the space character from being inserted

            // Remove '# ' from the editor
            node.textContent = node.textContent.slice(0, range.endOffset - 2) + node.textContent.slice(range.endOffset);

            // Create an H1 element
            const h1 = document.createElement("h1");
            h1.textContent = ""; // Empty H1 ready for user input
            h1.setAttribute("contenteditable", "true");
            h1.setAttribute("placeholder", "Enter heading here...");

            // Insert the H1 element at the cursor position
            range.insertNode(h1);

            // Move the cursor inside the H1
            selection.removeAllRanges();
            const newRange = document.createRange();
            newRange.setStart(h1, 0);
            newRange.collapse(true);
            selection.addRange(newRange);
        }
    }

    // Detect '```' to convert to code block
    if (e.key === "`") {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        const node = selection.anchorNode;
        if (!node) return;

        // Get text before the cursor
        const textBeforeCursor = node.textContent.slice(0, range.endOffset);

        // Check if the last three characters are '```'
        const backtickMatch = textBeforeCursor.match(/```$/);
        if (backtickMatch) {
            e.preventDefault(); // Prevent the backtick from being inserted

            // Remove '```' from the editor
            node.textContent = node.textContent.slice(0, range.endOffset - 3) + node.textContent.slice(range.endOffset);

            // Create a code block
            const pre = document.createElement("pre");
            const code = document.createElement("code");
            code.setAttribute("contenteditable", "true");
            code.setAttribute("placeholder", "Enter code here...");
            pre.appendChild(code);

            // Insert the code block
            range.insertNode(pre);

            // Move the cursor inside the code block
            selection.removeAllRanges();
            const newRange = document.createRange();
            newRange.setStart(code, 0);
            newRange.collapse(true);
            selection.addRange(newRange);
        }
    }
    });

    // Plain text button
    document
      .getElementById("plainTextBtn")
      .addEventListener("click", () => this.convertToPlainText());
  }

  executeCommand(command, value = null) {
    document.execCommand(command, false, value);
    this.editor.focus();
  }

  formatBlock(tag) {
    document.execCommand("formatBlock", false, `<${tag}>`);
  }

  addNewBlock() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText) {
        // Create a new block element
        const newBlock = document.createElement("div");
        newBlock.className = "block";
        newBlock.innerHTML = `${selectedText}`;

        // Get the range of the selected text
        const range = selection.getRangeAt(0);

        // Replace the selected text with the new block
        range.deleteContents();
        range.insertNode(newBlock);

        // Clear the selection
        selection.removeAllRanges();

        // Optionally, focus the new block's paragraph
        const textNode = newBlock;
        if (textNode) {
            textNode.focus();
            range.selectNodeContents(textNode);
            range.collapse(true);
            selection.addRange(range);
        }

        // Exit the function after wrapping the text
        return;
    }

    // Existing code below...
    const block = document.createElement("div");
    block.className = "block";
    block.innerHTML = `
 
`;

    // Get current selection and find closest block
    const range = selection.getRangeAt(0);
    
    // Try to find current block from selection
    let currentBlock = range.startContainer.nodeType === Node.TEXT_NODE 
      ? range.startContainer.parentElement.closest(".block")
      : range.startContainer.closest(".block");

    // If no block found from selection, try to find last block before cursor
    if (!currentBlock) {
        const blocks = Array.from(this.editor.querySelectorAll('.block'));
        for (let i = blocks.length - 1; i >= 0; i--) {
            const rect = blocks[i].getBoundingClientRect();
            if (rect.top < range.getBoundingClientRect().top) {
                currentBlock = blocks[i];
                break;
            }
        }
    }

    if (currentBlock) {
        // Add blank line before new block
        const blankLine = document.createElement("div");
        blankLine.innerHTML = "<br>";
        currentBlock.after(blankLine);
        // Insert new block after blank line
        blankLine.after(block);
    } else {
        // If still no block found, insert at cursor position or append to editor
        if (selection.rangeCount > 0) {
            range.deleteContents();
            range.insertNode(block);
        } else {
            this.editor.appendChild(block);
        }
    }

    // Focus the new block and move cursor inside
    const textNode = block;
    textNode.focus();
    range.selectNodeContents(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
}

  

  showBlockMenu(e) {
    e.preventDefault();
    // Implement block menu for different block types
    // This would show a popup menu with options like:
    // - Text
    // - Heading
    // - List
    // - Todo
    // - Quote
    // etc.
  }

  createLink() {
    const url = prompt("Enter URL:");
    if (url) {
      document.execCommand("createLink", false, url);
    }
  }

  insertMedia(type) {
    const url = prompt(`Enter ${type} URL:`);
    if (!url) return;

    const block = document.createElement("div");
    block.className = `block media-block ${type}-block`;

    let mediaElement;
    switch (type) {
      case "image":
        mediaElement = document.createElement("img");
        mediaElement.src = url;
        mediaElement.alt = "Inserted image";
        break;
      case "audio":
        mediaElement = document.createElement("audio");
        mediaElement.src = url;
        mediaElement.controls = true;
        break;
      case "video":
        mediaElement = document.createElement("video");
        mediaElement.src = url;
        mediaElement.controls = true;
        break;
    }

    block.appendChild(mediaElement);

    // Insert at cursor position
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(block);

    // Update markdown content
    this.updateContent();
  }

  insertIframe() {
    const url = prompt("Enter webpage URL:");
    if (!url) return;

    const block = document.createElement("div");
    block.className = "block iframe-block";

    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.width = "100%";
    iframe.height = "400px";
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("allowfullscreen", "true");

    block.appendChild(iframe);
    this.editor.appendChild(block);
  }

  async register(userId, password, email) {
    const passwordHash = CryptoJS.SHA256(password).toString();
    const result = await this.apiRequest("POST", "/users", {
      user_id: userId,
      password_hash: passwordHash,
      email,
    });

    if (result.success) {
      currentUser = { userId, passwordHash };
      localStorage.setItem("userId", userId);
      localStorage.setItem("passwordHash", passwordHash);
      this.updateAuthUI();
      await this.loadNotes();
      return true;
    }
    return false;
  }

  async login(userId, password) {
    const passwordHash = btoa(password);
    const result = await this.apiRequest("GET", "/notes"); // Test auth with notes endpoint

    if (!result.error) {
      currentUser = { userId, passwordHash };
      localStorage.setItem("userId", userId);
      localStorage.setItem("passwordHash", passwordHash);
      this.updateAuthUI();
      await this.loadNotes();
      return true;
    }
    return false;
  }

  logout() {
    currentUser = { userId: null, credentials: null };
    localStorage.removeItem("userId");
    localStorage.removeItem("credentials");
    this.updateAuthUI();
    this.clearNotes();
  }

  updateAuthUI() {
    const isLoggedIn = currentUser.userId && currentUser.credentials;
    if (!isLoggedIn) {
      window.location.href = "auth.html";
    }
  }

  async checkAuthAndLoadNotes() {
    if (currentUser.userId && currentUser.credentials) {
        const notes = await this.apiRequest("GET", `/folders/1733485657799jj0.5911120915160637/notes`);
        if (!notes.error) {
            // Check for default note
            const defaultNote = notes.find((note) => note.title === "default_note");
            if (!defaultNote) {
                // Create default note if it doesn't exist
                const result = await this.apiRequest("POST", "/notes", {
                    note_id: "default_note_" + currentUser.userId,
                    title: "default_note",
                    content: "Welcome to your default note!",
                    folder_id: "1733485657799jj0.5911120915160637",
                });
                if (result.success) {
                    await this.loadNotes();  // Will load notes from default folder
                    await this.loadNote("default_note_" + currentUser.userId);
                }
            } else {
                // Load notes from default folder and then load the default note
                await this.loadNotes();
                await this.loadNote(defaultNote.note_id);
            }
        } else {
            this.logout();
        }
    } else {
        this.logout();
    }
  }

  showNewFolderInput() {
    const inputContainer = document.querySelector(".folder-input-container");
    const input = document.getElementById("newFolderInput");
    inputContainer.style.display = "flex";
    input.value = "";
    input.focus();
  }

  hideNewFolderInput() {
    const inputContainer = document.querySelector(".folder-input-container");
    inputContainer.style.display = "none";
  }

  async createFolder() {
    const input = document.getElementById("newFolderInput");
    const folderName = input.value.trim();

    if (!folderName) {
      alert("Please enter a folder name");
      return;
    }

    const result = await this.apiRequest("POST", "/folders", {
      folder_id: Date.now() + folderName + Math.random(),
      name: folderName,
    });

    if (result.success) {
      this.hideNewFolderInput();
      await this.loadFolders();
    } else {
      alert("Failed to create folder: " + (result.error || "Unknown error"));
    }
  }

  async loadFolders(parentFolderId = null) {
    const endpoint = parentFolderId
      ? `/folders/${parentFolderId}/contents`
      : "/folders";
    const folders = await this.apiRequest("GET", endpoint);
    if (Array.isArray(folders)) {
      const foldersList = document.getElementById("folders");
      foldersList.innerHTML = "";

      // Create a map of parent-child relationships
      const folderMap = new Map();
      const rootFolders = [];

      folders.forEach((folder) => {
        folder.children = [];
        folderMap.set(folder.folder_id, folder);
        if (folder.parent_folder_id) {
          const parent = folderMap.get(folder.parent_folder_id);
          if (parent) {
            parent.children.push(folder);
          }
        } else {
          rootFolders.push(folder);
        }
      });

      // Recursive function to render folder hierarchy
      const renderFolder = (folder, level = 0) => {
        const folderElement = document.createElement("div");
        folderElement.className = "folder-item";
        folderElement.setAttribute("data-folder-id", folder.folder_id);
        folderElement.style.paddingLeft = `${level * 20}px`;
        folderElement.innerHTML = `
                    <div class="folder-content">
                        <i class="fas fa-folder"></i>
                        <span>${folder.folder_name}</span>
                        <div class="folder-count">${
                          folder.children ? folder.children.length : 0
                        }</div>
                    </div>
                    <button class="add-note-btn" title="Add note to folder">
                        <i class="fas fa-plus"></i>
                    </button>
                `;

        // Add click handler for the folder itself
        folderElement.querySelector(".folder-content").onclick = async (e) => {
          e.stopPropagation();
          // Load and display folder contents
          await this.loadFolderContents(folder.folder_id, folderElement);
        };

        // Add click handler for the add note button
        const addNoteBtn = folderElement.querySelector(".add-note-btn");
        addNoteBtn.onclick = (e) => {
          e.stopPropagation();
          this.createNewNote(folder.folder_id);
        };

        foldersList.appendChild(folderElement);

        // Recursively render children
        folder.children.forEach((child) => {
          renderFolder(child, level + 1);
        });
      };

      // Render root folders
      rootFolders.forEach((folder) => {
        renderFolder(folder);
      });
    }
  }

  async loadNotes(folderId = "1733485657799jj0.5911120915160637") {  // Set default folder ID
    const endpoint = `/folders/${folderId}/notes`;  // Always use folder-specific endpoint
    const notes = await this.apiRequest("GET", endpoint);
    
    if (Array.isArray(notes)) {
        const pagesList = document.getElementById("pagesList");
        pagesList.innerHTML = "";
        notes.forEach((note) => {
            // Only show notes that belong to this folder
            if (note.folder_id === folderId) {
                const noteElement = document.createElement("div");
                noteElement.className = "page-item";
                noteElement.textContent = note.title || "Untitled Note";
                noteElement.onclick = () => this.loadNote(note.note_id);
                pagesList.appendChild(noteElement);
            }
        });
    }
  }

  async loadNote(note_id) {
    const note = await this.apiRequest("GET", `/notes/${note_id}`);
    if (note && !note.error) {
      this.editor.innerHTML = note.content || "";
      document.getElementById("noteTitle").textContent = note.title || "";
      this.updateContent();
      // Update the current note ID
      this.currentNoteId = note_id;
      this.currentNoteTitle = note.title; // Store the title for later use
      // Update table of contents after loading note
      this.updateTableOfContents();
    } else {
      console.error("Failed to load note:", note.error);
    }
  }

  async createNewNote(folderId = null) {
    const title = prompt("Enter note title:");
    if (!title) return;

    const noteId = title + "_" + currentUser.userId + "_" + Date.now();
    const result = await this.apiRequest("POST", "/notes", {
      note_id: noteId,
      title: title,
      content: "Start writing here...",
      folder_id: folderId || "1733485657799jj0.5911120915160637", // Use default folder if none provided
    });

    if (result.success) {
      if (folderId) {
        // If created in a folder, refresh just that folder's contents
        const folderElement = document.querySelector(
          `.folder-item[data-folder-id="${folderId}"]`
        );
        if (folderElement) {
          await this.loadFolderContents(folderId, folderElement);
        }
      } else {
        // If not in a folder, refresh the main notes list
        await this.loadNotes();
      }
      // Find and load the newly created note
      const notes = await this.apiRequest(
        "GET",
        folderId ? `/folders/${folderId}/notes` : "/notes"
      );
      const newNote = notes.find((note) => note.title === title);
      if (newNote) {
        await this.loadNote(newNote.note_id);
      }
    } else {
      alert("Failed to create note: " + (result.error || "Unknown error"));
    }
  }

  scheduleAutoSave() {
    // Clear any existing timeout
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }

    // Schedule a new auto-save
    this.autoSaveTimeout = setTimeout(() => {
      this.saveNote(true);
    }, 10000); // 10 seconds delay
  }

  async saveNote(isAutoSave = false) {
    if (!this.currentNoteId) {
      return;
    }

    const saveBtn = document.getElementById("saveNoteBtn");
    const saveIcon = saveBtn.querySelector(".fa-save");
    const spinnerIcon = saveBtn.querySelector(".fa-spinner");
    const spanText = saveBtn.querySelector("span");

    try {
      // Show spinner, hide save icon
      saveIcon.style.display = "none";
      spinnerIcon.style.display = "inline-block";
      spanText.textContent = " ";

      // Get current title from the title element
      const currentTitle =
        document.getElementById("noteTitle").textContent.trim() ||
        "Untitled Note";
      this.currentNoteTitle = currentTitle;

      const result = await this.apiRequest("POST", `/notes`, {
        note_id: this.currentNoteId,
        content: this.editor.innerHTML,
        title: currentTitle,
      });

      if (result.success) {
        // Show saved state
        spinnerIcon.style.display = "none";
        saveIcon.style.display = "inline-block";
        spanText.textContent = "Saved";

        // Reset button text after 2 seconds
        setTimeout(() => {
          spanText.textContent = "Save";
        }, 2000);
      } else {
        // Show error state
        spinnerIcon.style.display = "none";
        saveIcon.style.display = "inline-block";
        spanText.textContent = "Error saving";
        setTimeout(() => {
          spanText.textContent = "Save";
        }, 2000);
      }
    } catch (error) {
      console.error("Save error:", error);
      // Show error state
      spinnerIcon.style.display = "none";
      saveIcon.style.display = "inline-block";
      spanText.textContent = "Error saving";
      setTimeout(() => {
        spanText.textContent = "Save";
      }, 2000);
    }
  }

  clearNotes() {
    document.getElementById("pagesList").innerHTML = "";
    this.editor.innerHTML = "Start writing here...>";
  }

  toggleSidebar() {
    const sidebar = document.querySelector(".sidebar");
    const mainContent = document.querySelector(".main-content");
    sidebar.classList.toggle("hidden");
    mainContent.classList.toggle("expanded");
  }

  async loadFolderContents(folderId, folderElement) {
    // Check if content already exists
    let contentContainer = folderElement.nextElementSibling;
    if (
      contentContainer &&
      contentContainer.classList.contains("folder-contents")
    ) {
      // Toggle visibility by removing the container
      contentContainer.remove();
      folderElement.classList.remove("open");
      return;
    }

    folderElement.classList.add("open");

    // Create container for folder contents
    contentContainer = document.createElement("div");
    contentContainer.className = "folder-contents";

    // Load notes in this folder first
    const notes = await this.apiRequest("GET", `/folders/${folderId}/notes`);
    if (Array.isArray(notes)) {
      notes.forEach((note) => {
        const noteElement = document.createElement("div");
        noteElement.className = "page-item folder-note";
        noteElement.innerHTML = `
                    <i class="fas fa-file-alt"></i>
                    <span>${note.title || "Untitled Note"}</span>
                `;
        noteElement.onclick = () => this.loadNote(note.note_id);
        contentContainer.appendChild(noteElement);
      });
    }

    // Load and show sub-folders
    const folders = await this.apiRequest(
      "GET",
      `/folders/${folderId}/contents`
    );
    if (Array.isArray(folders)) {
      folders.forEach((folder) => {
        const subFolderElement = document.createElement("div");
        subFolderElement.className = "folder-item sub-folder";
        subFolderElement.innerHTML = `
                    <div class="folder-content">
                        <i class="fas fa-folder"></i>
                        <span>${folder.folder_name}</span>
                        <button class="add-note-btn" title="Add note to folder">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                `;

        // Add click handler for the folder
        subFolderElement.querySelector(".folder-content").onclick = (e) => {
          e.stopPropagation();
          this.loadFolderContents(folder.folder_id, subFolderElement);
        };

        // Add click handler for the add note button
        const addNoteBtn = subFolderElement.querySelector(".add-note-btn");
        addNoteBtn.onclick = (e) => {
          e.stopPropagation();
          this.createNewNote(folder.folder_id);
        };

        contentContainer.appendChild(subFolderElement);
      });
    }

    // Insert content container after the folder element
    folderElement.after(contentContainer);
  }

  setupTableOfContents() {
    const tocBtn = document.getElementById('toggleTocBtn');
    const tocList = document.getElementById('tocList');
    
    tocBtn.addEventListener('click', () => {
      const isHidden = tocList.style.display === 'none';
      tocList.style.display = isHidden ? 'block' : 'none';
      this.updateTableOfContents();
    });
  }

  updateTableOfContents() {
    const tocList = document.getElementById('tocList');
    if (tocList.style.display === 'none') return;

    // Clear existing TOC
    tocList.innerHTML = '';

    // Get all headings from the editor
    const headings = this.editor.querySelectorAll('h1, h2, h3');
    
    headings.forEach((heading, index) => {
      const level = heading.tagName.toLowerCase();
      const text = heading.textContent;
      
      // Create TOC item
      const tocItem = document.createElement('div');
      tocItem.className = `toc-item toc-${level}`;
      tocItem.textContent = text;
      
      // Add click handler to scroll to heading
      tocItem.addEventListener('click', () => {
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      
      tocList.appendChild(tocItem);
    });
  }

  // Function to convert selected text to plain text
  convertToPlainText() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    // Create a text node with the selected text
    const textNode = document.createTextNode(selectedText);

    // Replace the selected content with the plain text node
    range.deleteContents();
    range.insertNode(textNode);

    // Clear the selection
    selection.removeAllRanges();
  }

  showToast(message, type = 'error') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    toast.innerHTML = `
        <div class="toast-message">${message}</div>
        <button class="toast-close"><i class="fas fa-times"></i></button>
    `;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Handle close button
    const closeBtn = toast.querySelector('.toast-close');
    const closeToast = () => {
        toast.style.animation = 'slideOut 0.3s ease-out forwards';
        setTimeout(() => {
            toastContainer.removeChild(toast);
        }, 300);
    };
    
    closeBtn.addEventListener('click', closeToast);
    
    // Auto close after 10 seconds
    setTimeout(closeToast, 10000);
  }
}

// Initialize the editor and load folders
document.addEventListener("DOMContentLoaded", async () => {
  try {
    window.editor = new NotionEditor();
    await window.editor.loadFolders();
    
    // Profile Modal functionality
    const profileModal = document.getElementById('profileModal');
    const userProfileBtn = document.getElementById('userProfileBtn');
    const closeProfileBtn = profileModal.querySelector('.close, .close-profile-btn');
    const currentUserIdSpan = document.getElementById('currentUserId');
    
    userProfileBtn.addEventListener('click', () => {
        currentUserIdSpan.textContent = currentUser.userId || 'Unknown';
        profileModal.style.display = 'block';
    });
    
    closeProfileBtn.addEventListener('click', () => {
        profileModal.style.display = 'none';
    });
    
    // Close modal when clicking outside of the modal content
    window.addEventListener('click', (event) => {
        if (event.target == profileModal) {
            profileModal.style.display = 'none';
        }
    });
  } catch (error) {
    console.error('Error initializing editor:', error);
    // Redirect to auth page if initialization fails
    //window.location.href = 'auth.html';
  }
});
        // Add event listener for topbar pin button
        document.getElementById('topbarPinBtn').addEventListener('click', () => {
            const selection = window.getSelection();
            if (selection.rangeCount === 0) return;
            const range = selection.getRangeAt(0);
            const currentBlock = range.startContainer.parentElement.closest('.block');
            if (currentBlock) {
              if(currentBlock.classList.contains('pinned')){
                currentBlock.classList.remove('pinned')
                return;
              }
                // Unpin other blocks
                document.querySelectorAll('.block.pinned').forEach(b => b.classList.remove('pinned'));
                currentBlock.classList.add('pinned');
            }
        });
