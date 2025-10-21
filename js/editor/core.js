import { API_BASE_URL } from "../constants.js";
import { currentUser } from "../state.js";

export const coreMethods = {
  getCurrentOtterBlock(startElement) {
    if (!startElement) {
      startElement = document.activeElement || document.querySelector('.block');
      if (!startElement) {
        return null;
      }
    }

    let currentElement = startElement;
    let closestBlock = currentElement.classList.contains('block')
      ? currentElement
      : currentElement.closest('.block');

    if (!closestBlock) {
      return null;
    }

    let outermostBlock = closestBlock;
    let parent = outermostBlock.parentElement;

    while (parent && parent !== document.body) {
      if (parent.classList.contains('block')) {
        outermostBlock = parent;
      }
      parent = parent.parentElement;
    }

    return outermostBlock;
  },

  setupCodeCopyButton() {
    const copyBtn = document.getElementById('codeCopyBtn');
    if (!copyBtn) {
      return;
    }

    let activeCodeElement = null;

    document.addEventListener('pointerdown', (event) => {
      const target = event.target;
      const codeElement = target?.closest?.('pre, code');

      if (codeElement) {
        activeCodeElement = codeElement;
        const rect = codeElement.getBoundingClientRect();
        let parentDiv = codeElement;
        while (parentDiv && parentDiv.nodeName !== 'DIV') {
          parentDiv = parentDiv.parentElement;
        }
        const parentRect = parentDiv?.getBoundingClientRect?.() ?? rect;
        let top = Math.max(rect.top, parentRect.top);
        let left = parentRect.left;

        if (rect.top < 0) {
          top = window.scrollY;
        }

        copyBtn.style.left = `${left}px`;
        copyBtn.style.top = `${top}px`;
        copyBtn.style.display = 'block';
      } else if (!event.target.closest('#codeCopyBtn')) {
        copyBtn.style.display = 'none';
        activeCodeElement = null;
      }
    });

    document.addEventListener('scroll', () => {
      if (!activeCodeElement || copyBtn.style.display === 'none') {
        return;
      }

      const rect = activeCodeElement.getBoundingClientRect();
      const buttonRect = copyBtn.getBoundingClientRect();

      if (rect.top < 0 && rect.bottom > buttonRect.height) {
        copyBtn.style.top = `${window.scrollY}px`;
      } else if (rect.top >= 0) {
        copyBtn.style.top = `${rect.top + window.scrollY}px`;
      } else {
        copyBtn.style.display = 'none';
        activeCodeElement = null;
      }
    });

    copyBtn.addEventListener('click', async () => {
      if (!activeCodeElement) {
        return;
      }

      try {
        await navigator.clipboard.writeText(activeCodeElement.innerText);
        copyBtn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
          copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
          copyBtn.style.display = 'none';
        }, 2000);
      } catch (error) {
        console.error('Failed to copy text:', error);
      }
    });
  },

  showSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (!spinner) return;

    let x = this.lastPointerPosition.x;
    let y = this.lastPointerPosition.y;
    const spinnerSize = 40;

    if (x + spinnerSize > window.innerWidth) {
      x = window.innerWidth - spinnerSize - 10;
    }
    if (y + spinnerSize > window.innerHeight) {
      y = window.innerHeight - spinnerSize - 10;
    }

    spinner.style.left = `${x}px`;
    spinner.style.top = `${y}px`;
    spinner.style.display = 'block';

    this.spinnerTimeout = setTimeout(() => {
      this.hideSpinner();
    }, 15000);
  },

  hideSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (!spinner) return;

    spinner.style.display = 'none';

    if (this.spinnerTimeout) {
      clearTimeout(this.spinnerTimeout);
      this.spinnerTimeout = null;
    }
  },

  async apiRequest(method, endpoint, body = null, isAIRequest = false, noSpinner = false) {
    if (!noSpinner) this.showSpinner();

    const headers = {
      'Content-Type': 'application/json',
    };

    if (isAIRequest) {
      const model = this.aiSettings.models.find((m) => m.model_id === body?.model);
      if (model?.api_key) {
        headers['Authorization'] = `Bearer ${model.api_key}`;
      }
    } else if (currentUser.userId && currentUser.credentials) {
      headers['Authorization'] = `Basic ${currentUser.credentials}`;
    }

    try {
      const url = isAIRequest
        ? 'https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions'
        : `${API_BASE_URL}${endpoint}`;

      let elseconfig = {};
      try {
        elseconfig = JSON.parse(this.aiSettings.models.find((m) => m.model_id === body?.model)?.else || '{}');
      } catch (error) {
        console.log('error when parse else config', error);
      }

      const response = await fetch(
        isAIRequest && body?.model
          ? this.aiSettings.models.find((m) => m.model_id === body.model)?.url ||
            'https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions'
          : url,
        {
          method,
          headers,
          body: method === 'GET' ? null : body ? JSON.stringify({ ...body, ...elseconfig }) : null,
        },
      );

      this.hideSpinner();
      if (isAIRequest) {
        return response;
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      this.hideSpinner();
      return { error: 'Network error' };
    }
  },

  convertNewlinesToBreaks(text) {
    return (text ?? '').replace(/\n/g, '<br>');
  },

  htmlToMarkdown(html) {
    let md = html ?? '';
    md = md.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n');
    md = md.replace(/<h2>(.*?)<\/h2>/gi, '## $1\n');
    md = md.replace(/<h3>(.*?)<\/h3>/gi, '### $1\n');
    md = md.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
    md = md.replace(/<em>(.*?)<\/em>/gi, '*$1*');
    md = md.replace(/<a href="(.*?)">(.*?)<\/a>/gi, '[$2]($1)');
    md = md.replace(/<img src="(.*?)".*?>/gi, '![]($1)');
    md = md.replace(/<ul>(.*?)<\/ul>/gi, '$1\n');
    md = md.replace(/<ol>(.*?)<\/ol>/gi, '$1\n');
    md = md.replace(/<li>(.*?)<\/li>/gi, '- $1\n');
    md = md.replace(/<p>(.*?)<\/p>/gi, '$1\n\n');
    md = md.replace(/&nbsp;/g, ' ');
    return md.trim();
  },

  async fetchReadmeContent() {
    try {
      const response = await fetch('README.md');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      console.error('Failed to fetch README.md:', error);
      return `Welcome ! this is all new UI to interact with ai models,  you can write your note here, select some text and use the AI toolbar to generate content based on your text.
 go to <a href="https://github.com/suisuyy/notai/tree/can?tab=readme-ov-file#introduction"> Help </a>  to see how to use the Note taking app powered by LLM
`;
    }
  },

  async loadHelpPage() {
    try {
      const readmeContent = await this.fetchReadmeContent();
      const helpMarkdown = document.getElementById('helpMarkdown');
      if (helpMarkdown) {
        helpMarkdown.innerHTML = marked.parse(readmeContent);
      }
      window.location.href = 'help.html';
    } catch (error) {
      console.error('Error loading help page:', error);
      this.showToast('Failed to load help page.');
    }
  },

  insertContent(text) {
    this.editor.innerHTML += this.convertNewlinesToBreaks(text);
  },

  toggleEditable() {
    this.isEditable = !this.isEditable;
    this.editor.contentEditable = this.isEditable;
    document.getElementById('noteTitle').contentEditable = this.isEditable;

    const button = document.getElementById('toggleEditableBtn');
    const icon = button.querySelector('i');
    if (this.isEditable) {
      icon.className = 'fas fa-lock-open';
      button.title = 'Lock Editor';
    } else {
      icon.className = 'fas fa-lock';
      button.title = 'Unlock Editor';
    }
  },

  toggleSourceView() {
    this.isSourceView = !this.isSourceView;
    const editor = this.editor;

    if (this.isSourceView) {
      this.editor.style.display = 'none';
      this.sourceViewEditor.getWrapperElement().style.display = 'block';
      this.sourceViewEditor.setValue(editor.innerHTML);

      setTimeout(() => {
        const formattedCode = prettier.format(this.editor.innerHTML, {
          parser: 'html',
          plugins: [prettierPlugins.html],
          trailingComma: 'es5',
          tabWidth: 4,
          useTabs: false,
          singleQuote: true,
        });
        this.sourceViewEditor.setValue(formattedCode);
      }, 1000);
    } else {
      this.editor.innerHTML = this.sourceViewEditor.getValue();
      this.editor.style.display = 'block';
      this.sourceViewEditor.getWrapperElement().style.display = 'none';
      this.delayedSaveNote();
    }
  },,

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
};
