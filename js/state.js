export const currentUser = {
  userId: localStorage.getItem("userId"),
  credentials: localStorage.getItem("credentials"),
};

export const globalDevices = {
  mediaStream: null,
};

export function setCurrentUser({ userId = null, credentials = null }) {
  currentUser.userId = userId;
  currentUser.credentials = credentials;
}

export function clearCurrentUser() {
  setCurrentUser({ userId: null, credentials: null });
}
