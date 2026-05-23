document.addEventListener("DOMContentLoaded", function () {
  const api = window.rekoFrontEnd;
  if (!api) {
    return;
  }

  const adminKeyBtn = document.getElementById("admin-key-btn");
  const adminExitBtn = document.getElementById("admin-exit-btn");
  const puzzleClose = document.getElementById("puzzle-close");
  const sidebarAddBtn = document.getElementById("sidebar-add-btn");
  const fabAddBtn = document.getElementById("fab-add");

  if (adminKeyBtn) {
    adminKeyBtn.addEventListener("click", function () {
      if (document.body.classList.contains("admin-mode")) {
        api.exitAdminMode();
      } else {
        api.openPuzzle();
      }
    });
  }

  if (adminExitBtn) {
    adminExitBtn.addEventListener("click", () => {
      api.exitAdminMode();
    });
  }

  if (puzzleClose) {
    puzzleClose.addEventListener("click", () => {
      api.closePuzzle();
    });
  }

  if (sidebarAddBtn) {
    sidebarAddBtn.addEventListener("click", () => {
      void api.addSidebarEntry();
    });
  }

  if (fabAddBtn) {
    fabAddBtn.addEventListener("click", () => {
      void api.addBlankCard();
    });
  }
});
