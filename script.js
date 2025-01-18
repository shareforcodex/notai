const API_BASE_URL = "https://notais.suisuy.eu.org";
let currentUser = {
  userId: localStorage.getItem("userId"),
  credentials: localStorage.getItem("credentials"),
};

class HTMLEditor {
  constructor() {
    // Define DEFAULT_SYSTEM_PROMPT as a class property
    this.DEFAULT_SYSTEM_PROMPT = `you are a assistant to help user write better doc now,  only output html body innerHTML code  to me, don't put it in codeblock do not use markdown;
    you can put a head h2 with 2 to 5 words at start to summary the doc, aligned at left; 
    use inline style to avoid affect parent element, make the html doc looks beautiful, clean and mordern, make style like MDN site.  
    you can use image to show the concept when needed, like show a word definition via image, the img get api is simple, put the prompt after https://getsananimg.suisuy.eu.org/(you prompt for image here) , so you can just put it in a img tag, set img height to 300px`;

    // Initialize core editor elements with error checking
    const editor = document.getElementById("editor");

    // Initialize last pointer position
    this.lastPointerPosition = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    // Load recent notes on startup
    this.updateRecentNotesUI();

    // Listen for pointer down events to update the last position
    document.addEventListener('pointerdown', (e) => {
      this.lastPointerPosition = { x: e.clientX, y: e.clientY };
    });
    const sourceView = document.getElementById("sourceView");
    const toolbar = document.querySelector(".toolbar");
    const aiToolbar = document.getElementById("aiToolbar");

    // Define DEFAULT_MODELS as a class property
    this.DEFAULT_MODELS = [
      { name: "gpt-4o", model_id: "gpt-4o", url: "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions", api_key: '' },
      { name: "gpt-4o-mini", model_id: "gpt-4o-mini", url: "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions", api_key: '' },
      { name: "Meta-Llama-3.1-405B-Instruct", model_id: "Meta-Llama-3.1-405B-Instruct", url: "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions", api_key: '' },
      { name: "Llama-3.2-90B-Vision-Instruct", model_id: "Llama-3.2-90B-Vision-Instruct", url: "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions", api_key: '' },
      { name: "Mistral-large", model_id: "Mistral-large", url: "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions", api_key: '' },
    ];

    // Verify required elements exist
    if (!editor || !sourceView || !toolbar || !aiToolbar) {
      console.error("Required editor elements not found");
      return;
    }


    // Assign verified elements
    this.editor = editor;
    this.sourceView = sourceView;
    this.toolbar = toolbar;
    this.aiToolbar = aiToolbar;
    this.currentNoteTitle = "";
    this.lastSavedContent = "";
    this.lastUpdated = null;
    this.lastInteractionTime=0;
    this.aiSettings = {
      systemPrompt: this.DEFAULT_SYSTEM_PROMPT,

      prompts: {
        ask: "Answer this question: {text}",
        correct: "Correct any grammar or spelling errors in this text: {text}",
        translate: "Translate this text to English: {text}"
      },
      customTools: [],
      models: [...this.DEFAULT_MODELS]
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
    titleElement.addEventListener("input", () => this.delayedSaveNote());
    this.currentBlock = null;
    this.content = ""; // Store markdown content
    this.isSourceView = false;
    this.isEditable = true;
    this.autoSaveTimeout = null;

    

    // Initialize content and check auth
    this.updateContent();

    this.checkAuthAndLoadNotes();
    this.loadFolders();
    this.setupCodeCopyButton();
  }

  setupCodeCopyButton() {
    const copyBtn = document.getElementById('codeCopyBtn');
    let activeCodeElement = null;

    document.addEventListener('pointerdown', (e) => {
      const target = e.target;
      const codeElement = target.closest('pre, code');
      
      if (codeElement) {
        activeCodeElement = codeElement;
        const rect = codeElement.getBoundingClientRect();
        const buttonRect = copyBtn.getBoundingClientRect();
        
        // Calculate position at top of code element
        let parentDiv = codeElement;
        while (parentDiv && parentDiv.nodeName !== 'DIV') {
          parentDiv = parentDiv.parentElement;
        }
        let parentRect = parentDiv.getBoundingClientRect();
        let top = Math.max( rect.top , parentRect.top);
        let left = parentRect.left;

        // Adjust if scrolled past top
        if (rect.top < 0) {
          top = window.scrollY;
        }

        copyBtn.style.left = `${left}px`;
        copyBtn.style.top = `${top}px`;
        copyBtn.style.display = 'block';
      } else if (!e.target.closest('#codeCopyBtn')) {
        copyBtn.style.display = 'none';
        activeCodeElement = null;
      }
    });

    // Handle scroll events to keep button visible
    document.addEventListener('scroll', () => {
      if (activeCodeElement && copyBtn.style.display !== 'none') {
        const rect = activeCodeElement.getBoundingClientRect();
        const buttonRect = copyBtn.getBoundingClientRect();
        
        if (rect.top < 0 && rect.bottom > buttonRect.height) {
          // Element is scrolled but still partially visible
          copyBtn.style.top = `${window.scrollY}px`;
        } else if (rect.top >= 0) {
          // Element is fully visible
          copyBtn.style.top = `${rect.top + window.scrollY}px`;
        } else {
          // Element is scrolled out of view
          copyBtn.style.display = 'none';
          activeCodeElement = null;
        }
      }
    });

    copyBtn.addEventListener('click', async () => {
      if (activeCodeElement) {
        try {
          await navigator.clipboard.writeText(activeCodeElement.innerText);
          copyBtn.innerHTML = '<i class="fas fa-check"></i>';
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
            copyBtn.style.display = 'none';
          }, 2000);
        } catch (err) {
          console.error('Failed to copy text:', err);
        }
      }
    });
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

