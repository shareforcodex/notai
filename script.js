class NotionEditor {
    constructor() {
        this.editor = document.getElementById('editor');
        this.toolbar = document.querySelector('.toolbar');
        this.setupEventListeners();
        this.currentBlock = null;
    }

    setupEventListeners() {
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
}

// Initialize the editor
document.addEventListener('DOMContentLoaded', () => {
    window.editor = new NotionEditor();
});
