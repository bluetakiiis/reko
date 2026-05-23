const API_BASE = window.REKO_API_BASE || "http://localhost:3000";

function apiUrl(path) {
  return new URL(path, API_BASE).toString();
}

async function apiJson(path, options = {}) {
  const token = window.rekoFirebaseAuthState?.idToken || null;
  const headers = new Headers(options.headers || {});

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
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

async function getDramasData() {
  if (window.__rekoDramasData) {
    return window.__rekoDramasData;
  }

  const data = await apiJson("/api/dramas");

  window.__rekoDramasData = {
    kdramaRecommendations: data?.kdramaRecommendations || [],
    cdramaRecommendations: data?.cdramaRecommendations || [],
    kdramaSidebar: data?.kdramaSidebar || [],
    cdramaSidebar: data?.cdramaSidebar || [],
  };

  return window.__rekoDramasData;
}

async function persistDramasToServer() {
  try {
    await apiJson("/api/dramas", {
      method: "PUT",
      body: JSON.stringify(window.__rekoDramasData || {}),
    });

    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

function saveDataToStorage() {}

window.apiJson = apiJson;
window.getDramasData = getDramasData;
window.persistDramasToServer = persistDramasToServer;
window.saveDataToStorage = saveDataToStorage;
