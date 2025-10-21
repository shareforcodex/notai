export function initializeEditor(instance) {
  instance.DEFAULT_SYSTEM_PROMPT = `
you are a assistant with most advanced knowledge, you should write html doc to reply me,  only output html body innerHTML code
to me, don't put it in codeblock do not use markdown;
you can put a head h2 with 2 to 5 words at start to summary the doc, aligned at left;

use inline style to avoid affect parent element, make the html doc looks beautiful, clean and mordern, make style like MDN site.


you can use image to show the concept when needed, like show a word definition via image, the img get api is simple, put the prompt after https://image.pollinations.ai/prompt/(you prompt for image here)??model=kontext , so you can just put it in a img tag, don't set any style of the img tag.

you can use audio tag too, when use asked you response in voice, use this get api https://text.pollinations.ai/(text prompt here)?model=openai-audio&voice=coral put it in audio tag, it will return audio response for the text prompt, don't set any style of the audio tag.  if user request TTS, you can use this api https://text.pollinations.ai/you are TTS engin now, just repeat this:(put the text you want to say here)?model=openai-audio&voice=coral

when in voice mode, you need not wrap text in html tags like div br span ..., just use markdown response me,only need simple img,audio,video tag for showing media when need

`;

  const editor = document.getElementById("editor");
  const sourceView = document.getElementById("sourceView");
  const toolbar = document.querySelector(".toolbar");
  const aiToolbar = document.getElementById("aiToolbar");

  instance.lastPointerPosition = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  instance.updateRecentNotesUI();

  document.addEventListener("pointerdown", (event) => {
    instance.lastPointerPosition = { x: event.clientX, y: event.clientY };
  });

  instance.DEFAULT_MODELS = [
    { name: "gpt-4o", model_id: "gpt-4o", url: "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions", api_key: "" },
    { name: "gpt-4o-mini", model_id: "gpt-4o-mini", url: "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions", api_key: "" },
    { name: "Meta-Llama-3.1-405B-Instruct", model_id: "Meta-Llama-3.1-405B-Instruct", url: "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions", api_key: "" },
    { name: "Llama-3.2-90B-Vision-Instruct", model_id: "Llama-3.2-90B-Vision-Instruct", url: "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions", api_key: "" },
    { name: "Mistral-large", model_id: "Mistral-large", url: "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions", api_key: "" },
  ];

  if (!editor || !sourceView || !toolbar || !aiToolbar) {
    console.error("Required editor elements not found");
    return;
  }

  instance.editor = editor;
  instance.sourceViewEditor = CodeMirror.fromTextArea(sourceView, {
    mode: "htmlmixed",
    lineNumbers: true,
    autoCloseTags: true,
    matchBrackets: true,
    autoCloseBrackets: true,
    indentUnit: 2,
    tabSize: 2,
    lineWrapping: true,
    foldGutter: true,
    styleActiveLine: true,
  });

  setTimeout(() => {
    const editorView = instance.sourceViewEditor.getWrapperElement();
    editorView.style.display = "none";
    editorView.style.height = "80vh";
  }, 2000);

  instance.toolbar = toolbar;
  instance.aiToolbar = aiToolbar;
  instance.currentNoteTitle = "";
  instance.lastSavedContent = "";
  instance.lastUpdated = null;
  instance.lastInteractionTime = 0;
  instance.aiSettings = {
    systemPrompt: instance.DEFAULT_SYSTEM_PROMPT,
    prompts: {
      ask: "Answer this question: {text}",
      correct: "Correct any grammar or spelling errors in this text: {text}",
      translate: "Translate this text to English: {text}",
    },
    customTools: [],
    models: [...instance.DEFAULT_MODELS],
    else: {
      enable_stream: true,
    },
  };

  instance.loadUserConfig();
  instance.setupEventListeners();
  instance.setupAIToolbar();
  instance.setupAISettings();
  instance.setupTableOfContents();
  instance.setupCommentSystem();
  instance.updateAIToolbar();

  setTimeout(() => instance.resetHistoryWithCurrentContent(), 0);

  const titleElement = document.getElementById("noteTitle");
  titleElement.addEventListener("input", () => instance.delayedSaveNote());

  instance.currentBlock = null;
  instance.content = "";
  instance.isSourceView = false;
  instance.isEditable = true;
  instance.autoSaveTimeout = null;
  instance.audioRecordType = "audio/webm";

  if (!MediaRecorder.isTypeSupported("audio/webm")) {
    instance.audioRecordType = "audio/mp4";
  }

  instance.audioRecordExt = instance.audioRecordType.split("/")[1];
  instance.videoRecordType = `video/${instance.audioRecordExt}`;
  instance.videoRecordExt = instance.audioRecordExt;

  instance.checkAuthAndLoadNotes();
  instance.loadFolders();
  instance.setupCodeCopyButton();
  instance.initializeHistory();

  instance.inputToUpdateLastUpdatedTimeoutID = 0;
  instance.editor.addEventListener("pointerdown", (event) => {
    instance.currentBlock?.classList?.remove("currentBlock");

    instance.currentBlock = instance.getCurrentOtterBlock(event.target);
    instance.currentBlock?.classList?.add("highlight");
    instance.currentBlock?.classList?.add("currentBlock");

    setTimeout(() => {
      instance.currentBlock?.classList?.remove("highlight");
    }, 1500);

    if (event.target.tagName === "U") {
      let node = event.target;
      while (node) {
        if (node.classList && node.classList.contains("showcomment")) {
          instance.showCommentTooltip(event.target.id, event);
          return;
        }
        node = node.parentElement;
      }

      document.querySelector(".showcomment")?.classList.remove("showcomment");
      instance.showCommentTooltip(event.target.id, event);
    } else {
      let node = event.target;
      while (node) {
        if (node.classList && node.classList.contains("comment")) {
          return;
        }
        node = node.parentElement;
      }

      document.querySelectorAll(".showcomment").forEach((element) => {
        element.classList.remove("showcomment");
      });
    }
  });
}
