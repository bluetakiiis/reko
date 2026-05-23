const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const rootDir = path.resolve(__dirname, "..");

for (const envPath of [
  path.join(rootDir, ".env.local"),
  path.join(rootDir, ".env"),
]) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

const fallback = {
  apiKey: "AIzaSyBRvfZ3TslTWMtzYAINey481eRcQEyxbjU",
  authDomain: "reko-865ae.firebaseapp.com",
  projectId: "reko-865ae",
  storageBucket: "reko-865ae.firebasestorage.app",
  messagingSenderId: "34431129385",
  appId: "1:34431129385:web:64c03a78ea1240be1f4938",
};

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getConfigValue(key) {
  if (process.env.NODE_ENV === "production") {
    return requiredEnv(key);
  }

  return process.env[key] || fallback[key.replace(/FIREBASE_/, '').toLowerCase()];
}

module.exports = {
  firebaseConfig: {
    apiKey: process.env.FIREBASE_API_KEY || fallback.apiKey,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || fallback.authDomain,
    projectId: process.env.FIREBASE_PROJECT_ID || fallback.projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || fallback.storageBucket,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || fallback.messagingSenderId,
    appId: process.env.FIREBASE_APP_ID || fallback.appId,
  },
};
 