import { getCatalog, loadModelBuilder } from "./gallery.js";
import { mountStudio } from "./kit/studio.js";

const galleryView = document.getElementById("gallery-view");
const viewerView = document.getElementById("viewer-view");
const modelCountEl = document.getElementById("model-count");
const categoryBar = document.getElementById("category-bar");
const searchInput = document.getElementById("search-input");
const modelGrid = document.getElementById("model-grid");
const emptyState = document.getElementById("empty-state");

const backBtn = document.getElementById("back-btn");
const viewerTitle = document.getElementById("viewer-title");
const viewerSpecs = document.getElementById("viewer-specs");
const btnViewHero = document.getElementById("btn-view-hero");
const btnViewOrtho = document.getElementById("btn-view-ortho");
const btnClay = document.getElementById("btn-clay");
const btnWire = document.getElementById("btn-wire");
const btnGrid = document.getElementById("btn-grid");
const btnExport = document.getElementById("btn-export");
const guiDock = document.getElementById("gui-dock");
const canvas = document.getElementById("viewport");

const catalog = getCatalog();
let activeCategory = "All";
let searchQuery = "";
let activeStudio = null;
let activeSlug = null;

function formatDims(d) {
  if (!d) return "";
  return `${d.width.toFixed(2)} × ${d.height.toFixed(2)} × ${d.depth.toFixed(2)} m`;
}

function formatTris(n) {
  if (n == null) return "";
  return `${Number(n).toLocaleString("en-US")} tris`;
}

function renderCategories() {
  const categories = ["All", ...new Set(catalog.map((m) => m.category).filter(Boolean))];
  categoryBar.innerHTML = "";
  if (categories.length <= 2) {
    // Only "All" + 1 category: keep bar quiet until multiple categories exist
    return;
  }
  for (const cat of categories) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `cat-btn${cat === activeCategory ? " is-active" : ""}`;
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      activeCategory = cat;
      renderCategories();
      renderGalleryGrid();
    });
    categoryBar.appendChild(btn);
  }
}

function renderGalleryGrid() {
  const q = searchQuery.trim().toLowerCase();
  const filtered = catalog.filter((item) => {
    const matchCat = activeCategory === "All" || item.category === activeCategory;
    const matchText =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.slug.toLowerCase().includes(q) ||
      item.summary.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q);
    return matchCat && matchText;
  });

  modelCountEl.textContent = `${catalog.length} ${catalog.length === 1 ? "model" : "models"}`;
  modelGrid.innerHTML = "";
  emptyState.hidden = filtered.length > 0;

  for (const item of filtered) {
    const card = document.createElement("a");
    card.href = `?model=${encodeURIComponent(item.slug)}`;
    card.className = "model-card";
    card.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigateToModel(item.slug);
    });

    const well = document.createElement("div");
    well.className = "card-preview-well";
    if (item.thumbnail) {
      const img = document.createElement("img");
      img.src = item.thumbnail;
      img.alt = item.name;
      img.loading = "lazy";
      well.appendChild(img);
    } else {
      const fb = document.createElement("span");
      fb.className = "card-preview-fallback";
      fb.textContent = item.slug;
      well.appendChild(fb);
    }

    const body = document.createElement("div");
    body.className = "card-body";

    const topRow = document.createElement("div");
    topRow.className = "card-top-row";

    const title = document.createElement("h2");
    title.className = "card-title";
    title.textContent = item.name;

    const cat = document.createElement("span");
    cat.className = "card-category";
    cat.textContent = item.category;

    topRow.append(title, cat);
    body.appendChild(topRow);

    if (item.summary) {
      const summary = document.createElement("p");
      summary.className = "card-summary";
      summary.textContent = item.summary;
      body.appendChild(summary);
    }

    const dimsText = formatDims(item.dimensions);
    const trisText = formatTris(item.triangleCount);
    if (dimsText || trisText) {
      const metaRow = document.createElement("div");
      metaRow.className = "card-meta-row";
      const left = document.createElement("span");
      left.textContent = dimsText;
      const right = document.createElement("span");
      right.textContent = trisText;
      metaRow.append(left, right);
      body.appendChild(metaRow);
    }

    card.append(well, body);
    modelGrid.appendChild(card);
  }
}

function syncToolbarButtons(state) {
  btnViewHero.classList.toggle("is-active", state.view === "hero");
  btnViewOrtho.classList.toggle("is-active", state.view === "ortho");
  btnClay.classList.toggle("is-active", state.clay);
  btnWire.classList.toggle("is-active", state.wireframe);
  btnGrid.classList.toggle("is-active", state.grid);
}

async function openViewer(slug) {
  const buildModel = await loadModelBuilder(slug);
  if (!buildModel) {
    openGallery(true);
    return;
  }

  if (activeStudio) {
    activeStudio.destroy();
    activeStudio = null;
  }

  activeSlug = slug;
  galleryView.hidden = true;
  viewerView.hidden = false;
  document.body.classList.add("viewer-active");

  activeStudio = mountStudio(buildModel, {
    canvas,
    guiContainer: guiDock,
    onStateChange: syncToolbarButtons,
  });

  const diag = activeStudio.getDiagnostics();
  const displayName = diag.metadata?.name || catalog.find((c) => c.slug === slug)?.name || slug;
  viewerTitle.textContent = displayName;
  viewerSpecs.textContent = `${formatDims(diag.dimensions)} · ${formatTris(diag.triangleCount)}`;
  document.title = `${displayName} — 3D Models`;
  syncToolbarButtons(activeStudio.getState());
}

function openGallery(replaceUrl = false) {
  if (activeStudio) {
    activeStudio.destroy();
    activeStudio = null;
  }
  activeSlug = null;
  viewerView.hidden = true;
  galleryView.hidden = false;
  document.body.classList.remove("viewer-active");
  document.title = "3D Model Collection";

  if (replaceUrl) {
    window.history.replaceState({}, "", window.location.pathname);
  }
}

function navigateToModel(slug) {
  const url = new URL(window.location.href);
  url.searchParams.set("model", slug);
  window.history.pushState({}, "", url);
  openViewer(slug);
}

function navigateToGallery() {
  window.history.pushState({}, "", window.location.pathname);
  openGallery(false);
}

function syncRouteFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("model");
  if (slug) {
    openViewer(slug);
  } else {
    openGallery(false);
  }
}

// Event Listeners
searchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value;
  renderGalleryGrid();
});

backBtn.addEventListener("click", navigateToGallery);

btnViewHero.addEventListener("click", () => {
  if (activeStudio) activeStudio.setMode({ view: "hero" });
});

btnViewOrtho.addEventListener("click", () => {
  if (activeStudio) activeStudio.setMode({ view: "ortho" });
});

btnClay.addEventListener("click", () => {
  if (!activeStudio) return;
  const cur = activeStudio.getState();
  activeStudio.setMode({ clay: !cur.clay });
});

btnWire.addEventListener("click", () => {
  if (!activeStudio) return;
  const cur = activeStudio.getState();
  activeStudio.setMode({ wireframe: !cur.wireframe });
});

btnGrid.addEventListener("click", () => {
  if (!activeStudio) return;
  const cur = activeStudio.getState();
  activeStudio.setMode({ grid: !cur.grid });
});

btnExport.addEventListener("click", () => {
  if (activeStudio) activeStudio.downloadGLB(activeSlug);
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && activeSlug && document.activeElement?.tagName !== "INPUT") {
    navigateToGallery();
  }
});

window.addEventListener("popstate", syncRouteFromUrl);

// Boot
renderCategories();
renderGalleryGrid();
syncRouteFromUrl();
