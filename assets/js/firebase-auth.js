const API_BASE = window.REKO_API_BASE || window.location.origin;

function apiUrl(path) {
  return new URL(path, API_BASE).toString();
}

async function fetchJson(path, options = {}) {
  const headers = new Headers(options.headers || {});

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Request failed with ${response.status}`);
  }

  return response.status === 204 ? null : response.json();
}

const firebaseConfig = await fetchJson("/api/firebase-config").catch(
  (error) => {
    console.error("Failed to load Firebase config:", error);
    return null;
  },
);

let authReadyResolve;
export const authReady = new Promise((resolve) => {
  authReadyResolve = resolve;
});

function finishAuthReady() {
  if (authReadyResolve) {
    authReadyResolve();
    authReadyResolve = null;
  }
}

let currentUser = null;
window.rekoFirebaseAuthState = {
  ready: false,
  currentUser: null,
  idToken: null,
};

if (firebaseConfig) {
  const { initializeApp } =
    await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js");
  const {
    browserLocalPersistence,
    getAuth,
    onAuthStateChanged,
    setPersistence,
    signInAnonymously,
  } =
    await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js");

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    window.rekoFirebaseAuthState.currentUser = user;
    if (user) {
      void user.getIdToken().then((token) => {
        window.rekoFirebaseAuthState.idToken = token;
      });
      finishAuthReady();
    }
  });

  try {
    await setPersistence(auth, browserLocalPersistence);
    const credential = await signInAnonymously(auth);
    currentUser = credential.user;
    window.rekoFirebaseAuthState.currentUser = currentUser;
    window.rekoFirebaseAuthState.idToken = await currentUser.getIdToken();
  } catch (error) {
    console.error("Anonymous Firebase auth failed:", error);
  } finally {
    window.rekoFirebaseAuthState.ready = true;
    finishAuthReady();
  }
} else {
  window.rekoFirebaseAuthState.ready = true;
  finishAuthReady();
}

export async function getIdToken(forceRefresh = false) {
  await authReady;

  if (!currentUser) {
    return null;
  }

  return currentUser.getIdToken(forceRefresh);
}

export function getCurrentIdToken() {
  const user = window.rekoFirebaseAuthState.currentUser || currentUser;

  if (!user) {
    return null;
  }

  return user.getIdToken();
}

export async function getAdminSession() {
  await authReady;
  return fetchJson("/api/admin/session");
}

export async function unlockAdmin(puzzlePayload) {
  await authReady;
  const token = await getIdToken(true);

  if (!token) {
    throw new Error("Anonymous auth is not ready.");
  }

  return fetchJson("/api/admin/unlock", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(puzzlePayload || {}),
  });
}

export async function logoutAdmin() {
  await authReady;
  return fetchJson("/api/admin/logout", {
    method: "POST",
  });
}
