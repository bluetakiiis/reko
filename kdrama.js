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

  const genreFilters = {
    kdrama: null,
    cdrama: null,
  };

  const savedTheme = localStorage.getItem("dramaTheme");
  let isCdramaMode = savedTheme === "cdrama";
  let dramasData = null;
  let dramasDataPromise = null;
  let genrePaletteData = null;
  let genrePalettePromise = null;

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
    themeToggle.textContent = isCdramaMode ? "toggle_on" : "toggle_off";
    navbarTitle.textContent = isCdramaMode
      ? "Rupika's Cdrama Recs"
      : "Rupika's Kdrama Recs";

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

  function getDramaImage(drama) {
    if (window.innerWidth <= 576 && drama.imageMobile) {
      return drama.imageMobile;
    }

    return drama.image;
  }

  function getGenreTokens(genreValue) {
    return String(genreValue || "")
      .split("/")
      .flatMap((part) => part.split(/\s{2,}/))
      .map((part) => part.replace(/\s+/g, " ").trim())
      .filter(Boolean);
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
      genrePalettePromise = fetch("genres.json")
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

  async function getDramasData() {
    if (dramasData) {
      return dramasData;
    }

    if (!dramasDataPromise) {
      dramasDataPromise = fetch("dramas.json")
        .then((response) => response.json())
        .then((data) => {
          dramasData = data;
          return data;
        })
        .catch((error) => {
          dramasDataPromise = null;
          throw error;
        });
    }

    return dramasDataPromise;
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

  function createDramaCard(drama, mode) {
    const card = document.createElement("div");
    const activeGenre = genreFilters[mode];
    const genres = getGenreTokens(drama.genre);

    card.className = "main-recommendation";
    card.innerHTML = `
      <img src="${getDramaImage(drama)}" alt="${escapeHtml(drama.title)}" class="main-img" loading="lazy" width="280" height="400">
      <div class="main-text">
        <h2 class="main-title">${escapeHtml(drama.title)}</h2>
        <p>${escapeHtml(drama.description)}</p>
        <div class="genre-row">
          <div class="genre-label">Genre:</div>
          <div class="genre-pills" aria-label="Genres">
            ${genres.map((genre) => createGenrePill(genre, activeGenre, mode)).join("")}
          </div>
        </div>
        <p><strong>Episodes:</strong> ${escapeHtml(drama.episodes)}</p>
        <p><strong>Rating:</strong> ${escapeHtml(drama.rating)}</p>
        <a href="${escapeHtml(drama.link)}">Watch Now</a>
      </div>
    `;

    return card;
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

      let items = [...(data[`${mode}Recommendations`] || [])];

      if (activeGenre) {
        items = sortByRating(items);
      } else {
        items.sort((left, right) =>
          String(left.title).localeCompare(String(right.title)),
        );
      }

      const filteredItems = items.filter((drama) =>
        matchesGenre(drama, activeGenre),
      );

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
        data.kdramaSidebar.forEach((title) => {
          const li = document.createElement("li");
          li.textContent = title;
          kdramaList.appendChild(li);
        });
      }

      if (cdramaList) {
        cdramaList.innerHTML = "";
        data.cdramaSidebar.forEach((title) => {
          const li = document.createElement("li");
          li.textContent = title;
          cdramaList.appendChild(li);
        });
      }
    } catch (error) {}
  }

  function handleResize() {
    if (window.innerWidth <= 576) {
      mainContent.classList.remove("sidebar-open");
    }

    void renderCurrentMode({ showSkeletons: !dramasData });
  }

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
    isCdramaMode = !isCdramaMode;
    localStorage.setItem("dramaTheme", isCdramaMode ? "cdrama" : "kdrama");
    applyThemeUi();
    clearStatus();
    void renderCurrentMode();
    void loadSidebarLists();
  });

  applyThemeUi();
  attachGenreFilterHandler(kdramaContainer);
  attachGenreFilterHandler(cdramaContainer);
  void renderCurrentMode();
  void loadSidebarLists();
  handleResize();
});
