document.addEventListener("DOMContentLoaded", function () {
  const menuBtn = document.getElementById("menu-btn");
  const sidebar = document.getElementById("sidebar");
  const mainContent = document.querySelector("main");
  const themeToggle = document.getElementById("theme-toggle");
  const navbarTitle = document.querySelector(".navbar-title");
  const form = document.getElementById("recommend-form");
  const status = document.getElementById("form-status");
  const kdramaContainer = document.getElementById("kdrama-container");
  const cdramaContainer = document.getElementById("cdrama-container");
  const searchWrapper = document.getElementById("search-wrapper");
  const searchInput = document.getElementById("search-input");
  const searchDropdown = document.getElementById("search-dropdown");
  const adminOverlay = document.getElementById("admin-overlay");
  const sidebarAddBtn = document.getElementById("sidebar-add-btn");

  const genreFilters = {
    kdrama: null,
    cdrama: null,
  };

  let isCdramaMode = false;
  let dramasData = null;
  let genrePaletteData = null;
  let genrePalettePromise = null;
  let modeSwitchTimer = null;
  let isAdminMode = false;

  let puzzleStep = 1;
  let puzzleStepSolved = { 1: false, 2: false, 3: false };
  let step1Selection = [];
  const step1TargetSequence = ["😛", "😔", "🤏"];
  const step2TargetSequence = ["Romance", "Fantasy", "Comedy"];

  const GENRE_PRIORITY = ["Romance", "Fantasy", "Comedy"];
  const GENRE_OTHER = [
    "Action",
    "Drama",
    "Thriller",
    "Mystery",
    "Crime",
    "Historical",
    "Sci-Fi",
    "Supernatural",
    "Horror",
    "Melodrama",
    "Psychological",
    "Youth",
    "Family",
    "Music",
    "Sports",
    "Medical",
    "Business",
    "War",
    "Xianxia",
    "Wuxia",
    "Slice of Life",
    "Life",
    "Apocalyptic",
    "Time Travel",
    "Virtual Reality",
    "E-Sports",
  ];

  const PUZZLE_PHRASE = "the sound of flowers";

  const dropZone = document.getElementById("puzzle-drop-zone");
  const dragPool = document.getElementById("puzzle-drag-pool");
  const apiJson = (...args) => window.apiJson(...args);
  const getDramasData = async (...args) => {
    const data = await window.getDramasData(...args);
    dramasData = data;
    return data;
  };
  const persistDramasToServer = (...args) =>
    window.persistDramasToServer(...args);
  const saveDataToStorage = (...args) => window.saveDataToStorage(...args);

  function getCurrentMode() {
    return isCdramaMode ? "cdrama" : "kdrama";
  }

  function clearStatus() {
    if (!status) {
      return;
    }

    status.textContent = "";
    status.className = "form-status";
  }

  function applyThemeUi() {
    document.body.classList.toggle("cdrama-theme", isCdramaMode);
    document.documentElement.classList.toggle("cdrama-theme", isCdramaMode);
    themeToggle.textContent = isCdramaMode ? "toggle_on" : "toggle_off";
    navbarTitle.textContent = isCdramaMode
      ? "Rupika's Cdrama Recs"
      : "Rupika's Kdrama Recs";
  }

  function syncModeSections() {
    document.getElementById("kdrama-list").style.display = isCdramaMode
      ? "none"
      : "block";
    document.getElementById("cdrama-list").style.display = isCdramaMode
      ? "block"
      : "none";
    document.getElementById("kdrama-rec").style.display = isCdramaMode
      ? "none"
      : "block";
    document.getElementById("cdrama-rec").style.display = isCdramaMode
      ? "block"
      : "none";
  }

  function getModeSection(mode) {
    return document.getElementById(
      mode === "cdrama" ? "cdrama-rec" : "kdrama-rec",
    );
  }

  function fadeModeSwitch() {
    const outgoingMode = isCdramaMode ? "kdrama" : "cdrama";
    const incomingMode = getCurrentMode();
    const outgoingSection = getModeSection(outgoingMode);
    const incomingSection = getModeSection(incomingMode);

    applyThemeUi();

    if (modeSwitchTimer) {
      window.clearTimeout(modeSwitchTimer);
    }

    if (!outgoingSection || !incomingSection) {
      syncModeSections();
      void renderCurrentMode();
      void loadSidebarLists();
      return;
    }

    outgoingSection.classList.remove("mode-fade-in");
    outgoingSection.classList.add("mode-fade-out");

    modeSwitchTimer = window.setTimeout(() => {
      outgoingSection.classList.remove("mode-fade-out");
      outgoingSection.style.display = "none";

      applyThemeUi();
      syncModeSections();

      incomingSection.style.display = "block";
      incomingSection.classList.add("mode-fade-in");

      void renderCurrentMode();
      void loadSidebarLists();

      window.requestAnimationFrame(() => {
        incomingSection.classList.remove("mode-fade-in");
      });
    }, 300);
  }

  function getDramaImage(drama) {
    if (window.innerWidth <= 576 && drama.imageMobile) {
      return drama.imageMobile;
    }

    return drama.image;
  }

  function getCardImage(drama) {
    const src = getDramaImage(drama);
    if (src) {
      return src;
    }

    const title = drama.title ? encodeURIComponent(drama.title) : "New Drama";
    return `https://via.placeholder.com/280x400/ffd9f4/f871d1?text=${title}`;
  }

  function getGenreTokens(genreValue) {
    if (Array.isArray(genreValue)) {
      return genreValue
        .map((g) =>
          String(g || "")
            .replace(/\s+/g, " ")
            .trim(),
        )
        .filter(Boolean);
    }

    return String(genreValue || "")
      .split("/")
      .flatMap((part) => part.split(/\s{2,}/))
      .map((part) => part.replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }

  function normalizeGenreLabel(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getGenreOptions(extraGenres = []) {
    const priority = GENRE_PRIORITY.map(normalizeGenreLabel).filter(Boolean);
    const prioritySet = new Set(priority.map((genre) => genre.toLowerCase()));
    const otherSet = new Set();

    [...GENRE_OTHER, ...extraGenres]
      .map(normalizeGenreLabel)
      .filter(Boolean)
      .forEach((genre) => {
        if (!prioritySet.has(genre.toLowerCase())) {
          otherSet.add(genre);
        }
      });

    return {
      priority,
      other: Array.from(otherSet),
    };
  }

  function getGenreSlug(genre) {
    return genre
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async function getGenrePaletteData() {
    if (genrePaletteData) {
      return genrePaletteData;
    }

    if (!genrePalettePromise) {
      genrePalettePromise = fetch("data/genres.json")
        .then((response) => response.json())
        .then((data) => {
          genrePaletteData = data;
          return data;
        })
        .catch((error) => {
          genrePalettePromise = null;
          throw error;
        });
    }

    return genrePalettePromise;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseRating(rating) {
    const ratingValue = parseFloat(String(rating).split("/")[0]);
    return Number.isFinite(ratingValue) ? ratingValue : 0;
  }

  function sortByRating(items) {
    return [...items].sort((left, right) => {
      const ratingDifference =
        parseRating(right.rating) - parseRating(left.rating);
      if (ratingDifference !== 0) {
        return ratingDifference;
      }

      return String(left.title).localeCompare(String(right.title));
    });
  }

  function matchesGenre(drama, activeGenre) {
    if (!activeGenre) {
      return true;
    }

    return getGenreTokens(drama.genre).some(
      (genre) => genre.toLowerCase() === activeGenre.toLowerCase(),
    );
  }

  function showSkeletons(container, count) {
    container.innerHTML = "";

    for (let index = 0; index < count; index += 1) {
      const skel = document.createElement("div");
      skel.className = "skeleton-card";
      skel.innerHTML = `
        <div class="skeleton-img"></div>
        <div class="skeleton-text">
          <div class="skeleton-line title"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line small"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line small"></div>
        </div>
      `;
      container.appendChild(skel);
    }
  }

  function showToast(message, isError = false) {
    const toastContainer = document.getElementById("toast-container");
    if (!toastContainer) {
      return;
    }

    const toast = document.createElement("div");
    toast.className = `toast${isError ? " error" : ""}`;
    toast.innerHTML = `
      <span class="toast-icon">${isError ? "⚠️" : "✨"}</span>
      <span>${escapeHtml(message)}</span>
    `;
    toastContainer.appendChild(toast);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        toast.classList.add("show");
      });
    });

    window.setTimeout(() => {
      toast.classList.remove("show");
      window.setTimeout(() => {
        toast.remove();
      }, 400);
    }, 3200);
  }

  function createGenrePill(genre, activeGenre, mode) {
    const isActive =
      activeGenre && genre.toLowerCase() === activeGenre.toLowerCase();
    const slug = getGenreSlug(genre);
    const palette = (genrePaletteData && genrePaletteData[slug]) ||
      (genrePaletteData && genrePaletteData.default) || {
        bg: "#EFE7F6",
        text: "#5B4A6D",
      };

    return `
      <button
        type="button"
        class="genre-pill${isActive ? " is-active" : ""}"
        style="--pill-bg: ${palette.bg}; --pill-text: ${palette.text};"
        data-genre="${escapeHtml(genre)}"
        data-mode="${mode}"
        aria-pressed="${isActive ? "true" : "false"}"
      >
        ${escapeHtml(genre)}
      </button>
    `;
  }

  function buildGenreOptionButton(genre, selected) {
    return `
      <button
        type="button"
        class="genre-option${selected ? " is-selected" : ""}"
        data-genre="${escapeHtml(genre)}"
      >
        ${escapeHtml(genre)}
      </button>
    `;
  }

  function buildGenreEditorMarkup(selectedGenres) {
    return `
      <div class="url-edit-row genre-edit-row">
        <span class="url-edit-label">Genres:</span>
        <input name="genre" class="url-edit-input genre-edit-input" type="text" value="${escapeHtml(
          selectedGenres.join(", "),
        )}" placeholder="Romance, Fantasy" />
      </div>
    `;
  }

  function parseGenreFieldText(text) {
    return text
      .split(",")
      .map((genre) => genre.trim())
      .filter(Boolean);
  }

  function createDramaCard(drama, mode) {
    const card = document.createElement("div");
    const activeGenre = genreFilters[mode];
    const genres = getGenreTokens(drama.genre);
    const genreEditorMarkup = buildGenreEditorMarkup(genres);

    card.className = "main-recommendation card-enter";
    card.dataset.title = drama.title || "";
    card.dataset.mode = mode;
    if (drama.__draftId) {
      card.dataset.draftId = drama.__draftId;
    }

    card.innerHTML = `
      <div class="card-media" style="position: relative; flex-shrink: 0;">
        <img src="${escapeHtml(getCardImage(drama))}" alt="${escapeHtml(drama.title)}" class="main-img" loading="lazy" width="280" height="400">
      </div>
      <div class="main-text">
        <button class="card-edit-btn material-symbols-outlined" type="button" title="Edit card">
          edit
        </button>
        <h2 class="main-title editable-field" contenteditable="false" data-placeholder="Drama title">
          ${escapeHtml(drama.title || "")}
        </h2>
        <p class="editable-field card-desc" contenteditable="false" data-placeholder="Description...">
          ${escapeHtml(drama.description || "")}
        </p>
        <div class="genre-row">
          <div class="genre-label">Genre:</div>
          <div class="genre-pills" aria-label="Genres">
            ${genres.map((genre) => createGenrePill(genre, activeGenre, mode)).join("")}
          </div>
        </div>
        ${genreEditorMarkup}
        <div class="stat-row">
          <strong>Episodes:</strong>
          <span class="editable-field ep-field" contenteditable="false" data-placeholder="0">
            ${escapeHtml(String(drama.episodes || ""))}
          </span>
        </div>
        <div class="stat-row">
          <strong>Rating:</strong>
          <span class="editable-field rating-field" contenteditable="false" data-placeholder="0/10">
            ${escapeHtml(drama.rating || "")}
          </span>
        </div>
        <a href="${escapeHtml(drama.link || "#")}" class="watch-btn" target="_blank" rel="noopener">
          Watch Now
        </a>
        <div class="url-edit-row">
          <span class="url-edit-label">Watch URL:</span>
          <input name="watchUrl" class="url-edit-input link-edit-input" type="text" value="${escapeHtml(drama.link || "")}" placeholder="https://..." />
        </div>
        <div class="url-edit-row">
          <span class="url-edit-label">Image URL:</span>
          <input name="imageUrl" class="url-edit-input img-edit-input" type="text" value="${escapeHtml(drama.image || "")}" placeholder="https://..." />
        </div>
        <div class="url-edit-row">
          <span class="url-edit-label">Mobile URL:</span>
          <input name="imageMobileUrl" class="url-edit-input imgm-edit-input" type="text" value="${escapeHtml(drama.imageMobile || "")}" placeholder="https://..." />
        </div>
        <div class="card-action-bar">
          <button class="card-save-btn" type="button">Save</button>
          <button class="card-cancel-btn" type="button">Cancel</button>
          <button class="card-delete-btn" type="button">Delete</button>
        </div>
      </div>
    `;
    const editBtn = card.querySelector(".card-edit-btn");
    if (editBtn) {
      editBtn.style.display = isAdminMode ? "" : "none";

      editBtn.addEventListener("click", () => {
        if (!isAdminMode) {
          return;
        }
        enterCardEdit(card, drama, mode);
      });
    }

    card.querySelector(".card-save-btn").addEventListener("click", () => {
      void saveCard(card, drama, mode);
    });
    card.querySelector(".card-cancel-btn").addEventListener("click", () => {
      void cancelCardEdit(card, drama, mode);
    });
    card.querySelector(".card-delete-btn").addEventListener("click", () => {
      void deleteCard(card, drama, mode);
    });

    // removed file upload support — images are handled by URLs only

    return card;
  }

  function enterCardEdit(card, drama, mode) {
    card.classList.add("card-editing");
    card.querySelectorAll(".editable-field").forEach((el) => {
      el.contentEditable = "true";
    });
    const editBtn = card.querySelector(".card-edit-btn");
    if (editBtn) {
      editBtn.style.display = "none";
    }

    const genreInput = card.querySelector(".genre-edit-input");
    if (genreInput) {
      genreInput.value = getGenreTokens(drama.genre).join(", ");
    }
    const titleEl = card.querySelector(".main-title");
    if (titleEl) {
      titleEl.focus();
    }
  }

  async function saveCard(card, drama, mode) {
    const titleEl = card.querySelector(".main-title");
    const descEl = card.querySelector(".card-desc");
    const epEl = card.querySelector(".ep-field");
    const ratingEl = card.querySelector(".rating-field");
    const genreInput = card.querySelector(".genre-edit-input");
    const genreField = card.querySelector(".genre-edit-field");
    const linkInput = card.querySelector(".link-edit-input");
    const imgInput = card.querySelector(".img-edit-input");
    const imgmInput = card.querySelector(".imgm-edit-input");

    const title = titleEl.textContent.trim();
    if (!title) {
      showToast("Please add a title before saving.", true);
      return;
    }

    const genreText = genreInput
      ? genreInput.value
      : genreField?.textContent || "";
    const typedGenres = parseGenreFieldText(genreText);
    const selectedSet = new Set(
      typedGenres.map((genre) => genre.toLowerCase()),
    );
    const orderedGenres = [];

    GENRE_PRIORITY.forEach((genre) => {
      if (selectedSet.has(genre.toLowerCase())) {
        orderedGenres.push(genre);
        selectedSet.delete(genre.toLowerCase());
      }
    });

    typedGenres.forEach((genre) => {
      if (
        !GENRE_PRIORITY.some(
          (priority) => priority.toLowerCase() === genre.toLowerCase(),
        ) &&
        !orderedGenres.includes(genre)
      ) {
        orderedGenres.push(genre);
      }
    });

    drama.title = title;
    drama.description = descEl.textContent.trim();
    drama.episodes = epEl.textContent.trim();
    drama.rating = ratingEl.textContent.trim();
    drama.link = linkInput.value.trim();
    drama.image = imgInput.value.trim();
    drama.imageMobile = imgmInput.value.trim();
    drama.genre = orderedGenres.length ? orderedGenres : ["Drama"];

    const oldTitle = card.dataset.title;
    card.dataset.title = title;

    updateSidebarEntry(oldTitle, title, mode);
    delete drama.__draftId;
    delete drama.__isDraft;

    saveDataToStorage();
    await persistDramasToServer();

    await renderMode(mode, { showSkeletons: false });
    scrollToCard(title);
    showToast("Changes saved! ✨");
  }

  async function cancelCardEdit(card, drama, mode) {
    if (drama.__isDraft) {
      const data = await getDramasData();
      const list = data[`${mode}Recommendations`] || [];
      const index = list.indexOf(drama);
      if (index !== -1) {
        list.splice(index, 1);
      }
      await renderMode(mode, { showSkeletons: false });
      showToast("Draft removed.");
      return;
    }

    card.querySelector(".main-title").textContent = drama.title || "";
    card.querySelector(".card-desc").textContent = drama.description || "";
    card.querySelector(".ep-field").textContent = String(drama.episodes || "");
    card.querySelector(".rating-field").textContent = drama.rating || "";
    card.querySelector(".link-edit-input").value = drama.link || "";
    card.querySelector(".img-edit-input").value = drama.image || "";
    card.querySelector(".imgm-edit-input").value = drama.imageMobile || "";
    const genreInput = card.querySelector(".genre-edit-input");
    const genreField = card.querySelector(".genre-edit-field");
    if (genreInput) {
      genreInput.value = getGenreTokens(drama.genre).join(", ");
    }
    exitCardEdit(card);
  }

  async function deleteCard(card, drama, mode) {
    if (!window.confirm(`Delete "${drama.title}"?`)) {
      return;
    }

    const data = await getDramasData();
    const recs = data[`${mode}Recommendations`] || [];
    const index = recs.indexOf(drama);
    if (index !== -1) {
      recs.splice(index, 1);
    }

    const sidebarList = data[`${mode}Sidebar`] || [];
    const sidebarIndex = sidebarList.indexOf(drama.title);
    if (sidebarIndex !== -1) {
      sidebarList.splice(sidebarIndex, 1);
    }

    saveDataToStorage();
    try {
      const ok = await persistDramasToServer();
      if (!ok) {
        showToast("Deleted locally only (server unavailable).", true);
      }
    } catch (e) {
      showToast("Deleted locally only (error).", true);
    }
    await renderMode(mode, { showSkeletons: false });
    loadSidebarLists();
    showToast("Drama removed.");
  }

  async function deleteSidebarEntry(title, mode) {
    if (!window.confirm(`Delete "${title}" from the sidebar?`)) {
      return;
    }

    const data = await getDramasData();
    const sidebarList = data[`${mode}Sidebar`] || [];
    const sidebarIndex = sidebarList.indexOf(title);
    if (sidebarIndex !== -1) {
      sidebarList.splice(sidebarIndex, 1);
    }

    const recs = data[`${mode}Recommendations`] || [];
    const recIndex = recs.findIndex((drama) => drama.title === title);
    if (recIndex !== -1) {
      recs.splice(recIndex, 1);
    }

    saveDataToStorage();
    await renderMode(mode, { showSkeletons: false });
    loadSidebarLists();
    showToast("Deleted ✨");

    try {
      const ok = await persistDramasToServer();

      if (!ok) {
        showToast("Delete saved locally only.", true);
      }
    } catch (e) {
      showToast("Failed syncing delete.", true);
    }
  }

  function exitCardEdit(card) {
    card.classList.remove("card-editing");
    card.querySelectorAll(".editable-field").forEach((el) => {
      el.contentEditable = "false";
    });
    const editBtn = card.querySelector(".card-edit-btn");
    if (editBtn && isAdminMode) {
      editBtn.style.display = "";
    }
  }

  function updateSidebarEntry(oldTitle, newTitle, mode) {
    const list = dramasData ? dramasData[`${mode}Sidebar`] : null;
    if (!list) {
      return;
    }

    if (oldTitle && oldTitle !== newTitle) {
      const idx = list.indexOf(oldTitle);
      if (idx !== -1) {
        list[idx] = newTitle;
      }
    }

    if (newTitle && !list.includes(newTitle)) {
      list.push(newTitle);
    }

    list.sort((left, right) => String(left).localeCompare(String(right)));
    loadSidebarLists();
  }

  function animateRenderedCards(container) {
    const cards = Array.from(
      container.querySelectorAll(".main-recommendation.card-enter"),
    );

    window.requestAnimationFrame(() => {
      cards.forEach((card, index) => {
        card.style.transitionDelay = `${index * 70}ms`;
        card.classList.remove("card-enter");
      });
    });
  }

  function attachGenreFilterHandler(container) {
    if (!container || container.dataset.genreFilterBound === "true") {
      return;
    }

    container.dataset.genreFilterBound = "true";

    container.addEventListener("click", function (event) {
      const pill = event.target.closest(".genre-pill");
      if (!pill) {
        return;
      }

      event.preventDefault();

      const mode = pill.dataset.mode;
      const genre = pill.dataset.genre;
      const selectedGenre = genreFilters[mode];

      genreFilters[mode] =
        selectedGenre && selectedGenre.toLowerCase() === genre.toLowerCase()
          ? null
          : genre;

      void renderMode(mode, { showSkeletons: false });
    });
  }

  async function renderMode(mode, options = {}) {
    const container = document.getElementById(
      mode === "cdrama" ? "cdrama-container" : "kdrama-container",
    );

    if (!container) {
      return;
    }

    if (!dramasData && options.showSkeletons !== false) {
      showSkeletons(container, 3);
    }

    try {
      const [data] = await Promise.all([
        getDramasData(),
        getGenrePaletteData(),
      ]);
      const activeGenre = genreFilters[mode];

      const items = [...(data[`${mode}Recommendations`] || [])];
      const draftItems = items.filter((item) => item.__isDraft);
      let normalItems = items.filter((item) => !item.__isDraft);

      if (activeGenre) {
        normalItems = sortByRating(normalItems);
      } else {
        normalItems.sort((left, right) =>
          String(left.title).localeCompare(String(right.title)),
        );
      }

      let filteredItems = normalItems.filter((drama) =>
        matchesGenre(drama, activeGenre),
      );

      if (options.keepDraftOnTop && draftItems.length) {
        filteredItems = [...draftItems, ...filteredItems];
      }

      container.innerHTML = "";

      if (!filteredItems.length) {
        const emptyState = document.createElement("p");
        emptyState.className = "no-results";
        emptyState.textContent = activeGenre
          ? `No ${activeGenre} dramas found in this section.`
          : "No dramas found.";
        container.appendChild(emptyState);
        return;
      }

      filteredItems.forEach((drama) => {
        container.appendChild(createDramaCard(drama, mode));
      });

      animateRenderedCards(container);

      attachGenreFilterHandler(container);
    } catch (error) {
      container.innerHTML = "<p>Failed to load recommendations.</p>";
    }
  }

  function renderCurrentMode(options = {}) {
    return renderMode(getCurrentMode(), options);
  }

  async function loadSidebarLists() {
    try {
      const data = await getDramasData();
      const kdramaList = document.getElementById("kdrama-list");
      const cdramaList = document.getElementById("cdrama-list");

      if (kdramaList) {
        kdramaList.innerHTML = "";
        const kItems = Array.isArray(data.kdramaSidebar)
          ? [...data.kdramaSidebar].sort((a, b) =>
              String(a).localeCompare(String(b)),
            )
          : [];

        kItems.forEach((title) => {
          kdramaList.appendChild(makeSidebarItem(title, "kdrama"));
        });
      }

      if (cdramaList) {
        cdramaList.innerHTML = "";
        const cItems = Array.isArray(data.cdramaSidebar)
          ? [...data.cdramaSidebar].sort((a, b) =>
              String(a).localeCompare(String(b)),
            )
          : [];

        cItems.forEach((title) => {
          cdramaList.appendChild(makeSidebarItem(title, "cdrama"));
        });
      }

      if (sidebarAddBtn) {
        sidebarAddBtn.style.display = isAdminMode ? "inline-flex" : "none";
      }
    } catch (error) {}
  }

  function makeSidebarItem(title, mode) {
    const li = document.createElement("li");
    const wrap = document.createElement("div");
    wrap.className = "sidebar-item-wrap";

    const span = document.createElement("span");
    span.className = "sidebar-item-text";
    span.textContent = title;

    const editBtn = document.createElement("button");
    editBtn.className = "sidebar-edit-btn material-symbols-outlined";
    editBtn.textContent = "edit";
    editBtn.style.display = isAdminMode ? "inline" : "none";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "sidebar-delete-btn material-symbols-outlined";
    deleteBtn.textContent = "delete";
    deleteBtn.style.display = isAdminMode ? "inline" : "none";

    editBtn.addEventListener("click", () => {
      span.style.display = "none";
      editBtn.style.display = "none";
      deleteBtn.style.display = "none";
      const input = document.createElement("input");
      input.className = "sidebar-item-input";
      input.value = title;
      wrap.insertBefore(input, editBtn);
      input.focus();
      input.select();

      const commit = () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== title) {
          const list = dramasData ? dramasData[`${mode}Sidebar`] : [];
          const index = list.indexOf(title);
          if (index !== -1) {
            list[index] = newTitle;
          }
          const recs = dramasData ? dramasData[`${mode}Recommendations`] : [];
          const rec = recs.find((drama) => drama.title === title);
          if (rec) {
            rec.title = newTitle;
          }
          saveDataToStorage();
          try {
            void persistDramasToServer();
          } catch (e) {}
          loadSidebarLists();
          void renderMode(mode, { showSkeletons: false });
          showToast("Renamed ✨");
        } else {
          input.remove();
          span.style.display = "";
          if (isAdminMode) {
            editBtn.style.display = "inline";
            deleteBtn.style.display = "inline";
          }
        }
      };

      input.addEventListener("blur", commit);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
        if (event.key === "Escape") {
          input.remove();
          span.style.display = "";
          if (isAdminMode) {
            editBtn.style.display = "inline";
            deleteBtn.style.display = "inline";
          }
        }
      });
    });

    deleteBtn.addEventListener("click", () => {
      void deleteSidebarEntry(title, mode);
    });

    wrap.appendChild(span);
    wrap.appendChild(editBtn);
    wrap.appendChild(deleteBtn);
    li.appendChild(wrap);
    return li;
  }

  async function addSidebarEntry() {
    if (!isAdminMode) return;

    const mode = getCurrentMode();
    const listEl = document.getElementById(
      mode === "cdrama" ? "cdrama-list" : "kdrama-list",
    );
    if (!listEl) return;

    // create a temporary inline input item — only commit on Enter
    const li = document.createElement("li");
    const wrap = document.createElement("div");
    wrap.className = "sidebar-item-wrap";

    const input = document.createElement("input");
    input.className = "sidebar-item-input";
    input.value = "";
    wrap.appendChild(input);
    li.appendChild(wrap);

    // insert at top so user sees it immediately
    listEl.insertBefore(li, listEl.firstChild || null);
    input.focus();

    let committed = false;

    const commit = async () => {
      const newTitle = input.value.trim();
      committed = true;
      li.remove();
      if (!newTitle) return;

      const data = await getDramasData();
      const list = Array.isArray(data[`${mode}Sidebar`])
        ? data[`${mode}Sidebar`]
        : [];
      if (!list.includes(newTitle)) {
        list.push(newTitle);
      }
      list.sort((a, b) => String(a).localeCompare(String(b)));
      data[`${mode}Sidebar`] = list;
      saveDataToStorage();
      try {
        const ok = await persistDramasToServer();
        if (!ok) {
          showToast(
            "Sidebar change saved locally only (server unavailable).",
            true,
          );
        }
      } catch (e) {
        showToast("Sidebar change saved locally only (error).", true);
      }
      await loadSidebarLists();
    };

    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        void commit();
      } else if (ev.key === "Escape") {
        committed = true;
        li.remove();
      }
    });

    input.addEventListener("blur", () => {
      // if user clicks outside without pressing Enter, cancel (do not register)
      if (!committed) {
        li.remove();
      }
    });
  }

  async function addBlankCard() {
    if (!isAdminMode) {
      return;
    }

    const data = await getDramasData();
    const mode = getCurrentMode();
    genreFilters[mode] = null;

    const draftId = `draft-${Date.now()}`;
    const draft = {
      title: "",
      description: "",
      genre: [],
      episodes: "",
      rating: "",
      link: "",
      image: "",
      imageMobile: "",
      __isDraft: true,
      __draftId: draftId,
    };

    data[`${mode}Recommendations`] = [
      draft,
      ...(data[`${mode}Recommendations`] || []),
    ];

    await renderMode(mode, { showSkeletons: false, keepDraftOnTop: true });

    const container = document.getElementById(
      mode === "cdrama" ? "cdrama-container" : "kdrama-container",
    );
    const card = container?.querySelector(`[data-draft-id="${draftId}"]`);
    if (card) {
      enterCardEdit(card, draft, mode);
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function getSearchImage(drama) {
    return drama.image || drama.imageMobile || "";
  }

  function scrollToCard(title) {
    const container = document.getElementById(
      isCdramaMode ? "cdrama-container" : "kdrama-container",
    );
    if (!container) {
      return;
    }

    const cards = container.querySelectorAll(".main-recommendation");
    for (const card of cards) {
      if ((card.dataset.title || "").toLowerCase() === title.toLowerCase()) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.style.boxShadow =
          "0 0 0 3px var(--primary-color), 0 8px 30px rgba(248, 113, 209, 0.4)";
        window.setTimeout(() => {
          card.style.boxShadow = "";
        }, 2500);
        break;
      }
    }
  }

  async function doSearch(query) {
    if (!searchDropdown || !searchInput) {
      return;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      closeSearch();
      return;
    }

    const data = await getDramasData();
    const q = trimmed.toLowerCase();
    const allDramas = [
      ...(data.kdramaRecommendations || []).map((drama) => ({
        ...drama,
        mode: "kdrama",
      })),
      ...(data.cdramaRecommendations || []).map((drama) => ({
        ...drama,
        mode: "cdrama",
      })),
    ];

    const results = allDramas
      .filter((drama) => {
        const titleMatch = String(drama.title || "")
          .toLowerCase()
          .includes(q);
        const genreMatch = getGenreTokens(drama.genre)
          .join(" ")
          .toLowerCase()
          .includes(q);
        const episodeMatch = String(drama.episodes || "").includes(q);
        const ratingText = String(drama.rating || "").toLowerCase();
        const ratingMatch =
          ratingText.includes(q) ||
          String(parseRating(drama.rating)).includes(q);
        return titleMatch || genreMatch || episodeMatch || ratingMatch;
      })
      .slice(0, 8);

    if (!results.length) {
      searchDropdown.innerHTML = `
        <div class="search-no-results">
          No dramas found for "<strong>${escapeHtml(trimmed)}</strong>"
        </div>
      `;
    } else {
      searchDropdown.innerHTML = results
        .map(
          (drama) => `
            <a class="search-result-item" href="#" data-drama-title="${escapeHtml(drama.title)}" data-drama-mode="${drama.mode}">
              <img class="search-result-img" src="${escapeHtml(getSearchImage(drama))}" alt="${escapeHtml(drama.title)}" loading="lazy">
              <div class="search-item-info">
                <div class="search-item-title">${escapeHtml(drama.title)}</div>
                <div class="search-item-genres">${escapeHtml(getGenreTokens(drama.genre).join(" / "))}</div>
                <div class="search-item-rating">✦ ${escapeHtml(drama.rating || "N/A")}</div>
              </div>
            </a>
          `,
        )
        .join("");

      searchDropdown.querySelectorAll(".search-result-item").forEach((item) => {
        item.addEventListener("click", (event) => {
          event.preventDefault();
          const targetMode = item.dataset.dramaMode;
          const targetTitle = item.dataset.dramaTitle;
          closeSearch();
          searchInput.value = "";

          if (targetMode !== getCurrentMode()) {
            isCdramaMode = targetMode === "cdrama";
            applyThemeUi();
            syncModeSections();
            renderCurrentMode().then(() => scrollToCard(targetTitle));
          } else {
            scrollToCard(targetTitle);
          }
        });
      });
    }

    searchDropdown.classList.add("open");
  }

  function closeSearch() {
    if (!searchDropdown) {
      return;
    }
    searchDropdown.classList.remove("open");
  }

  function handleResize() {
    if (window.innerWidth <= 576) {
      mainContent.classList.remove("sidebar-open");
    }

    void renderCurrentMode({ showSkeletons: !dramasData });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      void doSearch(searchInput.value);
    });
    searchInput.addEventListener("focus", () => {
      if (searchInput.value) {
        void doSearch(searchInput.value);
      }
    });
  }

  document.addEventListener("click", (event) => {
    if (searchWrapper && !searchWrapper.contains(event.target)) {
      closeSearch();
    }
  });

  function updatePlaceholderVisibility() {
    if (!dropZone) return;
    const placeholder = dropZone.querySelector(".drop-placeholder");
    if (placeholder) {
      const physicalPills = dropZone.querySelectorAll(".drag-pill");
      placeholder.style.display = physicalPills.length === 0 ? "block" : "none";
    }
  }

  document.querySelectorAll(".drag-pill").forEach((pill) => {
    pill.addEventListener("dragstart", (e) => {
      if (puzzleStep !== 2) {
        e.preventDefault();
        return;
      }
      pill.classList.add("dragging");
      e.dataTransfer.setData("text/plain", pill.dataset.genre);
    });

    pill.addEventListener("dragend", () => {
      pill.classList.remove("dragging");
    });

    pill.addEventListener("click", () => {
      if (puzzleStep !== 2) return;
      if (pill.parentElement === dropZone) {
        dragPool.appendChild(pill);
        updatePlaceholderVisibility();
        const msg = document.getElementById("step2-msg");
        if (msg) {
          msg.textContent = "";
          msg.className = "puzzle-msg";
        }
      }
    });
  });

  if (dropZone) {
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("drag-over");
    });

    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("drag-over");
    });

    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("drag-over");
      if (puzzleStep !== 2) return;

      const genreKey = e.dataTransfer.getData("text/plain");
      const pill = document.querySelector(
        `.drag-pill[data-genre="${genreKey}"]`,
      );

      if (pill && pill.parentElement !== dropZone) {
        dropZone.appendChild(pill);
        updatePlaceholderVisibility();
        const msg = document.getElementById("step2-msg");
        if (msg) {
          msg.textContent = "";
          msg.className = "puzzle-msg";
        }
      }
    });
  }

  const puzzleGrid = document.getElementById("puzzle-grid");
  const step1CheckBtn = document.getElementById("step1-check");
  const step2CheckBtn = document.getElementById("step2-check");
  const phraseCheckBtn = document.getElementById("phrase-check-btn");
  const phraseInput = document.getElementById("phrase-input");

  if (puzzleGrid) {
    puzzleGrid.addEventListener("click", (event) => {
      const item = event.target.closest(".puzzle-item");
      if (!item || puzzleStep !== 1) {
        return;
      }

      const emoji = item.dataset.emoji || item.textContent.trim();

      if (item.classList.contains("selected")) {
        item.classList.remove("selected");
        step1Selection = step1Selection.filter((e) => e !== emoji);
      } else {
        if (step1Selection.length >= 3) {
          return;
        }
        item.classList.add("selected");
        step1Selection.push(emoji);
      }
    });
  }

  if (step1CheckBtn) {
    step1CheckBtn.addEventListener("click", () => {
      const msg = document.getElementById("step1-msg");
      if (puzzleStep !== 1) {
        return;
      }

      if (puzzleStepSolved[1]) {
        step1CheckBtn.textContent = "Check";
        if (msg) {
          msg.textContent = "";
          msg.className = "puzzle-msg";
        }
        advancePuzzle();
        return;
      }

      if (step1Selection.length !== 3) {
        return;
      }

      let isCorrect = true;
      for (let i = 0; i < 3; i++) {
        if (step1Selection[i] !== step1TargetSequence[i]) {
          isCorrect = false;
          break;
        }
      }

      if (isCorrect) {
        puzzleStepSolved[1] = true;
        puzzleGrid.querySelectorAll(".puzzle-item.selected").forEach((el) => {
          el.classList.remove("selected");
          el.classList.add("correct");
        });
        if (msg) {
          msg.className = "puzzle-msg ok";
          msg.textContent = "You go girl! YOU GO! ✨";
        }
        step1CheckBtn.textContent = "Continue";
      } else {
        if (msg) {
          msg.className = "puzzle-msg err";
          msg.textContent = "Hmm, that sequence wasn't right. Resetting.";
        }
        puzzleGrid.querySelectorAll(".puzzle-item").forEach((el) => {
          el.classList.add("wrong");
          setTimeout(() => {
            el.classList.remove("wrong", "selected");
          }, 400);
        });
        step1Selection = [];
      }
    });
  }

  if (step2CheckBtn) {
    step2CheckBtn.addEventListener("click", () => {
      const msg = document.getElementById("step2-msg");
      if (puzzleStep !== 2) return;

      if (puzzleStepSolved[2]) {
        step2CheckBtn.textContent = "Check";
        if (msg) {
          msg.textContent = "";
          msg.className = "puzzle-msg";
        }
        advancePuzzle();
        return;
      }

      // 1. Target your exact container elements
      const currentDropZone = document.getElementById("puzzle-drop-zone");
      const currentDragPool = document.getElementById("puzzle-drag-pool");
      if (!currentDropZone) return;

      // 2. Read the elements inside the zone and extract ONLY the clean genre text string
      const droppedPills = Array.from(
        currentDropZone.querySelectorAll(".drag-pill"),
      );
      const currentSelection = droppedPills.map((p) => {
        // Read the custom attribute directly, matching "Romance", "Fantasy", or "Comedy"
        return p.getAttribute("data-genre")
          ? p.getAttribute("data-genre").trim()
          : "";
      });

      // 3. Verify the layout sequence (Romance -> Fantasy -> Comedy)
      let isCorrect = currentSelection.length === 3;
      if (isCorrect) {
        for (let i = 0; i < 3; i++) {
          if (currentSelection[i] !== step2TargetSequence[i]) {
            isCorrect = false;
            break;
          }
        }
      }

      // 4. Update the state or reject back cleanly on failure
      if (isCorrect) {
        puzzleStepSolved[2] = true;
        if (msg) {
          msg.className = "puzzle-msg ok";
          msg.textContent = "YASSS I'VE RECOGNIZED MY QUEEN😍";
        }
        step2CheckBtn.textContent = "Continue";
      } else {
        if (msg) {
          msg.className = "puzzle-msg err";
          msg.textContent = "Loser loser pants on fire 😂";
        }

        // Shake the elements out, then append them back to the base pool cleanly
        if (currentDragPool) {
          droppedPills.forEach((pill) => {
            pill.classList.add("wrong");
            setTimeout(() => {
              pill.classList.remove("wrong");
              currentDragPool.appendChild(pill);

              // Recalculate and reveal placeholder state
              const placeholder =
                currentDropZone.querySelector(".drop-placeholder");
              if (placeholder) {
                const physicalPills =
                  currentDropZone.querySelectorAll(".drag-pill");
                placeholder.style.display =
                  physicalPills.length === 0 ? "block" : "none";
              }
            }, 500);
          });
        }
      }
    });
  }

  function checkPhrase() {
    const msg = document.getElementById("phrase-msg");
    if (puzzleStep !== 3) {
      return;
    }

    if (puzzleStepSolved[3]) {
      if (phraseCheckBtn) {
        phraseCheckBtn.textContent = "Confirm";
      }
      if (msg) {
        msg.textContent = "";
        msg.className = "puzzle-msg";
      }
      advancePuzzle();
      return;
    }

    const value = phraseInput ? phraseInput.value.trim().toLowerCase() : "";
    if (value === PUZZLE_PHRASE) {
      puzzleStepSolved[3] = true;
      if (msg) {
        msg.className = "puzzle-msg ok";
        msg.textContent = "My Dearest it is! 😛";
      }
      if (phraseCheckBtn) {
        phraseCheckBtn.textContent = "Continue";
      }
    } else {
      if (msg) {
        msg.className = "puzzle-msg err";
        msg.textContent = "✦ Not quite… think of a famous drama!";
      }
      if (phraseInput) {
        phraseInput.classList.add("error");
        window.setTimeout(() => {
          phraseInput.classList.remove("error");
        }, 500);
      }
    }
  }

  if (phraseCheckBtn) {
    phraseCheckBtn.addEventListener("click", checkPhrase);
  }

  if (phraseInput) {
    phraseInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        checkPhrase();
      }
    });
  }

  function showPuzzleStep(step) {
    document.querySelectorAll(".puzzle-step").forEach((panel) => {
      panel.classList.remove("active");
    });
    const current = document.getElementById(`step-${step}`);
    if (current) {
      current.classList.add("active");
    }

    for (let index = 0; index < 3; index += 1) {
      const dot = document.getElementById(`dot-${index}`);
      if (dot) {
        dot.classList.toggle("done", index < step - 1);
      }
    }
  }

  function openPuzzle() {
    if (!adminOverlay) return;

    puzzleStep = 1;
    puzzleStepSolved = { 1: false, 2: false, 3: false };
    step1Selection = [];

    const dz = document.getElementById("puzzle-drop-zone");
    const dp = document.getElementById("puzzle-drag-pool");
    if (dz && dp) {
      dz.querySelectorAll(".drag-pill").forEach((pill) => {
        dp.appendChild(pill);
      });
      const placeholder = dz.querySelector(".drop-placeholder");
      if (placeholder) placeholder.style.display = "block";
    }

    showPuzzleStep(1);

    const step1Msg = document.getElementById("step1-msg");
    const step2Msg = document.getElementById("step2-msg");
    const step3Msg = document.getElementById("phrase-msg");
    const step1Check = document.getElementById("step1-check");
    const step2Check = document.getElementById("step2-check");
    const step3Check = document.getElementById("phrase-check-btn");
    const phraseInput = document.getElementById("phrase-input");

    if (step1Msg) {
      step1Msg.textContent = "";
      step1Msg.className = "puzzle-msg";
    }
    if (step2Msg) {
      step2Msg.textContent = "";
      step2Msg.className = "puzzle-msg";
    }
    if (step3Msg) {
      step3Msg.textContent = "";
      step3Msg.className = "puzzle-msg";
    }
    if (step1Check) step1Check.textContent = "Check";
    if (step2Check) step2Check.textContent = "Check";
    if (step3Check) step3Check.textContent = "Confirm";
    if (phraseInput) phraseInput.value = "";

    const puzzleGrid = document.getElementById("puzzle-grid");
    if (puzzleGrid) {
      puzzleGrid.querySelectorAll(".puzzle-item").forEach((item) => {
        item.classList.remove("selected", "wrong", "correct");
      });
    }

    adminOverlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closePuzzle() {
    if (!adminOverlay) {
      return;
    }

    adminOverlay.classList.remove("active");
    document.body.style.overflow = "";
  }

  function advancePuzzle() {
    puzzleStep += 1;
    if (puzzleStep > 3) {
      closePuzzle();
      enterAdminMode({ celebrate: true });
      return;
    }

    showPuzzleStep(puzzleStep);
  }

  function enterAdminMode(options = {}) {
    isAdminMode = true;
    document.body.classList.add("admin-mode");
    if (options.celebrate) {
      playAdminCelebration();
    }
    void renderCurrentMode({ showSkeletons: false });
    void loadSidebarLists();
    showToast("Admin mode activated ✨");
  }

  function exitAdminMode() {
    isAdminMode = false;
    document.body.classList.remove("admin-mode");
    closePuzzle();
    void renderCurrentMode({ showSkeletons: false });
    void loadSidebarLists();
    showToast("Exited admin mode");
  }

  function playAdminCelebration() {
    document.body.classList.add("admin-celebrate");
    const overlay = document.createElement("div");
    overlay.className = "celebrate-overlay";

    const symbols = ["✦", "✨", "✧", "✦", "✨", "✧", "✦", "✨"];
    const particleColors = [
      "var(--primary-color)",
      "var(--secondary-color)",
      "rgba(255, 255, 255, 0.98)",
    ];
    const count = 120;
    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement("span");
      particle.className = "celebrate-particle";
      particle.textContent = symbols[index % symbols.length];
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${Math.random() * 28}%`;
      particle.style.fontSize = `${1.1 + Math.random() * 1.8}rem`;
      particle.style.animationDelay = `${Math.random() * 0.8}s`;
      particle.style.animationDuration = `${2.6 + Math.random() * 1.2}s`;
      particle.style.color = particleColors[index % particleColors.length];
      particle.style.transform = `rotate(${Math.random() * 40 - 20}deg)`;
      overlay.appendChild(particle);
    }

    document.body.appendChild(overlay);
    window.setTimeout(() => {
      overlay.remove();
      document.body.classList.remove("admin-celebrate");
    }, 2400);
  }

  window.rekoFrontEnd = {
    clearStatus,
    applyThemeUi,
    syncModeSections,
    renderMode,
    renderCurrentMode,
    loadSidebarLists,
    showToast,
    openPuzzle,
    closePuzzle,
    advancePuzzle,
    enterAdminMode,
    exitAdminMode,
    playAdminCelebration,
    addSidebarEntry,
    addBlankCard,
    updateSidebarEntry,
    handleResize,
    toggleMode: () => {
      isCdramaMode = !isCdramaMode;
      try {
        fadeModeSwitch();
      } catch (e) {
        applyThemeUi();
        syncModeSections();
        void renderCurrentMode();
        void loadSidebarLists();
      }
    },
    getCurrentMode,
  };

  menuBtn.addEventListener("click", function () {
    sidebar.classList.toggle("show");
    mainContent.classList.toggle("sidebar-open");
    clearStatus();
  });

  document.addEventListener("click", function (event) {
    if (
      !sidebar.contains(event.target) &&
      event.target !== menuBtn &&
      !menuBtn.contains(event.target)
    ) {
      sidebar.classList.remove("show");
      mainContent.classList.remove("sidebar-open");
      clearStatus();
    }
  });

  window.addEventListener("resize", handleResize);

  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const data = new FormData(form);
      clearStatus();

      try {
        const response = await fetch(form.action, {
          method: "POST",
          body: data,
          headers: {
            Accept: "application/json",
          },
        });

        if (response.ok) {
          status.textContent = "Submitted successfully.";
          status.classList.add("status-success");
          form.reset();
        } else {
          status.textContent = "Submission failed. Try again.";
          status.classList.add("status-error");
        }
      } catch (error) {
        status.textContent = "Something went wrong. Check your internet.";
        status.classList.add("status-error");
      }
    });
  }

  themeToggle.addEventListener("click", function () {
    window.rekoFrontEnd.toggleMode();
  });

  applyThemeUi();
  syncModeSections();
  void renderCurrentMode();
  void loadSidebarLists();
  handleResize();
});
