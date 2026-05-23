const express = require("express");
const path = require("path");
const { firebaseConfig } = require("./firebase-config.js");

const app = express();
const rootDir = path.resolve(__dirname, "..");
const port = process.env.PORT || 3000;

let db;
let doc;
let getDoc;
let setDoc;

app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,PUT,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use(express.static(rootDir));

async function initFirestore() {
  const { initializeApp } = await import("firebase/app");
  ({ doc, getDoc, setDoc } = await import("firebase/firestore"));

  const firebaseApp = initializeApp(firebaseConfig, "server-app");
  const { getFirestore } = await import("firebase/firestore");
  db = getFirestore(firebaseApp);
}

async function readDoc(collectionName, documentName, fieldName) {
  const snapshot = await getDoc(doc(db, collectionName, documentName));
  const data = snapshot.exists() ? snapshot.data() || {} : {};
  return Array.isArray(data[fieldName]) ? data[fieldName] : [];
}

async function writeDoc(collectionName, documentName, fieldName, value) {
  await setDoc(doc(db, collectionName, documentName), {
    [fieldName]: value,
  });
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, firestoreReady: Boolean(db) });
});

app.get("/api/dramas", async (req, res) => {
  if (!db) {
    res.status(503).json({ error: "Firestore is still starting." });
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

    res.json({
      kdramaRecommendations,
      cdramaRecommendations,
      kdramaSidebar,
      cdramaSidebar,
    });
  } catch (error) {
    console.error("Failed to load dramas:", error);
    res.status(500).json({ error: "Failed to load drama data." });
  }
});

app.put("/api/dramas", async (req, res) => {
  if (!db) {
    res.status(503).json({ error: "Firestore is still starting." });
    return;
  }

  const payload = req.body || {};
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

    res.json({ ok: true });
  } catch (error) {
    console.error("Failed to save dramas:", error);
    res.status(500).json({ error: "Failed to save drama data." });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

initFirestore().catch((error) => {
  console.error("Failed to initialize Firestore:", error);
  if (require.main === module) {
    process.exit(1);
  }
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Reko server running at http://localhost:${port}`);
  });
}

module.exports = app;
