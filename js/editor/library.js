import { currentUser } from "../state.js";

export const libraryMethods = {

  showNewFolderInput() {
    const inputContainer = document.querySelector(".folder-input-container");
    const input = document.getElementById("newFolderInput");
    inputContainer.style.display = "flex";
    input.value = "";
    input.focus();
  },

  hideNewFolderInput() {
    const inputContainer = document.querySelector(".folder-input-container");
    inputContainer.style.display = "none";
  },

  async createFolder() {
    const input = document.getElementById("newFolderInput");
    let folderName = input.value.trim();

    if (!folderName) {
      alert("Please enter a folder name");
      return;
    }

    // Replace spaces with underscores
    folderName = folderName.replace(/\s+/g, '_');

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
  },

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
                        <div class="folder-count">${' '
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
  },

  async loadNotes(folderId = "1733485657799jj0.5911120915160637") {
    try {
      // First try to get from cache
      const cache = await caches.open('folders-cache');
      const cachedResponse = await cache.match(`folder-${folderId}`);
      let cachedNotes = null;

      if (cachedResponse) {
        cachedNotes = await cachedResponse.json();
        // Update UI with cached data first
        this.updateNotesList(cachedNotes, folderId);
        console.log('Loaded notes from cache');
      }

      // Then fetch from remote
      const notes = await this.apiRequest("GET", `/folders/${folderId}/notes`);

      if (Array.isArray(notes)) {
        // Check if remote data is different from cache
        if (!cachedNotes || JSON.stringify(notes) !== JSON.stringify(cachedNotes)) {
          // Update UI with remote data
          this.updateNotesList(notes, folderId);

          // Update cache
          await cache.put(
            `folder-${folderId}`,
            new Response(JSON.stringify(notes))
          );
          console.log('Updated notes from remote and cached');
        }
      } else if (!cachedNotes) {
        // If remote fails and no cache, show error
        console.error("Failed to load notes");
        this.showToast('Failed to load notes');
      }
    } catch (error) {
      console.error('Error loading notes:', error);
      this.showToast('Error loading notes');
    }
  },

  updateNotesList(notes, folderId) {
    const pagesList = document.getElementById("pagesList");
    pagesList.innerHTML = "";

    notes.forEach((note) => {
      if (note.folder_id === folderId) {
        const noteElement = document.createElement("div");
        noteElement.className = "page-item";
        noteElement.textContent = note.title || "Untitled";
        noteElement.onclick = () => this.loadNote(note.note_id);
        pagesList.appendChild(noteElement);
      }
    });
  },

  async loadNote(note_id) {
    this.saveNote();
    console.log('Loading note:', note_id);
    // Break history continuity when switching notes
    this.initializeHistory();
    try {
      // First try to get from cache
      const cachedNote = await this.getNoteFromCache(note_id);
      if (cachedNote) {
        // Update UI with cached data
        this.updateNoteUI(cachedNote);
        console.log('Loaded note from cache');
      }

      // Then fetch from remote
      const note = await this.apiRequest("GET", `/notes/${note_id}`);
      if (note && !note.error) {
        // Check if remote content is different from cache
        if (!cachedNote ||
          note.content !== cachedNote.content ||
          note.last_updated !== cachedNote.last_updated) {



          // Update cache
          await this.updateNoteCache(note_id, note);
          console.log('Updated note from remote and cached');

          //check if currentnote id changed
          if (this.currentNoteId !== note.note_id) {
            console.log('currentNoteId changed, skipping update');
            return;
          }
          // Update UI with remote data
          this.updateNoteUI(note);


        }
      } else {
        console.error("Failed to load note:", note.error);
        // If remote fails but we have cache, keep using cache
        if (!cachedNote) {
          this.showToast('Failed to load note');
        }
      }
    } catch (error) {
      console.error('Error loading note:', error);
      this.showToast('Error loading note');
    }
  },

  async getNoteFromCache(note_id) {
         try {
       const cache = await caches.open('notes-cache');
       const response = await cache.match(`note-${note_id}`);
       if (response) {
         const data = await response.json();
         // After reading from cache, ensure controls are attached if content will be used
         setTimeout(() => this.ensureGroupControls(), 0);
         return data;
       }
       return null;
     } catch (error) {
       console.error('Error reading from cache:', error);
       return null;
     }
  },

  async updateNoteCache(note_id, note) {
    try {
      const cache = await caches.open('notes-cache');
      const response = new Response(JSON.stringify(note));
      await cache.put(`note-${note_id}`, response);
    } catch (error) {
      console.error('Error updating cache:', error);
    }
  },

  attachGroupControls(groupEl) {
    try {
            if (!groupEl) return;
      // If controls already exist (e.g., after reload), remove them so we can reattach fresh listeners
      const existingControls = groupEl.querySelector('.group-controls');
      if (existingControls) existingControls.remove();
      // Position container so controls are anchored to this block
      if (getComputedStyle(groupEl).position === 'static') groupEl.style.position = 'relative';
 
      const controls = document.createElement('div');
      controls.className = 'group-controls';
      controls.setAttribute('contenteditable', 'false');
      controls.style.position = 'absolute';
      controls.style.top = '6px';
      controls.style.right = '8px';
      controls.style.display = 'flex';
      controls.style.gap = '6px';
      controls.style.background = 'transparent';
      controls.style.border = 'none';
      controls.style.borderRadius = '8px';
      controls.style.padding = '0';
      controls.style.boxShadow = 'none';

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.innerHTML = '<span aria-label="Edit" title="Edit" style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;">✏️</span>';
      toggleBtn.style.cursor = 'pointer';
      toggleBtn.style.border = 'none';
      toggleBtn.style.background = 'transparent';
      toggleBtn.style.padding = '0';
      toggleBtn.style.fontSize = '14px';

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.innerHTML = '<span aria-label="Delete" title="Delete" style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;">🗑️</span>';
      deleteBtn.style.cursor = 'pointer';
      deleteBtn.style.border = 'none';
      deleteBtn.style.background = 'transparent';
      deleteBtn.style.padding = '0';
      deleteBtn.style.color = '#b91c1c';
      deleteBtn.style.fontSize = '14px';

      // Toggle editability
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isEditable = groupEl.getAttribute('contenteditable') === 'true';
        if (isEditable) {
          groupEl.setAttribute('contenteditable', 'false');
          toggleBtn.innerHTML = '<span aria-label="Edit" title="Edit" style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;">✏️</span>';
        } else {
          groupEl.setAttribute('contenteditable', 'true');
          toggleBtn.innerHTML = '<span aria-label="Lock" title="Lock" style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;">🔒</span>';
          groupEl.focus();
        }
      });

      // Delete whole block
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ok = confirm('Delete this AI response block?');
        if (ok) {
          const prev = groupEl.previousSibling;
          const next = groupEl.nextSibling;
          if (prev && prev.nodeName === 'BR') prev.remove();
          if (next && next.nodeName === 'BR') next.remove();
          groupEl.remove();
          this.delayedSaveNote();
        }
      });

      controls.appendChild(toggleBtn);
      controls.appendChild(deleteBtn);
      groupEl.appendChild(controls);

      // Mark that controls have been attached
      groupEl.dataset.controlsAttached = '1';
    } catch (err) {
      console.error('attachGroupControls error', err);
    }
  },

  ensureGroupControls() {
         try {
       const groups = this.editor.querySelectorAll('.ask-group, .comment-group');
       groups.forEach((g) => this.attachGroupControls(g));
       // Also watch for newly inserted groups
       const obs = new MutationObserver((mutations) => {
         for (const m of mutations) {
           m.addedNodes.forEach((node) => {
             if (!(node instanceof HTMLElement)) return;
             if (node.classList && (node.classList.contains('ask-group') || node.classList.contains('comment-group'))) {
               this.attachGroupControls(node);
             }
             node.querySelectorAll && node.querySelectorAll('.ask-group, .comment-group').forEach((el) => this.attachGroupControls(el));
           });
         }
       });
       obs.observe(this.editor, { childList: true, subtree: true });

      // Ensure a default active tab + content is visible
      groups.forEach((g) => {
        const isAsk = g.classList.contains('ask-group');
        const tabsSel = isAsk ? '.ask-tabs' : '.comment-tabs';
        const contentSel = isAsk ? '.ask-content' : '.comment-content';
        const wrapSel = isAsk ? '.ask-contents' : '.comment-contents';
        const tabsBar = g.querySelector(tabsSel);
        const contentsWrap = g.querySelector(wrapSel);
        if (!tabsBar || !contentsWrap) return;

        // Normalize any existing legacy-styled buttons
        tabsBar.querySelectorAll('button[data-model]').forEach(b => {
          b.classList.add('model-tab');
          b.removeAttribute('style');
        });
        const buttons = Array.from(tabsBar.querySelectorAll('button[data-model]'));
        const anyActive = buttons.some(b => b.classList.contains('active'));
        if (!anyActive && buttons.length > 0) {
          const first = buttons[0];
          buttons.forEach(b => { b.classList.remove('active'); });
          first.classList.add('active');
          const model = first.getAttribute('data-model');
          contentsWrap.querySelectorAll(contentSel).forEach(c => (c.style.display = 'none'));
          const target = contentsWrap.querySelector(`${contentSel}[data-model="${model}"]`);
          if (target) target.style.display = 'block';
        }
      });
    } catch (err) {
      console.error('ensureGroupControls error', err);
    }
  },

  addToRecentNotes(noteId, noteTitle) {
    // Get existing recent notes from localStorage
    let recentNotes = JSON.parse(localStorage.getItem('recentNotes') || '[]');

    // Remove the note if it already exists
    recentNotes = recentNotes.filter(note => note.id !== noteId);

    // Add the new note to the beginning
    recentNotes.unshift({
      id: noteId,
      title: noteTitle,
      timestamp: new Date().toISOString()
    });

    // Keep only the last 30 notes
    recentNotes = recentNotes.slice(0, 30);

    // Save back to localStorage
    localStorage.setItem('recentNotes', JSON.stringify(recentNotes));

    // Update the UI
    this.updateRecentNotesUI();
  },

  updateRecentNotesUI() {
    // Get recent notes from localStorage
    const recentNotes = JSON.parse(localStorage.getItem('recentNotes') || '[]');
    const recentContainer = document.getElementById('recentNotes');

    if (!recentContainer) return;

    // Clear existing recent notes UI
    recentContainer.innerHTML = '';

    // Filter out current note from display
    const filteredNotes = recentNotes.filter(note => note.id !== this.currentNoteId);

    // Split into primary (up to 3) and overflow
    const primaryNotes = filteredNotes.slice(0, 2);
    const overflowNotes = filteredNotes.slice(0, 30);

    // Container for left-side visible tabs
    const tabsWrap = document.createElement('div');
    tabsWrap.className = 'recent-tabs-wrap';
    recentContainer.appendChild(tabsWrap);

    const makeNoteEl = (note) => {
      const noteEl = document.createElement('span');
      noteEl.className = 'recent-note';
      noteEl.setAttribute('data-note-id', note.id);
      noteEl.textContent = note.title;
      noteEl.title = new Date(note.timestamp).toLocaleString();
      noteEl.addEventListener('click', () => {
        // Store current note before switching
        if (this.currentNoteId && this.currentNoteTitle) {
          this.addToRecentNotes(this.currentNoteId, this.currentNoteTitle);
        }
        this.loadNote(note.id);
      });
      return noteEl;
    };

    primaryNotes.forEach(n => tabsWrap.appendChild(makeNoteEl(n)));

    // Build overflow dropdown if needed
    if (overflowNotes.length > 0) {
      const dd = document.createElement('div');
      dd.className = 'recent-dropdown';

      const btn = document.createElement('button');
      btn.className = 'recent-dropdown-btn';
      btn.type = 'button';
      btn.textContent = `(${overflowNotes.length}) ▾`;

      const menu = document.createElement('div');
      menu.className = 'recent-dropdown-menu';

      overflowNotes.forEach(n => {
        const item = document.createElement('div');
        item.className = 'recent-dropdown-item';
        item.textContent = n.title;
        item.title = new Date(n.timestamp).toLocaleString();
        item.addEventListener('click', () => {
          if (this.currentNoteId && this.currentNoteTitle) {
            this.addToRecentNotes(this.currentNoteId, this.currentNoteTitle);
          }
          this.loadNote(n.id);
          menu.style.display = 'none';
        });
        menu.appendChild(item);
      });

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = menu.style.display === 'block';
        menu.style.display = isOpen ? 'none' : 'block';
      });

      // Global outside-click closer (install once)
      if (!this._boundCloseRecentDropdown) {
        this._boundCloseRecentDropdown = (e) => {
          document.querySelectorAll('.recent-dropdown-menu').forEach(m => {
            const host = m.parentElement;
            if (host && !host.contains(e.target)) {
              m.style.display = 'none';
            }
          });
        };
        document.addEventListener('click', this._boundCloseRecentDropdown, true);
      }

      dd.appendChild(btn);
      dd.appendChild(menu);
      recentContainer.append(dd);
    }
  },

  async createNewNote(folderId = null) {
    let title = prompt("Enter note title:");
    if (!title) return;

    // Replace spaces with underscores
    title = title.replace(/\s+/g, '_');

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
  },

  toggleSidebar() {
    const sidebar = document.querySelector(".sidebar");
    const mainContent = document.querySelector(".main-content");
    const editor = document.querySelector(".editor");

    if (sidebar && mainContent) {
      sidebar.classList.toggle("hidden");
    }
  },

  async loadFolderContents(folderId, folderElement) {
    // Check if content already exists in DOM
    let contentContainer = folderElement.nextElementSibling;
    if (contentContainer && contentContainer.classList.contains("folder-contents")) {
      contentContainer.remove();
      folderElement.classList.remove("open");
      return;
    }

    folderElement.classList.add("open");

    // Create container for folder contents
    contentContainer = document.createElement("div");
    contentContainer.className = "folder-contents";

    try {
      // First try to get from cache
      const cache = await caches.open('folders-cache');
      const cachedResponse = await cache.match(`folder-${folderId}`);
      let cachedData = null;

      if (cachedResponse) {
        cachedData = await cachedResponse.json();
        // Render cached data first
        this.renderFolderContents(cachedData.notes, cachedData.folders, contentContainer);
        // Insert content container after the folder element
        folderElement.after(contentContainer);
      }

      // Then fetch from remote
      const [notes, folders] = await Promise.all([
        this.apiRequest("GET", `/folders/${folderId}/notes`),
        this.apiRequest("GET", `/folders/${folderId}/contents`)
      ]);

      const remoteData = { notes, folders };

      // Check if remote data is different from cache
      if (!cachedData || JSON.stringify(remoteData) !== JSON.stringify(cachedData)) {
        // Update cache
        await cache.put(
          `folder-${folderId}`,
          new Response(JSON.stringify(remoteData))
        );

        // Update UI with new data
        contentContainer.innerHTML = ''; // Clear existing content
        this.renderFolderContents(notes, folders, contentContainer);

        if (!cachedData) {
          // If there was no cached data, insert container now
          folderElement.after(contentContainer);
        }
      }

    } catch (error) {
      console.error('Error loading folder contents:', error);
      if (!contentContainer.hasChildNodes()) {
        contentContainer.innerHTML = '<div class="error">Error loading contents</div>';
        folderElement.after(contentContainer);
      }
    }
  },

  renderFolderContents(notes, folders, container) {
    // Render notes
    if (Array.isArray(notes)) {
      notes.forEach((note) => {
        const noteElement = document.createElement("div");
        noteElement.className = "page-item folder-note";
        noteElement.innerHTML = `
          <i class="fas fa-file-alt"></i>
          <span>${note.title || "Untitled"}</span>
        `;
        noteElement.onclick = () => this.loadNote(note.note_id);
        container.appendChild(noteElement);
      });
    }

    // Render folders
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

        container.appendChild(subFolderElement);
      });
    }
  },

  setupTableOfContents() {
    const tocBtn = document.getElementById('toggleTocBtn');
    const tocList = document.getElementById('tocList');

    tocBtn.addEventListener('click', () => {
      const isHidden = tocList.style.display === 'none';
      tocList.style.display = isHidden ? 'block' : 'none';
      this.updateTableOfContents();
    });
  },

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
        heading.scrollIntoView({ behavior: 'instant', block: 'start', inline: 'start' });
        setTimeout(() => {
          editor.editor.scrollLeft = 0;
        }, 100);
      });

      tocList.appendChild(tocItem);
    });
  }

};
