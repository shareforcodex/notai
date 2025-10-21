import { initializeEditor } from "./bootstrap.js";
import { coreMethods } from "./core.js";
import { eventMethods } from "./events.js";
import { aiMethods } from "./ai.js";
import { commentMethods } from "./comments.js";
import { formattingMethods } from "./formatting.js";
import { authMethods } from "./auth.js";
import { libraryMethods } from "./library.js";
import { noteMethods } from "./notes.js";
import { mediaMethods } from "./media.js";

class HTMLEditor {
  constructor() {
    initializeEditor(this);
  }
}

Object.assign(
  HTMLEditor.prototype,
  coreMethods,
  eventMethods,
  aiMethods,
  commentMethods,
  formattingMethods,
  authMethods,
  libraryMethods,
  noteMethods,
  mediaMethods,
);

export default HTMLEditor;
