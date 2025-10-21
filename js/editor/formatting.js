export const formattingMethods = {

  executeCommand(command, value = null) {
    // Snapshot before formatting command
    this.recordSnapshot('execCommand:' + command);
         document.execCommand(command, false, value);
     // Snapshot after if content changed (coalescing handled by recordSnapshot)
     this.recordSnapshot('execCommand:after:' + command);
     this.editor.focus();
     // Hide menus if any open
     this.hideAllDropdowns();
  },

  formatBlock(tag) {
    this.recordSnapshot('formatBlock:' + tag);
         document.execCommand("formatBlock", false, `<${tag}>`);
     this.recordSnapshot('formatBlock:after:' + tag);
     // Hide menus if any open
     this.hideAllDropdowns();
   },

  addNewBlock() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // if (selectedText) {
    //   // Create a new block element
    //   const block = document.createElement("div");
    //   block.className = "block";
    //   block.innerHTML = selectedText;
    //   block.classList.add('highlight');
    //   setTimeout(() => {
    //     block.classList.remove('highlight');
    //   }, 1500);

    //   // Get the range of the selected text
    //   const range = selection.getRangeAt(0);

    //   // Replace the selected text with the new block
    //   range.deleteContents();
    //   range.insertNode(block);

    //   // Clear the selection
    //   selection.removeAllRanges();

    //   // Focus the new block
    //   const textNode = block;
    //   if (textNode) {
    //     textNode.focus();
    //     const newRange = document.createRange();
    //     newRange.selectNodeContents(textNode);
    //     newRange.collapse(true);
    //     selection.addRange(newRange);
    //   }

    //   return block;
    // }

    // Create new block for non-selected text case
    const block = document.createElement("div");
    block.className = "block";
    block.innerHTML = '<br><br><br><br>';


    // Add highlight effect
    block.classList.add('highlight');
    setTimeout(() => {
      block.classList.remove('highlight');
    }, 1000);

    // Get current selection and find closest block
    const range = selection.getRangeAt(0);
    let currentBlock = this.currentBlock;

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
      if (this.editor.contains(range.commonAncestorContainer)) {
        range.collapse(false); // Collapse to end
        range.insertNode(blankLine);
        blankLine.after(block);
        block.after(document.createElement('br'));
        this.currentBlock = block;

      }


    }

    // Focus the new block and move cursor inside
    block.focus();
    const newRange = document.createRange();
    newRange.selectNodeContents(block);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
    return block;
  },

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
  },

  createLink() {
    const url = prompt("Enter URL:");
    if (url) {
      document.execCommand("createLink", false, url);
    }
  },

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


  },

  insertIframe() {


    const url = prompt("Enter webpage URL:");
    if (!url) return;


    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute("allow", "accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; magnetometer; microphone; midi; payment; speaker; usb; vr");

    const range = window.getSelection().getRangeAt(0);
    //insert after range instead replace range


    range.insertNode(document.createElement('br'));
    range.collapse(false);
    range.insertNode(iframe);
  },

  convertToPlainText() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    if (!selectedText) return;

    // Insert a temporary span with the raw text at the selection
    const tempSpan = document.createElement('span');
    tempSpan.textContent = selectedText; // ensures plain text
    tempSpan.setAttribute('data-plain-temp', '1');

    // Replace selection contents with the temp span
    range.deleteContents();
    range.insertNode(tempSpan);

    // Select the temp span's contents
    const tempRange = document.createRange();
    tempRange.selectNodeContents(tempSpan);
    selection.removeAllRanges();
    selection.addRange(tempRange);

    // Remove inline formatting (bold/italic/links/etc.) within the selected span
    try {
      document.execCommand('removeFormat');
    } catch (_) {}

    // If inside a heading (h1–h4), split the heading so only the selection becomes plain text
    const heading = tempSpan.closest && tempSpan.closest('h1,h2,h3,h4');
    if (heading) {
      const level = heading.tagName.toLowerCase();

      // Build fragments for the parts before and after the selection within the heading
      const beforeRange = document.createRange();
      beforeRange.selectNodeContents(heading);
      beforeRange.setEndBefore(tempSpan);
      const hasBefore = beforeRange.toString().length > 0;
      const beforeFrag = hasBefore ? beforeRange.cloneContents() : null;

      const afterRange = document.createRange();
      afterRange.selectNodeContents(heading);
      afterRange.setStartAfter(tempSpan);
      const hasAfter = afterRange.toString().length > 0;
      const afterFrag = hasAfter ? afterRange.cloneContents() : null;

      const parent = heading.parentNode;
      const nextSibling = heading.nextSibling;

      // Remove original heading
      parent.removeChild(heading);

      // Insert before-heading portion (still a heading)
      if (hasBefore) {
        const beforeHeading = document.createElement(level);
        beforeHeading.appendChild(beforeFrag);
        parent.insertBefore(beforeHeading, nextSibling);
      }

      // Insert the selected portion as plain text block
      const plainDiv = document.createElement('div');
      plainDiv.textContent = tempSpan.textContent;
      parent.insertBefore(plainDiv, nextSibling);

      // Insert after-heading portion (still a heading)
      if (hasAfter) {
        const afterHeading = document.createElement(level);
        afterHeading.appendChild(afterFrag);
        parent.insertBefore(afterHeading, nextSibling);
      }

      // Place cursor at end of the inserted plain text block
      const newSel = window.getSelection();
      const caretRange = document.createRange();
      caretRange.selectNodeContents(plainDiv);
      caretRange.collapse(false);
      newSel.removeAllRanges();
      newSel.addRange(caretRange);
      return;
    }

    // Otherwise, not inside a heading: replace the temp span with a pure text node
    const plainTextNode = document.createTextNode(tempSpan.textContent);
    tempSpan.parentNode.replaceChild(plainTextNode, tempSpan);

    // Place caret after the inserted plain text
    const afterRange = document.createRange();
    afterRange.setStartAfter(plainTextNode);
    afterRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(afterRange);
  }

};
