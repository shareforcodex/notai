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
    this.setupEventListeners();
    this.setupAIToolbar();

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
    document.addEventListener("selectionchange", () => {
      const selection = window.getSelection();
      if (!selection.isCollapsed && selection.toString().trim()) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Position the toolbar below the selection
        this.aiToolbar.style.top = `${rect.bottom + window.scrollY + 10}px`;
        this.aiToolbar.style.left = `${rect.left + window.scrollX}px`;
        this.aiToolbar.classList.add("visible");
      } else {
        this.aiToolbar.classList.remove("visible");
      }
    });

    // Handle AI action buttons
    this.aiToolbar.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.dataset.aiAction;
        const selectedText = window.getSelection().toString().trim();
        await this.handleAIAction(action, selectedText);
      });
    });
  }

  async handleAIAction(action, text) {
    let prompt = "";
    switch (action) {
      case "ask":
        prompt = `Answer this question: ${text}`;
        break;
      case "correct":
        prompt = `Correct any grammar or spelling errors in this text: ${text}`;
        break;
      case "translate":
        prompt = `Translate this text to English: ${text}`;
        break;
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
          max_tokens: 8000,
          top_p: 1,
        },
        true
      )
    );

    const responses = await Promise.all(requests);

    // Get the current block where selection is
    const selection = window.getSelection();
    const currentBlock = selection.anchorNode.parentElement.closest(".block");
    
    // Create blocks for responses in reverse order to maintain correct ordering
    responses.reverse().forEach((response, index) => {
      if (response.choices && response.choices[0]) {
        const modelName = selectedModels[selectedModels.length - 1 - index];
        const aiResponse = response.choices[0].message.content;

        // Create a new block with the AI response
        const block = document.createElement("div");
        block.className = "block";
        block.innerHTML = `<p><strong>AI ${action} (${modelName}):</strong> ${aiResponse}</p>`;

        // Insert after the current block
        if (currentBlock) {
          currentBlock.after(block);
        } else {
          this.editor.appendChild(block);
        }
      }
    });

    // Hide the toolbar
    this.aiToolbar.classList.remove("visible");
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
    const passwordHash = btoa(password); // Simple base64 encoding for demo
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
