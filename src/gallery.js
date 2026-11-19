const modelLoaders = import.meta.glob("/models/*/model.js");
const metaFiles = import.meta.glob("/models/*/meta.json", {
  eager: true,
  import: "default",
});
const thumbFiles = import.meta.glob("/models/*/thumbnail.{png,jpg,jpeg,webp}", {
  eager: true,
  query: "?url",
  import: "default",
});

function humanizeSlug(slug) {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function findThumbnail(slug) {
  for (const ext of ["png", "webp", "jpg", "jpeg"]) {
    const key = `/models/${slug}/thumbnail.${ext}`;
    if (thumbFiles[key]) return thumbFiles[key];
  }
  return null;
}

export function getCatalog() {
  const entries = Object.keys(modelLoaders).map((path) => {
    const match = path.match(/^\/models\/([^/]+)\/model\.js$/);
    const slug = match ? match[1] : path;
    const meta = metaFiles[`/models/${slug}/meta.json`] || {};
    const thumbnail = findThumbnail(slug);

    return {
      slug,
      name: meta.name || humanizeSlug(slug),
      category: meta.category || "General",
      summary: meta.summary || "",
      dimensions: meta.dimensions || null,
      triangleCount: meta.triangleCount ?? null,
      meshCount: meta.meshCount ?? null,
      updatedAt: meta.updatedAt || null,
      thumbnail,
      load: modelLoaders[path],
    };
  });

  return entries.sort((a, b) => {
    if (a.updatedAt && b.updatedAt && a.updatedAt !== b.updatedAt) {
      return b.updatedAt.localeCompare(a.updatedAt);
    }
    return a.name.localeCompare(b.name);
  });
}

export async function loadModelBuilder(slug) {
  const loader = modelLoaders[`/models/${slug}/model.js`];
  if (!loader) return null;
  const mod = await loader();
  if (typeof mod.preload === "function") {
    await mod.preload();
  }
  return mod.buildModel || mod.default || null;
}
