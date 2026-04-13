document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById("content-frame").src = link.dataset.page;
  });
});
