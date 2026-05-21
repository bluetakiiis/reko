document.addEventListener("DOMContentLoaded", function () {
  const menuBtn = document.getElementById("menu-btn");
  const sidebar = document.getElementById("sidebar");
  const mainContent = document.querySelector("main");
  const themeToggle = document.getElementById("theme-toggle");
  const navbarTitle = document.querySelector(".navbar-title");
  const form = document.getElementById("recommend-form");
  const status = document.getElementById("form-status");

  const savedTheme = localStorage.getItem("dramaTheme");
  let isCdramaMode = savedTheme === "cdrama";

  if (isCdramaMode) {
    document.body.classList.add("cdrama-theme");
    themeToggle.textContent = "toggle_on";
    navbarTitle.textContent = "Rupika's Cdrama Reko";
    document.getElementById("kdrama-list").style.display = "none";
    document.getElementById("cdrama-list").style.display = "block";
    document.getElementById("kdrama-rec").style.display = "none";
    document.getElementById("cdrama-rec").style.display = "block";
    loadCdramas();
  }

  menuBtn.addEventListener("click", function () {
    sidebar.classList.toggle("show");
    mainContent.classList.toggle("sidebar-open");
    clearStatus();
  });

  themeToggle.addEventListener("click", function () {
    isCdramaMode = !isCdramaMode;

    if (isCdramaMode) {
      document.body.classList.add("cdrama-theme");
      themeToggle.textContent = "toggle_on";
      navbarTitle.textContent = "Rupika's Cdrama Recs";
      document.getElementById("kdrama-list").style.display = "none";
      document.getElementById("cdrama-list").style.display = "block";
      document.getElementById("kdrama-rec").style.display = "none";
      document.getElementById("cdrama-rec").style.display = "block";
      loadCdramas();
    } else {
      document.body.classList.remove("cdrama-theme");
      themeToggle.textContent = "toggle_off";
      navbarTitle.textContent = "Rupika's Kdrama Recs";
      document.getElementById("kdrama-list").style.display = "block";
      document.getElementById("cdrama-list").style.display = "none";
      document.getElementById("kdrama-rec").style.display = "block";
      document.getElementById("cdrama-rec").style.display = "none";
    }

    localStorage.setItem("dramaTheme", isCdramaMode ? "cdrama" : "kdrama");
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

  function handleResize() {
    if (window.innerWidth <= 576) {
      mainContent.classList.remove("sidebar-open");
    }
  }

  function clearStatus() {
    if (status) {
      status.textContent = "";
      status.className = "form-status";
    }
  }

  window.addEventListener("resize", handleResize);
  handleResize();

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

  function getDramaImage(drama) {
    if (window.innerWidth <= 576 && drama.imageMobile) {
      return drama.imageMobile;
    }
    return drama.image;
  }

  async function loadCdramas() {
    const container = document.getElementById("cdrama-container");
    if (!container) return;
    showSkeletons(container, 3);
    try {
      const response = await fetch("dramas.json");
      const data = await response.json();
      container.innerHTML = "";
      (data.cdramaRecommendations || []).forEach((drama) => {
        const card = document.createElement("div");
        card.className = "main-recommendation";
        card.innerHTML = `
                    <img src="${getDramaImage(drama)}" alt="${drama.title}" class="main-img" loading="lazy" width="280" height="400">
                    <div class="main-text">
                        <h2 class="main-title">${drama.title}</h2>
                        <p>${drama.description}</p>
                        <p><strong>Genre:</strong> ${drama.genre}</p>
                        <p><strong>Episodes:</strong> ${drama.episodes}</p>
                        <p><strong>Rating:</strong> ${drama.rating}</p>
                        <a href="${drama.link}">Watch Now</a>
                    </div>
                `;
        container.appendChild(card);
      });
    } catch (err) {
      container.innerHTML = "<p>Failed to load recommendations.</p>";
    }
  }

  async function loadKdramas() {
    const container = document.getElementById("kdrama-container");
    if (!container) return;
    showSkeletons(container, 3);
    try {
      const response = await fetch("dramas.json");
      const data = await response.json();
      container.innerHTML = "";
      data.kdramaRecommendations.forEach((drama) => {
        const card = document.createElement("div");
        card.className = "main-recommendation";
        card.innerHTML = `
                    <img src="${getDramaImage(drama)}" alt="${drama.title}" class="main-img" loading="lazy" width="280" height="400">
                    <div class="main-text">
                        <h2 class="main-title">${drama.title}</h2>
                        <p>${drama.description}</p>
                        <p><strong>Genre:</strong> ${drama.genre}</p>
                        <p><strong>Episodes:</strong> ${drama.episodes}</p>
                        <p><strong>Rating:</strong> ${drama.rating}</p>
                        <a href="${drama.link}">Watch Now</a>
                    </div>
                `;
        container.appendChild(card);
      });
    } catch (err) {
      container.innerHTML = "<p>Failed to load recommendations.</p>";
    }
  }

  // Render skeleton placeholder cards synchronously so layout is stable
  function showSkeletons(container, count) {
    container.innerHTML = "";
    for (let i = 0; i < count; i++) {
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

  async function loadSidebarLists() {
    try {
      const response = await fetch("dramas.json");
      const data = await response.json();
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
    } catch (err) {}
  }

  loadKdramas();
  loadSidebarLists();
  if (isCdramaMode) {
    loadCdramas();
  }

  window.addEventListener("resize", function () {
    if (document.getElementById("kdrama-rec").style.display !== "none") {
      loadKdramas();
    } else {
      loadCdramas();
    }
  });

  themeToggle.addEventListener("click", function () {
    if (isCdramaMode) {
      loadCdramas();
    } else {
      loadKdramas();
    }
    loadSidebarLists();
  });

  let touchStartX = 0;
  let touchEndX = 0;

  function handleGesture() {
    if (window.innerWidth > 768) return;
    if (touchEndX < touchStartX - 50) {
      if (!isCdramaMode) {
        themeToggle.click();
      }
    }
    if (touchEndX > touchStartX + 50) {
      if (isCdramaMode) {
        themeToggle.click();
      }
    }
  }

  document.addEventListener(
    "touchstart",
    function (e) {
      touchStartX = e.changedTouches[0].screenX;
    },
    false,
  );
  document.addEventListener(
    "touchend",
    function (e) {
      touchEndX = e.changedTouches[0].screenX;
      handleGesture();
    },
    false,
  );
});
