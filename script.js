const API_BASE_URL = "https://notai.suisuy.workers.dev";
let currentUser = {
  userId: localStorage.getItem("userId"),
  credentials: localStorage.getItem("credentials"),
};

class NotionEditor {
  constructor() {
    this.editor = document.getElementById("editor");
    this.sourceView = document.getElementById("sourceView");
    this.toolbar = document.querySelector(".toolbar");
    this.aiToolbar = document.getElementById("aiToolbar");
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
    this.setupCommentSystem();
    this.updateAIToolbar(); // Load custom AI buttons

    // Add title auto-save
    const titleElement = document.getElementById("noteTitle");
    titleElement.addEventListener("input", () => this.scheduleAutoSave());
    this.currentBlock = null;
    this.content = ""; // Store markdown content
    this.isSourceView = false;
    this.autoSaveTimeout = null;

    // Initialize content and check auth
    this.updateContent();
    this.checkAuthAndLoadNotes();
    this.loadFolders();
  }

  async apiRequest(method, endpoint, body = null, isAIRequest = false) {
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
      return await response.json();
    } catch (error) {
      console.error("API Error:", error);
      return { error: "Network error" };
    }
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

  toggleSourceView() {
    this.isSourceView = !this.isSourceView;
    if (this.isSourceView) {
      this.updateContent();
      this.editor.style.display = "none";
      this.sourceView.style.display = "block";
    } else {
      this.editor.style.display = "block";
      this.sourceView.style.display = "none";
    }
  }

