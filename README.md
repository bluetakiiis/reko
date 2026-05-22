# Reko

**Project Overview**

- **Purpose:** A lightweight static site for sharing K-drama and C-drama recommendations with a sidebar of personally watched titles and a main recommendation feed.
- **Features:** Theme toggle (Kdrama / Cdrama), responsive layout, recommendation submission form (Formspree), and content loaded from a JSON file.

**Quick Start**

- **View locally:** Open [index.html](index.html) in your browser.
- **Edit content:** Update recommendations and sidebar lists in [data/dramas.json](data/dramas.json).
- **Live site:** https://bluetakiiis.github.io/reko/

**Project Structure**

- **Files:**
  - [index.html](index.html) : main HTML page
  - [data/dramas.json](data/dramas.json) : data source for sidebar lists and recommendation cards
  - [data/genres.json](data/genres.json) : genre pill palette data
  - [assets/js/kdrama.js](assets/js/kdrama.js) : JavaScript that loads data, toggles theme, and handles form submission
  - [assets/css/kdrama.css](assets/css/kdrama.css) : styles (also supports `.cdrama-theme` color variables)
  - [assets/scss/kdrama.scss](assets/scss/kdrama.scss) : source SCSS (if you want to regenerate CSS)

**How it works**

- On load, `assets/js/kdrama.js` fetches `data/dramas.json` and populates:
  - the sidebar lists (`kdramaSidebar`, `cdramaSidebar`) and
  - the main recommendation containers (`kdramaRecommendations`, `cdramaRecommendations`).
- The theme toggle switches between K-drama and C-drama modes and saves the choice to `localStorage`.
- The recommendation modal posts to Formspree (see `action` on the form in [index.html](index.html)).

**Editing recommendations**

- Add or update entries in `data/dramas.json` under `kdramaRecommendations` or `cdramaRecommendations` using the existing objects as examples. Key fields used by the UI:
  - `title`, `image`, `imageMobile`, `description`, `genre`, `episodes`, `rating`, `link`

**Customization**

- Change the theme colors by editing `:root` or `.cdrama-theme` variables in [assets/css/kdrama.css](assets/css/kdrama.css).
- Change the Formspree endpoint in the `<form>` `action` attribute inside [index.html](index.html) to point to your form receiver.

**Deploying**

- This is a static site and can be deployed to GitHub Pages by pushing the repository to `username.github.io`.
