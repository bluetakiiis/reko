const {
  ADMIN_SESSION_COOKIE,
  applyCors,
  getCookieValue,
  handleCorsPreflight,
  initFirestore,
  json,
  parseBody,
  readDoc,
  verifySessionToken,
  withTimeout,
  writeDoc,
} = require("./_shared.js");

async function ensureFirestore() {
  try {
    await withTimeout(
      initFirestore(),
      Number(process.env.FIRESTORE_INIT_TIMEOUT_MS || 10000),
    );
  } catch (error) {
    console.error(
      "Firestore init error:",
      error && error.message ? error.message : error,
    );
  }
}

module.exports = async (req, res) => {
  if (handleCorsPreflight(req, res)) {
    return;
  }

  applyCors(req, res);

  if (req.method === "GET") {
    await ensureFirestore();

    if (
      !process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON &&
      !process.env.GOOGLE_APPLICATION_CREDENTIALS
    ) {
      json(res, 503, { error: "Firestore is unavailable." });
      return;
    }

    try {
      const [
        kdramaRecommendations,
        cdramaRecommendations,
        kdramaSidebar,
        cdramaSidebar,
      ] = await Promise.all([
        readDoc("recommendations", "kdrama", "cards"),
        readDoc("recommendations", "cdrama", "cards"),
        readDoc("sidebar", "kdrama", "dramas"),
        readDoc("sidebar", "cdrama", "dramas"),
      ]);

      json(res, 200, {
        kdramaRecommendations,
        cdramaRecommendations,
        kdramaSidebar,
        cdramaSidebar,
      });
    } catch (error) {
      console.error("Failed to load dramas:", error);
      json(res, 500, { error: "Failed to load drama data." });
    }
    return;
  }

  if (req.method === "PUT") {
    const session = verifySessionToken(
      getCookieValue(req.headers.cookie || "", ADMIN_SESSION_COOKIE),
    );

    if (!session) {
      json(res, 401, { error: "Admin session required." });
      return;
    }

    await ensureFirestore();

    if (
      !process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON &&
      !process.env.GOOGLE_APPLICATION_CREDENTIALS
    ) {
      json(res, 503, { error: "Firestore is unavailable." });
      return;
    }

    const payload = parseBody(req) || {};
    const kdramaRecommendations = Array.isArray(payload.kdramaRecommendations)
      ? payload.kdramaRecommendations
      : [];
    const cdramaRecommendations = Array.isArray(payload.cdramaRecommendations)
      ? payload.cdramaRecommendations
      : [];
    const kdramaSidebar = Array.isArray(payload.kdramaSidebar)
      ? payload.kdramaSidebar
      : [];
    const cdramaSidebar = Array.isArray(payload.cdramaSidebar)
      ? payload.cdramaSidebar
      : [];

    try {
      await Promise.all([
        writeDoc("recommendations", "kdrama", "cards", kdramaRecommendations),
        writeDoc("recommendations", "cdrama", "cards", cdramaRecommendations),
        writeDoc("sidebar", "kdrama", "dramas", kdramaSidebar),
        writeDoc("sidebar", "cdrama", "dramas", cdramaSidebar),
      ]);

      json(res, 200, { ok: true });
    } catch (error) {
      console.error("Failed to save dramas:", error);
      json(res, 500, { error: "Failed to save drama data." });
    }
    return;
  }

  json(res, 405, { error: "Method not allowed." });
};