  async apiRequest(method, endpoint, body = null, isAIRequest = false, noSpinner = false) {
    // Show the spinner before making the request
    if (!noSpinner) this.showSpinner();

    const headers = {
      "Content-Type": "application/json",
    };

    if (isAIRequest) {
      const model = this.aiSettings.models.find(m => m.model_id === body?.model);
      if (model?.api_key) {
        headers["Authorization"] = `Bearer ${model.api_key}`;
      }
    } else if (currentUser.userId && currentUser.credentials) {
      headers["Authorization"] = `Basic ${currentUser.credentials}`;
    }

    try {
      const url = isAIRequest
        ? "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions"
        : `${API_BASE_URL}${endpoint}`;

       //get else from config and combine it to body
    let elseconfig={}
    try {
    
    elseconfig=JSON.parse(this.aiSettings.models.find(m => m.model_id === body.model).else || '{}');
    console.log('else config',elseconfig);      
    } catch (error) {
      console.log('error when parse else config',error)
    }
    body = { ...body, ...elseconfig };
      const response = await fetch(
        isAIRequest && body?.model
          ? (this.aiSettings.models.find(m => m.model_id === body.model)?.url ||
            "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions")
          : url, {
        method,
        headers,
        body: method==='GET'? null: body ? JSON.stringify(body) : null,
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

  async fetchReadmeContent() {
    try {
      // const response = await fetch('README.md');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await marked(response.text());
    } catch (error) {
      console.error("Failed to fetch README.md:", error);
      return `Welcome ! this is all new UI to interact with ai models,  you can write your note here, select some text and use the AI toolbar to generate content based on your text. 
go to <a href="https://github.com/suisuyy/notai/tree/can?tab=readme-ov-file#introduction"> Help </a>  to see how to use the Notetaking app powered by LLM

`; // Fallback content
    }
  }

  async loadHelpPage() {
    try {
      const readmeContent = await this.fetchReadmeContent();
      const helpMarkdown = document.getElementById('helpMarkdown');
      if (helpMarkdown) {
        helpMarkdown.innerHTML = marked.parse(readmeContent);
      }
      window.location.href = 'help.html';
    } catch (error) {
      console.error("Error loading help page:", error);
      this.showToast("Failed to load help page.");
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
        this.delayedSaveNote();
      });
    } else {
      // Switching back to editor view
      editor.innerHTML = sourceView.value;  // Apply source changes to editor
      editor.style.display = "block";
      sourceView.style.display = "none";
      this.updateContent();  // Update markdown content
      this.delayedSaveNote();
    }
  }

  setupAIToolbar() {
    // Load saved model preferences
    const savedModels = JSON.parse(localStorage.getItem('aiModelPreferences') || '{}');

    // Set initial button texts and values
    ['modelBtn1', 'modelBtn2', 'modelBtn3'].forEach((btnId, index) => {
      const btn = document.getElementById(btnId);
      const modelValue = savedModels[`model${index + 1}`] || (index === 0 ? 'gpt-4o-mini' : 'none');
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

      this.updateModelDropdowns();
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
  }

  updateModelDropdowns() {
    document.querySelectorAll('.custom-dropdown').forEach((dropdown, index) => {
      const btn = dropdown.querySelector('.model-select-btn');
      const options = dropdown.querySelector('.model-options');

      // First, clear any existing options to avoid duplication
      options.innerHTML = '';

      // Add a "None" option
      const noneButton = document.createElement('button');
      noneButton.setAttribute('data-value', 'none');
      noneButton.textContent = 'None';
      noneButton.addEventListener('click', (e) => {
        e.stopPropagation();
        btn.textContent = 'None';
        btn.setAttribute('data-selected-value', 'none');
        options.classList.remove('show');
        const preferences = JSON.parse(localStorage.getItem('aiModelPreferences') || '{}');
        preferences[`model${index + 1}`] = 'none';
        localStorage.setItem('aiModelPreferences', JSON.stringify(preferences));
      });
      options.appendChild(noneButton);

      // Dynamically create and append a button for each model
      this.aiSettings.models.forEach(model => {
        const button = document.createElement('button');
        button.setAttribute('data-value', model.model_id);
        button.textContent = model.name;

        // Add an event listener to handle model selection
        button.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent the click from bubbling up

          // Update the button text and data-selected-value attribute
          btn.textContent = model.name;
          btn.setAttribute('data-selected-value', model.model_id);

          // Hide the dropdown after selection
          options.classList.remove('show');

          // Save the selected model preference to localStorage
          const preferences = JSON.parse(localStorage.getItem('aiModelPreferences') || '{}');
          preferences[`model${index + 1}`] = model.model_id;
          localStorage.setItem('aiModelPreferences', JSON.stringify(preferences));
        });

        // Append the button to the options container
        // Add an event listener to handle model selection
        button.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent the click from bubbling up

          // Update the button text and data-selected-value attribute
          btn.textContent = model.name;
          btn.setAttribute('data-selected-value', model.model_id);

          // Hide the dropdown after selection
          options.classList.remove('show');

          // Save the selected model preference to localStorage
          const preferences = JSON.parse(localStorage.getItem('aiModelPreferences') || '{}');
          preferences[`model${index + 1}`] = model.model_id;
          localStorage.setItem('aiModelPreferences', JSON.stringify(preferences));
        });

        // Append the button to the options container
        options.appendChild(button);
      });
    });

    // Handle selection changes
    this.setupSelectionHandler();
  }

