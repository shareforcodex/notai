import HTMLEditor from "./editor.js";
import { currentUser } from "./state.js";

let editorInstance = null;

function stopMediaTracks() {
  if (editorInstance && typeof editorInstance.stopMediaTracks === "function") {
    editorInstance.stopMediaTracks();
  }
}

window.addEventListener("blur", () => {
  stopMediaTracks();
}, { once: true });

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopMediaTracks();
  }
});

window.addEventListener("load", () => {
  setTimeout(() => {
    caches.open("app-cache").then(cache => {
      cache.addAll([
        "./",
        "./index.html",
        "./styles.css",
        "./js/main.js",
        "./js/editor.js",
        "./js/utils.js",
        "./js/constants.js",
        "./js/state.js",
        "./icons/notai-192x192.png",
        "./icons/notai-512x512.png",
      ]);

      console.log("App cache updated");
      cache.addAll([
        "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css",
        "https://corsp.suisuy.eu.org?https://cdn.jsdelivr.net/npm/marked/marked.min.js",
      ]);
    });
  }, 5000);
});

document.addEventListener("DOMContentLoaded", async () => {
  try {
    editorInstance = new HTMLEditor();
    window.editor = editorInstance;
    editorInstance.loadFolders();

    const profileModal = document.getElementById("profileModal");
    const userProfileBtn = document.getElementById("userProfileBtn");
    const closeProfileBtn = profileModal?.querySelector(".close, .close-profile-btn");
    const currentUserIdSpan = document.getElementById("currentUserId");

    if (userProfileBtn && profileModal && closeProfileBtn && currentUserIdSpan) {
      userProfileBtn.addEventListener("click", () => {
        currentUserIdSpan.textContent = currentUser.userId || "Unknown";
        profileModal.style.display = "block";
      });

      closeProfileBtn.addEventListener("click", () => {
        profileModal.style.display = "none";
      });
    }
  } catch (error) {
    console.error("Error initializing editor:", error);
  }

  document.body.addEventListener("click", (event) => {
    const target = event.target;
    if (target.tagName === "IMG" || target.tagName === "VIDEO" || target.tagName === "AUDIO") {
      event.preventDefault();
      document.activeElement?.blur();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      let url = target.src;
      if (url.length > 200) {
        url = url.substring(0, 200) + "..." + url.slice(-10);
      }
      if (typeof midiaURLContainer !== "undefined") {
        midiaURLContainer.innerText = url;
        midiaURLContainer.classList.remove("hidden");
      }

      if (target.tagName === "IMG" && typeof imgDisplay !== "undefined") {
        imgDisplay.src = target.src;
      }
    } else if (target.id === "midiaURLContainer" && typeof midiaURLContainer !== "undefined") {
      navigator.clipboard.writeText(midiaURLContainer.innerHTML).then(() => {
        editorInstance?.showToast("Copied to clipboard", "success");
        midiaURLContainer.classList.add("hidden");
      }).catch(err => {
        console.error("Failed to copy: ", err);
        editorInstance?.showToast("Failed to copy", "error");
      });
    } else {
      if (typeof midiaURLContainer !== "undefined") {
        midiaURLContainer.classList.add("hidden");
      }
      if (typeof imgDisplay !== "undefined") {
        imgDisplay.classList.add("hidden");
      }
    }
  });

  let setEditableTimeoutID = 0;
  document.body.addEventListener("pointerdown", (event) => {
    const target = event.target;
    let blockElem = target;
    while (blockElem && blockElem !== document.body) {
      if (blockElem.classList && blockElem.classList.contains("block")) {
        if (!blockElem.isContentEditable && editorInstance?.editor) {
          editorInstance.editor.setAttribute("contenteditable", "false");
          clearTimeout(setEditableTimeoutID);
          setEditableTimeoutID = setTimeout(() => {
            editorInstance?.editor?.setAttribute("contenteditable", "true");
          }, 500);
          break;
        }
      }
      blockElem = blockElem.parentElement;
    }
  });

  const topbarPinBtn = document.getElementById("topbarPinBtn");
  topbarPinBtn?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const currentBlock = range.startContainer.parentElement.closest(".block");
    if (currentBlock) {
      if (currentBlock.classList.contains("pinned")) {
        currentBlock.classList.remove("pinned");
        setTimeout(() => {
          currentBlock.scrollIntoView({ behavior: "smooth", block: "start" });
          currentBlock.classList.add("highlight");
          setTimeout(() => {
            currentBlock.classList.remove("highlight");
          }, 1000);
        }, 200);
        return;
      }
      document.querySelectorAll(".pinned").forEach(b => b.classList.remove("pinned"));
      currentBlock.classList.add("pinned");
    }
  });

  window.addEventListener("pointerup", () => {
    const selectionText = window.getSelection()?.toString() || "";
    if (selectionText.length > 0) {
      window.selectionText = selectionText;
    }
  });

  const updateAppBtn = document.querySelector("#updateAppBtn");
  updateAppBtn?.addEventListener("click", () => {
    caches.delete("app-cache").then(() => {
      console.log("Cache deleted");
    });
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => {
        registration.unregister().then((res) => {
          if (res) {
            console.log("Service worker unregistered");
            setTimeout(() => {
              if (confirm(" Reload the page to update?")) {
                window.location.reload();
              }
            }, 2000);
          }
        });
      });
    });
    setTimeout(() => {
      window.location.reload();
    }, 3000);
  });
});
