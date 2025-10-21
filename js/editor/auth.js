import { currentUser, setCurrentUser, clearCurrentUser } from "../state.js";



export const authMethods = {

  async register(userId, password, email) {
    const passwordHash = CryptoJS.SHA256(password).toString();
    const result = await this.apiRequest("POST", "/users", {
      user_id: userId,
      password_hash: passwordHash,
      email,
    });

    if (result.success) {
      setCurrentUser({ userId, credentials: passwordHash });
      localStorage.setItem("userId", userId);
      localStorage.setItem("passwordHash", passwordHash);
      this.updateAuthUI();
      await this.loadNotes();
      return true;
    }
    return false;
  },

  async login(userId, password) {
    const passwordHash = btoa(password);
    const result = await this.apiRequest("GET", "/notes"); // Test auth with notes endpoint

    if (!result.error) {
      setCurrentUser({ userId, credentials: passwordHash });
      localStorage.setItem("userId", userId);
      localStorage.setItem("passwordHash", passwordHash);
      this.updateAuthUI();
      await this.loadNotes();
      return true;
    }
    return false;
  },

  logout() {
    clearCurrentUser();
    localStorage.removeItem("userId");
    localStorage.removeItem("credentials");
    this.updateAuthUI();
    this.clearNotes();
  },

  updateAuthUI() {
    const isLoggedIn = currentUser.userId && currentUser.credentials;
    if (!isLoggedIn) {
      //ask user to confirm login yes to login, no do nothin
      let confirmLogin = confirm('Do you want to login?');
      if (confirmLogin) {

        window.location.href = "auth.html";

      }
    }
  },

  async checkAuthAndLoadNotes() {
    let defaultNote= null;
    // Load default note on initial startup only if nothing is selected yet
    if (!this.currentNoteId) {
      this.loadNote("default_note_" + currentUser.userId);
    }
    

    
    if (currentUser.userId && currentUser.credentials) {
      const notes = await this.apiRequest("GET", `/folders/1733485657799jj0.5911120915160637/notes`);
      if (!notes.error) {
        // Check for default note
         defaultNote = notes.find((note) => note.title === "default_note");
         


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
            //only load default note when current note is default note
            if(this.currentNoteId === "default_note_" + currentUser.userId){
              await this.loadNote("default_note_" + currentUser.userId);
            }
          }
        } else {
          // Only load the default note if it's still the active/empty selection
          const defaultNoteId = "default_note_" + currentUser.userId;
          if (!this.currentNoteId || this.currentNoteId === defaultNoteId) {
            await this.loadNote(defaultNoteId);
          }
          // Always refresh the notes list
          await this.loadNotes();
        }
      } else {
        //this.logout();
      }
    } else {
      this.logout();
    }
  }

};
