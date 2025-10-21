import { insertTextAtCursor, underlineSelectedText } from "../utils.js";

export const eventMethods = {
  async setupEventListeners() {
    try {
      // Auto-save on user interactions
      document.body.addEventListener('pointerdown', () => this.idleSync());
      document.body.addEventListener('keypress', () => this.idleSync());

      // Delegated tab switching for ask/comment groups (works after reload)
      this.editor.addEventListener('click', (e) => {
        const btn = e.target.closest && e.target.closest('.ask-tabs button, .comment-tabs button');
        if (!btn || !this.editor.contains(btn)) return;
        const group = btn.closest('.ask-group, .comment-group');
        if (!group) return;
        const isAsk = group.classList.contains('ask-group');
        const tabsBar = btn.parentElement;
        const contentsWrap = group.querySelector(isAsk ? '.ask-contents' : '.comment-contents');
        const contentSel = isAsk ? '.ask-content' : '.comment-content';
        const model = btn.getAttribute('data-model');

        // update buttons
        tabsBar.querySelectorAll('button').forEach(b => { b.classList.remove('active'); });
        btn.classList.add('active');

        // show target content
        if (contentsWrap) {
          contentsWrap.querySelectorAll(contentSel).forEach(c => (c.style.display = 'none'));
          const target = contentsWrap.querySelector(`${contentSel}[data-model="${model}"]`);
          if (target) target.style.display = 'block';
        }
      }, true);

             // Allow dropdowns to re-open after mouse leaves the toolbar
       if (this.toolbar) {
         this.toolbar.addEventListener('mouseleave', () => {
           this.toolbar.classList.remove('dropdowns-locked');
         });
         // Also unlock when user clicks any dropdown toggle button
         this.toolbar.addEventListener('click', (e) => {
           if (e.target.closest && e.target.closest('.dropdown .dropbtn')) {
             this.toolbar.classList.remove('dropdowns-locked');
           }
         }, true);
       }

       // Get all required elements
       const uploadModal = document.getElementById('uploadModal');
      const uploadFileBtn = document.getElementById('uploadFileBtn');
      const closeUploadBtn = uploadModal?.querySelector('.close');
      const fileInput = document.getElementById('fileInput');
      const selectFileBtn = document.getElementById('selectFileBtn');
      const uploadBtn = document.getElementById('uploadBtn');
      const previewArea = document.getElementById('previewArea');
      const filePreview = document.getElementById('filePreview');
      const capturePhotoBtn = document.getElementById('capturePhotoBtn');
      const captureVideoBtn = document.getElementById('captureVideoBtn');
      const captureAudioBtn = document.getElementById('captureAudioBtn');
      const stopRecordingBtn = document.getElementById('stopRecordingBtn');
      const videoDevices = document.getElementById('videoDevices');
      const audioDevices = document.getElementById('audioDevices');
      const quickAskBtn = document.getElementById('quickAskBtn');
      const addBlockBtn = document.getElementById('addBlockBtn');
      const viewSourceBtn = document.getElementById('viewSourceBtn');
      const toggleEditableBtn = document.getElementById('toggleEditableBtn');
      const saveNoteBtn = document.getElementById('saveNoteBtn');
      const plainTextBtn = document.getElementById('plainTextBtn');
      const toggleSidebarBtn = document.getElementById('toggleSidebar');
      const newPageBtn = document.getElementById('newPageBtn');
      const newFolderBtn = document.getElementById('newFolderBtn');
      const createFolderBtn = document.getElementById('createFolderBtn');
      const cancelFolderBtn = document.getElementById('cancelFolderBtn');
      const newFolderInput = document.getElementById('newFolderInput');
      const textColorInput = document.getElementById('textColor');
      const bgColorInput = document.getElementById('bgColor');
      const formatButtons = document.querySelectorAll('.formatting-tools button[data-command]');

      // Setup file upload and media capture handlers
              if (uploadModal && uploadFileBtn && closeUploadBtn &&
          fileInput && selectFileBtn && uploadBtn && previewArea && filePreview) {

          // Mobile-friendly Undo/Redo buttons in + insert dropdown
          const undoBtn = document.getElementById('undoBtn');
          const redoBtn = document.getElementById('redoBtn');
          if (undoBtn) undoBtn.addEventListener('click', () => this.undo());
          if (redoBtn) redoBtn.addEventListener('click', () => this.redo());

        uploadFileBtn.onclick = () => {
          uploadModal.style.display = 'block';
          previewArea.style.display = 'none';
          filePreview.innerHTML = '';
          this.setupMediaDevices();
        };

        closeUploadBtn.onclick = () => {
          uploadModal.style.display = 'none';
          // Stop all media tracks when closing modal
          const videoPreview = document.getElementById('videoPreview');
          if (videoPreview.srcObject) {
            videoPreview.srcObject.getTracks().forEach(track => track.stop());
          }
          this.stopMediaTracks();

        };

        if (captureVideoBtn) {
          captureVideoBtn.addEventListener('click', async () => {
            const deviceId = videoDevices.value;
            const audioDeviceId = audioDevices.value;
            if (!deviceId) {
              this.showToast('Please select a camera first');
              return;
            }
            if (!audioDeviceId) {
              this.showToast('Please select a microphone for video recording');
              return;
            }

            // If already recording, stop it
            if (this.currentMediaRecorder && this.currentMediaRecorder.state === 'recording') {
              this.currentMediaRecorder.stop();
              const videoPreview = document.getElementById('videoPreview');
              if (videoPreview.srcObject) {
                videoPreview.srcObject.getTracks().forEach(track => track.stop());
                videoPreview.style.display = 'none';
              }
              document.getElementById('mediaPreview').style.display = 'none';
              captureVideoBtn.innerHTML = '<i class="fas fa-video"></i> ';
              captureVideoBtn.style.backgroundColor = '#2ecc71';
              return;
            }

            // Start new recording with audio
            const stream = await this.startMediaStream(deviceId, true);
            if (stream) {
              // Add audio track from selected microphone
              try {
                const audioStream = await navigator.mediaDevices.getUserMedia({
                  audio: { deviceId: { exact: audioDeviceId } }
                });
                audioStream.getAudioTracks().forEach(track => {
                  stream.addTrack(track);
                });
              } catch (error) {
                console.error('Error adding audio track:', error);
                this.showToast('Error accessing microphone');
                stream.getTracks().forEach(track => track.stop());
                return;
              }

              const mediaRecorder = new MediaRecorder(stream, {
                mimeType: this.videoRecordType
              });
              const chunks = [];

              mediaRecorder.ondataavailable = e => chunks.push(e.data);
              mediaRecorder.onstop = async () => {
                const blob = new Blob(chunks, { type: this.videoRecordType });
                stream.getTracks().forEach(track => track.stop());

                // Create preview
                const videoPreview = document.createElement('video');
                videoPreview.controls = true;
                videoPreview.src = URL.createObjectURL(blob);
                const previewArea = document.getElementById('previewArea');
                const filePreview = document.getElementById('filePreview');
                previewArea.style.display = 'block';
                filePreview.innerHTML = '';
                filePreview.appendChild(videoPreview);

                // Create file for upload
                const file = new File([blob], 'video.' + this.videoRecordExt, { type: this.videoRecordType });
                document.getElementById('fileInput').files = new DataTransfer().files;
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                document.getElementById('fileInput').files = dataTransfer.files;

                // Reset button state
                captureVideoBtn.innerHTML = '<i class="fas fa-video"></i> ';
                captureVideoBtn.style.backgroundColor = '#2ecc71';
              };

              mediaRecorder.start();
              this.currentMediaRecorder = mediaRecorder;
              document.getElementById('mediaPreview').style.display = 'block';
              document.getElementById('videoPreview').style.display = 'block';

              // Update button to show recording state
              captureVideoBtn.innerHTML = '<i class="fas fa-stop"></i> ';
              captureVideoBtn.style.backgroundColor = '#e74c3c';
            }
          });
        }

        if (stopRecordingBtn) {
          stopRecordingBtn.addEventListener('click', () => {
            if (this.currentMediaRecorder && this.currentMediaRecorder.state === 'recording') {
              this.currentMediaRecorder.stop();
              document.getElementById('stopRecordingBtn').style.display = 'none';
              document.getElementById('audioRecordingControls').style.display = 'none';
              document.getElementById('captureAudioBtn').innerHTML = '<i class="fas fa-microphone"></i>';
              document.getElementById('captureAudioBtn').style.backgroundColor = '#2ecc71';
            }
          });
        }

        selectFileBtn.onclick = () => fileInput.click();

        // Handle file selection
        fileInput.onchange = async (e) => {
          const file = e.target.files[0];
          if (file) {
            await this.handleFileSelection(file, previewArea, filePreview);
          }
        };

        // Handle file upload
        uploadBtn.onclick = async () => {
          const file = fileInput.files[0];
          if (file) {
            await this.uploadFile(file, true, true);
            uploadModal.style.display = 'none';
          }
        };

        document
          .getElementById("insertIframe")
          .addEventListener("click", () => this.insertIframe());

        // Setup media capture handlers
        if (capturePhotoBtn) {
          capturePhotoBtn.addEventListener('click', async () => {
            const deviceId = videoDevices.value;
            if (!deviceId) {
              this.showToast('Please select a camera first');
              return;
            }
            const stream = await this.startMediaStream(deviceId);
            if (stream) {
              const videoPreview = document.getElementById('videoPreview');
              const shootPhotoBtn = document.getElementById('shootPhotoBtn');
              videoPreview.style.display = 'block';
              document.getElementById('mediaPreview').style.display = 'block';
              shootPhotoBtn.style.display = 'block';
              capturePhotoBtn.style.display = 'none';
            }
            globalDevices.mediaStream = stream;
          });
        }

        const shootPhotoBtn = document.getElementById('shootPhotoBtn');
        if (shootPhotoBtn) {
          shootPhotoBtn.addEventListener('click', async () => {
            const videoPreview = document.getElementById('videoPreview');
            if (videoPreview.srcObject) {
              const blob = await this.capturePhoto(videoPreview.srcObject);
              if (blob) {
                const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
                await this.handleFileSelection(file, previewArea, filePreview);
                shootPhotoBtn.style.display = 'none';
                capturePhotoBtn.style.display = 'block';
              }

              let stream = globalDevices.mediaStream;
              const tracks = stream.getTracks();
              // Stop each track
              tracks.forEach(track => {
                track.stop();
                console.log('Stopped track:', track.kind, track.id);
              });
              stream = null;
              globalDevices.mediaStream = null;




            }
          });
        }

        if (captureAudioBtn) {
          captureAudioBtn.addEventListener('click', async () => {
            const deviceId = audioDevices.value;
            const mediaRecorder = await this.startRecording(deviceId);
            if (mediaRecorder) {
              this.currentMediaRecorder = mediaRecorder;
            }
          });
        }

        if (stopRecordingBtn) {
          stopRecordingBtn.addEventListener('click', () => {
            if (this.currentMediaRecorder && this.currentMediaRecorder.state === 'recording') {
              this.currentMediaRecorder.stop();
              document.getElementById('stopRecordingBtn').style.display = 'none';
              document.getElementById('audioRecordingControls').style.display = 'none';
              document.getElementById('captureAudioBtn').innerHTML = '<i class="fas fa-microphone"></i>';
              document.getElementById('captureAudioBtn').style.backgroundColor = '#2ecc71';
            }
          });
        }
      }

      // Quick Ask button 
      if (quickAskBtn) {
        quickAskBtn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          //set quickaskbtn disabled and enable it after 5 seconds
          quickAskBtn.disabled = true;
          quickAskBtn.style.backgroundColor = '#ccc';
          setTimeout(() => {
            quickAskBtn.disabled = false;
            quickAskBtn.style.backgroundColor = '';
          }, 5000);

          this.handleQuickAsk();
        });
      }

      // Sidebar toggle
      if (toggleSidebarBtn) {
        toggleSidebarBtn.addEventListener('click', () => this.toggleSidebar());
      }

      // New page button
      if (newPageBtn) {
        newPageBtn.addEventListener('click', () => this.createNewNote());
      }

      // New folder button and related events
      if (newFolderBtn && createFolderBtn && cancelFolderBtn && newFolderInput) {
        newFolderBtn.addEventListener('click', () => this.showNewFolderInput());
        createFolderBtn.addEventListener('click', () => this.createFolder());
        cancelFolderBtn.addEventListener('click', () => this.hideNewFolderInput());
        newFolderInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            this.createFolder();
          } else if (e.key === 'Escape') {
            this.hideNewFolderInput();
          }
        });
      }

      // Format buttons
             formatButtons.forEach((button) => {
         button.addEventListener('click', () => {
           const command = button.dataset.command;
           if (command.startsWith('h')) {
             this.formatBlock(command);
           } else {
             this.executeCommand(command);
           }
           // Hide any open dropdowns after action
           this.hideAllDropdowns();
         });
       });

      // Text color
      if (textColorInput) {
        textColorInput.addEventListener('input', (e) => {
          document.execCommand('foreColor', false, e.target.value);
        });
      }

      // Background color
      if (bgColorInput) {
        bgColorInput.addEventListener('input', (e) => {
          document.execCommand('hiliteColor', false, e.target.value);
        });
      }

      // Add block button
      if (addBlockBtn) {
        addBlockBtn.addEventListener('click', () => {
          this.addNewBlock();
        });
      }

      // View source button
      if (viewSourceBtn) {
        viewSourceBtn.addEventListener('click', () => {
          this.toggleSourceView();
        });
      }

      // Toggle editable button
      if (toggleEditableBtn) {
        toggleEditableBtn.addEventListener('click', () => {
          this.toggleEditable();
        });
      }

      // Keyboard shortcuts for undo/redo
      this.editor.addEventListener('keydown', (e) => {
        // Cmd/Ctrl+Z => undo, Shift+Cmd/Ctrl+Z or Cmd/Ctrl+Y => redo
        const isMac = navigator.platform.toUpperCase().includes('MAC');
        const meta = isMac ? e.metaKey : e.ctrlKey;
        if (meta && !e.altKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
          e.preventDefault();
          this.undo();
          return;
        }
        if (meta && (!e.altKey) && (e.key.toLowerCase() === 'z' && e.shiftKey || e.key.toLowerCase() === 'y')) {
          e.preventDefault();
          this.redo();
          return;
        }
      });

      // Save button
      if (saveNoteBtn) {
        saveNoteBtn.addEventListener('click', async () => {
          try {
            await this.cleanNote();

            this.saveNote();


          } catch (error) {
            console.error('Error saving note:', error);

            this.saveNote();
          }



        });
      }

      // Plain text button
             if (plainTextBtn) {
         plainTextBtn.addEventListener('click', () => { this.convertToPlainText(); this.hideAllDropdowns(); });
       }

      // Auto-save on content changes
      if (this.editor) {

        // Fine-grained history via beforeinput to capture intent types
        this.editor.addEventListener('beforeinput', (e) => {
          // Types that should snapshot prior state
          const type = e.inputType || '';
          const now = Date.now();
          const typingTypes = new Set([
            'insertText', 'insertCompositionText'
          ]);
          const mergeableDelete = new Set([
            'deleteContentBackward', 'deleteContentForward'
          ]);
          const structuralTypes = new Set([
            'insertParagraph', 'insertLineBreak', 'insertFromPaste', 'insertFromPasteAsQuotation',
            'formatBold', 'formatItalic', 'formatUnderline', 'formatStrikeThrough',
            'formatBlock', 'formatRemove', 'historyUndo', 'historyRedo'
          ]);

          // Coalesce continuous typing/deleting within 1s; snapshot on boundary changes
          const shouldCoalesce = typingTypes.has(type) || mergeableDelete.has(type);
          const boundaryChange = type !== this.lastInputType || (now - this.lastInputTime) > 1000;
          if (shouldCoalesce && boundaryChange) {
            this.recordSnapshot('typing-start:' + type);
          } else if (!shouldCoalesce) {
            // Non-typing actions always snapshot before
            this.recordSnapshot('before:' + type);
          }
          this.lastInputType = type;
          this.lastInputTime = now;
        }, { capture: true });

        // Input: after DOM is mutated, ensure we have a post snapshot for structural edits
        this.editor.addEventListener('input', () => {

          clearTimeout(this.inputToUpdateLastUpdatedTimeoutID);
          this.inputToUpdateLastUpdatedTimeoutID= setTimeout(() => {
          this.lastUpdated = getCurrentTimeString();
          console.log(' this.editor.addEventListener input update this.lastupdated  :', this.lastUpdated);
            this.delayedSaveNote();
          this.updateTableOfContents();
          }, 5000);

          // For non-typing input or explicit structural changes, take a post snapshot
          // Detect lastInputType captured in beforeinput
          const structuralPostTypes = new Set([
            'insertParagraph', 'insertLineBreak', 'insertFromPaste', 'insertFromPasteAsQuotation'
          ]);
          if (structuralPostTypes.has(this.lastInputType)) {
            this.recordSnapshot('after:' + this.lastInputType);
          }
        });

        this.editor.addEventListener('paste', () => {
          this.delayedSaveNote();
          setTimeout(() => {
            this.cleanNote();

          }, 1000);
        });

        // Handle keyboard shortcuts
        this.editor.lastKey = null;
        let resetTimeout = null;
        let rect = { top: 0, left: 0 };
        this.editor.addEventListener('keydown', (e) => {
          //log rect
          console.log('rect', rect);

          // Prioritize quick ask on Cmd/Ctrl + Enter
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.handleQuickAsk();
            this.editor.lastKey = e.key;
            return;
          }

          // If Enter is pressed inside a heading (h1–h4) and the caret is at the end,
          // create a normal block after the heading and move the caret there.
          if (e.key === 'Enter') {
            const selection = window.getSelection();
            const anchorEl = selection && selection.anchorNode ? (selection.anchorNode.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode.parentElement) : null;

            // If we're inside a non-editable group (comment/ask), ignore custom enter behavior
            const nonEditableGroup = anchorEl && anchorEl.closest ? anchorEl.closest('.comment-group, .ask-group') : null;
            if (nonEditableGroup) {
              e.preventDefault();
              insertTextAtCursor('\n', 50);
              this.editor.lastKey = e.key;
              return;
            }

            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              const startNode = range.startContainer.nodeType === Node.ELEMENT_NODE
                ? range.startContainer
                : range.startContainer.parentElement;
              const heading = startNode && startNode.closest ? startNode.closest('h1,h2,h3,h4') : null;

              if (heading) {
                // Check if caret is at the end of the heading
                const endRange = document.createRange();
                endRange.selectNodeContents(heading);
                endRange.collapse(false);
                const atEndOfHeading = range.collapsed && range.compareBoundaryPoints(Range.START_TO_START, endRange) === 0;

                if (atEndOfHeading) {
                  e.preventDefault();
                  const newBlock = document.createElement('div');
                  newBlock.innerHTML = '<br>';
                  if (heading.nextSibling) {
                    heading.parentNode.insertBefore(newBlock, heading.nextSibling);
                  } else {
                    heading.parentNode.appendChild(newBlock);
                  }
                  const newRange = document.createRange();
                  newRange.setStart(newBlock, 0);
                  newRange.collapse(true);
                  selection.removeAllRanges();
                  selection.addRange(newRange);
                  this.editor.lastKey = e.key;
                  return;
                }
              }
            }

            // Default: inside normal blocks, just newline not new block
            e.preventDefault();
            // If caret is at the end of an inline formatted element (b/i/u/span/etc.),
            // break out of that element and insert a line break outside it
            try {
              const sel = window.getSelection();
              if (sel && sel.rangeCount) {
                const r = sel.getRangeAt(0);
                const node = r.startContainer.nodeType === Node.ELEMENT_NODE ? r.startContainer : r.startContainer.parentElement;
                const inline = node && node.closest ? node.closest('b,strong,i,em,u,mark,s,code,span[style]') : null;
                if (inline) {
                  const endR = document.createRange();
                  endR.selectNodeContents(inline);
                  endR.collapse(false);
                  const atEnd = r.collapsed && r.compareBoundaryPoints(Range.START_TO_START, endR) === 0;
                  if (atEnd) {
                    const br = document.createElement('br');
                    inline.parentNode.insertBefore(br, inline.nextSibling);
                    const after = document.createRange();
                    after.setStartAfter(br);
                    after.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(after);
                    // Clear active formatting for the new line
                    document.execCommand('removeFormat');
                    this.editor.lastKey = e.key;
                    return;
                  }
                }
              }
            } catch (_) {}

            insertTextAtCursor('\n', 50);
            try { document.execCommand('removeFormat'); } catch (_) {}

          } else {
            rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
            let button = document.querySelector('#quickAskBtn');

            button.style.top = '';
            button.style.left = '';

          }

          //check if ol already exist, if exist, remove it
          let ol = document.querySelector('.ai-input-shortcuts');
          if (ol) {
            ol.remove();
          }
          //if key is space and last key is space too, show the ai action as list, when click , insert each prompts
          if (e.key === ' ' && this.editor.lastKey === ' ') {

            ol = document.createElement('ul');
            ol.classList.add('ai-input-shortcuts');
            ol.style.position = 'fixed';
            //get current cursor location and set ol top and let
            let selection = window.getSelection();
            let range = selection.getRangeAt(0);
            let rect = range.getBoundingClientRect();
            ol.style.top = rect.top + 30 + 'px';
            ol.style.left = rect.left + 'px';
            //make sure ol inside window
            if (rect.top + 80 > window.innerHeight) {
              ol.style.top = window.innerHeight - 80 + 'px';
            }
            if (rect.left + 300 > window.innerWidth) {
              ol.style.left = window.innerWidth - 300 + 'px';
            }
            ol.style.zIndex = '9999';
            ol.style.backgroundColor = 'black';
            ol.style.color = 'white';
            ol.style.width = '300px';
            ol.style.overflow = 'auto';
            ol.style.scrollbarWidth = 'none';
            ol.style.padding = '10px';
            ol.addEventListener('pointerover', () => {
              ol.style.backgroundColor = '#222200';
              clearTimeout(resetTimeout);
            });
            ol.addEventListener('pointerdown', () => {
              e.preventDefault();
            });
            ol.addEventListener('pointerout', () => {

              resetTimeout = setTimeout(() => {
                ol.remove();
              }
                , 10000);
            });

            document.body.appendChild(ol);

            //remove ol after 8 seconds
            clearTimeout(resetTimeout);
            resetTimeout = setTimeout(() => {
              ol.remove();
            }, 5000);

            let allprompts = this.aiSettings.prompts;
            for (let custometoool of this.aiSettings.customTools) {
              allprompts[custometoool.name] = custometoool.prompt;
            }

            //create li for quick ask
            let li = document.createElement('li');

            li = document.createElement('li');
            li.innerHTML = '<i class="fas fa-paper-plane"></i>';
            li.style.cursor = 'pointer';
            li.addEventListener('click', () => {
              ol.remove();
              this.handleQuickAsk();
            }
            );
            ol.appendChild(li);

            for (let key in allprompts) {
              let li = document.createElement('li');
              li.innerHTML = key;
              li.style.cursor = 'pointer';

              li.addEventListener('pointerdown', (e) => {
                e.preventDefault();
              }

              );
              li.addEventListener('click', () => {
                ol.remove();
                let insertedText = this.aiSettings.prompts[key];
                //remove {text} from prompt
                insertedText = insertedText.replace('{text}', '');
                insertTextAtCursor(insertedText);
              });
              ol.appendChild(li);




            }
          }



          // if (e.key === '/' && !e.shiftKey) {
          //   this.showBlockMenu(e);
          // }

          this.editor.lastKey = e.key;
        });

        this.editor.addEventListener('drop', (event) => {
          event.preventDefault();

          this.showToast('drop file to upload');

          const files = event.dataTransfer.files;
          if (files.length === 0) {
            console.log('No files dropped.');
            return;
          }

          for (const file of files) {
            if (file.type.startsWith('image/')) {
              console.log(`Image file dropped: ${file.name}`);
              // Process the image file here
            } else {
              console.log('Non-image file dropped.');
            }
            this.uploadFile(file);
          }
        });

        this.clearNotes();

      }
    } catch (error) {
      console.error('Error setting up event listeners:', error);
    }
  }

};
