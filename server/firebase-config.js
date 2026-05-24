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

  return (
    process.env[key] || fallback[key.replace(/FIREBASE_/, "").toLowerCase()]
  );
}

module.exports = {
  firebaseConfig: {
    apiKey: getConfigValue("FIREBASE_API_KEY"),
    authDomain: getConfigValue("FIREBASE_AUTH_DOMAIN"),
    projectId: getConfigValue("FIREBASE_PROJECT_ID"),
    appId: getConfigValue("FIREBASE_APP_ID"),
  },
};