  // Helper function to get display name for model
  getModelDisplayName(value) {
    const model = this.aiSettings.models.find(m => m.model_id === value);
    return model ? model.name : value;
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
    const useComment = text.length < 20;

    let customTool = null;
    let prompt = "";
    if (this.aiSettings.prompts[action]) {
      prompt = this.aiSettings.prompts[action].replace('{text}', text);
    } else {
      // Handle custom tools
      customTool = this.aiSettings.customTools.find(tool => tool.id === action);
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

      // Check for image in selection or current block
      let imageUrl = null;
      let selectedContent = range.cloneContents();
      let imgElement = selectedContent.querySelector('img');
      
      if (!imgElement && currentBlock) {
        imgElement = currentBlock.querySelector('img');
      }

      if (imgElement && imgElement.src) {
        imageUrl = imgElement.src;
      }

      if (useComment) {
        // Create span for the selected text
        commentedSpan = document.createElement("span");
        commentedSpan.className = "commented-text";
        try {
          range.surroundContents(commentedSpan);
        } catch (e) {
          // Fallback method for complex selections
          const contents = range.extractContents();
          commentedSpan.appendChild(contents);
          range.insertNode(commentedSpan);
        }
      }

      // Make parallel requests to selected models
      const requests = selectedModels.map(modelName => {
        const modelConfig = this.aiSettings.models.find(m => m.model_id === modelName);
        let requestBody = {
          messages: [
            {
              role: "system",
              content: this.aiSettings.systemPrompt,
            },
            {
              role: "user",
              content: imageUrl ? [
                { type: "text", text: prompt },
                { 
                  type: "image_url", 
                  image_url: {
                    url: imageUrl,
                  }
                }
              ] : prompt
            },
          ],
          model: modelName,
          temperature: 0.7,
          top_p: 1,
        };

        // If model has additional configuration in 'else' field, parse and merge it
        if (modelConfig && modelConfig.else) {
          try {
            const additionalConfig = JSON.parse(modelConfig.else);
            requestBody = { ...requestBody, ...additionalConfig };
          } catch (error) {
            console.error('Error parsing additional config:', error);
          }
        }

        return this.apiRequest('POST', '', requestBody, true);
      });

      let completedResponses = 0;
      const totalResponses = requests.length;

      requests.forEach((request, index) => {
        const modelName = selectedModels[index];

        request.then(response => {
          if (response.error) {
            // Handle rate limit or other API errors
            const errorMessage = response.error.code === "RateLimitReached"
              ? `Rate limit reached for ${modelName}. Please try again later or choose another model.`
              : `Error with ${modelName}: ${response.error.message || response.error.toString() || 'Unknown error'}`;
            this.showToast(errorMessage);
            completedResponses++;
            if (completedResponses === totalResponses) {
              this.delayedSaveNote(true);
            }
            return;
          }

          if (response.choices && response.choices[0]) {
            const aiResponse = response.choices[0].message.content || '';
            let audioResponse = response.choices[0].message.audio;

            if (useComment) {
              // Add this response to the comment
              const currentComment = commentedSpan.getAttribute("data-comment") || "";
              let newResponse = `<h4 onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'; this.nextElementSibling.scrollIntoView({ behavior: 'smooth', block: 'start' });" style="position: sticky; top: 0; background: white; z-index: 100; padding: 0px 0; margin: 0; font-size: small; text-decoration: underline;">${modelName}</h4>
<div style="display:block">
${(aiResponse)}`;

              // Add audio player if audio response is available
              if (audioResponse && audioResponse.data) {
                newResponse += `<audio controls style="width: 90%; margin-top: 10px;">
  <source src="data:audio/wav;base64,${audioResponse.data}" type="audio/wav">
  Your browser does not support the audio element.
</audio>`;
              }

              newResponse += '</div>';
              const updatedComment = currentComment ? currentComment + newResponse + '---\n' : newResponse;
              commentedSpan.setAttribute("data-comment", updatedComment);

              // Show or update tooltip for all responses
              const tooltip = document.getElementById('commentTooltip');
              if (index === 0 || tooltip.style.display === 'block') {
                this.showCommentTooltip(commentedSpan, updatedComment);
                // Add highlight effect to AI-generated comment
                document.querySelector('.comment-tooltip').classList.add('highlight');
                setTimeout(() => {
                  document.querySelector('.comment-tooltip').classList.remove('highlight');
                }, 1000);
              }
            } else {
              // Create a new block for longer responses
              const block = document.createElement("div");
              block.className = "block";
              block.classList.add('highlight');

              let blockContent = `<h4 style="margin: 0; padding: 5px 0;"></h4>${(aiResponse)}
              <br>
              <br>
by ${modelName}`;

              // Add audio player if audio response is available
              if (audioResponse && audioResponse.data) {
                blockContent += `<audio controls style="width: 90%; margin-top: 10px;">
  <source src="data:audio/wav;base64,${audioResponse.data}" type="audio/wav">
  Your browser does not support the audio element.
</audio> <br>
${audioResponse.transcript || ''}
`;
              }

              block.innerHTML = blockContent;

              setTimeout(() => {
                block.classList.remove('highlight');
              }, 1500);

              let blankLine = document.createElement('br');

              // Insert blank line and block
              if (currentBlock) {
                currentBlock.after(blankLine);
                // Insert new block after blank line
                blankLine.after(block);
                // Update currentBlock for next iteration
                currentBlock = block;
              } else {
                // Insert at cursor position
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                  const range = selection.getRangeAt(0);
                  range.collapse(false); // Collapse the range to the end point

                  // Insert the blank line
                  range.insertNode(blankLine);

                  // Insert the new block
                  range.insertNode(block);

                  // Add highlight effect
                  block.classList.add('highlight');
                  setTimeout(() => {
                    block.classList.remove('highlight');
                  }, 1000);

                  // Move the cursor after the inserted block
                  range.setStartAfter(block);
                  range.collapse(true);
                  selection.removeAllRanges();
                  selection.addRange(range);
                } else {
                  // Fallback to appending at the end if no selection range is available
                  this.editor.appendChild(blankLine);
                  this.editor.appendChild(block);
                }
              }
            }

            // Increment completed responses counter
            completedResponses++;

            // If all responses are complete, save the note
            if (completedResponses === totalResponses) {
              this.delayedSaveNote(true);
            }
          }
        }).catch(error => {
          console.error(`Error with ${modelName} request:`, error);
          this.showToast(`Error with ${modelName}: ${error.message || 'Network error'}`);
          completedResponses++;
          if (completedResponses === totalResponses) {
            this.delayedSaveNote(true);
          }
        });
      });
    } catch (e) {
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
    document.getElementById('systemPrompt').value = this.aiSettings.systemPrompt;
    document.getElementById('askPrompt').value = this.aiSettings.prompts.ask;
    document.getElementById('correctPrompt').value = this.aiSettings.prompts.correct;
    document.getElementById('translatePrompt').value = this.aiSettings.prompts.translate;

    

    this.renderCustomTools();
    this.renderModelSettings();

    // Event listeners
    aiSettingsBtn.onclick = () => {
      // Update values from current settings when opening modal
      document.getElementById('askPrompt').value = this.aiSettings.prompts.ask;
      document.getElementById('correctPrompt').value = this.aiSettings.prompts.correct;
      document.getElementById('translatePrompt').value = this.aiSettings.prompts.translate;
      // Add help text for using {text} in prompt templates
      document.getElementById('askPrompt').title = "Use {text} where you want the selected text inserted.";
      document.getElementById('correctPrompt').title = "Use {text} where you want the selected text inserted.";
      document.getElementById('translatePrompt').title = "Use {text} where you want the selected text inserted.";

      this.renderCustomTools();
      this.renderModelSettings();
      modal.style.display = "block";
    };
    closeBtn.onclick = () => modal.style.display = "none";
    window.onclick = (e) => {
      if (e.target === modal) modal.style.display = "none";
    };

    addCustomToolBtn.onclick = () => this.addCustomTool();
    document.getElementById('addModelBtn').onclick = () => this.addModel();

    saveBtn.onclick = async () => {
      await this.saveAISettings();
      modal.style.display = "none";
      this.updateAIToolbar();
      this.updateModelDropdowns();
    };

    // Add reset button functionality
    const resetSystemPromptBtn = document.getElementById('resetSystemPrompt');
    const editor = this; // Store reference to the class instance

    resetSystemPromptBtn.onclick = () => {
      if (confirm('Are you sure you want to reset the system prompt to default?')) {
      const systemPromptInput = document.getElementById('systemPrompt');
      systemPromptInput.value = editor.DEFAULT_SYSTEM_PROMPT;
      // Add highlight effect
      systemPromptInput.style.transition = 'background-color 0.3s';
      systemPromptInput.style.backgroundColor = '#e3f2fd';
      setTimeout(() => {
        systemPromptInput.style.backgroundColor = '';
      }, 500);
      }
    };



   
    
  }

