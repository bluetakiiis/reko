# Reko

Whimsical K-drama / C-drama recommendations with a small Express API and Firestore-backed content.

## Features

- Theme toggle for K-drama and C-drama views
- Responsive recommendation cards and sidebar lists
- Formspree-powered recommendation form
- Firebase Anonymous Auth + server-verified admin puzzle unlock

## Quick Start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy [.env.example](.env.example) to [.env.local](.env.local) and fill in your Firebase values.
3. Start the server:

   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000).

## Environment

The server reads [.env.local](.env.local) first, then [.env](.env) if present.
Never commit either file.

Required values:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `ADMIN_SESSION_SECRET`

For admin unlocks, also provide Firebase Admin credentials with one of:

- `GOOGLE_APPLICATION_CREDENTIALS` pointing to a service account JSON file
- `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` containing the service account JSON string

Optional:

- `CORS_ORIGIN` for local or deployed frontend origins
- `ADMIN_SESSION_TTL_MS` to change the admin cookie lifetime

## Admin Flow

- The browser signs in anonymously with Firebase on load.
- Solving the puzzle sends the Firebase ID token to the server.
- The server verifies the token, checks the puzzle answer, and issues an HttpOnly session cookie.
- `PUT /api/dramas` accepts writes only when that session cookie is present.

## Project Files

- [index.html](index.html): main HTML entry point
- [server/index.js](server/index.js): Express API and Firestore access
- [server/firebase-config.js](server/firebase-config.js): Firebase client config loader
- [assets/js/kdrama.js](assets/js/kdrama.js): app UI, puzzle flow, and content rendering
- [assets/js/firebase-auth.js](assets/js/firebase-auth.js): Firebase bootstrap and unlock helpers
- [assets/js/script.js](assets/js/script.js): shared API helpers
- [assets/css/kdrama.css](assets/css/kdrama.css): main styles
- [assets/scss/kdrama.scss](assets/scss/kdrama.scss): SCSS source for the main styles
- [assets/scss/admin.scss](assets/scss/admin.scss): SCSS source for admin styles
- [data/genres.json](data/genres.json): genre pill data

## How It Works

- `assets/js/kdrama.js` fetches `/api/dramas` and renders the sidebar lists and main recommendation cards.
- The theme toggle switches between K-drama and C-drama palettes in the browser.
- The recommendation modal posts to Formspree through the form action in [index.html](index.html).

## Editing Recommendations

Update the Firestore documents through the API. Each card should include:

- `title`
- `image`
- `imageMobile`
- `description`
- `genre`
- `episodes`
- `rating`
- `link`

## Deploying

- GitHub Pages can host the frontend, but the API must run separately.
- Replace `https://YOUR-API-DOMAIN-HERE` in [index.html](index.html) with your API URL.
- The frontend uses `http://localhost:3000` automatically during local development.
