const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { firebaseConfig } = require("./firebase-config.js");

const app = express();
const rootDir = path.resolve(__dirname, "..");
const port = process.env.PORT || 3000;

let db;
let doc;
let getDoc;
let setDoc;
let firebaseAdminAuth;
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "";

const ADMIN_SESSION_COOKIE = "reko_admin_session";
const ADMIN_SESSION_TTL_MS = Number(
  process.env.ADMIN_SESSION_TTL_MS || 1000 * 60 * 60 * 12,
);
const STEP1_TARGET_SEQUENCE = ["😛", "😔", "🤏"];
const STEP2_TARGET_SEQUENCE = ["Romance", "Fantasy", "Comedy"];
const PUZZLE_PHRASE = "the sound of flowers";

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(";");

  for (const part of parts) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return null;
}

function signSessionToken(payload) {
  if (!ADMIN_SESSION_SECRET) {
    throw new Error(
      "Missing required environment variable: ADMIN_SESSION_SECRET",
    );
  }

  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", ADMIN_SESSION_SECRET)
    .update(body)
    .digest("base64url");

  return `${body}.${signature}`;
}

function verifySessionToken(token) {
  if (!ADMIN_SESSION_SECRET) {
    return null;
  }

  if (!token || !token.includes(".")) {
    return null;
  }

  const [body, signature] = token.split(".");
  const expectedSignature = crypto
    .createHmac("sha256", ADMIN_SESSION_SECRET)
    .update(body)
    .digest("base64url");

  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    )
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
}

function buildSessionCookie(value, maxAgeMs) {
  const parts = [
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(1, Math.floor(maxAgeMs / 1000))}`,
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function validatePuzzlePayload(payload = {}) {
  const step1Selection = Array.isArray(payload.step1Selection)
    ? payload.step1Selection.map((value) => String(value || "").trim())
    : [];
  const step2Selection = Array.isArray(payload.step2Selection)
    ? payload.step2Selection.map((value) => String(value || "").trim())
    : [];
  const phrase = String(payload.phrase || "")
    .trim()
    .toLowerCase();

  return (
    step1Selection.length === STEP1_TARGET_SEQUENCE.length &&
    step2Selection.length === STEP2_TARGET_SEQUENCE.length &&
    step1Selection.every(
      (value, index) => value === STEP1_TARGET_SEQUENCE[index],
    ) &&
    step2Selection.every(
      (value, index) => value === STEP2_TARGET_SEQUENCE[index],
    ) &&
    phrase === PUZZLE_PHRASE
  );
}

function loadAdminCredential() {
  const serviceAccountJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (serviceAccountJson) {
    return admin.credential.cert(JSON.parse(serviceAccountJson));
  }

  if (serviceAccountPath) {
    if (fs.existsSync(serviceAccountPath)) {
      return admin.credential.cert(
        JSON.parse(fs.readFileSync(serviceAccountPath, "utf8")),
      );
    }

    // Try path relative to repository root (helpful for relative filenames in .env)
    const relativePath = path.join(rootDir, serviceAccountPath);
    if (fs.existsSync(relativePath)) {
      return admin.credential.cert(
        JSON.parse(fs.readFileSync(relativePath, "utf8")),
      );
    }
  }

  return null;
}

async function initFirebaseAdmin() {
  if (firebaseAdminAuth) {
    return firebaseAdminAuth;
  }

  if (admin.apps.length > 0) {
    firebaseAdminAuth = admin.auth();
    return firebaseAdminAuth;
  }

  try {
    const credential = loadAdminCredential();
    if (!credential) {
      console.warn(
        "Firebase Admin SDK is not configured. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON to enable puzzle unlocks.",
      );
      return null;
    }

    admin.initializeApp({ credential });
    firebaseAdminAuth = admin.auth();
    return firebaseAdminAuth;
  } catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
    return null;
  }
}

async function verifyFirebaseBearerToken(req) {
  const auth = await initFirebaseAdmin();

  if (!auth) {
    throw new Error("Firebase Admin SDK is not configured.");
  }

  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw new Error("Missing Firebase authorization token.");
  }

  return auth.verifyIdToken(match[1], true);
}

function requireAdminSession(req, res, next) {
  const session = verifySessionToken(
    getCookieValue(req.headers.cookie || "", ADMIN_SESSION_COOKIE),
  );

  if (!session) {
    res.status(401).json({ error: "Admin session required." });
    return;
  }

  req.adminSession = session;
  next();
}

app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    process.env.CORS_ORIGIN || "http://localhost:3000",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,PUT,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

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

app.get("/api/firebase-config", (req, res) => {
  res.json(firebaseConfig);
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, firestoreReady: Boolean(db) });
});

app.get("/api/admin/session", (req, res) => {
  const session = verifySessionToken(
    getCookieValue(req.headers.cookie || "", ADMIN_SESSION_COOKIE),
  );

  if (!session) {
    res.json({ ok: false, authorized: false });
    return;
  }

  res.json({ ok: true, authorized: true, uid: session.uid });
});

app.post("/api/admin/unlock", async (req, res) => {
  try {
    const decoded = await verifyFirebaseBearerToken(req);

    if (decoded.firebase?.sign_in_provider !== "anonymous") {
      res.status(403).json({ error: "Anonymous Firebase auth required." });
      return;
    }

    if (!validatePuzzlePayload(req.body || {})) {
      res.status(403).json({ error: "Puzzle solution was not accepted." });
      return;
    }

    const now = Date.now();
    const sessionValue = signSessionToken({
      uid: decoded.uid,
      provider: decoded.firebase?.sign_in_provider || "anonymous",
      exp: now + ADMIN_SESSION_TTL_MS,
      iat: now,
    });

    res.setHeader(
      "Set-Cookie",
      buildSessionCookie(sessionValue, ADMIN_SESSION_TTL_MS),
    );
    res.json({ ok: true, authorized: true, uid: decoded.uid });
  } catch (error) {
    console.error("Failed to unlock admin mode:", error);
    res.status(401).json({ error: "Unable to unlock admin mode." });
  }
});

app.post("/api/admin/logout", (req, res) => {
  const parts = [
    `${ADMIN_SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  res.setHeader("Set-Cookie", parts.join("; "));
  res.json({ ok: true });
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

app.put("/api/dramas", requireAdminSession, async (req, res) => {
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
