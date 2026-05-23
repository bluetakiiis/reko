# Reko

**Project Overview**

- **Purpose:** A lightweight site for sharing K-drama and C-drama recommendations with a sidebar of personally watched titles and a main recommendation feed.
- **Features:** Theme toggle (Kdrama / Cdrama), responsive layout, recommendation submission form (Formspree), and a small Node API that reads/writes Firestore.

**Quick Start**

- **Run the API:** Run `npm start`.
- **Open the site:** Visit `http://localhost:3000` after the server starts.
- **Live site:** https://bluetakiiis.github.io/reko/

**Project Structure**

- **Files:**
  - [index.html](index.html) : main HTML page
  - [server/index.js](server/index.js) : Express API that serves the app and proxies Firestore reads/writes
  - [data/genres.json](data/genres.json) : genre pill palette data
  - [assets/js/kdrama.js](assets/js/kdrama.js) : JavaScript that loads data, toggles theme, and handles form submission
  - [assets/css/kdrama.css](assets/css/kdrama.css) : styles (also supports `.cdrama-theme` color variables)
  - [assets/scss/kdrama.scss](assets/scss/kdrama.scss) : source SCSS for the main site styles
  - [assets/scss/admin.scss](assets/scss/admin.scss) : source SCSS for the admin styles

**How it works**

- On load, `assets/js/kdrama.js` fetches `/api/dramas` and populates:
  - the sidebar lists (`kdramaSidebar`, `cdramaSidebar`) and
  - the main recommendation containers (`kdramaRecommendations`, `cdramaRecommendations`).
- The theme toggle switches between K-drama and C-drama modes in the browser.
- The recommendation modal posts to Formspree (see `action` on the form in [index.html](index.html)).

**Editing recommendations**

- Update the recommendation docs in Firestore through the API. The UI expects these fields on each card:
  - `title`, `image`, `imageMobile`, `description`, `genre`, `episodes`, `rating`, `link`

**Customization**

- Change the theme colors by editing `:root` or `.cdrama-theme` variables in [assets/css/kdrama.css](assets/css/kdrama.css).
- Change the Formspree endpoint in the `<form>` `action` attribute inside [index.html](index.html) to point to your form receiver.

**Deploying**

- GitHub Pages can host the frontend, but the API must be deployed separately at a public URL.
- Replace `https://YOUR-API-DOMAIN-HERE` in [index.html](index.html) with your deployed API URL.
- The frontend will use `http://localhost:3000` automatically on local machines.
