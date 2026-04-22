document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById("content-frame").src = link.dataset.page;
  });
});

// ZOOM IN I-FRAME AND NOT FULL BROWSER WINDOW

let zoomLevel = 1;
const frame = document.getElementById("content-frame");

function applyZoom() {
  frame.style.width = `${100 / zoomLevel}%`;
  frame.style.height = `${100 / zoomLevel}%`;
  frame.style.transform = `scale(${zoomLevel})`;
  frame.style.transformOrigin = "top left";
}

document.getElementById("btn-zoom-in").addEventListener("click", () => {
  zoomLevel = Math.min(zoomLevel + 0.1, 2);
  applyZoom();
});

document.getElementById("btn-zoom-out").addEventListener("click", () => {
  zoomLevel = Math.max(zoomLevel - 0.1, 0.5);
  applyZoom();
});

document.getElementById("btn-zoom-reset").addEventListener("click", () => {
  zoomLevel = 1;
  applyZoom();
});