  setupAIToolbar() {
    // Load saved model preferences
    const savedModels = JSON.parse(localStorage.getItem('aiModelPreferences') || '{}');
    
    document.getElementById('aiModelSelect1').value = savedModels.model1 || 'gpt-4o';
    document.getElementById('aiModelSelect2').value = savedModels.model2 || 'none';
    document.getElementById('aiModelSelect3').value = savedModels.model3 || 'none';

    // Save model selections when changed
    ['aiModelSelect1', 'aiModelSelect2', 'aiModelSelect3'].forEach(selectId => {
      document.getElementById(selectId).addEventListener('change', (e) => {
        const preferences = JSON.parse(localStorage.getItem('aiModelPreferences') || '{}');
        preferences[selectId.replace('aiModelSelect', 'model')] = e.target.value;
        localStorage.setItem('aiModelPreferences', JSON.stringify(preferences));
      });
    });

    // Handle selection changes
    this.setupSelectionHandler();

    // Handle AI action buttons
    this.aiToolbar.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.dataset.aiAction;
        const selectedText = window.getSelection().toString().trim();
        
        // Always hide toolbar immediately
        this.aiToolbar.style.display = 'none';

        // Only process action if there's selected text
        if (selectedText) {
          await this.handleAIAction(action, selectedText);
        }
      });
    });
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

        // Position the toolbar below the selection
        const toolbarWidth = this.aiToolbar.offsetWidth;
        const windowWidth = window.innerWidth;
        const leftPosition = Math.min(60, windowWidth - toolbarWidth - 20);
        
        this.aiToolbar.style.display = 'block';
        this.aiToolbar.style.top = `${rect.bottom + window.scrollY + 10}px`;
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

    const model1 = document.getElementById("aiModelSelect1").value;
    const model2 = document.getElementById("aiModelSelect2").value;
    const model3 = document.getElementById("aiModelSelect3").value;
    
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

    try {
      // Hide AI toolbar immediately
      this.aiToolbar.style.display = 'none';
      this.aiToolbar.classList.remove("visible");

      // Get the current block where selection is  
      const selection = window.getSelection();
      const currentBlock = selection.anchorNode.parentElement.closest(".block");
      const range = selection.getRangeAt(0);
      let commentedSpan = null;

      // Process each request as it completes
      requests.forEach((request, index) => {
        const modelName = selectedModels[index];
        
        request.then(response => {
          if (response.choices && response.choices[0]) {
            const aiResponse = response.choices[0].message.content;

            if (useComment) {
              if (!commentedSpan) {
                // Create span for first response
                commentedSpan = document.createElement("span");
                commentedSpan.className = "commented-text";
                range.surroundContents(commentedSpan);
              }

              // Add this response to the comment
              const currentComment = commentedSpan.getAttribute("data-comment") || "";
              const newResponse = `[${modelName}]:\n${aiResponse}\n\n`;
              const updatedComment = currentComment ? currentComment + newResponse + '---\n' : newResponse;
              commentedSpan.setAttribute("data-comment", updatedComment);

              // Update tooltip if it's visible
              const tooltip = document.getElementById('commentTooltip');
              if (tooltip.style.display === 'block') {
                this.showCommentTooltip(commentedSpan, updatedComment);
              }
            } else {
              // Create a new block immediately after the existing one
              const block = document.createElement("div");
              block.className = "block";
              block.innerHTML = `<p><strong>AI ${action} (${modelName}):</strong></p>${marked.parse(aiResponse)}`;

              // Find the last related AI response block
              let lastRelatedBlock = currentBlock;
              let nextBlock = currentBlock ? currentBlock.nextElementSibling : null;
              while (nextBlock && nextBlock.innerHTML.includes(`<strong>AI ${action}`)) {
                lastRelatedBlock = nextBlock;
                nextBlock = nextBlock.nextElementSibling;
              }

              // Insert after the last related block
              if (lastRelatedBlock) {
                lastRelatedBlock.after(block);
              } else {
                this.editor.appendChild(block);
              }
            }
          }
        }).catch(error => {
          console.error(`Error with ${modelName} request:`, error);
        });
      });

    // Hide the toolbars immediately when an action is clicked
  }
  catch(e){
    console.log(e);
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
        <span>Comment</span>
        <button class="close-tooltip"><i class="fas fa-times"></i></button>
      </div>
      <div class="comment-content">${comment}</div>
      <div class="comment-actions">
        <button class="edit-comment">Edit</button>
        <button class="delete-comment">Delete</button>
      </div>
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

  setupEventListeners() {
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
          this.executeCommand(command);
        });
      });

    // Heading select
    document.getElementById("headingSelect").addEventListener("change", (e) => {
      this.formatBlock(e.target.value);
    });

    // Text color
    document.getElementById("textColor").addEventListener("input", (e) => {
      document.execCommand("foreColor", false, e.target.value);
    });

    // Add block button
    document.getElementById("addBlockBtn").addEventListener("click", () => {
      this.addNewBlock();
    });

    // View source button
    document.getElementById("viewSourceBtn").addEventListener("click", () => {
      this.toggleSourceView();
    });

    // Save button
    document.getElementById("saveNoteBtn").addEventListener("click", () => {
      this.saveNote();
    });

    // Auto-save on content changes
    this.editor.addEventListener("input", () => {
      this.scheduleAutoSave();
    });

    this.editor.addEventListener("paste", () => {
      this.scheduleAutoSave();
    });

    // Handle keyboard shortcuts
    this.editor.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.handleEnterKey(e);
      }
      if (e.key === "/" && !e.shiftKey) {
        this.showBlockMenu(e);
      }
    });
  }

  executeCommand(command, value = null) {
    document.execCommand(command, false, value);
    this.editor.focus();
  }

  formatBlock(tag) {
    document.execCommand("formatBlock", false, `<${tag}>`);
  }

  addNewBlock() {
    const block = document.createElement("div");
    block.className = "block";
    block.contentEditable = true;
    block.innerHTML = "<p>New block</p>";

    // Get current selection and find closest block
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const currentBlock =
      range.startContainer.closest(".block") ||
      range.startContainer.parentElement.closest(".block");

    if (currentBlock) {
      // Insert after current block
      currentBlock.after(block);
    } else {
      // If no current block found, append to editor
      this.editor.appendChild(block);
    }

    // Focus the new block
    block.focus();
  }

  handleEnterKey(e) {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const currentBlock = range.startContainer.parentElement.closest(".block");

    if (currentBlock) {
      const isEmpty = currentBlock.textContent.trim() === "";
      if (isEmpty) {
        e.preventDefault();
        this.addNewBlock();
      }
    }
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
      const notes = await this.apiRequest("GET", "/notes");
      if (!notes.error) {
        // Check for default note
        const defaultNote = notes.find((note) => note.title === "default_note");
        if (!defaultNote) {
          // Create default note if it doesn't exist
          const result = await this.apiRequest("POST", "/notes", {
            note_id: "default_note_" + currentUser.userId,
            title: "default_note",
            content: "<p>Welcome to your default note!</p>",
            folder_id: "1733485657799jj0.5911120915160637",
          });
          if (result.success) {
            await this.loadNotes();
            await this.loadNote("default_note_" + currentUser.userId);
          }
        } else {
          // Load notes and then load the default note
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

  async loadNotes(folderId = null) {
    const endpoint = folderId ? `/folders/${folderId}/notes` : "/notes";
    const notes = await this.apiRequest("GET", endpoint);
    if (Array.isArray(notes)) {
      const pagesList = document.getElementById("pagesList");
      pagesList.innerHTML = "";
      notes.forEach((note) => {
        const noteElement = document.createElement("div");
        noteElement.className = "page-item";
        noteElement.textContent = note.title || "Untitled Note";
        noteElement.onclick = () => this.loadNote(note.note_id);
        pagesList.appendChild(noteElement);
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
      content: "<p>Start writing here...</p>",
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
      spanText.textContent = "Saving...";

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
    this.editor.innerHTML = "<p>Start writing here...</p>";
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
}

// Initialize the editor and load folders
document.addEventListener("DOMContentLoaded", async () => {
  window.editor = new NotionEditor();
  await window.editor.loadFolders();
});
