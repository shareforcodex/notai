import { base64ToBlob } from "../utils.js";



export const noteMethods = {

  idleSync() {

    let idleTime = Date.now() - this.lastInteractionTime || 0;
    console.log('idelTime ', idleTime, this.lastInteractionTime);

    if (idleTime > 30000) {
      this.saveNote();
    }
    // Update last interaction time
    this.lastInteractionTime = Date.now();

  },

  delayedSaveNote() {
    console.log('delayedSaveNote() start ');

    clearTimeout(this.autoSaveTimeout);
    this.autoSaveTimeout = setTimeout(() => {
      console.log('delayedSaveNote saveNote() start ');

      this.saveNote();
    }, 10000);
  },

  async saveNote(isAutoSave = false) {
    if (!this.currentNoteId) {
      return;
    }

    // Get current title from the title element
    const currentTitle = document.getElementById("noteTitle").textContent.trim() || "Untitled";
    this.currentNoteTitle = currentTitle;
    let targetNoteId = this.currentNoteId;
    let targetNotecontent = this.editor.innerHTML;
    let targetlastUpdated = this.lastUpdated;

    const saveBtn = document.getElementById("saveNoteBtn");
    const saveIcon = saveBtn.querySelector(".fa-save");
    const spinnerIcon = saveBtn.querySelector(".fa-spinner");
    const spanText = saveBtn.querySelector("span");


    try {
      // Show spinner, hide save icon
      saveIcon.style.display = "none";
      spinnerIcon.style.display = "inline-block";
      spanText.textContent = " ";

      // Fetch current note from server to check last_updated
      const currentNote = await this.apiRequest("GET", `/notes/${this.currentNoteId}`, null, false, true);
      //compare content, if same return
      if (currentNote && currentNote.content === this.editor.innerHTML) {
        // Show saved state
        spinnerIcon.style.display = "none";
        saveIcon.style.display = "inline-block";
        spanText.textContent = "";

        return;
      }
      // Server has newer version - load it
      //need convert last_updated to number to compare, the last_updated is string like 2025-01-01 02:25:51
      if (currentNote && new Date(currentNote.last_updated).getTime() > new Date(targetlastUpdated).getTime()) {
        //if user change to anothe note , do nothing
        if (this.currentNoteId !== currentNote.note_id) {
          return;
        }
        this.editor.innerHTML = currentNote.content;
        document.getElementById("noteTitle").textContent = currentNote.title;
        this.lastUpdated = currentNote.last_updated;
        //log why update this.lastupdated
        console.log('saveNote() note from the server is newer currentNote.last_updated:', currentNote.last_updated);
        this.currentNoteTitle = currentNote.title;

        // Show saved state
        spinnerIcon.style.display = "none";
        saveNoteBtn.querySelector('.fa-save').style.display = "none";
        spanText.textContent = "⌄";

        return;
      }




      const result = await this.apiRequest("POST", `/notes`, {
        note_id: targetNoteId,
        content: targetNotecontent,
        title: currentTitle,
      }, false, true);

      if (result.success) {
        // Update last_updated timestamp after successful save
        const updatedNote = await this.apiRequest("GET", `/notes/${this.currentNoteId}`, null, false, true);
        if (updatedNote) {
          this.lastUpdated = updatedNote.last_updated;
        }

        // Show saved state
        spinnerIcon.style.display = "none";
        saveIcon.style.display = "inline-block";
        spanText.textContent = "^";
        saveNoteBtn.querySelector('.fa-save').style.display = "none";


      } else {
        // Show error state
        spinnerIcon.style.display = "none";
        saveIcon.style.display = "inline-block";
        spanText.textContent = "Error saving";
        setTimeout(() => {
          spanText.textContent = "";
        }, 2000);
      }
    } catch (error) {
      console.error("Save error:", error);
      // Show error state
      spinnerIcon.style.display = "none";
      saveIcon.style.display = "inline-block";
      spanText.textContent = "Error saving";
      setTimeout(() => {
        spanText.textContent = "";
      }, 2000);
    }
  },

  clearNotes() {
    document.getElementById("pagesList").innerHTML = "";
    this.editor.innerHTML = "Start writing here...>";
  },

  cleanNote() {
    //check all img and audio, video tags, if src is base64, upload to server and replace src with url
    let mediaElements = this.editor.querySelectorAll('img, audio, video');
    mediaElements.forEach(async element => {
      let src = element.src;
      if (src.startsWith('data:')) {
        let type = src.split(';')[0].split(':')[1];
        let data = src.split(',')[1];
        let blob = base64ToBlob(src);
        let file = new File([blob], `media.${type.split('/')[1]}`, { type });
        let url = await this.uploadFile(file, false, false);
        if(url){
          element.src = url;

        }
      }
      //if src start with blob, upload to server and replace src with url
      if (src.startsWith('blob:')) {
        this.showToast('cleaning media,blob url');

        try {
          let type = 'image/jpeg';
          //set type from src file extension
          if (src.endsWith('.png')) {
            type = 'image/png';
          }
          if (src.endsWith('.jpg')) {
            type = 'image/jpeg';
          }
          if (src.endsWith('.jpeg')) {
            type = 'image/jpeg';
          }
          if (src.endsWith('.gif')) {
            type = 'image/gif';
          }
          if (src.endsWith('.webp')) {

            type = 'image/webp';
          }
          if (src.endsWith('.mp4')) {
            type = 'video/mp4';
          }
          if (src.endsWith('.webm')) {
            type = 'video/webm';
          }
          if (src.endsWith('.ogg')) {
            type = 'video/ogg';
          }
          if (src.endsWith('.mp3')) {
            type = 'audio/mp3';
          }
          if (src.endsWith('.wav')) {
            type = 'audio/wav';
          }

          function blobUrlToBlob(blobUrl) {
            return new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('GET', blobUrl, true);
              xhr.responseType = 'blob';

              xhr.onload = function () {
                if (this.status === 200) {
                  resolve(this.response);
                } else {
                  reject(new Error(`Failed to convert blob URL to blob: ${this.status}`));
                }
              };

              xhr.onerror = function () {
                reject(new Error('XHR error while converting blob URL to blob'));
              };

              xhr.send();
            });
          }
          let blob = await blobUrlToBlob(src);
          let file = new File([blob], `media.${type.split('/')[1]}`, { type });
          let url = await this.uploadFile(file, false, false);
          if (url) {
            element.src = url;
            // element.after(document.createTextNode(url));
          }

        } catch (error) {
          console.error('error cleaning blob url', error);
          this.showToast('error cleaning blob url' + error.toString());

        }

      }
    });
  },

  initializeHistory() {
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 100;
    this.lastInputTime = 0;
    this.lastInputType = '';
  },

  resetHistoryWithCurrentContent() {
    this.undoStack = [];
    this.redoStack = [];
    this.recordSnapshot('init');
  },

  getNodePathFromRoot(node, root) {
    const path = [];
    let current = node;
    while (current && current !== root) {
      const parent = current.parentNode;
      if (!parent) break;
      const index = Array.prototype.indexOf.call(parent.childNodes, current);
      path.unshift(index);
      current = parent;
    }
    return path;
  },

  getNodeByPath(path, root) {
    let current = root;
    for (const index of path) {
      if (!current || !current.childNodes || !current.childNodes[index]) return null;
      current = current.childNodes[index];
    }
    return current || null;
  },

  captureSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }
    const range = selection.getRangeAt(0);
    const startPath = this.getNodePathFromRoot(range.startContainer, this.editor);
    const endPath = this.getNodePathFromRoot(range.endContainer, this.editor);
    return {
      startPath,
      startOffset: range.startOffset,
      endPath,
      endOffset: range.endOffset,
    };
  },

  restoreSelection(saved) {
    try {
      if (!saved) return;
      const startNode = this.getNodeByPath(saved.startPath, this.editor);
      const endNode = this.getNodeByPath(saved.endPath, this.editor);
      if (!startNode || !endNode) throw new Error('selection nodes not found');
      const range = document.createRange();
      range.setStart(startNode, Math.min(saved.startOffset ?? 0, startNode.nodeType === Node.TEXT_NODE ? (startNode.nodeValue?.length || 0) : (startNode.childNodes?.length || 0)));
      range.setEnd(endNode, Math.min(saved.endOffset ?? 0, endNode.nodeType === Node.TEXT_NODE ? (endNode.nodeValue?.length || 0) : (endNode.childNodes?.length || 0)));
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (_) {
      // Fallback: place caret at end
      const selection = window.getSelection();
      const range = document.createRange();
      if (this.editor.lastChild) {
        const endNode = this.editor.lastChild;
        if (endNode.nodeType === Node.TEXT_NODE) {
          range.setStart(endNode, endNode.nodeValue?.length || 0);
        } else {
          range.selectNodeContents(endNode);
          range.collapse(false);
        }
      } else {
        range.selectNodeContents(this.editor);
        range.collapse(false);
      }
      selection.removeAllRanges();
      selection.addRange(range);
    }
  },

  recordSnapshot(reason = '') {
    if (!this.editor) return;
    const currentContent = this.editor.innerHTML;
    const last = this.undoStack[this.undoStack.length - 1];
    if (last && last.content === currentContent) return; // avoid duplicates

    const snapshot = {
      content: currentContent,
      selection: this.captureSelection(),
      reason,
      ts: Date.now(),
    };
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    // New action invalidates redo stack
    this.redoStack = [];
  },

  undo() {
    if (!this.undoStack || this.undoStack.length <= 1) return; // need prior state
    const current = this.undoStack.pop();
    const previous = this.undoStack[this.undoStack.length - 1];
    if (!previous) return;
    // Push current to redo
    this.redoStack.push(current);
    // Restore previous
    this.editor.innerHTML = previous.content;
    this.restoreSelection(previous.selection);
    // Save after undo to cache/save system but avoid creating a new history entry
    this.delayedSaveNote();
  },

  redo() {
    if (!this.redoStack || this.redoStack.length === 0) return;
    const next = this.redoStack.pop();
    // Push current to undo
    const currentSnapshot = { content: this.editor.innerHTML, selection: this.captureSelection(), reason: 'pre-redo', ts: Date.now() };
    this.undoStack.push(currentSnapshot);
    // Apply redo state
    this.editor.innerHTML = next.content;
    this.restoreSelection(next.selection);
    // Save after redo
    this.delayedSaveNote();
  }

};