  renderCustomTools() {
    const container = document.getElementById('customTools');
    container.innerHTML = '';

    this.aiSettings.customTools.forEach((tool, index) => {
        const toolDiv = document.createElement('div');
        toolDiv.className = 'custom-tool';
        toolDiv.style.marginBottom = '20px';
        toolDiv.innerHTML = `
          <div style="margin-bottom: 10px;">
            <input type="text" class="tool-name" placeholder="Tool Name" value="${tool.name}" style="width: 300px; padding: 8px; border: 1px solid #ced4da; border-radius: 4px;">
            <button class="remove-tool" data-index="${index}" style="margin-left: 10px; padding: 8px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;"><i class="fas fa-trash"></i></button>
          </div>
          <div style="position: relative;">
            <textarea class="tool-prompt" placeholder="Prompt Template" >${tool.prompt}</textarea>
            <small style="display: block; margin-top: 4px; color: #6c757d;">Use {text} where you want the selected text to be inserted</small>
          </div>
        `;

        toolDiv.querySelector('.remove-tool').onclick = () => {
        if (confirm('Are you sure you want to delete this custom tool?')) {
          this.aiSettings.customTools.splice(index, 1);
          this.renderCustomTools();
        }
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
    
    // Focus the name input of the newly added tool
    const tools = document.querySelectorAll('.custom-tool');
    const newTool = tools[tools.length - 1];
    if (newTool) {
        const nameInput = newTool.querySelector('.tool-name');
        nameInput.focus();
    }
  }

  renderModelSettings() {
    const container = document.getElementById('modelSettingsContainer');
    container.innerHTML = '';
    if (!this.aiSettings.models) {
      this.aiSettings.models = [];
    }
    this.aiSettings.models.forEach((model, index) => {
      const div = document.createElement('div');
      div.className = 'model-config';
      div.innerHTML = `
        <input type="text" class="model-name" placeholder="Model Name" value="${model.name}" name="model_name">
        <input type="text" class="model-id" placeholder="Model ID" value="${model.model_id}" name="model_id">
        <input type="text" class="model-url" placeholder="Model URL" value="${model.url}" name="model_url">
        <input type="text" class="model-api-key" placeholder="API Key" value="${model.api_key}" name="model_api_key">
        <textarea class="model-else" placeholder="Additional configuration (e.g. modalities, audio settings)" name="model_else">${model.else || ''}</textarea>
        <button class="remove-model" data-index="${index}"><i class="fas fa-trash"></i></button>
      `;

      div.querySelector('.remove-model').onclick = () => {
        this.aiSettings.models.splice(index, 1);
        this.renderModelSettings();
      };
      container.appendChild(div);
    });
  }

  addModel() {
    this.aiSettings.models.push({
      name: '',
      model_id: '',
      url: 'https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions',
      api_key: '',
      else: ''
    });
    this.renderModelSettings();
  }

  async loadUserConfig() {
    try {
        const config = await this.apiRequest("GET", "/users/config");
        if (config && !config.error) {
            // Parse the config if it's a string
            const parsedConfig = typeof config.config === 'string' ? JSON.parse(config.config) : config.config;
            
            // Load system prompt first
            if (parsedConfig.systemPrompt) {
                this.aiSettings.systemPrompt = parsedConfig.systemPrompt;
                // Update the textarea if it exists
                const systemPromptInput = document.getElementById('systemPrompt');
                if (systemPromptInput) {
                    systemPromptInput.value = parsedConfig.systemPrompt;
                }
            } else {
                this.aiSettings.systemPrompt = this.DEFAULT_SYSTEM_PROMPT;
                const systemPromptInput = document.getElementById('systemPrompt');
                if (systemPromptInput) {
                    systemPromptInput.value = this.DEFAULT_SYSTEM_PROMPT;
                }
            }

            // Merge prompts
            this.aiSettings.prompts = parsedConfig.prompts || {
                ask: "Answer this question: {text}",
                correct: "Correct any grammar or spelling errors in this text: {text}",
                translate: "Translate this text to English: {text}"
            };

            // Merge customTools
            this.aiSettings.customTools = parsedConfig.customTools || [];

            if (parsedConfig.models) {
                this.aiSettings.models = [...parsedConfig.models];
            } else {
                this.aiSettings.models = [...this.DEFAULT_MODELS];
            }
            this.updateModelDropdowns();
        }
        this.updateAIToolbar();
    } catch (error) {
        console.error("Error loading user config:", error);
    }
  }


  async saveAISettings() {
    // Gather updated model data from the UI
    const modelConfigs = document.querySelectorAll('.model-config');
    const updatedModels = Array.from(modelConfigs).map(mc => ({
      name: mc.querySelector('.model-name').value,
      model_id: mc.querySelector('.model-id').value,
      url: mc.querySelector('.model-url').value,
      api_key: mc.querySelector('.model-api-key').value,
      else: mc.querySelector('.model-else').value
    }));

    // Prepare the config object
    const config = {
      systemPrompt: document.getElementById('systemPrompt').value || "you are a assistant to help user write better doc now,  only output html body innerHTML code  to me, don't put it in ```html ```,do not use markdown, you can put a head h2 with 2 to 5 words at start to summary the doc; use inline style to avoid affect parent element, make the html doc looks beautiful, clean and mordern.",
      prompts: {
        ask: document.getElementById('askPrompt').value,
        correct: document.getElementById('correctPrompt').value,
        translate: document.getElementById('translatePrompt').value
      },
      customTools: Array.from(document.querySelectorAll('.custom-tool')).map((toolDiv, index) => ({
        id: this.aiSettings.customTools[index]?.id || 'custom_' + Date.now(),
        name: toolDiv.querySelector('.tool-name').value,
        prompt: toolDiv.querySelector('.tool-prompt').value
      })),
      models: updatedModels
    };

    try {
      await this.apiRequest("POST", "/users/config", { config: JSON.stringify(config) });
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
          <button class="toggle-size-comment">Zoom</button>
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

    const toggleBtn = tooltip.querySelector('.toggle-size-comment');
    toggleBtn.addEventListener('click', () => {
      if (tooltip.dataset.large === 'true') {
        tooltip.dataset.large = 'false';
        tooltip.style.maxWidth = '';
        tooltip.style.top = '';
        tooltip.style.height = '';

      } else {
        tooltip.dataset.large = 'true';
        tooltip.style.maxWidth = '90vw';
        tooltip.style.height = '50vh';
        tooltip.style.top = '50vh';
      }
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
        // Add highlight effect
        element.classList.add('highlight');
        setTimeout(() => {
          element.classList.remove('highlight');
        }, 1000);

        this.showCommentTooltip(element, newComment);
        this.delayedSaveNote();
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
      this.delayedSaveNote();
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
        // Add highlight effect
        span.classList.add('highlight');
        setTimeout(() => {
          span.classList.remove('highlight');
        }, 1000);

        this.delayedSaveNote();
      }
    } else {
      alert('Please select some text to comment on');
    }
  }

  // Get text from current block and all context above it
  getBlockContext() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return null;

    const range = selection.getRangeAt(0);
    const startContainer = range.startContainer.nodeType === Node.TEXT_NODE 
      ? range.startContainer.parentElement 
      : range.startContainer;

    // Find the current block, prioritizing the block containing the cursor
    let currentBlock = startContainer.closest('.block');

    // If no block found, try to find the last block
    if (!currentBlock) {
      const blocks = this.editor.querySelectorAll('.block');
      currentBlock = blocks[blocks.length - 1];
    }

    if (!currentBlock) return null;

    // Get all blocks before the current block
    const allBlocks = Array.from(this.editor.querySelectorAll('.block'));
    const currentBlockIndex = allBlocks.indexOf(currentBlock);

    // Collect context from previous blocks
    const contextBlocks = allBlocks.slice(0, currentBlockIndex );
    const contextText = contextBlocks
      .map(block => block.textContent.trim())
      .filter(text => text)
      .join('\n\n');

    // Get the current block's text
    const currentText = currentBlock.textContent.trim();

    console.log('Current text:', currentText, '\n Context:', contextText);
    return {
      currentText: currentText,
      contextText: contextText
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

    // Check for image in current block
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    let currentBlock;
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      currentBlock = range.startContainer.parentElement.closest('.block');
    } else {
      currentBlock = range.startContainer.closest('.block');
    }

    // Get image URL if present
    let imageUrl = null;
    if (currentBlock) {
      const imgElement = currentBlock.querySelector('img');
      if (imgElement && imgElement.src) {
        imageUrl = imgElement.src;
      }
    }

    // Make parallel requests to selected models
    const requests = selectedModels.map(modelName => {
      const modelConfig = this.aiSettings.models.find(m => m.model_id === modelName);
      let requestBody = {
        messages: [
          {
            role: "system",
            content: this.aiSettings.systemPrompt,
          },
          {
            role: "user",
            content: imageUrl ? [
              { 
                type: "text", 
                text: (context.contextText ? 
                  `this is our chat history, you need only reply to the last message based on the history:\n${context.contextText}\n\n` : '') 
                  + context.currentText
              },
              { 
                type: "image_url", 
                image_url: {
                  url: imageUrl,
                }
              }
            ] : (context.contextText ? 
              `this is our chat history, you need only reply to the last message based on the history:\n${context.contextText}\n\n` : '') 
              + context.currentText
          },
        ],
        model: modelName,
        temperature: 0.7,
        top_p: 1,
      };

      // If model has additional configuration in 'else' field, parse and merge it
      if (modelConfig && modelConfig.else) {
        try {
          const additionalConfig = JSON.parse(modelConfig.else);
          requestBody = { ...requestBody, ...additionalConfig };
        } catch (error) {
          console.error('Error parsing additional config:', error);
        }
      }

      return this.apiRequest('POST', '', requestBody, true);
    });

    try {
      // Process each request
      requests.forEach((request, index) => {
        const modelName = selectedModels[index];

        request.then(response => {
          if (response.error) {
            // Handle rate limit or other API errors
            const errorMessage = response.error.code === "RateLimitReached"
              ? `Rate limit reached for ${modelName}. Please try again later or select other model.`
              : `Error with ${modelName}: ${response.error.message || 'Unknown error'}`;
            this.showToast(errorMessage);
            return;
          }

          if (response.choices && response.choices[0]) {
            let aiResponse = response.choices[0].message.content|| " " + `<br>
<audio src="data:audio/wav;base64,${response.choices[0].message.audio.data}" controls></audio> <br>
${response.choices[0].message.audio.transcript} <br>
`;  
           

            // Create new block for this model's response with h2 header
            const block = document.createElement("div");
            block.className = "block";
            block.innerHTML = `${(aiResponse)}
<br>
<br>
by ${modelName}`;



            // Find the last AI response block for this quick ask
            let lastResponseBlock = currentBlock;
            let nextBlock = currentBlock?.nextElementSibling || currentBlock;

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
            let blankLine = document.createElement('br');
            if (currentBlock) {
              //add new line at end of block

              currentBlock.after(blankLine);
              // Insert new block after blank line
              blankLine.after(block);

              block.classList.add('highlight')
              setTimeout(() => {
                block.classList.remove('highlight')

              }, 1500);
              currentBlock = block;
            } else {
              // Insert at cursor position
              const selection = window.getSelection();
              if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.collapse(false);

                range.insertNode(block);
                range.insertNode(blankLine);

                range.setStartAfter(blankLine);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
              } else {
                this.editor.appendChild(block);
                this.editor.appendChild(blankLine);
              }
            }
            this.delayedSaveNote();


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

  async setupEventListeners() {
    try {
    // Auto-save on user interactions
    document.body.addEventListener('pointerdown', () => this.idleSync());
    document.body.addEventListener('keypress', () => this.idleSync());
    document.body.addEventListener('paste', () => this.idleSync());

      // Get all required elements
    const uploadModal = document.getElementById('uploadModal');
    const uploadFileBtn = document.getElementById('uploadFileBtn');
    const closeUploadBtn = uploadModal?.querySelector('.close');
    const dropZone = document.getElementById('dropZone');
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
      if (uploadModal && uploadFileBtn && closeUploadBtn && dropZone && 
          fileInput && selectFileBtn && uploadBtn && previewArea && filePreview) {

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
                mimeType: 'video/webm;codecs=vp8,opus'
              });
              const chunks = [];

              mediaRecorder.ondataavailable = e => chunks.push(e.data);
              mediaRecorder.onstop = async () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
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
                const file = new File([blob], 'video.webm', { type: 'video/webm' });
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

        // Handle drag and drop
        dropZone.ondragover = (e) => {
          e.preventDefault();
          dropZone.style.borderColor = '#2ecc71';
        };

        dropZone.ondragleave = () => {
          dropZone.style.borderColor = '#ccc';
        };

        dropZone.ondrop = async (e) => {
          e.preventDefault();
          dropZone.style.borderColor = '#ccc';
          const file = e.dataTransfer.files[0];
          if (file) {
            await this.handleFileSelection(file, previewArea, filePreview);
          }
        };

        // Handle file upload
        uploadBtn.onclick = async () => {
          const file = fileInput.files[0];
          if (file) {
            await this.uploadFile(file);
            uploadModal.style.display = 'none';
          }
        };

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
        quickAskBtn.addEventListener('click', () => {
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

    // Save button
      if (saveNoteBtn) {
        saveNoteBtn.addEventListener('click', () => {
      this.saveNote();
    });
      }

      // Plain text button
      if (plainTextBtn) {
        plainTextBtn.addEventListener('click', () => this.convertToPlainText());
      }

    // Auto-save on content changes
      if (this.editor) {
        this.editor.addEventListener('input', () => {
      this.delayedSaveNote();
      this.updateTableOfContents();
    });

        this.editor.addEventListener('paste', () => {
      this.delayedSaveNote();
    });

    // Handle keyboard shortcuts
        this.editor.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
        if (e.shiftKey) {
          document.execCommand('insertLineBreak', false, null);
          e.preventDefault();
        } else {
          document.execCommand('insertLineBreak', false, null);
          e.preventDefault();
        }
      }
          if (e.key === '/' && !e.shiftKey) {
        this.showBlockMenu(e);
      }
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
        this.handleQuickAsk();
          }
        });
      }
    } catch (error) {
      console.error('Error setting up event listeners:', error);
    }
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
      const block = document.createElement("div");
      block.className = "block";
      block.innerHTML = selectedText;
      block.classList.add('highlight');
      setTimeout(() => {
        block.classList.remove('highlight');
      }, 1500);

      // Get the range of the selected text
      const range = selection.getRangeAt(0);

      // Replace the selected text with the new block
      range.deleteContents();
      range.insertNode(block);

      // Clear the selection
      selection.removeAllRanges();

      // Focus the new block
      const textNode = block;
      if (textNode) {
        textNode.focus();
        const newRange = document.createRange();
        newRange.selectNodeContents(textNode);
        newRange.collapse(true);
        selection.addRange(newRange);
      }

      return;
    }

    // Create new block for non-selected text case
    const block = document.createElement("div");
    block.className = "block";
    block.innerHTML = '\n\n';
    

    // Add highlight effect
    block.classList.add('highlight');
    setTimeout(() => {
      block.classList.remove('highlight');
    }, 1000);

    // Get current selection and find closest block
    const range = selection.getRangeAt(0);
    let currentBlock = range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.parentElement.closest(".block")
      : range.startContainer.closest(".block");

    // Insert the block after the cursor position
    const blankLine = document.createElement('br');
    const blankLine2 = document.createElement('br');
    
    if (currentBlock) {
      // Insert after current block
      currentBlock.after(blankLine);
      blankLine.after(block);
      block.after(document.createElement('br'));
    } else {
      // Insert at cursor position
      if(this.editor.contains(range.commonAncestorContainer)){
          range.collapse(false); // Collapse to end
          range.insertNode(blankLine);
          blankLine.after(block);
          block.after(document.createElement('br'));

      }
      

    }

    // Focus the new block and move cursor inside
    block.focus();
    const newRange = document.createRange();
    newRange.selectNodeContents(block);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
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


    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.setAttribute("style","width: 95vw; height: 500px; scrollbar-width:none")
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute("allow","accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; magnetometer; microphone; midi; payment; speaker; usb; vr");

    const range = window.getSelection().getRangeAt(0);

    range.insertNode(iframe);
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
            content: `Welcome to your default note! 
go to <a href="https://github.com/suisuyy/notai/tree/dev2?tab=readme-ov-file#introduction"> Help </a>  to see how to use the Notetaking app powered by LLM

 `,
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
          noteElement.textContent = note.title || "Untitled";
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
      this.lastUpdated = note.last_updated; // Store last_updated timestamp
      
      // Add to recent notes
      this.addToRecentNotes(note_id, note.title);
      
      // Update table of contents after loading note
      this.updateTableOfContents();
    } else {
      console.error("Failed to load note:", note.error);
    }
  }

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
    
    // Keep only the last 5 notes
    recentNotes = recentNotes.slice(0, 5);
    
    // Save back to localStorage
    localStorage.setItem('recentNotes', JSON.stringify(recentNotes));
    
    // Update the UI
    this.updateRecentNotesUI();
  }

  updateRecentNotesUI() {
    // Get recent notes from localStorage
    const recentNotes = JSON.parse(localStorage.getItem('recentNotes') || '[]');
    const recentContainer = document.getElementById('recentNotes');
    
    // Clear existing recent notes
    recentContainer.innerHTML = '';
    
    // Filter out current note from display
    const filteredNotes = recentNotes.filter(note => note.id !== this.currentNoteId);
    
    // Add recent notes next to the title
    filteredNotes.forEach(note => {
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
        // Load the clicked note
        this.loadNote(note.id);
      });
      
      recentContainer.appendChild(noteEl);
    });
  }

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
  }

