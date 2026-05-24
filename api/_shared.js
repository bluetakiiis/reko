const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const ADMIN_SESSION_COOKIE = "reko_admin_session";
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "";
const ADMIN_SESSION_TTL_MS = Number(
  process.env.ADMIN_SESSION_TTL_MS || 1000 * 60 * 60 * 12,
);
const STEP1_TARGET_SEQUENCE = ["😛", "😔", "🤏"];
const STEP2_TARGET_SEQUENCE = ["Romance", "Fantasy", "Comedy"];
const PUZZLE_PHRASE = "the sound of flowers";

let admin;
let firebaseAdminAuth;
let db;

function getFirebaseAdmin() {
  if (!admin) {
    admin = require("firebase-admin");
  }

  return admin;
}

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
  const firebaseAdmin = getFirebaseAdmin();
  const serviceAccountJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (serviceAccountJson) {
    return firebaseAdmin.credential.cert(JSON.parse(serviceAccountJson));
  }

  if (serviceAccountPath) {
    if (fs.existsSync(serviceAccountPath)) {
      return firebaseAdmin.credential.cert(
        JSON.parse(fs.readFileSync(serviceAccountPath, "utf8")),
      );
    }

    const relativePath = path.join(rootDir, serviceAccountPath);
    if (fs.existsSync(relativePath)) {
      return firebaseAdmin.credential.cert(
        JSON.parse(fs.readFileSync(relativePath, "utf8")),
      );
    }
  }

  return null;
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Operation timed out")), ms);
  });
  return Promise.race([promise.finally(() => clearTimeout(timer)), timeout]);
}

async function initFirebaseAdmin() {
  const firebaseAdmin = getFirebaseAdmin();

  if (firebaseAdminAuth) {
    return firebaseAdminAuth;
  }

  if (firebaseAdmin.apps.length > 0) {
    firebaseAdminAuth = firebaseAdmin.auth();
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

    firebaseAdmin.initializeApp({ credential });
    firebaseAdminAuth = firebaseAdmin.auth();
    return firebaseAdminAuth;
  } catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
    return null;
  }
}

async function initFirestore() {
  if (db) return db;

  const auth = await initFirebaseAdmin();
  if (!auth) {
    return null;
  }

  try {
    db = getFirebaseAdmin().firestore();
    return db;
  } catch (error) {
    console.error("Failed to initialize Firestore via firebase-admin:", error);
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

async function readDoc(collectionName, documentName, fieldName) {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  const snapshot = await withTimeout(
    db.collection(collectionName).doc(documentName).get(),
    Number(process.env.FIRESTORE_OP_TIMEOUT_MS || 10000),
  );
  const data = snapshot.exists ? snapshot.data() || {} : {};
  return Array.isArray(data[fieldName]) ? data[fieldName] : [];
}

async function writeDoc(collectionName, documentName, fieldName, value) {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  await withTimeout(
    db
      .collection(collectionName)
      .doc(documentName)
      .set({ [fieldName]: value }),
    Number(process.env.FIRESTORE_OP_TIMEOUT_MS || 10000),
  );
}

function applyCors(req, res) {
  const rawOrigins = process.env.CORS_ORIGIN || "http://localhost:3000";
  const allowedOrigins = rawOrigins
    .split(",")
    .map((s) => String(s || "").trim())
    .filter(Boolean);

  const requestOrigin = req.headers.origin;

  if (allowedOrigins.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "null");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,PUT,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

function handleCorsPreflight(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }

  return false;
}

function json(res, statusCode, body) {
  res.status(statusCode).json(body);
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string" && req.body.length > 0) {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      return {};
    }
  }

  return {};
}

module.exports = {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_SECRET,
  ADMIN_SESSION_TTL_MS,
  applyCors,
  buildSessionCookie,
  getCookieValue,
  handleCorsPreflight,
  initFirebaseAdmin,
  initFirestore,
  json,
  parseBody,
  readDoc,
  requiredEnv,
  signSessionToken,
  validatePuzzlePayload,
  verifyFirebaseBearerToken,
  verifySessionToken,
  withTimeout,
  writeDoc,
};
