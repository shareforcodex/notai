class NotionEditor {
    constructor() {
        this.editor = document.getElementById('editor');
        this.toolbar = document.querySelector('.toolbar');
        this.setupEventListeners();
        this.currentBlock = null;
    }

    setupEventListeners() {
        // Media insert buttons
        document.getElementById('insertImage').addEventListener('click', () => this.insertMedia('image'));
        document.getElementById('insertAudio').addEventListener('click', () => this.insertMedia('audio'));
        document.getElementById('insertVideo').addEventListener('click', () => this.insertMedia('video'));
        document.getElementById('insertIframe').addEventListener('click', () => this.insertIframe());

        // Format buttons
        document.querySelectorAll('.formatting-tools button[data-command]').forEach(button => {
            button.addEventListener('click', () => {
                const command = button.dataset.command;
                this.executeCommand(command);
            });
        });

        // Heading select
        document.getElementById('headingSelect').addEventListener('change', (e) => {
            this.formatBlock(e.target.value);
        });

        // Text color
        document.getElementById('textColor').addEventListener('input', (e) => {
            document.execCommand('foreColor', false, e.target.value);
        });

        // Add block button
        document.getElementById('addBlockBtn').addEventListener('click', () => {
            this.addNewBlock();
        });

        // Handle keyboard shortcuts
        this.editor.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.handleEnterKey(e);
            }
            if (e.key === '/' && !e.shiftKey) {
                this.showBlockMenu(e);
            }
        });
    }

    executeCommand(command, value = null) {
        document.execCommand(command, false, value);
        this.editor.focus();
    }

    formatBlock(tag) {
        document.execCommand('formatBlock', false, `<${tag}>`);
    }

    addNewBlock() {
        const block = document.createElement('div');
        block.className = 'block';
        block.contentEditable = true;
        block.innerHTML = '<p>New block</p>';
        this.editor.appendChild(block);
        block.focus();
    }

    handleEnterKey(e) {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const currentBlock = range.startContainer.parentElement.closest('.block');

        if (currentBlock) {
            const isEmpty = currentBlock.textContent.trim() === '';
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
        const url = prompt('Enter URL:');
        if (url) {
            document.execCommand('createLink', false, url);
        }
    }

    insertMedia(type) {
        const url = prompt(`Enter ${type} URL:`);
        if (!url) return;

        const block = document.createElement('div');
        block.className = `block media-block ${type}-block`;
        
        let mediaElement;
        switch(type) {
            case 'image':
                mediaElement = document.createElement('img');
                mediaElement.src = url;
                mediaElement.alt = 'Inserted image';
                break;
            case 'audio':
                mediaElement = document.createElement('audio');
                mediaElement.src = url;
                mediaElement.controls = true;
                break;
            case 'video':
                mediaElement = document.createElement('video');
                mediaElement.src = url;
                mediaElement.controls = true;
                break;
        }

        block.appendChild(mediaElement);
        this.editor.appendChild(block);
    }

    insertIframe() {
        const url = prompt('Enter webpage URL:');
        if (!url) return;

        const block = document.createElement('div');
        block.className = 'block iframe-block';
        
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.width = '100%';
        iframe.height = '400px';
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allowfullscreen', 'true');
        
        block.appendChild(iframe);
        this.editor.appendChild(block);
    }
}

// Initialize the editor
document.addEventListener('DOMContentLoaded', () => {
    window.editor = new NotionEditor();
});
