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

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

module.exports = {
  firebaseConfig: {
    apiKey: requiredEnv("FIREBASE_API_KEY"),
    authDomain: requiredEnv("FIREBASE_AUTH_DOMAIN"),
    projectId: requiredEnv("FIREBASE_PROJECT_ID"),
    storageBucket: requiredEnv("FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: requiredEnv("FIREBASE_MESSAGING_SENDER_ID"),
    appId: requiredEnv("FIREBASE_APP_ID"),
  },
};