  //sync if in idle, not interactive for 30s
  idleSync() {

    let idleTime=Date.now()-this.lastInteractionTime|| 0 ;
    console.log('idelTime ', idleTime,this.lastInteractionTime);
    
    if( idleTime>30000){
      this.saveNote();
    }
    // Update last interaction time
    this.lastInteractionTime = Date.now();
    
  }

  //save delay for 10s, if called again, reset the timer
  delayedSaveNote() {
    console.log('delayedSaveNote start ');
    
    clearTimeout(this.autoSaveTimeout);
    this.autoSaveTimeout = setTimeout(() => {
      console.log('delayedSaveNote saveNote ');
      
      this.saveNote();
    }, 10000);
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

        // Fetch current note from server to check last_updated
        const currentNote = await this.apiRequest("GET", `/notes/${this.currentNoteId}`, null, false, true);
        //compare content, if same return
        if(currentNote && currentNote.content === this.editor.innerHTML){
          // Show saved state
          spinnerIcon.style.display = "none";
          saveIcon.style.display = "inline-block";
          spanText.textContent = "";
          
          return;
        }
        // Server has newer version - load it
        //need convert last_updated to number to compare, the last_updated is string like 2025-01-01 02:25:51
        if (currentNote && new Date(currentNote.last_updated).getTime() > new Date(this.lastUpdated).getTime()) {
          this.editor.innerHTML = currentNote.content;
          document.getElementById("noteTitle").textContent = currentNote.title;
          this.lastUpdated = currentNote.last_updated;
          this.currentNoteTitle = currentNote.title;
          
          // Show saved state
          spinnerIcon.style.display = "none";
          saveIcon.style.display = "inline-block";
          spanText.textContent = "⮟";
          
          return;
        }


      // Get current title from the title element
      const currentTitle = document.getElementById("noteTitle").textContent.trim() || "Untitled";
      this.currentNoteTitle = currentTitle;

      const result = await this.apiRequest("POST", `/notes`, {
        note_id: this.currentNoteId,
        content: this.editor.innerHTML,
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
        spanText.textContent = "⮝";
        
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
  }

  clearNotes() {
    document.getElementById("pagesList").innerHTML = "";
    this.editor.innerHTML = "Start writing here...>";
  }

  toggleSidebar() {
    const sidebar = document.querySelector(".sidebar");
    const mainContent = document.querySelector(".main-content");
    const editor = document.querySelector(".editor");
    
    if (sidebar && mainContent) {
    sidebar.classList.toggle("hidden");
    mainContent.classList.toggle("expanded");
      
      // Adjust editor width when sidebar is hidden/shown
      if (editor) {
        if (sidebar.classList.contains("hidden")) {
          editor.style.paddingLeft = "15px";
        } else {
          editor.style.paddingLeft = "5px";

        }
      }
    }
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
                    <span>${note.title || "Untitled"}</span>
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
        heading.scrollIntoView({ behavior: 'instant', block: 'start',inline:'start' });
        setTimeout(() => {
          editor.editor.scrollLeft=0;
        }, 100);
      });

      tocList.appendChild(tocItem);
    });
  }

  // Function to convert selected text to plain text, supporting text outside of blocks
  convertToPlainText() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    if (!selectedText) return;

    // Replace the selected content with plain text
    const textNode = document.createTextNode(selectedText);
    range.deleteContents();
    range.insertNode(textNode);

    // Remove any parent elements that are not div tags
    let parent = textNode.parentElement;
    while (parent && parent.tagName.toLowerCase() !== 'div') {
      const grandparent = parent.parentElement;
      if (grandparent) {
        grandparent.replaceChild(textNode, parent);
        parent = textNode.parentElement;
      } else {
        break;
      }
    }

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
    if (!toastContainer) {
      console.error("toastContainer not found in the DOM");
      return;
    }

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

    // **New Code Starts Here**
    if (type === 'error') {
      // After 1 second, add the 'hide' class to transition background to white
      setTimeout(() => {
        toast.classList.add('hide');
      }, 1000); // 1000 milliseconds = 1 second
    }
    // **New Code Ends Here**
  }

  async handleFileSelection(file, previewArea, filePreview) {
    // Show preview area
    previewArea.style.display = 'block';
    filePreview.innerHTML = '';

    // Create and add file info element
    const fileInfo = document.createElement('div');
    fileInfo.style.fontSize = '12px';
    fileInfo.style.color = '#666';
    fileInfo.style.marginBottom = '8px';
    fileInfo.innerHTML = `
      <strong>File:</strong> ${file.name}<br>
      <strong>Type:</strong> ${file.type || 'Unknown'}<br>
      <strong>Size:</strong> ${this.formatFileSize(file.size)}
    `;

    // Handle different file types
    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      filePreview.appendChild(img);
      
    } else if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.controls = true;
      video.src = URL.createObjectURL(file);
      filePreview.appendChild(video);
    } else if (file.type.startsWith('audio/')) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = URL.createObjectURL(file);
      filePreview.appendChild(audio);
    } else {
      const fileDetails = document.createElement('div');
      fileDetails.style.padding = '10px';
      fileDetails.style.backgroundColor = '#f5f5f5';
      fileDetails.style.borderRadius = '4px';
      fileDetails.textContent = `File ready for upload`;
      filePreview.appendChild(fileDetails);
    }
    filePreview.appendChild(fileInfo);

  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async calculateSHA1(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  async uploadFile(file) {
    try {
      // Show loading spinner
      this.showSpinner();

      // Calculate SHA1 hash
      const shaCode = await this.calculateSHA1(file);
      const extension = file.name.split('.').pop().toLowerCase();
      const uploadUrl = `https://sharefile.suisuy.eu.org/${shaCode}.${extension}`;

      // Upload file
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });

      if (response.ok) {
        // Get device info if available
        let deviceInfo = '';
        if (file.type.startsWith('video/') || file.type.startsWith('image/')) {
          const videoDevice = document.getElementById('videoDevices')?.selectedOptions[0]?.text;
          if (videoDevice) {
            deviceInfo = `<strong>Camera:</strong> ${videoDevice}<br>`;
          }
        }
        if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
          const audioDevice = document.getElementById('audioDevices')?.selectedOptions[0]?.text;
          if (audioDevice) {
            deviceInfo += `<strong>Microphone:</strong> ${audioDevice}<br>`;
          }
        }

        // Create file info div
        const fileInfoDiv = document.createElement('div');
        fileInfoDiv.style.fontSize = '12px';
        fileInfoDiv.style.color = '#666';
        fileInfoDiv.style.margin = '0px';
        fileInfoDiv.style.padding = '0px';
        fileInfoDiv.innerHTML = `
          <strong> ${uploadUrl}</strong><br>
          <strong>Type:</strong> ${file.type || 'Unknown'} 
          <strong>Size:</strong> ${this.formatFileSize(file.size)} 
          ${deviceInfo} <br>
          ${new Date().toLocaleString()}
        `;

        // Create appropriate element based on file type
        let element;
        if (file.type.startsWith('image/')) {
          element = document.createElement('img');
          element.src = uploadUrl;
          element.alt = file.name;
        } else if (file.type.startsWith('video/')) {
          element = document.createElement('video');
          element.src = uploadUrl;
          element.controls = true;
        } else if (file.type.startsWith('audio/')) {
          element = document.createElement('audio');
          element.src = uploadUrl;
          element.controls = true;
        } else {
          element = document.createElement('iframe');
          element.src = uploadUrl;
          element.style.height = '500px';
          element.setAttribute('allowfullscreen', 'true');
        }

        // Create a new block for the media
        let brelement = document.createElement('br');
        const block = document.createElement('div');
        block.className = 'block';
        block.appendChild(element);
        block.appendChild(fileInfoDiv);

        // Try to insert at selection, if no selection append to editor
        const selection = window.getSelection();
          //check range inside editor
        if (selection.rangeCount > 0 && this.editor.contains(selection.getRangeAt(0)?.commonAncestorContainer) ) {
          const range = selection.getRangeAt(0);
          
        range.insertNode(brelement);
        brelement.after(block);
        block.after(document.createElement('br'));
        } else {
          // If no selection, append to the end of editor
          this.editor.prepend(brelement);
          this.editor.prepend(block);
          this.editor.prepend(document.createElement('br'));

          // Scroll to the newly added content
        }
        block.scrollIntoView(true,{ behavior: 'smooth' });

        this.showToast('File uploaded successfully!', 'success');
        this.saveNote();
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      this.showToast('Failed to upload file: ' + error.message);
    } finally {
      this.hideSpinner();
    }
  }

  // Add media device handling methods
  async setupMediaDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      const audioDevices = devices.filter(device => device.kind === 'audioinput');

      const videoSelect = document.getElementById('videoDevices');
      const audioSelect = document.getElementById('audioDevices');

      // Clear existing options
      videoSelect.innerHTML = '<option value="">Select Camera</option>';
      audioSelect.innerHTML = '<option value="">Select Microphone</option>';

      // Add video devices and select first one by default
      videoDevices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Camera ${videoSelect.length}`;
        videoSelect.appendChild(option);
        // Select first device by default
        if (index === 0) {
          option.selected = true;
        }
      });

      // Add audio devices and select first one by default
      audioDevices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Microphone ${audioSelect.length}`;
        audioSelect.appendChild(option);
        // Select first device by default
        if (index === 0) {
          option.selected = true;
        }
      });

      // Show device selectors if devices are available
      const deviceSelectors = document.querySelector('.device-selectors');
      if (videoDevices.length > 0 || audioDevices.length > 0) {
        deviceSelectors.style.display = 'flex';
      }
    } catch (error) {
      console.error('Error enumerating devices:', error);
      this.showToast('Error accessing media devices');
    }
  }

  async startMediaStream(videoDeviceId = null, includeAudio = false) {
    try {
      const constraints = {
        video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
        audio: includeAudio ? { echoCancellation: false, noiseSuppression: true } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoPreview = document.getElementById('videoPreview');
      //this is important to mute the video to avoid noise
      videoPreview.muted = true;

      videoPreview.srcObject = stream;
      videoPreview.style.display = 'block';
      document.getElementById('mediaPreview').style.display = 'block';
      await videoPreview.play(); // Ensure video is playing before returning
      return stream;
    } catch (error) {
      console.error('Error accessing media:', error);
      this.showToast('Error accessing camera or microphone');
      return null;
    }
  }

  async capturePhoto(stream) {
    const videoPreview = document.getElementById('videoPreview');
    const canvas = document.getElementById('photoCanvas');
    const context = canvas.getContext('2d');
    const videoDevice = document.getElementById('videoDevices').selectedOptions[0].text;
    try {
      // Wait for video metadata to load
      await new Promise((resolve) => {
        if (videoPreview.readyState >= 2) {
          resolve();
        } else {
          videoPreview.onloadeddata = () => resolve();
        }
      });

    // Set canvas dimensions to match video
    canvas.width = videoPreview.videoWidth;
    canvas.height = videoPreview.videoHeight;

    // Draw video frame to canvas
    context.drawImage(videoPreview, 0, 0);

    // Convert canvas to blob
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
      
      // Stop the stream and hide video preview
      stream.getTracks().forEach(track => track.stop());
      videoPreview.srcObject = null;
      videoPreview.style.display = 'none';
      
      // Create preview
      const previewArea = document.getElementById('previewArea');
      const filePreview = document.getElementById('filePreview');
      const img = document.createElement('img');
      img.src = URL.createObjectURL(blob);
      img.style.maxWidth = '100%';
      
      // Add file info above preview
      const fileInfo = document.createElement('div');
      fileInfo.style.fontSize = '12px';
      fileInfo.style.color = '#666';
      fileInfo.style.marginBottom = '8px';
      fileInfo.innerHTML = `
        <strong>Captured Photo</strong><br>
        <strong>Camera:</strong> ${videoDevice}<br>
        <strong>Resolution:</strong> ${canvas.width}x${canvas.height}<br>
        <strong>Size:</strong> ${this.formatFileSize(blob.size)}
      `;
      
      previewArea.style.display = 'block';
      filePreview.innerHTML = '';
      filePreview.appendChild(img);
      filePreview.appendChild(fileInfo);
      
      // Create file for upload
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      document.getElementById('fileInput').files = dataTransfer.files;
      
      return blob;
    } catch (error) {
      console.error('Error capturing photo:', error);
      this.showToast('Error capturing photo');
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      return null;
    }
  }

  async startRecording(audioDeviceId = null) {
    try {
      // If already recording, stop it
      if (this.currentMediaRecorder && this.currentMediaRecorder.state === 'recording') {
        this.currentMediaRecorder.stop();
        document.getElementById('captureAudioBtn').innerHTML = '<i class="fas fa-microphone"></i>';
        document.getElementById('captureAudioBtn').style.backgroundColor = '#2ecc71';
        return;
      }

      const constraints = {
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true
      };

      const audioDevice = document.getElementById('audioDevices').selectedOptions[0].text;
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];
      let startTime = Date.now();
      let timerInterval;

      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        clearInterval(timerInterval);
        document.getElementById('recordingTime').textContent = '00:00';
        document.getElementById('stopRecordingBtn').style.display = 'none';
        document.getElementById('audioRecordingControls').style.display = 'none';
        document.getElementById('captureAudioBtn').innerHTML = '<i class="fas fa-microphone"></i>';
        document.getElementById('captureAudioBtn').style.backgroundColor = '#2ecc71';
        
        // Create preview with file info
        const fileInfo = document.createElement('div');
        fileInfo.style.fontSize = '12px';
        fileInfo.style.color = '#666';
        fileInfo.style.marginBottom = '8px';
        fileInfo.innerHTML = `
          <strong>Recorded Audio</strong><br>
          <strong>Microphone:</strong> ${audioDevice}<br>
          <strong>Duration:</strong> ${document.getElementById('recordingTime').textContent}<br>
          <strong>Size:</strong> ${this.formatFileSize(blob.size)}
        `;
        
        const audioPreview = document.createElement('audio');
        audioPreview.controls = true;
        audioPreview.src = URL.createObjectURL(blob);
        const previewArea = document.getElementById('previewArea');
        const filePreview = document.getElementById('filePreview');
        previewArea.style.display = 'block';
        filePreview.innerHTML = '';
        filePreview.appendChild(audioPreview);
        filePreview.appendChild(fileInfo);

        // Create file for upload
        const file = new File([blob], 'recording.webm', { type: 'audio/webm' });
        document.getElementById('fileInput').files = new DataTransfer().files;
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        document.getElementById('fileInput').files = dataTransfer.files;
      };

      // Update recording time
      timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        document.getElementById('recordingTime').textContent = `${minutes}:${seconds}`;
      }, 1000);

      mediaRecorder.start();
      document.getElementById('audioRecordingControls').style.display = 'flex';
      document.getElementById('stopRecordingBtn').style.display = 'block';
      document.getElementById('mediaPreview').style.display = 'block';
      document.getElementById('captureAudioBtn').innerHTML = '<i class="fas fa-stop"></i>';
      document.getElementById('captureAudioBtn').style.backgroundColor = '#e74c3c';

      return mediaRecorder;
    } catch (error) {
      console.error('Error starting recording:', error);
      this.showToast('Error accessing microphone');
      return null;
    }
  }
}

// Initialize the editor and load folders
document.addEventListener("DOMContentLoaded", async () => {
  try {
    window.editor = new HTMLEditor();
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
  // Delegate click event to parent element
  document.body.addEventListener('click', (event) => {
    const target = event.target;
    if (target.tagName === 'IMG' || target.tagName === 'VIDEO' || target.tagName === 'AUDIO' ) {
        event.preventDefault(); // Prevent default behavior
        document.activeElement.blur(); // Unfocus the contenteditable area
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
});
});
// Add event listener for topbar pin button
document.getElementById('topbarPinBtn').addEventListener('click', () => {
  const selection = window.getSelection();
  if (selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  const currentBlock = range.startContainer.parentElement.closest('.block');
  if (currentBlock) {
    if (currentBlock.classList.contains('pinned')) {
      currentBlock.classList.remove('pinned')
      return;
    }
    // Unpin other blocks
    document.querySelectorAll('.block.pinned').forEach(b => b.classList.remove('pinned'));
    currentBlock.classList.add('pinned');
  }
});
