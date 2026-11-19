import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, parse, resolve } from "node:path";

const usage =
  "Usage: node render-quad.mjs <project-dir-or-url> <output-prefix> [--model=<slug>] [--clay] [--export-glb=<path.glb>] [--size=1400]";

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const [target, outPrefix] = positional;

if (!target || !outPrefix) {
  console.error(usage);
  process.exit(1);
}

const getFlag = (name) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const modelSlug = getFlag("model");
const useClay = args.includes("--clay");
const glbOut = getFlag("export-glb");
const viewportSize = Number(getFlag("size") || 1400);

function findUpwardsPackageJsons(startDir) {
  const candidates = [];
  let dir = resolve(startDir);
  const { root } = parse(dir);
  while (true) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg)) candidates.push(pkg);
    if (dir === root) break;
    dir = dirname(dir);
  }
  return candidates;
}

async function loadFromWorkspace(pkgNames, searchDirs) {
  const pkgFiles = [...new Set(searchDirs.flatMap(findUpwardsPackageJsons))];
  const pick = (mod) => (mod?.chromium || mod?.createServer ? mod : mod?.default ?? mod);
  for (const name of pkgNames) {
    for (const pkgFile of pkgFiles) {
      try {
        const req = createRequire(pkgFile);
        return pick(req(name));
      } catch {}
      try {
        const req = createRequire(pkgFile);
        return pick(await import(req.resolve(name)));
      } catch {}
    }
    try {
      return pick(await import(name));
    } catch {}
  }
  return null;
}

const isUrl = /^https?:\/\//i.test(target);
const projectRoot = isUrl ? process.cwd() : resolve(target);
const searchRoots = isUrl ? [process.cwd()] : [projectRoot, process.cwd()];

const pw = await loadFromWorkspace(["playwright", "playwright-core"], searchRoots);
if (!pw) {
  console.error(
    "Missing playwright-core. Run `npm install -D playwright-core vite` in the project or workspace root.",
  );
  process.exit(1);
}

let viteServer = null;
let pageUrl = target;

if (!isUrl) {
  const viteMod = await loadFromWorkspace(["vite"], searchRoots);
  if (!viteMod) {
    console.error("Missing vite. Run `npm install -D vite` in the project or workspace root.");
    process.exit(1);
  }
  viteServer = await viteMod.createServer({
    root: projectRoot,
    logLevel: "error",
    server: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  await viteServer.listen();
  const addr = viteServer.httpServer.address();
  const port = typeof addr === "object" && addr ? addr.port : 5173;
  pageUrl = `http://127.0.0.1:${port}/`;
}

if (modelSlug) {
  const parsedUrl = new URL(pageUrl);
  parsedUrl.searchParams.set("model", modelSlug);
  pageUrl = parsedUrl.href;
}

const chromeCandidates = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];
const executablePath = chromeCandidates.find((p) => p && existsSync(p));

const launchArgs = ["--enable-webgl", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"];
if (process.platform === "darwin") {
  launchArgs.push("--use-gl=angle", "--use-angle=metal");
}

const browser = await pw.chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
  args: launchArgs,
});

const consoleErrors = [];
const pageErrors = [];

try {
  const context = await browser.newContext({
    viewport: { width: viewportSize, height: viewportSize },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    pageErrors.push(err.message || String(err));
  });

  await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForFunction(() => window.__studio && window.__studio.ready === true, null, {
    timeout: 20000,
  });

  const absPrefix = resolve(outPrefix);
  mkdirSync(dirname(absPrefix), { recursive: true });

  const orthoPath = `${absPrefix}-ortho.png`;
  const heroPath = `${absPrefix}-hero.png`;

  await page.evaluate((clay) => {
    window.__studio.setMode({ view: "ortho", clay, clean: true, explode: 0 });
  }, useClay);
  await page.waitForTimeout(120);
  await page.screenshot({ path: orthoPath });

  await page.evaluate((clay) => {
    window.__studio.setMode({
      view: "hero",
      clay,
      clean: true,
      explode: 0,
      resetHeroCamera: true,
    });
  }, useClay);
  await page.waitForTimeout(120);
  await page.screenshot({ path: heroPath });

  const diagnostics = await page.evaluate(() => window.__studio.getDiagnostics());

  const outputs = {
    orthoQuad: orthoPath,
    hero3Quarter: heroPath,
  };

  if (glbOut) {
    const absGlb = resolve(glbOut);
    mkdirSync(dirname(absGlb), { recursive: true });
    const base64 = await page.evaluate(() => window.__studio.exportGLBBase64());
    const buf = Buffer.from(base64, "base64");
    writeFileSync(absGlb, buf);
    outputs.glb = absGlb;
    outputs.glbBytes = buf.byteLength;
  }

  // Auto-update collection gallery thumbnail & meta.json on non-clay PBR passes
  if (modelSlug && !useClay && !isUrl) {
    const modelDir = join(projectRoot, "models", modelSlug);
    if (existsSync(modelDir)) {
      const thumbPath = join(modelDir, "thumbnail.png");
      copyFileSync(heroPath, thumbPath);
      outputs.thumbnail = thumbPath;

      const metaPath = join(modelDir, "meta.json");
      const metaPayload = {
        slug: modelSlug,
        name: diagnostics.metadata?.name || modelSlug,
        category: diagnostics.metadata?.category || "General",
        summary: diagnostics.metadata?.summary || "",
        units: diagnostics.metadata?.units || "meters",
        dimensions: diagnostics.dimensions,
        triangleCount: diagnostics.triangleCount,
        meshCount: diagnostics.meshCount,
        updatedAt: new Date().toISOString().slice(0, 10),
      };
      writeFileSync(metaPath, JSON.stringify(metaPayload, null, 2) + "\n");
      outputs.metaJson = metaPath;
    }
  }

  const report = {
    ok: consoleErrors.length === 0 && pageErrors.length === 0 && diagnostics.nanVertices === 0,
    clayMode: useClay,
    outputs,
    diagnostics,
    consoleErrors,
    pageErrors,
  };

  console.log(JSON.stringify(report, null, 2));

  if (!report.ok) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  if (viteServer) {
    await viteServer.close();
  }
}
